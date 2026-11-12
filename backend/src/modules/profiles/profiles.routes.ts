import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { UserRole } from '../../../../shared/types/index.js';

const router = Router();

const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(150, 'Full name cannot exceed 150 characters')
    .optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Username can only contain letters, numbers, underscores, dots, and hyphens'
    )
    .optional(),
  bio: z
    .string()
    .max(1000, 'Bio cannot exceed 1000 characters')
    .nullable()
    .optional(),
  avatarUrl: z
    .string()
    .url('Avatar URL must be a valid URL')
    .max(500)
    .nullable()
    .optional(),
  departmentId: z
    .string()
    .uuid('Department ID must be a valid UUID')
    .nullable()
    .optional(),
  academicYear: z.number().int().min(1).max(7).nullable().optional(),
});

async function getFormattedProfile(userId: string) {
  const res = await db.query<{
    user_id: string;
    university_email: string;
    role: UserRole;
    is_verified: boolean;
    user_created_at: Date | string;
    full_name: string;
    username: string;
    student_id: string | null;
    avatar_url: string | null;
    bio: string | null;
    academic_year: number | null;
    department_id: string | null;
    profile_created_at: Date | string;
    profile_updated_at: Date | string;
    department_name: string | null;
    department_code: string | null;
  }>(
    `SELECT u.user_id, u.university_email, u.role, u.is_verified,
            u.created_at AS user_created_at,
            p.full_name, p.username, p.student_id, p.avatar_url, p.bio,
            p.academic_year, p.department_id,
            p.created_at AS profile_created_at,
            p.updated_at AS profile_updated_at,
            d.name AS department_name,
            d.code AS department_code
     FROM users u
     INNER JOIN profiles p ON p.user_id = u.user_id
     LEFT JOIN departments d ON d.department_id = p.department_id
     WHERE u.user_id = $1`,
    [userId]
  );

  if (res.rowCount === 0) {
    return null;
  }

  const r = res.rows[0];
  return {
    userId: r.user_id,
    fullName: r.full_name,
    username: r.username,
    studentId: r.student_id,
    avatarUrl: r.avatar_url,
    bio: r.bio,
    academicYear: r.academic_year,
    role: r.role,
    departmentId: r.department_id,
    department: r.department_id
      ? {
          departmentId: r.department_id,
          name: r.department_name!,
          code: r.department_code!,
        }
      : null,
    isVerified: r.is_verified,
    joinedAt: new Date(r.user_created_at).toISOString(),
    createdAt: new Date(r.profile_created_at).toISOString(),
    updatedAt: new Date(r.profile_updated_at).toISOString(),
  };
}

// GET /api/v1/profiles/me
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await getFormattedProfile(req.user!.userId);
      if (!profile) {
        throw new NotFoundError('Profile not found.');
      }
      return sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/profiles/me
router.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const {
        fullName,
        username,
        bio,
        avatarUrl,
        departmentId,
        academicYear,
      } = req.body;

      const currentRes = await db.query<{
        full_name: string;
        username: string;
        bio: string | null;
        avatar_url: string | null;
        department_id: string | null;
        academic_year: number | null;
      }>(
        `SELECT full_name, username, bio, avatar_url, department_id, academic_year
         FROM profiles
         WHERE user_id = $1`,
        [userId]
      );

      if (currentRes.rowCount === 0) {
        throw new NotFoundError('Profile not found.');
      }
      const current = currentRes.rows[0];

      if (
        username !== undefined &&
        username.toLowerCase() !== current.username.toLowerCase()
      ) {
        const dupUser = await db.query(
          'SELECT user_id FROM profiles WHERE LOWER(username) = LOWER($1) AND user_id != $2',
          [username, userId]
        );
        if (dupUser.rowCount > 0) {
          throw new ConflictError('Username is already taken.', [
            { field: 'username', issue: 'Username is already in use' },
          ]);
        }
      }

      if (departmentId) {
        const deptRes = await db.query(
          'SELECT department_id FROM departments WHERE department_id = $1',
          [departmentId]
        );
        if (deptRes.rowCount === 0) {
          throw new ValidationError('Selected department does not exist.', [
            { field: 'departmentId', issue: 'Department ID not found' },
          ]);
        }
      }

      await db.query(
        `UPDATE profiles
         SET full_name = $2,
             username = $3,
             bio = $4,
             avatar_url = $5,
             department_id = $6,
             academic_year = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [
          userId,
          fullName !== undefined ? fullName : current.full_name,
          username !== undefined ? username : current.username,
          bio !== undefined ? bio : current.bio,
          avatarUrl !== undefined ? avatarUrl : current.avatar_url,
          departmentId !== undefined ? departmentId : current.department_id,
          academicYear !== undefined ? academicYear : current.academic_year,
        ]
      );

      const updatedProfile = await getFormattedProfile(userId);
      return sendSuccess(res, updatedProfile);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/profiles/:userId
router.get(
  '/:userId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const profile = await getFormattedProfile(userId);
      if (!profile) {
        throw new NotFoundError('Student profile not found.');
      }
      return sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

