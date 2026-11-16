import { scene as s01 } from './s01/scene';
import { scene as s02 } from './s02/scene';
import { scene as s03 } from './s03/scene';
import { scene as s04 } from './s04/scene';
import { scene as s05 } from './s05/scene';
import { scene as s06 } from './s06/scene';
import { scene as s07 } from './s07/scene';
import type { SceneDef, SceneId } from '../contracts';

export const scenes: Record<SceneId, SceneDef> = { s01, s02, s03, s04, s05, s06, s07 };
