<script lang="ts">
  export let projects: ProjectSummary[];
  export let status: string;
  export let statusIsError: boolean;
  export let onOpen: (projectId: string) => void;
  export let onDelete: (projectId: string) => void;

  let dialog: HTMLDialogElement;

  export function show() {
    if (!dialog.open) dialog.showModal();
  }

  export function close() {
    dialog.close();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="openProjectDialogTitle">
  <section>
    <h2 id="openProjectDialogTitle">Open a project</h2>
    <p class:error={statusIsError} role="status">{status}</p>
    <div class="projectList">
      {#each projects as project (project.id)}
        <div class="projectListItem">
          <button type="button" class="projectListButton" onclick={() => onOpen(project.id)}>{project.name}</button>
          <button type="button" class="deleteProjectButton" aria-label={"Delete " + project.name} onclick={() => onDelete(project.id)}>Delete</button>
        </div>
      {/each}
    </div>
    <div class="actions">
      <button type="button" onclick={() => dialog.close()}>Cancel</button>
    </div>
  </section>
</dialog>

<style>
  dialog {
    width: min(360px, calc(100vw - 2rem));
    border: 0;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgb(0 0 0 / 25%);
  }
  dialog::backdrop { background: rgb(0 0 0 / 35%); }
  section { display: grid; gap: 0.65rem; }
  h2, p { margin: 0; }
  p.error { color: #b3261e; }
  .projectList { display: grid; gap: 0.5rem; max-height: 50vh; overflow-y: auto; }
  .projectListItem { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; }
  .projectListButton, .deleteProjectButton { padding: 0.65rem; }
  .projectListButton { text-align: left; }
  .deleteProjectButton { color: #b3261e; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
