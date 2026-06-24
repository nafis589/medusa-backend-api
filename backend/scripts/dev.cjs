'use strict';

const { config } = require('dotenv');
const { spawn } = require('child_process');
const path = require('path');
const killPort = require('kill-port');

config({ override: true });

const port = Number(process.env.PORT ?? 5000);
const backendRoot = path.resolve(__dirname, '..');

async function main() {
  try {
    await killPort(port);
    console.log(`Port ${port} libéré avant démarrage.`);
  } catch {
    // Port already free
  }

  const child = spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', '--project', 'tsconfig.json', 'src/index.ts'],
    { cwd: backendRoot, stdio: 'inherit', shell: true, env: process.env },
  );

  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
