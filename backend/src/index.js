require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { setupSwagger } = require("../swagger");
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

// Swagger UI (Doku in backend/swagger.js)
setupSwagger(app, { port, apiPrefix: API_PREFIX });

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
