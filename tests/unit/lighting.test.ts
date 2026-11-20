import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Scene, Texture } from 'three';
import { LightingController } from '../../src/experience/lighting/controller';
import { lightingWeights, rigs, type LightingTransition } from '../../src/experience/lighting/rigs';
import { getExcludedLights, resolveExcludedLightIndices } from '../../src/experience/shared/light-exclusion';

function setup(name: string, material = new MeshStandardMaterial()) {
  const scene = new Scene();
  const root = new Group();
  const mesh = new Mesh(undefined, material); mesh.name = name;
  root.add(mesh); scene.add(root);
  const controller = new LightingController(); scene.add(controller.root);
  return { scene, root, mesh, material, controller };
}
describe('scene lighting', () => {
  it('uses supplied jump weights directly and blends post independently of history', () => {
    const { controller, scene } = setup('ordinary');
    const transition: LightingTransition = { id: 's05->s06', owner: 's05', lights: { aWeight: .75, bWeight: .25 } };
    expect(lightingWeights('s01', transition)).toEqual({ s05: .75, s06: .25 });
    controller.update('s05', transition, scene, []);
    expect(controller.entries[4].lights[0].intensity).toBe(rigs.s05.key.intensity * .75);
    expect(controller.entries[5].lights[0].intensity).toBe(rigs.s06.key.intensity * .25);
    expect(controller.post.exposure).toBeCloseTo(rigs.s05.exposure * .75 + rigs.s06.exposure * .25);
    const first = JSON.stringify(controller.post);
    controller.update('s07', null, scene, []);
    controller.update('s05', transition, scene, []);
    expect(JSON.stringify(controller.post)).toBe(first);
    controller.update('s05', transition, scene, []);
    expect(controller.entries[4].lights[0].intensity).toBe(rigs.s05.key.intensity * .75);
    controller.dispose();
  });
  it('excludes only helix key from floor, without patching shared source materials', () => {
    const { controller, scene, root, mesh, material } = setup('S06_floor');
    const other = new Mesh(undefined, material); root.add(other);
    controller.update('s06', null, scene, [root]);
    expect(mesh.material).not.toBe(material);
    expect(other.material).toBe(material);
    const lights = getExcludedLights(mesh.material as MeshStandardMaterial);
    expect(lights.map(light => light.name)).toEqual(['helix_key']);
    expect(resolveExcludedLightIndices(lights, { scene }).point).toEqual([0]);
    controller.dispose();
    expect(mesh.material).toBe(material);
  });
  it('keeps sun off N and robot discs, fill off tree, and restores robot on scene exit', () => {
    const { controller, scene, root, mesh, material } = setup('Right_SideModule');
    const logo = new Mesh(undefined, material); logo.name = 'S07_N'; root.add(logo);
    const tree = new Mesh(undefined, material); tree.name = 'S07_tree_leaves'; root.add(tree);
    controller.update('s07', null, scene, [root]);
    expect(getExcludedLights(mesh.material as MeshStandardMaterial).map(light => light.name)).toEqual(['sun']);
    expect(getExcludedLights(logo.material as MeshStandardMaterial).map(light => light.name)).toEqual(['sun']);
    expect(getExcludedLights(tree.material as MeshStandardMaterial).map(light => light.name)).toEqual(['cool_fill']);
    controller.update('s01', null, scene, [root]);
    expect(mesh.material).toBe(material);
    expect(getExcludedLights(material)).toEqual([]);
    controller.dispose();
  });
  it('converts emissive matte cards to unlit fog-free cards and retains their texture', () => {
    const { controller, scene, root, mesh, material } = setup('S03_backdrop_city');
    const texture = new Texture(); material.emissiveMap = texture; material.emissive.set('#ffffff');
    controller.update('s03', null, scene, [root]);
    const matte = mesh.material as unknown as MeshBasicMaterial;
    expect(matte.isMeshBasicMaterial).toBe(true);
    expect(matte.map).toBe(texture); expect(matte.fog).toBe(false); expect(matte.depthWrite).toBe(material.depthWrite);
    expect(scene.fog).toBe(controller.fog);
    controller.dispose();
    expect(mesh.material).toBe(material);
    expect(material.fog).toBe(true);
  });
  it.each([true, false])('preserves the manifest-adapted matte depthWrite=%s', depthWrite => {
    const scene = new Scene();
    const root = new Group();
    const material = new MeshBasicMaterial({ depthWrite });
    const mesh = new Mesh(undefined, material); mesh.name = 'S04_city'; root.add(mesh); scene.add(root);
    const controller = new LightingController(); scene.add(controller.root);
    controller.update('s04', null, scene, [root]);
    expect((mesh.material as MeshBasicMaterial).depthWrite).toBe(depthWrite);
    controller.dispose();
    expect(mesh.material).toBe(material);
  });
  it('preserves authored shader hooks and releases bindings when residency detaches a kit', () => {
    const { controller, scene, root, mesh, material } = setup('S06_floor');
    material.onBeforeCompile = shader => { shader.fragmentShader = '// authored\n' + shader.fragmentShader; };
    material.customProgramCacheKey = () => 'authored';
    controller.update('s06', null, scene, [root]);
    expect((mesh.material as MeshStandardMaterial).customProgramCacheKey()).toContain('authored');
    root.removeFromParent();
    controller.update('s01', null, scene, []);
    expect(mesh.material).toBe(material);
    expect(material.customProgramCacheKey()).toBe('authored');
    controller.dispose();
  });
  it('reconciles materials only when a participating scene graph changes', () => {
    const { controller, scene, root } = setup('ordinary');
    const traverse = vi.spyOn(root, 'traverse');
    controller.update('s06', null, scene, [root]);
    expect(traverse).toHaveBeenCalledTimes(1);
    const lateMaterial = new MeshStandardMaterial();
    const lateFloorMesh = new Mesh(undefined, lateMaterial); lateFloorMesh.name = 'S06_floor'; root.add(lateFloorMesh);
    controller.update('s06', null, scene, [root]);
    expect(traverse).toHaveBeenCalledTimes(1);
    expect(lateFloorMesh.material).toBe(lateMaterial);
    controller.invalidateMaterials();
    controller.update('s06', null, scene, [root]);
    expect(traverse).toHaveBeenCalledTimes(2);
    expect(lateFloorMesh.material).not.toBe(lateMaterial);
    expect(getExcludedLights(lateFloorMesh.material as MeshStandardMaterial).map(light => light.name)).toEqual(['helix_key']);
    controller.dispose();
    expect(lateFloorMesh.material).toBe(lateMaterial);
  });
});
