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

if (cmd === 'run') {
  const runArgs = process.argv.slice(3);
  process.argv = [process.argv[0], path.join(__dirname, 'shim-runner.js'), ...runArgs];
  require(path.join(__dirname, 'shim-runner.js'));
  return;
}

console.error('Unknown command:', cmd);
console.error('Usage: shimwrappercheck [setup|init|install|run]');
process.exit(1);
