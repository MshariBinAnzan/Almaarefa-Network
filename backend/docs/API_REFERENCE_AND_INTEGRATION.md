# Almaarefa Network — Complete API Reference & Frontend Integration Guide

> **Base URL (Local Development):** `http://localhost:5000/api/v1`  
> **Authentication Header:** `Authorization: Bearer <accessToken>`  
> **Shared TypeScript Definitions:** [`shared/types/index.ts`](../../shared/types/index.ts)

---

## 1. Response Envelopes & Error Handling

### 1.1 Standard Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### 1.2 Paginated List Response
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalCount": 85,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 1.3 Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Email must belong to @mcst.edu.sa domain",
    "details": [
      {
        "field": "universityEmail",
        "issue": "Email must belong to @mcst.edu.sa domain"
      }
    ]
  }
}
```

### 1.4 Standard Error Codes
| HTTP Status | `error.code` | Description |
| :---: | :--- | :--- |
| `400` | `BAD_REQUEST` / `UPLOAD_EXPIRED` | Malformed JSON, invalid UUID format, or expired upload ticket. |
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_CREDENTIALS` / `INVALID_REFRESH_TOKEN` | Missing/expired JWT or wrong login credentials. When `TOKEN_EXPIRED` is received, call `POST /auth/refresh-token`. |
| `403` | `FORBIDDEN` / `ACCOUNT_SUSPENDED` | Authenticated user lacks required role (`ADMIN`, `CLUB_LEADER`, `FACULTY`) or account is suspended. |
| `404` | `NOT_FOUND` | Requested resource ID or route does not exist. |
| `409` | `CONFLICT` | Duplicate email, student ID, username, or pending request already exists. |
| `422` | `VALIDATION_FAILED` | Semantic validation error (e.g., email not `@mcst.edu.sa`, password < 8 chars). |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many requests within rate-limit window. |
| `500` | `INTERNAL_ERROR` | Unexpected server error. |

---

## 2. Authentication & Account Management (`/api/v1/auth`)

### `POST /api/v1/auth/register`
- **Auth:** Public
- **Request Body:**
```json
{
  "universityEmail": "s123456@mcst.edu.sa",
  "password": "StrongPassword123!",
  "fullName": "Turki Al-Harbi",
  "studentId": "202110234",
  "departmentId": "4a7b53e8-5d22-4e08-9df5-bc65476d05ea"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "universityEmail": "s123456@mcst.edu.sa",
    "role": "STUDENT",
    "emailVerified": false,
    "isVerified": false,
    "profile": {
      "fullName": "Turki Al-Harbi",
      "studentId": "202110234",
      "username": "s123456"
    }
  }
}
```

### `POST /api/v1/auth/login`
- **Auth:** Public
- **Request Body:**
```json
{
  "universityEmail": "s123456@mcst.edu.sa",
  "password": "StrongPassword123!"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "eyJhbGciOiJIUzI1Ni...",
    "expiresIn": 3600,
    "user": {
      "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "email": "s123456@mcst.edu.sa",
      "universityEmail": "s123456@mcst.edu.sa",
      "role": "STUDENT",
      "emailVerified": false,
      "isVerified": false,
      "isActive": true,
      "profile": {
        "fullName": "Turki Al-Harbi",
        "username": "s123456",
        "studentId": "202110234",
        "avatarUrl": null,
        "bio": null,
        "departmentId": "4a7b53e8-5d22-4e08-9df5-bc65476d05ea",
        "departmentName": "Computer Science"
      }
    }
  }
}
```

### `POST /api/v1/auth/refresh-token`
- **Auth:** Public
- **Request Body:** `{ "refreshToken": "eyJhbGciOiJIUzI1Ni..." }`
- **Response `200 OK`:** `{ "success": true, "data": { "accessToken": "eyJhbGciOiJIUzI1Ni...", "expiresIn": 3600 } }`

### `POST /api/v1/auth/logout`
- **Auth:** Bearer Token
- **Request Body (Optional):** `{ "refreshToken": "eyJhbGciOiJIUzI1Ni..." }`
- **Response `200 OK`:** `{ "success": true, "message": "Successfully logged out.", "data": { "loggedOut": true } }`

### `GET /api/v1/auth/me`
- **Auth:** Bearer Token
- **Response `200 OK`:** Full authenticated user + profile + department object.

---

## 3. Student Profiles & Identity Verification (`/api/v1/profiles`, `/api/v1/verification`)

