import type { ParticleCore } from '../../../src/experience/shared/particles/core';
import { particlePosition, type ParticleFrame } from '../../../src/experience/shared/particles/motion';

/** Transform feedback executes the actual material's position function independently of rasterization. */
export function compareParticleGPU(core: ParticleCore, frame: ParticleFrame, seed: number, reduced: boolean): number {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is required for the shader reference test');
  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)!;
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(shader) ?? 'Shader compilation failed');
    return shader;
  }
  const positionSource = core.material.vertexShader.split('void main()')[0]
    .replace(/attribute /g, 'in ').replace(/varying /g, 'out ');
  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
precision highp float;
in vec3 position;
${positionSource}
out vec3 capturedPosition;
void main() { capturedPosition = particlePosition(); gl_Position = vec4(capturedPosition, 1.0); }
`);
  const fragment = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 color; void main() { color = vec4(1.0); }');
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.transformFeedbackVaryings(program, ['capturedPosition'], gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader linking failed');
  gl.useProgram(program);
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  const count = 32;
  for (const [name, attribute] of Object.entries(core.geometry.attributes)) {
    const location = gl.getAttribLocation(program, name);
    if (location < 0) continue;
    const buffer = gl.createBuffer()!;
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attribute.array, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, attribute.itemSize, gl.FLOAT, false, 0, 0);
  }
  gl.uniform1f(gl.getUniformLocation(program, 'uProgress'), core.material.uniforms.uProgress.value);
  gl.uniform1f(gl.getUniformLocation(program, 'uTime'), core.material.uniforms.uTime.value);
  gl.uniform1fv(gl.getUniformLocation(program, 'uPreset'), core.material.uniforms.uPreset.value);
  const pointer = core.material.uniforms.uPointer.value;
  gl.uniform3f(gl.getUniformLocation(program, 'uPointer'), pointer.x, pointer.y, pointer.z);
  const feedback = gl.createTransformFeedback()!;
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
  const output = gl.createBuffer()!;
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
  gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, count * 3 * 4, gl.STREAM_READ);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, count);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  const actual = new Float32Array(count * 3);
  gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, actual);
  const error = gl.getError();
  if (error !== gl.NO_ERROR) throw new Error(`Transform feedback WebGL error: ${error}`);
  let maximumError = 0;
  for (let i = 0; i < count; i++) {
    const expected = particlePosition(i, { ...frame, seed, attributes: core.attributes, motion: reduced ? 'reduced' : 'full' });
    for (let axis = 0; axis < 3; axis++) maximumError = Math.max(maximumError, Math.abs(actual[i * 3 + axis] - expected[axis]));
  }
  for (const buffer of buffers) gl.deleteBuffer(buffer);
  gl.deleteBuffer(output);
  gl.deleteVertexArray(vao);
  gl.deleteTransformFeedback(feedback);
  gl.deleteProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return maximumError;
}
