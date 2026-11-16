import { CatmullRomCurve3, Matrix4, Quaternion, Vector3, type Color, type Material, type PointLight } from 'three';
import type { Ctx, SceneDef } from '../../contracts';
import { stations, positions, targets, applyStation, type StationSnapshot } from './station';
import type { bindStation } from './station';

export type DimMaterial = { material: Material & { color: Color }; color: Color };
export type LabCtx = Ctx & { nodes: ReturnType<typeof bindStation>; lights: PointLight[]; materials: DimMaterial[][] };
const cameraPath = new CatmullRomCurve3(positions.map(position => new Vector3(...position)), false, 'centripetal');
const targetPath = new CatmullRomCurve3(targets.map(target => new Vector3(...target)), false, 'centripetal');
const up = new Vector3(0, 1, 0);
const revealPosition = new Vector3(0, 5, 9);
const revealTarget = new Vector3(0, 1, -4);
function pose(position: Vector3, target: Vector3) {
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, up));
  return { position: position.toArray() as [number, number, number], quaternion: quaternion.toArray().map(value => value || 0) as [number, number, number, number], fov: 45, near: .1, far: 100 };
}
export function stationProgress(local: number) {
  const scaled = Math.max(0, Math.min(1, (local - .1) / .9)) * 6;
  const index = Math.min(5, Math.floor(scaled));
  return { index, local: local < .1 ? 0 : Math.min(1, scaled - index) };
}
export const scene: SceneDef = {
  id: 's03', poster: '/posters/s03.svg', assets: ['poster:s03', 'lab.shell', 'arms', ...stations.map(station => station.assetKey)],
  sample(input) {
    const current = stationProgress(input.local);
    const station = stations[current.index].sample(current.local, input);
    const reduced = input.profile.motion === 'reduced';
    let camera = reduced ? pose(revealPosition, revealTarget) : station.camera;
    if (!reduced && input.local < .1) {
      const raw = Math.max(0, input.local / .1);
      const t = raw * raw * (3 - 2 * raw);
      camera = pose(revealPosition.clone().lerp(new Vector3(...positions[0]), t), revealTarget.clone().lerp(new Vector3(...targets[0]), t));
    } else if (!reduced && current.index > 0 && current.local < .2) {
      const raw = current.local / .2;
      const t = raw * raw * (3 - 2 * raw);
      const u = (current.index - 1 + t) / 5;
      camera = pose(cameraPath.getPoint(u), targetPath.getPoint(u));
    }
    return { camera, robot: station.robot.point ? { kind: 'point', target: station.robot.point } : { kind: 'rest' }, visual: {
      robotState: 'guiding', station: current.index + 1, light: reduced ? 1 : input.local < .1 ? 0 : Math.min(1, current.local / .2),
      stationSnapshot: station, webSnapshot: current.index === 0 ? station : stations[0].sample(1, input),
    } };
  },
  apply(snapshot, context) {
    const lab = context as LabCtx;
    if (lab.nodes) {
      applyStation(snapshot.visual.webSnapshot as StationSnapshot, lab.nodes);
      if (snapshot.visual.stationSnapshot && snapshot.visual.stationSnapshot !== snapshot.visual.webSnapshot) {
        applyStation(snapshot.visual.stationSnapshot as StationSnapshot, lab.nodes);
      }
    }
    const active = Number(snapshot.visual.station) - 1;
    const amount = Number(snapshot.visual.light);
    if (lab.lights) for (let i = 0; i < lab.lights.length; i++) lab.lights[i].intensity = i === active ? amount * 20 : 0;
    if (lab.materials) for (let i = 0; i < lab.materials.length; i++) {
      const brightness = i === active ? .35 + .65 * amount : .35;
      const materials = lab.materials[i];
      for (let j = 0; j < materials.length; j++) materials[j].material.color.copy(materials[j].color).multiplyScalar(brightness);
    }
  },
};
