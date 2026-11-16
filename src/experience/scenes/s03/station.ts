import { Matrix4, Quaternion, Vector3, type Material, type Mesh, type Object3D } from 'three';
import type { AssetKey, CameraPose, SampleInput } from '../../contracts';
import { webStation, webSteps } from './stations/web';
import { mobileStation, mobileSteps } from './stations/mobile';
import { marketingStation, marketingSteps } from './stations/marketing';

export { mobileSteps, marketingSteps };
export type StationId = 1 | 2 | 3 | 4 | 5 | 6;
export type StepDef = { id: string; from: number; to: number };
export type NodeState = { visible: boolean; offset: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number]; emissive?: number; emissiveColor?: [number, number, number] };
export type StationSnapshot = { phase: 'arrival' | 'demo' | 'hold'; step: number; nodes: Record<string, NodeState>; robot: { state: 'guiding'; point: string | null }; camera: CameraPose };
export interface StationDef { id: StationId; slug: string; assetKey: AssetKey; steps: StepDef[]; cameraAnchor: string; robotTarget: string; panel: { titleKey: string; descKey: string; href: string }; sample(local: number, input: SampleInput): StationSnapshot }

export const positions: [number, number, number][] = [[-3.288924,1.7,-.19707],[-2.341957,1.7,-1.601007],[-.846727,1.7,-2.396035],[.846727,1.7,-2.396035],[2.341957,1.7,-1.601007],[3.288924,1.7,-.19707]];
export const targets: [number, number, number][] = [[-8.457233,1.7,-2.078181],[-6.022175,1.7,-5.688303],[-2.177297,1.7,-7.732661],[2.177297,1.7,-7.732661],[6.022175,1.7,-5.688303],[8.457233,1.7,-2.078181]];
export const cameraPoses: CameraPose[] = positions.map((position, i) => {
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(new Vector3(...position), new Vector3(...targets[i]), new Vector3(0, 1, 0)));
  return { position, quaternion: quaternion.toArray().map(value => value || 0) as [number, number, number, number], fov: 45, near: .1, far: 100 };
});
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const slugs = ['technical-consulting', 'cloud-services', 'design-services'];
export const stations: StationDef[] = [
  webStation(cameraPoses[0]),
  mobileStation(cameraPoses[1]),
  marketingStation(cameraPoses[2]),
  ...slugs.map((slug, index): StationDef => {
    const id = (index + 4) as StationId;
    return {
      id, slug, assetKey: `station.${id}`, steps: webSteps, cameraAnchor: `CamAnchor_${id}`, robotTarget: `S${id}_RobotTarget`, panel: { titleKey: `${slug}.title`, descKey: `${slug}.description`, href: `/all-services/${id}` },
      sample(local, input) {
        const progress = input.profile.motion === 'reduced' ? 1 : clamp(local);
        const phase = progress < .2 ? 'arrival' : progress < .8 ? 'demo' : 'hold';
        return { phase, step: Math.min(4, Math.max(0, Math.floor((progress - .2) / .12))), nodes: {}, robot: { state: 'guiding', point: phase === 'arrival' ? null : `S${id}_RobotTarget` }, camera: cameraPoses[id - 1] };
      },
    };
  }),
];

type BoundNode = { node: Object3D; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number]; materials: Material[] };
export function bindStation(root: Object3D): Map<string, BoundNode> {
  const nodes = new Map<string, BoundNode>();
  root.traverse(node => {
    const materials: Material[] = [];
    node.traverse(child => { const mesh = child as Mesh; if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.push(material); });
    nodes.set(node.name, { node, position: node.position.toArray(), rotation: [node.rotation.x,node.rotation.y,node.rotation.z], scale: node.scale.toArray(), materials });
  });
  return nodes;
}
export function applyStation(snapshot: StationSnapshot, nodes: Map<string, BoundNode>) {
  for (const name in snapshot.nodes) {
    const bound = nodes.get(name); if (!bound) continue;
    const value = snapshot.nodes[name];
    bound.node.visible = value.visible;
    bound.node.position.set(bound.position[0] + value.offset[0], bound.position[1] + value.offset[1], bound.position[2] + value.offset[2]);
    bound.node.rotation.set(bound.rotation[0] + value.rotation[0], bound.rotation[1] + value.rotation[1], bound.rotation[2] + value.rotation[2]);
    bound.node.scale.set(bound.scale[0] * value.scale[0], bound.scale[1] * value.scale[1], bound.scale[2] * value.scale[2]);
    if (value.emissive !== undefined || value.emissiveColor) for (const material of bound.materials) if ('emissiveIntensity' in material && 'emissive' in material) {
      const target = material as Material & { emissiveIntensity: number; emissive: import('three').Color };
      if (value.emissive !== undefined) target.emissiveIntensity = value.emissive;
      if (value.emissiveColor) target.emissive.setRGB(value.emissiveColor[0], value.emissiveColor[1], value.emissiveColor[2]);
    }
  }
}
