import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import next from 'next';

function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}

async function main() {
  const build = await run(['node_modules/next/dist/bin/next', 'build']);
  if (build !== 0) { process.exitCode = build; return; }
  process.env.NODE_ENV = 'production';
  const app = next({ dev: false, hostname: '127.0.0.1' });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not allocate a port');
    process.exitCode = await run(['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
      ...process.env, PLAYWRIGHT_PORT: String(address.port), PLAYWRIGHT_EXTERNAL_SERVER: '1',
    });
  } finally {
    // Direct ownership avoids shell process-tree termination on restricted Windows hosts.
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await app.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
