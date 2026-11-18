# NewsCenter

NewsCenter is a full-stack web application for publishing and receiving campus announcements. Users can register or log in, subscribe to tags, create messages, and read a personalized feed based on tags and user roles.

The project has three main parts:

- `frontend`: Vue 3 app
- `backend`: Node.js / Express REST API
- `db`: PostgreSQL schema and seed data

## Features

- Local user registration and login
- Optional Technikum Wien LDAP login fallback
- JWT-based authentication for protected message endpoints
- Role-based message visibility with `STUDENT`, `EMPLOYEE`, and `ALL`
- Tags and user subscriptions
- Personalized news feed
- Read/unread message filtering with hover-based read status
- Notification bell for unread messages
- Message search with OpenThesaurus synonym expansion
- Server-Sent Events for live feed updates
- Optional AI-generated message summaries using Ollama and `llama3`
- Swagger API documentation

## Work in Progress

- Publish Agent with AI-supported writing suggestions for new messages
- Auto-tagging suggestions while creating messages
- Message Agent that shows semantically similar messages at the end of each post

## Tech Stack

| Part | Tech |
|---|---|
| Frontend | Vue 3, Vue Router, Axios, Vue CLI |
| Backend | Node.js, Express, PostgreSQL client, JWT, bcrypt, ldapjs |
| Database | PostgreSQL 16 |
| Tests | Jest |
| Containers | Docker, Docker Compose, nginx |

## Requirements

Install these first:

- Git
- Docker Desktop with Docker Compose
- Node.js 18 or newer with npm, only needed for local development without containers

Before running any `docker` command, start Docker Desktop and wait until it says Docker is running.

Optional:

- Ollama, only needed for AI message summaries
- A PostgreSQL client for optional manual database inspection

You do not need to install Vue CLI globally. The frontend uses the local Vue CLI dependency from `frontend/package.json`.

## Quick Start

Start Docker Desktop first.

Clone the repository:

```bash
git clone https://github.com/andizj/20_NewsCenter.git
cd 20_NewsCenter
```

If you already cloned the project, update it with:

```bash
git pull
```

Then build and start everything in the background:

```bash
docker compose up --build -d
```

This builds and starts:

- PostgreSQL database
- Express backend
- Vue frontend served by nginx

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

Default URLs from the current `docker-compose.yml`:

| Service | URL |
|---|---|
| Frontend | `http://localhost:8081` |
| Backend | `http://localhost:3000` |
| Swagger API docs | `http://localhost:3000/api-docs` |
| Database check | `http://localhost:3000/db-check` |

If a port is already used on your machine, change the port mapping in `docker-compose.yml`.

## Alternative Development Mode

Use this alternative mode only when running the frontend and backend locally with npm hot reload. PostgreSQL continues to run in Docker.

### 1. Start Only PostgreSQL In Docker

```bash
docker compose up -d db
```

### 2. Create Backend Environment File

Create `backend/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=newscenter
DB_PASSWORD=nc_secret
DB_NAME=newscenter
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=2h
BCRYPT_SALT_ROUNDS=10
LDAP_URL=ldap://ldap.technikum-wien.at
LDAP_BASE_DN=ou=people,dc=technikum-wien,dc=at
```

Use `DB_HOST=localhost` when the backend runs locally. Docker Compose uses `DB_HOST=db` internally for the backend container.

### 3. Run Backend Locally With npm
The backend exposes REST endpoints consumed by the frontend. Key endpoints include:
Auth: `POST /users/login` (Hybrid: Lokal + LDAP), `POST /users` (Register)
 Profile: `GET /api/v1/users/me` (own profile incl. LDAP-derived study data, JWT required; also available as `GET /users/me`)
 Messages: `GET /messages` (Feed), `GET /messages/search?q=...` (Thesaurus Suche), `POST /messages`
 Tags: `GET /tags`, `POST /tags` 
 Subscriptions: `POST /users/:id/subscriptions`, `DELETE /users/:id/subscriptions/:tagId`

```bash
cd backend
npm ci
npm run dev
```

### 4. Run Frontend Locally With npm

