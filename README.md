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

Then run:

```bash
cd frontend
npm ci
npm run serve
```

Vue CLI prints the local frontend URL in the terminal.

## Optional Development Checks

These commands are not required to run the project with Docker Compose. Use them only when developing or checking changes locally.

Run backend tests locally:

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
