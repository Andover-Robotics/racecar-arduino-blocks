<script lang="ts">
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
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
    <div class="output"></div>
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
    overflow: auto;
    margin: 1rem;
  }
  pre {
    height: 50%;
    overflow: auto;
    background-color: rgb(247, 240, 228);
  }
  code { overflow: auto; }
  .output { height: 50%; }
</style>
