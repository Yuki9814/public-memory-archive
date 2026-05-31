import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAiRoutes } from "./routes/ai.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPublicRoutes } from "./routes/public.js";
import { requireAdmin } from "./lib/auth.js";
import { isOriginAllowed } from "./lib/cors-origin.js";
import { resolveLogLevel } from "./lib/log-level.js";
import { getRateLimitConfig } from "./lib/rate-limit-config.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: resolveLogLevel(process.env.LOG_LEVEL)
    }
  });

  await app.register(cors, {
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    credentials: true
  });

  await app.register(rateLimit, getRateLimitConfig());

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Public Memory Archive API",
        version: "0.1.0",
        description:
          "Public and admin APIs for a restrained public-event evidence archive."
      },
      tags: [
        { name: "public", description: "Public archive APIs" },
        { name: "admin", description: "Editorial and moderation APIs" },
        { name: "ai", description: "Suggestion-only AI helper APIs" }
      ]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  app.get("/health", async () => ({ ok: true }));

  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/admin/")) {
      return requireAdmin(request, reply);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.errors
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  });

  await registerAuthRoutes(app);
  await registerPublicRoutes(app);
  await registerAdminRoutes(app);
  await registerAiRoutes(app);

  return app;
}
