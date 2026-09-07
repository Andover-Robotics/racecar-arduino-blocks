<script lang="ts">
  import { tick } from "svelte";

  type ProjectDialogMode = "create" | "save-as";

  export let onSave: (mode: ProjectDialogMode, projectName: string) => Promise<string | null>;
  export let onCancel: () => void;

  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  let mode: ProjectDialogMode = "create";
  let projectName = "";
  let error = "";

  export async function show(nextMode: ProjectDialogMode, initialProjectName = "") {
    if (dialog.open) return;
    mode = nextMode;
    projectName = initialProjectName;
    error = "";
    dialog.showModal();
    await tick();
    input.focus();
    input.select();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = (await onSave(mode, projectName.trim())) ?? "";
    if (!error) dialog.close();
  }

  function cancel() {
    dialog.close();
    onCancel();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="projectDialogTitle">
  <form onsubmit={submit}>
    <h2 id="projectDialogTitle">{mode === "create" ? "Name your project" : "Save project as"}</h2>
    <p>
      {mode === "create"
        ? "Enter a name to save this Blockly workspace."
        : "Create a named copy. Future autosaves will use the copy."}
    </p>
    <label for="projectNameInput">Project name</label>
    <input id="projectNameInput" bind:this={input} bind:value={projectName} maxlength="80" required autocomplete="off" />
    <p class="error" role="alert">{error}</p>
    <div class="actions">
      <button type="button" onclick={cancel}>Cancel</button>
      <button type="submit">Save project</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(360px, calc(100vw - 2rem));
    border: 0;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgb(0 0 0 / 25%);
  }
  dialog::backdrop { background: rgb(0 0 0 / 35%); }
  form { display: grid; gap: 0.65rem; }
  h2, p { margin: 0; }
  input { padding: 0.45rem; }
  .error { min-height: 1.2rem; color: #b3261e; font-size: 0.9rem; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
