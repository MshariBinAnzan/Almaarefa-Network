import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { UserRole } from '../../../shared/types/index.js';

export interface AuthenticatedUser {
  userId: string;
  universityEmail: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError(
        'Missing or invalid Authorization Bearer header.',
        'UNAUTHORIZED'
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedError('Authentication token is missing.', 'UNAUTHORIZED');
    }

    let decoded: JwtAccessPayload;
    try {
      decoded = jwt.verify(token, env.jwtAccessSecret) as JwtAccessPayload;
    } catch (jwtErr: any) {
      if (jwtErr?.name === 'TokenExpiredError') {
        throw new UnauthorizedError(
          'Access token has expired. Please refresh your token.',
          'TOKEN_EXPIRED'
        );
      }
      throw new UnauthorizedError('Invalid authentication token.', 'INVALID_TOKEN');
    }

    if (decoded.type !== 'access' || !decoded.sub) {
      throw new UnauthorizedError('Invalid access token payload.', 'INVALID_TOKEN');
    }

    const userRes = await db.query<{
      user_id: string;
      university_email: string;
      role: UserRole;
      is_verified: boolean;
      is_active: boolean;
    }>(
      `SELECT user_id, university_email, role, is_verified, is_active
       FROM users
       WHERE user_id = $1`,
      [decoded.sub]
    );

    if (userRes.rowCount === 0) {
      throw new UnauthorizedError('User account no longer exists.', 'UNAUTHORIZED');
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      throw new ForbiddenError(
        'Your account has been suspended by an administrator.',
        'ACCOUNT_SUSPENDED'
      );
    }

    req.user = {
      userId: user.user_id,
      universityEmail: user.university_email,
      role: user.role,
      isVerified: user.is_verified,
      isActive: user.is_active,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, env.jwtAccessSecret) as JwtAccessPayload;
    if (decoded?.sub && decoded.type === 'access') {
      const userRes = await db.query<{
        user_id: string;
        university_email: string;
        role: UserRole;
        is_verified: boolean;
        is_active: boolean;
      }>(
        `SELECT user_id, university_email, role, is_verified, is_active
         FROM users
         WHERE user_id = $1 AND is_active = TRUE`,
        [decoded.sub]
      );
      if (userRes.rowCount > 0) {
        const user = userRes.rows[0];
        req.user = {
          userId: user.user_id,
          universityEmail: user.university_email,
          role: user.role,
          isVerified: user.is_verified,
          isActive: user.is_active,
        };
      }
    }
    next();
  } catch {
    // Ignore invalid optional tokens
    next();
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new UnauthorizedError('Authentication required.', 'UNAUTHORIZED')
      );
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
          'FORBIDDEN'
        )
      );
    }
    next();
  };
}

