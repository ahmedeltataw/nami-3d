import type { CameraPose, SampleInput } from '../../../contracts';
import type { NodeState, StationDef, StationSnapshot, StepDef } from '../station';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const state = (visible: boolean, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): NodeState => ({
  visible,
  offset: [x || 0, y || 0, z || 0],
  rotation: [rx || 0, ry || 0, rz || 0],
  scale: [Number.isFinite(sx) ? sx : 1, Number.isFinite(sy) ? sy : 1, Number.isFinite(sz) ? sz : 1],
});
export const consultingSteps: StepDef[] = ['table', 'nodes', 'arrows', 'board', 'complete'].map((id, i) => ({ id, from: .2 + i * .12, to: .2 + (i + 1) * .12 }));

export function consultingStation(camera: CameraPose): StationDef {
  return {
    id: 4, slug: 'technical-consulting', assetKey: 'station.4', steps: consultingSteps,
    cameraAnchor: 'CamAnchor_4', robotTarget: 'S4_RobotTarget',
    panel: { titleKey: 'technical-consulting.title', descKey: 'technical-consulting.description', href: '/all-services/4' },
    sample(local: number, input: SampleInput): StationSnapshot {
      const progress = input.profile.motion === 'reduced' ? 1 : clamp(local);
      const phase = progress < .2 ? 'arrival' : progress < .8 ? 'demo' : 'hold';
      const step = Math.min(4, Math.max(0, Math.floor((progress - .2) / .12)));
      const amount = (n: number) => clamp((progress - (.2 + n * .12)) / .12);
      const a = amount(0), b = amount(1), c = amount(2), d = amount(3), e = amount(4);
      const float = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.sin(progress * Math.PI * 4) * .05 * b;
      const n1 = clamp(b / .25);
      const n2 = clamp((b - .25) / .25);
      const n3 = clamp((b - .5) / .25);
      const n4 = clamp((b - .75) / .25);
      const ar1 = clamp(c / .33);
      const ar2 = clamp((c - .33) / .33);
      const ar3 = clamp((c - .66) / .34);
      const nodeGlow = .1 + e * .7;
      return { phase, step, camera, robot: { state: 'guiding', point: phase === 'arrival' ? null : 'S4_RobotTarget' }, nodes: {
        S4_Table: state(true),
        S4_HoloSurface: { ...state(true), emissive: .1 + a * .35 + e * .55, emissiveColor: [.16, .85, .5] },
        S4_FlowNode_1: { ...state(n1 > 0, 0, (1 - n1) * -.25 + float, 0, 0, 0, 0, n1, n1, n1), emissive: nodeGlow, emissiveColor: [.16, .85, .5] },
        S4_FlowNode_2: { ...state(n2 > 0, 0, (1 - n2) * -.25 - float * .8, 0, 0, 0, 0, n2, n2, n2), emissive: nodeGlow, emissiveColor: [.16, .85, .5] },
        S4_FlowNode_3: { ...state(n3 > 0, 0, (1 - n3) * -.25 + float * .9, 0, 0, 0, 0, n3, n3, n3), emissive: nodeGlow, emissiveColor: [.16, .85, .5] },
        S4_FlowNode_4: { ...state(n4 > 0, 0, (1 - n4) * -.25 - float * .7, 0, 0, 0, 0, n4, n4, n4), emissive: nodeGlow, emissiveColor: [.16, .85, .5] },
        S4_Arrow_1: { ...state(ar1 > 0, 0, 0, 0, 0, 0, 0, ar1, ar1, ar1), emissive: .15 + c * .3 + e * .55, emissiveColor: [.16, .85, .5] },
        S4_Arrow_2: { ...state(ar2 > 0, 0, 0, 0, 0, 0, 0, ar2, ar2, ar2), emissive: .15 + c * .3 + e * .55, emissiveColor: [.16, .85, .5] },
        S4_Arrow_3: { ...state(ar3 > 0, 0, 0, 0, 0, 0, 0, ar3, ar3, ar3), emissive: .15 + c * .3 + e * .55, emissiveColor: [.16, .85, .5] },
        S4_Board: { ...state(d > 0, 0, (1 - d) * -.35, 0), emissive: .1 + d * .35 + e * .55, emissiveColor: [.16, .85, .5] },
        ArmL_Shoulder: state(true, 0, 0, 0, -.4 * Math.sin(b * Math.PI)),
        ArmR_Shoulder: state(true, 0, 0, 0, .4 * Math.sin(d * Math.PI)),
      } };
    },
  };
}
