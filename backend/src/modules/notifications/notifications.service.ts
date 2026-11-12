import { db, DbClient } from '../../config/db.js';
import {
  NotificationItem,
  NotificationPreferences,
} from '../../../../shared/types/index.js';

export interface CreateNotificationInput {
  userId: string;
  type:
    | 'THREAD_REPLY'
    | 'CLUB_EVENT'
    | 'CAMPUS_ANNOUNCEMENT'
    | 'VERIFICATION_UPDATE'
    | 'CLUB_REQUEST_UPDATE'
    | 'MODERATION_NOTICE';
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

export class NotificationsService {
  public async ensurePreferences(
    userId: string,
    client: DbClient = db
  ): Promise<NotificationPreferences> {
    await client.query(
      `INSERT INTO notification_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const res = await client.query<{
      user_id: string;
      email_notifications: boolean;
      push_notifications: boolean;
      thread_replies: boolean;
      club_events: boolean;
      campus_announcements: boolean;
      updated_at: Date | string;
    }>(
      `SELECT user_id, email_notifications, push_notifications,
              thread_replies, club_events, campus_announcements, updated_at
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const row = res.rows[0];
    return {
      userId: row.user_id,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      threadReplies: row.thread_replies,
      clubEvents: row.club_events,
      campusAnnouncements: row.campus_announcements,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  public async createNotification(
    input: CreateNotificationInput,
    client: DbClient = db
  ): Promise<NotificationItem | null> {
    const prefs = await this.ensurePreferences(input.userId, client);

    if (input.type === 'THREAD_REPLY' && !prefs.threadReplies) {
      return null;
    }
    if (input.type === 'CLUB_EVENT' && !prefs.clubEvents) {
      return null;
    }
    if (input.type === 'CAMPUS_ANNOUNCEMENT' && !prefs.campusAnnouncements) {
      return null;
    }

    const res = await client.query<{
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
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING notification_id, user_id, type, title, message, reference_type, reference_id, is_read, created_at`,
      [
        input.userId,
        input.type,
        input.title,
        input.message,
        input.referenceType ?? null,
        input.referenceId ?? null,
      ]
    );

    const row = res.rows[0];
    return {
      notificationId: row.notification_id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      isRead: row.is_read,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

export const notificationsService = new NotificationsService();

