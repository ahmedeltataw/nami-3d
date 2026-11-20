export type Profile = {
  quality: 'high' | 'mid' | 'low';
  motion: 'full' | 'reduced';
  renderer: 'webgl' | 'fallback';
};

export function noJumps(profile: Pick<Profile, 'motion' | 'renderer'>) {
  return profile.motion === 'reduced' || profile.renderer === 'fallback';
}

export interface ProfileEnvironment {
  reducedMotion: boolean;
  webgl2: boolean;
  softwareRenderer?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  coarsePointer: boolean;
}

export function detectProfile(env: ProfileEnvironment): Profile {
  const memory = env.deviceMemory ?? 4;
  const cores = env.hardwareConcurrency ?? 4;
  return {
    quality: env.softwareRenderer || memory <= 2 || cores <= 2 ? 'low' : memory >= 8 && cores >= 8 && !env.coarsePointer ? 'high' : 'mid',
    motion: env.reducedMotion ? 'reduced' : 'full',
    renderer: env.webgl2 ? 'webgl' : 'fallback',
  };
}

export function initialDpr(coarsePointer: boolean, softwareRenderer = false): number {
  return coarsePointer || softwareRenderer ? 1 : 1.5;
}

export function browserEnvironment(): ProfileEnvironment {
  const canvas = document.createElement('canvas');
  let webgl2 = false;
  let softwareRenderer = false;
  try {
    const context = canvas.getContext('webgl2');
    webgl2 = context !== null;
    const debug = context?.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
    softwareRenderer = !!context && !!debug && /swiftshader/i.test(context.getParameter(debug.UNMASKED_RENDERER_WEBGL));
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* A denied context uses the HTML experience. */ }
  return {
    webgl2,
    softwareRenderer,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
}

export type MotionChoice = 'cinematic' | 'direct';
export const MOTION_KEY = 'nami-motion';
export const MOTION_EVENT = 'nami:motion-choice';
let sessionChoice: MotionChoice = 'cinematic';
export function readMotionChoice(storage: Pick<Storage, 'getItem'>): MotionChoice {
  try { const value = storage.getItem(MOTION_KEY); if (value === 'direct' || value === 'cinematic') sessionChoice = value; } catch { /* Keep the in-memory choice. */ }
  return sessionChoice;
}
export function saveMotionChoice(storage: Pick<Storage, 'setItem'>, choice: MotionChoice) {
  sessionChoice = choice;
  try { storage.setItem(MOTION_KEY, choice); } catch { /* Storage can be unavailable. */ }
}
export function effectiveMotion(reduced: boolean, choice: MotionChoice): Profile['motion'] {
  return reduced || choice === 'direct' ? 'reduced' : 'full';
}
