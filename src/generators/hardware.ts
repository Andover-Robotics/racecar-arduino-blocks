import * as Blockly from 'blockly/core';
import {ArduinoCodeGenerator, Order, value} from './common';

export const hardwareGenerators = Object.create(null);

hardwareGenerators['arduino_pin_mode'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const pin = value(block, generator, 'PIN');
  return 'pinMode(' + pin + ', ' + block.getFieldValue('MODE') + ');\n';
};

hardwareGenerators['arduino_digital_write'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const pin = value(block, generator, 'PIN');
  return 'digitalWrite(' + pin + ', ' + block.getFieldValue('VALUE') + ');\n';
};

hardwareGenerators['arduino_digital_read'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [
    'digitalRead(' + value(block, generator, 'PIN') + ')',
    Order.FUNCTION_CALL,
  ];
};

hardwareGenerators['arduino_analog_write'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return 'analogWrite(' + value(block, generator, 'PIN') + ', ' +
    value(block, generator, 'VALUE') + ');\n';
};

hardwareGenerators['arduino_analog_read'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return [
    'analogRead(' + value(block, generator, 'PIN') + ')',
    Order.FUNCTION_CALL,
  ];
};

hardwareGenerators['arduino_delay'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return 'delay(' + value(block, generator, 'TIME') + ');\n';
};

hardwareGenerators['arduino_millis'] = function () {
  return ['millis()', Order.FUNCTION_CALL];
};

hardwareGenerators['arduino_delay_microseconds'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return 'delayMicroseconds(' + value(block, generator, 'TIME') + ');\n';
};

hardwareGenerators['arduino_micros'] = function () {
  return ['micros()', Order.FUNCTION_CALL];
};
hardwareGenerators['arduino_serial_string'] = function (block: Blockly.Block) {
  const text = block.getFieldValue('TEXT') ?? '';
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\"/g, '\\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  const literal = '\"' + escaped + '\"';
  const parentType = block.getParent()?.type;
  const isConcatenated = parentType === 'text_join' || parentType === 'arduino_string_concat';
  return [isConcatenated ? literal : 'F(' + literal + ')', Order.ATOMIC];
};

hardwareGenerators['arduino_string_concat'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const left = generator.valueToCode(block, 'LEFT', Order.NONE) || '\"\"';
  const right = generator.valueToCode(block, 'RIGHT', Order.NONE) || '\"\"';
  return [
    'String(' + left + ') + String(' + right + ')',
    Order.ADDITIVE,
  ];
};

hardwareGenerators['text_join'] = function (
  block: Blockly.Block & {itemCount_: number},
  generator: ArduinoCodeGenerator,
) {
  const items = [];
  for (let i = 0; i < block.itemCount_; i++) {
    const item = generator.valueToCode(block, 'ADD' + i, Order.NONE) || '\"\"';
    items.push('String(' + item + ')');
  }
  return [
    items.length ? items.join(' + ') : 'String(\"\")',
    Order.ADDITIVE,
  ];
};

hardwareGenerators['arduino_serial_print'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return 'Serial.print(' + value(block, generator, 'VALUE') + ');\n';
};

hardwareGenerators['arduino_serial_println'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  return 'Serial.println(' + value(block, generator, 'VALUE') + ');\n';
};
