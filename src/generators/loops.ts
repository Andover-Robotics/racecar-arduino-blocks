import * as Blockly from 'blockly/core';
import {ArduinoCodeGenerator, Order, value, variableName} from './common';

export const loopGenerators = Object.create(null);

loopGenerators['controls_repeat_ext'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const repeats = value(block, generator, 'TIMES');
  const loopVar = generator.nameDB_!.getDistinctName(
    'count',
    Blockly.Names.NameType.VARIABLE,
  );
  const branch = generator.addLoopTrap(generator.statementToCode(block, 'DO'), block);
  return (
    'for (long ' + loopVar + ' = 0; ' + loopVar + ' < ' + repeats + '; ' +
    loopVar + '++) {\n' + branch + '}\n'
  );
};
loopGenerators['controls_repeat'] = loopGenerators['controls_repeat_ext'];

loopGenerators['controls_whileUntil'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const until = block.getFieldValue('MODE') === 'UNTIL';
  let condition = value(block, generator, 'BOOL', Order.NONE, 'false');
  if (until) condition = '!(' + condition + ')';
  const branch = generator.addLoopTrap(generator.statementToCode(block, 'DO'), block);
  return 'while (' + condition + ') {\n' + branch + '}\n';
};

loopGenerators['controls_for'] = function (
  block: Blockly.Block,
  generator: ArduinoCodeGenerator,
) {
  const name = variableName(block, generator);
  const from = value(block, generator, 'FROM');
  const to = value(block, generator, 'TO');
  const by = value(block, generator, 'BY', Order.NONE, '1');
  const branch = generator.addLoopTrap(generator.statementToCode(block, 'DO'), block);
  return (
    'for (' + name + ' = ' + from + '; (' + by + ') >= 0 ? ' + name +
    ' <= ' + to + ' : ' + name + ' >= ' + to + '; ' + name + ' += ' + by +
    ') {\n' + branch + '}\n'
  );
};

loopGenerators['controls_flow_statements'] = function (block: Blockly.Block) {
  return block.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n';
};
