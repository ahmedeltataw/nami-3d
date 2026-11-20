// Isolated v2 look-development harness: never changes production asset loading or robot placement.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, dirname, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import ts from 'typescript';
import { systemChromeChannel } from './gpu-browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRelative = 'captures/MO-3';
const output = join(root, outputRelative);
const inbox = join(output, 'references');
const references = ['S01-BL/pass2/render.png', 'S02-BL/pass2/render.png', 'S03-BL/pass4/s03_v2_hero.png', 'S04-BL/fix4/render.png', 'S05-BL/pass2/render.png', 'S06-BL/pass3/render.png', 'S07-BL/pass2/render.png'];
const kits = ['s01_hero', 's02_portal', 's03_lab', 's04_idea', 's05_multiverse', 's06_dna', 's07_future'];
const missing = references.filter(reference => !existsSync(join(inbox, reference)));
if (missing.length) throw new Error('Missing approved reference PNGs under ' + inbox + ': ' + missing.join(', ') + '. Copy the seven approved renders there before running the capture.');
const inputs = await Promise.all(kits.map(async (kit, i) => {
  const paths = [`assets-model/export/${kit}_v2.glb`, `assets-model/export/${kit}_v2.manifest.json`, `${outputRelative}/references/${references[i]}`];
  return { scene: `s0${i + 1}`, files: await Promise.all(paths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') }))) };
}));
const html = `<!doctype html><html><head><style>body{margin:0;background:#182b2d}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/":"/node_modules/three/"}}</script></head><body><script type="module">
import * as THREE from 'three';
import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {LightingController} from '/src/experience/lighting/controller';
import {LightingPost} from '/src/experience/lighting/post';
import {applyV2RuntimeMaterials} from '/src/experience/assets/v2Materials';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(960,540);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.info.autoReset=false;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#142c2a');
const camera=new THREE.PerspectiveCamera(40,960/540,.1,3000);
const lighting=new LightingController();scene.add(lighting.root);
const post=new LightingPost(renderer,scene,camera);
let kit,robot,id,fixtureMode=false,fixtureBefore;
const ownedMaterials=[],ownedGeometries=[];
const loader=new GLTFLoader();
window.load=async (next,file)=>{
  fixtureMode=false;
  if(kit)scene.remove(kit);if(robot)scene.remove(robot);
  lighting.update(next,null,scene,[]);
  ownedMaterials.splice(0).forEach(material=>material.dispose());
  ownedGeometries.splice(0).forEach(geometry=>geometry.dispose());
  const manifest=await fetch('/assets-model/export/'+file+'_v2.manifest.json').then(r=>r.json());
  kit=(await loader.loadAsync('/assets-model/export/'+file+'_v2.glb')).scene;scene.add(kit);id=next;
  applyV2RuntimeMaterials(kit,next,ownedMaterials,ownedGeometries);
  const cam=manifest.camera_hero;camera.position.fromArray(cam.position_gltf);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(...cam.look_dir_gltf)));camera.fov=cam.vertical_fov_deg;camera.far=cam.clip?.[1]??3000;camera.updateProjectionMatrix();
  robot=(await loader.loadAsync('/public/models/robot/'+(next==='s03'?'robot_low.glb':'robot_high.glb'))).scene;scene.add(robot);
  if(manifest.robot?.root_gltf)robot.position.fromArray(manifest.robot.root_gltf);
  robot.rotation.y=(manifest.robot?.yaw_deg??0)*Math.PI/180;
  window.render('standard',true);
};
window.render=(tone='standard',exclusions=true)=>{
  lighting.update(id,null,scene,[kit,robot],exclusions);
  if(fixtureMode){lighting.post.bloom.strength=0;lighting.post.contrast=1;lighting.post.exposure=.8;}
  renderer.toneMapping={standard:THREE.LinearToneMapping,agx:THREE.AgXToneMapping,aces:THREE.ACESFilmicToneMapping}[tone];
  renderer.info.reset();post.render(lighting.post,960,540,1);
  return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,programs:renderer.info.programs.length,textureCount:renderer.info.memory.textures};
};
window.fixture=()=>{
  fixtureMode=true;
  scene.remove(kit);scene.remove(robot);kit=new THREE.Group();robot=new THREE.Group();scene.add(kit,robot);
  const names=id==='s06'?['S06_floor','control']:['S07_N','Right_SideModule','S07_tree_leaves','control'];
  names.forEach((name,i)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(.7,32,24),new THREE.MeshStandardMaterial({color:'#899a8d',roughness:.6}));mesh.name=name;mesh.position.set((i-(names.length-1)/2)*2,1,0);kit.add(mesh);});
  if(id==='s07')camera.position.set(4,9,4);else camera.position.set(0,3,9);
  camera.lookAt(0,1,0);camera.fov=40;camera.updateProjectionMatrix();
};
window.fixtureMeasure=(before)=>{
  const pixels=new Uint8Array(960*540*4),gl=renderer.getContext();gl.readPixels(0,0,960,540,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  if(before){fixtureBefore=pixels;return null;}
  return kit.children.map(mesh=>{
    const center=mesh.position.clone().project(camera),x=Math.round((center.x+1)*480),y=Math.round((center.y+1)*270);
    let changed=0,total=0;
    for(let yy=y-12;yy<y+12;yy++)for(let xx=x-12;xx<x+12;xx++){
      const index=(yy*960+xx)*4;let difference=0;
      for(let c=0;c<3;c++)difference+=Math.abs(pixels[index+c]-fixtureBefore[index+c]);
      if(difference)changed++;total+=difference;
    }
    return {name:mesh.name,changedPixels:changed,meanChannelDelta:total/(24*24*3)};
  });
};
window.ready=true;
</script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (url === '/favicon.ico') { res.statusCode = 204; res.end(); return; }
    if (url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    let path = url.startsWith('/reference/') ? join(inbox, references[Number(url.split('/').pop())]) : resolve(root, '.' + url);
    const relativePath = relative(root, path);
    if (relativePath === '..' || relativePath.startsWith('..' + sep) || isAbsolute(relativePath)) throw new Error('Outside capture roots');
    if (!extname(path)) path += existsSync(path + '.ts') ? '.ts' : '/index.ts';
    let data = await readFile(path);
    if (path.endsWith('.ts')) data = ts.transpileModule(data.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    res.setHeader('Content-Type', path.endsWith('.ts') || path.endsWith('.js') ? 'text/javascript' : path.endsWith('.png') ? 'image/png' : path.endsWith('.json') ? 'application/json' : 'application/octet-stream');
    res.end(data);
  } catch (error) { res.statusCode = 404; res.end(String(error)); }
});
await mkdir(join(output, 'tonemap'), { recursive: true });
await mkdir(join(output, 'selective'), { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: systemChromeChannel(), args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });page.on('console', message => { if(message.type()==='error') { errors.push(message.text()); console.error(message.text()); } });
  page.on('response', response => { if(response.status()>=400)console.error(response.status(),response.url()); });
  const base = 'http://127.0.0.1:' + server.address().port;
  await page.goto(base);await page.waitForFunction(() => window.ready);
  const results = [];
  const selective = [];
  for (const [i, file] of kits.entries()) {
    const id = 's0' + (i + 1);
    await page.evaluate(({id,file})=>window.load(id,file),{id,file});
    const images = [];
    for(const tone of ['standard','agx','aces']) {
      const stats=await page.evaluate(tone=>window.render(tone,true),tone);
      const path=join(output,'tonemap',id+'-'+tone+'.png');await page.screenshot({path});images.push('data:image/png;base64,'+(await readFile(path)).toString('base64'));
      results.push({scene:id,tone,...stats});
    }
    await page.evaluate(()=>window.render('standard',true));
    if(!(await page.screenshot()).equals(await readFile(join(output,'tonemap',id+'-standard.png'))))throw new Error(id+' frozen render was not byte-identical');
    const sheet=await browser.newPage({viewport:{width:1920,height:1120}});
    const reference='data:image/png;base64,'+(await readFile(join(inbox,references[i]))).toString('base64');
    await sheet.setContent('<body style="margin:0;background:#111;color:white;font:18px sans-serif;display:grid;grid-template-columns:1fr 1fr">'+[reference,...images].map((src,j)=>'<div><div>'+['Approved Blender','Standard-like (linear)','AgX','ACES'][j]+'</div><img width="960" height="540" src="'+src+'"></div>').join(''));
    await sheet.screenshot({path:join(output,'tonemap',id+'-comparison.png')});await sheet.close();
    if(i>=5) {
      for(const excluded of [false,true]) {
        await page.evaluate(excluded=>window.render('standard',excluded),excluded);
        await page.screenshot({path:join(output,'selective',id+(excluded?'-after':'-before')+'.png')});
      }
      await page.evaluate(()=>window.fixture());
      for(const excluded of [false,true]) {
        await page.evaluate(excluded=>window.render('standard',excluded),excluded);
        await page.screenshot({path:join(output,'selective',id+'-fixture'+(excluded?'-after':'-before')+'.png')});
        const delta=await page.evaluate(before=>window.fixtureMeasure(before),!excluded);
        if(delta){
          selective.push({scene:id,delta});
          for(const roi of delta)if(roi.name==='control'?roi.changedPixels!==0:roi.changedPixels===0)throw new Error(id+' unexpected selective result '+JSON.stringify(roi));
        }
      }
    }
  }
  await writeFile(join(output,'capture-results.json'),JSON.stringify({renderer:'SwiftShader',size:[960,540],materials:'MO-2 applyV2RuntimeMaterials from production',determinism:'all seven standard PNGs byte-identical after AgX/ACES round trip',robot:'rest pose, manifest root/yaw, low LOD in S03; hero pose belongs to MO-5',references,inputs,results,selective,errors},null,2));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Captured seven tone-map comparisons and S06/S07 selective-lighting pairs in '+output);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
