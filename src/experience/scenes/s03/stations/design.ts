import type { CameraPose, SampleInput } from '../../../contracts';
import type { NodeState, StationDef, StationSnapshot, StepDef } from '../station';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const state = (visible: boolean, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): NodeState => ({
  visible,
  offset: [x || 0, y || 0, z || 0],
  rotation: [rx || 0, ry || 0, rz || 0],
  scale: [Number.isFinite(sx) ? sx : 1, Number.isFinite(sy) ? sy : 1, Number.isFinite(sz) ? sz : 1],
});
export const designSteps: StepDef[] = ['screen', 'palette', 'wireframes', 'stylus', 'glow'].map((id, i) => ({ id, from: .2 + i * .12, to: .2 + (i + 1) * .12 }));

export function designStation(camera: CameraPose): StationDef {
  return {
    id: 6, slug: 'design-services', assetKey: 'station.6', steps: designSteps,
    cameraAnchor: 'CamAnchor_6', robotTarget: 'S6_RobotTarget',
    panel: { titleKey: 'design-services.title', descKey: 'design-services.description', href: '/all-services/6' },
    sample(local: number, input: SampleInput): StationSnapshot {
      const progress = input.profile.motion === 'reduced' ? 1 : clamp(local);
      const phase = progress < .2 ? 'arrival' : progress < .8 ? 'demo' : 'hold';
      const step = Math.min(4, Math.max(0, Math.floor((progress - .2) / .12)));
      const amount = (n: number) => clamp((progress - (.2 + n * .12)) / .12);
      const a = amount(0), b = amount(1), c = amount(2), d = amount(3), e = amount(4);
      const float = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.sin(progress * Math.PI * 4) * .05 * b;
      const drawX = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.sin(d * Math.PI * 4) * .12 * (1 - e);
      const drawY = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.cos(d * Math.PI * 4) * .06 * (1 - e);
      const stylusRot = input.profile.motion === 'reduced' || progress >= .8 ? 0 : -.2 * Math.sin(d * Math.PI * 2);
      return { phase, step, camera, robot: { state: 'guiding', point: phase === 'arrival' ? null : 'S6_RobotTarget' }, nodes: {
        S6_Stand: state(true),
        S6_Tablet: state(true, 0, (1 - a) * -.2, 0),
        S6_TabletScreen: { ...state(true, 0, (1 - a) * -.2, 0), emissive: .1 + a * .35 + d * .25 + e * .3, emissiveColor: [.16, .85, .5] },
        S6_Swatch_1: { ...state(b > 0, (1 - b) * .5, (1 - b) * -.3 + float, 0, 0, 0, 0, b, b, b), emissive: .1 + b * .3 + e * .5, emissiveColor: [.16, .85, .5] },
        S6_Swatch_2: { ...state(b > 0, (1 - b) * .4, (1 - b) * -.2 - float * .8, 0, 0, 0, 0, b, b, b), emissive: .1 + b * .3 + e * .5, emissiveColor: [.16, .85, .5] },
        S6_Swatch_3: { ...state(b > 0, (1 - b) * .3, (1 - b) * .2 + float * .9, 0, 0, 0, 0, b, b, b), emissive: .1 + b * .3 + e * .5, emissiveColor: [.16, .85, .5] },
        S6_Swatch_4: { ...state(b > 0, (1 - b) * .2, (1 - b) * .3 - float * .7, 0, 0, 0, 0, b, b, b), emissive: .1 + b * .3 + e * .5, emissiveColor: [.16, .85, .5] },
        S6_Wireframe_1: { ...state(c > 0, (1 - c) * .4, (1 - c) * -.3 + float, 0, 0, 0, 0, c, c, c), emissive: .1 + c * .4 + e * .5, emissiveColor: [.16, .85, .5] },
        S6_Wireframe_2: { ...state(c > 0, (1 - c) * -.4, (1 - c) * -.3 - float, 0, 0, 0, 0, c, c, c), emissive: .1 + c * .4 + e * .5, emissiveColor: [.16, .85, .5] },
        S6_Stylus: { ...state(d > 0, (1 - d) * .3 + drawX, (1 - d) * .2 + drawY, 0, 0, 0, stylusRot), emissive: .2 + d * .4 + e * .4, emissiveColor: [.16, .85, .5] },
        ArmL_Shoulder: state(true, 0, 0, 0, -.4 * Math.sin(b * Math.PI)),
        ArmR_Shoulder: state(true, 0, 0, 0, .4 * Math.sin(d * Math.PI)),
      } };
    },
  };
}
