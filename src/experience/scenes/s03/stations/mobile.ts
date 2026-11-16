import type { CameraPose, SampleInput } from '../../../contracts';
import type { NodeState, StationDef, StationSnapshot, StepDef } from '../station';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const state = (visible: boolean, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): NodeState => ({
  visible,
  offset: [x || 0, y || 0, z || 0],
  rotation: [rx || 0, ry || 0, rz || 0],
  scale: [Number.isFinite(sx) ? sx : 1, Number.isFinite(sy) ? sy : 1, Number.isFinite(sz) ? sz : 1],
});

export const mobileSteps: StepDef[] = ['docked', 'screens', 'flow', 'apps', 'ready'].map((id, i) => ({
  id,
  from: .2 + i * .12,
  to: .2 + (i + 1) * .12,
}));

export function mobileStation(camera: CameraPose): StationDef {
  return {
    id: 2,
    slug: 'mobile-application-development',
    assetKey: 'station.2',
    steps: mobileSteps,
    cameraAnchor: 'CamAnchor_2',
    robotTarget: 'S2_RobotTarget',
    panel: {
      titleKey: 'mobile-application-development.title',
      descKey: 'mobile-application-development.description',
      href: '/all-services/2',
    },
    sample(local: number, input: SampleInput): StationSnapshot {
      const progress = input.profile.motion === 'reduced' ? 1 : clamp(local);
      const phase = progress < .2 ? 'arrival' : progress < .8 ? 'demo' : 'hold';
      const step = Math.min(4, Math.max(0, Math.floor((progress - .2) / .12)));
      const amount = (n: number) => clamp((progress - (.2 + n * .12)) / .12);
      const a = amount(0), b = amount(1), c = amount(2), d = amount(3), e = amount(4);
      const float = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.sin(progress * Math.PI * 4) * .06 * b;
      const swap = c * .4;
      const rotY = c * .35 + Math.sin(c * Math.PI) * .2;
      const pop = input.profile.motion === 'reduced' ? 1 : 1 + Math.sin(d * Math.PI) * .15;

      return {
        phase,
        step,
        camera,
        robot: { state: 'guiding', point: phase === 'arrival' ? null : 'S2_RobotTarget' },
        nodes: {
          S2_Stand: state(a > 0, 0, (1 - a) * -.2),
          S2_StandPhone: state(a > 0, 0, (1 - a) * .3, (1 - a) * -.1),
          S2_StandPhone_Screen: {
            ...state(a > 0),
            emissive: .1 + c * .35 + e * .55,
            emissiveColor: [.16, .85, .5],
          },
          S2_FloatPhone_1: state(
            b > 0,
            (1 - b) * -.7 + swap,
            (1 - b) * .25 + float,
            Math.sin(c * Math.PI) * .2,
            0,
            rotY,
            c * .05,
            pop,
            pop,
            pop,
          ),
          S2_FloatPhone_1_Screen: {
            ...state(b > 0),
            emissive: .1 + c * .35 + e * .55,
            emissiveColor: [.2, .75, 1],
          },
          S2_FloatPhone_2: state(
            b > 0,
            (1 - b) * .7 - swap,
            (1 - b) * .2 - float * c,
            -Math.sin(c * Math.PI) * .2,
            0,
            -rotY,
            -c * .05,
            pop,
            pop,
            pop,
          ),
          S2_FloatPhone_2_Screen: {
            ...state(b > 0),
            emissive: .1 + c * .35 + e * .55,
            emissiveColor: [.2, .75, 1],
          },
          ArmL_Shoulder: state(true, 0, 0, 0, -.35 * Math.sin(b * Math.PI)),
          ArmR_Shoulder: state(true, 0, 0, 0, .35 * Math.sin(d * Math.PI)),
        },
      };
    },
  };
}
