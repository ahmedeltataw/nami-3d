import { Group, PointLight, type Light, type Material, type Object3D } from 'three';
import type { TransitionIntents } from './contracts';

// Neutral transport objects are ready for the portal/particle meshes in MO-4.
export class TransportChannels {
  readonly portal = new Group();
  readonly light = new PointLight();
  readonly uniforms = { open: { value: 0 }, previewOn: { value: false }, dissolve: { value: 0 }, particleProgress: { value: 0 }, particleOpacity: { value: 0 } };
  constructor() { this.portal.name = 'JumpPortal'; this.portal.add(this.light); }
  apply(intents: TransitionIntents | null) {
    this.portal.position.fromArray(intents?.portal.anchor ?? [0, 0, 0]);
    this.portal.scale.setScalar(intents?.portal.radius ?? 0);
    this.uniforms.open.value = intents?.portal.open ?? 0;
    this.uniforms.previewOn.value = intents?.portal.previewOn ?? false;
    this.uniforms.dissolve.value = intents?.dissolve ?? 0;
    this.uniforms.particleProgress.value = intents?.particles?.progress ?? 0;
    this.uniforms.particleOpacity.value = intents?.particles?.opacity ?? 0;
    this.light.visible = !!intents?.lighting;
    this.light.intensity = intents?.lighting?.intensity ?? 0;
    if (intents?.lighting) this.light.color.setRGB(...intents.lighting.color);
  }
}

export class ScenePresentation {
  private materials = new Map<Material, { opacity: number; transparent: boolean }>();
  private lights = new Map<Light, number>();
  restore() {
    for (const [material, baseline] of this.materials) {
      if (material.transparent !== baseline.transparent) material.needsUpdate = true;
      Object.assign(material, baseline);
    }
    for (const [light, intensity] of this.lights) light.intensity = intensity;
    this.materials.clear(); this.lights.clear();
  }
  apply(root: Object3D, visibility: number, lightWeight: number, covered = false) {
    root.traverse(node => {
      if ('isLight' in node && node.isLight && lightWeight !== 1) {
        const light = node as Light;
        this.lights.set(light, light.intensity); light.intensity *= lightWeight;
      }
      if ('material' in node && visibility < 1 && !covered) {
        const materials = (Array.isArray(node.material) ? node.material : [node.material]) as Material[];
        for (const material of materials) {
          if (this.materials.has(material)) continue;
          this.materials.set(material, { opacity: material.opacity, transparent: material.transparent });
          material.opacity *= visibility;
          if (!material.transparent) { material.transparent = true; material.needsUpdate = true; }
        }
      }
    });
  }
}
