const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const fsConstants = require("node:fs").constants;
const path = require("node:path");
const manifest = require("./arduino-toolchain.json");

const MAX_CODE_LENGTH = 1024 * 1024;
const MAX_CAPTURED_OUTPUT = 256 * 1024;
const DEFAULT_CLI_TIMEOUTS = Object.freeze({
  discovery: 15_000,
  compile: 120_000,
  upload: 90_000,
});
const TIMEOUT_TERMINATION_GRACE_MS = 2_000;

function platformDirectory(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  if (manifest.platforms[key]) return key;
  throw new Error(`Arduino uploads are not packaged for ${key}.`);
}

function appendCaptured(current, chunk, limit = MAX_CAPTURED_OUTPUT) {
  const combined = current + String(chunk);
  return combined.length <= limit ? combined : combined.slice(-limit);
}

function parseDetectedPorts(stdout) {
  let document;
  try {
    document = JSON.parse(stdout);
  } catch {
    throw new Error("Arduino CLI returned an unreadable board list.");
  }

  const detectedPorts = Array.isArray(document?.detected_ports)
    ? document.detected_ports
    : Array.isArray(document)
      ? document
      : [];

  return detectedPorts
    .map((entry) => {
      const port = entry?.port ?? entry;
      if (
        !port ||
        typeof port.address !== "string" ||
        port.address.length === 0 ||
        (port.protocol && port.protocol !== "serial")
      ) {
        return null;
      }

      return {
        address: port.address,
        label:
          typeof port.label === "string" && port.label
            ? port.label
            : port.address,
      };
    })
    .filter(Boolean);
}

function validateUploadRequest(request) {
  if (!request || typeof request.code !== "string" || !request.code.trim()) {
    throw new Error("There is no generated Arduino code to upload.");
  }
  if (request.code.length > MAX_CODE_LENGTH) {
    throw new Error("The generated Arduino code is too large to upload.");
  }
  if (
    typeof request.port !== "string" ||
    request.port.length === 0 ||
    request.port.length > 512 ||
    /[\r\n\0]/.test(request.port)
  ) {
    throw new Error("Select a valid connected serial port.");
  }
}

function compileArguments(sketchDirectory, buildDirectory) {
  return [
    "compile",
    "--fqbn",
    manifest.fqbn,
    "--build-path",
    buildDirectory,
    "--warnings",
    "default",
    sketchDirectory,
  ];
}

function uploadArguments(port, sketchDirectory, buildDirectory) {
  return [
    "upload",
    "--fqbn",
    manifest.fqbn,
    "--port",
    port,
    "--build-path",
    buildDirectory,
    sketchDirectory,
  ];
}

function normalizeCliError(stage, output, error) {
  const details = String(output ?? "").trim();
  if (error?.code === "ENOENT") {
    return "Arduino CLI is missing from this application. Reinstall the app and try again.";
  }
  if (error?.code === "ETIMEDOUT") {
    return `Arduino ${stage} timed out. Reconnect the board and try again.`;
  }
  if (/permission denied|access is denied|can't open device|ser_open/i.test(details)) {
    return "The serial port could not be opened. Close other serial tools and check your USB permissions.";
  }
  if (/no device found|no new port found|programmer is not responding|not in sync/i.test(details)) {
    return "The Uno did not respond. Check the selected port and USB cable, then try again.";
  }
  if (stage === "compile") {
    return "The generated Arduino code did not compile. Open details for the compiler diagnostics.";
  }
  if (stage === "upload") {
    return "The sketch compiled, but it could not be uploaded. Open details for the uploader diagnostics.";
  }
  if (stage === "initialize") {
    return "The bundled Arduino tools could not be prepared. Reinstall the app and try again.";
  }
  return details || "Arduino CLI could not complete the request.";
}

function terminateProcessTree(child, platform, signal) {
  if (!child) return;

  const pid = child.pid;
  if (platform === "win32" && Number.isInteger(pid) && pid > 0) {
    // taskkill's /T includes any compiler/uploader children spawned by the CLI.
    const terminator = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    terminator.on("error", () => {
      try {
        child.kill(signal);
      } catch {
        // The process may already be gone.
      }
    });
    return;
  }

  try {
    // CLI processes are launched detached on POSIX, so their descendants share a group.
    if (Number.isInteger(pid) && pid > 0) {
      process.kill(-pid, signal);
      return;
    }
  } catch {
    // Fall back to the direct child below when it has already left its group.
  }

  try {
    child.kill(signal);
  } catch {
    // The process may already be gone.
  }
}

