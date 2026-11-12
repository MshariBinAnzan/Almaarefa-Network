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
import {
  parsePaginationParams,
  sendCreated,
  sendPaginated,
  sendSuccess,
} from '../../utils/response.js';
import {
  ModerationStatus,
  PostAttachment,
  PostType,
} from '../../../../shared/types/index.js';
import { notificationsService } from '../notifications/notifications.service.js';

const router = Router();

const attachmentSchema = z.object({
  type: z.enum(['IMAGE', 'DOCUMENT']),
  url: z.string().url('Attachment URL must be a valid URL').max(500),
  name: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const createPostSchema = z.object({
  postType: z.enum(['GENERAL', 'ACADEMIC', 'CLUB_EVENT']).default('GENERAL'),
  clubId: z.string().uuid('clubId must be a valid UUID').nullable().optional(),
  classGroupId: z
    .string()
    .uuid('classGroupId must be a valid UUID')
    .nullable()
    .optional(),
  content: z
    .string({ required_error: 'Post content is required' })
    .trim()
    .min(1, 'Post content cannot be empty')
    .max(10000, 'Post content cannot exceed 10000 characters'),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

const updatePostSchema = z.object({
  content: z.string().trim().min(1).max(10000).optional(),
  postType: z.enum(['GENERAL', 'ACADEMIC', 'CLUB_EVENT']).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

const createCommentSchema = z.object({
  content: z
    .string({ required_error: 'Comment content is required' })
    .trim()
    .min(1, 'Comment content cannot be empty')
    .max(3000, 'Comment content cannot exceed 3000 characters'),
});

const reactionSchema = z.object({
  reactionType: z.enum(['LIKE', 'HELPFUL', 'CELEBRATE']).default('LIKE'),
});

interface RawPostRow {
  post_id: string;
  author_id: string;
  author_full_name: string;
  author_username: string;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  club_id: string | null;
  class_group_id: string | null;
  post_type: PostType;
  content: string;
  attachments: PostAttachment[] | string | null;
  moderation_status: ModerationStatus;
  created_at: Date | string;
  updated_at: Date | string;
  likes_count: string | number;
  comments_count: string | number;
  has_liked: boolean;
}

function formatPostRow(row: RawPostRow) {
  let parsedAttachments: PostAttachment[] = [];
  if (Array.isArray(row.attachments)) {
    parsedAttachments = row.attachments;
  } else if (typeof row.attachments === 'string') {
    try {
      parsedAttachments = JSON.parse(row.attachments);
    } catch {
      parsedAttachments = [];
    }
  }

  return {
    postId: row.post_id,
    author: {
      userId: row.author_id,
      fullName: row.author_full_name,
      username: row.author_username,
      avatarUrl: row.author_avatar_url,
      isVerified: Boolean(row.author_is_verified),
    },
    clubId: row.club_id,
    classGroupId: row.class_group_id,
    postType: row.post_type,
    content: row.content,
    attachments: parsedAttachments,
    stats: {
      likesCount: Number(row.likes_count ?? 0),
      commentsCount: Number(row.comments_count ?? 0),
      hasLiked: Boolean(row.has_liked),
    },
    moderationStatus: row.moderation_status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/posts
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        10
      );

      const feedType = (
        (req.query.feedType || req.query.feed_type || 'general') as string
      )
        .toLowerCase()
        .trim();
      const targetId = (req.query.targetId || req.query.target_id) as
        | string
        | undefined;
      const directClassGroupId = (req.query.classGroupId ||
        req.query.class_group_id) as string | undefined;
      const directClubId = (req.query.clubId || req.query.club_id) as
        | string
        | undefined;
      const postType = (
        (req.query.postType || req.query.post_type) as string | undefined
      )?.toUpperCase();
      const search = (req.query.search as string | undefined)?.trim();

      const conditions: string[] = [
        'p.is_deleted = FALSE',
        "p.moderation_status = 'APPROVED'",
      ];
      const params: unknown[] = [];

      if (feedType === 'class_group') {
        const groupId = targetId || directClassGroupId;
        if (!groupId) {
          throw new ValidationError(
            'targetId is required when feedType is class_group.',
            [{ field: 'targetId', issue: 'Class group UUID is required' }]
          );
        }
        params.push(groupId);
        conditions.push(`p.class_group_id = $${params.length}`);
      } else if (feedType === 'club') {
        const clubId = targetId || directClubId;
        if (!clubId) {
          throw new ValidationError(
            'targetId is required when feedType is club.',
            [{ field: 'targetId', issue: 'Club UUID is required' }]
          );
        }
        params.push(clubId);
        conditions.push(`p.club_id = $${params.length}`);
      } else if (feedType === 'general') {
        if (directClassGroupId) {
          params.push(directClassGroupId);
          conditions.push(`p.class_group_id = $${params.length}`);
        } else if (directClubId) {
          params.push(directClubId);
          conditions.push(`p.club_id = $${params.length}`);
        }
      } else {
        throw new ValidationError(
          'Invalid feedType. Must be general, class_group, or club.',
          [{ field: 'feedType', issue: 'Must be general, class_group, or club' }]
        );
      }

      if (postType) {
        params.push(postType);
        conditions.push(`p.post_type = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(p.content ILIKE $${params.length} OR p.attachments::text ILIKE $${params.length})`
        );
      }

      const whereSql = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM posts p ${whereSql}`,
        params
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const userIdIdx = params.length + 1;
      const limitIdx = params.length + 2;
      const offsetIdx = params.length + 3;

      const listRes = await db.query<RawPostRow>(
        `SELECT p.post_id, p.author_id,
                pr.full_name AS author_full_name,
                pr.username AS author_username,
                pr.avatar_url AS author_avatar_url,
                u.is_verified AS author_is_verified,
                p.club_id, p.class_group_id, p.post_type, p.content, p.attachments,
                p.moderation_status, p.created_at, p.updated_at,
                (SELECT COUNT(*)::text FROM post_reactions r WHERE r.post_id = p.post_id) AS likes_count,
                (SELECT COUNT(*)::text FROM post_comments c WHERE c.post_id = p.post_id AND c.is_deleted = FALSE) AS comments_count,
                EXISTS (
                  SELECT 1 FROM post_reactions r2
                  WHERE r2.post_id = p.post_id AND r2.user_id = $${userIdIdx}
                ) AS has_liked
         FROM posts p
         INNER JOIN users u ON u.user_id = p.author_id
         INNER JOIN profiles pr ON pr.user_id = p.author_id
         ${whereSql}
         ORDER BY p.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, userId, limit, offset]
      );

      const posts = listRes.rows.map(formatPostRow);
      return sendPaginated(res, posts, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/posts
router.post(
  '/',
  authenticate,
  validate({ body: createPostSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { postType, clubId, classGroupId, content, attachments } = req.body;

      if (clubId) {
        const clubCheck = await db.query(
          'SELECT club_id FROM clubs WHERE club_id = $1',
          [clubId]
        );
        if (clubCheck.rowCount === 0) {
          throw new ValidationError('Specified club does not exist.', [
            { field: 'clubId', issue: 'Club not found' },
          ]);
        }
      }

      if (classGroupId) {
        const groupCheck = await db.query(
          'SELECT group_id FROM class_group WHERE group_id = $1',
          [classGroupId]
        );
        if (groupCheck.rowCount === 0) {
          throw new ValidationError('Specified class group does not exist.', [
            { field: 'classGroupId', issue: 'Class group not found' },
          ]);
        }
      }

      const visibility = classGroupId
        ? 'CLASS_GROUP'
        : clubId
          ? 'CLUB'
          : 'PUBLIC';

      const inserted = await db.query<{ post_id: string }>(
        `INSERT INTO posts (author_id, club_id, class_group_id, post_type, visibility, content, attachments, moderation_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'APPROVED')
         RETURNING post_id`,
        [
          userId,
          clubId ?? null,
          classGroupId ?? null,
          postType,
          visibility,
          content,
          JSON.stringify(attachments ?? []),
        ]
      );

      const postId = inserted.rows[0].post_id;

      const postRes = await db.query<RawPostRow>(
        `SELECT p.post_id, p.author_id,
                pr.full_name AS author_full_name,
                pr.username AS author_username,
                pr.avatar_url AS author_avatar_url,
                u.is_verified AS author_is_verified,
                p.club_id, p.class_group_id, p.post_type, p.content, p.attachments,
                p.moderation_status, p.created_at, p.updated_at,
                0 AS likes_count,
                0 AS comments_count,
                FALSE AS has_liked
         FROM posts p
         INNER JOIN users u ON u.user_id = p.author_id
         INNER JOIN profiles pr ON pr.user_id = p.author_id
         WHERE p.post_id = $1`,
        [postId]
      );

      return sendCreated(res, formatPostRow(postRes.rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/posts/:postId
router.get(
  '/:postId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.userId;

      const postRes = await db.query<RawPostRow>(
        `SELECT p.post_id, p.author_id,
                pr.full_name AS author_full_name,
                pr.username AS author_username,
                pr.avatar_url AS author_avatar_url,
                u.is_verified AS author_is_verified,
                p.club_id, p.class_group_id, p.post_type, p.content, p.attachments,
                p.moderation_status, p.created_at, p.updated_at,
                (SELECT COUNT(*)::text FROM post_reactions r WHERE r.post_id = p.post_id) AS likes_count,
                (SELECT COUNT(*)::text FROM post_comments c WHERE c.post_id = p.post_id AND c.is_deleted = FALSE) AS comments_count,
                EXISTS (
                  SELECT 1 FROM post_reactions r2
                  WHERE r2.post_id = p.post_id AND r2.user_id = $2
                ) AS has_liked
         FROM posts p
         INNER JOIN users u ON u.user_id = p.author_id
         INNER JOIN profiles pr ON pr.user_id = p.author_id
         WHERE p.post_id = $1 AND p.is_deleted = FALSE`,
        [postId, userId]
      );

      if (postRes.rowCount === 0) {
        throw new NotFoundError('Post not found.');
      }

      return sendSuccess(res, formatPostRow(postRes.rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/posts/:postId
router.patch(
  '/:postId',
  authenticate,
  validate({ body: updatePostSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.userId;

      const existing = await db.query<{
        post_id: string;
        author_id: string;
        content: string;
        post_type: PostType;
        attachments: any;
      }>(
        `SELECT post_id, author_id, content, post_type, attachments
         FROM posts
         WHERE post_id = $1 AND is_deleted = FALSE`,
        [postId]
      );

      if (existing.rowCount === 0) {
        throw new NotFoundError('Post not found.');
      }

      const curr = existing.rows[0];
      if (curr.author_id !== userId && req.user!.role !== 'ADMIN') {
        throw new ForbiddenError('You can only edit your own posts.');
      }

      await db.query(
        `UPDATE posts
         SET content = $2,
             post_type = $3,
             attachments = $4::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE post_id = $1`,
        [
          postId,
          req.body.content ?? curr.content,
          req.body.postType ?? curr.post_type,
          JSON.stringify(req.body.attachments ?? curr.attachments ?? []),
        ]
      );

      const updated = await db.query<RawPostRow>(
        `SELECT p.post_id, p.author_id,
                pr.full_name AS author_full_name,
                pr.username AS author_username,
                pr.avatar_url AS author_avatar_url,
                u.is_verified AS author_is_verified,
                p.club_id, p.class_group_id, p.post_type, p.content, p.attachments,
                p.moderation_status, p.created_at, p.updated_at,
                (SELECT COUNT(*)::text FROM post_reactions r WHERE r.post_id = p.post_id) AS likes_count,
                (SELECT COUNT(*)::text FROM post_comments c WHERE c.post_id = p.post_id AND c.is_deleted = FALSE) AS comments_count,
                EXISTS (
                  SELECT 1 FROM post_reactions r2
                  WHERE r2.post_id = p.post_id AND r2.user_id = $2
                ) AS has_liked
         FROM posts p
         INNER JOIN users u ON u.user_id = p.author_id
         INNER JOIN profiles pr ON pr.user_id = p.author_id
         WHERE p.post_id = $1`,
        [postId, userId]
      );

      return sendSuccess(res, formatPostRow(updated.rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/posts/:postId
router.delete(
  '/:postId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.userId;

      const existing = await db.query<{ post_id: string; author_id: string }>(
        'SELECT post_id, author_id FROM posts WHERE post_id = $1 AND is_deleted = FALSE',
        [postId]
      );

      if (existing.rowCount === 0) {
        throw new NotFoundError('Post not found.');
      }

      if (
        existing.rows[0].author_id !== userId &&
        req.user!.role !== 'ADMIN'
      ) {
        throw new ForbiddenError('You can only delete your own posts.');
      }

      await db.query(
        `UPDATE posts
         SET is_deleted = TRUE,
             deleted_at = CURRENT_TIMESTAMP,
             deleted_by = $2,
             deletion_reason = 'Deleted by author'
         WHERE post_id = $1`,
        [postId, userId]
      );

      return sendSuccess(
        res,
        { postId, deleted: true },
        200,
        'Post deleted successfully.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/posts/:postId/comments
router.get(
  '/:postId/comments',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;

      const postCheck = await db.query(
        'SELECT post_id FROM posts WHERE post_id = $1 AND is_deleted = FALSE',
        [postId]
      );
      if (postCheck.rowCount === 0) {
        throw new NotFoundError('Post not found.');
      }

      const listRes = await db.query<{
        comment_id: string;
        post_id: string;
        author_id: string;
        content: string;
        created_at: Date | string;
        updated_at: Date | string;
        full_name: string;
        username: string;
        avatar_url: string | null;
        is_verified: boolean;
      }>(
        `SELECT c.comment_id, c.post_id, c.author_id, c.content, c.created_at, c.updated_at,
                pr.full_name, pr.username, pr.avatar_url,
                u.is_verified
         FROM post_comments c
         INNER JOIN users u ON u.user_id = c.author_id
         INNER JOIN profiles pr ON pr.user_id = c.author_id
         WHERE c.post_id = $1 AND c.is_deleted = FALSE
         ORDER BY c.created_at ASC`,
        [postId]
      );

      const comments = listRes.rows.map((c) => ({
        commentId: c.comment_id,
        postId: c.post_id,
        author: {
          userId: c.author_id,
          fullName: c.full_name,
          username: c.username,
          avatarUrl: c.avatar_url,
          isVerified: Boolean(c.is_verified),
        },
        content: c.content,
        createdAt: new Date(c.created_at).toISOString(),
        updatedAt: new Date(c.updated_at).toISOString(),
      }));

      return sendSuccess(res, comments);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/posts/:postId/comments
router.post(
  '/:postId/comments',
  authenticate,
  validate({ body: createCommentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.userId;
      const { content } = req.body;

      const postRes = await db.query<{
        post_id: string;
        author_id: string;
      }>(
        'SELECT post_id, author_id FROM posts WHERE post_id = $1 AND is_deleted = FALSE',
        [postId]
      );
      if (postRes.rowCount === 0) {
        throw new NotFoundError('Post not found.');
      }

      const inserted = await db.query<{
        comment_id: string;
        post_id: string;
        author_id: string;
        content: string;
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `INSERT INTO post_comments (post_id, author_id, content)
         VALUES ($1, $2, $3)
         RETURNING comment_id, post_id, author_id, content, created_at, updated_at`,
        [postId, userId, content]
      );

      const c = inserted.rows[0];

      const authorRes = await db.query<{
        full_name: string;
        username: string;
        avatar_url: string | null;
        is_verified: boolean;
      }>(
        `SELECT p.full_name, p.username, p.avatar_url, u.is_verified
         FROM profiles p
         INNER JOIN users u ON u.user_id = p.user_id
         WHERE p.user_id = $1`,
        [userId]
      );
      const author = authorRes.rows[0];

      const postAuthorId = postRes.rows[0].author_id;
      if (postAuthorId !== userId) {
        await notificationsService.createNotification({
          userId: postAuthorId,
          type: 'THREAD_REPLY',
          title: 'New Reply on Your Post',
          message: `${author.full_name} commented on your post: "${content.slice(0, 80)}"`,
          referenceType: 'POST',
          referenceId: postId,
        });
      }

      return sendCreated(res, {
        commentId: c.comment_id,
        postId: c.post_id,
        author: {
          userId,
          fullName: author.full_name,
          username: author.username,
          avatarUrl: author.avatar_url,
          isVerified: Boolean(author.is_verified),
        },
        content: c.content,
        createdAt: new Date(c.created_at).toISOString(),
        updatedAt: new Date(c.updated_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/posts/:postId/comments/:commentId
router.delete(
  '/:postId/comments/:commentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user!.userId;

      const commentRes = await db.query<{
        comment_id: string;
        author_id: string;
        post_author_id: string;
      }>(
        `SELECT c.comment_id, c.author_id, p.author_id AS post_author_id
         FROM post_comments c
         INNER JOIN posts p ON p.post_id = c.post_id
         WHERE c.comment_id = $1 AND c.post_id = $2 AND c.is_deleted = FALSE`,
        [commentId, postId]
      );

      if (commentRes.rowCount === 0) {
        throw new NotFoundError('Comment not found.');
      }

      const row = commentRes.rows[0];
      if (
        row.author_id !== userId &&
        row.post_author_id !== userId &&
        req.user!.role !== 'ADMIN'
      ) {
        throw new ForbiddenError(
          'You do not have permission to delete this comment.'
        );
      }

      await db.query(
        'UPDATE post_comments SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE comment_id = $1',
        [commentId]
      );

      return sendSuccess(
        res,
        { commentId, postId, deleted: true },
        200,
        'Comment deleted.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/posts/:postId/reactions
router.post(
  '/:postId/reactions',
  authenticate,
  validate({ body: reactionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.userId;
      const { reactionType } = req.body;

      const postCheck = await db.query(
        'SELECT post_id FROM posts WHERE post_id = $1 AND is_deleted = FALSE',
        [postId]
      );
      if (postCheck.rowCount === 0) {
        throw new NotFoundError('Post not found.');
      }

      const existing = await db.query<{
        reaction_id: string;
        reaction_type: string;
      }>(
        'SELECT reaction_id, reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );

      let hasLiked = false;
      if (existing.rowCount > 0) {
        if (existing.rows[0].reaction_type === reactionType) {
          // Toggle off if same reaction clicked again
          await db.query(
            'DELETE FROM post_reactions WHERE reaction_id = $1',
            [existing.rows[0].reaction_id]
          );
          hasLiked = false;
        } else {
          await db.query(
            'UPDATE post_reactions SET reaction_type = $2 WHERE reaction_id = $1',
            [existing.rows[0].reaction_id, reactionType]
          );
          hasLiked = true;
        }
      } else {
        await db.query(
          `INSERT INTO post_reactions (post_id, user_id, reaction_type)
           VALUES ($1, $2, $3)`,
          [postId, userId, reactionType]
        );
        hasLiked = true;
      }

      const countRes = await db.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM post_reactions WHERE post_id = $1',
        [postId]
      );
      const likesCount = Number(countRes.rows[0]?.count ?? 0);

      return sendSuccess(res, {
        postId,
        reactionType,
        hasLiked,
        likesCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

