import { world as rif } from './rif-aljouf';
import { world as loryfy } from './loryfy';
import { world as tasami } from './tasami';
import { world as benaat } from './benaat';
import { world as hajj } from './alhumairi-hajj';
import { world as shahntak } from './shahntak';
import type { WorldSlug } from '../projects';
import type { WorldDefinition } from './motion';

export const worldAnimations: Record<WorldSlug, WorldDefinition> = {
  'rif-aljouf': rif, loryfy, tasami, benaat, 'alhumairi-hajj': hajj, shahntak,
};
