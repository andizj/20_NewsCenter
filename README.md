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
 Messages: `GET /messages` (Feed), `GET /messages/search?q=...` (Thesaurus Suche), `POST /messages`
 Tags: `GET /tags`, `POST /tags` 
 Subscriptions: `POST /users/:id/subscriptions`, `DELETE /users/:id/subscriptions/:tagId`

(Note: Server-Sent Events were replaced by a robust client-side polling mechanism for this iteration.)

All endpoints are documented via Swagger.

## Current Features (Iteration 1 & 2)
Epic 1: LDAP & Authentifizierung

- Hybrid-Login: Unterstützt sicheren lokalen Login (BCrypt) sowie einen Fallback auf das Active Directory der FH Technikum Wien.
- Verschlüsselte LDAP-Verbindung via StartTLS.
- Just-in-Time Provisioning: Automatische Account-Erstellung beim ersten LDAP-Login.
- Automatisches Rollen-Mapping: Zuweisung von Student / Employee via Regex-Prüfung der FH-Kennung.

Epic 2: Intelligente Suche (Thesaurus)

- Semantic Search: Anbindung der OpenThesaurus REST-API.
- Echtzeit-Synonym-Erweiterung bei Suchanfragen (z. B. "Feuer" findet auch "Brandverordnung").
- Dynamisch erweiterte SQL-Abfragen für deutlich höhere Trefferquoten.
- Frontend, UX & Core-Features
- Tag-Based Filtering & Subscriptions: Personalisierter News-Feed basierend auf abonnierten Themen und der eigenen LDAP-Rolle.
- Modernes UI: Optimiertes Feed-Layout ("Wer spricht?" vor "Was wird gesagt?") inklusive visueller Tag-Hashtags.
- Real-Time Updates: Das Frontend pollt regelmäßig nach neuen Nachrichten.
- Content Creation: Create messages and new tags directly from the UI.

## Project Status
The project currently provides a fully working end-to-end prototype:
Frontend ↔ Backend ↔ Database communication is fully implemented.
Authentication and security basics (password hashing & LDAP integration) are implemented.
Tagging logic (Many-to-Many relations & Thesaurus search) is fully functional.

## Future Improvements
True Real-Time: Replace polling with WebSockets for instant updates.
Admin Dashboard: UI to delete messages or manage users.
File Uploads: Allow images or attachments in messages.
Automated Tests: Unit and Integration tests.

## About This Project
This project was developed as part of a university course (Innovation Lab).
Some implementation decisions prioritize clarity and ease of evaluation over production-grade security practices.
