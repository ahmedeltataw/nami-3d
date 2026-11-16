export type Profile = {
  quality: 'high' | 'mid' | 'low';
  motion: 'full' | 'reduced';
  renderer: 'webgl' | 'fallback';
};

export interface ProfileEnvironment {
  reducedMotion: boolean;
  webgl2: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  coarsePointer: boolean;
}

export function detectProfile(env: ProfileEnvironment): Profile {
  const memory = env.deviceMemory ?? 4;
  const cores = env.hardwareConcurrency ?? 4;
  return {
    quality: memory <= 2 || cores <= 2 ? 'low' : memory >= 8 && cores >= 8 && !env.coarsePointer ? 'high' : 'mid',
    motion: env.reducedMotion ? 'reduced' : 'full',
    renderer: env.webgl2 ? 'webgl' : 'fallback',
  };
}

export function initialDpr(coarsePointer: boolean): number {
  return coarsePointer ? 1 : 1.5;
}

export function browserEnvironment(): ProfileEnvironment {
  const canvas = document.createElement('canvas');
  let webgl2 = false;
  try {
    const context = canvas.getContext('webgl2');
    webgl2 = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* A denied context uses the HTML experience. */ }
  return {
    webgl2,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
}
