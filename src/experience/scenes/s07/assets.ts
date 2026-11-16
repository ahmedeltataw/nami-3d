import { model, poster } from '../../assets/helpers';

export const s07Assets = {
  'poster:s07': poster('s07'),
  'tech.cubes': model('/models/s07/tech_cubes.glb', 48880, ['s07']),
  'display.platform': model('/models/s07/display_platform.glb', 95844, ['s07']),
} as const;
