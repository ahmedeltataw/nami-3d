import type { CameraPose, SampleInput } from '../../../contracts';
import type { NodeState, StationDef, StationSnapshot, StepDef } from '../station';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const state = (visible: boolean, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): NodeState => ({
  visible,
  offset: [x || 0, y || 0, z || 0],
  rotation: [rx || 0, ry || 0, rz || 0],
  scale: [Number.isFinite(sx) ? sx : 1, Number.isFinite(sy) ? sy : 1, Number.isFinite(sz) ? sz : 1],
});
export const cloudSteps: StepDef[] = ['racks', 'cloud', 'rings', 'beams', 'steady'].map((id, i) => ({ id, from: .2 + i * .12, to: .2 + (i + 1) * .12 }));

export function cloudStation(camera: CameraPose): StationDef {
  return {
    id: 5, slug: 'cloud-services', assetKey: 'station.5', steps: cloudSteps,
    cameraAnchor: 'CamAnchor_5', robotTarget: 'S5_RobotTarget',
    panel: { titleKey: 'cloud-services.title', descKey: 'cloud-services.description', href: '/all-services/5' },
    sample(local: number, input: SampleInput): StationSnapshot {
      const progress = input.profile.motion === 'reduced' ? 1 : clamp(local);
      const phase = progress < .2 ? 'arrival' : progress < .8 ? 'demo' : 'hold';
      const step = Math.min(4, Math.max(0, Math.floor((progress - .2) / .12)));
      const amount = (n: number) => clamp((progress - (.2 + n * .12)) / .12);
      const a = amount(0), b = amount(1), c = amount(2), d = amount(3), e = amount(4);
      const float = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.sin(progress * Math.PI * 4) * .05 * b;
      const spin = input.profile.motion === 'reduced' || progress >= .8 ? 0 : progress * Math.PI * 4;
      return { phase, step, camera, robot: { state: 'guiding', point: phase === 'arrival' ? null : 'S5_RobotTarget' }, nodes: {
        S5_Rack_1: { ...state(true, 0, (1 - a) * -.15, 0), emissive: .1 + a * .45 + e * .45, emissiveColor: [.16, .85, .5] },
        S5_Rack_2: { ...state(true, 0, (1 - a) * -.15, 0), emissive: .1 + a * .45 + e * .45, emissiveColor: [.16, .85, .5] },
        S5_Cloud: { ...state(b > 0, 0, (1 - b) * -.3 + float, 0, 0, 0, 0, b, b, b), emissive: .1 + b * .35 + e * .55, emissiveColor: [.16, .85, .5] },
        S5_LinkRing_1: { ...state(c > 0, 0, float, 0, 0, spin * c, 0, c, c, c), emissive: .2 + c * .3 + e * .5, emissiveColor: [.16, .85, .5] },
        S5_LinkRing_2: { ...state(c > 0, 0, float, 0, -spin * .8 * c, 0, spin * .6 * c, c, c, c), emissive: .2 + c * .3 + e * .5, emissiveColor: [.16, .85, .5] },
        S5_Beam_1: { ...state(d > 0, 0, (1 - d) * -.2, 0, 0, 0, 0, d, d, d), emissive: .2 + d * .4 + e * .4, emissiveColor: [.16, .85, .5] },
        S5_Beam_2: { ...state(d > 0, 0, (1 - d) * -.2, 0, 0, 0, 0, d, d, d), emissive: .2 + d * .4 + e * .4, emissiveColor: [.16, .85, .5] },
        ArmL_Shoulder: state(true, 0, 0, 0, -.4 * Math.sin(b * Math.PI)),
        ArmR_Shoulder: state(true, 0, 0, 0, .4 * Math.sin(d * Math.PI)),
      } };
    },
  };
}
