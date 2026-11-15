import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WebGLRenderer, Object3D, Mesh, Material, Texture } from 'three';
import { manifest } from './manifest';
import type { AssetLoader, ResidentAsset } from './residency';

function disposeObject(root: Object3D) {
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(object => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture);
    material.dispose();
  }
  textures.forEach(texture => texture.dispose());
}

export function createAssetLoader(renderer: WebGLRenderer) {
  const ktx2 = new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(renderer);
  const gltf = new GLTFLoader().setKTX2Loader(ktx2);
  let meshopt: Promise<void> | undefined;
  const load: AssetLoader = async (key, quality, signal) => {
    const entry = manifest[key];
    const url = entry.url[quality];
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Asset ${key}: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    signal.throwIfAborted();
    let asset: ResidentAsset;
    if (entry.decoder === 'gltf') {
      meshopt ??= (async () => {
        const path = '/decoders/meshopt_decoder.module.js';
        const decoder: typeof import('three/examples/jsm/libs/meshopt_decoder.module.js') = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ path);
        await decoder.MeshoptDecoder.ready;
        gltf.setMeshoptDecoder(decoder.MeshoptDecoder);
      })().catch(error => { meshopt = undefined; throw error; });
      await meshopt;
      const result = await gltf.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
      asset = { value: result, dispose: () => disposeObject(result.scene) };
    } else if (entry.decoder === 'ktx2') {
      const texture = await new Promise<Texture>((resolve, reject) => ktx2.parse(buffer, resolve, reject));
      asset = { value: texture, dispose: () => texture.dispose() };
    } else {
      asset = { value: buffer, dispose() {} };
    }
    if (signal.aborted) { asset.dispose(); signal.throwIfAborted(); }
    return asset;
  };
  return { load, dispose: () => ktx2.dispose() };
}
