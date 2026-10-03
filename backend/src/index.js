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

// --- Simple OpenAPI / Swagger definition ---
const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "NewsCenter API",
    version: "1.0.0",
    description:
      "Einfache Dokumentation der wichtigsten Endpunkte für NewsCenter.",
  },
  servers: [
    {
      url: "http://localhost:" + port + API_PREFIX,
    },
  ],
  paths: {
    "/subscribe": {  // bleibt außerhalb des Prefixes – SSE-Standard
      get: {
        summary: "Server-Sent-Events Feed abonnieren",
        description:
          "Stellt einen SSE-Stream bereit. Optional kann mit dem Query-Parameter `tag` nach einem Tag gefiltert werden.",
        parameters: [
          {
            name: "tag",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Optionaler Tag-Name zum Filtern der Nachrichten.",
          },
        ],
        responses: {
          200: {
            description: "SSE-Stream gestartet.",
          },
        },
      },
    },
    "/messages": {
      get: {
        summary: "Alle Nachrichten auflisten",
        responses: {
          200: {
            description: "Liste aller Nachrichten",
          },
        },
      },
      post: {
        summary: "Neue Nachricht erstellen",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["authorId", "title", "body"],
                properties: {
                  authorId: {
                    type: "string",
                    format: "uuid",
                  },
                  title: { type: "string" },
                  body: { type: "string" },
                },
              },
              example: {
                authorId: "uuid-of-user",
                title: "Welcome",
                body: "Hello students!",
              },
            },
          },
        },
        responses: {
          201: { description: "Nachricht erfolgreich erstellt" },
          400: { description: "Fehlende Pflichtfelder" },
        },
      },
    },
    "/messages/tag-suggestions": {
      post: {
        summary: "Tag-Vorschläge für einen Nachrichtenentwurf (Publish Agent)",
        description:
          "Gibt Tag-Vorschläge passend zu Titel/Body zurück. Bestehende Tags kommen zuerst (inkl. `subscriberCount`), nur wenn kein bestehender Tag passt werden neue Tags (`type: \"new\"`) vorgeschlagen. Authentifizierung wie bei den geschützten Message-Endpunkten erforderlich.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  body: { type: "string" },
                },
              },
              example: {
                title: "Fire drill tomorrow",
                body: "There will be a fire drill tomorrow at 10:00.",
              },
            },
          },
        },
        responses: {
          200: {
            description:
              "Liste der Vorschläge ({ type, id?, name, subscriberCount, reason })",
          },
          400: { description: "Titel und Body fehlen" },
          401: { description: "Nicht authentifiziert" },
        },
      },
    },
    "/tags": {
      get: {
        summary: "Alle Tags auflisten",
        description:
          "Jeder Tag enthält zusätzlich `subscriberCount` (aktuelle Anzahl der Abonnenten aus der subscriptions-Tabelle).",
        responses: {
          200: { description: "Liste aller Tags" },
        },
      },
      post: {
        summary: "Neuen Tag anlegen",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
              example: {
                name: "it",
                description: "IT Updates",
              },
            },
          },
        },
        responses: {
          201: { description: "Tag erfolgreich erstellt" },
          400: { description: "Validation-Fehler" },
        },
      },
    },
    "/users/{id}/subscriptions": {
      get: {
        summary: "Abonnierte Tags eines Users anzeigen",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "User-ID",
          },
        ],
        responses: {
          200: {
            description: "Liste der abonnierten Tags",
          },
          400: { description: "Ungültige User-ID" },
          404: { description: "User nicht gefunden" },
        },
      },
      post: {
        summary: "User auf einen Tag subscriben",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tagId"],
                properties: {
                  tagId: { type: "string", format: "uuid" },
                },
              },
              example: {
                tagId: "uuid-of-tag",
              },
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
