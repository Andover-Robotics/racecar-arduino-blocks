const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  appendCaptured,
  compileArguments,
  createArduinoService,
  manifest,
  normalizeCliError,
  parseDetectedPorts,
  platformDirectory,
  uploadArguments,
  validateUploadRequest,
} = require("../electron/arduino-service");

test("supports only packaged release platforms", () => {
  assert.equal(platformDirectory("linux", "x64"), "linux-x64");
  assert.equal(platformDirectory("win32", "x64"), "win32-x64");
  assert.throws(() => platformDirectory("darwin", "arm64"), /not packaged/);
});

test("parses serial ports from current Arduino CLI JSON", () => {
  const ports = parseDetectedPorts(
    JSON.stringify({
      detected_ports: [
        {
          port: { address: "/dev/ttyACM0", label: "Uno", protocol: "serial" },
          matching_boards: [{ name: "Arduino Uno", fqbn: manifest.fqbn }],
        },
        { port: { address: "192.0.2.1", label: "Network", protocol: "network" } },
      ],
    }),
  );

  assert.deepEqual(ports, [{ address: "/dev/ttyACM0", label: "Uno" }]);
  assert.throws(() => parseDetectedPorts("not json"), /unreadable/);
});

test("validates renderer upload input", () => {
  assert.doesNotThrow(() =>
    validateUploadRequest({ code: "void setup() {}", port: "/dev/ttyACM0" }),
  );
  assert.throws(() => validateUploadRequest({ code: "", port: "COM3" }), /no generated/);
  assert.throws(
    () => validateUploadRequest({ code: "void setup() {}", port: "COM3\n--help" }),
    /valid connected/,
  );
});

test("constructs fixed Uno compile and upload commands", () => {
  assert.deepEqual(compileArguments("/tmp/sketch", "/tmp/build"), [
    "compile",
    "--fqbn",
    "arduino:avr:uno",
    "--build-path",
    "/tmp/build",
    "--warnings",
    "default",
    "/tmp/sketch",
  ]);
  assert.deepEqual(uploadArguments("COM3", "C:/sketch", "C:/build"), [
    "upload",
    "--fqbn",
    "arduino:avr:uno",
    "--port",
    "COM3",
    "--build-path",
    "C:/build",
    "C:/sketch",
  ]);
});

test("bounds diagnostics and normalizes common failures", () => {
  assert.equal(appendCaptured("1234", "5678", 5), "45678");
  assert.match(normalizeCliError("compile", "", {}), /did not compile/);
  assert.match(
    normalizeCliError("upload", "avrdude: programmer is not responding", {}),
    /did not respond/,
  );
  assert.match(normalizeCliError("discovery", "", { code: "ENOENT" }), /missing/);
});

test("seeds the offline data and serializes upload commands", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "racecar-service-test-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));

  const appRoot = path.join(root, "app");
  const userData = path.join(root, "user-data");
  const temporary = path.join(root, "temp");
  const bundled = path.join(appRoot, "vendor", "arduino", "linux-x64");
  const executable = path.join(bundled, "cli", "arduino-cli");
  await fs.mkdir(
    path.join(
      bundled,
      "data",
      "packages",
      "arduino",
      "hardware",
      "avr",
      manifest.coreVersion,
    ),
    { recursive: true },
  );
  for (const [tool, version] of Object.entries(manifest.tools)) {
    const [packager, name] = tool.split(":");
    await fs.mkdir(
      path.join(bundled, "data", "packages", packager, "tools", name, version),
      { recursive: true },
    );
  }
  await fs.mkdir(path.dirname(executable), { recursive: true });
  await fs.mkdir(temporary, { recursive: true });
  await fs.writeFile(executable, "test executable");
  await fs.chmod(executable, 0o755);
  await fs.writeFile(
    path.join(bundled, "seed-manifest.json"),
    JSON.stringify(manifest),
  );

  const commands = [];
  function spawnProcess(_executable, args) {
    commands.push(args);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => child.emit("close", null);
    setImmediate(() => {
      if (args[0] === "board") {
        child.stdout.emit(
          "data",
          JSON.stringify({
            detected_ports: [
              { port: { address: "COM3", label: "COM3", protocol: "serial" } },
            ],
          }),
        );
      }
      child.emit("close", 0);
    });
    return child;
  }

  const app = {
    isPackaged: false,
    getAppPath: () => appRoot,
    getPath: (name) => (name === "userData" ? userData : temporary),
  };
  const service = createArduinoService({
    app,
    spawnProcess,
    platform: "linux",
    arch: "x64",
  });

  const firstUpload = service.uploadSketch({
    code: "void setup() {}\nvoid loop() {}\n",
    port: "COM3",
  });
  assert.deepEqual(await service.uploadSketch({ code: "x", port: "COM3" }), {
    ok: false,
    error: "Another upload is already in progress.",
  });
  assert.deepEqual(await firstUpload, { ok: true });
  assert.deepEqual(
    commands.map((command) => command[0]),
    ["board", "compile", "upload"],
  );
  await fs.access(
    path.join(
      userData,
      "arduino",
      "toolchains",
      manifest.toolchainId,
      "data",
      "packages",
    ),
  );
  assert.equal(
    (await fs.readdir(temporary)).some((name) => name.startsWith("racecar-arduino-")),
    false,
  );

  let terminationSignals = [];
  function hungSpawnProcess() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => terminationSignals.push(signal);
    return child;
  }
  const hungService = createArduinoService({
    app,
    spawnProcess: hungSpawnProcess,
    platform: "linux",
    arch: "x64",
    cliTimeouts: { discovery: 1, compile: 1, upload: 1 },
    timeoutTerminationGraceMs: 1,
  });
  await assert.rejects(hungService.listPorts(), { code: "ETIMEDOUT" });
  assert.deepEqual(terminationSignals, ["SIGTERM", "SIGKILL"]);
  assert.deepEqual(await hungService.uploadSketch({ code: "x", port: "COM3" }), {
    ok: false,
    error: "Arduino discovery timed out. Reconnect the board and try again.",
  });
});
