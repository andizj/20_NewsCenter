require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { pool } = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const API_PREFIX = "/api/v1";

let clients = [];

const broadcaster = (data) => {
  clients.forEach((client) => {
    // Role filtering: only send if message is for ALL or matches client role
    if (data.targetRole !== "ALL" && data.targetRole !== client.role) {
      return;
    }

    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

const usersRouter = require("./routes/users");
const tagsRouter = require("./routes/tags");
const messagesRouter = require("./routes/messages")(broadcaster);

// --- OpenAPI / Swagger definition (vollständig) ---
const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "NewsCenter API",
    version: "1.0.0",
    description: "Vollständige Dokumentation aller NewsCenter-Endpunkte.",
  },
  servers: [
    {
      url: "http://localhost:" + port + API_PREFIX,
      description: "Lokaler Dev-Server (versioniert)",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT-Token, erhalten über POST /api/v1/users/login",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Fehlermeldung" },
        },
      },
      Tag: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "it" },
          description: { type: "string", example: "IT Updates", nullable: true },
          subscriberCount: { type: "integer", example: 3 },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          authorId: { type: "string", format: "uuid" },
          targetRole: { type: "string", enum: ["ALL", "STUDENT", "EMPLOYEE"] },
          title: { type: "string", example: "Wichtige Ankündigung" },
          body: { type: "string", example: "Nachrichtentext..." },
          createdAt: { type: "string", format: "date-time" },
          tags: { type: "array", items: { $ref: "#/components/schemas/Tag" } },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          displayName: { type: "string", example: "Max Mustermann" },
          role: { type: "string", enum: ["STUDENT", "EMPLOYEE"] },
        },
      },
    },
  },
  paths: {
    // ─── USERS ────────────────────────────────────────────────────────────────
    "/users": {
      get: {
        tags: ["Users"],
        summary: "Alle User auflisten",
        responses: {
          200: {
            description: "Liste aller User (ohne Passwort-Hash)",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/User" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Neuen lokalen User registrieren",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["displayName", "email", "password"],
                properties: {
                  displayName: { type: "string", example: "Max Mustermann" },
                  email: { type: "string", format: "email", example: "max@example.at" },
                  password: { type: "string", minLength: 8, example: "sicheres_passwort" },
                  role: { type: "string", enum: ["STUDENT", "EMPLOYEE"], default: "STUDENT" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "User erfolgreich erstellt",
            content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
          },
          400: { description: "Fehlende / ungültige Felder", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          409: { description: "E-Mail bereits vergeben", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/users/login": {
      post: {
        tags: ["Users"],
        summary: "Login (Lokal DB → LDAP-Fallback)",
        description: "Versucht zuerst einen lokalen Login (bcrypt). Bei Misserfolg wird LDAP (Technikum Wien) als Fallback verwendet. LDAP-User werden beim ersten Login automatisch in der DB angelegt (JIT-Provisioning).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "if22b001@technikum-wien.at" },
                  password: { type: "string", example: "mein_passwort" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login erfolgreich – JWT-Token im Response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Login erfolgreich" },
                    token: { type: "string", example: "eyJhbGci..." },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          400: { description: "Fehlende Felder", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Ungültige Anmeldedaten", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Einzelnen User abrufen",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "User-Objekt", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          400: { description: "Ungültige UUID" },
          404: { description: "User nicht gefunden" },
        },
      },
    },
    "/users/{id}/subscriptions": {
      get: {
        tags: ["Subscriptions"],
        summary: "Abonnierte Tags eines Users anzeigen",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "User-ID" },
        ],
        responses: {
          200: { description: "Liste der abonnierten Tags", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Tag" } } } } },
          400: { description: "Ungültige User-ID" },
          404: { description: "User nicht gefunden" },
        },
      },
      post: {
        tags: ["Subscriptions"],
        summary: "User auf einen Tag subscriben",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["tagId"], properties: { tagId: { type: "string", format: "uuid" } } },
              example: { tagId: "uuid-of-tag" },
            },
          },
        },
        responses: {
          201: { description: "Subscription angelegt" },
          200: { description: "Subscription existierte bereits" },
          400: { description: "Ungültige IDs / fehlende Daten" },
          404: { description: "User oder Tag nicht gefunden" },
        },
      },
    },
    "/users/{id}/subscriptions/{tagId}": {
      delete: {
        tags: ["Subscriptions"],
        summary: "Subscription eines Users auf einen Tag entfernen",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "User-ID" },
          { name: "tagId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Tag-ID" },
        ],
        responses: {
          200: { description: "Erfolgreich deabonniert oder Subscription war bereits weg" },
          400: { description: "Ungültige UUID(s)" },
        },
      },
    },
    // ─── TAGS ─────────────────────────────────────────────────────────────────
    "/tags": {
      get: {
        tags: ["Tags"],
        summary: "Alle Tags auflisten",
        description: "Jeder Tag enthält `subscriberCount` (Anzahl der aktuellen Abonnenten).",
        responses: {
          200: { description: "Liste aller Tags", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Tag" } } } } },
        },
      },
      post: {
        tags: ["Tags"],
        summary: "Neuen Tag anlegen",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } } },
              example: { name: "it", description: "IT Updates" },
            },
          },
        },
        responses: {
          201: { description: "Tag erfolgreich erstellt", content: { "application/json": { schema: { $ref: "#/components/schemas/Tag" } } } },
          400: { description: "Fehlender Name" },
          409: { description: "Tag-Name bereits vorhanden" },
        },
      },
    },
    "/tags/{id}": {
      get: {
        tags: ["Tags"],
        summary: "Einzelnen Tag abrufen",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Tag-Objekt", content: { "application/json": { schema: { $ref: "#/components/schemas/Tag" } } } },
          400: { description: "Ungültige UUID" },
          404: { description: "Tag nicht gefunden" },
        },
      },
    },
    // ─── MESSAGES ─────────────────────────────────────────────────────────────
    "/messages": {
      get: {
        tags: ["Messages"],
        summary: "Nachrichtenfeed abrufen (Auth required)",
        description: "Gibt Nachrichten zurück, gefiltert nach Rolle und Subscriptions des eingeloggten Users.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "tag", in: "query", schema: { type: "string" }, description: "Nachrichten auf diesen Tag-Namen einschränken" },
          { name: "filter", in: "query", schema: { type: "string", enum: ["subscribed"] }, description: "filter=subscribed zeigt nur abonnierte Tags" },
        ],
        responses: {
          200: { description: "Gefilterter Nachrichtenfeed", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Message" } } } } },
          401: { description: "Nicht authentifiziert", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Messages"],
        summary: "Neue Nachricht erstellen (Auth required)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "body"],
                properties: {
                  title: { type: "string", example: "Wichtige Ankündigung" },
                  body: { type: "string", example: "Details zur Ankündigung..." },
                  targetRole: { type: "string", enum: ["ALL", "STUDENT", "EMPLOYEE"], default: "ALL" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Nachricht erstellt", content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } } },
          400: { description: "Fehlende Pflichtfelder" },
          401: { description: "Nicht authentifiziert" },
        },
      },
    },
    "/messages/search": {
      get: {
        tags: ["Messages"],
        summary: "Nachrichten per Thesaurus-Suche finden (Auth required)",
        description: "Sucht Nachrichten anhand eines Suchbegriffs. Die Suche wird via openthesaurus.de um Synonyme erweitert.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Suchbegriff (wird automatisch mit Synonymen erweitert)" },
        ],
        responses: {
          200: { description: "Treffer-Liste", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Message" } } } } },
          400: { description: "Kein Suchbegriff angegeben" },
          401: { description: "Nicht authentifiziert" },
        },
      },
    },
    "/messages/tag-suggestions": {
      post: {
        tags: ["Messages"],
        summary: "Tag-Vorschläge für einen Nachrichtenentwurf (Publish Agent, Auth required)",
        description: "Schlägt passende Tags zu einem Nachrichtenentwurf vor. Bestehende Tags (inkl. `subscriberCount`) kommen zuerst. Neue Tag-Kandidaten werden nur vorgeschlagen, wenn kein bestehender Tag passt.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "body"],
                properties: {
                  title: { type: "string", example: "Fire drill tomorrow" },
                  body: { type: "string", example: "There will be a fire drill tomorrow at 10:00." },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Liste der Vorschläge",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string", enum: ["existing", "new"] },
                          id: { type: "string", format: "uuid", description: "Nur bei type=existing" },
                          name: { type: "string" },
                          subscriberCount: { type: "integer" },
                          reason: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Titel und Body fehlen" },
          401: { description: "Nicht authentifiziert" },
        },
      },
    },
    "/messages/{id}": {
      get: {
        tags: ["Messages"],
        summary: "Einzelne Nachricht abrufen (Auth required)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Nachricht", content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } } },
          401: { description: "Nicht authentifiziert" },
          404: { description: "Nachricht nicht gefunden oder nicht sichtbar für diese Rolle" },
        },
      },
    },
    "/messages/{id}/tags": {
      post: {
        tags: ["Messages"],
        summary: "Tag einer Nachricht zuweisen (Auth required)",
        description: "Weist der Nachricht einen Tag zu. Löst danach einen SSE-Broadcast an alle verbundenen Clients aus.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Message-ID" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["tagId"], properties: { tagId: { type: "string", format: "uuid" } } },
              example: { tagId: "uuid-of-tag" },
            },
          },
        },
        responses: {
          201: { description: "Tag erfolgreich zugewiesen" },
          400: { description: "tagId fehlt" },
          401: { description: "Nicht authentifiziert" },
          409: { description: "Nachricht hat diesen Tag bereits" },
        },
      },
    },
    "/messages/{id}/summarize": {
      post: {
        tags: ["Messages"],
        summary: "KI-Zusammenfassung einer Nachricht generieren (Auth required)",
        description: "Generiert eine kurze KI-Zusammenfassung (max. 3 Sätze) der Nachricht via Ollama (Modell: llama3.2:3b). Nur sichtbar für die Rolle des eingeloggten Users.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: {
            description: "Zusammenfassung",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { summary: { type: "string", example: "Diese Nachricht handelt von einem Feuerwehrübung morgen um 10 Uhr." } },
                },
              },
            },
          },
          401: { description: "Nicht authentifiziert" },
          404: { description: "Nachricht nicht gefunden" },
        },
      },
    },
    // ─── SSE ──────────────────────────────────────────────────────────────────
    "/subscribe": {
      get: {
        tags: ["SSE"],
        summary: "Server-Sent-Events Feed abonnieren",
        description: "Öffnet einen persistenten SSE-Stream. Der JWT muss als Query-Parameter übergeben werden, da `EventSource` im Browser keine Custom-HTTP-Headers unterstützt. Nachrichten werden rollenbasiert gefiltert (targetRole).",
        parameters: [
          { name: "token", in: "query", required: true, schema: { type: "string" }, description: "JWT-Token (erhalten via POST /api/v1/users/login)" },
        ],
        responses: {
          200: { description: "SSE-Stream aktiv (Content-Type: text/event-stream)" },
          401: { description: "Token fehlt oder ist ungültig" },
        },
      },
    },
  },
};

