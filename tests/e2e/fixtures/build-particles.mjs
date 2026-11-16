import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const require = createRequire(resolve('package.json'));

/** A browser-only test bundle; no application route or production flag is added. */
export async function buildParticlesHarness() {
  const { webpack } = require('next/dist/compiled/webpack/webpack');
  const outputPath = resolve('test-results/particles-harness');
  const compiler = webpack({
    mode: 'development', target: 'web', devtool: false,
    entry: resolve('tests/e2e/fixtures/particles-harness.tsx'),
    output: { path: outputPath, filename: 'harness.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: resolve('tests/e2e/fixtures/particles-loader.mjs') }] },
    optimization: { minimize: false },
  });
  await new Promise((resolveBuild, reject) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error || closeError) reject(error ?? closeError);
        else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
        else resolveBuild();
      });
    });
  });
  return readFile(resolve(outputPath, 'harness.js'), 'utf8');
}