### `GET /api/v1/profiles/me` & `GET /api/v1/profiles/:userId`
- **Auth:** Bearer Token
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "fullName": "Turki Al-Harbi",
    "username": "turki_cs",
    "studentId": "202110234",
    "avatarUrl": "https://storage.almaarefa.edu/avatars/user-123.png",
    "bio": "Senior Computer Science student passionate about AI and mobile dev.",
    "academicYear": 4,
    "role": "STUDENT",
    "departmentId": "4a7b53e8-5d22-4e08-9df5-bc65476d05ea",
    "department": {
      "departmentId": "4a7b53e8-5d22-4e08-9df5-bc65476d05ea",
      "name": "Computer Science",
      "code": "CS"
    },
    "isVerified": true,
    "joinedAt": "2026-09-01T08:00:00.000Z"
  }
}
```

### `PATCH /api/v1/profiles/me`
- **Auth:** Bearer Token
- **Request Body:** `{ "fullName"?: string, "username"?: string, "bio"?: string, "avatarUrl"?: string, "departmentId"?: string, "academicYear"?: number }`
- **Response `200 OK`:** Updated profile object.

### `POST /api/v1/verification/submit`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "submittedStudentId": "202110234",
  "proofDocumentUrl": "http://localhost:5000/uploads/verification/uuid-student-id.jpg"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "requestId": "2e8c617c-02ef-457f-b52b-7be7df506bf4",
    "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "submittedStudentId": "202110234",
    "proofDocumentUrl": "http://localhost:5000/uploads/verification/uuid-student-id.jpg",
    "status": "PENDING",
    "submittedAt": "2026-11-12T13:45:00.000Z"
  }
}
```

### `GET /api/v1/verification/status` (Alias: `GET /api/v1/verification/me`)
- **Auth:** Bearer Token
- **Response `200 OK`:** `{ "success": true, "data": { "isVerified": true, "latestRequest": { ... } } }`

---

## 4. Academic Structure & Class Groups (`/api/v1/departments`, `/api/v1/courses`, `/api/v1/class-groups`)

### `GET /api/v1/departments`
- **Auth:** Public or Bearer Token (usable on Registration form before login)
- **Response `200 OK`:** Array of `Department` objects (`departmentId`, `name`, `code`, `description`).

### `POST /api/v1/departments` *(Admin Only)*
- **Request Body:** `{ "name": "Industrial Engineering", "code": "IE", "description": "..." }`

### `GET /api/v1/courses`
- **Auth:** Bearer Token
- **Query Params:** `departmentId` (optional UUID), `search` (optional keyword matching code or name).
- **Response `200 OK`:** Array of `Course` objects (`courseId`, `departmentId`, `departmentName`, `departmentCode`, `courseCode`, `courseName`, `creditHours`).

### `POST /api/v1/courses` *(Admin / Faculty Only)*
- **Request Body:** `{ "departmentId": "<uuid>", "courseCode": "CS450", "courseName": "Machine Learning", "creditHours": 3 }`

### `GET /api/v1/class-groups`
- **Auth:** Bearer Token
- **Query Params:** `courseId`, `departmentId`, `semester` (e.g., `Fall 2026`), `academicYear` (e.g., `2026`), `search`, `joinedOnly` (`true`/`false`), `page`, `limit`.
- **Response `200 OK`:** Paginated list of `ClassGroup` objects (`groupId`, `courseId`, `courseCode`, `courseName`, `title`, `semester`, `academicYear`, `description`, `status`, `membersCount`, `isMember`).

### `GET /api/v1/class-groups/:groupId`
- **Auth:** Bearer Token
- **Response `200 OK`:** Single `ClassGroup` object.

### `POST /api/v1/class-groups` *(Admin / Faculty Only)*
- **Request Body:** `{ "courseId": "<uuid>", "title": "CS450 - Machine Learning (Fall 2026)", "semester": "Fall 2026", "academicYear": 2026, "description": "..." }`

### `POST /api/v1/class-groups/:groupId/join`
- **Auth:** Bearer Token
- **Response `200 OK`:** `{ "success": true, "message": "Successfully joined class group.", "data": { "membershipId": "...", "groupId": "...", "userId": "...", "memberRole": "MEMBER" } }`

### `DELETE /api/v1/class-groups/:groupId/leave` (Alias: `POST /api/v1/class-groups/:groupId/leave`)
- **Auth:** Bearer Token
- **Response `200 OK`:** `{ "success": true, "message": "Successfully left class group.", "data": { "groupId": "...", "left": true } }`

### `GET /api/v1/class-groups/:groupId/members`
- **Auth:** Bearer Token
- **Query Params:** `page`, `limit`
- **Response `200 OK`:** Paginated list of `ClassGroupMember` objects.

---

