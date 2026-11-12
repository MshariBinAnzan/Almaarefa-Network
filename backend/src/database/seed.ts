import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/db.js';
import { notificationsService } from '../modules/notifications/notifications.service.js';

export const SEED_IDS = {
  deptCs: '4a7b53e8-5d22-4e08-9df5-bc65476d05ea',
  deptIs: '5b8c64f9-6e33-4f19-8ef6-cd76587e16fb',
  deptMed: '6c9d75a0-7f44-4a20-9fa7-de87698f27ac',
  deptPharm: '7d0e86b1-8a55-4b31-8ab8-ef98709a38bd',
  courseCs312: '11223344-5566-4777-8888-99aabbccddee',
  courseCs401: '22334455-6677-4888-9999-aabbccddeeff',
  courseIs210: '33445566-7788-4999-aaaa-bbccddeeff00',
  classGroupCs312: '762f033a-d68a-4db3-a9d9-06395b2d5fc2',
  classGroupCs401: '873a144b-e79b-4ec4-b0ea-17406c3e6ad3',
  userAdmin: '10000000-0000-4000-8000-000000000001',
  userLeader: '10000000-0000-4000-8000-000000000002',
  userSarah: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  userDemoStudent: '10000000-0000-4000-8000-000000000004',
  clubAi: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  clubCyber: 'a12efc5e-4c8e-4cbe-8cee-3c1e8c4edc7e',
  eventAiWorkshop: 'f512762a-ecff-4b31-90a8-b67dbec14331',
  postAcademicCs312: 'd2a0d922-1264-42b7-a3cf-73fc34dcbeea',
};

