# KitchenOS — Onboarding Walkthrough

This guide gets a first-time reader from a clean checkout to a working session with realistic
demo data, exercising the core MVP flow end to end.

## 1. Prerequisites

- Node.js (see `.nvmrc`/`package.json` engines if present) and npm
- Docker (for local Postgres)

## 2. Start Postgres

```bash
docker compose up -d
```

This starts a `postgres:16-alpine` container on `localhost:5432` with credentials
`kitchenos` / `kitchenos`, database `kitchenos` (see `docker-compose.yml`).

## 3. Install dependencies

From the repo root (this is an npm workspaces monorepo):

```bash
npm install
```

## 4. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Defaults work out of the box against the Docker Postgres container above.

## 5. Run database migrations

```bash
npm --prefix apps/api run migrate
npx --prefix apps/api prisma generate
```

## 6. Seed demo data

```bash
npm --prefix apps/api run seed
```

This populates:
- Organization **"Demo Kitchen Co"** with one Kitchen ("Main Line")
- 4 Users, one per role, all sharing the password `Password123!`:
  - `owner@demo.kitchenos.dev` (OWNER)
  - `chef@demo.kitchenos.dev` (CHEF)
  - `staff@demo.kitchenos.dev` (STAFF)
  - `viewer@demo.kitchenos.dev` (VIEWER)
- 5 Ingredients with realistic stock levels (Basil is deliberately seeded below its
  min-threshold so the low-stock dashboard flag has something to show immediately)
- 3 Recipes with ingredients & steps (Margherita Pizza, Tomato Bruschetta, Caprese Salad)
- 3 Tasks in varying states (TODO / IN_PROGRESS / DONE)
- 1 Guideline (Opening Checklist)
- 1 Note and 1 Announcement

The seed script is idempotent — re-running it is always safe and will not create duplicates
or error (existing rows are looked up and skipped; users are upserted by email).

## 7. Start the app

In two separate terminals, from the repo root:

```bash
npm --prefix apps/api run start:dev   # API on http://localhost:3000
npm --prefix apps/web run dev         # Web app on http://localhost:8766
```

## 8. Log in

Open http://localhost:8766 and log in as any of the seeded users above (all share password
`Password123!`). Try:
- **Owner/Chef**: create a Recipe (cost is computed automatically from its ingredients),
  create a Task and assign it to Staff, post an Announcement.
- **Staff**: check off items on your assigned Task, post a shift-log note.
- **Viewer**: confirm you can view everything but writes are blocked (403) on
  Inventory/Recipes/Guidelines/Tasks.

## 9. Run the automated test suite

```bash
npm --prefix apps/api run test
npm --prefix apps/web run test
```

Both suites should report all green — this is the same combined command CI/QA uses as the
Definition-of-Done gate for the MVP milestone.

## Troubleshooting

- **`EADDRINUSE` on port 3000/8766**: another instance of the dev server is already running;
  either reuse it or stop the existing process first.
- **Prisma "Module has no exported member" errors when running tests**: run
  `npx --prefix apps/api prisma generate` — the generated client is gitignored and must be
  regenerated after a fresh `npm install`.
