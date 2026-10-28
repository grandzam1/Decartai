const { spawn } = require('child_process');

// Wrapper for Next.js dev server in AI Studio.
// When AI Studio supervisor executes `npm run dev --port 3000 --host 0.0.0.0`,
// this script starts `next dev -p 3000 -H 0.0.0.0` without unrecognized flag errors.

const nextBin = require.resolve('next/dist/bin/next');
const port = process.env.PORT || '3000';
const hostname = '0.0.0.0';

const child = spawn(process.execPath, [nextBin, 'dev', '-p', port, '-H', hostname], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