// CORS – Origin über ENV konfigurierbar; mehrere Origins als kommaseparierte Liste möglich
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length === 1 && allowedOrigins[0] === "*"
      ? "*"
      : (origin, cb) => {
          // Requests ohne Origin (z.B. curl, Postman) immer erlauben
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          cb(new Error(`CORS: Origin '${origin}' not allowed`));
        },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

// Swagger UI unter /api-docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Versionierte API-Routen
app.use(`${API_PREFIX}/users`, usersRouter);
app.use(`${API_PREFIX}/tags`, tagsRouter);
app.use(`${API_PREFIX}/messages`, messagesRouter);

// SSE bleibt absichtlich außerhalb des /api/v1-Prefixes,
// da EventSource im Browser keine custom Headers unterstützt.
app.get("/subscribe", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  let userPayload;
  try {
    const jwt = require("jsonwebtoken");
    userPayload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // CORS wird bereits durch die globale cors()-Middleware gesetzt;
  // kein manueller Access-Control-Allow-Origin-Header mehr nötig.
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res,
    userId: userPayload.userId,
    role: userPayload.role,
  };
  clients.push(newClient);

  const initialData = {
    message: "Connected to NewsCenter Live Feed.",
    clientId,
  };
  res.write(`data: ${JSON.stringify(initialData)}\n\n`);

  req.on("close", () => {
    console.log(`[SSE] ${clientId} Connection closed.`);
    clients = clients.filter((client) => client.id !== clientId);
  });
});

app.get("/", (req, res) => {
  res.json({ message: "NewsCenter backend is running", apiPrefix: API_PREFIX });
});

app.get("/db-check", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ status: "ok", time: result.rows[0].now });
  } catch (err) {
    console.error("DB error:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
