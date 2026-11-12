import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';
import {
  parsePaginationParams,
  sendCreated,
  sendPaginated,
  sendSuccess,
} from '../../utils/response.js';
import { ClubStatus } from '../../../../shared/types/index.js';
import { notificationsService } from '../notifications/notifications.service.js';

const router = Router();

const clubCreationRequestSchema = z.object({
  proposedName: z
    .string({ required_error: 'Proposed club name is required' })
    .trim()
    .min(3, 'Proposed club name must be at least 3 characters')
    .max(150),
  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(2)
    .max(100),
  description: z.string().trim().min(10).max(2000),
  proposalFileUrl: z
    .string()
    .url('Proposal file URL must be a valid URL')
    .max(500)
    .optional()
    .nullable(),
});

const updateClubSchema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  logoUrl: z.string().url().max(500).optional().nullable(),
});

const reviewJoinRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().max(1000).optional().nullable(),
});

const clubFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().nullable(),
  isAnonymous: z.boolean().default(false),
});

export async function canManageClub(
  clubId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === 'ADMIN') return true;

  const clubRes = await db.query<{ created_by: string }>(
    'SELECT created_by FROM clubs WHERE club_id = $1',
    [clubId]
  );
  if (clubRes.rowCount > 0 && clubRes.rows[0].created_by === userId) {
    return true;
  }

  const memberRes = await db.query<{ member_role: string }>(
    `SELECT member_role FROM club_members
     WHERE club_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
    [clubId, userId]
  );
  if (
    memberRes.rowCount > 0 &&
    ['PRESIDENT', 'LEADER', 'OFFICER', 'ADMIN'].includes(
      memberRes.rows[0].member_role.toUpperCase()
    )
  ) {
    return true;
  }

  return false;
}

// GET /api/v1/clubs
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        20
      );
      const category = (req.query.category as string | undefined)?.trim();
      const search = (req.query.search as string | undefined)?.trim();
      const status = (
        (req.query.status as string | undefined)?.trim() || 'ACTIVE'
      ).toUpperCase();

      const conditions: string[] = ['c.status = $1'];
      const params: unknown[] = [status];

      if (category) {
        params.push(category);
        conditions.push(`LOWER(c.category) = LOWER($${params.length})`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`
        );
      }

      const whereSql = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM clubs c ${whereSql}`,
        params
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const userIdParamIdx = params.length + 1;
      const limitParamIdx = params.length + 2;
      const offsetParamIdx = params.length + 3;

      const listRes = await db.query<{
        club_id: string;
        created_by: string;
        name: string;
        category: string;
        description: string | null;
        logo_url: string | null;
        status: ClubStatus;
        created_at: Date | string;
        updated_at: Date | string;
        members_count: string;
        is_member: boolean;
        has_pending_request: boolean;
      }>(
        `SELECT c.club_id, c.created_by, c.name, c.category, c.description, c.logo_url,
                c.status, c.created_at, c.updated_at,
                (SELECT COUNT(*)::text FROM club_members m WHERE m.club_id = c.club_id AND m.status = 'ACTIVE') AS members_count,
                EXISTS (
                  SELECT 1 FROM club_members m2
                  WHERE m2.club_id = c.club_id AND m2.user_id = $${userIdParamIdx} AND m2.status = 'ACTIVE'
                ) AS is_member,
                EXISTS (
                  SELECT 1 FROM club_join_requests jr
                  WHERE jr.club_id = c.club_id AND jr.user_id = $${userIdParamIdx} AND jr.status = 'PENDING'
                ) AS has_pending_request
         FROM clubs c
         ${whereSql}
         ORDER BY c.name ASC
         LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
        [...params, userId, limit, offset]
      );

      const clubs = listRes.rows.map((c) => ({
        clubId: c.club_id,
        name: c.name,
        category: c.category,
        description: c.description,
        logoUrl: c.logo_url,
        status: c.status,
        membersCount: Number(c.members_count ?? 0),
        isMember: Boolean(c.is_member),
        membershipStatus: c.is_member
          ? 'ACTIVE'
          : c.has_pending_request
            ? 'PENDING'
            : 'NONE',
        createdBy: c.created_by,
        createdAt: new Date(c.created_at).toISOString(),
        updatedAt: new Date(c.updated_at).toISOString(),
      }));

      return sendPaginated(res, clubs, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/clubs/request
router.post(
  '/request',
  authenticate,
  validate({ body: clubCreationRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { proposedName, category, description, proposalFileUrl } = req.body;

      // Check if club name already exists
      const existingClub = await db.query(
        'SELECT club_id FROM clubs WHERE LOWER(name) = LOWER($1)',
        [proposedName]
      );
      if (existingClub.rowCount > 0) {
        throw new ConflictError('A club with this name already exists.', [
          { field: 'proposedName', issue: 'Club name is already taken' },
        ]);
      }

      const existingReq = await db.query(
        `SELECT request_id FROM club_creation_requests
         WHERE LOWER(proposed_name) = LOWER($1) AND status = 'PENDING'`,
        [proposedName]
      );
      if (existingReq.rowCount > 0) {
        throw new ConflictError(
          'A pending proposal for a club with this name already exists.'
        );
      }

      const inserted = await db.query<{
        request_id: string;
        requested_by: string;
        proposed_name: string;
        category: string;
        description: string | null;
        proposal_file_url: string | null;
        status: string;
        submitted_at: Date | string;
      }>(
        `INSERT INTO club_creation_requests (requested_by, proposed_name, category, description, proposal_file_url, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING request_id, requested_by, proposed_name, category, description, proposal_file_url, status, submitted_at`,
        [userId, proposedName, category, description, proposalFileUrl ?? null]
      );

      const r = inserted.rows[0];
      return sendCreated(res, {
        requestId: r.request_id,
        requestedBy: r.requested_by,
        proposedName: r.proposed_name,
        category: r.category,
        description: r.description,
        proposalFileUrl: r.proposal_file_url,
        status: r.status,
        submittedAt: new Date(r.submitted_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/clubs/requests/me
router.get(
  '/requests/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query<{
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
      }>(
        `SELECT request_id, requested_by, proposed_name, category, description,
                proposal_file_url, status, reviewed_by, review_note, submitted_at, reviewed_at
         FROM club_creation_requests
         WHERE requested_by = $1
         ORDER BY submitted_at DESC`,
        [req.user!.userId]
      );

      const items = result.rows.map((r) => ({
        requestId: r.request_id,
        requestedBy: r.requested_by,
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

      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/clubs/:clubId
router.get(
  '/:clubId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId } = req.params;
      const userId = req.user!.userId;

      const clubRes = await db.query<{
        club_id: string;
        created_by: string;
        name: string;
        category: string;
        description: string | null;
        logo_url: string | null;
        status: ClubStatus;
        created_at: Date | string;
        updated_at: Date | string;
        members_count: string;
        is_member: boolean;
        has_pending_request: boolean;
      }>(
        `SELECT c.club_id, c.created_by, c.name, c.category, c.description, c.logo_url,
                c.status, c.created_at, c.updated_at,
                (SELECT COUNT(*)::text FROM club_members m WHERE m.club_id = c.club_id AND m.status = 'ACTIVE') AS members_count,
                EXISTS (
                  SELECT 1 FROM club_members m2
                  WHERE m2.club_id = c.club_id AND m2.user_id = $2 AND m2.status = 'ACTIVE'
                ) AS is_member,
                EXISTS (
                  SELECT 1 FROM club_join_requests jr
                  WHERE jr.club_id = c.club_id AND jr.user_id = $2 AND jr.status = 'PENDING'
                ) AS has_pending_request
         FROM clubs c
         WHERE c.club_id = $1`,
        [clubId, userId]
      );

      if (clubRes.rowCount === 0) {
        throw new NotFoundError('Club not found.');
      }

      const c = clubRes.rows[0];
      return sendSuccess(res, {
        clubId: c.club_id,
        name: c.name,
        category: c.category,
        description: c.description,
        logoUrl: c.logo_url,
        status: c.status,
        membersCount: Number(c.members_count ?? 0),
        isMember: Boolean(c.is_member),
        membershipStatus: c.is_member
          ? 'ACTIVE'
          : c.has_pending_request
            ? 'PENDING'
            : 'NONE',
        createdBy: c.created_by,
        createdAt: new Date(c.created_at).toISOString(),
        updatedAt: new Date(c.updated_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/clubs/:clubId
router.patch(
  '/:clubId',
  authenticate,
  validate({ body: updateClubSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId } = req.params;
      const userId = req.user!.userId;

      const existing = await db.query<{
        club_id: string;
        name: string;
        category: string;
        description: string | null;
        logo_url: string | null;
      }>(
        'SELECT club_id, name, category, description, logo_url FROM clubs WHERE club_id = $1',
        [clubId]
      );

      if (existing.rowCount === 0) {
        throw new NotFoundError('Club not found.');
      }

      const allowed = await canManageClub(clubId, userId, req.user!.role);
      if (!allowed) {
        throw new ForbiddenError(
          'Only the club leader or an administrator can update this club.'
        );
      }

      const curr = existing.rows[0];
      const { name, category, description, logoUrl } = req.body;

      const updated = await db.query<{
        club_id: string;
        name: string;
        category: string;
        description: string | null;
        logo_url: string | null;
        status: ClubStatus;
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `UPDATE clubs
         SET name = $2,
             category = $3,
             description = $4,
             logo_url = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE club_id = $1
         RETURNING club_id, name, category, description, logo_url, status, created_at, updated_at`,
        [
          clubId,
          name !== undefined ? name : curr.name,
          category !== undefined ? category : curr.category,
          description !== undefined ? description : curr.description,
          logoUrl !== undefined ? logoUrl : curr.logo_url,
        ]
      );

      const u = updated.rows[0];
      return sendSuccess(res, {
        clubId: u.club_id,
        name: u.name,
        category: u.category,
        description: u.description,
        logoUrl: u.logo_url,
        status: u.status,
        createdAt: new Date(u.created_at).toISOString(),
        updatedAt: new Date(u.updated_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/clubs/:clubId/join
router.post(
  '/:clubId/join',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId } = req.params;
      const userId = req.user!.userId;

      const clubRes = await db.query<{ club_id: string; status: ClubStatus }>(
        'SELECT club_id, status FROM clubs WHERE club_id = $1',
        [clubId]
      );

      if (clubRes.rowCount === 0) {
        throw new NotFoundError('Club not found.');
      }

      if (clubRes.rows[0].status !== 'ACTIVE') {
        throw new ConflictError('Cannot join a suspended club.');
      }

      const alreadyMember = await db.query(
        `SELECT membership_id FROM club_members
         WHERE club_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
        [clubId, userId]
      );
      if (alreadyMember.rowCount > 0) {
        throw new ConflictError('You are already an active member of this club.');
      }

      const existingPending = await db.query<{
        request_id: string;
        club_id: string;
        user_id: string;
        status: string;
        submitted_at: Date | string;
      }>(
        `SELECT request_id, club_id, user_id, status, submitted_at
         FROM club_join_requests
         WHERE club_id = $1 AND user_id = $2 AND status = 'PENDING'`,
        [clubId, userId]
      );

      if (existingPending.rowCount > 0) {
        const p = existingPending.rows[0];
        return sendCreated(
          res,
          {
            requestId: p.request_id,
            clubId: p.club_id,
            userId: p.user_id,
            status: p.status,
            submittedAt: new Date(p.submitted_at).toISOString(),
          },
          'Join request is already pending approval.'
        );
      }

      const inserted = await db.query<{
        request_id: string;
        club_id: string;
        user_id: string;
        status: string;
        submitted_at: Date | string;
      }>(
        `INSERT INTO club_join_requests (club_id, user_id, status)
         VALUES ($1, $2, 'PENDING')
         RETURNING request_id, club_id, user_id, status, submitted_at`,
        [clubId, userId]
      );

      const jr = inserted.rows[0];
      return sendCreated(
        res,
        {
          requestId: jr.request_id,
          clubId: jr.club_id,
          userId: jr.user_id,
          status: jr.status,
          submittedAt: new Date(jr.submitted_at).toISOString(),
        },
        'Club join request submitted successfully.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// Leave club / cancel join request
const leaveClubHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { clubId } = req.params;
    const userId = req.user!.userId;

    const deletedMember = await db.query(
      'DELETE FROM club_members WHERE club_id = $1 AND user_id = $2 RETURNING membership_id',
      [clubId, userId]
    );
    const deletedReq = await db.query(
      `DELETE FROM club_join_requests WHERE club_id = $1 AND user_id = $2 AND status = 'PENDING' RETURNING request_id`,
      [clubId, userId]
    );

    if (deletedMember.rowCount === 0 && deletedReq.rowCount === 0) {
      throw new NotFoundError('You are not a member of this club.');
    }

    return sendSuccess(
      res,
      { clubId, left: true },
      200,
      'Successfully left club.'
    );
  } catch (err) {
    next(err);
  }
};

router.delete('/:clubId/leave', authenticate, leaveClubHandler);
router.post('/:clubId/leave', authenticate, leaveClubHandler);

// GET /api/v1/clubs/:clubId/members
router.get(
  '/:clubId/members',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId } = req.params;
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        30
      );

      const clubCheck = await db.query(
        'SELECT club_id FROM clubs WHERE club_id = $1',
        [clubId]
      );
      if (clubCheck.rowCount === 0) {
        throw new NotFoundError('Club not found.');
      }

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM club_members WHERE club_id = $1 AND status = 'ACTIVE'`,
        [clubId]
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const listRes = await db.query<{
        membership_id: string;
        club_id: string;
        user_id: string;
        member_role: string;
        status: string;
        joined_at: Date | string;
        full_name: string;
        username: string;
        avatar_url: string | null;
        is_verified: boolean;
      }>(
        `SELECT m.membership_id, m.club_id, m.user_id, m.member_role, m.status, m.joined_at,
                p.full_name, p.username, p.avatar_url,
                u.is_verified
         FROM club_members m
         INNER JOIN users u ON u.user_id = m.user_id
         INNER JOIN profiles p ON p.user_id = m.user_id
         WHERE m.club_id = $1 AND m.status = 'ACTIVE'
         ORDER BY m.joined_at ASC
         LIMIT $2 OFFSET $3`,
        [clubId, limit, offset]
      );

      const members = listRes.rows.map((m) => ({
        membershipId: m.membership_id,
        clubId: m.club_id,
        userId: m.user_id,
        fullName: m.full_name,
        username: m.username,
        avatarUrl: m.avatar_url,
        isVerified: m.is_verified,
        memberRole: m.member_role,
        status: m.status,
        joinedAt: new Date(m.joined_at).toISOString(),
      }));

      return sendPaginated(res, members, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/clubs/:clubId/join-requests (Club Leader / Admin)
router.get(
  '/:clubId/join-requests',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId } = req.params;
      const allowed = await canManageClub(
        clubId,
        req.user!.userId,
        req.user!.role
      );
      if (!allowed) {
        throw new ForbiddenError(
          'Only club leaders or administrators can view club join requests.'
        );
      }

      const status = (req.query.status as string | undefined)?.toUpperCase();
      const params: unknown[] = [clubId];
      let statusFilter = '';
      if (status) {
        params.push(status);
        statusFilter = `AND jr.status = $2`;
      }

      const listRes = await db.query<{
        request_id: string;
        club_id: string;
        user_id: string;
        status: string;
        reviewed_by: string | null;
        review_note: string | null;
        submitted_at: Date | string;
        reviewed_at: Date | string | null;
        full_name: string;
        username: string;
        student_id: string | null;
        avatar_url: string | null;
      }>(
        `SELECT jr.request_id, jr.club_id, jr.user_id, jr.status,
                jr.reviewed_by, jr.review_note, jr.submitted_at, jr.reviewed_at,
                p.full_name, p.username, p.student_id, p.avatar_url
         FROM club_join_requests jr
         INNER JOIN profiles p ON p.user_id = jr.user_id
         WHERE jr.club_id = $1 ${statusFilter}
         ORDER BY jr.submitted_at DESC`,
        params
      );

      const items = listRes.rows.map((r) => ({
        requestId: r.request_id,
        clubId: r.club_id,
        userId: r.user_id,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewNote: r.review_note,
        submittedAt: new Date(r.submitted_at).toISOString(),
        reviewedAt: r.reviewed_at
          ? new Date(r.reviewed_at).toISOString()
          : null,
        student: {
          userId: r.user_id,
          fullName: r.full_name,
          username: r.username,
          studentId: r.student_id,
          avatarUrl: r.avatar_url,
        },
      }));

      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/clubs/:clubId/join-requests/:requestId (Approve / Reject)
router.patch(
  '/:clubId/join-requests/:requestId',
  authenticate,
  validate({ body: reviewJoinRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId, requestId } = req.params;
      const { status, reviewNote } = req.body;

      const allowed = await canManageClub(
        clubId,
        req.user!.userId,
        req.user!.role
      );
      if (!allowed) {
        throw new ForbiddenError(
          'Only club leaders or administrators can review join requests.'
        );
      }

      const reqCheck = await db.query<{
        request_id: string;
        club_id: string;
        user_id: string;
        status: string;
      }>(
        `SELECT request_id, club_id, user_id, status
         FROM club_join_requests
         WHERE request_id = $1 AND club_id = $2`,
        [requestId, clubId]
      );

      if (reqCheck.rowCount === 0) {
        throw new NotFoundError('Join request not found.');
      }

      const joinReq = reqCheck.rows[0];
      if (joinReq.status !== 'PENDING') {
        throw new ConflictError('Join request has already been reviewed.');
      }

      const updated = await db.withTransaction(async (tx) => {
        const resUpdate = await tx.query<{
          request_id: string;
          club_id: string;
          user_id: string;
          status: string;
          reviewed_by: string | null;
          review_note: string | null;
          submitted_at: Date | string;
          reviewed_at: Date | string;
        }>(
          `UPDATE club_join_requests
           SET status = $2,
               reviewed_by = $3,
               review_note = $4,
               reviewed_at = CURRENT_TIMESTAMP
           WHERE request_id = $1
           RETURNING request_id, club_id, user_id, status, reviewed_by, review_note, submitted_at, reviewed_at`,
          [requestId, status, req.user!.userId, reviewNote ?? null]
        );

        if (status === 'APPROVED') {
          await tx.query(
            `INSERT INTO club_members (club_id, user_id, member_role, status)
             VALUES ($1, $2, 'MEMBER', 'ACTIVE')
             ON CONFLICT (club_id, user_id)
             DO UPDATE SET status = 'ACTIVE'`,
            [clubId, joinReq.user_id]
          );
        }

        const clubRes = await tx.query<{ name: string }>(
          'SELECT name FROM clubs WHERE club_id = $1',
          [clubId]
        );
        const clubName = clubRes.rows[0]?.name || 'Student Club';

        await notificationsService.createNotification(
          {
            userId: joinReq.user_id,
            type: 'CLUB_REQUEST_UPDATE',
            title:
              status === 'APPROVED'
                ? `Welcome to ${clubName}!`
                : `Club Join Request Update (${clubName})`,
            message:
              status === 'APPROVED'
                ? `Your request to join ${clubName} has been approved.`
                : `Your request to join ${clubName} was not approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
            referenceType: 'CLUB',
            referenceId: clubId,
          },
          tx
        );

        return resUpdate.rows[0];
      });

      return sendSuccess(res, {
        requestId: updated.request_id,
        clubId: updated.club_id,
        userId: updated.user_id,
        status: updated.status,
        reviewedBy: updated.reviewed_by,
        reviewNote: updated.review_note,
        submittedAt: new Date(updated.submitted_at).toISOString(),
        reviewedAt: new Date(updated.reviewed_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/clubs/:clubId/feedback
router.post(
  '/:clubId/feedback',
  authenticate,
  validate({ body: clubFeedbackSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId } = req.params;
      const { rating, comment, isAnonymous } = req.body;

      const clubCheck = await db.query(
        'SELECT club_id FROM clubs WHERE club_id = $1',
        [clubId]
      );
      if (clubCheck.rowCount === 0) {
        throw new NotFoundError('Club not found.');
      }

      const inserted = await db.query<{
        feedback_id: string;
        club_id: string;
        user_id: string;
        rating: number;
        comment: string | null;
        is_anonymous: boolean;
        created_at: Date | string;
      }>(
        `INSERT INTO club_feedback (club_id, user_id, rating, comment, is_anonymous)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING feedback_id, club_id, user_id, rating, comment, is_anonymous, created_at`,
        [clubId, req.user!.userId, rating, comment ?? null, isAnonymous]
      );

      const f = inserted.rows[0];
      return sendCreated(res, {
        feedbackId: f.feedback_id,
        clubId: f.club_id,
        rating: f.rating,
        comment: f.comment,
        isAnonymous: f.is_anonymous,
        createdAt: new Date(f.created_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/clubs/:clubId/feedback
router.get(
  '/:clubId/feedback',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clubId } = req.params;
      const allowed = await canManageClub(
        clubId,
        req.user!.userId,
        req.user!.role
      );
      if (!allowed) {
        throw new ForbiddenError(
          'Only club leaders or administrators can view club feedback.'
        );
      }

      const listRes = await db.query<{
        feedback_id: string;
        club_id: string;
        user_id: string;
        rating: number;
        comment: string | null;
        is_anonymous: boolean;
        created_at: Date | string;
        full_name: string;
        username: string;
      }>(
        `SELECT cf.feedback_id, cf.club_id, cf.user_id, cf.rating, cf.comment,
                cf.is_anonymous, cf.created_at,
                p.full_name, p.username
         FROM club_feedback cf
         INNER JOIN profiles p ON p.user_id = cf.user_id
         WHERE cf.club_id = $1
         ORDER BY cf.created_at DESC`,
        [clubId]
      );

      const items = listRes.rows.map((f) => ({
        feedbackId: f.feedback_id,
        clubId: f.club_id,
        rating: f.rating,
        comment: f.comment,
        isAnonymous: f.is_anonymous,
        author: f.is_anonymous
          ? null
          : {
              userId: f.user_id,
              fullName: f.full_name,
              username: f.username,
            },
        createdAt: new Date(f.created_at).toISOString(),
      }));

      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

