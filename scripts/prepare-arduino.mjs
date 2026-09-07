import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import extractZip from "@electron-internal/extract-zip";
import { x as extractTar } from "tar";

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
const platformKey = `${process.platform}-${process.arch}`;
const platform = manifest.platforms[platformKey];

if (!platform) {
  throw new Error(`Arduino toolchain preparation is unsupported on ${platformKey}.`);
}

const cacheDirectory = path.join(repositoryRoot, ".cache", "arduino");
const archiveName = path.basename(new URL(platform.url).pathname);
const archivePath = path.join(cacheDirectory, archiveName);
const stagingRoot = path.join(
  repositoryRoot,
  "vendor",
  "arduino",
  platformKey,
);
const executablePath = path.join(stagingRoot, "cli", platform.executable);
const seedManifestPath = path.join(stagingRoot, "seed-manifest.json");

async function sha256(filePath) {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

async function downloadArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  try {
    if ((await sha256(archivePath)) === platform.sha256) return;
  } catch {
    // The archive is not cached yet.
  }

  const response = await fetch(platform.url);
  if (!response.ok) {
    throw new Error(
      `Could not download Arduino CLI: ${response.status} ${response.statusText}`,
    );
  }
  const contents = Buffer.from(await response.arrayBuffer());
  const checksum = createHash("sha256").update(contents).digest("hex");
  if (checksum !== platform.sha256) {
    throw new Error(
      `Arduino CLI checksum mismatch: expected ${platform.sha256}, received ${checksum}.`,
    );
  }

  const temporaryArchive = `${archivePath}.${process.pid}.tmp`;
  await writeFile(temporaryArchive, contents);
  await rm(archivePath, { force: true });
  await rename(temporaryArchive, archivePath);
}

function runCli(args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, {
      env: environment,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Arduino CLI exited with code ${code}.`));
    });
  });
}

async function stagingIsReady() {
  try {
    const stagedManifest = JSON.parse(await readFile(seedManifestPath, "utf8"));
    await access(executablePath);
    await access(
      path.join(
        stagingRoot,
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
      await access(
        path.join(
          stagingRoot,
          "data",
          "packages",
          packager,
          "tools",
          name,
          version,
        ),
      );
    }
    return JSON.stringify(stagedManifest) === JSON.stringify(manifest);
  } catch {
    return false;
  }
}

if (await stagingIsReady()) {
  console.log(`Arduino toolchain ${manifest.toolchainId} is already prepared.`);
  process.exit(0);
}

console.log(`Preparing Arduino toolchain ${manifest.toolchainId} for ${platformKey}…`);
await downloadArchive();
await rm(stagingRoot, { recursive: true, force: true });
await mkdir(path.join(stagingRoot, "cli"), { recursive: true });

if (platform.archiveType === "zip") {
  await extractZip(archivePath, { dir: path.join(stagingRoot, "cli") });
} else if (platform.archiveType === "tar.gz") {
  await extractTar({
    file: archivePath,
    cwd: path.join(stagingRoot, "cli"),
  });
} else {
  throw new Error(`Unknown Arduino CLI archive type: ${platform.archiveType}`);
}

if (process.platform !== "win32") await chmod(executablePath, 0o755);

const environment = {
  ...process.env,
  ARDUINO_DIRECTORIES_DATA: path.join(stagingRoot, "data"),
  ARDUINO_DIRECTORIES_DOWNLOADS: path.join(stagingRoot, "downloads"),
  ARDUINO_DIRECTORIES_USER: path.join(stagingRoot, "user"),
  ARDUINO_BUILD_CACHE_PATH: path.join(stagingRoot, "cache"),
  ARDUINO_UPDATER_ENABLE_NOTIFICATION: "false",
  ARDUINO_NETWORK_CLOUD_API_SKIP_BOARD_DETECTION_CALLS: "true",
};

await runCli(["version"], environment);
await runCli(["core", "update-index"], environment);
await runCli(
  ["core", "install", manifest.corePackage, "--skip-post-install"],
  environment,
);
await runCli(["core", "list"], environment);

for (const [tool, version] of Object.entries(manifest.tools)) {
  const [packager, name] = tool.split(":");
  try {
    await access(
      path.join(
        stagingRoot,
        "data",
        "packages",
        packager,
        "tools",
        name,
        version,
      ),
    );
  } catch {
    throw new Error(
      `Arduino tool ${tool}@${version} was not installed. Update the pinned toolchain manifest intentionally.`,
    );
  }
}

const smokeRoot = await mkdtemp(path.join(tmpdir(), "racecar-arduino-smoke-"));
try {
  const sketchDirectory = path.join(smokeRoot, "smoke");
  const buildDirectory = path.join(smokeRoot, "build");
  await mkdir(sketchDirectory, { recursive: true });
  await writeFile(
    path.join(sketchDirectory, "smoke.ino"),
    "void setup() {}\nvoid loop() {}\n",
    "utf8",
  );
  await runCli(
    [
      "compile",
      "--fqbn",
      manifest.fqbn,
      "--build-path",
      buildDirectory,
      sketchDirectory,
    ],
    environment,
  );
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}

await Promise.all([
  rm(path.join(stagingRoot, "downloads"), { recursive: true, force: true }),
  rm(path.join(stagingRoot, "user"), { recursive: true, force: true }),
  rm(path.join(stagingRoot, "cache"), { recursive: true, force: true }),
  rm(path.join(stagingRoot, "data", "staging"), {
    recursive: true,
    force: true,
  }),
  rm(path.join(stagingRoot, "data", "inventory.yaml"), { force: true }),
]);
await cp(
  path.join(repositoryRoot, "THIRD_PARTY_NOTICES.md"),
  path.join(stagingRoot, "THIRD_PARTY_NOTICES.md"),
);
await writeFile(seedManifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(`Arduino toolchain prepared at ${stagingRoot}.`);
