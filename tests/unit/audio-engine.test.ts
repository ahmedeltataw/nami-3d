import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SOUND_STORAGE_KEY,
  getAudioEngine,
  isAudioContextCreated,
  resetAudioEngineForTesting,
} from '../../src/audio';
import { useExperienceStore } from '../../src/experience/store';

function createMockStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
      store[key] = String(val);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

class MockElement extends EventTarget {
  attributes: Record<string, string> = {};
  parentElement: MockElement | null = null;
  children: MockElement[] = [];

  setAttribute(name: string, val: string) {
    this.attributes[name] = val;
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name: string) {
    return name in this.attributes;
  }
  removeAttribute(name: string) {
    delete this.attributes[name];
  }
  closest(selector: string): MockElement | null {
    if (selector.includes('data-sound="click"') && this.attributes['data-sound'] === 'click') {
      return this;
    }
    if (selector.includes('data-sound="hover"') && this.attributes['data-sound'] === 'hover') {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }
  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx >= 0) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
  }
  click() {
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: this, configurable: true });
    this.dispatchEvent(event);
    documentMock.dispatchEvent(event);
  }
}

let mockStorage: ReturnType<typeof createMockStorage>;
let documentMock: EventTarget & {
  body: MockElement;
  createElement: (tag: string) => MockElement;
};

describe('Audio Engine (WebAudio Procedural)', () => {
  let audioContextInstances: Array<unknown> = [];
  let AudioContextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    audioContextInstances = [];
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);

    const bodyElement = new MockElement();
    documentMock = Object.assign(new EventTarget(), {
      body: bodyElement,
      createElement: () => new MockElement(),
    });
    vi.stubGlobal('document', documentMock);

    const windowMock = Object.assign(new EventTarget(), {
      localStorage: mockStorage,
    });
    vi.stubGlobal('window', windowMock);

    resetAudioEngineForTesting();

    AudioContextMock = vi.fn().mockImplementation(function () {
      const mockCtx = {
        state: 'running',
        currentTime: 0,
        sampleRate: 44100,
        destination: {},
        createOscillator: vi.fn().mockReturnValue({
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
          gain: {
            value: 1,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        }),
        createBiquadFilter: vi.fn().mockReturnValue({
          type: 'lowpass',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        }),
        createBuffer: vi.fn().mockReturnValue({
          getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
        }),
        createBufferSource: vi.fn().mockReturnValue({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }),
        suspend: vi.fn().mockImplementation(async () => {
          mockCtx.state = 'suspended';
        }),
        resume: vi.fn().mockImplementation(async () => {
          mockCtx.state = 'running';
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      audioContextInstances.push(mockCtx);
      return mockCtx;
    });

    vi.stubGlobal('AudioContext', AudioContextMock);
    (windowMock as unknown as Record<string, unknown>).AudioContext = AudioContextMock;
  });

  it('audio engine never creates AudioContext before consent (mock)', () => {
    // Accessing audio engine, querying status, or calling play before consent
    const engine = getAudioEngine();
    expect(engine.isEnabled()).toBe(false);
    expect(isAudioContextCreated()).toBe(false);
    expect(AudioContextMock).not.toHaveBeenCalled();

    // Triggering sounds before consent must be a no-op and never create AudioContext
    engine.play('click');
    engine.play('whoosh');
    engine.play('ambient');
    engine.play('success');
    engine.play('hover');

    expect(isAudioContextCreated()).toBe(false);
    expect(AudioContextMock).not.toHaveBeenCalled();
  });

  it('mute persistence and immediate context suspension', async () => {
    const engine = getAudioEngine();

    // Explicit consent grants permission and creates context
    await engine.setSoundEnabled(true);
    expect(engine.isEnabled()).toBe(true);
    expect(isAudioContextCreated()).toBe(true);
    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(mockStorage.getItem(SOUND_STORAGE_KEY)).toBe('enabled');

    // Muting suspends context immediately and persists
    await engine.setSoundEnabled(false);
    expect(engine.isEnabled()).toBe(false);
    expect(mockStorage.getItem(SOUND_STORAGE_KEY)).toBe('muted');

    const ctx = audioContextInstances[0] as { state: string; suspend: ReturnType<typeof vi.fn> };
    expect(ctx.suspend).toHaveBeenCalled();
  });

  it('handles localStorage errors gracefully without throwing', async () => {
    const brokenStorage = {
      getItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage disabled');
      }),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      }),
    };

    // Override localStorage with broken mock
    vi.stubGlobal('localStorage', brokenStorage);

    const engine = getAudioEngine();
    expect(() => engine.isEnabled()).not.toThrow();
    await expect(engine.setSoundEnabled(true)).resolves.not.toThrow();
  });

  it('scene change in experience store triggers whoosh only when enabled', async () => {
    const engine = getAudioEngine();
    const playSpy = vi.spyOn(engine, 'play');

    // Muted: scene change should not play whoosh
    useExperienceStore.setState({ scene: 's02' });
    expect(playSpy).not.toHaveBeenCalledWith('whoosh');

    // Enable sound
    await engine.setSoundEnabled(true);
    playSpy.mockClear();

    // Change scene
    useExperienceStore.setState({ scene: 's03' });
    expect(playSpy).toHaveBeenCalledWith('whoosh');
  });

  it('delegated click listener plays click sound on elements with data-sound="click"', async () => {
    const engine = getAudioEngine();
    const playSpy = vi.spyOn(engine, 'play');

    const button = documentMock.createElement('button');
    button.setAttribute('data-sound', 'click');
    documentMock.body.appendChild(button);

    // Muted: clicking does not trigger sound
    button.click();
    expect(playSpy).not.toHaveBeenCalledWith('click');

    // Enable sound
    await engine.setSoundEnabled(true);
    playSpy.mockClear();

    // Click again
    button.click();
    expect(playSpy).toHaveBeenCalledWith('click');

    button.remove();
  });
});
