import type { CameraPose, SampleInput } from '../../../contracts';
import type { NodeState, StationDef, StationSnapshot, StepDef } from '../station';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const state = (visible: boolean, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): NodeState => ({ visible, offset: [x || 0, y || 0, z || 0], rotation: [rx || 0, ry || 0, rz || 0], scale: [1, 1, 1] });
export const webSteps: StepDef[] = ['wireframe', 'structure', 'layers', 'color', 'complete'].map((id, i) => ({ id, from: .2 + i * .12, to: .2 + (i + 1) * .12 }));
export function webStation(camera: CameraPose): StationDef {
  return {
    id: 1, slug: 'website-development', assetKey: 'station.1', steps: webSteps,
    cameraAnchor: 'CamAnchor_1', robotTarget: 'S1_RobotTarget',
    panel: { titleKey: 'website-development.title', descKey: 'website-development.description', href: '/all-services/1' },
    sample(local: number, input: SampleInput): StationSnapshot {
      const progress = input.profile.motion === 'reduced' ? 1 : clamp(local);
      const phase = progress < .2 ? 'arrival' : progress < .8 ? 'demo' : 'hold';
      const step = Math.min(4, Math.max(0, Math.floor((progress - .2) / .12)));
      const amount = (n: number) => clamp((progress - (.2 + n * .12)) / .12);
      const a = amount(0), b = amount(1), c = amount(2), d = amount(3), e = amount(4);
      const float = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.sin(progress * Math.PI * 4) * .06 * b;
      return { phase, step, camera, robot: { state: 'guiding', point: phase === 'arrival' ? null : 'S1_RobotTarget' }, nodes: {
        S1_Display: state(a > 0, 0, (1-a)*-.3),
        S1_Screen: { ...state(true), emissive: .1 + d*.35 + e*.55, emissiveColor: [.16, .85, .5] },
        S1_Window_1: state(b > 0, (1-b)*-.65, (1-b)*.2 + float),
        S1_Window_2: state(c > 0, (1-c)*.65, (1-c)*.2 - float * c),
        S1_CodeCard_1: state(b > 0, (1-b)*-.6),
        S1_CodeCard_2: state(c > 0, (1-c)*.6),
        S1_CodeCard_3: state(d > 0, 0, (1-d)*.5),
        ArmL_Shoulder: state(true, 0, 0, 0, -.4 * Math.sin(b * Math.PI)),
        ArmR_Shoulder: state(true, 0, 0, 0, .4 * Math.sin(d * Math.PI)),
      } };
    },
  };
}
