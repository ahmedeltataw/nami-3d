import { model } from './helpers';

export const sharedAssets = {
  'robot.high': model('/models/robot/robot_high.glb', 1951000, []),
  'robot.low': model('/models/robot/robot_low.glb', 1252272, []),
  'robot.choreography': model('/models/robot/choreography.glb', 1945564, []),
} as const;
