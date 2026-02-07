#!/usr/bin/env node
/**
 * Finds the first free port starting from the given port (default 3000).
 * Usage: node find-free-port.js [startPort]
 * Prints the port number to stdout.
 */
const net = require('net');
const start = parseInt(process.argv[2] || '3000', 10);

function tryPort(port, cb) {
  const server = net.createServer();
  server.once('error', () => tryPort(port + 1, cb));
  server.once('listening', () => {
    server.close(() => cb(port));
  });
  server.listen(port);
}

tryPort(start, (port) => {
  console.log(port);
});
