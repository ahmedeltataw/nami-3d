import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, createPortal, type RootState } from '@react-three/fiber';
import type { Group, Points, ShaderMaterial } from 'three';
import S02 from '../../../src/experience/scenes/s02';
import type { Ctx, SceneId } from '../../../src/experience/contracts';
import type { Profile } from '../../../src/experience/profile';
import { ParticleField, type ParticleFieldHandle, type ParticleFrame, createParticleCore, sampleMeshSurface } from '../../../src/experience/shared/particles';
import { SphereGeometry } from 'three';
import { compareParticleGPU } from './particles-gpu';

type Options = { active: boolean; profile: Profile; seed: number };
const options: Options = { active: true, profile: { quality: 'high', motion: 'full', renderer: 'webgl' }, seed: 42 };
const frame: ParticleFrame = { progress: 0.45, time: 3, preset: 'converge', pointer: [0.2, -0.1, 0] };
let field: ParticleFieldHandle | null = null;
let canvasState: RootState | null = null;
let sceneRoot: Group | null = null;
let geometryDisposals = 0, materialDisposals = 0;

function Harness() {
  const [group, setGroup] = useState<Group | null>(null);
  const register = useCallback((_id: SceneId, ctx: Ctx | null) => {
    if (!ctx) return;
    ctx.root.visible = true;
    // Hide the placeholder box and label so the pixel assertion measures only particles.
    for (const child of ctx.root.children) child.visible = false;
    sceneRoot = ctx.root;
    setGroup(ctx.root);
  }, []);
  return <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={2} gl={{ preserveDrawingBuffer: true, antialias: false }}
    onCreated={state => { canvasState = state; state.gl.setClearColor('#101b18'); }}>
    <S02 register={register} />
    {group && createPortal(<ParticleField {...options} state={frame} ref={value => { field = value; }} />, group)}
  </Canvas>;
}

const root = createRoot(document.getElementById('root')!);
function render() { root.render(<StrictMode><Harness /></StrictMode>); }
function points() { return sceneRoot?.getObjectByName('ParticleField') as Points | undefined; }

const api = {
  frame,
  configure(next: Partial<Options>) { Object.assign(options, next); render(); },
  metrics() {
    const object = points();
    const material = object?.material as ShaderMaterial | undefined;
    return {
      count: object?.geometry.getAttribute('position').count ?? 0,
      visible: object?.visible ?? false, rendered: canvasState?.gl.info.render.points ?? 0,
      time: material?.uniforms.uTime.value ?? null, progress: material?.uniforms.uProgress.value ?? null,
      dpr: material?.uniforms.uDpr.value ?? null,
      geometryDisposals, materialDisposals,
    };
  },
  watchDisposal() {
    const object = points()!;
    object.geometry.addEventListener('dispose', () => { geometryDisposals++; });
    (object.material as ShaderMaterial).addEventListener('dispose', () => { materialDisposals++; });
  },
  replaceTargets() {
    const geometry = new SphereGeometry(1, 32, 16);
    field!.setTargets(sampleMeshSurface(geometry, points()!.geometry.getAttribute('position').count, 19));
    geometry.dispose();
  },
  gpuErrors() {
    const core = createParticleCore({ quality: 'low', seed: 42 });
    const errors: number[] = [];
    for (const preset of ['ambient', 'converge', 'dissolve', { ambient: 1, converge: 2, dissolve: 1 }]) {
      for (const progress of [0, 0.25, 0.5, 1]) {
        const state = { ...frame, preset, progress };
        core.update(state, 2, false);
        errors.push(compareParticleGPU(core, state, 42, false));
      }
    }
    core.update({ ...frame, preset: 'dissolve' }, 2, true);
    errors.push(compareParticleGPU(core, { ...frame, preset: 'dissolve' }, 42, true));
    core.dispose();
    return errors;
  },
  pixels() {
    const gl = canvasState!.gl.getContext();
    const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let bright = 0;
    for (let index = 0; index < data.length; index += 4) if (data[index + 1] > 80) bright++;
    return bright;
  },
  fallbackOutsideCanvas() {
    root.render(<ParticleField profile={{ quality: 'low', motion: 'full', renderer: 'fallback' }} />);
  },
  unmount() { root.unmount(); },
};

declare global { interface Window { particlesHarness: typeof api } }
window.particlesHarness = api;
render();
