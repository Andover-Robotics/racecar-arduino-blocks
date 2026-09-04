declare module "*.css";

interface ProjectSummary {
  id: string;
  name: string;
}

interface SavedProject extends ProjectSummary {
  workspace: Record<string, unknown>;
}

interface ProjectResult {
  ok: boolean;
  error?: string;
  project?: SavedProject | null;
}

interface ProjectListResult {
  ok: boolean;
  error?: string;
  projects?: ProjectSummary[];
}

interface DeleteProjectResult {
  ok: boolean;
  error?: string;
  deletedProjectId?: string;
}

interface Window {
  projects: {
    loadLastProject(): Promise<ProjectResult>;
    listProjects(): Promise<ProjectListResult>;
    openProject(projectId: string): Promise<ProjectResult>;
    deleteProject(projectId: string): Promise<DeleteProjectResult>;
    createProject(
      projectName: string,
      workspaceState: Record<string, unknown>,
    ): Promise<ProjectResult>;
    saveProject(
      projectId: string,
      workspaceState: Record<string, unknown>,
    ): Promise<ProjectResult>;
    saveProjectAs(
      projectName: string,
      workspaceState: Record<string, unknown>,
    ): Promise<ProjectResult>;
  };
}
