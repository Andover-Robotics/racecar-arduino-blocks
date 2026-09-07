<script lang="ts">
  export let projectName: string;
  export let saveStatus: string;
  export let saveStatusIsError: boolean;
  export let busy: boolean;
  export let onNewProject: () => void;
  export let onOpenProject: () => void;
  export let onSaveAs: () => void;
</script>

<header>
  <span class="projectName">{projectName}</span>
  <span class:error={saveStatusIsError} class="saveStatus" role="status">{saveStatus}</span>
  <button type="button" disabled={busy} onclick={onNewProject}>New Project</button>
  <button type="button" disabled={busy} onclick={onOpenProject}>Open Project</button>
  <button type="button" disabled={busy} onclick={onSaveAs}>Save As</button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 52px;
    padding: 0.65rem 1rem;
    box-sizing: border-box;
    border-bottom: 1px solid #d9d9d9;
  }
  .projectName { font-weight: 700; }
  .saveStatus { flex: 1; color: #5f6368; font-size: 0.9rem; }
  .saveStatus.error { color: #b3261e; }
</style>
