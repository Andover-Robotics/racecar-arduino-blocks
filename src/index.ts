/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
import {blocks} from './blocks/text';
import {arduinoGenerator, forBlock} from './generators/arduino';
import {toolbox} from './toolbox';
import './index.css';

// Register the blocks and generator with Blockly
Blockly.common.defineBlocks(blocks);
Object.assign(arduinoGenerator.forBlock, forBlock);

// Set up UI elements and inject Blockly
const codeDiv = document.getElementById('generatedCode')?.firstChild;
const outputDiv = document.getElementById('output');
const blocklyDiv = document.getElementById('blocklyDiv');

if (!blocklyDiv) {
  throw new Error(`div with id 'blocklyDiv' not found`);
}
const ws = Blockly.inject(blocklyDiv, {toolbox});

// This function shows the Arduino sketch generated from the workspace.
const runCode = () => {
  try {
    const code = arduinoGenerator.workspaceToCode(ws as Blockly.Workspace);
    if (codeDiv) codeDiv.textContent = code;
  } catch (error) {
    // A toolbox can contain blocks whose Arduino generator has not been
    // implemented yet. Do not let that error escape Blockly's event handler:
    // an uncaught change-listener error prevents later toolbox interactions.
    console.error('Could not generate Arduino code for the workspace.', error);
  }
};

if (ws) {
  runCode();

  // Whenever the workspace changes meaningfully, run the code again.
  ws.addChangeListener((e: Blockly.Events.Abstract) => {
    // Don't run the code when the workspace finishes loading; we're
    // already running it once when the application starts.
    // Don't run the code during drags; we might have invalid state.
    if (
      e.isUiEvent ||
      e.type == Blockly.Events.FINISHED_LOADING ||
      ws.isDragging()
    ) {
      return;
    }
    runCode();
  });
}
