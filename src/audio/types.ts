export type SoundName = 'click' | 'hover' | 'whoosh' | 'ambient' | 'success';

export interface AudioEngine {
  isEnabled: () => boolean;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  toggleSound: () => Promise<boolean>;
  play: (sound: SoundName) => void;
  startAmbient: () => void;
  stopAmbient: () => void;
}
