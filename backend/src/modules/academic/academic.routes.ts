import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/db.js';
import {
  authenticate,
  authorize,
  optionalAuthenticate,
} from '../../middlewares/auth.js';
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
import { ClassGroupStatus } from '../../../../shared/types/index.js';

export const departmentsRouter = Router();
export const coursesRouter = Router();
export const classGroupsRouter = Router();

const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  description: z.string().max(1000).optional().nullable(),
});

const createCourseSchema = z.object({
  departmentId: z.string().uuid('Department ID must be a valid UUID'),
  courseCode: z.string().trim().min(2).max(50).toUpperCase(),
  courseName: z.string().trim().min(2).max(150),
  creditHours: z.number().int().min(1).max(12).default(3),
});

const createClassGroupSchema = z.object({
  courseId: z.string().uuid('Course ID must be a valid UUID'),
  title: z.string().trim().min(2).max(150),
  semester: z.string().trim().min(2).max(50),
  academicYear: z.number().int().min(2020).max(2100),
  description: z.string().max(2000).optional().nullable(),
});

// ============================================================================
// DEPARTMENTS (/api/v1/departments)
// ============================================================================

departmentsRouter.get(
  '/',
  optionalAuthenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query<{
        department_id: string;
        name: string;
        code: string;
        description: string | null;
        created_at: Date | string;
      }>(
        `SELECT department_id, name, code, description, created_at
         FROM departments
         ORDER BY name ASC`
      );

      const departments = result.rows.map((d) => ({
        departmentId: d.department_id,
        name: d.name,
        code: d.code,
        description: d.description,
        createdAt: new Date(d.created_at).toISOString(),
      }));

      return sendSuccess(res, departments);
    } catch (err) {
      next(err);
    }
  }
);

departmentsRouter.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ body: createDepartmentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, code, description } = req.body;
      const inserted = await db.query<{
        department_id: string;
        name: string;
        code: string;
        description: string | null;
        created_at: Date | string;
      }>(
        `INSERT INTO departments (name, code, description)
         VALUES ($1, $2, $3)
         RETURNING department_id, name, code, description, created_at`,
        [name, code, description ?? null]
      );

      const d = inserted.rows[0];
      return sendCreated(res, {
        departmentId: d.department_id,
        name: d.name,
        code: d.code,
        description: d.description,
        createdAt: new Date(d.created_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// COURSES (/api/v1/courses)
// ============================================================================

coursesRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = (req.query.departmentId ||
        req.query.department_id) as string | undefined;
      const search = (req.query.search as string | undefined)?.trim();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (departmentId) {
        params.push(departmentId);
        conditions.push(`c.department_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(c.course_code ILIKE $${params.length} OR c.course_name ILIKE $${params.length})`
        );
      }

      const whereSql =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await db.query<{
        course_id: string;
        department_id: string;
        department_name: string;
        department_code: string;
        course_code: string;
        course_name: string;
        credit_hours: number;
        created_at: Date | string;
      }>(
        `SELECT c.course_id, c.department_id,
                d.name AS department_name, d.code AS department_code,
                c.course_code, c.course_name, c.credit_hours, c.created_at
         FROM courses c
         INNER JOIN departments d ON d.department_id = c.department_id
         ${whereSql}
         ORDER BY c.course_code ASC`,
        params
      );

      const courses = result.rows.map((c) => ({
        courseId: c.course_id,
        departmentId: c.department_id,
        departmentName: c.department_name,
        departmentCode: c.department_code,
        courseCode: c.course_code,
        courseName: c.course_name,
        creditHours: c.credit_hours,
        createdAt: new Date(c.created_at).toISOString(),
      }));

      return sendSuccess(res, courses);
    } catch (err) {
      next(err);
    }
  }
);

