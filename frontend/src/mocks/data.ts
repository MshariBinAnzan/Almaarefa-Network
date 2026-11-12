import {
  AuthUser,
  CampusEvent,
  ClassGroup,
  Club,
  Department,
  Post,
} from '@/types';

export const MOCK_DEPARTMENTS: Department[] = [
  {
    departmentId: '4a7b53e8-5d22-4e08-9df5-bc65476d05ea',
    name: 'Computer Science',
    code: 'CS',
    description: 'Department of Computer Science and Artificial Intelligence',
  },
  {
    departmentId: '8f14e45f-ceea-467a-a836-50809b38b912',
    name: 'Information Systems',
    code: 'IS',
    description: 'Department of Information Systems and Data Analytics',
  },
  {
    departmentId: 'c9f0f895-fb98-4ab9-959f-511284b53e23',
    name: 'Medicine & Surgery',
    code: 'MED',
    description: 'College of Medicine',
  },
  {
    departmentId: '45c48cce-2e2d-4fbdea1-51c7c6ad2611',
    name: 'Doctor of Pharmacy (PharmD)',
    code: 'PHARM',
    description: 'College of Pharmacy',
  },
  {
    departmentId: 'd3d94468-02a4-4259-955d-38e6d163e820',
    name: 'Nursing & Respiratory Care',
    code: 'NURS',
    description: 'College of Applied Sciences',
  },
  {
    departmentId: '6512bd43-d9ca-46e0-9c99-0b0a82652dca',
    name: 'Industrial Engineering',
    code: 'IE',
    description: 'Department of Engineering',
  },
];

export const MOCK_USERS: Record<string, AuthUser> = {
  studentVerified: {
    userId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    universityEmail: 's123456@mcst.edu.sa',
    role: 'STUDENT',
    emailVerified: true,
    isVerified: true,
    profile: {
      fullName: 'Turki Al-Harbi',
      studentId: '202110234',
      username: 'turki_cs',
      avatarUrl: null,
      departmentId: '4a7b53e8-5d22-4e08-9df5-bc65476d05ea',
      departmentName: 'Computer Science',
      bio: 'Senior Computer Science student passionate about AI and mobile dev.',
    },
  },
  studentUnverified: {
    userId: '5a2c91b0-7e44-4d1a-8c3e-1f0d9a2b3c4d',
    universityEmail: 'newstudent@mcst.edu.sa',
    role: 'STUDENT',
    emailVerified: true,
    isVerified: false,
    profile: {
      fullName: 'Noura Al-Qahtani',
      studentId: '202411089',
      username: 'noura_is',
      avatarUrl: null,
      departmentId: '8f14e45f-ceea-467a-a836-50809b38b912',
      departmentName: 'Information Systems',
      bio: 'First-year Information Systems student at Almaarefa University.',
    },
  },
  clubLeader: {
    userId: '3c4e5f6a-1b2c-4d5e-8f9a-0b1c2d3e4f5a',
    universityEmail: 'leader@mcst.edu.sa',
    role: 'CLUB_LEADER',
    emailVerified: true,
    isVerified: true,
    profile: {
      fullName: 'Faisal Al-Otaibi',
      studentId: '202010512',
      username: 'faisal_ai',
      avatarUrl: null,
      departmentId: '4a7b53e8-5d22-4e08-9df5-bc65476d05ea',
      departmentName: 'Computer Science',
      bio: 'President of the AI & Robotics Club at Almaarefa University.',
    },
  },
  admin: {
    userId: '11111111-2222-4333-8444-555555555555',
    universityEmail: 'admin@mcst.edu.sa',
    role: 'ADMIN',
    emailVerified: true,
    isVerified: true,
    profile: {
      fullName: 'Student Affairs Moderation',
      username: 'mcst_admin',
      avatarUrl: null,
      departmentName: 'Deanship of Student Affairs',
      bio: 'Official Almaarefa Network Platform Administrator.',
    },
  },
};

export const MOCK_CLASS_GROUPS: ClassGroup[] = [
  {
    groupId: '762f033a-d68a-4db3-a9d9-06395b2d5fc2',
    courseId: 'c1',
    courseCode: 'CS312',
    courseName: 'Database Systems',
    title: 'CS312 — Database Systems (Section 1)',
    semester: 'Fall 2026',
    academicYear: 2026,
    description: 'Official course community for ER modeling, SQL, indexing, and transaction labs.',
    status: 'ACTIVE',
    membersCount: 64,
    isMember: true,
  },
  {
    groupId: '883a144b-e79b-4ec4-b0e0-17406c3e6gd3',
    courseId: 'c2',
    courseCode: 'CS401',
    courseName: 'Software Engineering',
    title: 'CS401 — Software Engineering',
    semester: 'Fall 2026',
    academicYear: 2026,
    description: 'Sprint coordination, architecture discussions, and graduation project resources.',
    status: 'ACTIVE',
    membersCount: 52,
    isMember: true,
  },
  {
    groupId: '994b255c-f80c-4fd5-c1f1-28517d4f7he4',
    courseId: 'c3',
    courseCode: 'CS450',
    courseName: 'Artificial Intelligence',
    title: 'CS450 — Artificial Intelligence',
    semester: 'Fall 2026',
    academicYear: 2026,
    description: 'Search algorithms, machine learning foundations, and Python lab notebooks.',
    status: 'ACTIVE',
    membersCount: 47,
    isMember: false,
  },
];

