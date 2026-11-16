import { afterEach, describe, expect, it, vi } from 'vitest';
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, type ShaderMaterial, type Scene, type WebGLRenderer } from 'three';
import { Gallery } from '../../src/experience/scenes/s05/gallery';
import manifest from '../../assets-model/export/worlds.manifest.json';
import { worlds } from '../../src/experience/scenes/s05/projects';
import { worldAnimations } from '../../src/experience/scenes/s05/worlds';

function named(name: string) { const node = new Group(); node.name = name; return node; }
function fixtures(mobile = false, worldIndex = 0) {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
  const shell = new Group(), portal = new Group(), world = new Group();
  for (let i = 0; i < 6; i++) {
    const gate = named(`Gate_${i + 1}`); gate.position.set(i * 8, 2, -5); shell.add(gate);
  }
  const surface = new Mesh(new CircleGeometry(1), new MeshBasicMaterial()); surface.name = 'PortalSurface';
  const outer = named('OuterRing'), inner = named('InnerRing');
  outer.add(new Mesh(new CircleGeometry(1), new MeshBasicMaterial()));
  portal.add(surface, outer, inner);
  const root = named('WorldRoot'), start = named('CamStart'), end = named('CamEnd');
  start.position.set(-1, 2, 5); end.position.set(1, 2, 4); root.add(start, end);
  for (let i = 1; i <= 3; i++) { const screen = new Mesh(new CircleGeometry(1), new MeshBasicMaterial()); screen.name = `ScreenPlane_${i}`; root.add(screen); }
  world.add(root);
  for (const entry of manifest.worlds[worldIndex].nodes) if (!world.getObjectByName(entry.name)) root.add(named(entry.name));
  const previous = { previous: true };
  const gl = { getRenderTarget: vi.fn(() => previous), setRenderTarget: vi.fn<(target: unknown) => void>(), clear: vi.fn(), render: vi.fn<(scene: unknown, camera: unknown) => void>(), xr: { enabled: true } };
  const view = new Gallery(gl as unknown as WebGLRenderer, shell, portal, mobile);
  const camera = new PerspectiveCamera(50, 1, .1, 100); camera.position.set(worldIndex * 8, 2, 3); camera.lookAt(worldIndex * 8, 2, -5);
  view.shell.updateMatrixWorld(true);
  const project = { world: worlds[worldIndex].slug, slug: 'test-project', name: 'Test project', category: null, screens: [] };
  view.setWorld(worldIndex, world, project);
  return { view, gl, camera, world, project, previous };
}
afterEach(() => vi.unstubAllGlobals());
describe('single gallery render target', () => {
  it.each([0, 1, 2, 3, 4, 5])('applies world %i sampler to cloned nodes and crossfade uniforms without accumulating transforms', worldIndex => {
    const { view, gl, camera, project, world } = fixtures(false, worldIndex);
    for (const local of [.7, .1, .7]) {
      view.update({ project: worldIndex, activeTarget: worldIndex, open: 1, worldProgress: local }, false);
      view.render(camera, false, 2.4);
      const scene = gl.render.mock.lastCall![0] as Scene;
      const expected = worldAnimations[project.world].animate(local, { reducedMotion: false, time: 2.4, screenCount: 3 });
      for (const name in expected.nodes) {
        const node = scene.getObjectByName(name)!, value = expected.nodes[name];
        expect(node.position.toArray()).toEqual(value.offset.map((offset, axis) => world.getObjectByName(name)!.position.getComponent(axis) + offset));
        expect(node.scale.toArray()).toEqual(value.scale);
        expect([node.rotation.x, node.rotation.y, node.rotation.z]).toEqual(value.rotation);
        if (name.startsWith('ScreenPlane_')) {
          const material = (node as Mesh).material as ShaderMaterial;
          expect(material.uniforms.uMix.value).toBe(value.screen.mix);
          expect(material.uniforms.uFrom.value).toBeDefined(); expect(material.uniforms.uTo.value).toBeDefined();
        }
      }
    }
    // Switching a moving world to reduced motion must apply a fresh still once.
    view.update({ project: worldIndex, activeTarget: worldIndex, open: 1, worldProgress: .5 }, true);
    view.render(camera, true, 100);
    const count = gl.render.mock.calls.length;
    view.render(camera, true, 200);
    expect(gl.render).toHaveBeenCalledTimes(count);
    const scene = gl.render.mock.lastCall![0] as Scene;
    for (const motion of worldAnimations[project.world].motions) {
      const node = scene.getObjectByName(motion.name)!;
      expect(node.position).toEqual(world.getObjectByName(motion.name)!.position);
      expect(node.scale.toArray()).toEqual([1, 1, 1]);
    }
    view.dispose();
  });
  it.each([false, true])('allocates one %s-mobile target, shares gate materials and restores renderer state', mobile => {
    const { view, gl, camera, previous } = fixtures(mobile);
    view.update({ project: 0, activeTarget: 0, open: 1, worldProgress: .5 }, false);
    view.render(camera, false);
    expect(gl.render).toHaveBeenCalledOnce();
    const target = gl.setRenderTarget.mock.calls[0][0] as unknown as { width: number; height: number };
    expect(target.width).toBe(mobile ? 256 : 512); expect(target.height).toBe(target.width);
    expect(gl.setRenderTarget).toHaveBeenLastCalledWith(previous);
    expect(gl.xr.enabled).toBe(true);
    const gate = (index: number) => view.shell.getObjectByName(`Gate_${index}`)!;
    const first = gate(1).getObjectByName('OuterRing')!.children[0] as Mesh;
    const second = gate(2).getObjectByName('OuterRing')!.children[0] as Mesh;
    expect(first.material).toBe(second.material);
    expect((gate(1).getObjectByName('PortalSurface') as Mesh<Mesh['geometry'], MeshBasicMaterial>).material.map).not.toBeNull();
    for (let i = 2; i <= 6; i++) expect((gate(i).getObjectByName('PortalSurface') as Mesh<Mesh['geometry'], MeshBasicMaterial>).material.map).toBeNull();
    view.dispose();
  });
  it('skips inactive and out-of-view targets and renders a reduced still only once', () => {
    const { view, gl, camera, world, project } = fixtures();
    view.update({ project: 0, activeTarget: null, open: 0 }, false); view.render(camera, false);
    expect(gl.render).not.toHaveBeenCalled();
    view.update({ project: 0, activeTarget: 0, open: 1, worldProgress: .5 }, true);
    camera.lookAt(0, 2, 10); view.render(camera, true);
    expect(gl.render).not.toHaveBeenCalled();
    camera.lookAt(0, 2, -5); view.render(camera, true); view.render(camera, true);
    expect(gl.render).toHaveBeenCalledOnce();
    view.setWorld(0, world, project); view.render(camera, true);
    expect(gl.render).toHaveBeenCalledTimes(2);
    view.dispose();
  });
  it('clamps exploration and never changes the main camera', () => {
    const { view, gl, camera } = fixtures();
    view.update({ project: 0, activeTarget: 0, open: 1, worldProgress: .5 }, false);
    const mainPosition = camera.position.clone();
    view.orbit(100, 100); view.render(camera, false);
    const worldCamera = gl.render.mock.calls[0][1] as unknown as PerspectiveCamera;
    const position = worldCamera.position.clone();
    view.orbit(100, 100); view.render(camera, false);
    expect(worldCamera.position).toEqual(position);
    expect(camera.position).toEqual(mainPosition);
    view.dispose();
  });
});
