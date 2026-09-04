import * as Blockly from 'blockly/core';
import {ArduinoCodeGenerator, Order, value} from './common';

export const logicGenerators = Object.create(null);

logicGenerators['controls_if'] = function (
  block: Blockly.Block & {elseifCount_?: number; elseCount_?: number},
  generator: ArduinoCodeGenerator,
) {
  let code = '';
  const elseifCount = block.elseifCount_ ?? 0;
  for (let i = 0; i <= elseifCount; i++) {
    const condition = value(block, generator, 'IF' + i, Order.NONE, 'false');
    const branch = generator.statementToCode(block, 'DO' + i);
    code += (i ? 'else if' : 'if') + ' (' + condition + ') {\n' + branch + '}';
    code += i < elseifCount || block.elseCount_ ? ' ' : '\n';
  }
  if (block.elseCount_) {
    code += 'else {\n' + generator.statementToCode(block, 'ELSE') + '}\n';
  }
  return code;
};

logicGenerators['logic_compare'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const operators: Record<string, string> = {
    EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=',
  };
  const operator = operators[block.getFieldValue('OP')] ?? '==';
  const order = operator === '==' || operator === '!='
    ? Order.EQUALITY
    : Order.RELATIONAL;
  return [
    value(block, generator, 'A', order) + ' ' + operator + ' ' +
      value(block, generator, 'B', order),
    order,
  ];
};

logicGenerators['logic_operation'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const isAnd = block.getFieldValue('OP') === 'AND';
  const operator = isAnd ? '&&' : '||';
  const order = isAnd ? Order.LOGICAL_AND : Order.LOGICAL_OR;
  const fallback = isAnd ? 'true' : 'false';
  return [
    value(block, generator, 'A', order, fallback) + ' ' + operator + ' ' +
      value(block, generator, 'B', order, fallback),
    order,
  ];
};

logicGenerators['logic_negate'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return ['!' + value(block, generator, 'BOOL', Order.UNARY, 'true'), Order.UNARY];
};

logicGenerators['logic_boolean'] = function (block: Blockly.Block) {
  return [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', Order.ATOMIC];
};

logicGenerators['logic_null'] = function () {
  return ['NULL', Order.ATOMIC];
};

logicGenerators['logic_ternary'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [
    value(block, generator, 'IF', Order.CONDITIONAL, 'false') + ' ? ' +
      value(block, generator, 'THEN', Order.CONDITIONAL) + ' : ' +
      value(block, generator, 'ELSE', Order.CONDITIONAL),
    Order.CONDITIONAL,
  ];
};
