import * as Blockly from 'blockly/core';

export enum Order {
  ATOMIC = 0,
  FUNCTION_CALL = 1,
  UNARY = 2,
  MULTIPLICATIVE = 3,
  ADDITIVE = 4,
  RELATIONAL = 5,
  EQUALITY = 6,
  LOGICAL_AND = 7,
  LOGICAL_OR = 8,
  CONDITIONAL = 9,
  ASSIGNMENT = 10,
  NONE = 99,
}

export interface ArduinoCodeGenerator extends Blockly.CodeGenerator {
  addDefinition(name: string, code: string): void;
}

export const value = (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
  name: string,
  order = Order.NONE,
  fallback = '0',
) => generator.valueToCode(block, name, order) || fallback;

export const variableName = (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) => generator.getVariableName(block.getFieldValue('VAR'));
