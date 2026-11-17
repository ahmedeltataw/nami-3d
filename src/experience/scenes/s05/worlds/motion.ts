import manifest from '../../../../../assets-model/export/worlds.manifest.json';
import type { WorldSlug } from '../projects';
import { ambientAngle } from '../../../ambient';

export type WorldInput = { reducedMotion: boolean; time: number; ambientWeight?: number; screenCount: number };
export type NodeState = { visible: boolean; offset: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number]; screen: { from: number; to: number; mix: number; weight: number } };
export type Motion = { name: string; kind: 'float' | 'sway' | 'pulse' | 'swing' | 'route' | 'pin' | 'travel' | 'screen'; phase?: number; spin?: boolean };
export type WorldDefinition = { motions: readonly Motion[]; animate: (local: number, input: WorldInput) => { nodes: Record<string, NodeState> } };
export const nodeState = (): NodeState => ({ visible: true, offset: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], screen: { from: 0, to: 0, mix: 0, weight: 1 } });

// Shared by the pure sampler and the renderer's preallocated node buffers.
export function writeMotion(out: NodeState, motion: Motion, local: number, input: WorldInput) {
  const t = input.reducedMotion ? 0 : Math.max(0, Math.min(1, Number.isFinite(local) ? local : 0)) * 12 + (Number.isFinite(input.time) ? input.time : 0);
  const phase = motion.phase ?? 0;
  const canonical = Math.max(0, Math.min(1, Number.isFinite(local) ? local : 0)) * 12;
  const weight = input.ambientWeight ?? 1;
  const baseWave = Math.sin(canonical * .8 + phase);
  const ambientWave = Math.sin((canonical + (Number.isFinite(input.time) ? input.time : 0)) * .8 + phase);
  const wave = input.reducedMotion ? 0 : baseWave + (ambientWave - baseWave) * weight;
  out.offset[0] = out.offset[1] = out.offset[2] = 0;
  out.rotation[0] = out.rotation[1] = out.rotation[2] = 0;
  out.scale[0] = out.scale[1] = out.scale[2] = 1;
  switch (motion.kind) {
    case 'float': out.offset[1] = wave * .07; out.rotation[1] = motion.spin ? input.reducedMotion ? 0 : canonical * .45 + ambientAngle(input.time, .45, weight) : wave * .06; break;
    case 'sway': out.rotation[2] = wave * .035; break;
    case 'pulse': out.scale[0] = out.scale[1] = out.scale[2] = 1 + wave * .09; break;
    case 'swing': out.rotation[2] = wave * .12; break;
    case 'route': out.scale[0] = input.reducedMotion ? 1 : .65 + .35 * (.5 + .5 * wave); break;
    case 'pin': out.offset[1] = input.reducedMotion ? 0 : .12 * (.5 + .5 * wave); break;
    case 'travel': out.offset[0] = wave * .18; break;
    case 'screen': {
      const count = Math.max(1, Math.floor(input.screenCount));
      const cycle = t / 4 + phase;
      const step = Math.floor(cycle);
      const blend = Math.max(0, Math.min(1, (cycle - step - .65) / .35));
      out.screen.from = ((step % count) + count) % count;
      out.screen.to = (out.screen.from + 1) % count;
      out.screen.mix = input.reducedMotion ? 0 : blend * blend * (3 - 2 * blend);
      out.screen.weight = input.reducedMotion ? 0 : weight;
      break;
    }
  }
}

export function defineWorld(slug: WorldSlug, signature: Motion[]): WorldDefinition {
  const world = manifest.worlds.find(world => world.slug === slug)!;
  const floating: Motion[] = world.nodes.filter(node => 'float_bob' in node && node.float_bob).map((node, i) => ({ name: node.name, kind: 'float', phase: i * 1.7, spin: 'spin' in node }));
  const motions: Motion[] = [...floating, ...signature, ...world.screen_planes.map((name, phase) => ({ name, kind: 'screen' as const, phase }))];
  return { motions, animate(local, input) {
    const nodes: Record<string, NodeState> = {};
    for (const motion of motions) { const value = nodeState(); writeMotion(value, motion, local, input); nodes[motion.name] = value; }
    return { nodes };
  } };
}
