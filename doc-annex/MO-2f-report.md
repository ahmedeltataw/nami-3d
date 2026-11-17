# MO-2f - S07 fly-in, round 4

**Candidate passes sampled geometry limits; visual and runtime review open.** The camera-only path starts 4 m behind, 2.5 m camera-right and 0.75 m camera-down from the unchanged hero. It is a linear cubic Bezier. This is a shorter fly-in than round 3 and does not have zero endpoint velocity; runtime scroll pacing and settling need review. The S07 blend, GLB, camera and geometry are unchanged.

At all 201 sampled poses, the projected robot mesh is inside the frame and grows monotonically from 365.0 to 448.9 px. Its narrowest projected frame-edge clearance is **1.50 px at the opening**, on the left, so it may look close to clipping and needs visual review. N and ring are inside at all sampled poses; their minimum opening margin is 140.7 px. Sky-card corner coverage is 0.1899 to 0.8088 in card coordinates.

The rock-underside test projects camera-facing triangles whose world-space geometric normals point downward (negative Z), rasterizes their union at 836 x 471, and does not subtract occlusion by other geometry. This conservative projected-mask estimate peaks at **9.75%**, below 15%, across all 201 sampled poses. It is a raster approximation rather than a depth-tested rendered mask; near-plane-crossing downward triangles are checked and cause a failure. The definition measures downward-facing surfaces, not all dark or side-facing rock. Per-pose robot bounds and underside fractions are in `test-results/MO-2f/s07-measurements.json` under `tree_samples`.

The branch and leaves are outside the frame or cross the top-left corner at each sample, and the first ring of the main branch stays outside top or left. Their unoccluded projected triangle-union silhouette at 836 x 471 has no sampled decreases; it is not a depth-tested mask or a proof between samples. The full per-pose areas and bboxes are in the measurements JSON. The tree's transition and the close opening robot margin still require Muse's visual judgment.

## Eight-frame evidence

`test-results/MO-2f/s07-round9-strip.png` is a 4 x 2 sheet of full 1672 x 941 kit-preset frames in `test-results/MO-2f/frames/`. The sheet was opened and its explicit source pixel bounds and five pixel checks per tile verified. Bboxes below are normalized [left, bottom, right, top], bottom-up; underside is the conservative union fraction of the whole frame. Robot margin is the smallest distance to a frame edge.

| Frame | t | Robot height px | Robot margin px | Underside upper bound | Tree mask px | Branch bbox | Leaves bbox |
|---:|---:|---:|---:|---:|---:|---|---|
| 1 | 0.000 | 365.0 | 1.5 | 9.75% | 0 | [-0.216, 0.846, -0.050, 0.996] | [-0.224, 0.830, -0.026, 1.025] |
| 2 | 0.143 | 375.0 | 18.8 | 9.64% | 0 | [-0.204, 0.837, -0.027, 0.998] | [-0.213, 0.821, -0.002, 1.029] |
| 3 | 0.286 | 385.5 | 37.0 | 9.26% | 383 | [-0.191, 0.827, -0.001, 1.001] | [-0.200, 0.810, 0.026, 1.034] |
| 4 | 0.429 | 396.7 | 56.4 | 8.92% | 1431 | [-0.175, 0.815, 0.030, 1.005] | [-0.185, 0.797, 0.057, 1.040] |
| 5 | 0.571 | 408.6 | 76.9 | 8.23% | 2513 | [-0.156, 0.801, 0.066, 1.009] | [-0.166, 0.781, 0.096, 1.047] |
| 6 | 0.714 | 421.2 | 98.7 | 7.19% | 5238 | [-0.134, 0.784, 0.110, 1.013] | [-0.143, 0.763, 0.142, 1.056] |
| 7 | 0.857 | 434.6 | 121.9 | 6.01% | 9833 | [-0.105, 0.763, 0.164, 1.019] | [-0.114, 0.740, 0.198, 1.067] |
| 8 | 1.000 | 448.9 | 146.7 | 4.96% | 17195 | [-0.069, 0.735, 0.231, 1.027] | [-0.077, 0.712, 0.271, 1.081] |

## Reproduction

Set `BLENDER_EXE` or add Blender to PATH. From the worktree root, run the projection and raster checks before the render script, which reads the resulting counts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File assets-model/scripts/mo2a_run_locked.ps1 -Blend assets-model/s07_future_v2.blend -Script assets-model/scripts/mo2f_round4_projection.py -Log test-results/MO-2f/round4-projection.log
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -Path assets-model/scripts/mo2f_tree_area.cs
[TreeArea]::Run((Resolve-Path test-results/MO-2f/round4-tree.bin).Path)
Copy-Item test-results/MO-2f/tree-area.txt test-results/MO-2f/round4-tree-area.txt
[TreeArea]::Run((Resolve-Path test-results/MO-2f/round4-rock.bin).Path)
Copy-Item test-results/MO-2f/tree-area.txt test-results/MO-2f/round4-rock-area.txt
powershell -NoProfile -ExecutionPolicy Bypass -File assets-model/scripts/mo2a_run_locked.ps1 -Blend assets-model/s07_future_v2.blend -Script assets-model/scripts/mo2f_s07_flyin.py -Log test-results/MO-2f/render.log
powershell -NoProfile -ExecutionPolicy Bypass -File assets-model/scripts/mo2f_s07_strip.ps1
```

The tree rasterizer's decrease messages apply to the tree run; a declining underside mask is expected in the rock run. The shared Blender wrapper handles the lock. `mo2f_s07_flyin.py` remains the sole manifest path writer. No commit or push.
