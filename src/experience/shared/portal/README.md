# Portal

`Portal` accepts an imported gate `model` and `assembleProgress`, `ringSpeed`,
`openAmount`, `surfaceTexture`. Pass sampled `time` for deterministic spin,
light pulsing and swirl; `reduced` freezes those effects. No frame delta is
integrated. The camera-facing convention is +Z; clockwise rotation is negative Z.

`bindPortal(model)` exposes the same allocation-free `update(state)` API for
scene-owned application before the host render. S02 uses that path so the robot
composer runs before hand-anchor measurements and the preview renders before
the main scene. Each binding owns its cloned materials and shader; call
`dispose()` when released. Geometry and input textures remain caller-owned.

Segments and connectors use their imported `mid_angle_deg` extras, preserving
their original transforms at full assembly. A render target is supplied by the
caller; the portal never renders or allocates one itself.
