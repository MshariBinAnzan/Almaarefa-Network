-- =============================================================================
-- DATABASE SCHEMA: GRADUATION PROJECT (BASE SCHEMA)
-- Generated from ER Diagram Specification
-- Target Database: PostgreSQL 13+ / Supabase
-- =============================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ACADEMIC STRUCTURE (Created first due to foreign key dependencies)
-- =============================================================================

CREATE TABLE IF NOT EXISTS departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    course_code VARCHAR(50) NOT NULL UNIQUE,
    course_name VARCHAR(150) NOT NULL,
    credit_hours INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. STUDENT ACCOUNT AND VERIFICATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(department_id) ON DELETE SET NULL,
    student_id VARCHAR(50) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    avatar_url VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_verification_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    submitted_student_id VARCHAR(50) NOT NULL,
    proof_document_url VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewer_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);

-- =============================================================================
-- 3. CLASS GROUP
-- =============================================================================

CREATE TABLE IF NOT EXISTS class_group (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL UNIQUE REFERENCES courses(course_id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    semester VARCHAR(50),
    academic_year INTEGER,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS class_group_members (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES class_group(group_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    member_role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_class_group_member UNIQUE (group_id, user_id)
);

-- =============================================================================
-- 4. CLUB REQUESTS AND CLUBS
-- =============================================================================

CREATE TABLE IF NOT EXISTS club_creation_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    proposed_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    proposal_file_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    review_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clubs (
    club_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    creation_request_id UUID UNIQUE REFERENCES club_creation_requests(request_id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL UNIQUE,
    category VARCHAR(100),
    description TEXT,
    logo_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_members (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    member_role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_club_member UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS club_join_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    review_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);

-- =============================================================================
-- 5. POSTS, REPORTS, AND ADMIN MODERATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS posts (
    post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(club_id) ON DELETE SET NULL,
    mongo_post_id VARCHAR(100),
    post_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    visibility VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',
    moderation_status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    deletion_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    review_note TEXT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_moderation_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    reason TEXT,
    action_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id UUID,
    action_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON profiles(department_id);

CREATE INDEX IF NOT EXISTS idx_verification_user ON student_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_status ON student_verification_requests(status);

CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_class_group_course ON class_group(course_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON class_group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_club_creation_status ON club_creation_requests(status);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_join_requests_club ON club_join_requests(club_id);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_club ON posts(club_id);
CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON posts(moderation_status);
CREATE INDEX IF NOT EXISTS idx_posts_is_deleted ON posts(is_deleted);

CREATE INDEX IF NOT EXISTS idx_reports_post ON post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON post_reports(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs(admin_id);

