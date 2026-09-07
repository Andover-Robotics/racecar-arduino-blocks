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

function listArduinoPorts() {
  return ipcRenderer.invoke("arduino:list-ports");
}

function uploadArduinoSketch(request) {
  return ipcRenderer.invoke("arduino:upload", request);
}

function onArduinoUploadEvent(listener) {
  const wrappedListener = (_event, uploadEvent) => listener(uploadEvent);
  ipcRenderer.on("arduino:upload-event", wrappedListener);
  return () =>
    ipcRenderer.removeListener("arduino:upload-event", wrappedListener);
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

contextBridge.exposeInMainWorld("arduino", {
  listPorts: listArduinoPorts,
  uploadSketch: uploadArduinoSketch,
  onUploadEvent: onArduinoUploadEvent,
});
