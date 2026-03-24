// backend/src/swagger.js
const swaggerUi = require("swagger-ui-express");

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "NewsCenter API",
    version: "1.0.0",
    description: "Simple API-Doku für das NewsCenter-Projekt",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Lokaler Dev-Server",
    },
  ],
  paths: {
    "/db-check": {
      get: {
        summary: "Checkt die Verbindung zur Datenbank",
        description:
          "Gibt den aktuellen Server-Zeitstempel zurück, wenn die DB erreichbar ist.",
        responses: {
          200: {
            description: "Datenbank ist erreichbar",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    time: {
                      type: "string",
                      example: "2025-11-17T10:15:30.000Z",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Datenbank nicht erreichbar / interner Fehler",
          },
        },
      },
    },
  },
};

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

module.exports = { setupSwagger };
