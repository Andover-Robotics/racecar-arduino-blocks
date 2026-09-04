/**
 * @license
 * Copyright 2026
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly/core';
import {Order} from './common';
import {hardwareGenerators} from './hardware';
import {logicGenerators} from './logic';
import {loopGenerators} from './loops';
import {mathGenerators} from './math';
import {variableAndProcedureGenerators} from './variables';

const RESERVED_WORDS =
  'auto,break,case,char,const,continue,default,do,double,else,enum,' +
  'extern,float,for,goto,if,int,long,register,return,short,signed,' +
  'sizeof,static,struct,switch,typedef,union,unsigned,void,volatile,while';

class ArduinoGenerator extends Blockly.CodeGenerator {
  private variableDeclarations_: string[] = [];

  constructor() {
    super('Arduino');
    this.isInitialized = false;
  }

  init(workspace: Blockly.Workspace) {
    this.nameDB_ ??= new Blockly.Names(RESERVED_WORDS);
    this.nameDB_.reset();
    this.nameDB_.setVariableMap(workspace.getVariableMap());
    this.nameDB_.populateVariables(workspace);
    this.nameDB_.populateProcedures(workspace);
    this.definitions_ = Object.create(null);
    this.functionNames_ = Object.create(null);
    this.variableDeclarations_ = workspace
      .getVariableMap().getAllVariables()
      .map(
        (variable) =>
          'double ' + this.getVariableName(variable.getId()) + ' = 0;',
      );
    this.isInitialized = true;
  }

  finish(code: string) {
    const loop = [
      'void loop() {',
      '  pinMode(LED_BUILTIN, OUTPUT);',
      '  digitalWrite(LED_BUILTIN, HIGH);',
      '  delay(1000);',
      '  digitalWrite(LED_BUILTIN, LOW);',
      '  delay(1000);',
      '}',
    ].join('\n');
    const sections = [
      '#include <Arduino.h>',
      this.variableDeclarations_.join('\n'),
      Object.keys(this.definitions_).map((key) => this.definitions_[key]).join('\n\n'),
      code.trim(),
      loop,
    ].filter(Boolean);
    this.isInitialized = false;
    return sections.join('\n\n') + '\n';
  }

  scrub_(
    block: Blockly.Block,
    code: string,
    thisOnly = false,
  ) {
    if (thisOnly) return code;
    const nextBlock = block.nextConnection?.targetBlock() ?? null;
    const nextCode = this.blockToCode(nextBlock);
    return code + (typeof nextCode === 'string' ? nextCode : '');
  }

  scrubNakedValue(line: string) {
    return line + ';\n';
  }

  addDefinition(name: string, code: string) {
    this.definitions_[name] = code;
  }
}

export const arduinoGenerator = new ArduinoGenerator();

export const forBlock = Object.assign(
  hardwareGenerators,
  Object.create(null),
  logicGenerators,
  loopGenerators,
  mathGenerators,
  variableAndProcedureGenerators,
);

forBlock['arduino_setup'] = function (
  block: Blockly.Block,
  generator: Blockly.CodeGenerator,
) {
  const statements = generator.statementToCode(block, 'DO');
  return 'void setup() {\n  Serial.begin(9600);\n' + statements + '}\n';
};

arduinoGenerator.ORDER_OVERRIDES = [
  [Order.ADDITIVE, Order.ADDITIVE],
  [Order.MULTIPLICATIVE, Order.MULTIPLICATIVE],
  [Order.LOGICAL_AND, Order.LOGICAL_AND],
  [Order.LOGICAL_OR, Order.LOGICAL_OR],
];
