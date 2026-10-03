# Innolab 3 Sprint 2

## Ziel

Vollständige Entkopplung der Backend-Services von der Benutzeroberfläche (Frontend-Unabhängigkeit).

---

## 1. CORS – Konfigurierbar per ENV

**Problem:** `app.use(cors())` erlaubte alle Origins unkontrolliert.

**Lösung:** Origin-Whitelist über `ALLOWED_ORIGIN` (ENV):

```js
// backend/src/index.js
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "*").split(",").map(o => o.trim());
app.use(cors({ origin: ..., methods: [...], allowedHeaders: [...], credentials: true }));
```

| Datei | Änderung |
|---|---|
| `backend/.env` | `ALLOWED_ORIGIN=http://localhost:8081` |
| `docker-compose.yml` | `- ALLOWED_ORIGIN=http://localhost:8081` |

> Für Produktion: `ALLOWED_ORIGIN=https://meine-app.at` (kommasepariert für mehrere Domains)

---

## 2. API-Versioning – `/api/v1/...`

**Problem:** Alle Endpunkte lagen auf dem Root-Pfad – Breaking Changes erfordern simultane Frontend-Anpassung.

**Lösung:** Alle Routen unter `/api/v1` versioniert:

```js
// backend/src/index.js
const API_PREFIX = "/api/v1";
app.use(`${API_PREFIX}/users`,    usersRouter);
app.use(`${API_PREFIX}/tags`,     tagsRouter);
app.use(`${API_PREFIX}/messages`, messagesRouter);
```

```js
// frontend/src/services/api.js
baseURL: (process.env.VUE_APP_API_URL || 'http://localhost:3000') + '/api/v1'
```

**Ausnahme:** `/subscribe` (SSE) bleibt ohne Prefix – `EventSource` im Browser unterstützt keine Custom-Headers.

---

## 3. Swagger / OpenAPI – Vollständige Dokumentation

**Problem:** Die meisten Endpunkte fehlten in der Swagger-Spec – externe Systeme konnten die API nicht vollständig aus der Doku ableiten.

**Lösung:** Alle Endpunkte vollständig in `backend/swagger.js` dokumentiert und via `setupSwagger()` eingebunden:

| Gruppe | Endpunkte |
|---|---|
| **Users** | `GET /users`, `POST /users`, `POST /users/login`, `GET /users/{id}` |
| **Subscriptions** | `GET /users/{id}/subscriptions`, `POST /users/{id}/subscriptions`, `DELETE /users/{id}/subscriptions/{tagId}` |
| **Tags** | `GET /tags`, `POST /tags`, `GET /tags/{id}` |
| **Messages** | `GET /messages`, `POST /messages`, `GET /messages/{id}`, `GET /messages/search` |
| **Messages** | `POST /messages/{id}/tags`, `POST /messages/{id}/summarize`, `POST /messages/tag-suggestions` |
| **SSE** | `GET /subscribe` |

Zusätzlich ergänzt:
- **`components/schemas`**: wiederverwendbare Schemas für `User`, `Message`, `Tag`, `Error`
- **`securitySchemes`**: `BearerAuth` (JWT) – alle geschützten Endpunkte mit `security`-Referenz
- **Tag-Gruppierung**: Endpunkte in `Users`, `Subscriptions`, `Tags`, `Messages`, `SSE` gegliedert

Erreichbar unter: `http://localhost:3000/api-docs`

---

## 4. Swagger-Auslagerung – `swagger.js`

**Problem:** Die vollständige OpenAPI-Spec (~350 Zeilen JSON) war direkt in `backend/src/index.js` eingebettet → Datei hatte 574 Zeilen, schlecht wartbar.

**Lösung:** Swagger-Doku in `backend/swagger.js` ausgelagert:

```js
// backend/swagger.js
function setupSwagger(app, { port, apiPrefix }) { ... }
module.exports = { setupSwagger };

// backend/src/index.js
const { setupSwagger } = require("../swagger");
setupSwagger(app, { port, apiPrefix: API_PREFIX });
```

| | Vorher | Nachher |
|---|---|---|
| `index.js` | 574 Zeilen | **121 Zeilen** |
| `swagger.js` | 55 Zeilen (veraltet) | **~360 Zeilen** (vollständig) |

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `backend/src/index.js` | CORS-Whitelist + `/api/v1`-Prefix + SSE-Header bereinigt → Swagger ausgelagert (121 Zeilen) |
| `backend/swagger.js` | Vollständige OpenAPI-Spec mit allen Endpunkten, Schemas und Auth |
| `backend/.env` | `ALLOWED_ORIGIN` hinzugefügt |
| `docker-compose.yml` | `ALLOWED_ORIGIN` als ENV-Variable |
| `frontend/src/services/api.js` | `baseURL` um `/api/v1` erweitert |
| `frontend/src/services/sseService.js` | Kommentar zur SSE-Ausnahme ergänzt |
| `documentation.md` | Dieses Dokument |
