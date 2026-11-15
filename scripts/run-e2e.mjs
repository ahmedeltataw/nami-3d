import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

const server = createServer();
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a port');
  const port = String(address.port);
  server.close(() => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
      stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_PORT: port },
    });
    child.on('error', (error) => { console.error(error); process.exitCode = 1; });
    child.on('exit', (code) => { process.exitCode = code ?? 1; });
  });
});
server.on('error', (error) => { console.error(error); process.exitCode = 1; });
