import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, Vector2, WebGLRenderTarget, type Object3D, type WebGLRenderer } from 'three';
import { LightingPost } from '../../src/experience/lighting/post';
import { BloomPass } from '../../src/experience/lighting/BloomPass';

function rendererStub(antialias: boolean, maxSamples = 8) {
  let target: WebGLRenderTarget | null = null;
  const renderer = {
    capabilities: { maxSamples },
    getContext: () => ({ getContextAttributes: () => ({ antialias }) }),
    getSize: (size: Vector2) => size.set(640, 360),
    getPixelRatio: () => 1,
    getRenderTarget: () => target,
    getActiveCubeFace: () => 2,
    getActiveMipmapLevel: () => 3,
    setRenderTarget: vi.fn((next: WebGLRenderTarget | null) => { target = next; }),
    compile: vi.fn(),
  };
  return renderer;
}

describe('lighting post render targets', () => {
  it.each([[true, 8, 4], [true, 2, 2], [false, 8, 0], [true, 0, 0]])('preserves antialias=%s within a %s sample limit', (antialias, maximum, samples) => {
    const renderer = rendererStub(antialias, maximum);
    const post = new LightingPost(renderer as unknown as WebGLRenderer, new Scene(), new PerspectiveCamera());
    expect(post.composer.renderTarget1.samples).toBe(0);
    expect(post.composer.renderTarget2.samples).toBe(samples);
    expect(post.composer.renderTarget2.resolveDepthBuffer).toBe(false);
    post.dispose();
  });

  it('warms scene materials in the HDR buffer with each local light collected once', () => {
    const renderer = rendererStub(true);
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const root = new Group();
    const mesh = new Mesh(undefined, new MeshStandardMaterial());
    root.add(mesh, new PointLight());
    scene.add(root);
    const original = new WebGLRenderTarget(1, 1);
    renderer.setRenderTarget(original);
    const post = new LightingPost(renderer as unknown as WebGLRenderer, scene, camera);
    post.composer.swapBuffers();
    renderer.compile.mockImplementation((materials: Object3D, actualCamera: PerspectiveCamera, world: Scene) => {
      expect(renderer.getRenderTarget()).toBe(post.composer.renderTarget2);
      expect(actualCamera).toBe(camera);
      let lights = 0;
      world.traverseVisible(node => { if (node instanceof PointLight) lights++; });
      materials.traverseVisible(node => { if (node instanceof PointLight) lights++; });
      expect(lights).toBe(1);
      const visited: Object3D[] = [];
      materials.traverse(node => { visited.push(node); });
      expect(visited).toContain(mesh);
    });
    post.compile([root]);
    expect(renderer.compile).toHaveBeenCalledOnce();
    expect(renderer.getRenderTarget()).toBe(original);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(original, 2, 3);
    expect(root.parent).toBe(scene);
    post.dispose();
    original.dispose();
  });

  it('restores the previous target when shader compilation fails', () => {
    const renderer = rendererStub(false);
    const post = new LightingPost(renderer as unknown as WebGLRenderer, new Scene(), new PerspectiveCamera());
    renderer.compile.mockImplementation(() => { throw new Error('shader compilation failed'); });
    expect(() => post.compile([])).toThrow('shader compilation failed');
    expect(renderer.getRenderTarget()).toBeNull();
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null, 2, 3);
    post.dispose();
  });

  it('keeps geometry on the antialiased buffer when bloom and contrast are toggled', () => {
    const renderer = rendererStub(true);
    const post = new LightingPost(renderer as unknown as WebGLRenderer, new Scene(), new PerspectiveCamera());
    const render = vi.spyOn(post.composer, 'render').mockImplementation(() => {
      expect(post.composer.readBuffer).toBe(post.composer.renderTarget2);
      expect(post.composer.writeBuffer).toBe(post.composer.renderTarget1);
      post.composer.swapBuffers();
    });
    for (const [strength, contrast, enabled] of [[.12, 1.12, true], [0, 1.12, true], [0, 1, false], [.12, 1, true]] as const) {
      post.render({ exposure: .9, contrast, bloom: { strength, radius: .5, threshold: 1 } }, 640, 360, 1);
      expect(post.bloom.enabled).toBe(enabled);
      expect(post.bloom.contrast).toBe(contrast);
    }
    expect(render).toHaveBeenCalledTimes(4);
    post.dispose();
  });

  it('applies contrast without blur draws or an uninitialized glow when bloom is off', () => {
    const pass = new BloomPass();
    pass.strength = 0; pass.contrast = 1.12;
    const read = new WebGLRenderTarget(4, 4);
    const write = read.clone();
    const render = vi.fn();
    const renderer = { setRenderTarget: vi.fn(), render };
    pass.render(renderer as unknown as WebGLRenderer, write, read);
    expect(render).toHaveBeenCalledOnce();
    const material = render.mock.calls[0][0].material;
    expect(material.uniforms.contrast.value).toBe(1.12);
    expect(material.uniforms.glow.value).toBe(read.texture);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(write);
    pass.dispose(); read.dispose(); write.dispose();
  });
});
