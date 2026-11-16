import { defineWorld } from './motion';

// Floating reward coins spin; the badges echo the loyalty reward pulse.
export const world = defineWorld('loryfy', [
  { name: 'StarBadge_1', kind: 'pulse' }, { name: 'StarBadge_2', kind: 'pulse', phase: 2 },
]);
export const animate = world.animate;
