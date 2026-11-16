import { useExperienceStore } from '../experience/store';
import type { AudioEngine, SoundName } from './types';

export const SOUND_STORAGE_KEY = 'nami-sound-consent';
export const SOUND_EVENT = 'nami:sound-state';

let audioCtx: AudioContext | null = null;
let ambientNodes: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;
let isConsentedCache: boolean | null = null;
let listenersAttached = false;
let storeUnsubscribe: (() => void) | null = null;

export function isAudioContextCreated(): boolean {
  return audioCtx !== null;
}

export function readSoundConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(SOUND_STORAGE_KEY);
    return val === 'enabled';
  } catch {
    return false;
  }
}

export function writeSoundConsent(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'enabled' : 'muted');
  } catch {
    /* storage unavailable or blocked */
  }
}

function getOrCreateContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  if (typeof window === 'undefined') return null;

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    audioCtx = new AudioContextClass();
    return audioCtx;
  } catch {
    return null;
  }
}

function createNoiseBuffer(ctx: AudioContext, durationSeconds: number): AudioBuffer | null {
  try {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  } catch {
    return null;
  }
}

function synthClick(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}

function synthHover(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.015);

  gain.gain.setValueAtTime(0.035, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.02);
}

function synthWhoosh(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const duration = 0.35;
  const noise = createNoiseBuffer(ctx, duration);

  if (noise) {
    const source = ctx.createBufferSource();
    source.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.linearRampToValueAtTime(950, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);
    filter.Q.setValueAtTime(3.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);
  } else {
    // Fallback if buffer not available
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(150, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}

function synthSuccess(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteDuration = 0.38;

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.075;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + noteDuration);
  });
}

function startAmbientPad(ctx: AudioContext): void {
  if (ambientNodes) return;
  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110, now); // A2

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(164.81, now); // E3

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 1.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    ambientNodes = { osc1, osc2, gain };
  } catch {
    /* ignore audio node setup errors */
  }
}

function stopAmbientPad(ctx: AudioContext): void {
  if (!ambientNodes) return;
  try {
    const now = ctx.currentTime;
    ambientNodes.gain.gain.setValueAtTime(ambientNodes.gain.gain.value, now);
    ambientNodes.gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
    const nodes = ambientNodes;
    setTimeout(() => {
      try {
        nodes.osc1.stop();
        nodes.osc2.stop();
      } catch {
        /* already stopped */
      }
    }, 350);
  } catch {
    /* ignore */
  }
  ambientNodes = null;
}

class ProceduralAudioEngine implements AudioEngine {
  isEnabled(): boolean {
    if (isConsentedCache === null) {
      isConsentedCache = readSoundConsent();
    }
    return isConsentedCache;
  }

  async setSoundEnabled(enabled: boolean): Promise<void> {
    isConsentedCache = enabled;
    writeSoundConsent(enabled);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: { enabled } }));
    }

    if (enabled) {
      const ctx = getOrCreateContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* browser gesture policy may delay */
          }
        }
        startAmbientPad(ctx);
        synthClick(ctx);
      }
    } else {
      if (audioCtx) {
        stopAmbientPad(audioCtx);
        try {
          await audioCtx.suspend();
        } catch {
          /* ignore */
        }
      }
    }
  }

  async toggleSound(): Promise<boolean> {
    const nextState = !this.isEnabled();
    await this.setSoundEnabled(nextState);
    return nextState;
  }

  play(sound: SoundName): void {
    if (!this.isEnabled()) return;
    const ctx = getOrCreateContext();
    if (!ctx || ctx.state === 'suspended') return;

    try {
      switch (sound) {
        case 'click':
          synthClick(ctx);
          break;
        case 'hover':
          synthHover(ctx);
          break;
        case 'whoosh':
          synthWhoosh(ctx);
          break;
        case 'ambient':
          startAmbientPad(ctx);
          break;
        case 'success':
          synthSuccess(ctx);
          break;
      }
    } catch {
      /* synthesis error ignored */
    }
  }

  startAmbient(): void {
    if (!this.isEnabled()) return;
    const ctx = getOrCreateContext();
    if (ctx && ctx.state !== 'suspended') {
      startAmbientPad(ctx);
    }
  }

  stopAmbient(): void {
    if (audioCtx) {
      stopAmbientPad(audioCtx);
    }
  }
}

let instance: ProceduralAudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!instance) {
    instance = new ProceduralAudioEngine();
    attachListeners();
  }
  return instance;
}

function attachListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  // Delegated click listener for data-sound="click"
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest?.('[data-sound="click"]');
    if (target && instance?.isEnabled()) {
      instance.play('click');
    }
  });

  // Delegated mouseover listener for data-sound="hover"
  document.addEventListener('mouseover', (event) => {
    const target = (event.target as Element | null)?.closest?.('[data-sound="hover"]');
    if (target && instance?.isEnabled()) {
      instance.play('hover');
    }
  });

  // Scene changes hook in experience store
  let previousScene = useExperienceStore.getState().scene;
  storeUnsubscribe = useExperienceStore.subscribe((state) => {
    if (state.scene !== previousScene) {
      previousScene = state.scene;
      if (instance?.isEnabled()) {
        instance.play('whoosh');
      }
    }
  });
}

export function resetAudioEngineForTesting(): void {
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }
  if (audioCtx) {
    try {
      void audioCtx.close();
    } catch {
      /* ignore */
    }
    audioCtx = null;
  }
  ambientNodes = null;
  isConsentedCache = null;
  listenersAttached = false;
  instance = null;
}
