import { HalfFloatType, ShaderMaterial, Vector2, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const blurShader = `
  uniform sampler2D image; uniform vec2 direction; uniform float threshold; uniform float radius; uniform bool extract;
  varying vec2 vUv;
  vec3 sampleBright(vec2 uv){vec3 c=texture2D(image,uv).rgb;return extract?c*smoothstep(threshold-.05,threshold+.05,dot(c,vec3(.2126,.7152,.0722))):c;}
  void main(){vec2 d=direction*(1.+radius*2.);vec3 c=sampleBright(vUv)*.227027;
    c+=(sampleBright(vUv+d*1.384615)+sampleBright(vUv-d*1.384615))*.316216;
    c+=(sampleBright(vUv+d*3.230769)+sampleBright(vUv-d*3.230769))*.070270;
    gl_FragColor=vec4(c,1.);}
`;

/** Two quarter-resolution blur draws and one composite draw, independent of scene complexity. */
export class BloomPass extends Pass {
  threshold = 1;
  strength = .15;
  radius = .5;
  contrast = 1;
  private horizontal = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  private vertical = this.horizontal.clone();
  private blur = new ShaderMaterial({ vertexShader, fragmentShader: blurShader, depthTest: false, depthWrite: false,
    uniforms: { image: { value: null }, direction: { value: new Vector2() }, threshold: { value: 1 }, radius: { value: .5 }, extract: { value: true } } });
  private composite = new ShaderMaterial({ vertexShader, depthTest: false, depthWrite: false,
    uniforms: { image: { value: null }, glow: { value: this.vertical.texture }, strength: { value: .15 }, contrast: { value: 1 } },
    fragmentShader: 'uniform sampler2D image;uniform sampler2D glow;uniform float strength;uniform float contrast;varying vec2 vUv;void main(){vec4 c=texture2D(image,vUv);if(strength>0.)c.rgb+=texture2D(glow,vUv).rgb*strength;if(contrast!=1.)c.rgb=max(vec3(0.),(c.rgb-0.18)*contrast+0.18);gl_FragColor=c;}' });
  private quad = new FullScreenQuad(this.blur);
  setSize(width: number, height: number) {
    this.horizontal.setSize(Math.max(1, Math.ceil(width / 4)), Math.max(1, Math.ceil(height / 4)));
    this.vertical.setSize(this.horizontal.width, this.horizontal.height);
  }
  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    if (this.strength > 0) {
      this.quad.material = this.blur;
      this.blur.uniforms.image.value = read.texture;
      this.blur.uniforms.threshold.value = this.threshold;
      this.blur.uniforms.radius.value = this.radius;
      this.blur.uniforms.extract.value = true;
      this.blur.uniforms.direction.value.set(1 / this.horizontal.width, 0);
      renderer.setRenderTarget(this.horizontal); this.quad.render(renderer);
      this.blur.uniforms.image.value = this.horizontal.texture;
      this.blur.uniforms.extract.value = false;
      this.blur.uniforms.direction.value.set(0, 1 / this.vertical.height);
      renderer.setRenderTarget(this.vertical); this.quad.render(renderer);
    }
    this.quad.material = this.composite;
    this.composite.uniforms.image.value = read.texture;
    this.composite.uniforms.glow.value = this.strength > 0 ? this.vertical.texture : read.texture;
    this.composite.uniforms.strength.value = this.strength;
    this.composite.uniforms.contrast.value = this.contrast;
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer);
  }
  dispose() { this.horizontal.dispose(); this.vertical.dispose(); this.blur.dispose(); this.composite.dispose(); this.quad.dispose(); }
}
