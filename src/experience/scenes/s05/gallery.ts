import { AmbientLight, CanvasTexture, Color, DirectionalLight, DoubleSide, Frustum, Matrix4, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial, SRGBColorSpace, Vector3, WebGLRenderTarget, type Camera, type Group, type Material, type Mesh, type Object3D, type Texture, type WebGLRenderer } from 'three';
import type { GalleryProject } from './projects';
import { worldAnimations } from './worlds';
import { nodeState, writeMotion, type Motion, type NodeState, type WorldInput } from './worlds/motion';

type Binding = { node: Object3D; motion: Motion; state: NodeState; position: Vector3; rotation: Vector3; scale: Vector3; screen?: ShaderMaterial };
const screenVertex = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const screenFragment = `uniform sampler2D uFrom; uniform sampler2D uTo; uniform sampler2D uCanonical; uniform float uMix; uniform float uAmbientWeight; varying vec2 vUv;
void main() {
  gl_FragColor = mix(texture2D(uCanonical, vUv), mix(texture2D(uFrom, vUv), texture2D(uTo, vUv), uMix), uAmbientWeight);
  #include <colorspace_fragment>
}`;

type Gate = { outer: Object3D; inner: Object3D; surface: Mesh; rotation: [number, number]; material: MeshBasicMaterial };
function required(root: Object3D, name: string): Object3D {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Missing gallery anchor: ${name}`);
  return node;
}
export class Gallery {
  private gates: Gate[] = [];
  private mounts: Object3D[] = [];
  private materials: Material[] = [];
  private textures: Texture[] = [];
  private target: WebGLRenderTarget;
  private worldScene = new Scene();
  private worldCamera = new PerspectiveCamera(45, 1, .1, 50);
  private world: Group | null = null;
  private worldIndex = -1;
  private visual: Record<string, unknown> = {};
  private focused = new Vector3();
  private frustum = new Frustum();
  private matrix = new Matrix4();
  private point = new Vector3();
  private end = new Vector3();
  private still = false;
  private yaw = 0;
  private pitch = 0;
  private disposed = false;
  private reduced = false;
  private bindings: Binding[] = [];
  private worldMaterials: Material[] = [];
  private motionInput: WorldInput = { reducedMotion: false, time: 0, screenCount: 3 };
  private camStart: Object3D | null = null;
  private camEnd: Object3D | null = null;
  readonly shell: Group;

  constructor(private gl: WebGLRenderer, shell: Group, portal: Group, mobile: boolean) {
    this.shell = shell.clone(true);
    this.target = new WebGLRenderTarget(mobile ? 256 : 512, mobile ? 256 : 512, { depthBuffer: true });
    this.target.texture.colorSpace = SRGBColorSpace;
    // glTF UVs use image-space V; a framebuffer texture has the opposite origin.
    this.target.texture.repeat.y = -1;
    this.target.texture.offset.y = 1;
    this.worldScene.background = new Color('#1B1D20');
    this.worldScene.add(new AmbientLight('#ffffff', 2));
    const light = new DirectionalLight('#ffffff', 3);
    light.position.set(3, 5, 4);
    this.worldScene.add(light);
    const shared = new Map<Material, Material>();
    const model = portal.clone(true);
    model.traverse(node => {
      const mesh = node as Mesh;
      if (!mesh.material || mesh.name === 'PortalSurface') return;
      const dim = (material: Material) => {
        let copy = shared.get(material);
        if (!copy) {
          copy = material.clone();
          copy.onBeforeCompile = shader => {
            shader.uniforms.galleryFocus = { value: this.focused };
            shader.vertexShader = 'varying vec3 galleryPosition;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ngalleryPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            shader.fragmentShader = 'uniform vec3 galleryFocus;\nvarying vec3 galleryPosition;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.rgb *= mix(0.16, 1.0, 1.0 - smoothstep(2.6, 3.2, distance(galleryPosition, galleryFocus)));\n#include <dithering_fragment>');
          };
          shared.set(material, copy); this.materials.push(copy);
        }
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(dim) : dim(mesh.material);
    });
    for (let index = 0; index < 6; index++) {
      const mount = required(this.shell, `Gate_${index + 1}`);
      this.mounts.push(mount);
      const instance = model.clone(true);
      mount.add(instance);
      const surface = required(instance, 'PortalSurface') as Mesh;
      const material = new MeshBasicMaterial({ color: '#1B1D20', side: DoubleSide, toneMapped: false });
      surface.material = material;
      this.materials.push(material);
      const outer = required(instance, 'OuterRing');
      const inner = required(instance, 'InnerRing');
      this.gates.push({ outer, inner, surface, material, rotation: [outer.rotation.z, inner.rotation.z] });
    }
  }

  setWorld(index: number, source: Group, project: GalleryProject) {
    this.clearWorld();
    this.worldIndex = index;
    this.world = source.clone(true);
    required(this.world, 'WorldRoot');
    this.camStart = required(this.world, 'CamStart'); this.camEnd = required(this.world, 'CamEnd');
    this.worldScene.add(this.world);
    this.yaw = this.pitch = 0;
    const world = this.world;
    this.motionInput.screenCount = Math.min(3, project.screens.length) || 3;
    for (let i = 0; i < 3; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1B1D20'; ctx.fillRect(0, 0, 640, 400);
      ctx.fillStyle = '#8be7bb'; ctx.fillRect(40, 48, 56, 6);
      ctx.fillStyle = '#ffffff'; ctx.font = '28px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(project.name, 320, 188, 560);
      ctx.fillStyle = '#c5c9cc'; ctx.font = '20px sans-serif';
      ctx.fillText(`Screen ${i + 1}: preview unavailable`, 320, 238);
      const texture = new CanvasTexture(canvas); texture.flipY = false; texture.colorSpace = SRGBColorSpace;
      this.textures.push(texture);
      const url = project.screens[i];
      if (url) {
        // Decode into our owned canvas: late image completion never mutates a retired world.
        const image = new Image();
        image.onload = () => {
          if (this.disposed || this.world !== world) return;
          ctx.fillStyle = '#1B1D20'; ctx.fillRect(0, 0, 640, 400);
          const ratio = Math.min(640 / image.width, 400 / image.height);
          const w = image.width * ratio, h = image.height * ratio;
          ctx.drawImage(image, (640 - w) / 2, (400 - h) / 2, w, h);
          texture.needsUpdate = true; this.still = false;
        };
        image.src = url;
      }
    }
    for (const motion of worldAnimations[project.world].motions) {
      const node = required(world, motion.name);
      const binding: Binding = { node, motion, state: nodeState(), position: node.position.clone(), rotation: new Vector3(node.rotation.x, node.rotation.y, node.rotation.z), scale: node.scale.clone() };
      if (motion.kind === 'screen') {
        const material = new ShaderMaterial({ vertexShader: screenVertex, fragmentShader: screenFragment, side: DoubleSide, toneMapped: false,
          uniforms: { uFrom: { value: this.textures[0] }, uTo: { value: this.textures[0] }, uMix: { value: 0 }, uCanonical: { value: this.textures[0] }, uAmbientWeight: { value: 1 } } });
        this.worldMaterials.push(material); (node as Mesh).material = material; binding.screen = material;
      }
      this.bindings.push(binding);
    }
  }

  clearWorld() {
    if (this.world) {
      this.worldScene.remove(this.world);
    }
    this.worldMaterials.forEach(material => material.dispose()); this.worldMaterials = [];
    this.bindings = []; this.camStart = this.camEnd = null;
    this.textures.forEach(texture => texture.dispose()); this.textures = [];
    this.world = null; this.worldIndex = -1; this.still = false;
  }

  orbit(yaw: number, pitch: number) {
    this.yaw = Math.max(-.45, Math.min(.45, this.yaw + yaw));
    this.pitch = Math.max(-.2, Math.min(.2, this.pitch + pitch));
    this.still = false;
  }

  update(visual: Record<string, unknown>, reduced: boolean) {
    this.visual = visual;
    const index = Number(visual.project);
    this.mounts[index].getWorldPosition(this.focused);
    for (let i = 0; i < this.gates.length; i++) {
      const gate = this.gates[i];
      const open = i === index ? Number(visual.open) : 0;
      gate.outer.rotation.z = gate.rotation[0] - (reduced ? 0 : open * Math.PI / 3);
      gate.inner.rotation.z = gate.rotation[1] + (reduced ? 0 : open * Math.PI / 2);
      const active = visual.activeTarget === i && this.worldIndex === i;
      if (gate.material.userData.active !== active) {
        gate.material.map = active ? this.target.texture : null;
        gate.material.color.set(active ? 0xffffff : 0x1B1D20);
        gate.material.userData.active = active; gate.material.needsUpdate = true;
      }
    }
  }

  render(camera: Camera, reduced: boolean, time = 0, ambientWeight = 1) {
    if (this.reduced !== reduced) { this.reduced = reduced; this.still = false; }
    const index = this.visual.activeTarget;
    if (index === null || index !== this.worldIndex || !this.world || (reduced && this.still)) return;
    camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    if (!this.frustum.intersectsObject(this.gates[Number(index)].surface)) return;
    this.motionInput.reducedMotion = reduced; this.motionInput.time = time; this.motionInput.ambientWeight = ambientWeight;
    const local = Number(this.visual.worldProgress);
    for (let i = 0; i < this.bindings.length; i++) {
      const bound = this.bindings[i], state = bound.state;
      writeMotion(state, bound.motion, local, this.motionInput);
      bound.node.position.set(bound.position.x + state.offset[0], bound.position.y + state.offset[1], bound.position.z + state.offset[2]);
      bound.node.rotation.set(bound.rotation.x + state.rotation[0], bound.rotation.y + state.rotation[1], bound.rotation.z + state.rotation[2]);
      bound.node.scale.set(bound.scale.x * state.scale[0], bound.scale.y * state.scale[1], bound.scale.z * state.scale[2]);
      if (bound.screen) {
        bound.screen.uniforms.uFrom.value = this.textures[state.screen.from];
        bound.screen.uniforms.uTo.value = this.textures[state.screen.to];
        bound.screen.uniforms.uMix.value = state.screen.mix;
        bound.screen.uniforms.uAmbientWeight.value = state.screen.weight;
      }
    }
    this.camStart!.getWorldPosition(this.point); this.camEnd!.getWorldPosition(this.end);
    this.worldCamera.position.copy(this.point.lerp(this.end, Number(this.visual.worldProgress)));
    // Exported anchors have an incorrect camera basis (+Y forward). Use their positions
    // with the manifest's authored look target until the export is corrected.
    const x = this.worldCamera.position.x, z = this.worldCamera.position.z;
    const yaw = reduced ? 0 : this.yaw, pitch = reduced ? 0 : this.pitch;
    this.worldCamera.position.x = x * Math.cos(yaw) + z * Math.sin(yaw);
    this.worldCamera.position.z = z * Math.cos(yaw) - x * Math.sin(yaw);
    this.worldCamera.position.y += pitch * 4;
    this.worldCamera.lookAt(0, .9, 0);
    const previous = this.gl.getRenderTarget();
    const xr = this.gl.xr.enabled;
    try {
      this.gl.xr.enabled = false;
      this.gl.setRenderTarget(this.target); this.gl.clear(); this.gl.render(this.worldScene, this.worldCamera);
      this.still = true;
    } finally { this.gl.setRenderTarget(previous); this.gl.xr.enabled = xr; }
  }

  dispose() { this.disposed = true; this.clearWorld(); this.materials.forEach(material => material.dispose()); this.target.dispose(); }
}
