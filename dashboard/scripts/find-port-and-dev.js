#!/usr/bin/env node
/**
 * Finds first free port from 3000 upward, then runs next dev on that port.
 * So the dashboard always uses a free port when run via npm run dev.
 */
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

const startPort = parseInt(process.env.PORT || '3000', 10);

function tryPort(port, cb) {
  const server = net.createServer();
  server.once('error', () => tryPort(port + 1, cb));
  server.once('listening', () => {
    server.close(() => cb(port));
  });
  server.listen(port);
}

tryPort(startPort, (port) => {
  const url = `http://localhost:${port}`;
  console.log('Dashboard:', url);
  const child = spawn('npx', ['next', 'dev', '-p', String(port)], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  });
  child.on('exit', (code) => process.exit(code || 0));
});
