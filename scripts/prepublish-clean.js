#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
['dashboard/.next', 'dashboard/out'].forEach((p) => {
  const full = path.join(root, p);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true });
    console.log('Removed', p);
  }
});
