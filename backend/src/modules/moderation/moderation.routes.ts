import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import {
  parsePaginationParams,
  sendCreated,
  sendPaginated,
  sendSuccess,
} from '../../utils/response.js';
import { notificationsService } from '../notifications/notifications.service.js';

export const reportsRouter = Router();
export const adminRouter = Router();

const createReportSchema = z.object({
  postId: z.string().uuid('postId must be a valid UUID'),
  reason: z.string().trim().min(2, 'Reason is required').max(150),
  description: z.string().trim().max(2000).optional().nullable(),
});

const moderationActionSchema = z.object({
  reportId: z.string().uuid('reportId must be a valid UUID').optional().nullable(),
  postId: z.string().uuid('postId must be a valid UUID'),
  actionType: z.enum([
    'DELETE_POST',
    'APPROVE_POST',
    'DISMISS_REPORT',
    'KEEP_POST',
  ]),
  reason: z.string().trim().min(2, 'Moderation reason is required').max(1000),
  suspendUser: z.boolean().default(false),
});

const reviewVerificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewerNote: z.string().trim().max(1000).optional().nullable(),
});

const reviewClubCreationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(1000).optional().nullable(),
});

const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['STUDENT', 'CLUB_LEADER', 'FACULTY', 'ADMIN']),
});

// ============================================================================
// STUDENT REPORTING (/api/v1/reports)
// ============================================================================

