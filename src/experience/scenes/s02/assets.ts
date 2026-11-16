import { model, poster } from '../../assets/helpers';

export const s02Assets = {
  'portal.gate': model('/models/portal/portal_gate.glb', 506664, ['s02']),
  'lab.shell': model('/models/lab/lab_shell.glb', 1091344, ['s02', 's03']),
  'poster:s02': poster('s02'),
} as const;
