# CSMS — Phase 1 Setup Guide

## Prerequisites

- Node.js 18+ installed
- MySQL 8.x accessible at `162.144.105.50:3306`
- A MySQL user with CREATE DATABASE privileges

---

## 1. Install dependencies

Open a terminal in this folder and run:

```bash
npm install
```

---

## 2. Create the database

Connect to your MySQL server and run:

```sql
CREATE DATABASE csms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 3. Configure environment

Edit `.env.local` and set your real credentials:

```env
DATABASE_URL="mysql://YOUR_USER:YOUR_PASSWORD@162.144.105.50:3306/csms"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

To generate a secure `NEXTAUTH_SECRET`, run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 4. Generate Prisma client & run migrations

```bash
# Generate the Prisma client from schema.prisma
npm run db:generate

# Create all tables in the database
npm run db:migrate
# (Enter a migration name like "initial_schema" when prompted)
```

---

## 5. Seed the database

```bash
npm run db:seed
```

This creates:
- Two user accounts (see credentials below)
- A sample customer, project, site, and two buildings
- Two camera models and two cameras
- Sample project cost line items and fee summary

**Login credentials after seeding:**

| Role            | Email               | Password      |
|-----------------|---------------------|---------------|
| Administrator   | admin@csms.local    | Admin1234!    |
| Project Manager | pm@csms.local       | Manager1234!  |

---

## 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/login`.

---

## File Structure (Phase 1)

```
csms/
├── app/
│   ├── (auth)/login/page.tsx        ← Login page
│   ├── (dashboard)/
│   │   ├── layout.tsx               ← Protected layout with sidebar + navbar
│   │   └── dashboard/page.tsx       ← Dashboard home
│   ├── api/auth/[...nextauth]/      ← NextAuth route handler
│   ├── layout.tsx                   ← Root layout + SessionProvider
│   ├── page.tsx                     ← Redirects to /dashboard
│   ├── providers.tsx                ← Client-side providers
│   └── globals.css                  ← Tailwind + custom component classes
├── components/
│   ├── Sidebar.tsx                  ← Left navigation
│   └── Navbar.tsx                   ← Top bar with user menu
├── lib/
│   ├── prisma.ts                    ← Prisma singleton
│   └── auth.ts                      ← NextAuth config + role helpers
├── prisma/
│   ├── schema.prisma                ← Full database schema (11 models)
│   └── seed.ts                      ← Sample data seeder
├── types/
│   └── next-auth.d.ts               ← Type extensions for session
├── .env.local                       ← Your local config (not committed)
├── .env.example                     ← Template for other developers
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## User Roles

| Role            | Access                                        |
|-----------------|-----------------------------------------------|
| ADMIN           | Full access including user management         |
| PROJECT_MANAGER | Projects, costs, reports                     |
| TECHNICIAN      | Cameras, maintenance logs                    |
| VIEWER          | Read-only across all modules                 |

---

## Useful Commands

| Command              | Purpose                              |
|----------------------|--------------------------------------|
| `npm run dev`        | Start development server             |
| `npm run db:migrate` | Apply schema changes                 |
| `npm run db:seed`    | Populate sample data                 |
| `npm run db:studio`  | Open Prisma Studio (visual DB editor)|
| `npm run build`      | Production build                     |

---

## Next: Phase 2

Phase 2 builds the core data management modules:
- Customer CRUD (`/customers`)
- Project CRUD (`/projects`)
- Sites & Buildings (`/sites`)
- Camera Models library
- Camera Inventory with full spec fields (`/cameras`)
- REST API endpoints
- Search & filtering UI
