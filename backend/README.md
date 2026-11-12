# Almaarefa Network — Backend API

Production-ready RESTful Backend API for **Almaarefa Network**, the private, verified digital campus community platform for **Almaarefa University** (`@mcst.edu.sa`).

Built strictly according to the specifications in:
- [Project Graduation Documentation](../Project%20graduation.md)
- [Base PostgreSQL Database Schema](../schema.sql)
- [Frontend & Backend Integration Plan](../FRONTEND_BACKEND_INTEGRATION_PLAN.md)
- [Shared TypeScript Interfaces](../shared/types/index.ts)

---

## 📚 Backend Documentation Index

1. **[Architecture, Technical Decisions & Database ER Specification](./docs/ARCHITECTURE_AND_DATABASE.md)**
   - Modular service architecture, security controls, RBAC matrix, database schema extensions, entity relationships, and known limitations.
2. **[Complete API Reference & Frontend Integration Guide](./docs/API_REFERENCE_AND_INTEGRATION.md)**
   - Detailed documentation for all 40+ endpoints, request/response payloads, status codes, error handling, presigned file uploads, and frontend integration steps.

---

## 🚀 Quick Start (Zero-Config Local Development)

The backend features a **Dual-Mode PostgreSQL Engine**:
- **External PostgreSQL / Supabase Mode (`pg`):** Connects to any PostgreSQL 13+ or Supabase instance when `DATABASE_URL` is configured in `.env`.
- **Embedded PostgreSQL Mode (`@electric-sql/pglite`):** When `DATABASE_URL` is left empty, the backend automatically boots an embedded PostgreSQL 16 engine persisted in `./database/.pgdata`, running all SQL migrations and seeding realistic campus data automatically. **Frontend developers can run the backend immediately without installing Docker or local PostgreSQL.**

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment (Optional for Local Dev)
```bash
cp .env.example .env
```
*(All defaults in `src/config/env.ts` work out-of-the-box on port `5000` with CORS enabled for `http://localhost:3000` and `http://localhost:5173`).*

### 3. Run Database Migrations & Seed Data
```bash
npm run db:migrate
npm run db:seed
```
To wipe and reset the local database back to initial seed state at any time:
```bash
npm run db:reset
```

### 4. Start the Backend Server
```bash
# Development mode (hot-reload via tsx)
npm run dev

# Production build & start
npm run build
npm start
```
The API will be available at:
- **Base API URL:** `http://localhost:5000/api/v1`
- **Health Check:** `http://localhost:5000/api/v1/health`

---

## 🧪 Running Automated Tests

The test suite uses **Vitest** and **Supertest** against an isolated in-memory PostgreSQL instance executing the real SQL migrations and seed scripts:

```bash
cd backend
npm test
```

Type-checking and production compilation:
```bash
npm run typecheck
npm run build
```

---

## 🔑 Pre-Seeded Test Accounts & Contract UUIDs

When `npm run db:seed` (or `npm run dev` with `AUTO_SEED=true`) runs, the database is populated with ready-to-use accounts and the exact UUIDs referenced in `FRONTEND_BACKEND_INTEGRATION_PLAN.md`:

### Pre-Seeded Accounts
| Role | University Email | Password | Verified | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **`ADMIN`** | `admin@mcst.edu.sa` | `AdminPassword123!` | Yes | Full access to `/api/v1/admin/*` |
| **`CLUB_LEADER`** | `leader@mcst.edu.sa` | `LeaderPassword123!` | Yes | President of AI & Robotics Club |
| **`STUDENT`** | `sarah@mcst.edu.sa` | `StrongPassword123!` | Yes | Author of seeded CS312 academic post |
| **`STUDENT`** | `student@mcst.edu.sa` | `StrongPassword123!` | Yes | Member of CS312 class group |

### Pre-Seeded Entity UUIDs (Matching Integration Plan Examples)
| Entity | Name / Code | UUID |
| :--- | :--- | :--- |
| **Department** | Computer Science (`CS`) | `4a7b53e8-5d22-4e08-9df5-bc65476d05ea` |
| **Department** | Information Systems (`IS`) | `5b8c64f9-6e33-4f19-8ef6-cd76587e16fb` |
| **Department** | Medicine & Surgery (`MED`) | `6c9d75a0-7f44-4a20-9fa7-de87698f27ac` |
| **Department** | Doctor of Pharmacy (`PHARM`) | `7d0e86b1-8a55-4b31-8ab8-ef98709a38bd` |
| **Course** | `CS312` — Database Systems | `11223344-5566-4777-8888-99aabbccddee` |
| **Class Group** | `CS312 - Database Systems (Fall 2026)` | `762f033a-d68a-4db3-a9d9-06395b2d5fc2` |
| **Club** | `AI & Robotics Club` | `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d` |
| **Campus Event** | `Introduction to AI & Deep Learning Workshop` | `f512762a-ecff-4b31-90a8-b67dbec14331` |
| **Academic Post** | `CS312 Past Exam Papers Question` | `d2a0d922-1264-42b7-a3cf-73fc34dcbeea` |

---

## ✅ Milestone Implementation Status

| Milestone | Scope | Status |
| :--- | :--- | :---: |
| **Week 1: Foundations** | PostgreSQL schema & migrations, Express/TS architecture, JWT Auth (`/register`, `/login`, `/refresh-token`, `/logout`, `/me`), CORS & error middleware | ✅ Completed & Tested |
| **Week 2: Profiles & Verification** | Profile endpoints (`GET /profiles/:userId`, `PATCH /profiles/me`), Student ID verification submission & status, Presigned upload URL service | ✅ Completed & Tested |
| **Week 3: Academic Groups** | Departments (`GET/POST /departments`), Courses (`GET/POST /courses`), Class Groups (`GET/POST /class-groups`), Join/Leave & Member roster | ✅ Completed & Tested |
| **Week 4: Feeds & Discussions** | Posts CRUD (`general`, `class_group`, `club` feeds + In-Course Search), Comments (`GET/POST/DELETE`), Reactions (`LIKE` toggle), Attachments | ✅ Completed & Tested |
| **Week 5: Clubs & Events Calendar** | Club directory, Club creation proposals, Join requests & leader approval, Club feedback, Campus Event publishing, Calendar filtering, Event RSVP | ✅ Completed & Tested |
| **Week 6: Moderation & Admin** | One-click reporting (`POST /reports`), Admin report queue, Moderation actions (`DELETE_POST`, `DISMISS_REPORT`, `suspendUser`), Verification & Club approvals, Audit logs | ✅ Completed & Tested |
| **Week 7: Polish & Security** | Helmet security headers, Rate limiting, Input validation (Zod), Smart notifications & preferences, 33 automated integration tests | ✅ Completed & Tested |

