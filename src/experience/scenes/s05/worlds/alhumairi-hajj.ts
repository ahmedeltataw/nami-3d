import { defineWorld } from './motion';

// Travel props move around the unchanged abstract cube monument.
export const world = defineWorld('alhumairi-hajj', [{ name: 'Bus', kind: 'travel' }]);
export const animate = world.animate;
