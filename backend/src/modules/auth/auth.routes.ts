import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/errors.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { UserRole } from '../../../../shared/types/index.js';
import { notificationsService } from '../notifications/notifications.service.js';

const router = Router();

const isAllowedUniversityEmail = (email: string): boolean => {
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return env.allowedEmailDomains.includes(domain);
};

const registerSchema = z.object({
  universityEmail: z
    .string({ required_error: 'University email is required' })
    .trim()
    .email('Invalid email format')
    .refine(isAllowedUniversityEmail, {
      message: 'Email must belong to @mcst.edu.sa domain',
    }),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(150, 'Full name cannot exceed 150 characters'),
  studentId: z
    .string({ required_error: 'Student ID is required' })
    .trim()
    .min(3, 'Student ID must be at least 3 characters')
    .max(50, 'Student ID cannot exceed 50 characters'),
  departmentId: z
    .string()
    .uuid('Department ID must be a valid UUID')
    .optional()
    .nullable(),
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
  academicYear: z.number().int().min(1).max(7).optional(),
});

const loginSchema = z
  .object({
    universityEmail: z.string().trim().email('Invalid email format').optional(),
    email: z.string().trim().email('Invalid email format').optional(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  })
  .refine((data) => Boolean(data.universityEmail || data.email), {
    message: 'University email is required',
    path: ['universityEmail'],
  });

const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const signAccessToken = (user: {
  userId: string;
  universityEmail: string;
  role: UserRole;
}): string => {
  return jwt.sign(
    {
      sub: user.userId,
      email: user.universityEmail,
      role: user.role,
      type: 'access',
    },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpiresIn }
  );
};

const signRefreshToken = (user: {
  userId: string;
  universityEmail: string;
  role: UserRole;
}): string => {
  return jwt.sign(
    {
      sub: user.userId,
      email: user.universityEmail,
      role: user.role,
      jti: crypto.randomUUID(),
      type: 'refresh',
    },
    env.jwtRefreshSecret,
    { expiresIn: `${env.jwtRefreshExpiresInDays}d` }
  );
};

