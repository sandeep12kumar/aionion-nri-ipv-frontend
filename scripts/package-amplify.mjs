// Builds the frontend for AWS and zips it for Amplify's "Deploy without Git": npm run package:amplify
// Reads the live API addresses from .env.production (copy .env.production.example first).
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(frontendDir, '.env.production');
const settings = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
for (const name of ['VITE_API_URL', 'VITE_WS_URL']) {
  if (!new RegExp(`^${name}=\\S+`, 'm').test(settings)) {
    throw new Error(`Set ${name} in frontend/.env.production first (see .env.production.example).`);
  }
}

execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

const buildDir = path.join(frontendDir, 'build');
const zip = path.join(buildDir, 'amplify-frontend.zip');
fs.mkdirSync(buildDir, { recursive: true });
fs.rmSync(zip, { force: true });
// Amplify needs index.html at the top of the zip, so the zip holds what is inside dist.
const dist = path.join(frontendDir, 'dist');
const entries = fs.readdirSync(dist);
if (process.platform === 'win32') execFileSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-a', '-cf', zip, ...entries], { cwd: dist });
else execFileSync('zip', ['-qr', zip, ...entries], { cwd: dist });
console.log(`\nCreated ${zip}`);
