import { defineWorld } from './motion';

export const world = defineWorld('shahntak', [
  { name: 'RouteLine', kind: 'route' }, { name: 'Truck', kind: 'travel' },
  { name: 'Pin_1', kind: 'pin' }, { name: 'Pin_2', kind: 'pin', phase: 1.5 }, { name: 'Pin_3', kind: 'pin', phase: 3 },
]);
export const animate = world.animate;