## 5. Student Clubs & Campus Events (`/api/v1/clubs`, `/api/v1/events`)

### `GET /api/v1/clubs`
- **Auth:** Bearer Token
- **Query Params:** `category`, `search`, `page`, `limit`.
- **Response `200 OK`:** Paginated list of `Club` objects (`clubId`, `name`, `category`, `description`, `logoUrl`, `status`, `membersCount`, `isMember`, `membershipStatus`).

### `GET /api/v1/clubs/:clubId` & `PATCH /api/v1/clubs/:clubId`
- **Auth:** Bearer Token (`PATCH` requires Club Leader or `ADMIN`).

### `POST /api/v1/clubs/request`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "proposedName": "Google Developer Student Club (GDSC)",
  "category": "Technology",
  "description": "Empowering students through technology and hands-on workshops.",
  "proposalFileUrl": "https://storage.almaarefa.edu/proposals/gdsc-proposal.pdf"
}
```
- **Response `201 Created`:** Created `ClubCreationRequest` (`status: "PENDING"`).

### `GET /api/v1/clubs/requests/me`
- **Auth:** Bearer Token — Lists club creation proposals submitted by the current user.

### `POST /api/v1/clubs/:clubId/join`
- **Auth:** Bearer Token — Queues a `PENDING` join request (`201 Created`).

### `DELETE /api/v1/clubs/:clubId/leave` (Alias: `POST /api/v1/clubs/:clubId/leave`)
- **Auth:** Bearer Token — Leaves club or cancels pending join request.

### `GET /api/v1/clubs/:clubId/members`
- **Auth:** Bearer Token — Paginated list of active club members.

### `GET /api/v1/clubs/:clubId/join-requests` & `PATCH /api/v1/clubs/:clubId/join-requests/:requestId`
- **Auth:** Club Leader or `ADMIN`.
- **`PATCH` Request Body:** `{ "status": "APPROVED" | "REJECTED", "reviewNote"?: string }`.

### `POST /api/v1/clubs/:clubId/feedback` & `GET /api/v1/clubs/:clubId/feedback`
- **`POST` Request Body:** `{ "rating": 5, "comment": "Great workshop!", "isAnonymous": true }`.

### `GET /api/v1/events`
- **Auth:** Bearer Token
- **Query Params:** `from` (ISO date), `to` (ISO date), `clubId` (optional UUID).
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "eventId": "f512762a-ecff-4b31-90a8-b67dbec14331",
      "clubId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "clubName": "AI & Robotics Club",
      "clubLogoUrl": "https://storage.almaarefa.edu/clubs/ai.png",
      "title": "Introduction to AI & Deep Learning Workshop",
      "description": "Interactive session covering AI fundamentals for beginners.",
      "club": {
        "clubId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "name": "AI & Robotics Club",
        "logoUrl": "https://storage.almaarefa.edu/clubs/ai.png"
      },
      "location": "Auditorium Hall B",
      "startTime": "2026-11-20T10:00:00.000Z",
      "endTime": "2026-11-20T12:30:00.000Z",
      "rsvpCount": 78,
      "hasRsvp": false
    }
  ]
}
```

### `POST /api/v1/events`, `GET /api/v1/events/:eventId`, `PATCH /api/v1/events/:eventId`, `DELETE /api/v1/events/:eventId`
- **`POST` Request Body (Club Leader / Admin):**
```json
{
  "clubId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "title": "Introduction to AI & Deep Learning Workshop",
  "description": "Interactive session covering AI fundamentals for beginners.",
  "location": "Auditorium Hall B",
  "startTime": "2026-11-20T10:00:00.000Z",
  "endTime": "2026-11-20T12:30:00.000Z"
}
```

### `POST /api/v1/events/:eventId/rsvp` & `DELETE /api/v1/events/:eventId/rsvp`
- **Auth:** Bearer Token — Confirms or cancels student RSVP (`{ eventId, hasRsvp, rsvpCount }`).

---

## 6. Posts, Academic Discussions, Comments & Reactions (`/api/v1/posts`)

### `GET /api/v1/posts`
- **Auth:** Bearer Token
- **Query Params:**
  - `feedType`: `general` | `class_group` | `club` (default `general`)
  - `targetId`: Group UUID or Club UUID (required when `feedType` is `class_group` or `club`)
  - `search`: Optional keyword search for **In-Course Search** across post content and attachment names
  - `page`: default `1`
  - `limit`: default `10`
- **Response `200 OK`:** Paginated list of `Post` objects.

