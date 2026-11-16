import { Color, Matrix3, Matrix4, Vector2, Vector3, Vector4 } from 'three';
import type { ParticlePreset } from './presets';

function uniformDeclaration(name: string, value: unknown): string {
  let type: string;
  if (typeof value === 'number') type = 'float';
  else if (typeof value === 'boolean') type = 'bool';
  else if (value instanceof Vector2) type = 'vec2';
  else if (value instanceof Vector3 || value instanceof Color) type = 'vec3';
  else if (value instanceof Vector4) type = 'vec4';
  else if (value instanceof Matrix3) type = 'mat3';
  else if (value instanceof Matrix4) type = 'mat4';
  else if ((Array.isArray(value) || value instanceof Float32Array) && value.length > 0) return `uniform float ${name}[${value.length}];`;
  else throw new TypeError(`Unsupported particle uniform value: ${name}`);
  return `uniform ${type} ${name};`;
}

export function particleVertexShader(presets: readonly ParticlePreset[]): string {
  return `
uniform float uProgress;
uniform float uTime;
uniform float uPreset[${presets.length}];
uniform vec3 uPointer;
uniform float uDpr;
uniform float uOpacity;
attribute vec3 aTarget;
attribute float aPhase;
attribute float aSize;
attribute float aTint;
varying vec3 vTint;
varying float vAlpha;
${presets.flatMap(preset => Object.entries(preset.uniforms).map(([name, uniform]) => uniformDeclaration(name, uniform.value))).join('\n')}

float cinematic(float x) {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  float t = x;
  for (int iteration = 0; iteration < 6; iteration++) {
    t -= (t * (1.95 + t * (-2.85 + 1.9 * t)) - x) / (1.95 + t * (-5.7 + 5.7 * t));
  }
  return t * t * (3.0 - 2.0 * t);
}

vec3 particlePosition() {
  vec3 result = vec3(0.0);
  ${presets.map((preset, index) => `
  if (uPreset[${index}] > 0.0) {
    vec3 p = position;
    ${preset.vertexChunk}
    result += p * uPreset[${index}];
  }`).join('\n')}
  return result + uPointer * uProgress * (1.0 - uProgress) * 0.15;
}

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(particlePosition(), 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = aSize * uDpr * (4.0 / max(0.1, -viewPosition.z));
  vTint = aTint < 0.5 ? vec3(0.0, 0.62, 0.44) : (aTint < 1.5 ? vec3(0.22, 0.78, 0.52) : vec3(0.70, 0.97, 0.84));
  vAlpha = uOpacity * ${presets.some(preset => preset.id === 'dissolve') ? `(1.0 - 0.85 * uProgress * uPreset[${presets.findIndex(preset => preset.id === 'dissolve')}])` : '1.0'};
}
`;
}

export const particleFragmentShader = `
varying vec3 vTint;
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float alpha = (1.0 - smoothstep(0.0, 1.0, radius)) * vAlpha;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(vTint, alpha);
}
`;
