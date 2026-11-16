import { model, poster } from '../../assets/helpers';

export const s04Assets = {
  'phone.kit': model('/models/phone/phone_kit.glb', 114564, ['s04']),
  'robot.choreography': model('/models/robot/choreography.glb', 1945564, ['s04']),
  'poster:s04': poster('s04'),
} as const;
