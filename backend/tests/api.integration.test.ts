import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/config/db.js';
import { seedDatabase, SEED_IDS } from '../src/database/seed.js';

describe('Almaarefa Network Backend API — Complete Integration Test Suite', () => {
  let studentAccessToken = '';
  let studentRefreshToken = '';
  let registeredUserId = '';
  let adminAccessToken = '';
  let leaderAccessToken = '';
  let sarahAccessToken = '';

  let verificationRequestId = '';
  let createdClubRequestId = '';
  let approvedClubId = '';
  let clubJoinRequestId = '';
  let createdEventId = '';
  let createdPostId = '';
  let createdCommentId = '';
  let createdReportId = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await db.resetForTests();
    await seedDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  // ==========================================================================
  // 1. HEALTH & INFRASTRUCTURE
  // ==========================================================================
  describe('1. Health & Standard Error Envelopes', () => {
    it('GET /api/v1/health returns 200 OK with service status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });

    it('Unknown route returns 404 Not Found in standard error envelope', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('does not exist'),
        },
      });
    });
  });

  // ==========================================================================
  // 2. AUTHENTICATION & ACCOUNT MANAGEMENT
  // ==========================================================================
  describe('2. Authentication & Account Management (/api/v1/auth)', () => {
    it('Rejects registration with non-Almaarefa University email (@gmail.com) with 422 VALIDATION_FAILED', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        universityEmail: 'outsider@gmail.com',
        password: 'StrongPassword123!',
        fullName: 'External User',
        studentId: '202199999',
        departmentId: SEED_IDS.deptCs,
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'universityEmail',
            issue: 'Email must belong to @mcst.edu.sa domain',
          }),
        ])
      );
    });

    it('Registers a new student with @mcst.edu.sa email and returns 201 Created matching contract', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        universityEmail: 's123456@mcst.edu.sa',
        password: 'StrongPassword123!',
        fullName: 'Turki Al-Harbi',
        studentId: '202110234',
        departmentId: SEED_IDS.deptCs,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        universityEmail: 's123456@mcst.edu.sa',
        role: 'STUDENT',
        emailVerified: false,
        isVerified: false,
        profile: {
          fullName: 'Turki Al-Harbi',
          studentId: '202110234',
          username: 's123456',
        },
      });
      registeredUserId = res.body.data.userId;
      expect(registeredUserId).toBeTruthy();
    });

    it('Rejects duplicate email or studentId with 409 Conflict', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        universityEmail: 's123456@mcst.edu.sa',
        password: 'StrongPassword123!',
        fullName: 'Turki Duplicate',
        studentId: '202110999',
        departmentId: SEED_IDS.deptCs,
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Rejects invalid login password with 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        universityEmail: 's123456@mcst.edu.sa',
        password: 'WrongPassword999!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('Logs in registered student and seeded accounts (Admin, Club Leader, Sarah) returning JWT tokens', async () => {
      const studentRes = await request(app).post('/api/v1/auth/login').send({
        universityEmail: 's123456@mcst.edu.sa',
        password: 'StrongPassword123!',
      });

      expect(studentRes.status).toBe(200);
      expect(studentRes.body.success).toBe(true);
      expect(studentRes.body.data.accessToken).toBeTruthy();
      expect(studentRes.body.data.refreshToken).toBeTruthy();
      expect(studentRes.body.data.expiresIn).toBe(3600);
      expect(studentRes.body.data.user).toMatchObject({
        userId: registeredUserId,
        email: 's123456@mcst.edu.sa',
        role: 'STUDENT',
        isVerified: false,
        profile: {
          fullName: 'Turki Al-Harbi',
          username: 's123456',
          departmentName: 'Computer Science',
        },
      });

      studentAccessToken = studentRes.body.data.accessToken;
      studentRefreshToken = studentRes.body.data.refreshToken;

      const adminRes = await request(app).post('/api/v1/auth/login').send({
        universityEmail: 'admin@mcst.edu.sa',
        password: 'AdminPassword123!',
      });
      expect(adminRes.status).toBe(200);
      adminAccessToken = adminRes.body.data.accessToken;

      const leaderRes = await request(app).post('/api/v1/auth/login').send({
        universityEmail: 'leader@mcst.edu.sa',
        password: 'LeaderPassword123!',
      });
      expect(leaderRes.status).toBe(200);
      leaderAccessToken = leaderRes.body.data.accessToken;

      const sarahRes = await request(app).post('/api/v1/auth/login').send({
        universityEmail: 'sarah@mcst.edu.sa',
        password: 'StrongPassword123!',
      });
      expect(sarahRes.status).toBe(200);
      sarahAccessToken = sarahRes.body.data.accessToken;
    });

    it('Refreshes access token via POST /api/v1/auth/refresh-token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: studentRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.expiresIn).toBe(3600);
    });

    it('Fetches current user context via GET /api/v1/auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(registeredUserId);
      expect(res.body.data.profile.fullName).toBe('Turki Al-Harbi');
    });
  });

  // ==========================================================================
  // 3. STUDENT PROFILE & VERIFICATION
  // ==========================================================================
  describe('3. Student Profile & Verification (/api/v1/profiles, /api/v1/verification)', () => {
    it('Fetches public student profile via GET /api/v1/profiles/:userId', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${registeredUserId}`)
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        userId: registeredUserId,
        fullName: 'Turki Al-Harbi',
        username: 's123456',
        department: {
          departmentId: SEED_IDS.deptCs,
          name: 'Computer Science',
          code: 'CS',
        },
        isVerified: false,
      });
    });

    it('Updates student profile via PATCH /api/v1/profiles/me', async () => {
      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          fullName: 'Turki K. Al-Harbi',
          bio: 'Senior Computer Science student passionate about AI and mobile dev.',
          avatarUrl: 'https://storage.almaarefa.edu/avatars/user-123.png',
          username: 'turki_cs',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        userId: registeredUserId,
        fullName: 'Turki K. Al-Harbi',
        username: 'turki_cs',
        bio: 'Senior Computer Science student passionate about AI and mobile dev.',
        avatarUrl: 'https://storage.almaarefa.edu/avatars/user-123.png',
      });
    });

    it('Submits student verification proof via POST /api/v1/verification/submit', async () => {
      const res = await request(app)
        .post('/api/v1/verification/submit')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          submittedStudentId: '202110234',
          proofDocumentUrl:
            'https://storage.almaarefa.edu/proofs/proof-uuid.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'PENDING',
        submittedStudentId: '202110234',
      });
      verificationRequestId = res.body.data.requestId;
      expect(verificationRequestId).toBeTruthy();
    });

    it('Admin approves student verification request and marks student as verified', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/verifications/${verificationRequestId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          status: 'APPROVED',
          reviewerNote: 'Valid Almaarefa University ID verified.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');

      const statusRes = await request(app)
        .get('/api/v1/verification/status')
        .set('Authorization', `Bearer ${studentAccessToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isVerified).toBe(true);
      expect(statusRes.body.data.latestRequest.status).toBe('APPROVED');
    });
  });

  // ==========================================================================
  // 4. ACADEMIC STRUCTURE & CLASS GROUPS
  // ==========================================================================
  describe('4. Academic Structure & Class Groups (/api/v1/departments, /api/v1/courses, /api/v1/class-groups)', () => {
    it('Lists academic departments via GET /api/v1/departments', async () => {
      const res = await request(app).get('/api/v1/departments');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            departmentId: SEED_IDS.deptCs,
            name: 'Computer Science',
            code: 'CS',
          }),
        ])
      );
    });

    it('Lists courses filtered by departmentId via GET /api/v1/courses', async () => {
      const res = await request(app)
        .get(`/api/v1/courses?departmentId=${SEED_IDS.deptCs}`)
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            courseCode: 'CS312',
            courseName: 'Database Systems',
          }),
        ])
      );
    });

    it('Lists paginated class groups and allows student to join & view members', async () => {
      const listRes = await request(app)
        .get('/api/v1/class-groups?semester=Fall%202026&page=1&limit=10')
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.meta).toMatchObject({
        page: 1,
        limit: 10,
      });

      const joinRes = await request(app)
        .post(`/api/v1/class-groups/${SEED_IDS.classGroupCs312}/join`)
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.success).toBe(true);
      expect(joinRes.body.message).toBe('Successfully joined class group.');

      const membersRes = await request(app)
        .get(`/api/v1/class-groups/${SEED_IDS.classGroupCs312}/members`)
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(membersRes.status).toBe(200);
      expect(membersRes.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // 5. STUDENT CLUBS & CAMPUS EVENTS
  // ==========================================================================
  describe('5. Student Clubs & Campus Events (/api/v1/clubs, /api/v1/events)', () => {
    it('Lists active clubs via GET /api/v1/clubs', async () => {
      const res = await request(app)
        .get('/api/v1/clubs?category=Technology')
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            clubId: SEED_IDS.clubAi,
            name: 'AI & Robotics Club',
            category: 'Technology',
          }),
        ])
      );
    });

    it('Submits a new club creation proposal and Admin approves it', async () => {
      const reqRes = await request(app)
        .post('/api/v1/clubs/request')
        .set('Authorization', `Bearer ${sarahAccessToken}`)
        .send({
          proposedName: 'Google Developer Student Club (GDSC)',
          category: 'Technology',
          description:
            'Empowering students through technology and hands-on workshops.',
          proposalFileUrl:
            'https://storage.almaarefa.edu/proposals/gdsc-proposal.pdf',
        });

      expect(reqRes.status).toBe(201);
      expect(reqRes.body.data.status).toBe('PENDING');
      createdClubRequestId = reqRes.body.data.requestId;

      const approveRes = await request(app)
        .patch(`/api/v1/admin/club-requests/${createdClubRequestId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          status: 'APPROVED',
          reviewNote: 'Approved for Fall 2026 semester.',
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');
      expect(approveRes.body.data.createdClubId).toBeTruthy();
      approvedClubId = approveRes.body.data.createdClubId;
    });

    it('Student requests to join a club and Club Leader approves membership', async () => {
      const joinRes = await request(app)
        .post(`/api/v1/clubs/${SEED_IDS.clubAi}/join`)
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(joinRes.status).toBe(201);
      expect(joinRes.body.data.status).toBe('PENDING');
      clubJoinRequestId = joinRes.body.data.requestId;

      const approveJoinRes = await request(app)
        .patch(
          `/api/v1/clubs/${SEED_IDS.clubAi}/join-requests/${clubJoinRequestId}`
        )
        .set('Authorization', `Bearer ${leaderAccessToken}`)
        .send({
          status: 'APPROVED',
          reviewNote: 'Welcome to the AI & Robotics Club!',
        });

      expect(approveJoinRes.status).toBe(200);
      expect(approveJoinRes.body.data.status).toBe('APPROVED');
    });

    it('Publishes a campus event, fetches calendar feed, and toggles student RSVP', async () => {
      const createEvRes = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${leaderAccessToken}`)
        .send({
          clubId: SEED_IDS.clubAi,
          title: 'Campus Hackathon 2026 Kickoff',
          description: 'Annual 24-hour coding competition for Almaarefa students.',
          location: 'Main Innovation Lab',
          startTime: '2026-11-25T09:00:00.000Z',
          endTime: '2026-11-25T17:00:00.000Z',
        });

      expect(createEvRes.status).toBe(201);
      createdEventId = createEvRes.body.data.eventId;

      const rsvpRes = await request(app)
        .post(`/api/v1/events/${createdEventId}/rsvp`)
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(rsvpRes.status).toBe(200);
      expect(rsvpRes.body.data).toMatchObject({
        eventId: createdEventId,
        hasRsvp: true,
        rsvpCount: 1,
      });

      const eventsRes = await request(app)
        .get('/api/v1/events?from=2026-11-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z')
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(eventsRes.status).toBe(200);
      expect(eventsRes.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventId: SEED_IDS.eventAiWorkshop,
            title: 'Introduction to AI & Deep Learning Workshop',
            club: {
              clubId: SEED_IDS.clubAi,
              name: 'AI & Robotics Club',
              logoUrl: 'https://storage.almaarefa.edu/clubs/ai.png',
            },
          }),
          expect.objectContaining({
            eventId: createdEventId,
            title: 'Campus Hackathon 2026 Kickoff',
            hasRsvp: true,
            rsvpCount: 1,
          }),
        ])
      );
    });
  });

  // ==========================================================================
  // 6. POSTS, ACADEMIC COLLABORATION, COMMENTS & REACTIONS
  // ==========================================================================
  describe('6. Posts, Academic Collaboration & Comments (/api/v1/posts)', () => {
    it('Creates a post in a class group with document attachment via POST /api/v1/posts', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          postType: 'ACADEMIC',
          clubId: null,
          classGroupId: SEED_IDS.classGroupCs312,
          content: 'Here is the summary notes for Lecture 4 on Normalization (3NF & BCNF).',
          attachments: [
            {
              type: 'DOCUMENT',
              url: 'https://storage.almaarefa.edu/files/lecture4-summary.pdf',
              name: 'Lecture4_Summary.pdf',
              sizeBytes: 204850,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        author: {
          userId: registeredUserId,
          fullName: 'Turki K. Al-Harbi',
          username: 'turki_cs',
          isVerified: true,
        },
        classGroupId: SEED_IDS.classGroupCs312,
        postType: 'ACADEMIC',
        content:
          'Here is the summary notes for Lecture 4 on Normalization (3NF & BCNF).',
        attachments: [
          {
            type: 'DOCUMENT',
            url: 'https://storage.almaarefa.edu/files/lecture4-summary.pdf',
            name: 'Lecture4_Summary.pdf',
            sizeBytes: 204850,
          },
        ],
        stats: {
          likesCount: 0,
          commentsCount: 0,
          hasLiked: false,
        },
        moderationStatus: 'APPROVED',
      });

      createdPostId = res.body.data.postId;
    });

    it('Fetches class_group feed and supports in-course keyword search via GET /api/v1/posts', async () => {
      const feedRes = await request(app)
        .get(
          `/api/v1/posts?feedType=class_group&targetId=${SEED_IDS.classGroupCs312}&page=1&limit=10`
        )
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(feedRes.status).toBe(200);
      expect(feedRes.body.data.length).toBeGreaterThanOrEqual(2);
      expect(feedRes.body.meta).toMatchObject({
        page: 1,
        limit: 10,
      });

      // In-Course Search
      const searchRes = await request(app)
        .get(
          `/api/v1/posts?feedType=class_group&targetId=${SEED_IDS.classGroupCs312}&search=Normalization`
        )
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.length).toBe(1);
      expect(searchRes.body.data[0].postId).toBe(createdPostId);
    });

    it('Adds a comment via POST /api/v1/posts/:postId/comments and increments commentsCount', async () => {
      const commentRes = await request(app)
        .post(`/api/v1/posts/${createdPostId}/comments`)
        .set('Authorization', `Bearer ${sarahAccessToken}`)
        .send({
          content: 'Thank you so much! Really helpful for the upcoming quiz.',
        });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.data.content).toBe(
        'Thank you so much! Really helpful for the upcoming quiz.'
      );
      createdCommentId = commentRes.body.data.commentId;
      expect(createdCommentId).toBeTruthy();

      const postRes = await request(app)
        .get(`/api/v1/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${studentAccessToken}`);
      expect(postRes.body.data.stats.commentsCount).toBe(1);
    });

    it('Reacts to a post via POST /api/v1/posts/:postId/reactions', async () => {
      const reactRes = await request(app)
        .post(`/api/v1/posts/${createdPostId}/reactions`)
        .set('Authorization', `Bearer ${sarahAccessToken}`)
        .send({
          reactionType: 'LIKE',
        });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data).toMatchObject({
        postId: createdPostId,
        reactionType: 'LIKE',
        hasLiked: true,
        likesCount: 1,
      });
    });
  });

  // ==========================================================================
  // 7. CONTENT MODERATION, REPORTING & AUDIT LOGS
  // ==========================================================================
  describe('7. Content Moderation & Reporting (/api/v1/reports, /api/v1/admin)', () => {
    it('Blocks non-admin users from accessing /api/v1/admin/reports with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Flags a post via POST /api/v1/reports and Admin deletes it via POST /api/v1/admin/moderation/action', async () => {
      // Create a spam post to report
      const spamPostRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          postType: 'GENERAL',
          content: 'Buy cheap commercial products at spam-link.example.com!',
        });
      const spamPostId = spamPostRes.body.data.postId;

      // Student reports the post
      const reportRes = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${sarahAccessToken}`)
        .send({
          postId: spamPostId,
          reason: 'SPAM',
          description: 'Unauthorized commercial advertising link posted.',
        });

      expect(reportRes.status).toBe(201);
      expect(reportRes.body.data.status).toBe('PENDING');
      createdReportId = reportRes.body.data.reportId;

      // Admin lists pending reports
      const adminReportsRes = await request(app)
        .get('/api/v1/admin/reports?status=PENDING')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(adminReportsRes.status).toBe(200);
      expect(adminReportsRes.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reportId: createdReportId,
            postId: spamPostId,
            reason: 'SPAM',
          }),
        ])
      );

      // Admin executes DELETE_POST moderation action
      const actionRes = await request(app)
        .post('/api/v1/admin/moderation/action')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reportId: createdReportId,
          postId: spamPostId,
          actionType: 'DELETE_POST',
          reason: 'Violated campus community academic standards.',
          suspendUser: false,
        });

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.data.actionType).toBe('DELETE_POST');

      // Verify deleted post is no longer accessible
      const deletedCheck = await request(app)
        .get(`/api/v1/posts/${spamPostId}`)
        .set('Authorization', `Bearer ${studentAccessToken}`);
      expect(deletedCheck.status).toBe(404);

      // Verify audit log was recorded
      const auditRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // 8. FILE UPLOADS & NOTIFICATIONS
  // ==========================================================================
  describe('8. Presigned File Uploads & Smart Notifications (/api/v1/uploads, /api/v1/notifications)', () => {
    it('Rejects unsafe executable file extensions on POST /api/v1/uploads/presigned-url', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presigned-url')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          fileName: 'malware.exe',
          fileType: 'application/octet-stream',
          category: 'attachment',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('Generates a presigned upload ticket and accepts binary PUT upload', async () => {
      const ticketRes = await request(app)
        .post('/api/v1/uploads/presigned-url')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          fileName: 'student-id.jpg',
          fileType: 'image/jpeg',
          category: 'verification',
          sizeBytes: 1024,
        });

      expect(ticketRes.status).toBe(201);
      expect(ticketRes.body.data.uploadId).toBeTruthy();
      expect(ticketRes.body.data.uploadUrl).toContain('/api/v1/uploads/put/');
      expect(ticketRes.body.data.publicUrl).toContain('/uploads/verification/');

      const uploadId = ticketRes.body.data.uploadId;
      const putRes = await request(app)
        .put(`/api/v1/uploads/put/${uploadId}`)
        .set('Content-Type', 'image/jpeg')
        .send(Buffer.from('fake-jpeg-binary-content'));

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.sizeBytes).toBeGreaterThan(0);
    });

    it('Retrieves student notifications and updates notification preferences', async () => {
      const notifRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${studentAccessToken}`);

      expect(notifRes.status).toBe(200);
      expect(notifRes.body.data.length).toBeGreaterThanOrEqual(2);

      const prefsRes = await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          emailNotifications: true,
          pushNotifications: false,
          threadReplies: true,
        });

      expect(prefsRes.status).toBe(200);
      expect(prefsRes.body.data.pushNotifications).toBe(false);

      const markAllRes = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${studentAccessToken}`);
      expect(markAllRes.status).toBe(200);
      expect(markAllRes.body.data.markedAllRead).toBe(true);
    });
  });

  // ==========================================================================
  // 9. ADVANCED EDGE CASES, RBAC, CLUB FEEDBACK & ACCOUNT GOVERNANCE
  // ==========================================================================
  describe('9. Edge Cases, Club Feedback, Ownership & Account Governance', () => {
    it('Submits anonymous club feedback and hides student identity when viewed by Club Leader', async () => {
      const fbRes = await request(app)
        .post(`/api/v1/clubs/${SEED_IDS.clubAi}/feedback`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          rating: 5,
          comment: 'Awesome workshop! Would love more PyTorch hands-on labs.',
          isAnonymous: true,
        });

      expect(fbRes.status).toBe(201);
      expect(fbRes.body.data.isAnonymous).toBe(true);

      const listFbRes = await request(app)
        .get(`/api/v1/clubs/${SEED_IDS.clubAi}/feedback`)
        .set('Authorization', `Bearer ${leaderAccessToken}`);

      expect(listFbRes.status).toBe(200);
      expect(listFbRes.body.data[0].author).toBeNull();
      expect(listFbRes.body.data[0].rating).toBe(5);
    });

    it('Prevents a user from editing another student post (403) and allows comment deletion', async () => {
      const forbiddenEdit = await request(app)
        .patch(`/api/v1/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${sarahAccessToken}`)
        .send({ content: 'Unauthorized edit attempt' });

      expect(forbiddenEdit.status).toBe(403);

      const delComment = await request(app)
        .delete(`/api/v1/posts/${createdPostId}/comments/${createdCommentId}`)
        .set('Authorization', `Bearer ${sarahAccessToken}`);

      expect(delComment.status).toBe(200);
      expect(delComment.body.data.deleted).toBe(true);
    });

    it('Admin suspends and reactivates user account & retrieves platform stats', async () => {
      const statsRes = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalUsers).toBeGreaterThanOrEqual(5);

      // Suspend student account
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${registeredUserId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ isActive: false, reason: 'Temporary policy review' });
      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.isActive).toBe(false);

      // Suspended user cannot access protected endpoints
      const blockedMe = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${studentAccessToken}`);
      expect(blockedMe.status).toBe(403);
      expect(blockedMe.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // Reactivate student account
      const reactivateRes = await request(app)
        .patch(`/api/v1/admin/users/${registeredUserId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ isActive: true, reason: 'Review complete' });
      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.isActive).toBe(true);

      // Access is restored
      const restoredMe = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${studentAccessToken}`);
      expect(restoredMe.status).toBe(200);
    });

    it('Logs out user and revokes refresh token', async () => {
      const loginAgain = await request(app).post('/api/v1/auth/login').send({
        universityEmail: 's123456@mcst.edu.sa',
        password: 'StrongPassword123!',
      });
      const freshAccess = loginAgain.body.data.accessToken;
      const freshRefresh = loginAgain.body.data.refreshToken;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${freshAccess}`)
        .send({ refreshToken: freshRefresh });
      expect(logoutRes.status).toBe(200);

      const refreshAfterLogout = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: freshRefresh });
      expect(refreshAfterLogout.status).toBe(401);
      expect(refreshAfterLogout.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
});
