import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const platformKey = process.argv[2];
if (!platformKey) {
  throw new Error("Usage: node scripts/assert-arduino-toolchain.mjs <platform>-<arch>");
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const manifest = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "electron", "arduino-toolchain.json"),
    "utf8",
  ),
);
const platform = manifest.platforms[platformKey];
if (!platform) {
  throw new Error(`Arduino toolchain preparation is unsupported on ${platformKey}.`);
}

const root = path.join(repositoryRoot, "vendor", "arduino", platformKey);
const stagedManifest = JSON.parse(
  await readFile(path.join(root, "seed-manifest.json"), "utf8"),
);
if (JSON.stringify(stagedManifest) !== JSON.stringify(manifest)) {
  throw new Error(`The staged Arduino toolchain for ${platformKey} is out of date.`);
}

await access(path.join(root, "cli", platform.executable));
await access(
  path.join(
    root,
    "data",
    "packages",
    "arduino",
    "hardware",
    "avr",
    manifest.coreVersion,
  ),
);
for (const [tool, version] of Object.entries(manifest.tools)) {
  const [packager, name] = tool.split(":");
  await access(path.join(root, "data", "packages", packager, "tools", name, version));
}

console.log(`Arduino toolchain ${manifest.toolchainId} is ready for ${platformKey}.`);
