import { Group, LinearToneMapping, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BloomPass } from './BloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { LightingController } from './controller';

export const GLOBAL_TONE_MAPPING = LinearToneMapping;
export class LightingPost {
  readonly composer: EffectComposer;
  readonly bloom = new BloomPass();
  private renderPass: RenderPass;
  private output = new OutputPass();
  private dimensions = '';
  constructor(private renderer: WebGLRenderer, private scene: Scene, private camera: Camera) {
    renderer.toneMapping = GLOBAL_TONE_MAPPING;
    this.composer = new EffectComposer(renderer);
    const samples = renderer.getContext().getContextAttributes()?.antialias ? Math.min(4, renderer.capabilities.maxSamples) : 0;
    this.composer.renderTarget1.samples = 0;
    this.composer.renderTarget2.samples = samples;
    // The geometry pass needs depth testing; post passes only sample color.
    this.composer.renderTarget2.resolveDepthBuffer = false;
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
  }
  compile(roots: readonly Object3D[]) {
    const target = this.renderer.getRenderTarget();
    const face = this.renderer.getActiveCubeFace();
    const mip = this.renderer.getActiveMipmapLevel();
    const materials = new Group();
    // Visit the existing materials without collecting their lights a second time.
    materials.traverse = callback => roots.forEach(root => root.traverse(callback));
    try {
      this.renderer.setRenderTarget(this.composer.renderTarget2);
      this.renderer.compile(materials, this.camera, this.scene);
    } finally {
      this.renderer.setRenderTarget(target, face, mip);
    }
  }
  render(post: LightingController['post'], width: number, height: number, dpr: number) {
    const dimensions = `${width},${height},${dpr}`;
    if (dimensions !== this.dimensions) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(width, height);
      this.dimensions = dimensions;
    }
    this.renderer.toneMappingExposure = post.exposure;
    Object.assign(this.bloom, post.bloom);
    this.bloom.contrast = post.contrast;
    this.bloom.enabled = post.bloom.strength > 0 || post.contrast !== 1;
    // Only the geometry buffer needs MSAA; pass toggles must not swap that role.
    this.composer.readBuffer = this.composer.renderTarget2;
    this.composer.writeBuffer = this.composer.renderTarget1;
    this.composer.render(0);
  }
  dispose() {
    this.bloom.dispose(); this.output.dispose(); this.renderPass.dispose(); this.composer.dispose();
  }
}
