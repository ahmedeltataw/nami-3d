import { CatmullRomCurve3, Matrix4, Quaternion, Vector3, type Color, type Material, type PointLight } from 'three';
import type { CameraPose, Ctx, SceneDef } from '../../contracts';
import { clamp } from '../../controller';
import { scene as phoneScene } from '../s04/scene';
import { stations, positions, cameraPoses, applyStation, type StationSnapshot } from './station';
import type { bindStation } from './station';

export type DimMaterial = { material: Material & { color: Color }; color: Color };
export type LabCtx = Ctx & { nodes: ReturnType<typeof bindStation>; lights: PointLight[]; materials: DimMaterial[][] };
const cameraPath = new CatmullRomCurve3(positions.map(position => new Vector3(...position)), false, 'centripetal');
export const LAB_INTRO_END = .05;
export const LAB_EXIT_START = .97;
export const STATION_SPAN = (LAB_EXIT_START - LAB_INTRO_END) / 6;
export const stationSeekLocal = (id: number) => LAB_INTRO_END + STATION_SPAN * (id - 1 + .8);
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const up = new Vector3(0, 1, 0);
const revealPosition = new Vector3(0, 5, 9);
const revealTarget = new Vector3(0, 1, -4);
function pose(position: Vector3, target: Vector3) {
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, up));
  return { position: position.toArray() as [number, number, number], quaternion: quaternion.toArray().map(value => value || 0) as [number, number, number, number], fov: 45, near: .1, far: 100 };
}
export function stationProgress(local: number) {
  const scaled = clamp((local - LAB_INTRO_END) / (LAB_EXIT_START - LAB_INTRO_END)) * 6;
  const index = Math.min(5, Math.floor(scaled));
  return { index, local: Math.min(1, scaled - index) };
}
function blendPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  if (t === 0) return from;
  if (t === 1) return to;
  return { ...to, position: new Vector3(...from.position).lerp(new Vector3(...to.position), t).toArray(),
    quaternion: new Quaternion().fromArray(from.quaternion).slerp(new Quaternion().fromArray(to.quaternion), t).toArray(),
    fov: from.fov + (to.fov - from.fov) * t };
}
export const scene: SceneDef = {
  id: 's03', poster: '/posters/s03.svg', assets: ['poster:s03', 'lab.shell', 'arms', ...stations.map(station => station.assetKey)],
  sample(input) {
    const current = stationProgress(input.local);
    const station = stations[current.index].sample(current.local, input);
    const reduced = input.profile.motion === 'reduced';
    const overview = pose(revealPosition, revealTarget);
    let camera = reduced ? overview : station.camera;
    const arrival = smooth(input.local / LAB_INTRO_END);
    const exit = smooth((input.local - LAB_EXIT_START) / (1 - LAB_EXIT_START));
    if (!reduced && input.local < LAB_INTRO_END) {
      camera = blendPose(overview, cameraPoses[0], arrival);
    } else if (!reduced && current.index > 0 && current.local < .2) {
      const t = smooth(current.local / .2);
      const u = (current.index - 1 + t) / 5;
      camera = { ...blendPose(cameraPoses[current.index - 1], station.camera, t), position: cameraPath.getPoint(u).toArray() };
    }
    if (input.local >= LAB_EXIT_START && (!reduced || input.local >= 1)) camera = blendPose(camera, phoneScene.sample({ ...input, local: 0 }).camera, reduced ? 1 : exit);
    const scale = .52 * Math.min(1, (input.viewport.w / Math.max(1, input.viewport.h)) / .85);
    const entryRobot = new Vector3(-1.2, -.8, -3.3).applyQuaternion(new Quaternion().fromArray(overview.quaternion)).add(revealPosition);
    entryRobot.set(0, -1.69 * scale, entryRobot.z);
    const robotPosition = new Vector3(-1.2, -.8, -3.3).applyQuaternion(new Quaternion().fromArray(camera.quaternion)).add(new Vector3(...camera.position));
    if (!reduced && input.local < LAB_INTRO_END) robotPosition.lerp(entryRobot, 1 - arrival);
    robotPosition.lerp(new Vector3(-1.05, -1.69 * scale, 0), reduced ? Number(input.local >= 1) : exit);
    const lights = stations.map((_, index) => {
      if (reduced) return Number(index === current.index);
      if (input.local < LAB_INTRO_END) return index === 0 ? arrival : 0;
      const transition = current.index === 0 ? 1 : smooth(current.local / .2);
      return (index === current.index ? transition : index === current.index - 1 ? 1 - transition : 0) * (1 - exit);
    });
    return { camera, robot: reduced ? { kind: 'pose', name: 'rest' } : input.local < LAB_INTRO_END ? { kind: 'clip', name: 'Fly', timeSeconds: arrival * 1.6, weight: 1 } : station.robot.point ? { kind: 'point', target: station.robot.point } : { kind: 'rest' }, visual: {
      robotPosition: robotPosition.toArray(), robotQuaternion: camera.quaternion,
      robotState: 'guiding', station: current.index + 1, lights,
      stationSnapshot: station, webSnapshot: current.index === 0 ? station : stations[0].sample(1, input),
    } };
  },
  apply(snapshot, context) {
    const lab = context as LabCtx;
    const active = Number(snapshot.visual.station) - 1;
    if (lab.root && 'getObjectByName' in lab.root) {
      const mount = lab.root.getObjectByName(`Station_${active + 1}`);
      const arms = lab.root.getObjectByName('MechanicalArms');
      if (mount && arms && arms.parent !== mount) mount.add(arms);
    }
    if (lab.nodes) {
      applyStation(snapshot.visual.webSnapshot as StationSnapshot, lab.nodes);
      if (snapshot.visual.stationSnapshot && snapshot.visual.station !== 1) {
        applyStation(snapshot.visual.stationSnapshot as StationSnapshot, lab.nodes);
      }
    }
    const amounts = snapshot.visual.lights as number[];
    if (lab.lights) for (let i = 0; i < lab.lights.length; i++) lab.lights[i].intensity = amounts[i] * 20;
    if (lab.materials) for (let i = 0; i < lab.materials.length; i++) {
      const brightness = .35 + .65 * amounts[i];
      const materials = lab.materials[i];
      for (let j = 0; j < materials.length; j++) materials[j].material.color.copy(materials[j].color).multiplyScalar(brightness);
    }
  },
};