export const MOCK_CLUBS: Club[] = [
  {
    clubId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    name: 'AI & Robotics Club',
    category: 'Technology',
    description: 'Hands-on workshops in deep learning, computer vision, and campus hackathons.',
    status: 'ACTIVE',
    membersCount: 142,
    isFollowing: true,
  },
  {
    clubId: '2c3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a',
    name: 'Google Developer Student Club (GDSC)',
    category: 'Technology',
    description: 'Building full-stack web, cloud, and mobile solutions for the Almaarefa community.',
    status: 'ACTIVE',
    membersCount: 198,
    isFollowing: true,
  },
  {
    clubId: '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a',
    name: 'Medical Research Society',
    category: 'Academic & Health',
    description: 'Connecting medical and pharmacy students for clinical research and peer mentoring.',
    status: 'ACTIVE',
    membersCount: 115,
    isFollowing: false,
  },
];

export const MOCK_POSTS: Post[] = [
  {
    postId: 'd2a0d922-1264-42b7-a3cf-73fc34dcbeea',
    author: {
      userId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      fullName: 'Sarah Al-Ghamdi',
      username: 'sarah_g',
      avatarUrl: null,
      isVerified: true,
      departmentName: 'Computer Science',
    },
    classGroupId: '762f033a-d68a-4db3-a9d9-06395b2d5fc2',
    postType: 'ACADEMIC',
    content:
      'Does anyone have the past exam papers and ER diagram solutions for Database Systems (CS312)? Sharing the updated syllabus and lab schedule below for everyone preparing for next week.',
    attachments: [
      {
        type: 'DOCUMENT',
        url: 'https://storage.almaarefa.edu/files/syllabus.pdf',
        name: 'CS312_Syllabus_Fall2026.pdf',
        sizeBytes: 204850,
      },
    ],
    stats: {
      likesCount: 14,
      commentsCount: 6,
      hasLiked: false,
    },
    moderationStatus: 'APPROVED',
    createdAt: '2026-11-12T14:10:00.000Z',
  },
  {
    postId: 'e4b1e833-2375-43c8-b4df-84gd45edcffb',
    author: {
      userId: '3c4e5f6a-1b2c-4d5e-8f9a-0b1c2d3e4f5a',
      fullName: 'Faisal Al-Otaibi',
      username: 'faisal_ai',
      avatarUrl: null,
      isVerified: true,
      departmentName: 'AI & Robotics Club',
    },
    clubId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    postType: 'CLUB_EVENT',
    content:
      'Registration is now open for the "Introduction to AI & Deep Learning Workshop" in Auditorium Hall B! All verified Almaarefa students across CS, IS, and Medical tracks are welcome.',
    attachments: [],
    stats: {
      likesCount: 29,
      commentsCount: 11,
      hasLiked: true,
    },
    moderationStatus: 'APPROVED',
    createdAt: '2026-11-12T11:30:00.000Z',
  },
  {
    postId: 'f5c2f944-3486-44d9-c5eg-95he56fedggc',
    author: {
      userId: '8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d',
      fullName: 'Dr. Khalid Al-Mansour',
      username: 'dr_khalid',
      avatarUrl: null,
      isVerified: true,
      departmentName: 'Software Engineering',
    },
    classGroupId: '883a144b-e79b-4ec4-b0e0-17406c3e6gd3',
    postType: 'GENERAL',
    content:
      'Reminder for Graduation Project teams: Milestone 1 API Contract & Authentication Shell reviews will take place this Thursday. Make sure your repository branches follow the dev integration workflow.',
    attachments: [
      {
        type: 'DOCUMENT',
        url: 'https://storage.almaarefa.edu/files/graduation-rubric.pdf',
        name: 'Graduation_Project_Milestone1_Checklist.pdf',
        sizeBytes: 158400,
      },
    ],
    stats: {
      likesCount: 41,
      commentsCount: 9,
      hasLiked: false,
    },
    moderationStatus: 'APPROVED',
    createdAt: '2026-11-11T16:45:00.000Z',
  },
];

export const MOCK_EVENTS: CampusEvent[] = [
  {
    eventId: 'f512762a-ecff-4b31-90a8-b67dbec14331',
    title: 'Introduction to AI & Deep Learning Workshop',
    description: 'Interactive session covering AI fundamentals and neural networks for beginners.',
    club: {
      clubId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      name: 'AI & Robotics Club',
      logoUrl: null,
    },
    location: 'Auditorium Hall B',
    startTime: '2026-11-20T10:00:00.000Z',
    endTime: '2026-11-20T12:30:00.000Z',
    rsvpCount: 78,
    hasRsvp: false,
  },
  {
    eventId: 'a623873b-fd00-4c42-a1b9-c78ecfd25442',
    title: 'Git & Parallel Full-Stack Development Bootcamp',
    description: 'Learn contract-first development, branching strategies, and CI/CD for graduation projects.',
    club: {
      clubId: '2c3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a',
      name: 'Google Developer Student Club (GDSC)',
      logoUrl: null,
    },
    location: 'Computer Lab 204',
    startTime: '2026-11-24T13:00:00.000Z',
    endTime: '2026-11-24T15:00:00.000Z',
    rsvpCount: 54,
    hasRsvp: true,
  },
];

