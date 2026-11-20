import type { SceneId, TransitionSnapshot } from '../contracts';
import type { SceneRig } from './types';
import { s01 } from './s01';
import { s02 } from './s02';
import { s03 } from './s03';
import { s04 } from './s04';
import { s05 } from './s05';
import { s06 } from './s06';
import { s07 } from './s07';

export const rigs: Record<SceneId, SceneRig> = { s01, s02, s03, s04, s05, s06, s07 };
export type LightingTransition = Pick<TransitionSnapshot, 'id' | 'owner' | 'lights'>;
export function lightingWeights(scene: SceneId, intents: LightingTransition | null): Partial<Record<SceneId, number>> {
  if (!intents) return { [scene]: 1 };
  const [from, to] = intents.id.split('->') as [SceneId, SceneId];
  return { [from]: intents.lights.aWeight, [to]: intents.lights.bWeight };
}
