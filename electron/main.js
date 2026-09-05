const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT_FILE_VERSION = 1;
const PROJECT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;

function getProjectPaths() {
  const applicationDataDirectory = app.getPath("userData");

  return {
    projectsDirectory: path.join(applicationDataDirectory, "projects"),
    applicationStateFile: path.join(applicationDataDirectory, "app-state.json"),
  };
}

function validateProjectName(projectName) {
  if (
    typeof projectName !== "string" ||
    !PROJECT_NAME_PATTERN.test(projectName)
  ) {
    throw new Error(
      "Project names must be 1-80 letters, numbers, spaces, dots, hyphens, or underscores, and cannot start with a space.",
    );
  }

  return projectName;
}

function getProjectFilePath(projectId) {
  const { projectsDirectory } = getProjectPaths();
  return path.join(projectsDirectory, validateProjectName(projectId) + ".json");
}

async function readJsonFile(filePath) {
  const contents = await fs.readFile(filePath, "utf8");
  return JSON.parse(contents);
}

async function writeJsonAtomically(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const temporaryFilePath =
    filePath + "." + process.pid + "." + Date.now() + ".tmp";
  const contents = JSON.stringify(value, null, 2) + "\n";

  await fs.writeFile(temporaryFilePath, contents);
  await fs.rename(temporaryFilePath, filePath);
}

async function writeApplicationState(lastProjectId) {
  const { applicationStateFile } = getProjectPaths();

  await writeJsonAtomically(applicationStateFile, {
    version: PROJECT_FILE_VERSION,
    lastProjectId,
  });
}

async function readProject(projectId) {
  const projectFile = await readJsonFile(getProjectFilePath(projectId));

  if (
    !projectFile ||
    projectFile.version !== PROJECT_FILE_VERSION ||
    typeof projectFile.name !== "string" ||
    !projectFile.workspace ||
    typeof projectFile.workspace !== "object"
  ) {
    throw new Error(
      "This project file is not a valid RACECAR Arduino Blocks project.",
    );
  }

  return {
    id: projectId,
    name: projectFile.name,
    workspace: projectFile.workspace,
  };
}

async function saveProject(projectId, workspaceState) {
  if (!workspaceState || typeof workspaceState !== "object") {
    throw new Error("The workspace could not be saved.");
  }

  await writeJsonAtomically(getProjectFilePath(projectId), {
    version: PROJECT_FILE_VERSION,
    name: projectId,
    workspace: workspaceState,
  });
  await writeApplicationState(projectId);

  return { id: projectId, name: projectId };
}

async function listProjects() {
  const { projectsDirectory } = getProjectPaths();
  let directoryEntries;

  try {
    directoryEntries = await fs.readdir(projectsDirectory, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const projectIds = directoryEntries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        entry.name.length > ".json".length,
    )
    .map((entry) => entry.name.slice(0, -".json".length));

  const projects = [];

  for (const projectId of projectIds) {
    try {
      const project = await readProject(projectId);
      projects.push({ id: project.id, name: project.name });
    } catch (error) {
      console.warn("Skipping unreadable project file:", projectId, error);
    }
  }

  projects.sort((firstProject, secondProject) =>
    firstProject.name.localeCompare(secondProject.name),
  );

  return projects;
}

async function runProjectOperation(operation) {
  try {
    return {
      ok: true,
      ...(await operation()),
    };
  } catch (error) {
    console.error("Project persistence failed.", error);

    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Unable to access projects.",
    };
  }
}

async function createProject(projectName, workspaceState) {
  const projectId = validateProjectName(projectName);
  const projectFilePath = getProjectFilePath(projectId);

  try {
    await fs.access(projectFilePath);
    throw new Error(
      'A project named "' +
        projectId +
        '" already exists. Choose a different name.',
    );
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }

  return {
    project: await saveProject(projectId, workspaceState),
  };
}

function handleLoadLastProject() {
  return runProjectOperation(async function loadLastProject() {
    const { applicationStateFile } = getProjectPaths();
    let applicationState;

    try {
      applicationState = await readJsonFile(applicationStateFile);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { project: null };
      }

      throw new Error("The last project record could not be read.");
    }

    if (
      !applicationState ||
      applicationState.version !== PROJECT_FILE_VERSION ||
      typeof applicationState.lastProjectId !== "string"
    ) {
      throw new Error("The last project record is invalid.");
    }

    return {
      project: await readProject(applicationState.lastProjectId),
    };
  });
}

function handleListProjects() {
  return runProjectOperation(async function loadProjectList() {
    return { projects: await listProjects() };
  });
}

function handleOpenProject(_event, projectId) {
  return runProjectOperation(async function openProject() {
    validateProjectName(projectId);

    const project = await readProject(projectId);
    await writeApplicationState(projectId);

    return { project };
  });
}

async function clearApplicationStateForProject(projectId) {
  const { applicationStateFile } = getProjectPaths();
  let applicationState;

  try {
    applicationState = await readJsonFile(applicationStateFile);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  if (
    applicationState &&
    typeof applicationState === "object" &&
    applicationState.lastProjectId === projectId
  ) {
    await fs.rm(applicationStateFile, { force: true });
  }
}

function handleDeleteProject(_event, projectId) {
  return runProjectOperation(async function deleteProject() {
    validateProjectName(projectId);
    await fs.unlink(getProjectFilePath(projectId));
    await clearApplicationStateForProject(projectId);

    return { deletedProjectId: projectId };
  });
}

function handleCreateProject(_event, projectName, workspaceState) {
  return runProjectOperation(function createNewProject() {
    return createProject(projectName, workspaceState);
  });
}

function handleSaveProject(_event, projectId, workspaceState) {
  return runProjectOperation(async function saveExistingProject() {
    validateProjectName(projectId);
    await readProject(projectId);

    return {
      project: await saveProject(projectId, workspaceState),
    };
  });
}

ipcMain.handle("projects:load-last", handleLoadLastProject);
ipcMain.handle("projects:list", handleListProjects);
ipcMain.handle("projects:open", handleOpenProject);
ipcMain.handle("projects:delete", handleDeleteProject);
ipcMain.handle("projects:create", handleCreateProject);
ipcMain.handle("projects:save-as", handleCreateProject);
ipcMain.handle("projects:save", handleSaveProject);

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function handleActivate() {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}

function handleApplicationReady() {
  createWindow();
  app.on("activate", handleActivate);
}

function handleAllWindowsClosed() {
  if (process.platform !== "darwin") {
    app.quit();
  }
}

app.whenReady().then(handleApplicationReady);
app.on("window-all-closed", handleAllWindowsClosed);
