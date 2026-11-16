import { defineWorld } from './motion';

// CraneHook's export places its pivot at the jib for a Z-axis swing.
export const world = defineWorld('benaat', [{ name: 'CraneHook', kind: 'swing' }]);
export const animate = world.animate;
