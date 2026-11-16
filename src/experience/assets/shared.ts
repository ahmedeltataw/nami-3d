import { model } from './helpers';

export const sharedAssets = {
  'robot.high': model('/models/robot/robot_high.glb', 1945564, []),
  'robot.low': model('/models/robot/robot_low.glb', 1250568, []),
} as const;
