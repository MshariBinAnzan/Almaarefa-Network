import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { canManageClub } from '../clubs/clubs.routes.js';
import { notificationsService } from '../notifications/notifications.service.js';

const router = Router();

const createEventSchema = z
  .object({
    clubId: z.string().uuid('Club ID must be a valid UUID'),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(5).max(3000),
    location: z.string().trim().min(2).max(255),
    startTime: z.string().datetime({ message: 'startTime must be a valid ISO date' }),
    endTime: z.string().datetime({ message: 'endTime must be a valid ISO date' }),
  })
  .refine(
    (data) => new Date(data.endTime).getTime() > new Date(data.startTime).getTime(),
    {
      message: 'endTime must be after startTime',
      path: ['endTime'],
    }
  );

const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(3000).optional(),
  location: z.string().trim().min(2).max(255).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

function formatEventRow(row: {
  event_id: string;
  club_id: string;
  club_name: string;
  club_logo_url: string | null;
  title: string;
  description: string;
  location: string;
  start_time: Date | string;
  end_time: Date | string;
  rsvp_count: string | number;
  has_rsvp: boolean;
  created_at?: Date | string;
}) {
  return {
    eventId: row.event_id,
    clubId: row.club_id,
    clubName: row.club_name,
    clubLogoUrl: row.club_logo_url,
    title: row.title,
    description: row.description,
    club: {
      clubId: row.club_id,
      name: row.club_name,
      logoUrl: row.club_logo_url,
    },
    location: row.location,
    startTime: new Date(row.start_time).toISOString(),
    endTime: new Date(row.end_time).toISOString(),
    rsvpCount: Number(row.rsvp_count ?? 0),
    hasRsvp: Boolean(row.has_rsvp),
    ...(row.created_at
      ? { createdAt: new Date(row.created_at).toISOString() }
      : {}),
  };
}

// GET /api/v1/events
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const clubId = (req.query.clubId || req.query.club_id) as
        | string
        | undefined;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          throw new ValidationError('Invalid "from" ISO date parameter.', [
            { field: 'from', issue: 'Must be a valid ISO date string' },
          ]);
        }
        params.push(fromDate.toISOString());
        conditions.push(`e.start_time >= $${params.length}`);
      }

      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          throw new ValidationError('Invalid "to" ISO date parameter.', [
            { field: 'to', issue: 'Must be a valid ISO date string' },
          ]);
        }
        params.push(toDate.toISOString());
        conditions.push(`e.start_time <= $${params.length}`);
      }

      if (clubId) {
        params.push(clubId);
        conditions.push(`e.club_id = $${params.length}`);
      }

      const whereSql =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const userIdParamIdx = params.length + 1;

      const listRes = await db.query<{
        event_id: string;
        club_id: string;
        club_name: string;
        club_logo_url: string | null;
        title: string;
        description: string;
        location: string;
        start_time: Date | string;
        end_time: Date | string;
        created_at: Date | string;
        rsvp_count: string;
        has_rsvp: boolean;
      }>(
        `SELECT e.event_id, e.club_id,
                c.name AS club_name, c.logo_url AS club_logo_url,
                e.title, e.description, e.location, e.start_time, e.end_time, e.created_at,
                (SELECT COUNT(*)::text FROM event_rsvps r WHERE r.event_id = e.event_id) AS rsvp_count,
                EXISTS (
                  SELECT 1 FROM event_rsvps r2
                  WHERE r2.event_id = e.event_id AND r2.user_id = $${userIdParamIdx}
                ) AS has_rsvp
         FROM campus_events e
         INNER JOIN clubs c ON c.club_id = e.club_id
         ${whereSql}
         ORDER BY e.start_time ASC`,
        [...params, userId]
      );

      const events = listRes.rows.map(formatEventRow);
      return sendSuccess(res, events);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/events/:eventId
