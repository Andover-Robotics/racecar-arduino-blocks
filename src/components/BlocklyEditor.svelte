<script lang="ts">
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
  import ArduinoUpload from "./ArduinoUpload.svelte";
  import { blocks } from "../blocks/text";
  import { arduinoGenerator, forBlock } from "../generators/arduino";
  import { toolbox } from "../toolbox";

  export let generatedCode: string;
  export let onWorkspaceReady: (workspace: Blockly.WorkspaceSvg) => void;

  let blocklyContainer: HTMLDivElement;

  onMount(() => {
    Blockly.common.defineBlocks(blocks);
    Object.assign(arduinoGenerator.forBlock, forBlock);
    const workspace = Blockly.inject(blocklyContainer, { toolbox });
    onWorkspaceReady(workspace);
    return () => workspace.dispose();
  });
</script>

<main>
  <div class="outputPane">
    <pre><code>{generatedCode}</code></pre>
    <ArduinoUpload {generatedCode} />
  </div>
  <div class="blocklyContainer" bind:this={blocklyContainer}></div>
</main>

<style>
  main {
    display: flex;
    width: 100%;
    max-width: 100vw;
    height: calc(100vh - 52px);
  }
  .blocklyContainer {
    flex-basis: 100%;
    height: 100%;
    min-width: 600px;
  }
  .outputPane {
    display: flex;
    flex-direction: column;
    width: 400px;
    flex: 0 0 400px;
    overflow: hidden;
    margin: 1rem;
  }
  pre {
    flex: 1 1 50%;
    min-height: 0;
    margin: 0 0 0.75rem;
    overflow: auto;
    background-color: rgb(247, 240, 228);
  }
  code { overflow: auto; }
</style>