// POST /api/v1/reports
reportsRouter.post(
  '/',
  authenticate,
  validate({ body: createReportSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { postId, reason, description } = req.body;

      const postCheck = await db.query(
        'SELECT post_id FROM posts WHERE post_id = $1 AND is_deleted = FALSE',
        [postId]
      );
      if (postCheck.rowCount === 0) {
        throw new NotFoundError('Post not found.');
      }

      const dupReport = await db.query(
        `SELECT report_id FROM post_reports
         WHERE post_id = $1 AND reported_by = $2 AND status = 'PENDING'`,
        [postId, userId]
      );
      if (dupReport.rowCount > 0) {
        throw new ConflictError(
          'You have already reported this post and it is pending review.'
        );
      }

      const inserted = await db.query<{
        report_id: string;
        post_id: string;
        reported_by: string;
        reason: string;
        description: string | null;
        status: string;
        reported_at: Date | string;
      }>(
        `INSERT INTO post_reports (post_id, reported_by, reason, description, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING report_id, post_id, reported_by, reason, description, status, reported_at`,
        [postId, userId, reason, description ?? null]
      );

      const r = inserted.rows[0];
      return sendCreated(
        res,
        {
          reportId: r.report_id,
          postId: r.post_id,
          reportedBy: r.reported_by,
          reason: r.reason,
          description: r.description,
          status: r.status,
          reportedAt: new Date(r.reported_at).toISOString(),
        },
        'Report submitted successfully for moderator review.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// ADMIN MODERATION & GOVERNANCE (/api/v1/admin/*)
// ============================================================================

adminRouter.use(authenticate, authorize('ADMIN'));

// GET /api/v1/admin/reports
adminRouter.get(
  '/reports',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        20
      );
      const status = (req.query.status as string | undefined)
        ?.trim()
        .toUpperCase();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (status) {
        if (!['PENDING', 'RESOLVED', 'DISMISSED'].includes(status)) {
          throw new ValidationError(
            'Invalid status filter. Must be PENDING, RESOLVED, or DISMISSED.',
            [
              {
                field: 'status',
                issue: 'Must be PENDING, RESOLVED, or DISMISSED',
              },
            ]
          );
        }
        params.push(status);
        conditions.push(`r.status = $${params.length}`);
      }

      const whereSql =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM post_reports r ${whereSql}`,
        params
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const listRes = await db.query<{
        report_id: string;
        post_id: string;
        reported_by: string;
        reason: string;
        description: string | null;
        status: string;
        reviewed_by: string | null;
        review_note: string | null;
        reported_at: Date | string;
        reviewed_at: Date | string | null;
        reporter_name: string;
        reporter_username: string;
        post_content: string;
        post_type: string;
        post_is_deleted: boolean;
        post_author_id: string;
        post_author_name: string;
      }>(
        `SELECT r.report_id, r.post_id, r.reported_by, r.reason, r.description,
                r.status, r.reviewed_by, r.review_note, r.reported_at, r.reviewed_at,
                rep_prof.full_name AS reporter_name,
                rep_prof.username AS reporter_username,
                p.content AS post_content,
                p.post_type,
                p.is_deleted AS post_is_deleted,
                p.author_id AS post_author_id,
                auth_prof.full_name AS post_author_name
         FROM post_reports r
         INNER JOIN profiles rep_prof ON rep_prof.user_id = r.reported_by
         INNER JOIN posts p ON p.post_id = r.post_id
         INNER JOIN profiles auth_prof ON auth_prof.user_id = p.author_id
         ${whereSql}
         ORDER BY r.reported_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limit, offset]
      );

      const reports = listRes.rows.map((r) => ({
        reportId: r.report_id,
        postId: r.post_id,
        reportedBy: r.reported_by,
        reporter: {
          userId: r.reported_by,
          fullName: r.reporter_name,
          username: r.reporter_username,
        },
        post: {
          postId: r.post_id,
          content: r.post_content,
          postType: r.post_type,
          isDeleted: r.post_is_deleted,
          authorId: r.post_author_id,
          authorName: r.post_author_name,
        },
        reason: r.reason,
        description: r.description,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewNote: r.review_note,
        reportedAt: new Date(r.reported_at).toISOString(),
        reviewedAt: r.reviewed_at
          ? new Date(r.reviewed_at).toISOString()
          : null,
      }));

      return sendPaginated(res, reports, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/admin/moderation/action
adminRouter.post(
  '/moderation/action',
  validate({ body: moderationActionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = req.user!.userId;
      const { reportId, postId, actionType, reason, suspendUser } = req.body;

      const postCheck = await db.query<{
        post_id: string;
        author_id: string;
        is_deleted: boolean;
      }>('SELECT post_id, author_id, is_deleted FROM posts WHERE post_id = $1', [
        postId,
      ]);

      if (postCheck.rowCount === 0) {
        throw new NotFoundError('Target post not found.');
      }
      const post = postCheck.rows[0];

      if (reportId) {
        const repCheck = await db.query(
          'SELECT report_id FROM post_reports WHERE report_id = $1',
          [reportId]
        );
        if (repCheck.rowCount === 0) {
          throw new NotFoundError('Referenced report not found.');
        }
      }

      const result = await db.withTransaction(async (tx) => {
        if (actionType === 'DELETE_POST') {
          await tx.query(
            `UPDATE posts
             SET is_deleted = TRUE,
                 moderation_status = 'REJECTED',
                 deleted_at = CURRENT_TIMESTAMP,
                 deleted_by = $2,
                 deletion_reason = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE post_id = $1`,
            [postId, adminId, reason]
          );

          await tx.query(
            `UPDATE post_reports
             SET status = 'RESOLVED',
                 reviewed_by = $2,
                 review_note = $3,
                 reviewed_at = CURRENT_TIMESTAMP
             WHERE post_id = $1 AND status = 'PENDING'`,
            [postId, adminId, reason]
          );
        } else {
          const newReportStatus =
            actionType === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED';
          if (reportId) {
            await tx.query(
              `UPDATE post_reports
               SET status = $2,
                   reviewed_by = $3,
                   review_note = $4,
                   reviewed_at = CURRENT_TIMESTAMP
               WHERE report_id = $1`,
              [reportId, newReportStatus, adminId, reason]
            );
          } else {
            await tx.query(
              `UPDATE post_reports
               SET status = $2,
                   reviewed_by = $3,
                   review_note = $4,
                   reviewed_at = CURRENT_TIMESTAMP
               WHERE post_id = $1 AND status = 'PENDING'`,
              [postId, newReportStatus, adminId, reason]
            );
          }
        }

        const modAction = await tx.query<{
          action_id: string;
          post_id: string;
          admin_id: string;
          action_type: string;
          reason: string | null;
          action_at: Date | string;
        }>(
          `INSERT INTO post_moderation_actions (post_id, admin_id, action_type, reason)
           VALUES ($1, $2, $3, $4)
           RETURNING action_id, post_id, admin_id, action_type, reason, action_at`,
          [postId, adminId, actionType, reason]
        );

        await tx.query(
          `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, action_details)
           VALUES ($1, $2, 'POST', $3, $4)`,
          [
            adminId,
            `MODERATION_${actionType}`,
            postId,
            JSON.stringify({
              reportId: reportId ?? null,
              reason,
              suspendUser,
            }),
          ]
        );

        if (suspendUser && post.author_id !== adminId) {
          await tx.query(
            `UPDATE users
             SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [post.author_id]
          );
          await tx.query(
            `UPDATE refresh_tokens
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND revoked_at IS NULL`,
            [post.author_id]
          );
          await tx.query(
            `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, action_details)
             VALUES ($1, 'SUSPEND_USER', 'USER', $2, $3)`,
            [
              adminId,
              post.author_id,
              JSON.stringify({ reason: `Suspended via moderation: ${reason}` }),
            ]
          );
        }

        if (actionType === 'DELETE_POST') {
          await notificationsService.createNotification(
            {
              userId: post.author_id,
              type: 'MODERATION_NOTICE',
              title: 'Post Removed by Moderation',
              message: `Your post was removed for violating community standards: ${reason}`,
              referenceType: 'POST',
              referenceId: postId,
            },
            tx
          );
        }

        return modAction.rows[0];
      });

      return sendSuccess(
        res,
        {
          actionId: result.action_id,
          reportId: reportId ?? null,
          postId: result.post_id,
          adminId: result.admin_id,
          actionType: result.action_type,
          reason: result.reason,
          userSuspended: Boolean(suspendUser),
          actionAt: new Date(result.action_at).toISOString(),
        },
        200,
        'Moderation action executed successfully.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/verifications
adminRouter.get(
  '/verifications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        20
      );
      const status = (req.query.status as string | undefined)
        ?.trim()
        .toUpperCase();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (status) {
        params.push(status);
        conditions.push(`vr.status = $${params.length}`);
      }

      const whereSql =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM student_verification_requests vr ${whereSql}`,
        params
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const listRes = await db.query<{
        request_id: string;
        user_id: string;
        submitted_student_id: string;
        proof_document_url: string;
        status: string;
        reviewed_by: string | null;
        reviewer_note: string | null;
        submitted_at: Date | string;
        reviewed_at: Date | string | null;
        university_email: string;
        full_name: string;
        username: string;
      }>(
        `SELECT vr.request_id, vr.user_id, vr.submitted_student_id, vr.proof_document_url,
                vr.status, vr.reviewed_by, vr.reviewer_note, vr.submitted_at, vr.reviewed_at,
                u.university_email, p.full_name, p.username
         FROM student_verification_requests vr
         INNER JOIN users u ON u.user_id = vr.user_id
         INNER JOIN profiles p ON p.user_id = vr.user_id
         ${whereSql}
         ORDER BY vr.submitted_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limit, offset]
      );

      const items = listRes.rows.map((r) => ({
        requestId: r.request_id,
        userId: r.user_id,
        student: {
          userId: r.user_id,
          universityEmail: r.university_email,
          fullName: r.full_name,
          username: r.username,
        },
        submittedStudentId: r.submitted_student_id,
        proofDocumentUrl: r.proof_document_url,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewerNote: r.reviewer_note,
        submittedAt: new Date(r.submitted_at).toISOString(),
        reviewedAt: r.reviewed_at
          ? new Date(r.reviewed_at).toISOString()
          : null,
      }));

      return sendPaginated(res, items, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/admin/verifications/:requestId
adminRouter.patch(
  '/verifications/:requestId',
  validate({ body: reviewVerificationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const { status, reviewerNote } = req.body;
      const adminId = req.user!.userId;

      const reqCheck = await db.query<{
        request_id: string;
        user_id: string;
        submitted_student_id: string;
        status: string;
      }>(
        `SELECT request_id, user_id, submitted_student_id, status
         FROM student_verification_requests
         WHERE request_id = $1`,
        [requestId]
      );

      if (reqCheck.rowCount === 0) {
        throw new NotFoundError('Verification request not found.');
      }

      const verReq = reqCheck.rows[0];
      if (verReq.status !== 'PENDING') {
        throw new ConflictError('Verification request has already been reviewed.');
      }

      const updated = await db.withTransaction(async (tx) => {
        const upd = await tx.query<{
          request_id: string;
          user_id: string;
          submitted_student_id: string;
          proof_document_url: string;
          status: string;
          reviewed_by: string | null;
          reviewer_note: string | null;
          submitted_at: Date | string;
          reviewed_at: Date | string;
        }>(
          `UPDATE student_verification_requests
           SET status = $2,
               reviewed_by = $3,
               reviewer_note = $4,
               reviewed_at = CURRENT_TIMESTAMP
           WHERE request_id = $1
           RETURNING request_id, user_id, submitted_student_id, proof_document_url,
                     status, reviewed_by, reviewer_note, submitted_at, reviewed_at`,
          [requestId, status, adminId, reviewerNote ?? null]
        );

        if (status === 'APPROVED') {
          await tx.query(
            `UPDATE users
             SET is_verified = TRUE,
                 email_verified = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [verReq.user_id]
          );
        }

        await tx.query(
          `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, action_details)
           VALUES ($1, $2, 'VERIFICATION_REQUEST', $3, $4)`,
          [
            adminId,
            `VERIFICATION_${status}`,
            requestId,
            JSON.stringify({
              userId: verReq.user_id,
              reviewerNote: reviewerNote ?? null,
            }),
          ]
        );

        await notificationsService.createNotification(
          {
            userId: verReq.user_id,
            type: 'VERIFICATION_UPDATE',
            title:
              status === 'APPROVED'
                ? 'Student Identity Verified!'
                : 'Verification Request Update',
            message:
              status === 'APPROVED'
                ? 'Your Almaarefa University student ID has been verified.'
                : `Your verification request was rejected.${reviewerNote ? ` Reason: ${reviewerNote}` : ''}`,
            referenceType: 'VERIFICATION',
            referenceId: requestId,
          },
          tx
        );

        return upd.rows[0];
      });

      return sendSuccess(res, {
        requestId: updated.request_id,
        userId: updated.user_id,
        submittedStudentId: updated.submitted_student_id,
        proofDocumentUrl: updated.proof_document_url,
        status: updated.status,
        reviewedBy: updated.reviewed_by,
        reviewerNote: updated.reviewer_note,
        submittedAt: new Date(updated.submitted_at).toISOString(),
        reviewedAt: new Date(updated.reviewed_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/club-requests
adminRouter.get(
  '/club-requests',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        20
      );
      const status = (req.query.status as string | undefined)
        ?.trim()
        .toUpperCase();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (status) {
        params.push(status);
        conditions.push(`cr.status = $${params.length}`);
      }

      const whereSql =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM club_creation_requests cr ${whereSql}`,
        params
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const listRes = await db.query<{
        request_id: string;
        requested_by: string;
        proposed_name: string;
        category: string;
        description: string | null;
        proposal_file_url: string | null;
        status: string;
        reviewed_by: string | null;
        review_note: string | null;
        submitted_at: Date | string;
        reviewed_at: Date | string | null;
        full_name: string;
        username: string;
        university_email: string;
      }>(
        `SELECT cr.request_id, cr.requested_by, cr.proposed_name, cr.category,
                cr.description, cr.proposal_file_url, cr.status, cr.reviewed_by,
                cr.review_note, cr.submitted_at, cr.reviewed_at,
                p.full_name, p.username, u.university_email
         FROM club_creation_requests cr
         INNER JOIN users u ON u.user_id = cr.requested_by
         INNER JOIN profiles p ON p.user_id = cr.requested_by
         ${whereSql}
         ORDER BY cr.submitted_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limit, offset]
      );

      const items = listRes.rows.map((r) => ({
        requestId: r.request_id,
        requestedBy: r.requested_by,
        requester: {
          userId: r.requested_by,
          fullName: r.full_name,
          username: r.username,
          universityEmail: r.university_email,
        },
        proposedName: r.proposed_name,
        category: r.category,
        description: r.description,
        proposalFileUrl: r.proposal_file_url,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewNote: r.review_note,
        submittedAt: new Date(r.submitted_at).toISOString(),
        reviewedAt: r.reviewed_at
          ? new Date(r.reviewed_at).toISOString()
          : null,
      }));

      return sendPaginated(res, items, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/admin/club-requests/:requestId
adminRouter.patch(
  '/club-requests/:requestId',
  validate({ body: reviewClubCreationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const { status, reviewNote } = req.body;
      const adminId = req.user!.userId;

      const reqCheck = await db.query<{
        request_id: string;
        requested_by: string;
        proposed_name: string;
        category: string;
        description: string | null;
        status: string;
      }>(
        `SELECT request_id, requested_by, proposed_name, category, description, status
         FROM club_creation_requests
         WHERE request_id = $1`,
        [requestId]
      );

      if (reqCheck.rowCount === 0) {
        throw new NotFoundError('Club creation request not found.');
      }

      const clubReq = reqCheck.rows[0];
      if (clubReq.status !== 'PENDING') {
        throw new ConflictError('Club creation request has already been reviewed.');
      }

      const result = await db.withTransaction(async (tx) => {
        const upd = await tx.query<{
          request_id: string;
          requested_by: string;
          proposed_name: string;
          category: string;
          description: string | null;
          proposal_file_url: string | null;
          status: string;
          reviewed_by: string | null;
          review_note: string | null;
          submitted_at: Date | string;
          reviewed_at: Date | string;
        }>(
          `UPDATE club_creation_requests
           SET status = $2,
               reviewed_by = $3,
               review_note = $4,
               reviewed_at = CURRENT_TIMESTAMP
           WHERE request_id = $1
           RETURNING request_id, requested_by, proposed_name, category, description,
                     proposal_file_url, status, reviewed_by, review_note, submitted_at, reviewed_at`,
          [requestId, status, adminId, reviewNote ?? null]
        );

        let createdClubId: string | null = null;

        if (status === 'APPROVED') {
          const clubInsert = await tx.query<{ club_id: string }>(
            `INSERT INTO clubs (created_by, creation_request_id, name, category, description, status)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
             RETURNING club_id`,
            [
              clubReq.requested_by,
              requestId,
              clubReq.proposed_name,
              clubReq.category,
              clubReq.description,
            ]
          );
          createdClubId = clubInsert.rows[0].club_id;

          await tx.query(
            `INSERT INTO club_members (club_id, user_id, member_role, status)
             VALUES ($1, $2, 'PRESIDENT', 'ACTIVE')`,
            [createdClubId, clubReq.requested_by]
          );

          await tx.query(
            `UPDATE users
             SET role = CASE WHEN role = 'STUDENT' THEN 'CLUB_LEADER' ELSE role END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [clubReq.requested_by]
          );
        }

        await tx.query(
          `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, action_details)
           VALUES ($1, $2, 'CLUB_CREATION_REQUEST', $3, $4)`,
          [
            adminId,
            `CLUB_REQUEST_${status}`,
            requestId,
            JSON.stringify({
              proposedName: clubReq.proposed_name,
              createdClubId,
              reviewNote: reviewNote ?? null,
            }),
          ]
        );

        await notificationsService.createNotification(
          {
            userId: clubReq.requested_by,
            type: 'CLUB_REQUEST_UPDATE',
            title:
              status === 'APPROVED'
                ? `Club Approved: ${clubReq.proposed_name}`
                : `Club Proposal Update: ${clubReq.proposed_name}`,
            message:
              status === 'APPROVED'
                ? `Congratulations! Your proposal for "${clubReq.proposed_name}" has been approved and the club is now active.`
                : `Your proposal for "${clubReq.proposed_name}" was not approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
            referenceType: 'CLUB',
            referenceId: createdClubId ?? requestId,
          },
          tx
        );

        return { row: upd.rows[0], createdClubId };
      });

      return sendSuccess(res, {
        requestId: result.row.request_id,
        requestedBy: result.row.requested_by,
        proposedName: result.row.proposed_name,
        category: result.row.category,
        description: result.row.description,
        proposalFileUrl: result.row.proposal_file_url,
        status: result.row.status,
        createdClubId: result.createdClubId,
        reviewedBy: result.row.reviewed_by,
        reviewNote: result.row.review_note,
        submittedAt: new Date(result.row.submitted_at).toISOString(),
        reviewedAt: new Date(result.row.reviewed_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/users
adminRouter.get(
  '/users',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        20
      );
      const role = (req.query.role as string | undefined)?.trim().toUpperCase();
      const search = (req.query.search as string | undefined)?.trim();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (role) {
        params.push(role);
        conditions.push(`u.role = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(u.university_email ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR p.student_id ILIKE $${params.length})`
        );
      }

      const whereSql =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.user_id
         ${whereSql}`,
        params
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const listRes = await db.query<{
        user_id: string;
        university_email: string;
        role: string;
        email_verified: boolean;
        is_verified: boolean;
        is_active: boolean;
        created_at: Date | string;
        full_name: string;
        username: string;
        student_id: string | null;
      }>(
        `SELECT u.user_id, u.university_email, u.role, u.email_verified,
                u.is_verified, u.is_active, u.created_at,
                p.full_name, p.username, p.student_id
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.user_id
         ${whereSql}
         ORDER BY u.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limit, offset]
      );

      const users = listRes.rows.map((u) => ({
        userId: u.user_id,
        universityEmail: u.university_email,
        role: u.role,
        emailVerified: u.email_verified,
        isVerified: u.is_verified,
        isActive: u.is_active,
        createdAt: new Date(u.created_at).toISOString(),
        profile: {
          fullName: u.full_name,
          username: u.username,
          studentId: u.student_id,
        },
      }));

      return sendPaginated(res, users, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/admin/users/:userId/status
adminRouter.patch(
  '/users/:userId/status',
  validate({ body: updateUserStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { isActive, reason } = req.body;
      const adminId = req.user!.userId;

      const updated = await db.query<{
        user_id: string;
        university_email: string;
        is_active: boolean;
      }>(
        `UPDATE users
         SET is_active = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING user_id, university_email, is_active`,
        [userId, isActive]
      );

      if (updated.rowCount === 0) {
        throw new NotFoundError('User not found.');
      }

      if (!isActive) {
        await db.query(
          `UPDATE refresh_tokens
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );
      }

      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, action_details)
         VALUES ($1, $2, 'USER', $3, $4)`,
        [
          adminId,
          isActive ? 'REACTIVATE_USER' : 'SUSPEND_USER',
          userId,
          JSON.stringify({ reason: reason ?? null }),
        ]
      );

      return sendSuccess(res, {
        userId: updated.rows[0].user_id,
        universityEmail: updated.rows[0].university_email,
        isActive: updated.rows[0].is_active,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/admin/users/:userId/role
adminRouter.patch(
  '/users/:userId/role',
  validate({ body: updateUserRoleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const adminId = req.user!.userId;

      const updated = await db.query<{
        user_id: string;
        university_email: string;
        role: string;
      }>(
        `UPDATE users
         SET role = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING user_id, university_email, role`,
        [userId, role]
      );

      if (updated.rowCount === 0) {
        throw new NotFoundError('User not found.');
      }

      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, action_details)
         VALUES ($1, 'CHANGE_USER_ROLE', 'USER', $2, $3)`,
        [adminId, userId, JSON.stringify({ newRole: role })]
      );

      return sendSuccess(res, {
        userId: updated.rows[0].user_id,
        universityEmail: updated.rows[0].university_email,
        role: updated.rows[0].role,
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/users/:userId
adminRouter.delete(
  '/users/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const adminId = req.user!.userId;

      const deleted = await db.query(
        'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
        [userId]
      );
      if (deleted.rowCount === 0) {
        throw new NotFoundError('User not found.');
      }

      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, action_details)
         VALUES ($1, 'DELETE_USER', 'USER', $2, $3)`,
        [adminId, userId, JSON.stringify({ deletedUserId: userId })]
      );

      return sendSuccess(
        res,
        { userId, deleted: true },
        200,
        'User account permanently removed.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/audit-logs
adminRouter.get(
  '/audit-logs',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        30
      );

      const countRes = await db.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM admin_audit_logs'
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const listRes = await db.query<{
        log_id: string;
        admin_id: string;
        admin_name: string | null;
        action_type: string;
        target_type: string;
        target_id: string | null;
        action_details: string | null;
        created_at: Date | string;
      }>(
        `SELECT l.log_id, l.admin_id, p.full_name AS admin_name,
                l.action_type, l.target_type, l.target_id, l.action_details, l.created_at
         FROM admin_audit_logs l
         LEFT JOIN profiles p ON p.user_id = l.admin_id
         ORDER BY l.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const logs = listRes.rows.map((l) => ({
        logId: l.log_id,
        adminId: l.admin_id,
        adminName: l.admin_name,
        actionType: l.action_type,
        targetType: l.target_type,
        targetId: l.target_id,
        actionDetails: l.action_details,
        createdAt: new Date(l.created_at).toISOString(),
      }));

      return sendPaginated(res, logs, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/stats
adminRouter.get(
  '/stats',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const statsRes = await db.query<{
        total_users: string;
        verified_users: string;
        pending_verifications: string;
        pending_club_requests: string;
        pending_reports: string;
        active_clubs: string;
        total_posts: string;
        upcoming_events: string;
      }>(`
        SELECT
          (SELECT COUNT(*)::text FROM users) AS total_users,
          (SELECT COUNT(*)::text FROM users WHERE is_verified = TRUE) AS verified_users,
          (SELECT COUNT(*)::text FROM student_verification_requests WHERE status = 'PENDING') AS pending_verifications,
          (SELECT COUNT(*)::text FROM club_creation_requests WHERE status = 'PENDING') AS pending_club_requests,
          (SELECT COUNT(*)::text FROM post_reports WHERE status = 'PENDING') AS pending_reports,
          (SELECT COUNT(*)::text FROM clubs WHERE status = 'ACTIVE') AS active_clubs,
          (SELECT COUNT(*)::text FROM posts WHERE is_deleted = FALSE) AS total_posts,
          (SELECT COUNT(*)::text FROM campus_events WHERE start_time >= CURRENT_TIMESTAMP) AS upcoming_events
      `);

      const s = statsRes.rows[0];
      return sendSuccess(res, {
        totalUsers: Number(s.total_users ?? 0),
        verifiedUsers: Number(s.verified_users ?? 0),
        pendingVerifications: Number(s.pending_verifications ?? 0),
        pendingClubRequests: Number(s.pending_club_requests ?? 0),
        pendingReports: Number(s.pending_reports ?? 0),
        activeClubs: Number(s.active_clubs ?? 0),
        totalPosts: Number(s.total_posts ?? 0),
        upcomingEvents: Number(s.upcoming_events ?? 0),
      });
    } catch (err) {
      next(err);
    }
  }
);

