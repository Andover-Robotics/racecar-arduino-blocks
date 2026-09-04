import * as Blockly from 'blockly/core';
import {ArduinoCodeGenerator, Order, value} from './common';

export const mathGenerators = Object.create(null);

mathGenerators['math_number'] = function (block: Blockly.Block) {
  const number = Number(block.getFieldValue('NUM'));
  return [Number.isFinite(number) ? String(number) : '0', Order.ATOMIC];
};

mathGenerators['math_arithmetic'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const operation = block.getFieldValue('OP');
  if (operation === 'POWER') {
    return [
      'pow(' + value(block, generator, 'A') + ', ' +
        value(block, generator, 'B') + ')',
      Order.FUNCTION_CALL,
    ];
  }
  const operators: Record<string, [string, Order]> = {
    ADD: ['+', Order.ADDITIVE],
    MINUS: ['-', Order.ADDITIVE],
    MULTIPLY: ['*', Order.MULTIPLICATIVE],
    DIVIDE: ['/', Order.MULTIPLICATIVE],
  };
  const [operator, order] = operators[operation] ?? operators.ADD;
  return [
    value(block, generator, 'A', order) + ' ' + operator + ' ' +
      value(block, generator, 'B', order),
    order,
  ];
};

mathGenerators['math_single'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const operation = block.getFieldValue('OP');
  const number = value(block, generator, 'NUM');
  const calls: Record<string, string> = {
    ROOT: 'sqrt', ABS: 'abs', LN: 'log', LOG10: 'log10', EXP: 'exp',
  };
  if (operation === 'NEG') return ['-' + number, Order.UNARY];
  if (operation === 'POW10') {
    return ['pow(10, ' + number + ')', Order.FUNCTION_CALL];
  }
  if (operation === 'ROUND') return ['round(' + number + ')', Order.FUNCTION_CALL];
  if (operation === 'ROUNDUP') return ['ceil(' + number + ')', Order.FUNCTION_CALL];
  if (operation === 'ROUNDDOWN') return ['floor(' + number + ')', Order.FUNCTION_CALL];
  const functionName = calls[operation];
  if (!functionName) throw new Error('Unsupported math operation: ' + operation);
  return [functionName + '(' + number + ')', Order.FUNCTION_CALL];
};
mathGenerators['math_round'] = mathGenerators['math_single'];

mathGenerators['math_trig'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const operation = block.getFieldValue('OP');
  const number = value(block, generator, 'NUM');
  const direct: Record<string, string> = {SIN: 'sin', COS: 'cos', TAN: 'tan'};
  const inverse: Record<string, string> = {ASIN: 'asin', ACOS: 'acos', ATAN: 'atan'};
  if (direct[operation]) {
    return [
      direct[operation] + '((' + number + ') * PI / 180.0)',
      Order.FUNCTION_CALL,
    ];
  }
  if (inverse[operation]) {
    return [
      '(' + inverse[operation] + '(' + number + ') * 180.0 / PI)',
      Order.MULTIPLICATIVE,
    ];
  }
  throw new Error('Unsupported trigonometry operation: ' + operation);
};

mathGenerators['math_constant'] = function (block: Blockly.Block) {
  const constants: Record<string, string> = {
    PI: 'PI',
    E: '2.718281828459045',
    GOLDEN_RATIO: '1.618033988749895',
    SQRT2: '1.4142135623730951',
    SQRT1_2: '0.7071067811865476',
    INFINITY: 'INFINITY',
  };
  return [constants[block.getFieldValue('CONSTANT')] ?? '0', Order.ATOMIC];
};

mathGenerators['math_number_property'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const property = block.getFieldValue('PROPERTY');
  const number = value(block, generator, 'NUMBER_TO_CHECK');
  if (property === 'EVEN') {
    return ['((long)(' + number + ') % 2 == 0)', Order.EQUALITY];
  }
  if (property === 'ODD') {
    return ['((long)(' + number + ') % 2 != 0)', Order.EQUALITY];
  }
  if (property === 'WHOLE') {
    return ['floor(' + number + ') == (' + number + ')', Order.EQUALITY];
  }
  if (property === 'POSITIVE') {
    return ['(' + number + ') > 0', Order.RELATIONAL];
  }
  if (property === 'NEGATIVE') {
    return ['(' + number + ') < 0', Order.RELATIONAL];
  }
  if (property === 'DIVISIBLE_BY') {
    const divisor = value(block, generator, 'DIVISOR');
    return ['fmod(' + number + ', ' + divisor + ') == 0', Order.EQUALITY];
  }
  return ['false', Order.ATOMIC];
};

mathGenerators['math_modulo'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [
    'fmod(' + value(block, generator, 'DIVIDEND') + ', ' +
      value(block, generator, 'DIVISOR') + ')',
    Order.FUNCTION_CALL,
  ];
};

mathGenerators['math_constrain'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [
    'constrain(' + value(block, generator, 'VALUE') + ', ' +
      value(block, generator, 'LOW') + ', ' +
      value(block, generator, 'HIGH') + ')',
    Order.FUNCTION_CALL,
  ];
};

mathGenerators['math_random_int'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [
    'random(' + value(block, generator, 'FROM') + ', (' +
      value(block, generator, 'TO') + ') + 1)',
    Order.FUNCTION_CALL,
  ];
};

mathGenerators['math_random_float'] = function () {
  return ['(random(0, 10000) / 10000.0)', Order.MULTIPLICATIVE];
};

mathGenerators['math_atan2'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [
    '(atan2(' + value(block, generator, 'Y') + ', ' +
      value(block, generator, 'X') + ') * 180.0 / PI)',
    Order.MULTIPLICATIVE,
  ];
};

mathGenerators['arduino_number_property'] = mathGenerators['math_number_property'];
