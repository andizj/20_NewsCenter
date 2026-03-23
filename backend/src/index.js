require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { pool } = require("./db");

const app = express();
const port = process.env.PORT || 3000;

let clients = [];

const broadcaster = (data) => {
  clients.forEach((client) => {
    if (client.tag && data.tags && !data.tags.includes(client.tag)) {
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
      url: "http://localhost:" + port,
    },
  ],
  paths: {
    "/subscribe": {
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
    "/tags": {
      get: {
        summary: "Alle Tags auflisten",
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

app.use(cors());
app.use(express.json());

// Swagger UI unter /api-docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/users", usersRouter);
app.use("/tags", tagsRouter);
app.use("/messages", messagesRouter);

app.get("/subscribe", (req, res) => {
  const { tag } = req.query;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
  });

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res,
    tag,
  };
  clients.push(newClient);

  const initialData = {
    message: `Connected to NewsCenter Live Feed. ${
      tag ? "Filtering by tag: " + tag : "No tag filter applied."
    }`,
    clientId,
  };
  res.write(`data: ${JSON.stringify(initialData)}\n\n`);

  req.on("close", () => {
    console.log(`[SSE] ${clientId} Connection closed.`);
    clients = clients.filter((client) => client.id !== clientId);
  });
});

app.get("/", (req, res) => {
  res.json({ message: "NewsCenter backend is running" });
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
