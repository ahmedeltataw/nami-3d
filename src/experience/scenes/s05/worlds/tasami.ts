import { defineWorld } from './motion';

export const world = defineWorld('tasami', [
  { name: 'Bubble_1', kind: 'pulse' }, { name: 'Bubble_2', kind: 'pulse', phase: 1 },
  { name: 'Bubble_3', kind: 'pulse', phase: 2 }, { name: 'Bubble_4', kind: 'pulse', phase: 3 },
  { name: 'Bubble_5', kind: 'pulse', phase: 4 },
]);
export const animate = world.animate;