router.get(
  '/:eventId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.userId;

      const resEvent = await db.query<{
        event_id: string;
        club_id: string;
        club_name: string;
        club_logo_url: string | null;
        title: string;
        description: string;
        location: string;
        start_time: Date | string;
        end_time: Date | string;
        created_at: Date | string;
        rsvp_count: string;
        has_rsvp: boolean;
      }>(
        `SELECT e.event_id, e.club_id,
                c.name AS club_name, c.logo_url AS club_logo_url,
                e.title, e.description, e.location, e.start_time, e.end_time, e.created_at,
                (SELECT COUNT(*)::text FROM event_rsvps r WHERE r.event_id = e.event_id) AS rsvp_count,
                EXISTS (
                  SELECT 1 FROM event_rsvps r2
                  WHERE r2.event_id = e.event_id AND r2.user_id = $2
                ) AS has_rsvp
         FROM campus_events e
         INNER JOIN clubs c ON c.club_id = e.club_id
         WHERE e.event_id = $1`,
        [eventId, userId]
      );

      if (resEvent.rowCount === 0) {
        throw new NotFoundError('Campus event not found.');
      }

      return sendSuccess(res, formatEventRow(resEvent.rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/events
router.post(
  '/',
  authenticate,
  validate({ body: createEventSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { clubId, title, description, location, startTime, endTime } =
        req.body;

      const clubRes = await db.query<{
        club_id: string;
        name: string;
        logo_url: string | null;
      }>('SELECT club_id, name, logo_url FROM clubs WHERE club_id = $1', [
        clubId,
      ]);
      if (clubRes.rowCount === 0) {
        throw new NotFoundError('Club not found.');
      }

      const allowed = await canManageClub(clubId, userId, req.user!.role);
      if (!allowed) {
        throw new ForbiddenError(
          'Only club leaders or administrators can publish events for this club.'
        );
      }

      const inserted = await db.query<{
        event_id: string;
        club_id: string;
        title: string;
        description: string;
        location: string;
        start_time: Date | string;
        end_time: Date | string;
        created_at: Date | string;
      }>(
        `INSERT INTO campus_events (club_id, created_by, title, description, location, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING event_id, club_id, title, description, location, start_time, end_time, created_at`,
        [clubId, userId, title, description, location, startTime, endTime]
      );

      const ev = inserted.rows[0];
      const club = clubRes.rows[0];

      // Notify active club members
      const membersRes = await db.query<{ user_id: string }>(
        `SELECT user_id FROM club_members
         WHERE club_id = $1 AND status = 'ACTIVE' AND user_id != $2`,
        [clubId, userId]
      );

      for (const m of membersRes.rows) {
        await notificationsService.createNotification({
          userId: m.user_id,
          type: 'CLUB_EVENT',
          title: `New Event: ${title}`,
          message: `${club.name} scheduled "${title}" at ${location}.`,
          referenceType: 'EVENT',
          referenceId: ev.event_id,
        });
      }

      return sendCreated(
        res,
        formatEventRow({
          ...ev,
          club_name: club.name,
          club_logo_url: club.logo_url,
          rsvp_count: 0,
          has_rsvp: false,
        })
      );
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/events/:eventId
router.patch(
  '/:eventId',
  authenticate,
  validate({ body: updateEventSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.userId;

      const existing = await db.query<{
        event_id: string;
        club_id: string;
        title: string;
        description: string;
        location: string;
        start_time: Date | string;
        end_time: Date | string;
      }>(
        `SELECT event_id, club_id, title, description, location, start_time, end_time
         FROM campus_events
         WHERE event_id = $1`,
        [eventId]
      );

      if (existing.rowCount === 0) {
        throw new NotFoundError('Campus event not found.');
      }

      const curr = existing.rows[0];
      const allowed = await canManageClub(
        curr.club_id,
        userId,
        req.user!.role
      );
      if (!allowed) {
        throw new ForbiddenError(
          'Only club leaders or administrators can update this event.'
        );
      }

      const newStart = req.body.startTime ?? new Date(curr.start_time).toISOString();
      const newEnd = req.body.endTime ?? new Date(curr.end_time).toISOString();

      if (new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
        throw new ValidationError('endTime must be after startTime.', [
          { field: 'endTime', issue: 'endTime must be after startTime' },
        ]);
      }

      await db.query(
        `UPDATE campus_events
         SET title = $2,
             description = $3,
             location = $4,
             start_time = $5,
             end_time = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE event_id = $1`,
        [
          eventId,
          req.body.title ?? curr.title,
          req.body.description ?? curr.description,
          req.body.location ?? curr.location,
          newStart,
          newEnd,
        ]
      );

      const updated = await db.query<{
        event_id: string;
        club_id: string;
        club_name: string;
        club_logo_url: string | null;
        title: string;
        description: string;
        location: string;
        start_time: Date | string;
        end_time: Date | string;
        created_at: Date | string;
        rsvp_count: string;
        has_rsvp: boolean;
      }>(
        `SELECT e.event_id, e.club_id,
                c.name AS club_name, c.logo_url AS club_logo_url,
                e.title, e.description, e.location, e.start_time, e.end_time, e.created_at,
                (SELECT COUNT(*)::text FROM event_rsvps r WHERE r.event_id = e.event_id) AS rsvp_count,
                EXISTS (
                  SELECT 1 FROM event_rsvps r2
                  WHERE r2.event_id = e.event_id AND r2.user_id = $2
                ) AS has_rsvp
         FROM campus_events e
         INNER JOIN clubs c ON c.club_id = e.club_id
         WHERE e.event_id = $1`,
        [eventId, userId]
      );

      return sendSuccess(res, formatEventRow(updated.rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/events/:eventId
router.delete(
  '/:eventId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const existing = await db.query<{ event_id: string; club_id: string }>(
        'SELECT event_id, club_id FROM campus_events WHERE event_id = $1',
        [eventId]
      );
      if (existing.rowCount === 0) {
        throw new NotFoundError('Campus event not found.');
      }

      const allowed = await canManageClub(
        existing.rows[0].club_id,
        req.user!.userId,
        req.user!.role
      );
      if (!allowed) {
        throw new ForbiddenError(
          'Only club leaders or administrators can delete this event.'
        );
      }

      await db.query('DELETE FROM campus_events WHERE event_id = $1', [
        eventId,
      ]);
      return sendSuccess(
        res,
        { eventId, deleted: true },
        200,
        'Event deleted successfully.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/events/:eventId/rsvp
router.post(
  '/:eventId/rsvp',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.userId;

      const eventCheck = await db.query(
        'SELECT event_id FROM campus_events WHERE event_id = $1',
        [eventId]
      );
      if (eventCheck.rowCount === 0) {
        throw new NotFoundError('Campus event not found.');
      }

      await db.query(
        `INSERT INTO event_rsvps (event_id, user_id, status)
         VALUES ($1, $2, 'GOING')
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [eventId, userId]
      );

      const countRes = await db.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM event_rsvps WHERE event_id = $1',
        [eventId]
      );

      return sendSuccess(
        res,
        {
          eventId,
          hasRsvp: true,
          rsvpCount: Number(countRes.rows[0]?.count ?? 0),
        },
        200,
        'RSVP confirmed.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/events/:eventId/rsvp
router.delete(
  '/:eventId/rsvp',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.userId;

      await db.query(
        'DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );

      const countRes = await db.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM event_rsvps WHERE event_id = $1',
        [eventId]
      );

      return sendSuccess(
        res,
        {
          eventId,
          hasRsvp: false,
          rsvpCount: Number(countRes.rows[0]?.count ?? 0),
        },
        200,
        'RSVP cancelled.'
      );
    } catch (err) {
      next(err);
    }
  }
);

export default router;

