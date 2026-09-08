import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const nextCli = resolve('node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [nextCli, 'build', ...process.argv.slice(2)], {
  env: { ...process.env, ANALYZE: 'true' },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error('Não foi possível iniciar o Bundle Analyzer:', error);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
