import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import {
  parsePaginationParams,
  sendPaginated,
  sendSuccess,
} from '../../utils/response.js';
import { notificationsService } from './notifications.service.js';

const router = Router();

const updatePrefsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  threadReplies: z.boolean().optional(),
  clubEvents: z.boolean().optional(),
  campusAnnouncements: z.boolean().optional(),
});

// GET /api/v1/notifications
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
      const unreadOnly =
        String(req.query.unreadOnly || '').toLowerCase() === 'true';

      const whereClause = unreadOnly
        ? 'WHERE user_id = $1 AND is_read = FALSE'
        : 'WHERE user_id = $1';

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM notifications ${whereClause}`,
        [userId]
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const listRes = await db.query<{
        notification_id: string;
        user_id: string;
        type: string;
        title: string;
        message: string;
        reference_type: string | null;
        reference_id: string | null;
        is_read: boolean;
        created_at: Date | string;
      }>(
        `SELECT notification_id, user_id, type, title, message,
                reference_type, reference_id, is_read, created_at
         FROM notifications
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const items = listRes.rows.map((r) => ({
        notificationId: r.notification_id,
        userId: r.user_id,
        type: r.type,
        title: r.title,
        message: r.message,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        isRead: r.is_read,
        createdAt: new Date(r.created_at).toISOString(),
      }));

      return sendPaginated(res, items, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/notifications/preferences
router.get(
  '/preferences',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prefs = await notificationsService.ensurePreferences(
        req.user!.userId
      );
      return sendSuccess(res, prefs);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/notifications/preferences
router.patch(
  '/preferences',
  authenticate,
  validate({ body: updatePrefsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const current = await notificationsService.ensurePreferences(userId);

      const emailNotifications =
        req.body.emailNotifications ?? current.emailNotifications;
      const pushNotifications =
        req.body.pushNotifications ?? current.pushNotifications;
      const threadReplies = req.body.threadReplies ?? current.threadReplies;
      const clubEvents = req.body.clubEvents ?? current.clubEvents;
      const campusAnnouncements =
        req.body.campusAnnouncements ?? current.campusAnnouncements;

      const updated = await db.query<{
        user_id: string;
        email_notifications: boolean;
        push_notifications: boolean;
        thread_replies: boolean;
        club_events: boolean;
        campus_announcements: boolean;
        updated_at: Date | string;
      }>(
        `UPDATE notification_preferences
         SET email_notifications = $2,
             push_notifications = $3,
             thread_replies = $4,
             club_events = $5,
             campus_announcements = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING user_id, email_notifications, push_notifications,
                   thread_replies, club_events, campus_announcements, updated_at`,
        [
          userId,
          emailNotifications,
          pushNotifications,
          threadReplies,
          clubEvents,
          campusAnnouncements,
        ]
      );

      const row = updated.rows[0];
      return sendSuccess(res, {
        userId: row.user_id,
        emailNotifications: row.email_notifications,
        pushNotifications: row.push_notifications,
        threadReplies: row.thread_replies,
        clubEvents: row.club_events,
        campusAnnouncements: row.campus_announcements,
        updatedAt: new Date(row.updated_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/notifications/read-all
router.patch(
  '/read-all',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await db.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE user_id = $1 AND is_read = FALSE`,
        [req.user!.userId]
      );
      return sendSuccess(
        res,
        { markedAllRead: true },
        200,
        'All notifications marked as read.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/notifications/:notificationId/read
router.patch(
  '/:notificationId/read',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notificationId } = req.params;
      const result = await db.query<{
        notification_id: string;
        is_read: boolean;
      }>(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE notification_id = $1 AND user_id = $2
         RETURNING notification_id, is_read`,
        [notificationId, req.user!.userId]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Notification not found.');
      }

      return sendSuccess(res, {
        notificationId: result.rows[0].notification_id,
        isRead: result.rows[0].is_read,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

