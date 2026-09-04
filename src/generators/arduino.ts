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

const RESERVED_WORDS = [
  // C and C++ language keywords.
  [
    'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand',
    'bitor', 'bool', 'break', 'case', 'catch', 'char', 'char8_t',
    'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const',
    'consteval', 'constexpr', 'constinit', 'const_cast', 'continue',
    'co_await', 'co_return', 'co_yield', 'decltype', 'default', 'delete',
    'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'export',
    'extern', 'false', 'final', 'float', 'for', 'friend', 'goto', 'if', 'inline',
    'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not',
    'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'override', 'private',
    'protected', 'public', 'register', 'reinterpret_cast', 'requires',
    'return', 'short', 'signed', 'sizeof', 'static', 'static_assert',
    'static_cast', 'struct', 'switch', 'template', 'this', 'thread_local',
    'throw', 'true', 'try', 'typedef', 'typeid', 'typename', 'union',
    'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while',
    'xor', 'xor_eq',
  ],
  // Arduino sketch structure, types, constants, and built-in objects.
  [
    'setup', 'loop', 'boolean', 'byte', 'word', 'String', 'Stream',
    'HardwareSerial', 'Serial', 'Serial1', 'Serial2', 'Serial3',
    'SerialUSB', 'Keyboard', 'Mouse', 'array', 'PROGMEM', 'F', 'null', 'NULL',
    'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'DEC', 'BIN', 'HEX',
    'OCT', 'PI', 'HALF_PI', 'TWO_PI', 'DEG_TO_RAD', 'RAD_TO_DEG', 'EULER',
    'LSBFIRST', 'MSBFIRST', 'CHANGE', 'FALLING', 'RISING', 'DEFAULT',
    'EXTERNAL', 'INTERNAL', 'INTERNAL1V1', 'INTERNAL2V56',
    'INTERNAL2V56_EXTCAP', 'LED_BUILTIN', 'LED_BUILTIN_RX',
    'LED_BUILTIN_TX', 'SERIAL', 'DISPLAY', 'DIGITAL_MESSAGE',
    'FIRMATA_STRING', 'ANALOG_MESSAGE', 'REPORT_DIGITAL', 'REPORT_ANALOG',
    'SET_PIN_MODE', 'SYSTEM_RESET', 'SYSEX_START',
  ],
  // Fixed-width and atomic types recognized by the Arduino environment.
  [
    'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uint8_t', 'uint16_t',
    'uint32_t', 'uint64_t', '_Bool', '_Complex', '_Imaginary', 'complex',
    'atomic_bool', 'atomic_char', 'atomic_schar', 'atomic_uchar',
    'atomic_short', 'atomic_ushort', 'atomic_int', 'atomic_uint',
    'atomic_long', 'atomic_ulong', 'atomic_llong', 'atomic_ullong',
  ],
  // Arduino core I/O, timing, interrupt, bit, pulse, tone, and math APIs.
  [
    'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite',
    'analogReference', 'analogReadResolution', 'analogWriteResolution',
    'delay', 'delayMicroseconds', 'millis', 'micros', 'interrupts',
    'noInterrupts', 'attachInterrupt', 'detachInterrupt',
    'digitalPinToInterrupt', 'pulseIn', 'pulseInLong', 'shiftIn',
    'shiftOut', 'tone', 'noTone', 'yield', 'random', 'randomSeed', 'map',
    'min', 'max', 'abs', 'constrain', 'round', 'radians', 'degrees', 'sq',
    'bit', 'bitRead', 'bitWrite', 'bitSet', 'bitClear', 'bitToggle',
    'highByte', 'lowByte', 'makeWord',
    'acos', 'acosf', 'asin', 'asinf', 'atan', 'atan2', 'atan2f', 'atanf',
    'cbrt', 'cbrtf', 'ceil', 'ceilf', 'copysign', 'copysignf', 'cos',
    'cosf', 'cosh', 'coshf', 'exp', 'expf', 'fabs', 'fabsf', 'fdim',
    'fdimf', 'floor', 'floorf', 'fma', 'fmaf', 'fmax', 'fmaxf', 'fmin',
    'fminf', 'fmod', 'fmodf', 'hypot', 'hypotf', 'isfinite', 'isinf',
    'isnan', 'ldexp', 'ldexpf', 'log', 'log10', 'log10f', 'logf',
    'lrint', 'lrintf', 'lround', 'lroundf', 'pow', 'powf', 'roundf',
    'signbit', 'sin', 'sinf', 'sinh', 'sinhf', 'sqrt', 'sqrtf', 'tan',
    'tanf', 'tanh', 'tanhf', 'trunc', 'truncf',
  ],
  // Serial, Stream, String, Keyboard, Mouse, and character APIs.
  [
    'begin', 'end', 'available', 'availableForWrite', 'flush', 'peek',
    'read', 'print', 'println', 'setTimeout', 'find', 'findUntil',
    'parseInt', 'parseFloat', 'readBytes', 'readBytesUntil', 'readString',
    'readStringUntil', 'trim', 'toUpperCase', 'toLowerCase', 'charAt',
    'compareTo', 'concat', 'endsWith', 'startsWith', 'equals',
    'equalsIgnoreCase', 'getBytes', 'indexOf', 'lastIndexOf', 'length',
    'replace', 'setCharAt', 'substring', 'toCharArray', 'toInt', 'press',
    'release', 'releaseAll', 'accept', 'click', 'move', 'isPressed',
    'isAlphaNumeric', 'isAlpha', 'isAscii', 'isWhitespace', 'isControl',
    'isDigit', 'isGraph', 'isLowerCase', 'isPrintable', 'isPunct',
    'isSpace', 'isUpperCase', 'isHexadecimalDigit',
  ],
  // Additional identifiers and macros exported by Arduino.h.
  [
    'init', 'initVariant', 'atexit', 'clockCyclesPerMicrosecond',
    'clockCyclesToMicroseconds', 'microsecondsToClockCycles',
    'digitalPinToPort', 'digitalPinToBitMask', 'digitalPinToTimer',
    'analogInPinToBit', 'portOutputRegister', 'portInputRegister',
    'portModeRegister', 'NOT_A_PIN', 'NOT_A_PORT', 'NOT_AN_INTERRUPT',
    'NOT_ON_TIMER', 'TIMER0A', 'TIMER0B', 'TIMER1A', 'TIMER1B', 'TIMER1C',
    'TIMER2', 'TIMER2A', 'TIMER2B', 'TIMER3A', 'TIMER3B', 'TIMER3C',
    'TIMER4A', 'TIMER4B', 'TIMER4C', 'TIMER4D', 'TIMER5A', 'TIMER5B',
    'TIMER5C', 'ARDUINO', 'ARDUINO_ARCH_AVR', 'ARDUINO_MAIN', 'F_CPU',
    'PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PG', 'PH', 'PJ', 'PK', 'PL',
    'port_to_mode_PGM', 'port_to_input_PGM', 'port_to_output_PGM',
    'digital_pin_to_port_PGM', 'digital_pin_to_bit_mask_PGM',
    'digital_pin_to_timer_PGM', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
    'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15',
  ],
].map((group) => group.join(',')).join(',');

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