// POST /api/v1/auth/register
router.post(
  '/register',
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        universityEmail,
        password,
        fullName,
        studentId,
        departmentId,
        username: requestedUsername,
        academicYear,
      } = req.body;

      const normalizedEmail = universityEmail.toLowerCase().trim();

      // Check existing email
      const existingEmail = await db.query(
        'SELECT user_id FROM users WHERE LOWER(university_email) = $1',
        [normalizedEmail]
      );
      if (existingEmail.rowCount > 0) {
        throw new ConflictError(
          'An account with this university email already exists.',
          [
            {
              field: 'universityEmail',
              issue: 'University email is already registered',
            },
          ]
        );
      }

      // Check existing studentId
      if (studentId) {
        const existingStudent = await db.query(
          'SELECT user_id FROM profiles WHERE student_id = $1',
          [studentId]
        );
        if (existingStudent.rowCount > 0) {
          throw new ConflictError(
            'An account with this student ID already exists.',
            [{ field: 'studentId', issue: 'Student ID is already registered' }]
          );
        }
      }

      // Validate departmentId if provided
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

      // Resolve username
      const emailPrefix = normalizedEmail
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_.-]/g, '_');
      let finalUsername = requestedUsername || emailPrefix;

      const existingUsername = await db.query(
        'SELECT user_id FROM profiles WHERE LOWER(username) = LOWER($1)',
        [finalUsername]
      );
      if (existingUsername.rowCount > 0) {
        if (requestedUsername) {
          throw new ConflictError('Username is already taken.', [
            { field: 'username', issue: 'Username is already taken' },
          ]);
        }
        finalUsername = `${emailPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const created = await db.withTransaction(async (tx) => {
        const userInsert = await tx.query<{
          user_id: string;
          university_email: string;
          role: UserRole;
          email_verified: boolean;
          is_verified: boolean;
          is_active: boolean;
          created_at: Date | string;
        }>(
          `INSERT INTO users (university_email, password_hash, role, email_verified, is_verified, is_active)
           VALUES ($1, $2, 'STUDENT', FALSE, FALSE, TRUE)
           RETURNING user_id, university_email, role, email_verified, is_verified, is_active, created_at`,
          [normalizedEmail, passwordHash]
        );
        const userRow = userInsert.rows[0];

        const profileInsert = await tx.query<{
          full_name: string;
          student_id: string;
          username: string;
        }>(
          `INSERT INTO profiles (user_id, department_id, student_id, full_name, username, academic_year)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING full_name, student_id, username`,
          [
            userRow.user_id,
            departmentId ?? null,
            studentId,
            fullName,
            finalUsername,
            academicYear ?? 1,
          ]
        );
        const profileRow = profileInsert.rows[0];

        await notificationsService.ensurePreferences(userRow.user_id, tx);

        return { userRow, profileRow };
      });

      return sendCreated(res, {
        userId: created.userRow.user_id,
        universityEmail: created.userRow.university_email,
        role: created.userRow.role,
        emailVerified: created.userRow.email_verified,
        isVerified: created.userRow.is_verified,
        profile: {
          fullName: created.profileRow.full_name,
          studentId: created.profileRow.student_id,
          username: created.profileRow.username,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawEmail = (req.body.universityEmail || req.body.email || '')
        .toLowerCase()
        .trim();
      const { password } = req.body;

      const userQuery = await db.query<{
        user_id: string;
        university_email: string;
        password_hash: string | null;
        role: UserRole;
        email_verified: boolean;
        is_verified: boolean;
        is_active: boolean;
        full_name: string;
        username: string;
        student_id: string | null;
        avatar_url: string | null;
        bio: string | null;
        department_id: string | null;
        department_name: string | null;
      }>(
        `SELECT u.user_id, u.university_email, u.password_hash, u.role,
                u.email_verified, u.is_verified, u.is_active,
                p.full_name, p.username, p.student_id, p.avatar_url, p.bio, p.department_id,
                d.name AS department_name
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.user_id
         LEFT JOIN departments d ON d.department_id = p.department_id
         WHERE LOWER(u.university_email) = $1`,
        [rawEmail]
      );

      if (userQuery.rowCount === 0 || !userQuery.rows[0].password_hash) {
        throw new UnauthorizedError(
          'Invalid university email or password.',
          'INVALID_CREDENTIALS'
        );
      }

      const user = userQuery.rows[0];
      const passwordValid = await bcrypt.compare(password, user.password_hash!);
      if (!passwordValid) {
        throw new UnauthorizedError(
          'Invalid university email or password.',
          'INVALID_CREDENTIALS'
        );
      }

      if (!user.is_active) {
        throw new ForbiddenError(
          'Your account has been suspended by an administrator.',
          'ACCOUNT_SUSPENDED'
        );
      }

      const accessToken = signAccessToken({
        userId: user.user_id,
        universityEmail: user.university_email,
        role: user.role,
      });

      const refreshToken = signRefreshToken({
        userId: user.user_id,
        universityEmail: user.university_email,
        role: user.role,
      });

      const expiresAt = new Date(
        Date.now() + env.jwtRefreshExpiresInDays * 24 * 60 * 60 * 1000
      );

      await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.user_id, hashToken(refreshToken), expiresAt.toISOString()]
      );

      return sendSuccess(res, {
        accessToken,
        refreshToken,
        expiresIn: env.jwtAccessExpiresIn,
        user: {
          userId: user.user_id,
          email: user.university_email,
          universityEmail: user.university_email,
          role: user.role,
          emailVerified: user.email_verified,
          isVerified: user.is_verified,
          isActive: user.is_active,
          profile: {
            fullName: user.full_name,
            username: user.username,
            studentId: user.student_id,
            avatarUrl: user.avatar_url,
            bio: user.bio,
            departmentId: user.department_id,
            departmentName: user.department_name,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh-token
router.post(
  '/refresh-token',
  validate({ body: refreshTokenSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      let decoded: {
        sub: string;
        email: string;
        role: UserRole;
        type: string;
      };
      try {
        decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as any;
      } catch {
        throw new UnauthorizedError(
          'Invalid or expired refresh token.',
          'INVALID_REFRESH_TOKEN'
        );
      }

      if (decoded.type !== 'refresh' || !decoded.sub) {
        throw new UnauthorizedError(
          'Invalid refresh token payload.',
          'INVALID_REFRESH_TOKEN'
        );
      }

      const tokenHash = hashToken(refreshToken);
      const storedToken = await db.query<{
        token_id: string;
        user_id: string;
        expires_at: Date | string;
        revoked_at: Date | string | null;
      }>(
        `SELECT token_id, user_id, expires_at, revoked_at
         FROM refresh_tokens
         WHERE token_hash = $1 AND user_id = $2`,
        [tokenHash, decoded.sub]
      );

      if (
        storedToken.rowCount === 0 ||
        storedToken.rows[0].revoked_at !== null ||
        new Date(storedToken.rows[0].expires_at).getTime() < Date.now()
      ) {
        throw new UnauthorizedError(
          'Refresh token has expired or been revoked.',
          'INVALID_REFRESH_TOKEN'
        );
      }

      const userRes = await db.query<{
        user_id: string;
        university_email: string;
        role: UserRole;
        is_active: boolean;
      }>(
        `SELECT user_id, university_email, role, is_active
         FROM users
         WHERE user_id = $1`,
        [decoded.sub]
      );

      if (userRes.rowCount === 0 || !userRes.rows[0].is_active) {
        throw new UnauthorizedError(
          'User account is inactive or no longer exists.',
          'UNAUTHORIZED'
        );
      }

      const user = userRes.rows[0];
      const accessToken = signAccessToken({
        userId: user.user_id,
        universityEmail: user.university_email,
        role: user.role,
      });

      return sendSuccess(res, {
        accessToken,
        expiresIn: env.jwtAccessExpiresIn,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/logout
router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body || {};
      if (refreshToken && typeof refreshToken === 'string') {
        await db.query(
          `UPDATE refresh_tokens
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE token_hash = $1 AND user_id = $2`,
          [hashToken(refreshToken), req.user!.userId]
        );
      } else {
        await db.query(
          `UPDATE refresh_tokens
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [req.user!.userId]
        );
      }

      return sendSuccess(
        res,
        { loggedOut: true },
        200,
        'Successfully logged out.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/auth/me
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const userQuery = await db.query<{
        user_id: string;
        university_email: string;
        role: UserRole;
        email_verified: boolean;
        is_verified: boolean;
        is_active: boolean;
        created_at: Date | string;
        updated_at: Date | string;
        full_name: string;
        username: string;
        student_id: string | null;
        avatar_url: string | null;
        bio: string | null;
        academic_year: number | null;
        department_id: string | null;
        department_name: string | null;
        department_code: string | null;
      }>(
        `SELECT u.user_id, u.university_email, u.role, u.email_verified, u.is_verified, u.is_active,
                u.created_at, u.updated_at,
                p.full_name, p.username, p.student_id, p.avatar_url, p.bio, p.academic_year, p.department_id,
                d.name AS department_name, d.code AS department_code
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.user_id
         LEFT JOIN departments d ON d.department_id = p.department_id
         WHERE u.user_id = $1`,
        [userId]
      );

      const u = userQuery.rows[0];
      return sendSuccess(res, {
        userId: u.user_id,
        email: u.university_email,
        universityEmail: u.university_email,
        role: u.role,
        emailVerified: u.email_verified,
        isVerified: u.is_verified,
        isActive: u.is_active,
        createdAt: new Date(u.created_at).toISOString(),
        profile: {
          userId: u.user_id,
          fullName: u.full_name,
          username: u.username,
          studentId: u.student_id,
          avatarUrl: u.avatar_url,
          bio: u.bio,
          academicYear: u.academic_year,
          departmentId: u.department_id,
          departmentName: u.department_name,
          department: u.department_id
            ? {
                departmentId: u.department_id,
                name: u.department_name!,
                code: u.department_code!,
              }
            : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