async function readJson(fileSystem, filePath) {
  try {
    return JSON.parse(await fileSystem.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function createArduinoService({
  app,
  spawnProcess = spawn,
  fileSystem = fs,
  platform = process.platform,
  arch = process.arch,
  resourcesPath = process.resourcesPath,
  cliTimeouts = DEFAULT_CLI_TIMEOUTS,
  timeoutTerminationGraceMs = TIMEOUT_TERMINATION_GRACE_MS,
} = {}) {
  const platformKey = platformDirectory(platform, arch);
  const platformManifest = manifest.platforms[platformKey];
  const children = new Set();
  let initialization;
  let uploadInProgress = false;

  function bundledRoot() {
    return app.isPackaged
      ? path.join(resourcesPath, "arduino")
      : path.join(app.getAppPath(), "vendor", "arduino", platformKey);
  }

  function executablePath() {
    return path.join(bundledRoot(), "cli", platformManifest.executable);
  }

  function runtimeRoot() {
    return path.join(
      app.getPath("userData"),
      "arduino",
      "toolchains",
      manifest.toolchainId,
    );
  }

  async function toolchainDataIsReady(root) {
    const installedManifest = await readJson(
      fileSystem,
      path.join(root, "seed-manifest.json"),
    );
    if (installedManifest?.toolchainId !== manifest.toolchainId) return false;
    try {
      await fileSystem.access(
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
        await fileSystem.access(
          path.join(
            root,
            "data",
            "packages",
            packager,
            "tools",
            name,
            version,
          ),
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  async function installBundledToolchain() {
    const sourceRoot = bundledRoot();
    if (!(await toolchainDataIsReady(sourceRoot))) {
      throw Object.assign(new Error("Bundled Arduino manifest is missing or invalid."), {
        cliStage: "initialize",
      });
    }
    try {
      await fileSystem.access(executablePath(), fsConstants.X_OK);
    } catch (error) {
      throw Object.assign(error, { cliStage: "initialize" });
    }

    const destination = runtimeRoot();
    if (await toolchainDataIsReady(destination)) return destination;

    const parent = path.dirname(destination);
    const temporary = `${destination}.installing-${process.pid}-${Date.now()}`;
    await fileSystem.mkdir(parent, { recursive: true });
    await fileSystem.rm(temporary, { recursive: true, force: true });

    try {
      await fileSystem.mkdir(temporary, { recursive: true });
      await fileSystem.cp(path.join(sourceRoot, "data"), path.join(temporary, "data"), {
        recursive: true,
      });
      await fileSystem.rm(path.join(temporary, "data", "inventory.yaml"), {
        force: true,
      });
      await Promise.all([
        fileSystem.mkdir(path.join(temporary, "downloads"), { recursive: true }),
        fileSystem.mkdir(path.join(temporary, "user"), { recursive: true }),
        fileSystem.mkdir(path.join(temporary, "cache"), { recursive: true }),
      ]);
      await fileSystem.writeFile(
        path.join(temporary, "seed-manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
        "utf8",
      );
      await fileSystem.rm(destination, { recursive: true, force: true });
      await fileSystem.rename(temporary, destination);
      return destination;
    } catch (error) {
      await fileSystem.rm(temporary, { recursive: true, force: true });
      throw Object.assign(error, { cliStage: "initialize" });
    }
  }

  function ensureToolchain() {
    if (!initialization) {
      initialization = installBundledToolchain().catch((error) => {
        initialization = undefined;
        throw error;
      });
    }
    return initialization;
  }

  function cliEnvironment(root) {
    return {
      ...process.env,
      ARDUINO_DIRECTORIES_DATA: path.join(root, "data"),
      ARDUINO_DIRECTORIES_DOWNLOADS: path.join(root, "downloads"),
      ARDUINO_DIRECTORIES_USER: path.join(root, "user"),
      ARDUINO_BUILD_CACHE_PATH: path.join(root, "cache"),
      ARDUINO_UPDATER_ENABLE_NOTIFICATION: "false",
      ARDUINO_NETWORK_CLOUD_API_SKIP_BOARD_DETECTION_CALLS: "true",
    };
  }

  async function runCli(args, { emit, stage = "command", timeoutMs = 30_000 } = {}) {
    let root;
    try {
      root = await ensureToolchain();
    } catch (error) {
      throw Object.assign(error, { cliStage: "initialize", cliOutput: "" });
    }

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;
      let child;
      let timer;
      let terminationTimer;

      const finish = (action) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(terminationTimer);
        if (child) children.delete(child);
        action();
      };

      try {
        child = spawnProcess(executablePath(), args, {
          env: cliEnvironment(root),
          shell: false,
          windowsHide: true,
          detached: platform !== "win32",
        });
        children.add(child);
      } catch (error) {
        reject(Object.assign(error, { cliStage: stage, cliOutput: "" }));
        return;
      }

      timer = setTimeout(() => {
        timedOut = true;
        terminateProcessTree(child, platform, "SIGTERM");
        terminationTimer = setTimeout(() => {
          terminateProcessTree(child, platform, "SIGKILL");
          finish(() =>
            reject(
              Object.assign(new Error("Arduino CLI timed out."), {
                code: "ETIMEDOUT",
                cliStage: stage,
                cliOutput: stderr || stdout,
              }),
            ),
          );
        }, timeoutTerminationGraceMs);
      }, timeoutMs);

      child.stdout?.on("data", (chunk) => {
        const text = String(chunk);
        stdout = appendCaptured(stdout, text);
        emit?.({ type: "output", stream: "stdout", text });
      });
      child.stderr?.on("data", (chunk) => {
        const text = String(chunk);
        stderr = appendCaptured(stderr, text);
        emit?.({ type: "output", stream: "stderr", text });
      });
      child.on("error", (error) => {
        finish(() =>
          reject(
            Object.assign(error, {
              cliStage: stage,
              cliOutput: stderr || stdout,
            }),
          ),
        );
      });
      child.on("close", (code) => {
        finish(() => {
          if (timedOut) {
            reject(
              Object.assign(new Error("Arduino CLI timed out."), {
                code: "ETIMEDOUT",
                cliStage: stage,
                cliOutput: stderr || stdout,
              }),
            );
          } else if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(
              Object.assign(new Error(`Arduino CLI exited with code ${code}.`), {
                cliStage: stage,
                cliOutput: stderr || stdout,
                exitCode: code,
              }),
            );
          }
        });
      });
    });
  }

  async function listPorts() {
    const result = await runCli(["board", "list", "--json"], {
      stage: "discovery",
      timeoutMs: cliTimeouts.discovery,
    });
    return parseDetectedPorts(result.stdout);
  }

  async function uploadSketch(request, emit = () => {}) {
    if (uploadInProgress) {
      return { ok: false, error: "Another upload is already in progress." };
    }
    uploadInProgress = true;
    let temporaryDirectory;

    try {
      validateUploadRequest(request);
      emit({ type: "phase", phase: "preparing", message: "Preparing Arduino tools…" });
      await ensureToolchain();

      emit({ type: "phase", phase: "checking", message: "Checking the Uno connection…" });
      const connectedPorts = await listPorts();
      if (!connectedPorts.some((port) => port.address === request.port)) {
        throw new Error(
          "The selected serial port is no longer connected. Refresh the port list and try again.",
        );
      }

      temporaryDirectory = await fileSystem.mkdtemp(
        path.join(app.getPath("temp"), "racecar-arduino-"),
      );
      const sketchDirectory = path.join(temporaryDirectory, "sketch");
      const buildDirectory = path.join(temporaryDirectory, "build");
      await Promise.all([
        fileSystem.mkdir(sketchDirectory, { recursive: true }),
        fileSystem.mkdir(buildDirectory, { recursive: true }),
      ]);
      await fileSystem.writeFile(
        path.join(sketchDirectory, "sketch.ino"),
        request.code,
        "utf8",
      );

      emit({ type: "phase", phase: "compiling", message: "Compiling for Arduino Uno R3…" });
      await runCli(compileArguments(sketchDirectory, buildDirectory), {
        emit,
        stage: "compile",
        timeoutMs: cliTimeouts.compile,
      });

      emit({ type: "phase", phase: "uploading", message: `Uploading to ${request.port}…` });
      await runCli(uploadArguments(request.port, sketchDirectory, buildDirectory), {
        emit,
        stage: "upload",
        timeoutMs: cliTimeouts.upload,
      });

      emit({ type: "phase", phase: "success", message: "Upload complete." });
      return { ok: true };
    } catch (error) {
      const message = error?.cliStage
        ? normalizeCliError(error.cliStage, error.cliOutput, error)
        : error instanceof Error
          ? error.message
          : "Unable to upload the sketch.";
      emit({ type: "phase", phase: "error", message });
      return { ok: false, error: message };
    } finally {
      try {
        if (temporaryDirectory) {
          await fileSystem.rm(temporaryDirectory, { recursive: true, force: true });
        }
      } catch (error) {
        console.error("Could not remove temporary Arduino build files.", error);
      } finally {
        uploadInProgress = false;
      }
    }
  }

  function dispose() {
    for (const child of children) child.kill();
    children.clear();
  }

  return { ensureToolchain, listPorts, uploadSketch, dispose };
}

module.exports = {
  MAX_CAPTURED_OUTPUT,
  appendCaptured,
  compileArguments,
  createArduinoService,
  manifest,
  normalizeCliError,
  parseDetectedPorts,
  platformDirectory,
  uploadArguments,
  validateUploadRequest,
};