export async function seedDatabase(): Promise<void> {
  await db.init();
  await db.runMigrations();

  // Check if already seeded
  const existingDepts = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM departments'
  );
  if (Number(existingDepts.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const adminPass = await bcrypt.hash('AdminPassword123!', 10);
  const leaderPass = await bcrypt.hash('LeaderPassword123!', 10);
  const studentPass = await bcrypt.hash('StrongPassword123!', 10);

  await db.withTransaction(async (tx) => {
    // 1. Academic Departments
    await tx.query(
      `INSERT INTO departments (department_id, name, code, description)
       VALUES
         ($1, 'Computer Science', 'CS', 'Department of Computer Science and Artificial Intelligence at Almaarefa University'),
         ($2, 'Information Systems', 'IS', 'Department of Information Systems and Data Analytics'),
         ($3, 'Medicine & Surgery', 'MED', 'College of Medicine at Almaarefa University'),
         ($4, 'Doctor of Pharmacy', 'PHARM', 'College of Pharmacy at Almaarefa University')
       ON CONFLICT (code) DO NOTHING`,
      [
        SEED_IDS.deptCs,
        SEED_IDS.deptIs,
        SEED_IDS.deptMed,
        SEED_IDS.deptPharm,
      ]
    );

    // 2. Courses
    await tx.query(
      `INSERT INTO courses (course_id, department_id, course_code, course_name, credit_hours)
       VALUES
         ($1, $4, 'CS312', 'Database Systems', 3),
         ($2, $4, 'CS401', 'Software Engineering & Architecture', 3),
         ($3, $5, 'IS210', 'Systems Analysis and Design', 3)
       ON CONFLICT (course_code) DO NOTHING`,
      [
        SEED_IDS.courseCs312,
        SEED_IDS.courseCs401,
        SEED_IDS.courseIs210,
        SEED_IDS.deptCs,
        SEED_IDS.deptIs,
      ]
    );

    // 3. Users & Profiles
    await tx.query(
      `INSERT INTO users (user_id, university_email, password_hash, role, email_verified, is_verified, is_active)
       VALUES
         ($1, 'admin@mcst.edu.sa', $5, 'ADMIN', TRUE, TRUE, TRUE),
         ($2, 'leader@mcst.edu.sa', $6, 'CLUB_LEADER', TRUE, TRUE, TRUE),
         ($3, 'sarah@mcst.edu.sa', $7, 'STUDENT', TRUE, TRUE, TRUE),
         ($4, 'student@mcst.edu.sa', $7, 'STUDENT', TRUE, TRUE, TRUE)
       ON CONFLICT (university_email) DO NOTHING`,
      [
        SEED_IDS.userAdmin,
        SEED_IDS.userLeader,
        SEED_IDS.userSarah,
        SEED_IDS.userDemoStudent,
        adminPass,
        leaderPass,
        studentPass,
      ]
    );

    await tx.query(
      `INSERT INTO profiles (user_id, department_id, student_id, full_name, username, avatar_url, bio, academic_year)
       VALUES
         ($1, $5, 'ADMIN-001', 'Campus System Administrator', 'admin_mcst', NULL, 'Almaarefa Network Platform Governance & Support', 4),
         ($2, $5, '202010111', 'Faisal Al-Otaibi', 'faisal_ai', 'https://storage.almaarefa.edu/avatars/faisal.png', 'President of AI & Robotics Club at Almaarefa University.', 4),
         ($3, $5, '202110555', 'Sarah Al-Ghamdi', 'sarah_g', 'https://storage.almaarefa.edu/avatars/sarah.jpg', 'Senior Computer Science student passionate about databases and backend systems.', 4),
         ($4, $5, '202210888', 'Mohammed Al-Qahtani', 'mohammed_cs', 'https://storage.almaarefa.edu/avatars/mohammed.png', 'Computer Science student at Almaarefa University.', 3)
       ON CONFLICT (user_id) DO NOTHING`,
      [
        SEED_IDS.userAdmin,
        SEED_IDS.userLeader,
        SEED_IDS.userSarah,
        SEED_IDS.userDemoStudent,
        SEED_IDS.deptCs,
      ]
    );

    for (const uid of [
      SEED_IDS.userAdmin,
      SEED_IDS.userLeader,
      SEED_IDS.userSarah,
      SEED_IDS.userDemoStudent,
    ]) {
      await notificationsService.ensurePreferences(uid, tx);
    }

    // 4. Class Groups & Memberships
    await tx.query(
      `INSERT INTO class_group (group_id, course_id, created_by, title, semester, academic_year, description, status)
       VALUES
         ($1, $3, $5, 'CS312 - Database Systems (Fall 2026)', 'Fall 2026', 2026, 'Official course community for CS312 Database Systems. Share lecture summaries, SQL labs, and past exam discussions.', 'ACTIVE'),
         ($2, $4, $5, 'CS401 - Software Engineering (Fall 2026)', 'Fall 2026', 2026, 'Official discussion group for Software Engineering & Architecture.', 'ACTIVE')
       ON CONFLICT (course_id) DO NOTHING`,
      [
        SEED_IDS.classGroupCs312,
        SEED_IDS.classGroupCs401,
        SEED_IDS.courseCs312,
        SEED_IDS.courseCs401,
        SEED_IDS.userAdmin,
      ]
    );

    await tx.query(
      `INSERT INTO class_group_members (group_id, user_id, member_role)
       VALUES
         ($1, $2, 'MEMBER'),
         ($1, $3, 'MEMBER')
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [SEED_IDS.classGroupCs312, SEED_IDS.userSarah, SEED_IDS.userDemoStudent]
    );

    // 5. Clubs & Memberships
    await tx.query(
      `INSERT INTO clubs (club_id, created_by, name, category, description, logo_url, status)
       VALUES
         ($1, $3, 'AI & Robotics Club', 'Technology', 'Exploring artificial intelligence, machine learning, and robotics projects at Almaarefa University.', 'https://storage.almaarefa.edu/clubs/ai.png', 'ACTIVE'),
         ($2, $3, 'Cybersecurity & Ethical Hacking Club', 'Technology', 'Hands-on CTF training, network defense workshops, and security awareness on campus.', 'https://storage.almaarefa.edu/clubs/cyber.png', 'ACTIVE')
       ON CONFLICT (name) DO NOTHING`,
      [SEED_IDS.clubAi, SEED_IDS.clubCyber, SEED_IDS.userLeader]
    );

    await tx.query(
      `INSERT INTO club_members (club_id, user_id, member_role, status)
       VALUES
         ($1, $2, 'PRESIDENT', 'ACTIVE'),
         ($1, $3, 'MEMBER', 'ACTIVE'),
         ($4, $2, 'PRESIDENT', 'ACTIVE')
       ON CONFLICT (club_id, user_id) DO NOTHING`,
      [
        SEED_IDS.clubAi,
        SEED_IDS.userLeader,
        SEED_IDS.userSarah,
        SEED_IDS.clubCyber,
      ]
    );

    // 6. Campus Events
    await tx.query(
      `INSERT INTO campus_events (event_id, club_id, created_by, title, description, location, start_time, end_time)
       VALUES
         ($1, $2, $3, 'Introduction to AI & Deep Learning Workshop', 'Interactive session covering AI fundamentals for beginners.', 'Auditorium Hall B', '2026-11-20T10:00:00.000Z', '2026-11-20T12:30:00.000Z')
       ON CONFLICT (event_id) DO NOTHING`,
      [SEED_IDS.eventAiWorkshop, SEED_IDS.clubAi, SEED_IDS.userLeader]
    );

    await tx.query(
      `INSERT INTO event_rsvps (event_id, user_id, status)
       VALUES ($1, $2, 'GOING')
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [SEED_IDS.eventAiWorkshop, SEED_IDS.userSarah]
    );

    // 7. Sample Post, Comment & Reaction
    const sampleAttachments = JSON.stringify([
      {
        type: 'DOCUMENT',
        url: 'https://storage.almaarefa.edu/files/syllabus.pdf',
        name: 'CS312_Syllabus.pdf',
        sizeBytes: 204850,
      },
    ]);

    await tx.query(
      `INSERT INTO posts (post_id, author_id, club_id, class_group_id, post_type, visibility, content, attachments, moderation_status)
       VALUES
         ($1, $2, NULL, $3, 'ACADEMIC', 'CLASS_GROUP', 'Does anyone have the past exam papers for Database Systems (CS312)?', $4::jsonb, 'APPROVED')
       ON CONFLICT (post_id) DO NOTHING`,
      [
        SEED_IDS.postAcademicCs312,
        SEED_IDS.userSarah,
        SEED_IDS.classGroupCs312,
        sampleAttachments,
      ]
    );

    await tx.query(
      `INSERT INTO post_comments (post_id, author_id, content)
       VALUES ($1, $2, 'Yes! I uploaded the Midterm 2025 solutions to the group files.')`,
      [SEED_IDS.postAcademicCs312, SEED_IDS.userDemoStudent]
    );

    await tx.query(
      `INSERT INTO post_reactions (post_id, user_id, reaction_type)
       VALUES ($1, $2, 'LIKE')
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [SEED_IDS.postAcademicCs312, SEED_IDS.userDemoStudent]
    );
  });
}

// Allow direct CLI execution (`npm run db:seed`)
const currentFilePath = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === currentFilePath.toLowerCase()
) {
  seedDatabase()
    .then(async () => {
      console.log('Database seeded successfully.');
      await db.close();
    })
    .catch(async (err) => {
      console.error('Database seed failed:', err);
      await db.close();
      process.exit(1);
    });
}
