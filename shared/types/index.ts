// ============================================================================
// SHARED TYPES FOR ALMAAREFA NETWORK
// Single Source of Truth for Frontend & Backend API Contracts
// ============================================================================

export type UserRole = 'STUDENT' | 'CLUB_LEADER' | 'FACULTY' | 'ADMIN';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ClassGroupStatus = 'ACTIVE' | 'ARCHIVED';

export type ClubStatus = 'ACTIVE' | 'SUSPENDED';

export type ClubRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ClubJoinStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PostType = 'GENERAL' | 'ACADEMIC' | 'CLUB_EVENT';

export type PostVisibility = 'PUBLIC' | 'CLASS_GROUP' | 'CLUB';

export type ModerationStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export type AttachmentType = 'IMAGE' | 'DOCUMENT';

export type ReactionType = 'LIKE' | 'HELPFUL' | 'CELEBRATE';

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export type ModerationActionType =
  | 'DELETE_POST'
  | 'APPROVE_POST'
  | 'DISMISS_REPORT';

export type UploadCategory =
  | 'verification'
  | 'avatar'
  | 'attachment'
  | 'proposal'
  | 'club_logo'
  | 'event_banner';

// ============================================================================
// CORE DOMAIN ENTITIES
// ============================================================================

export interface User {
  userId: string;
  universityEmail: string;
  role: UserRole;
  emailVerified: boolean;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Profile {
  userId: string;
  departmentId?: string | null;
  studentId?: string | null;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  academicYear?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  departmentId: string;
  name: string;
  code: string;
  description?: string | null;
  createdAt?: string;
}

export interface PublicProfile {
  userId: string;
  fullName: string;
  username: string;
  studentId?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  academicYear?: number | null;
  role?: UserRole;
  department?: {
    departmentId: string;
    name: string;
    code: string;
  } | null;
  isVerified: boolean;
  joinedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VerificationRequest {
  requestId: string;
  userId: string;
  submittedStudentId: string;
  proofDocumentUrl: string;
  status: VerificationStatus;
  reviewedBy?: string | null;
  reviewerNote?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface Course {
  courseId: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  courseCode: string;
  courseName: string;
  creditHours: number;
  createdAt?: string;
}

export interface ClassGroup {
  groupId: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  title: string;
  semester: string;
  academicYear: number;
  description?: string | null;
  status: ClassGroupStatus;
  membersCount?: number;
  isMember?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassGroupMember {
  membershipId: string;
  groupId: string;
  userId: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  memberRole: string;
  joinedAt: string;
}

export interface Club {
  clubId: string;
  name: string;
  category: string;
  description?: string | null;
  logoUrl?: string | null;
  status: ClubStatus;
  membersCount?: number;
  isMember?: boolean;
  membershipStatus?: 'NONE' | 'PENDING' | 'ACTIVE';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClubCreationRequest {
  requestId: string;
  requestedBy: string;
  proposedName: string;
  category: string;
  description?: string | null;
  proposalFileUrl?: string | null;
  status: ClubRequestStatus;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface ClubJoinRequest {
  requestId: string;
  clubId: string;
  userId: string;
  status: ClubJoinStatus;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface PostAttachment {
  type: AttachmentType;
  url: string;
  name: string;
  sizeBytes?: number;
}

export interface PostAuthor {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  isVerified: boolean;
}

export interface Post {
  postId: string;
  author: PostAuthor;
  clubId?: string | null;
  classGroupId?: string | null;
  postType: PostType;
  content: string;
  attachments?: PostAttachment[];
  stats: {
    likesCount: number;
    commentsCount: number;
    hasLiked: boolean;
  };
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface PostComment {
  commentId: string;
  postId: string;
  author: PostAuthor;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampusEvent {
  eventId: string;
  clubId: string;
  clubName: string;
  clubLogoUrl?: string | null;
  club: {
    clubId: string;
    name: string;
    logoUrl?: string | null;
  };
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  rsvpCount: number;
  hasRsvp: boolean;
  createdAt?: string;
}

export interface PostReport {
  reportId: string;
  postId: string;
  reportedBy: string;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  reportedAt: string;
  reviewedAt?: string | null;
}

export interface AdminAuditLog {
  logId: string;
  adminId: string;
  adminName?: string;
  actionType: string;
  targetType: string;
  targetId?: string | null;
  actionDetails?: string | null;
  createdAt: string;
}

export interface NotificationItem {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  threadReplies: boolean;
  clubEvents: boolean;
  campusAnnouncements: boolean;
  updatedAt: string;
}

// ============================================================================
// STANDARD API ENVELOPES
// ============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiResponse<T> {
  success: true;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