The frontend already has `frontend/.env`:

```env
VUE_APP_API_URL=http://localhost:3000
```
## Current Features (Iterations 1–3)
Epic 1: LDAP & Authentifizierung

- Hybrid-Login: Unterstützt sicheren lokalen Login (BCrypt) sowie einen Fallback auf das Active Directory der FH Technikum Wien.
- Verschlüsselte LDAP-Verbindung via StartTLS.
- Just-in-Time Provisioning: Automatische Account-Erstellung beim ersten LDAP-Login.
- Automatisches Rollen-Mapping: Zuweisung von Student / Employee via Regex-Prüfung der FH-Kennung.
- LDAP-Anzeigename: Nach dem Bind werden `givenName` und `sn` auf derselben Verbindung aus dem verifizierten eigenen Eintrag gelesen. Der vollständige Name wird für neue LDAP-Konten gespeichert und bei Bestandskonten nachgeführt.

Then run:

```bash
cd frontend
npm ci
npm run serve
```

Sprint 3: LDAP Profiling & Identification Logic

- Student ID Parsing: The FH student ID (e.g. `if24b032` = study program `if` + start year `24` + degree `b` + number `032`) is parsed on every LDAP login and broken down into profile data.
- Automatic Profile Derivation: Study program, degree and start year are derived and stored automatically for new LDAP accounts (Just-in-Time) and refreshed for existing LDAP accounts on every login.
- Profile Endpoint: `GET /api/v1/users/me` returns the authenticated user's account data plus the stored profile fields and the dynamically calculated current semester (JWT required, never returns password hashes).
- Profile Display in Settings: A read-only profile card in the settings view shows display name, e-mail, role, study program, degree, start year and current semester; missing values are shown as "Nicht verfügbar".
- Database Migration: `db/migrations/001_user_profile_fields.sql` adds four nullable columns (`student_id`, `study_program`, `degree`, `study_start_year`) to the `users` table – additive and idempotent, no data is lost. Fresh databases get the same columns via `db/init/01_schema.sql`.

Known limitations (details in `documentation.md`):

- Only the confirmed mappings `if` → "Informatik" and `b` → "Bachelor" are implemented; every other code falls back to "unbekannt" (full mapping table still outstanding).
- The master degree format is not confirmed yet.
- The current semester is computed from the start year (winter semester assumed, no interruptions) – it is a calculated value, not the actual enrolled semester.

## Project Status
The project currently provides a fully working end-to-end prototype:
Frontend ↔ Backend ↔ Database communication is fully implemented.
Authentication and security basics (password hashing & LDAP integration) are implemented.
Tagging logic (Many-to-Many relations & Thesaurus search) is fully functional.
LDAP profiling (student ID parsing, profile storage, profile endpoint and settings display) is implemented – see `documentation.md` for the full Sprint 3 documentation, including the database migration and known limitations.

## Documentation

Detailed documentation of the Sprint 3 features (LDAP profiling & identification logic), the profile fields, the `GET /api/v1/users/me` endpoint, the required database migration and the open limitations can be found in [`documentation.md`](documentation.md).

## Optional Development Checks

These commands are not required to run the project with Docker Compose. Use them only when developing or checking changes locally.

### What is tested

| File | Covered functions |
|---|---|
| `tests/authService.test.js` | `hashPassword`, `comparePassword`, `generateToken` |
| `tests/messageService.test.js` | `createMessage` (validation, role fallback), `getMessageById` (found / 404) |
| `tests/studentIdParser.test.js` | `parseStudentId` (valid IDs, unknown codes, invalid formats) |
| `tests/semester.test.js` | `calculateSemester` (winter/summer semester, year boundaries, invalid/future input) |
| `tests/userRepository.profile.test.js` | profile columns in `create`/`updateProfile`/`findProfileById`, migration 001 (idempotent, additive) |
| `tests/userService.loginProfile.test.js` | profile derivation on LDAP login (new/existing users), local accounts untouched, role check & JWT unchanged |
| `tests/userProfileApi.test.js` | `GET /api/v1/users/me` (profile fields, missing data, all 401/404 cases, no password hashes) |
| `tests/authService.ldapProfile.test.js` | same-connection LDAP read, DN/uid identity check, name attributes, read/auth failures, timeouts and connection cleanup |
| `tests/ldapLoginApi.test.js` | login → name persistence → profile API, existing/new LDAP accounts, local accounts, unchanged JWT claims and lifetime |
| `tests/tagSuggestionService.test.js` | existing/new suggestions, subscriber counts, thesaurus fallback |
| `tests/sprintIntegration.test.js` | combined versioned/legacy API, profile, counts, suggestions, CORS and Swagger |

