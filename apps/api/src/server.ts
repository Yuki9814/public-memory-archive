import { buildApp } from "./app.js";
import { getApiListenConfig } from "./lib/listen-config.js";

const app = await buildApp();
const { host, port } = getApiListenConfig();

try {
  await app.listen({ host, port });
  app.log.info(`API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
