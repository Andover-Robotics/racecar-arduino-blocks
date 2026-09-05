const { contextBridge, ipcRenderer } = require("electron");

function loadLastProject() {
  return ipcRenderer.invoke("projects:load-last");
}

function listProjects() {
  return ipcRenderer.invoke("projects:list");
}

function openProject(projectId) {
  return ipcRenderer.invoke("projects:open", projectId);
}

function deleteProject(projectId) {
  return ipcRenderer.invoke("projects:delete", projectId);
}

function createProject(projectName, workspaceState) {
  return ipcRenderer.invoke("projects:create", projectName, workspaceState);
}

function saveProject(projectId, workspaceState) {
  return ipcRenderer.invoke("projects:save", projectId, workspaceState);
}

function saveProjectAs(projectName, workspaceState) {
  return ipcRenderer.invoke("projects:save-as", projectName, workspaceState);
}

contextBridge.exposeInMainWorld("projects", {
  loadLastProject,
  listProjects,
  openProject,
  deleteProject,
  createProject,
  saveProject,
  saveProjectAs,
});
