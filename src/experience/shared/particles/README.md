# Shared particles

`ParticleField` mounts inside an R3F Canvas. Pass `profile`, `seed`, `active`,
an initial `preset` (id or normalized non-negative mix weights), and optionally
a mutable `state: { progress, time, pointer?, preset? }`. Update state in place
from the scene runtime. Without state, progress is zero and time follows R3F's
clock. Reduced motion always uses time zero; narrative progress still applies.
Fallback returns null, including outside a Canvas. An inactive field is hidden.

Counts are high **20,000**, mid **8,000**, low **2,500**. One `Points` draw uses
seeded buffer attributes and one additive ShaderMaterial. The frame callback
changes uniforms only. It does not allocate or integrate particle state.

The ref exposes `setTargets(Float32Array)`, `setPreset(idOrWeights)`, and
`material` (including its per-instance uniforms). Targets must contain exactly
three finite coordinates per particle and are copied into existing storage.
`sampleMeshSurface(geometry, count, seed)` produces deterministic, area-weighted
local-space targets from indexed or non-indexed triangles. Transform the source
geometry first when world-space sampling is needed.

Register additional `ParticlePreset` objects before mounting. `vertexChunk` is
a GLSL statement body that writes local `vec3 p`; it can read `position`,
`aTarget`, `aPhase`, `aSize`, `aTint`, `uProgress`, `uTime`, `uPointer`, and
`cinematic(float)`. Each preset's result is mixed using normalized `uPreset`
weights. Uniform names must be unique across presets and avoid the core's
reserved names. Number, boolean, Three vector/color/matrix, and non-empty
numeric-array values get GLSL declarations automatically. Uniforms are cloned
per field; edit `ref.current.material.uniforms` for runtime custom inputs.

`targetFn(seed, index)` initializes targets for the initial named preset;
an explicit `targetFn` prop takes precedence. Switching weights preserves
buffers. Use `setTargets` to change the destination. Changing seed, quality or
targetFn rebuilds and disposes resources. Registering presets after mount
requires remounting to compile their chunks.

`particlePosition(index, { seed, progress, time, preset?, pointer?, motion?,
attributes?, targets? })` is the stateless CPU reference for the three built-ins.
Pass the core's attributes for custom initial targets, or `targets` after a
replacement. Custom GLSL presets supply their own reference tests. GPU tests
allow 0.0005 world units for GLSL trigonometric precision; GPU and CPU converge
endpoints are exact.
