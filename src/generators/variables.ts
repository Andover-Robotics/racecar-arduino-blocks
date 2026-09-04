import * as Blockly from 'blockly/core';
import {
  ArduinoCodeGenerator,
  Order,
  value,
  variableName,
} from './common';

export const variableAndProcedureGenerators = Object.create(null);

variableAndProcedureGenerators['variables_get'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [variableName(block, generator), Order.ATOMIC];
};

variableAndProcedureGenerators['variables_set'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return variableName(block, generator) + ' = ' +
    value(block, generator, 'VALUE', Order.ASSIGNMENT) + ';\n';
};

variableAndProcedureGenerators['math_change'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return variableName(block, generator) + ' += ' +
    value(block, generator, 'DELTA', Order.ASSIGNMENT) + ';\n';
};

type ProcedureBlock = Blockly.Block & {
  getVarModels(): Array<{getId(): string}>;
};

variableAndProcedureGenerators['procedures_defnoreturn'] = function (
  block: ProcedureBlock,
  generator: ArduinoCodeGenerator,
) {
  const name = generator.getProcedureName(block.getFieldValue('NAME'));
  const args = block.getVarModels().map(
    (variable) => 'double ' + generator.getVariableName(variable.getId()),
  );
  const body = generator.statementToCode(block, 'STACK');
  generator.addDefinition(
    'procedure_' + name,
    'void ' + name + '(' + args.join(', ') + ') {\n' + body + '}',
  );
  return null;
};

variableAndProcedureGenerators['procedures_defreturn'] = function (
  block: ProcedureBlock,
  generator: ArduinoCodeGenerator,
) {
  const name = generator.getProcedureName(block.getFieldValue('NAME'));
  const args = block.getVarModels().map(
    (variable) => 'double ' + generator.getVariableName(variable.getId()),
  );
  const body = generator.statementToCode(block, 'STACK');
  const returnValue = value(block, generator, 'RETURN');
  generator.addDefinition(
    'procedure_' + name,
    'double ' + name + '(' + args.join(', ') + ') {\n' + body +
      '  return ' + returnValue + ';\n}',
  );
  return null;
};

const procedureCall = (
  block: ProcedureBlock,
  generator: ArduinoCodeGenerator,
) => {
  const name = generator.getProcedureName(block.getFieldValue('NAME'));
  const args = block.getVarModels().map((_, index) =>
    value(block, generator, 'ARG' + index),
  );
  return name + '(' + args.join(', ') + ')';
};

variableAndProcedureGenerators['procedures_callnoreturn'] = function (
  block: ProcedureBlock,
  generator: ArduinoCodeGenerator,
) {
  return procedureCall(block, generator) + ';\n';
};

variableAndProcedureGenerators['procedures_callreturn'] = function (
  block: ProcedureBlock,
  generator: ArduinoCodeGenerator,
) {
  return [procedureCall(block, generator), Order.FUNCTION_CALL];
};

variableAndProcedureGenerators['procedures_ifreturn'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const condition = value(
    block,
    generator,
    'CONDITION',
    Order.NONE,
    'false',
  );
  const returnCode = block.getInput('VALUE')
    ? 'return ' + value(block, generator, 'VALUE') + ';'
    : 'return;';
  return 'if (' + condition + ') {\n  ' + returnCode + '\n}\n';
};
