import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "electron/main.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: path.join(root, "dist-electron/main.js"),
  external: ["electron", "vosk", "audio-decode"],
  tsconfig: path.join(root, "tsconfig.json"),
  sourcemap: true,
});

await esbuild.build({
  entryPoints: [path.join(root, "electron/preload.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: path.join(root, "dist-electron/preload.js"),
  external: ["electron", "vosk", "audio-decode"],
  tsconfig: path.join(root, "tsconfig.json"),
  sourcemap: true,
});

console.log("Electron build complete.");
