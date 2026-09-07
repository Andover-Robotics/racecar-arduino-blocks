<script lang="ts">
  import { onMount } from "svelte";

  export let generatedCode: string;

  const maximumDiagnosticsLength = 128 * 1024;
  let ports: ArduinoPort[] = [];
  let selectedPort = "";
  let status = "Preparing Arduino tools…";
  let statusIsError = false;
  let diagnostics = "";
  let refreshing = false;
  let uploading = false;

  $: busy = refreshing || uploading;
  $: canUpload = Boolean(selectedPort && generatedCode.trim() && !busy);

  function displayPort(port: ArduinoPort) {
    return port.label === port.address
      ? port.address
      : `${port.label} (${port.address})`;
  }

  function setStatus(message: string, isError = false) {
    status = message;
    statusIsError = isError;
  }

  function appendDiagnostics(text: string) {
    diagnostics = (diagnostics + text).slice(-maximumDiagnosticsLength);
  }

  async function refreshPorts() {
    if (busy) return;
    refreshing = true;
    setStatus("Looking for connected Arduino boards…");

    try {
      const previousSelection = selectedPort;
      const result = await window.arduino.listPorts();
      ports = result.ports ?? [];

      if (ports.some((port) => port.address === previousSelection)) {
        selectedPort = previousSelection;
      } else if (ports.length === 1) {
        selectedPort = ports[0].address;
      } else {
        selectedPort = "";
      }

      if (!result.ok) {
        setStatus(result.error ?? "Unable to find Arduino boards.", true);
      } else if (ports.length === 0) {
        setStatus("Connect an Arduino Uno R3, then refresh.");
      } else if (ports.length === 1) {
        setStatus("Arduino Uno R3 is ready to upload.");
      } else {
        setStatus("Choose the Uno's serial port.");
      }
    } catch (error) {
      console.error("Could not refresh Arduino ports.", error);
      ports = [];
      selectedPort = "";
      setStatus("Unable to find Arduino boards.", true);
    } finally {
      refreshing = false;
    }
  }

  async function uploadSketch() {
    if (!selectedPort) {
      setStatus("Select the Uno's serial port.", true);
      return;
    }
    if (!generatedCode.trim()) {
      setStatus("Add blocks that generate Arduino code before uploading.", true);
      return;
    }

    uploading = true;
    diagnostics = "";
    setStatus("Starting upload…");
    try {
      const result = await window.arduino.uploadSketch({
        code: generatedCode,
        port: selectedPort,
      });
      if (!result.ok) {
        setStatus(result.error ?? "Unable to upload the sketch.", true);
      }
    } catch (error) {
      console.error("Could not upload Arduino sketch.", error);
      setStatus("Unable to upload the sketch.", true);
    } finally {
      uploading = false;
    }
  }

  onMount(() => {
    const unsubscribe = window.arduino.onUploadEvent((event) => {
      if (event.type === "output" && event.text) {
        appendDiagnostics(event.text);
      } else if (event.type === "phase" && event.message) {
        setStatus(event.message, event.phase === "error");
      }
    });
    void refreshPorts();
    return unsubscribe;
  });
</script>

<section class="uploadPanel" aria-labelledby="arduinoUploadHeading">
  <div class="headingRow">
    <div>
      <h2 id="arduinoUploadHeading">Upload to Arduino</h2>
      <p class="board">Arduino Uno R3 · ATmega328P</p>
    </div>
    <button type="button" class="secondary" disabled={busy} onclick={() => void refreshPorts()}>
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  </div>

  <label for="arduinoPort">Serial port</label>
  <select id="arduinoPort" bind:value={selectedPort} disabled={busy || ports.length === 0}>
    <option value="">
      {ports.length === 0 ? "No serial ports found" : "Select a serial port"}
    </option>
    {#each ports as port (port.address)}
      <option value={port.address}>{displayPort(port)}</option>
    {/each}
  </select>

  <button type="button" class="upload" disabled={!canUpload} onclick={() => void uploadSketch()}>
    {uploading ? "Uploading…" : "Upload code"}
  </button>

  <p class:error={statusIsError} class="status" role="status">{status}</p>

  <details open={statusIsError && diagnostics.length > 0}>
    <summary>Compiler and uploader details</summary>
    <pre aria-label="Arduino CLI diagnostics">{diagnostics || "No diagnostics yet."}</pre>
  </details>
</section>

<style>
  .uploadPanel {
    flex: 1 1 50%;
    min-height: 0;
    padding-top: 0.75rem;
    border-top: 1px solid #d9d9d9;
    overflow: auto;
  }
  .headingRow {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
  }
  .board {
    margin: 0.2rem 0 0.75rem;
    color: #5f6368;
    font-size: 0.82rem;
  }
  label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
  }
  select,
  button {
    box-sizing: border-box;
    font: inherit;
  }
  select {
    width: 100%;
    padding: 0.45rem;
  }
  button {
    border: 1px solid #aeb4ba;
    border-radius: 4px;
    padding: 0.45rem 0.7rem;
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.55;
  }
  .secondary {
    background: white;
  }
  .upload {
    width: 100%;
    margin-top: 0.6rem;
    border-color: #006c75;
    background: #007c86;
    color: white;
    font-weight: 600;
  }
  .status {
    min-height: 1.2rem;
    margin: 0.6rem 0;
    color: #3c4043;
    font-size: 0.86rem;
  }
  .status.error {
    color: #b3261e;
  }
  details {
    font-size: 0.82rem;
  }
  summary {
    cursor: pointer;
  }
  details pre {
    max-height: 180px;
    margin: 0.45rem 0 0;
    padding: 0.5rem;
    overflow: auto;
    background: #202124;
    color: #f1f3f4;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
