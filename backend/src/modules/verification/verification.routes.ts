import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ConflictError } from '../../utils/errors.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { VerificationStatus } from '../../../../shared/types/index.js';

const router = Router();

const submitVerificationSchema = z.object({
  submittedStudentId: z
    .string({ required_error: 'Submitted student ID is required' })
    .trim()
    .min(3, 'Student ID must be at least 3 characters')
    .max(50, 'Student ID cannot exceed 50 characters'),
  proofDocumentUrl: z
    .string({ required_error: 'Proof document URL is required' })
    .trim()
    .url('Proof document URL must be a valid URL')
    .max(500),
});

// POST /api/v1/verification/submit
router.post(
  '/submit',
  authenticate,
  validate({ body: submitVerificationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { submittedStudentId, proofDocumentUrl } = req.body;

      if (req.user!.isVerified) {
        throw new ConflictError('Your student account is already verified.');
      }

      const existingPending = await db.query<{ request_id: string }>(
        `SELECT request_id
         FROM student_verification_requests
         WHERE user_id = $1 AND status = 'PENDING'`,
        [userId]
      );

      if (existingPending.rowCount > 0) {
        throw new ConflictError(
          'You already have a pending verification request under review.'
        );
      }

      const inserted = await db.query<{
        request_id: string;
        user_id: string;
        submitted_student_id: string;
        proof_document_url: string;
        status: VerificationStatus;
        submitted_at: Date | string;
      }>(
        `INSERT INTO student_verification_requests (user_id, submitted_student_id, proof_document_url, status)
         VALUES ($1, $2, $3, 'PENDING')
         RETURNING request_id, user_id, submitted_student_id, proof_document_url, status, submitted_at`,
        [userId, submittedStudentId, proofDocumentUrl]
      );

      const row = inserted.rows[0];
      return sendCreated(res, {
        requestId: row.request_id,
        userId: row.user_id,
        submittedStudentId: row.submitted_student_id,
        proofDocumentUrl: row.proof_document_url,
        status: row.status,
        submittedAt: new Date(row.submitted_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/verification/status (and /me alias)
const getStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;

    const latestRes = await db.query<{
      request_id: string;
      user_id: string;
      submitted_student_id: string;
      proof_document_url: string;
      status: VerificationStatus;
      reviewed_by: string | null;
      reviewer_note: string | null;
      submitted_at: Date | string;
      reviewed_at: Date | string | null;
    }>(
      `SELECT request_id, user_id, submitted_student_id, proof_document_url,
              status, reviewed_by, reviewer_note, submitted_at, reviewed_at
       FROM student_verification_requests
       WHERE user_id = $1
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [userId]
    );

    const latest = latestRes.rows[0];
    return sendSuccess(res, {
      isVerified: req.user!.isVerified,
      latestRequest: latest
        ? {
            requestId: latest.request_id,
            userId: latest.user_id,
            submittedStudentId: latest.submitted_student_id,
            proofDocumentUrl: latest.proof_document_url,
            status: latest.status,
            reviewedBy: latest.reviewed_by,
            reviewerNote: latest.reviewer_note,
            submittedAt: new Date(latest.submitted_at).toISOString(),
            reviewedAt: latest.reviewed_at
              ? new Date(latest.reviewed_at).toISOString()
              : null,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

router.get('/status', authenticate, getStatusHandler);
router.get('/me', authenticate, getStatusHandler);

export default router;

