import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.zip',
]);

const presignedUrlSchema = z.object({
  fileName: z
    .string({ required_error: 'fileName is required' })
    .trim()
    .min(1, 'fileName is required')
    .max(255),
  fileType: z
    .string({ required_error: 'fileType is required' })
    .trim()
    .toLowerCase(),
  category: z
    .enum([
      'verification',
      'avatar',
      'attachment',
      'proposal',
      'club_logo',
      'event_banner',
    ])
    .default('attachment'),
  sizeBytes: z.number().int().positive().optional(),
});

// POST /api/v1/uploads/presigned-url
router.post(
  '/presigned-url',
  authenticate,
  validate({ body: presignedUrlSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { fileName, fileType, category, sizeBytes } = req.body;

      const ext = path.extname(fileName).toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        throw new ValidationError(
          `Unsupported file extension "${ext || 'none'}". Allowed: JPG, PNG, WEBP, PDF, DOC, DOCX, PPT, PPTX, TXT, ZIP.`,
          [
            {
              field: 'fileName',
              issue: 'File extension is not permitted',
            },
          ]
        );
      }

      if (!ALLOWED_MIME_TYPES.has(fileType)) {
        throw new ValidationError(
          `Unsupported MIME type "${fileType}".`,
          [
            {
              field: 'fileType',
              issue: 'File MIME type is not permitted',
            },
          ]
        );
      }

      if (sizeBytes && sizeBytes > env.uploadMaxSizeBytes) {
        throw new ValidationError(
          `File size exceeds maximum limit of ${Math.round(
            env.uploadMaxSizeBytes / (1024 * 1024)
          )}MB.`,
          [
            {
              field: 'sizeBytes',
              issue: `Maximum allowed file size is ${env.uploadMaxSizeBytes} bytes`,
            },
          ]
        );
      }

      const safeBaseName = path
        .basename(fileName, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      const uniquePrefix = crypto.randomUUID().slice(0, 8);
      const storedName = `${uniquePrefix}-${safeBaseName}${ext}`;
      const publicUrl = `${env.publicBaseUrl}/uploads/${category}/${storedName}`;
      const expiresAt = new Date(
        Date.now() + env.uploadPresignedExpiresSeconds * 1000
      );

      const inserted = await db.query<{
        upload_id: string;
        public_url: string;
        expires_at: Date | string;
      }>(
        `INSERT INTO upload_tickets (user_id, file_name, stored_name, file_type, category, size_bytes, public_url, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING upload_id, public_url, expires_at`,
        [
          userId,
          fileName,
          storedName,
          fileType,
          category,
          sizeBytes ?? null,
          publicUrl,
          expiresAt.toISOString(),
        ]
      );

      const ticket = inserted.rows[0];
      const uploadUrl = `${env.publicBaseUrl}${env.apiPrefix}/uploads/put/${ticket.upload_id}`;

      return sendCreated(res, {
        uploadId: ticket.upload_id,
        uploadUrl,
        publicUrl: ticket.public_url,
        fileUrl: ticket.public_url,
        method: 'PUT',
        expiresIn: env.uploadPresignedExpiresSeconds,
        headers: {
          'Content-Type': fileType,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/uploads/put/:uploadId
router.put(
  '/put/:uploadId',
  express.raw({ type: '*/*', limit: '25mb' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { uploadId } = req.params;

      const ticketRes = await db.query<{
        upload_id: string;
        stored_name: string;
        category: string;
        file_type: string;
        public_url: string;
        is_uploaded: boolean;
        expires_at: Date | string;
      }>(
        `SELECT upload_id, stored_name, category, file_type, public_url, is_uploaded, expires_at
         FROM upload_tickets
         WHERE upload_id = $1`,
        [uploadId]
      );

      if (ticketRes.rowCount === 0) {
        throw new NotFoundError('Upload ticket not found.');
      }

      const ticket = ticketRes.rows[0];
      if (new Date(ticket.expires_at).getTime() < Date.now()) {
        throw new BadRequestError(
          'Presigned upload URL has expired.',
          undefined,
          'UPLOAD_EXPIRED'
        );
      }

      const bodyBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(
            typeof req.body === 'string'
              ? req.body
              : JSON.stringify(req.body || '')
          );

      const categoryDir = path.join(env.uploadStorageDir, ticket.category);
      fs.mkdirSync(categoryDir, { recursive: true });
      const targetPath = path.join(categoryDir, ticket.stored_name);
      fs.writeFileSync(targetPath, bodyBuffer);

      await db.query(
        `UPDATE upload_tickets
         SET is_uploaded = TRUE, size_bytes = $2
         WHERE upload_id = $1`,
        [uploadId, bodyBuffer.length]
      );

      return sendSuccess(
        res,
        {
          uploadId: ticket.upload_id,
          publicUrl: ticket.public_url,
          fileUrl: ticket.public_url,
          sizeBytes: bodyBuffer.length,
        },
        200,
        'File uploaded successfully.'
      );
    } catch (err) {
      next(err);
    }
  }
);

export default router;

