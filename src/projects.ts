import * as Blockly from "blockly";

type ProjectDialogMode = "create" | "save-as";

let activeProject: Pick<SavedProject, "id" | "name"> | null = null;
let autosaveTimer: number | undefined;
let saveInProgress: Promise<boolean> | null = null;
let isLoadingProject = true;
let isApplyingProject = false;
let hasChangesDuringLoad = false;
let ignoreInitialProjectLoad = false;

function getRequiredElement<ElementType extends HTMLElement>(
  elementId: string,
): ElementType {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error("Element with id " + elementId + " was not found.");
  }

  return element as ElementType;
}

export async function setupProjectPersistence(
  workspace: Blockly.Workspace,
  regenerateCode: () => void,
) {
  const projectNameElement = getRequiredElement("projectName");
  const saveStatusElement = getRequiredElement("saveStatus");
  const projectNameDialog =
    getRequiredElement<HTMLDialogElement>("projectNameDialog");
  const projectNameForm =
    getRequiredElement<HTMLFormElement>("projectNameForm");
  const projectNameInput =
    getRequiredElement<HTMLInputElement>("projectNameInput");
  const projectNameError = getRequiredElement("projectNameError");
  const projectDialogTitle = getRequiredElement("projectDialogTitle");
  const projectDialogDescription = getRequiredElement(
    "projectDialogDescription",
  );
  const cancelProjectNameButton = getRequiredElement("cancelProjectName");
  const saveAsButton = getRequiredElement("saveAsButton");

  const newProjectButton = getRequiredElement("newProjectButton");
  const openProjectButton = getRequiredElement("openProjectButton");
  const openProjectDialog =
    getRequiredElement<HTMLDialogElement>("openProjectDialog");
  const projectList = getRequiredElement("projectList");
  const projectListStatus = getRequiredElement("projectListStatus");
  const cancelOpenProjectButton = getRequiredElement("cancelOpenProject");

  let projectDialogMode: ProjectDialogMode | null = null;

  function serializeWorkspace() {
    return Blockly.serialization.workspaces.save(workspace);
  }

  function setSaveStatus(message: string, isError = false) {
    saveStatusElement.textContent = message;
    saveStatusElement.classList.toggle("error", isError);
  }

  function setProjectListStatus(message: string, isError = false) {
    projectListStatus.textContent = message;
    projectListStatus.classList.toggle("error", isError);
  }

  function showProjectNameDialog(mode: ProjectDialogMode) {
    if (projectNameDialog.open) {
      return;
    }

    projectDialogMode = mode;
    projectDialogTitle.textContent =
      mode === "create" ? "Name your project" : "Save project as";
    projectDialogDescription.textContent =
      mode === "create"
        ? "Enter a name to save this Blockly workspace."
        : "Create a named copy. Future autosaves will use the copy.";

    projectNameError.textContent = "";
    projectNameInput.value =
      mode === "save-as" ? (activeProject?.name ?? "") : "";

    projectNameDialog.showModal();
    projectNameInput.focus();
    projectNameInput.select();
  }

  async function performProjectSave(): Promise<boolean> {
    if (!activeProject) {
      return true;
    }

    setSaveStatus("Saving...");

    const saveResult = await window.projects.saveProject(
      activeProject.id,
      serializeWorkspace(),
    );

    if (saveResult.ok) {
      setSaveStatus("All changes saved");
      return true;
    }

    setSaveStatus(saveResult.error ?? "Unable to save project.", true);
    return false;
  }

  async function saveActiveProject(): Promise<boolean> {
    if (saveInProgress) {
      return saveInProgress;
    }

    saveInProgress = performProjectSave();

    try {
      return await saveInProgress;
    } finally {
      saveInProgress = null;
    }
  }

  function performAutosave() {
    autosaveTimer = undefined;
    void saveActiveProject();
  }

  function scheduleAutosave() {
    if (!activeProject) {
      showProjectNameDialog("create");
      return;
    }

    if (autosaveTimer !== undefined) {
      window.clearTimeout(autosaveTimer);
    }

    setSaveStatus("Saving changes...");
    autosaveTimer = window.setTimeout(performAutosave, 300);
  }

  async function flushPendingAutosave(): Promise<boolean> {
    if (autosaveTimer !== undefined) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = undefined;
    }

    return saveActiveProject();
  }

  function renderProjectList(projects: ProjectSummary[]) {
    projectList.replaceChildren();

    if (projects.length === 0) {
      setProjectListStatus("No saved projects were found.");
      return;
    }

    setProjectListStatus("Choose a project to open.");

    for (const project of projects) {
      const projectListItem = document.createElement("div");
      projectListItem.className = "projectListItem";

      const projectButton = document.createElement("button");
      projectButton.type = "button";
      projectButton.className = "projectListButton";
      projectButton.dataset.projectId = project.id;
      projectButton.textContent = project.name;

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "deleteProjectButton";
      deleteButton.dataset.deleteProjectId = project.id;
      deleteButton.textContent = "Delete";
      deleteButton.setAttribute("aria-label", "Delete " + project.name);

      projectListItem.append(projectButton, deleteButton);
      projectList.append(projectListItem);
    }
  }

  async function loadProjectList() {
    projectList.replaceChildren();
    setProjectListStatus("Loading projects...");

    const listResult = await window.projects.listProjects();

    if (!listResult.ok) {
      setProjectListStatus(
        listResult.error ?? "Unable to load saved projects.",
        true,
      );
      return;
    }

    renderProjectList(listResult.projects ?? []);
  }

  async function showOpenProjectDialog() {
    openProjectDialog.showModal();
    await loadProjectList();
  }

  async function openSelectedProject(projectId: string) {
    const currentProjectWasSaved = await flushPendingAutosave();

    if (!currentProjectWasSaved) {
      setProjectListStatus(
        "The current project could not be saved, so it was not replaced.",
        true,
      );
      return;
    }

    if (
      !activeProject &&
      workspace.getAllBlocks(false).length > 0 &&
      !window.confirm(
        "The current workspace has not been saved. Open another project and discard it?",
      )
    ) {
      return;
    }

    setProjectListStatus("Opening project...");
    ignoreInitialProjectLoad = true;

    const openResult = await window.projects.openProject(projectId);

    if (!openResult.ok || !openResult.project) {
      setProjectListStatus(
        openResult.error ?? "Unable to open the selected project.",
        true,
      );
      return;
    }

    isApplyingProject = true;

    try {
      Blockly.serialization.workspaces.load(
        openResult.project.workspace,
        workspace,
      );

      activeProject = openResult.project;
      projectNameElement.textContent = activeProject.name;
      setSaveStatus("All changes saved");
      regenerateCode();
      openProjectDialog.close();
    } catch (error) {
      console.error("Could not open Blockly workspace.", error);
      setProjectListStatus("The selected project could not be loaded.", true);
    } finally {
      isApplyingProject = false;
    }
  }

  async function startNewProject() {
    if (
      !activeProject &&
      workspace.getAllBlocks(false).length > 0 &&
      !window.confirm(
        "The current workspace has not been saved. Start a new project and discard it?",
      )
    ) {
      return;
    }

    const currentProjectWasSaved = await flushPendingAutosave();

    if (!currentProjectWasSaved) {
      setSaveStatus(
        "The current project could not be saved, so a new project was not started.",
        true,
      );
      return;
    }

    ignoreInitialProjectLoad = true;
    isApplyingProject = true;

    try {
      workspace.clear();
      activeProject = null;
      projectNameElement.textContent = "Untitled project";
      setSaveStatus("Make a change to name this project and start autosaving.");
      regenerateCode();
    } finally {
      isApplyingProject = false;
    }
  }

  async function deleteSelectedProject(projectId: string) {
    const projectIsActive = activeProject?.id === projectId;
    const confirmationMessage = projectIsActive
      ? "Delete this project? Its blocks will remain open as an untitled workspace."
      : "Delete this project? This cannot be undone.";

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    if (projectIsActive) {
      const currentProjectWasSaved = await flushPendingAutosave();

      if (!currentProjectWasSaved) {
        setProjectListStatus(
          "The current project could not be saved, so it was not deleted.",
          true,
        );
        return;
      }
    }

    setProjectListStatus("Deleting project...");

    const deleteResult = await window.projects.deleteProject(projectId);

    if (!deleteResult.ok) {
      setProjectListStatus(
        deleteResult.error ?? "Unable to delete the selected project.",
        true,
      );
      return;
    }

    if (projectIsActive) {
      activeProject = null;
      projectNameElement.textContent = "Untitled project";
      setSaveStatus(
        "Project deleted. Make a change to save this workspace again.",
      );
    }

    await loadProjectList();
  }

  async function handleProjectNameSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!projectDialogMode) {
      return;
    }

    const projectName = projectNameInput.value.trim();
    const saveResult =
      projectDialogMode === "create"
        ? await window.projects.createProject(projectName, serializeWorkspace())
        : await window.projects.saveProjectAs(
            projectName,
            serializeWorkspace(),
          );

    if (!saveResult.ok || !saveResult.project) {
      projectNameError.textContent =
        saveResult.error ?? "Unable to save project.";
      return;
    }

    activeProject = saveResult.project;
    projectNameElement.textContent = activeProject.name;
    setSaveStatus("All changes saved");

    projectDialogMode = null;
    projectNameDialog.close();
  }

  function handleCancelProjectName() {
    projectDialogMode = null;
    projectNameDialog.close();
    setSaveStatus("Changes will be saved after you name this project.");
  }

  function handleSaveAsClick() {
    showProjectNameDialog("save-as");
  }

  function handleNewProjectClick() {
    void startNewProject();
  }

  function handleOpenProjectClick() {
    void showOpenProjectDialog();
  }

  function handleCancelOpenProject() {
    openProjectDialog.close();
  }

  function handleProjectListClick(event: MouseEvent) {
    const clickedElement = event.target;

    if (!(clickedElement instanceof HTMLElement)) {
      return;
    }

    const deleteButton = clickedElement.closest<HTMLButtonElement>(
      "button[data-delete-project-id]",
    );
    const projectIdToDelete = deleteButton?.dataset.deleteProjectId;

    if (projectIdToDelete) {
      void deleteSelectedProject(projectIdToDelete);
      return;
    }

    const projectButton = clickedElement.closest<HTMLButtonElement>(
      "button[data-project-id]",
    );
    const projectIdToOpen = projectButton?.dataset.projectId;

    if (projectIdToOpen) {
      void openSelectedProject(projectIdToOpen);
    }
  }

  function handleWorkspaceChange(event: Blockly.Events.Abstract) {
    if (
      isApplyingProject ||
      event.isUiEvent ||
      event.type === Blockly.Events.FINISHED_LOADING
    ) {
      return;
    }

    if (isLoadingProject) {
      hasChangesDuringLoad = true;
      return;
    }

    scheduleAutosave();
  }

  function handleBeforeUnload() {
    if (autosaveTimer === undefined) {
      return;
    }

    window.clearTimeout(autosaveTimer);
    autosaveTimer = undefined;
    void saveActiveProject();
  }

  projectNameForm.addEventListener("submit", handleProjectNameSubmit);
  cancelProjectNameButton.addEventListener("click", handleCancelProjectName);
  saveAsButton.addEventListener("click", handleSaveAsClick);
  newProjectButton.addEventListener("click", handleNewProjectClick);
  openProjectButton.addEventListener("click", handleOpenProjectClick);
  cancelOpenProjectButton.addEventListener("click", handleCancelOpenProject);
  projectList.addEventListener("click", handleProjectListClick);
  workspace.addChangeListener(handleWorkspaceChange);
  window.addEventListener("beforeunload", handleBeforeUnload);

  const loadResult = await window.projects.loadLastProject();

  if (!loadResult.ok) {
    setSaveStatus(
      loadResult.error ?? "Unable to restore the last project.",
      true,
    );
  } else if (loadResult.project && !ignoreInitialProjectLoad) {
    isApplyingProject = true;

    try {
      Blockly.serialization.workspaces.load(
        loadResult.project.workspace,
        workspace,
      );

      activeProject = loadResult.project;
      projectNameElement.textContent = activeProject.name;
      setSaveStatus("All changes saved");
      regenerateCode();
    } catch (error) {
      console.error("Could not load Blockly workspace.", error);
      setSaveStatus(
        "The last project could not be loaded. Started a new workspace.",
        true,
      );
    } finally {
      isApplyingProject = false;
    }
  }

  isLoadingProject = false;

  if (hasChangesDuringLoad) {
    scheduleAutosave();
  }
}
