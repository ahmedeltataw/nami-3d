import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const gpuArgs = [
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
];

export function systemChromeChannel() {
  const candidates = process.platform === 'win32'
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter(Boolean).map(root => join(root, 'Google/Chrome/Application/chrome.exe'))
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/opt/google/chrome/chrome', '/opt/google/chrome/google-chrome'];
  return candidates.some(path => existsSync(path)) ? 'chrome' : undefined;
}
