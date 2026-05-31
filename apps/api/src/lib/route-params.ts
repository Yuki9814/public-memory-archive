import type { FastifyRequest } from "fastify";

export function getIdParam(request: FastifyRequest): string {
  return (request.params as { id: string }).id;
}

export function getSlugParam(request: FastifyRequest): string {
  return (request.params as { slug: string }).slug;
}

export function getTaskIdParam(request: FastifyRequest): string {
  return (request.params as { taskId: string }).taskId;
}