LDAP transport is mocked in automated tests; the real ldapjs DN and result-entry types are exercised. No real LDAP credentials are needed. A separate authorized live diagnostic confirmed the available name attributes.

### Running the tests

```bash
cd backend
npm test
```

Build the frontend locally, only if you want to check the frontend build outside Docker:

```bash
cd frontend
npm run build
```

Lint the frontend locally:
```
Test Suites: 11 passed, 11 total
Tests:       170 passed, 170 total
```

Frontend session/name and render regressions can be run with `npm test` in
`frontend` (Node.js test runner; no additional test dependencies). Run
`npm run lint -- --no-fix` and `npm run build` for lint/build checks.

## Future Improvements
True Real-Time: Replace polling with WebSockets for instant updates.
Admin Dashboard: UI to delete messages or manage users.
File Uploads: Allow images or attachments in messages.

```bash
cd frontend
npm run lint
```

Run backend locally without nodemon:

```bash
cd backend
npm start
```

## Database

Database settings from `docker-compose.yml`:

```text
Database: newscenter
User: newscenter
Password: nc_secret
Container host: db
Local host: localhost
Port: 5432
```

Initialization files:

- `db/init/01_schema.sql`: creates tables and indexes
- `db/init/02_seed.sql`: inserts demo users, tags, messages, and subscriptions

Main tables:

- `users`
- `tags`
- `messages`
- `message_tags`
- `subscriptions`

Reset the database completely:

```bash
docker compose down -v
docker compose up --build -d
```

Run these commands from the project root. The `-v` removes the database volume, so the schema and seed scripts run again.

## API Overview

Swagger has the detailed API docs:

```text
http://localhost:3000/api-docs
```

Important endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/users` | Register user |
| `POST` | `/users/login` | Login with local account or LDAP fallback |
| `GET` | `/tags` | List tags |
| `POST` | `/tags` | Create tag |
| `GET` | `/users/:id/subscriptions` | List user subscriptions |
| `POST` | `/users/:id/subscriptions` | Subscribe to a tag |
| `DELETE` | `/users/:id/subscriptions/:tagId` | Unsubscribe from a tag |
| `GET` | `/messages` | Get personalized feed |
| `POST` | `/messages` | Create message |
| `GET` | `/messages/search?q=...` | Search messages |
| `POST` | `/messages/:id/tags` | Assign tag to message |
| `POST` | `/messages/:id/summarize` | Generate AI summary |
| `GET` | `/subscribe?token=...` | SSE live feed |

Protected message endpoints require:

```http
Authorization: Bearer <jwt-token>
```

## Optional Ollama Setup

Message summaries use Ollama with the `llama3` model. The backend currently expects Ollama at:

```text
http://host.docker.internal:11434
```

Install Ollama, then pull the model:

```bash
ollama pull llama3
```

All non-AI features work without Ollama. Only `/messages/:id/summarize` will fail if Ollama is not running.

## Troubleshooting

If all Docker commands fail, start Docker Desktop first and wait until the Docker engine is running. A common Windows error is that `dockerDesktopLinuxEngine` or the Docker daemon cannot be reached.

Check Docker with:

```bash
docker info
```

If the frontend cannot call the backend, check `frontend/.env` and restart the frontend dev server.

If the backend cannot connect to the database, check whether you are using the correct `DB_HOST`: `localhost` for local npm backend, `db` for Docker backend.

If old database data keeps showing up, reset the Docker volume with `docker compose down -v`.

If login fails locally, make sure `JWT_SECRET` is set in `backend/.env`.