### `POST /api/v1/posts`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "postType": "ACADEMIC",
  "clubId": null,
  "classGroupId": "762f033a-d68a-4db3-a9d9-06395b2d5fc2",
  "content": "Here is the summary notes for Lecture 4.",
  "attachments": [
    {
      "type": "DOCUMENT",
      "url": "https://storage.almaarefa.edu/files/lecture4-summary.pdf",
      "name": "Lecture4_Summary.pdf",
      "sizeBytes": 204850
    }
  ]
}
```

### `GET /api/v1/posts/:postId`, `PATCH /api/v1/posts/:postId`, `DELETE /api/v1/posts/:postId`
- Fetch, edit, or soft-delete a post.

### `GET /api/v1/posts/:postId/comments`, `POST /api/v1/posts/:postId/comments`, `DELETE /api/v1/posts/:postId/comments/:commentId`
- **`POST` Request Body:** `{ "content": "Thank you so much! Really helpful." }`.

### `POST /api/v1/posts/:postId/reactions`
- **Request Body:** `{ "reactionType": "LIKE" }`. Toggles reaction if clicked again and returns `{ postId, reactionType, hasLiked, likesCount }`.

---

## 7. Content Moderation, Reporting & Admin Governance (`/api/v1/reports`, `/api/v1/admin`)

### `POST /api/v1/reports`
- **Auth:** Bearer Token (Any authenticated user)
- **Request Body:**
```json
{
  "postId": "d2a0d922-1264-42b7-a3cf-73fc34dcbeea",
  "reason": "SPAM",
  "description": "Unauthorized commercial advertising link posted."
}
```

### `GET /api/v1/admin/reports` *(Admin Role Only)*
- **Query Params:** `status` (`PENDING`, `RESOLVED`, `DISMISSED`), `page`, `limit`.

### `POST /api/v1/admin/moderation/action` *(Admin Role Only)*
- **Request Body:**
```json
{
  "reportId": "8b5f3a1e-8422-4876-b333-e0283fc37a11",
  "postId": "d2a0d922-1264-42b7-a3cf-73fc34dcbeea",
  "actionType": "DELETE_POST",
  "reason": "Violated campus community academic standards.",
  "suspendUser": false
}
```

### Additional Admin Governance Endpoints *(Admin Role Only)*
- `GET /api/v1/admin/verifications` & `PATCH /api/v1/admin/verifications/:requestId` (`{ status: 'APPROVED' | 'REJECTED', reviewerNote?: string }`)
- `GET /api/v1/admin/club-requests` & `PATCH /api/v1/admin/club-requests/:requestId` (`{ status: 'APPROVED' | 'REJECTED', reviewNote?: string }`)
- `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:userId/status` (`{ isActive: boolean, reason?: string }`), `PATCH /api/v1/admin/users/:userId/role`, `DELETE /api/v1/admin/users/:userId`
- `GET /api/v1/admin/audit-logs` (Paginated accountability audit log trail)
- `GET /api/v1/admin/stats` (Dashboard summary counts)

---

## 8. File Uploads (`/api/v1/uploads`) & Notifications (`/api/v1/notifications`)

### Presigned Upload Workflow
1. Request upload ticket:
   `POST /api/v1/uploads/presigned-url`
   ```json
   {
     "fileName": "student-id.jpg",
     "fileType": "image/jpeg",
     "category": "verification",
     "sizeBytes": 204850
   }
   ```
   Returns `{ uploadId, uploadUrl, publicUrl, fileUrl, method: "PUT", expiresIn: 900, headers }`.
2. Upload binary file directly via `PUT` to `uploadUrl` with `Content-Type: <fileType>`.
3. Pass `publicUrl` to `/api/v1/verification/submit`, `/api/v1/profiles/me`, `/api/v1/posts`, or `/api/v1/clubs/request`.

### Smart Notifications Endpoints
- `GET /api/v1/notifications?unreadOnly=false&page=1&limit=20`
- `PATCH /api/v1/notifications/:notificationId/read`
- `PATCH /api/v1/notifications/read-all`
- `GET /api/v1/notifications/preferences` & `PATCH /api/v1/notifications/preferences`

---

## 9. Frontend Integration Checklist

1. **Environment Variables (`frontend/.env.local`):**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
   NEXT_PUBLIC_USE_MOCK=false
   ```
2. **Import Shared Types:** Copy or import from [`shared/types/index.ts`](../../shared/types/index.ts).
3. **Axios Client & Token Refresh:** Use the interceptor in Section 7 of `FRONTEND_BACKEND_INTEGRATION_PLAN.md` pointing to `http://localhost:5000/api/v1`.
4. **Start Backend Locally:** Run `cd backend && npm run dev` (auto-migrates and seeds demo accounts on port `5000`).

