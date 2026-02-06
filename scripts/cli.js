#!/usr/bin/env node
const path = require('path');

const cmd = process.argv[2];

if (cmd === 'setup') {
  require(path.join(__dirname, 'setup'));
  return;
}

if (!cmd || cmd === 'init') {
  require(path.join(__dirname, 'init'));
  return;
}

if (cmd === 'install') {
  require(path.join(__dirname, 'install'));
  return;
}

console.error('Unknown command:', cmd);
console.error('Usage: shimwrappercheck [setup|init|install]');
process.exit(1);
