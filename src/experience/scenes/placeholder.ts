import type { SceneDef, SceneId } from '../contracts';
import { clamp } from '../controller';

export function placeholder(id: SceneId, index: number): SceneDef {
  return {
    id,
    assets: [`poster:${id}`],
    poster: `/posters/${id}.svg`,
    sample(input) {
      const local = clamp(input.local);
      return {
        camera: { position: [0, 0, 5.5 - (index + local) * 0.15], quaternion: [0, 0, 0, 1], fov: 50, near: 0.1, far: 100 },
        robot: { kind: 'rest' },
        visual: { rotation: local * Math.PI * 2, scale: 0.8 + local * 0.2, label: id, robotState: id === 's02' ? (local < 0.75 ? 'performing' : 'transitioning') : id === 's03' || id === 's05' ? 'guiding' : id === 's04' ? 'performing' : id === 's07' ? 'interacting' : 'idle' },
      };
    },
    apply(snapshot, ctx) {
      const rotation = typeof snapshot.visual.rotation === 'number' ? snapshot.visual.rotation : 0;
      const scale = typeof snapshot.visual.scale === 'number' ? snapshot.visual.scale : 1;
      ctx.root.rotation.y = ctx.reducedMotion ? 0 : rotation;
      ctx.root.rotation.z = ctx.reducedMotion ? 0 : Math.sin(ctx.ambient) * 0.04;
      ctx.root.scale.setScalar(scale);
    },
  };
}
