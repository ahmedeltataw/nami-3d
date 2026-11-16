import { defineWorld } from './motion';

// Olive trees sway from their authored base pivots; produce stays on the stall.
export const world = defineWorld('rif-aljouf', [
  { name: 'OliveTree_1', kind: 'sway' }, { name: 'OliveTree_2', kind: 'sway', phase: 1.4 },
]);
export const animate = world.animate;
