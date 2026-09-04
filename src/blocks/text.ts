/**
 * @license
 * Copyright 2026
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly/core';

const statementConnections = {
  previousStatement: null,
  nextStatement: null,
};

const arduinoSetup = {
  type: 'arduino_setup',
  message0: 'on start %1',
  args0: [{type: 'input_statement', name: 'DO'}],
  colour: 230,
  tooltip: 'Runs once when the Arduino starts.',
  helpUrl: '',
};

const pinMode = {
  type: 'arduino_pin_mode',
  message0: 'set pin %1 as %2',
  args0: [
    {type: 'input_value', name: 'PIN', check: 'Number'},
    {
      type: 'field_dropdown',
      name: 'MODE',
      options: [
        ['output', 'OUTPUT'],
        ['input', 'INPUT'],
        ['input with pull-up', 'INPUT_PULLUP'],
      ],
    },
  ],
  ...statementConnections,
  colour: 230,
  tooltip: 'Configures a digital pin.',
  helpUrl: '',
};

const digitalWrite = {
  type: 'arduino_digital_write',
  message0: 'set digital pin %1 to %2',
  args0: [
    {type: 'input_value', name: 'PIN', check: 'Number'},
    {
      type: 'field_dropdown',
      name: 'VALUE',
      options: [['high', 'HIGH'], ['low', 'LOW']],
    },
  ],
  ...statementConnections,
  colour: 230,
  tooltip: 'Writes HIGH or LOW to a digital pin.',
  helpUrl: '',
};

const digitalRead = {
  type: 'arduino_digital_read',
  message0: 'read digital pin %1',
  args0: [{type: 'input_value', name: 'PIN', check: 'Number'}],
  output: 'Number',
  colour: 230,
  tooltip: 'Reads a digital pin.',
  helpUrl: '',
};

const analogWrite = {
  type: 'arduino_analog_write',
  message0: 'set analog output pin %1 to %2',
  args0: [
    {type: 'input_value', name: 'PIN', check: 'Number'},
    {type: 'input_value', name: 'VALUE', check: 'Number'},
  ],
  ...statementConnections,
  colour: 230,
  tooltip: 'Writes a PWM value to a supported pin.',
  helpUrl: '',
};

const analogRead = {
  type: 'arduino_analog_read',
  message0: 'read analog pin %1',
  args0: [{type: 'input_value', name: 'PIN', check: 'Number'}],
  output: 'Number',
  colour: 230,
  tooltip: 'Reads an analog input.',
  helpUrl: '',
};

const delay = {
  type: 'arduino_delay',
  message0: 'wait %1 milliseconds',
  args0: [{type: 'input_value', name: 'TIME', check: 'Number'}],
  ...statementConnections,
  colour: 230,
  tooltip: 'Pauses for a number of milliseconds.',
  helpUrl: '',
};

const millis = {
  type: 'arduino_millis',
  message0: 'milliseconds since start',
  output: 'Number',
  colour: 230,
  tooltip: 'Returns milliseconds since the program started.',
  helpUrl: '',
};

const delayMicroseconds = {
  type: 'arduino_delay_microseconds',
  message0: 'wait %1 microseconds',
  args0: [{type: 'input_value', name: 'TIME', check: 'Number'}],
  ...statementConnections,
  colour: 230,
  tooltip: 'Pauses for a number of microseconds.',
  helpUrl: '',
};

const micros = {
  type: 'arduino_micros',
  message0: 'microseconds since start',
  output: 'Number',
  colour: 230,
  tooltip: 'Returns microseconds since the program started.',
  helpUrl: '',
};

const serialString = {
  type: 'arduino_serial_string',
  message0: '\"%1\"',
  args0: [{type: 'field_input', name: 'TEXT', text: 'Hello, world!'}],
  output: 'String',
  colour: 160,
  tooltip: 'A string literal for Serial output.',
  helpUrl: '',
};

const serialStringConcat = {
  type: 'arduino_string_concat',
  message0: 'join %1 %2',
  args0: [
    {type: 'input_value', name: 'LEFT'},
    {type: 'input_value', name: 'RIGHT'},
  ],
  output: 'String',
  colour: 160,
  tooltip: 'Concatenates values for Serial output.',
  helpUrl: '',
};

const serialPrint = {
  type: 'arduino_serial_print',
  message0: 'print %1 to serial',
  args0: [{type: 'input_value', name: 'VALUE'}],
  ...statementConnections,
  colour: 160,
  tooltip: 'Prints a value to the serial port.',
  helpUrl: '',
};

const serialPrintln = {
  type: 'arduino_serial_println',
  message0: 'print line %1 to serial',
  args0: [{type: 'input_value', name: 'VALUE'}],
  ...statementConnections,
  colour: 160,
  tooltip: 'Prints a value followed by a newline.',
  helpUrl: '',
};

const numberProperty = {
  type: 'arduino_number_property',
  message0: '%1 is %2',
  args0: [
    {
      type: 'input_value',
      name: 'NUMBER_TO_CHECK',
      check: 'Number',
    },
    {
      type: 'field_dropdown',
      name: 'PROPERTY',
      options: [
        ['even', 'EVEN'],
        ['odd', 'ODD'],
        ['whole', 'WHOLE'],
        ['positive', 'POSITIVE'],
        ['negative', 'NEGATIVE'],
        ['divisible by', 'DIVISIBLE_BY'],
      ],
    },
  ],
  inputsInline: true,
  output: 'Boolean',
  style: 'math_blocks',
  mutator: 'math_is_divisibleby_mutator',
  tooltip: 'Checks a property of a number.',
  helpUrl: '',
};
export const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
  arduinoSetup,
  pinMode,
  digitalWrite,
  digitalRead,
  analogWrite,
  analogRead,
  delay,
  millis,
  delayMicroseconds,
  micros,
  serialPrint,
  serialString,
  serialStringConcat,
  serialPrintln,
  numberProperty,
]);
