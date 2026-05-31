import { writeFile } from "node:fs/promises";
import { buildApp } from "./app.js";

const app = await buildApp();
await app.ready();
const spec = app.swagger();
await writeFile("openapi.json", `${JSON.stringify(spec, null, 2)}\n`, "utf8");
await app.close();
console.log("Wrote openapi.json");
