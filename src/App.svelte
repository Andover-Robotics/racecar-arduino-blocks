<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import * as Blockly from "blockly";
  import BlocklyEditor from "./components/BlocklyEditor.svelte";
  import OpenProjectDialog from "./components/OpenProjectDialog.svelte";
  import ProjectBar from "./components/ProjectBar.svelte";
  import ProjectNameDialog from "./components/ProjectNameDialog.svelte";
  import { arduinoGenerator } from "./generators/arduino";

  type ProjectDialogMode = "create" | "save-as";
  type ProjectNameDialogHandle = {
    show(mode: ProjectDialogMode, initialProjectName?: string): Promise<void>;
  };
  type OpenProjectDialogHandle = {
    show(): void;
    close(): void;
  };

  let projectNameDialog: ProjectNameDialogHandle;
  let openProjectDialog: OpenProjectDialogHandle;
  let workspace: Blockly.Workspace | null = null;
  let activeProject: Pick<SavedProject, "id" | "name"> | null = null;
  let projectName = "Untitled project";
  let saveStatus = "Changes will be saved after you name this project.";
  let saveStatusIsError = false;
  let generatedCode = "";
  let projects: ProjectSummary[] = [];
  let projectListStatus = "Loading projects...";
  let projectListStatusIsError = false;
  let autosaveTimer: number | undefined;
  let saveInProgress: Promise<boolean> | null = null;
  let followUpSaveRequested = false;
  let isLoadingProject = true;
  let isApplyingProject = false;
  let hasChangesDuringLoad = false;

  function serializeWorkspace() {
    if (!workspace) throw new Error("Blockly workspace has not been initialized.");
    return Blockly.serialization.workspaces.save(workspace);
  }

  function setSaveStatus(message: string, isError = false) {
    saveStatus = message;
    saveStatusIsError = isError;
  }

  function setProjectListStatus(message: string, isError = false) {
    projectListStatus = message;
    projectListStatusIsError = isError;
  }

  function regenerateCode() {
    if (!workspace) return;
    try {
      generatedCode = arduinoGenerator.workspaceToCode(workspace);
    } catch (error) {
      console.error("Could not generate Arduino code for the workspace.", error);
    }
  }

  async function performProjectSave(): Promise<boolean> {
    if (!activeProject) return true;
    setSaveStatus("Saving...");
    const saveResult = await window.projects.saveProject(activeProject.id, serializeWorkspace());
    if (saveResult.ok) {
      setSaveStatus("All changes saved");
      return true;
    }
    setSaveStatus(saveResult.error ?? "Unable to save project.", true);
    return false;
  }

  async function drainSaveQueue(): Promise<boolean> {
    let latestSaveSucceeded = true;
    try {
      while (followUpSaveRequested) {
        followUpSaveRequested = false;
        latestSaveSucceeded = await performProjectSave();
      }
      return latestSaveSucceeded;
    } finally {
      saveInProgress = null;
    }
  }

  function saveActiveProject(): Promise<boolean> {
    followUpSaveRequested = true;
    if (!saveInProgress) saveInProgress = drainSaveQueue();
    return saveInProgress;
  }

  function scheduleAutosave() {
    if (!activeProject) {
      void projectNameDialog.show("create");
      return;
    }
    if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
    setSaveStatus("Saving changes...");
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = undefined;
      void saveActiveProject();
    }, 300);
  }

  async function flushPendingAutosave(): Promise<boolean> {
    if (autosaveTimer !== undefined) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = undefined;
    }
    return saveActiveProject();
  }

  async function loadProjectList() {
    projects = [];
    setProjectListStatus("Loading projects...");
    const listResult = await window.projects.listProjects();
    if (!listResult.ok) {
      setProjectListStatus(listResult.error ?? "Unable to load saved projects.", true);
      return;
    }
    projects = listResult.projects ?? [];
    setProjectListStatus(projects.length === 0 ? "No saved projects were found." : "Choose a project to open.");
  }

  async function showOpenProjectDialog() {
    openProjectDialog.show();
    await loadProjectList();
  }

  async function openSelectedProject(projectId: string) {
    if (!workspace) return;
    if (!(await flushPendingAutosave())) {
      setProjectListStatus("The current project could not be saved, so it was not replaced.", true);
      return;
    }
    if (!activeProject && workspace.getAllBlocks(false).length > 0 && !window.confirm("The current workspace has not been saved. Open another project and discard it?")) return;

    setProjectListStatus("Opening project...");
    const openResult = await window.projects.openProject(projectId);
    if (!openResult.ok || !openResult.project) {
      setProjectListStatus(openResult.error ?? "Unable to open the selected project.", true);
      return;
    }
    isApplyingProject = true;
    try {
      Blockly.serialization.workspaces.load(openResult.project.workspace, workspace);
      activeProject = openResult.project;
      projectName = activeProject.name;
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
    if (!workspace) return;
    if (!activeProject && workspace.getAllBlocks(false).length > 0 && !window.confirm("The current workspace has not been saved. Start a new project and discard it?")) return;
    if (!(await flushPendingAutosave())) {
      setSaveStatus("The current project could not be saved, so a new project was not started.", true);
      return;
    }
    isApplyingProject = true;
    try {
      workspace.clear();
      activeProject = null;
      projectName = "Untitled project";
      setSaveStatus("Make a change to name this project and start autosaving.");
      regenerateCode();
    } finally {
      isApplyingProject = false;
    }
  }

  async function deleteSelectedProject(projectId: string) {
    const projectIsActive = activeProject?.id === projectId;
    const message = projectIsActive ? "Delete this project? Its blocks will remain open as an untitled workspace." : "Delete this project? This cannot be undone.";
    if (!window.confirm(message)) return;
    if (projectIsActive && !(await flushPendingAutosave())) {
      setProjectListStatus("The current project could not be saved, so it was not deleted.", true);
      return;
    }
    setProjectListStatus("Deleting project...");
    const deleteResult = await window.projects.deleteProject(projectId);
    if (!deleteResult.ok) {
      setProjectListStatus(deleteResult.error ?? "Unable to delete the selected project.", true);
      return;
    }
    if (projectIsActive) {
      activeProject = null;
      projectName = "Untitled project";
      setSaveStatus("Project deleted. Make a change to save this workspace again.");
    }
    await loadProjectList();
  }

  async function saveNamedProject(
    mode: ProjectDialogMode,
    name: string,
  ): Promise<string | null> {
    const result = mode === "create"
      ? await window.projects.createProject(name, serializeWorkspace())
      : await window.projects.saveProjectAs(name, serializeWorkspace());
    if (!result.ok || !result.project) {
      return result.error ?? "Unable to save project.";
    }
    activeProject = result.project;
    projectName = activeProject.name;
    setSaveStatus("All changes saved");
    return null;
  }

  function handleWorkspaceChange(event: Blockly.Events.Abstract) {
    if (isApplyingProject || event.isUiEvent || event.type === Blockly.Events.FINISHED_LOADING) return;
    if (isLoadingProject) {
      hasChangesDuringLoad = true;
      return;
    }
    scheduleAutosave();
  }

  function handleCodeGeneration(event: Blockly.Events.Abstract) {
    if (event.isUiEvent || event.type === Blockly.Events.FINISHED_LOADING || workspace?.isDragging()) return;
    regenerateCode();
  }

  async function restoreLastProject() {
    if (!workspace) return;
    const loadResult = await window.projects.loadLastProject();
    if (!loadResult.ok) {
      setSaveStatus(loadResult.error ?? "Unable to restore the last project.", true);
    } else if (loadResult.project) {
      isApplyingProject = true;
      try {
        Blockly.serialization.workspaces.load(loadResult.project.workspace, workspace);
        activeProject = loadResult.project;
        projectName = activeProject.name;
        setSaveStatus("All changes saved");
        regenerateCode();
      } catch (error) {
        console.error("Could not load Blockly workspace.", error);
        setSaveStatus("The last project could not be loaded. Started a new workspace.", true);
      } finally {
        isApplyingProject = false;
      }
    }
    isLoadingProject = false;
    if (hasChangesDuringLoad) scheduleAutosave();
  }

  function handleWorkspaceReady(nextWorkspace: Blockly.Workspace) {
    workspace = nextWorkspace;
    workspace.addChangeListener(handleCodeGeneration);
    workspace.addChangeListener(handleWorkspaceChange);
    regenerateCode();
    void restoreLastProject();
  }

  function handleBeforeUnload() {
    if (autosaveTimer === undefined) return;
    window.clearTimeout(autosaveTimer);
    autosaveTimer = undefined;
    void saveActiveProject();
  }

  onMount(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  onDestroy(() => {
    if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
    workspace = null;
  });
</script>


<ProjectBar
  {projectName}
  {saveStatus}
  {saveStatusIsError}
  onNewProject={() => void startNewProject()}
  onOpenProject={() => void showOpenProjectDialog()}
  onSaveAs={() => void projectNameDialog.show("save-as", activeProject?.name ?? "")}
/>

<BlocklyEditor {generatedCode} onWorkspaceReady={handleWorkspaceReady} />

<ProjectNameDialog
  bind:this={projectNameDialog}
  onSave={saveNamedProject}
  onCancel={() => setSaveStatus("Changes will be saved after you name this project.")}
/>

<OpenProjectDialog
  bind:this={openProjectDialog}
  {projects}
  status={projectListStatus}
  statusIsError={projectListStatusIsError}
  onOpen={(projectId) => void openSelectedProject(projectId)}
  onDelete={(projectId) => void deleteSelectedProject(projectId)}
/>
