import type { CameraPose, SampleInput } from '../../../contracts';
import type { NodeState, StationDef, StationSnapshot, StepDef } from '../station';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const state = (visible: boolean, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): NodeState => ({
  visible,
  offset: [x || 0, y || 0, z || 0],
  rotation: [rx || 0, ry || 0, rz || 0],
  scale: [Number.isFinite(sx) ? sx : 1, Number.isFinite(sy) ? sy : 1, Number.isFinite(sz) ? sz : 1],
});

export const marketingSteps: StepDef[] = ['base', 'bars', 'growth', 'campaign', 'reach'].map((id, i) => ({
  id,
  from: .2 + i * .12,
  to: .2 + (i + 1) * .12,
}));

export function marketingStation(camera: CameraPose): StationDef {
  return {
    id: 3,
    slug: 'digital-marketing',
    assetKey: 'station.3',
    steps: marketingSteps,
    cameraAnchor: 'CamAnchor_3',
    robotTarget: 'S3_RobotTarget',
    panel: {
      titleKey: 'digital-marketing.title',
      descKey: 'digital-marketing.description',
      href: '/all-services/3',
    },
    sample(local: number, input: SampleInput): StationSnapshot {
      const progress = input.profile.motion === 'reduced' ? 1 : clamp(local);
      const phase = progress < .2 ? 'arrival' : progress < .8 ? 'demo' : 'hold';
      const step = Math.min(4, Math.max(0, Math.floor((progress - .2) / .12)));
      const amount = (n: number) => clamp((progress - (.2 + n * .12)) / .12);
      const a = amount(0), b = amount(1), c = amount(2), d = amount(3), e = amount(4);
      const float = input.profile.motion === 'reduced' || progress >= .8 ? 0 : Math.sin(progress * Math.PI * 4) * .06 * b;

      const barScale = (index: number) => (input.profile.motion === 'reduced' ? 1 : clamp((b - index * .15) / .4));
      const arrowScale = input.profile.motion === 'reduced' ? 1 : c;
      const pulse = input.profile.motion === 'reduced' ? 1 : 1 + Math.sin(d * Math.PI * 2) * .12 * d;
      const popSocial = input.profile.motion === 'reduced' ? 1 : e;
      const orbitAngle = e * Math.PI * 2;

      return {
        phase,
        step,
        camera,
        robot: { state: 'guiding', point: phase === 'arrival' ? null : 'S3_RobotTarget' },
        nodes: {
          S3_ChartBase: state(a > 0, 0, (1 - a) * -.25),
          S3_Bar_1: state(a > 0, 0, 0, 0, 0, 0, 0, 1, barScale(0), 1),
          S3_Bar_2: state(a > 0, 0, 0, 0, 0, 0, 0, 1, barScale(1), 1),
          S3_Bar_3: state(a > 0, 0, 0, 0, 0, 0, 0, 1, barScale(2), 1),
          S3_Bar_4: state(a > 0, 0, 0, 0, 0, 0, 0, 1, barScale(3), 1),
          S3_Bar_5: state(a > 0, 0, 0, 0, 0, 0, 0, 1, barScale(4), 1),
          S3_GrowthArrow: state(c > 0, 0, 0, 0, 0, 0, 0, arrowScale, arrowScale, arrowScale),
          S3_Megaphone: state(d > 0, (1 - d) * -.35, (1 - d) * .2 + float, 0, 0, 0, 0, pulse, pulse, pulse),
          S3_Social_1: state(
            e > 0,
            Math.cos(orbitAngle) * .18,
            (1 - e) * .3 + float,
            Math.sin(orbitAngle) * .18,
            0,
            0,
            0,
            popSocial,
            popSocial,
            popSocial,
          ),
          S3_Social_2: state(
            e > 0,
            Math.cos(orbitAngle + 2.0944) * .18,
            (1 - e) * .3 - float * e,
            Math.sin(orbitAngle + 2.0944) * .18,
            0,
            0,
            0,
            popSocial,
            popSocial,
            popSocial,
          ),
          S3_Social_3: state(
            e > 0,
            Math.cos(orbitAngle + 4.1888) * .18,
            (1 - e) * .3 + float,
            Math.sin(orbitAngle + 4.1888) * .18,
            0,
            0,
            0,
            popSocial,
            popSocial,
            popSocial,
          ),
          ArmL_Shoulder: state(true, 0, 0, 0, -.35 * Math.sin(b * Math.PI)),
          ArmR_Shoulder: state(true, 0, 0, 0, .35 * Math.sin(d * Math.PI)),
        },
      };
    },
  };
}
