/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from "blockly";
import { blocks } from "./blocks/text";
import { arduinoGenerator, forBlock } from "./generators/arduino";
import { setupProjectPersistence } from "./projects";
import { toolbox } from "./toolbox";
import "./index.css";

Blockly.common.defineBlocks(blocks);
Object.assign(arduinoGenerator.forBlock, forBlock);

const generatedCodeElement =
  document.getElementById("generatedCode")?.firstChild;
const blocklyContainer = document.getElementById("blocklyDiv");
if (!blocklyContainer) {
  throw new Error("Element with id blocklyDiv was not found.");
}

const workspace = Blockly.inject(blocklyContainer, { toolbox });

function regenerateCode() {
  try {
    const generatedCode = arduinoGenerator.workspaceToCode(
      workspace as Blockly.Workspace,
    );
    if (generatedCodeElement) {
      generatedCodeElement.textContent = generatedCode;
    }
  } catch (error) {
    console.error("Could not generate Arduino code for the workspace.", error);
  }
}

regenerateCode();
void setupProjectPersistence(workspace as Blockly.Workspace, regenerateCode);

workspace.addChangeListener((event: Blockly.Events.Abstract) => {
  if (
    event.isUiEvent ||
    event.type === Blockly.Events.FINISHED_LOADING ||
    workspace.isDragging()
  ) {
    return;
  }
  regenerateCode();
});
