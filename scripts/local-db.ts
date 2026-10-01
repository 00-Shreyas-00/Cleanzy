import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const action = process.argv[2] || 'start';
const pgDataDir = path.resolve(__dirname, '..', '.local_pgdata');
const binDir = path.resolve(__dirname, '..', 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin');
const pgCtl = path.join(binDir, 'pg_ctl');

function isInstalled() {
  return fs.existsSync(pgCtl);
}

if (!isInstalled()) {
  console.log('Embedded postgres binary not found for this platform.');
  process.exit(1);
}

if (action === 'start') {
  if (!fs.existsSync(pgDataDir)) {
    console.log('Initializing local postgres cluster...');
    const initdb = path.join(binDir, 'initdb');
    execSync(`"${initdb}" -D "${pgDataDir}" --username=postgres --auth=trust`, { stdio: 'inherit' });
  }
  console.log('Starting local PostgreSQL on port 5445...');
  try {
    execSync(`"${pgCtl}" -D "${pgDataDir}" -o "-p 5445" -l "${path.join(pgDataDir, 'postgres.log')}" start`, { stdio: 'inherit' });
    console.log('PostgreSQL running on port 5445.');
  } catch (err: any) {
    console.error('Failed to start postgres (might already be running):', err.message);
  }
} else if (action === 'stop') {
  console.log('Stopping local PostgreSQL...');
  try {
    execSync(`"${pgCtl}" -D "${pgDataDir}" stop`, { stdio: 'inherit' });
    console.log('PostgreSQL stopped.');
  } catch (err: any) {
    console.error('Failed to stop postgres:', err.message);
  }
} else if (action === 'status') {
  try {
    execSync(`"${pgCtl}" -D "${pgDataDir}" status`, { stdio: 'inherit' });
  } catch (err: any) {
    console.log('PostgreSQL is not running.');
  }
}
