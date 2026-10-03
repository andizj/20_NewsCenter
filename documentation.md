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

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `backend/src/index.js` | CORS-Whitelist + `/api/v1`-Prefix + SSE-Header bereinigt |
| `backend/.env` | `ALLOWED_ORIGIN` hinzugefügt |
| `docker-compose.yml` | `ALLOWED_ORIGIN` als ENV-Variable |
| `frontend/src/services/api.js` | `baseURL` um `/api/v1` erweitert |
| `frontend/src/services/sseService.js` | Kommentar zur SSE-Ausnahme ergänzt |
