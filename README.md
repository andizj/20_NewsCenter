# NewsCenter 

NewsCenter is a web-based communication platform built around a publish–subscribe model.  
It enables users to view tagged announcements and news items through a clean web interface, while publishers can create and distribute messages to specific topics.

The project serves as a practical example of building a modern full-stack web application with a clear separation between frontend, backend, and database layers.


## What this project demonstrates 

The NewsCenter codebase focuses on the following key aspects:

- Clean separation of concerns (Frontend ↔ Backend ↔ Database)
- RESTful API design and consumption
- Modular frontend architecture using Vue.js
- Containerized database setup using Docker
- API documentation using Swagger (OpenAPI)
- Environment-based configuration (no hardcoded URLs)

The goal is to keep the system simple and understandable, while still reflecting real-world application structure.


## System Architecture 

NewsCenter consists of three main components:

- Frontend  
  Vue.js application responsible for displaying messages and tags and interacting with the backend API.

- Backend  
  Node.js / Express service that implements business logic, database access, and a publish–subscribe mechanism.

- Database  
  PostgreSQL database running in Docker for persistent storage of users, messages, and tags.

All communication from the frontend goes through the backend API.  
The frontend never communicates directly with the database.


## Technology Stack 

- Frontend: Vue.js (Vue CLI)
- Backend: Node.js + Express
- Database: PostgreSQL
- Containerization: Docker + Docker Compose
- API Documentation: Swagger (OpenAPI)


## Development Setup 

### Prerequisites
- Node.js + npm
- Docker + Docker Compose

Optional:
```bash
npm install -g @vue/cli
```

### Running the Application Fully Containerized (only for retake)

The entire application (Frontend, Backend, and Database) is fully containerized using Docker. You do not need to install Node.js or run `npm install` manually. You can start the complete stack with a single command!

#### 1) Start the full stack

From the project root directory, run:

```bash
docker compose up --build -d
```

### Running the Application 

#### 1) Start the Database

From the project root:

docker compose up -d

Adminer (Database UI):
```bash
    URL: http://localhost:8080
    System: PostgreSQL
    Server: db
    User: newscenter
    Password: nc_secret
    Database: newscenter
```
#### 2) Start the Backend
```bash
cd backend
npm install
npm run dev
```
Backend API:
```bash
http://localhost:3000
```
Swagger API Documentation:
```bash
http://localhost:3000/api-docs
```
#### 3) Start the Frontend
```bash
cd newscenter-frontend
npm install
npm run serve
```
Frontend URL (port may vary):

http://localhost:8081

#### Environment Configuration 

Frontend

newscenter-frontend/.env

VUE_APP_API_URL=http://localhost:3000

Backend
```bash
backend/.env

PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=newscenter
DB_PASSWORD=nc_secret
DB_NAME=newscenter
JWT_SECRET=super_secret_jwt_key_123
LDAP_URL=ldap://ldap.technikum-wien.at
LDAP_BASE_DN=ou=people,dc=technikum-wien,dc=at

```
    Note: For this university project, .env files are committed for simplicity and ease of setup.
    In production environments, sensitive configuration should never be committed.

## API Overview 

The backend exposes REST endpoints consumed by the frontend. Key endpoints include:
Auth: `POST /users/login` (Hybrid: Lokal + LDAP), `POST /users` (Register)
 Profile: `GET /api/v1/users/me` (own profile incl. LDAP-derived study data, JWT required; also available as `GET /users/me`)
 Messages: `GET /messages` (Feed), `GET /messages/search?q=...` (Thesaurus Suche), `POST /messages`
 Tags: `GET /tags`, `POST /tags` 
 Subscriptions: `POST /users/:id/subscriptions`, `DELETE /users/:id/subscriptions/:tagId`

(Note: Server-Sent Events were replaced by a robust client-side polling mechanism for this iteration.)

All endpoints are documented via Swagger.

## Current Features (Iterations 1–3)
Epic 1: LDAP & Authentifizierung

- Hybrid-Login: Unterstützt sicheren lokalen Login (BCrypt) sowie einen Fallback auf das Active Directory der FH Technikum Wien.
- Verschlüsselte LDAP-Verbindung via StartTLS.
- Just-in-Time Provisioning: Automatische Account-Erstellung beim ersten LDAP-Login.
- Automatisches Rollen-Mapping: Zuweisung von Student / Employee via Regex-Prüfung der FH-Kennung.
- LDAP-Anzeigename: Nach dem Bind werden `givenName` und `sn` auf derselben Verbindung aus dem verifizierten eigenen Eintrag gelesen. Der vollständige Name wird für neue LDAP-Konten gespeichert und bei Bestandskonten nachgeführt.

Epic 2: Intelligente Suche (Thesaurus)

- Semantic Search: Anbindung der OpenThesaurus REST-API.
- Echtzeit-Synonym-Erweiterung bei Suchanfragen (z. B. "Feuer" findet auch "Brandverordnung").
- Dynamisch erweiterte SQL-Abfragen für deutlich höhere Trefferquoten.
- Frontend, UX & Core-Features
- Tag-Based Filtering & Subscriptions: Personalisierter News-Feed basierend auf abonnierten Themen und der eigenen LDAP-Rolle.
- Modernes UI: Optimiertes Feed-Layout ("Wer spricht?" vor "Was wird gesagt?") inklusive visueller Tag-Hashtags.
- Real-Time Updates: Das Frontend pollt regelmäßig nach neuen Nachrichten.
- Content Creation: Create messages and new tags directly from the UI.

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

## Testing

The backend includes unit tests using [Jest](https://jestjs.io/). Tests run without a database or any external services — repositories and external APIs are mocked.

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

Expected output:

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

## About This Project
This project was developed as part of a university course (Innovation Lab).
Some implementation decisions prioritize clarity and ease of evaluation over production-grade security practices.
