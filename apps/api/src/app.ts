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
import { validateAdminCsrf } from "./lib/auth.js";
import { getConfiguredCorsOrigin, isOriginAllowed } from "./lib/cors-origin.js";
import { resolveLogLevel } from "./lib/log-level.js";
import { getRateLimitConfig } from "./lib/rate-limit-config.js";

export async function buildApp() {
  if (process.env.NODE_ENV === "production") {
    getConfiguredCorsOrigin();
  }

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

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self'"
      ].join("; ")
    );
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/admin/")) {
      const authResult = await requireAdmin(request, reply);
      if (authResult) return authResult;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        const fetchSite = request.headers["sec-fetch-site"];
        if (fetchSite === "cross-site") {
          return reply.code(403).send({ error: "CSRF_FORBIDDEN" });
        }
        const origin = request.headers.origin;
        const referer = request.headers.referer;
        if (typeof origin === "string" && !isOriginAllowed(origin)) {
          return reply.code(403).send({ error: "CSRF_ORIGIN_FORBIDDEN" });
        }
        if (!origin && typeof referer === "string") {
          try {
            if (!isOriginAllowed(new URL(referer).origin)) {
              return reply.code(403).send({ error: "CSRF_REFERER_FORBIDDEN" });
            }
          } catch {
            return reply.code(403).send({ error: "CSRF_REFERER_FORBIDDEN" });
          }
        }
        if (!validateAdminCsrf(request)) {
          return reply.code(403).send({ error: "CSRF_TOKEN_REQUIRED" });
        }
      }
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
