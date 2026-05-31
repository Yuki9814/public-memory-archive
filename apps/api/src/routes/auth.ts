import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  adminDisplayName,
  adminUserId,
  createAdminSession,
  getAdminSession,
  serializeAdminSessionCookie,
  serializeClearAdminSessionCookie,
  validateAdminPasscode
} from "../lib/auth.js";

const adminLoginSchema = z.object({
  passcode: z.string().min(1).max(256)
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/session", { schema: { tags: ["public"] } }, async (request) => {
    return getAdminSession(request) ?? { role: "GUEST" };
  });

  app.post("/api/auth/admin-login", { schema: { tags: ["public"] } }, async (request, reply) => {
    const body = adminLoginSchema.parse(request.body);
    const result = validateAdminPasscode(body.passcode);
    if (result.reason === "not_configured") {
      return reply.code(503).send({ error: "ADMIN_AUTH_NOT_CONFIGURED" });
    }
    if (!result.ok) {
      return reply.code(401).send({ error: "INVALID_ADMIN_PASSCODE" });
    }

    const userId = adminUserId();
    const token = createAdminSession(userId);
    reply.header("Set-Cookie", serializeAdminSessionCookie(token));
    return {
      role: "ADMIN",
      displayName: adminDisplayName(),
      ...(userId ? { userId } : {})
    };
  });

  app.post("/api/auth/logout", { schema: { tags: ["public"] } }, async (_request, reply) => {
    reply.header("Set-Cookie", serializeClearAdminSessionCookie());
    return { role: "GUEST" };
  });
}