coursesRouter.post(
  '/',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  validate({ body: createCourseSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { departmentId, courseCode, courseName, creditHours } = req.body;

      const deptCheck = await db.query(
        'SELECT department_id FROM departments WHERE department_id = $1',
        [departmentId]
      );
      if (deptCheck.rowCount === 0) {
        throw new ValidationError('Department does not exist.', [
          { field: 'departmentId', issue: 'Department ID not found' },
        ]);
      }

      const inserted = await db.query<{
        course_id: string;
        department_id: string;
        course_code: string;
        course_name: string;
        credit_hours: number;
        created_at: Date | string;
      }>(
        `INSERT INTO courses (department_id, course_code, course_name, credit_hours)
         VALUES ($1, $2, $3, $4)
         RETURNING course_id, department_id, course_code, course_name, credit_hours, created_at`,
        [departmentId, courseCode, courseName, creditHours]
      );

      const c = inserted.rows[0];
      return sendCreated(res, {
        courseId: c.course_id,
        departmentId: c.department_id,
        courseCode: c.course_code,
        courseName: c.course_name,
        creditHours: c.credit_hours,
        createdAt: new Date(c.created_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// CLASS GROUPS (/api/v1/class-groups)
// ============================================================================

classGroupsRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        20
      );

      const courseId = (req.query.courseId || req.query.course_id) as
        | string
        | undefined;
      const departmentId = (req.query.departmentId ||
        req.query.department_id) as string | undefined;
      const semester = (req.query.semester as string | undefined)?.trim();
      const academicYearRaw =
        req.query.academicYear || req.query.academic_year;
      const search = (req.query.search as string | undefined)?.trim();
      const joinedOnly =
        String(
          req.query.joinedOnly || req.query.joined_only || ''
        ).toLowerCase() === 'true';

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (courseId) {
        params.push(courseId);
        conditions.push(`cg.course_id = $${params.length}`);
      }

      if (departmentId) {
        params.push(departmentId);
        conditions.push(`c.department_id = $${params.length}`);
      }

      if (semester) {
        params.push(semester);
        conditions.push(`LOWER(cg.semester) = LOWER($${params.length})`);
      }

      if (academicYearRaw !== undefined && academicYearRaw !== '') {
        params.push(Number(academicYearRaw));
        conditions.push(`cg.academic_year = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(cg.title ILIKE $${params.length} OR c.course_code ILIKE $${params.length} OR c.course_name ILIKE $${params.length})`
        );
      }

      if (joinedOnly) {
        params.push(userId);
        conditions.push(
          `EXISTS (SELECT 1 FROM class_group_members cgm WHERE cgm.group_id = cg.group_id AND cgm.user_id = $${params.length})`
        );
      }

      const whereSql =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM class_group cg
         INNER JOIN courses c ON c.course_id = cg.course_id
         ${whereSql}`,
        params
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const userIdParamIdx = params.length + 1;
      const limitParamIdx = params.length + 2;
      const offsetParamIdx = params.length + 3;

      const listRes = await db.query<{
        group_id: string;
        course_id: string;
        course_code: string;
        course_name: string;
        title: string;
        semester: string;
        academic_year: number;
        description: string | null;
        status: ClassGroupStatus;
        created_at: Date | string;
        updated_at: Date | string;
        members_count: string;
        is_member: boolean;
      }>(
        `SELECT cg.group_id, cg.course_id,
                c.course_code, c.course_name,
                cg.title, cg.semester, cg.academic_year, cg.description, cg.status,
                cg.created_at, cg.updated_at,
                (SELECT COUNT(*)::text FROM class_group_members m WHERE m.group_id = cg.group_id) AS members_count,
                EXISTS (
                  SELECT 1 FROM class_group_members m2
                  WHERE m2.group_id = cg.group_id AND m2.user_id = $${userIdParamIdx}
                ) AS is_member
         FROM class_group cg
         INNER JOIN courses c ON c.course_id = cg.course_id
         ${whereSql}
         ORDER BY c.course_code ASC, cg.created_at DESC
         LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
        [...params, userId, limit, offset]
      );

      const groups = listRes.rows.map((g) => ({
        groupId: g.group_id,
        courseId: g.course_id,
        courseCode: g.course_code,
        courseName: g.course_name,
        title: g.title,
        semester: g.semester,
        academicYear: g.academic_year,
        description: g.description,
        status: g.status,
        membersCount: Number(g.members_count ?? 0),
        isMember: Boolean(g.is_member),
        createdAt: new Date(g.created_at).toISOString(),
        updatedAt: new Date(g.updated_at).toISOString(),
      }));

      return sendPaginated(res, groups, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

classGroupsRouter.get(
  '/:groupId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const userId = req.user!.userId;

      const resGroup = await db.query<{
        group_id: string;
        course_id: string;
        course_code: string;
        course_name: string;
        title: string;
        semester: string;
        academic_year: number;
        description: string | null;
        status: ClassGroupStatus;
        created_at: Date | string;
        updated_at: Date | string;
        members_count: string;
        is_member: boolean;
      }>(
        `SELECT cg.group_id, cg.course_id,
                c.course_code, c.course_name,
                cg.title, cg.semester, cg.academic_year, cg.description, cg.status,
                cg.created_at, cg.updated_at,
                (SELECT COUNT(*)::text FROM class_group_members m WHERE m.group_id = cg.group_id) AS members_count,
                EXISTS (
                  SELECT 1 FROM class_group_members m2
                  WHERE m2.group_id = cg.group_id AND m2.user_id = $2
                ) AS is_member
         FROM class_group cg
         INNER JOIN courses c ON c.course_id = cg.course_id
         WHERE cg.group_id = $1`,
        [groupId, userId]
      );

      if (resGroup.rowCount === 0) {
        throw new NotFoundError('Class group not found.');
      }

      const g = resGroup.rows[0];
      return sendSuccess(res, {
        groupId: g.group_id,
        courseId: g.course_id,
        courseCode: g.course_code,
        courseName: g.course_name,
        title: g.title,
        semester: g.semester,
        academicYear: g.academic_year,
        description: g.description,
        status: g.status,
        membersCount: Number(g.members_count ?? 0),
        isMember: Boolean(g.is_member),
        createdAt: new Date(g.created_at).toISOString(),
        updatedAt: new Date(g.updated_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

classGroupsRouter.post(
  '/',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  validate({ body: createClassGroupSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, title, semester, academicYear, description } = req.body;

      const courseRes = await db.query<{
        course_id: string;
        course_code: string;
        course_name: string;
      }>(
        'SELECT course_id, course_code, course_name FROM courses WHERE course_id = $1',
        [courseId]
      );
      if (courseRes.rowCount === 0) {
        throw new ValidationError('Course does not exist.', [
          { field: 'courseId', issue: 'Course ID not found' },
        ]);
      }

      const inserted = await db.query<{
        group_id: string;
        course_id: string;
        title: string;
        semester: string;
        academic_year: number;
        description: string | null;
        status: ClassGroupStatus;
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `INSERT INTO class_group (course_id, created_by, title, semester, academic_year, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
         RETURNING group_id, course_id, title, semester, academic_year, description, status, created_at, updated_at`,
        [
          courseId,
          req.user!.userId,
          title,
          semester,
          academicYear,
          description ?? null,
        ]
      );

      const g = inserted.rows[0];
      const c = courseRes.rows[0];
      return sendCreated(res, {
        groupId: g.group_id,
        courseId: g.course_id,
        courseCode: c.course_code,
        courseName: c.course_name,
        title: g.title,
        semester: g.semester,
        academicYear: g.academic_year,
        description: g.description,
        status: g.status,
        membersCount: 0,
        isMember: false,
        createdAt: new Date(g.created_at).toISOString(),
        updatedAt: new Date(g.updated_at).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/class-groups/:groupId/join
classGroupsRouter.post(
  '/:groupId/join',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const userId = req.user!.userId;

      const groupCheck = await db.query<{
        group_id: string;
        status: ClassGroupStatus;
      }>('SELECT group_id, status FROM class_group WHERE group_id = $1', [
        groupId,
      ]);

      if (groupCheck.rowCount === 0) {
        throw new NotFoundError('Class group not found.');
      }

      if (groupCheck.rows[0].status !== 'ACTIVE') {
        throw new ConflictError('Cannot join an archived class group.');
      }

      const existing = await db.query<{ membership_id: string }>(
        `SELECT membership_id
         FROM class_group_members
         WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );

      if (existing.rowCount > 0) {
        return sendSuccess(
          res,
          {
            membershipId: existing.rows[0].membership_id,
            groupId,
            userId,
            memberRole: 'MEMBER',
          },
          200,
          'Successfully joined class group.'
        );
      }

      const inserted = await db.query<{
        membership_id: string;
        group_id: string;
        user_id: string;
        member_role: string;
        joined_at: Date | string;
      }>(
        `INSERT INTO class_group_members (group_id, user_id, member_role)
         VALUES ($1, $2, 'MEMBER')
         RETURNING membership_id, group_id, user_id, member_role, joined_at`,
        [groupId, userId]
      );

      const m = inserted.rows[0];
      return sendSuccess(
        res,
        {
          membershipId: m.membership_id,
          groupId: m.group_id,
          userId: m.user_id,
          memberRole: m.member_role,
          joinedAt: new Date(m.joined_at).toISOString(),
        },
        200,
        'Successfully joined class group.'
      );
    } catch (err) {
      next(err);
    }
  }
);

// Leave class group (supports both DELETE and POST /api/v1/class-groups/:groupId/leave)
const leaveClassGroupHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.userId;

    const deleted = await db.query(
      `DELETE FROM class_group_members
       WHERE group_id = $1 AND user_id = $2
       RETURNING membership_id`,
      [groupId, userId]
    );

    if (deleted.rowCount === 0) {
      throw new NotFoundError('You are not a member of this class group.');
    }

    return sendSuccess(
      res,
      { groupId, left: true },
      200,
      'Successfully left class group.'
    );
  } catch (err) {
    next(err);
  }
};

classGroupsRouter.delete(
  '/:groupId/leave',
  authenticate,
  leaveClassGroupHandler
);
classGroupsRouter.post('/:groupId/leave', authenticate, leaveClassGroupHandler);

// GET /api/v1/class-groups/:groupId/members
classGroupsRouter.get(
  '/:groupId/members',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const { page, limit, offset } = parsePaginationParams(
        req.query as Record<string, unknown>,
        30
      );

      const groupCheck = await db.query(
        'SELECT group_id FROM class_group WHERE group_id = $1',
        [groupId]
      );
      if (groupCheck.rowCount === 0) {
        throw new NotFoundError('Class group not found.');
      }

      const countRes = await db.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM class_group_members WHERE group_id = $1',
        [groupId]
      );
      const totalCount = Number(countRes.rows[0]?.count ?? 0);

      const listRes = await db.query<{
        membership_id: string;
        group_id: string;
        user_id: string;
        member_role: string;
        joined_at: Date | string;
        full_name: string;
        username: string;
        avatar_url: string | null;
        is_verified: boolean;
      }>(
        `SELECT m.membership_id, m.group_id, m.user_id, m.member_role, m.joined_at,
                p.full_name, p.username, p.avatar_url,
                u.is_verified
         FROM class_group_members m
         INNER JOIN users u ON u.user_id = m.user_id
         INNER JOIN profiles p ON p.user_id = m.user_id
         WHERE m.group_id = $1
         ORDER BY m.joined_at ASC
         LIMIT $2 OFFSET $3`,
        [groupId, limit, offset]
      );

      const members = listRes.rows.map((m) => ({
        membershipId: m.membership_id,
        groupId: m.group_id,
        userId: m.user_id,
        fullName: m.full_name,
        username: m.username,
        avatarUrl: m.avatar_url,
        isVerified: m.is_verified,
        memberRole: m.member_role,
        joinedAt: new Date(m.joined_at).toISOString(),
      }));

      return sendPaginated(res, members, page, limit, totalCount);
    } catch (err) {
      next(err);
    }
  }
);

