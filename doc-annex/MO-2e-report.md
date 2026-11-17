# MO-2e Report — S03 Demo-Prop Bindings (`s03_demo_bindings.json`)

## 1. Scope & Coordinate Contract

Per Decision R3 ([MO-2c report](file:///D:/website/Nami-3D/briefs/inbox/repo/captures/MO-2c/report.md)) and `MO-PLAN.md` §5.3 / §8, S03 demo roles that have no direct v2 node in [s03_lab_v2.glb](file:///D:/website/Nami-3D/.worktrees/MO-2e/assets-model/export/s03_lab_v2.glb) reuse props from the v1 `station_*.glb` files placed on the six v2 pedestals (`S03_pedestal_{chart,cloud,code,headphones,layers,phone}`).

### Pedestal Transforms: GLB vs Manifest
- [s03_lab_v2.manifest.json](file:///D:/website/Nami-3D/.worktrees/MO-2e/assets-model/export/s03_lab_v2.manifest.json) lists `cards[].position_gltf` (`[px, 0.45, pz]`) and `yaw_deg`, which are the transforms of the **glass panels** (`S03_panel_<id>`), and omits the pedestal transforms.
- In [s03_lab_v2.glb](file:///D:/website/Nami-3D/.worktrees/MO-2e/assets-model/export/s03_lab_v2.glb), every `S03_pedestal_<id>` node has:
  - `translation`: `[px, 0, pz]`
  - `rotation`: identity `[0, 0, 0, 1]`
  - `scale`: `[1, 1.4, 1]` (scaling `parts_lib.py`'s `0.34 m` inner metal disc to `0.4760 m` and the `0.357 m` emerald perimeter ring to `worldTopY = 0.4998 m`)
- All `localTransform` and `fitBox` entries in [s03_demo_bindings.json](file:///D:/website/Nami-3D/.worktrees/MO-2e/assets-model/export/s03_demo_bindings.json) are derived from the **GLB** geometry and expressed in an unscaled `[1, 1, 1]` glTF `+Y up` frame anchored at each pedestal's world XZ center and `worldTopY = 0.4998 m` (`Box3.max.y` of `S03_pedestal_<id>`).
- **Runtime note for MO-10**: Do **not** parent reused props directly as children of `S03_pedestal_<id>` without compensating for the pedestal node's `scale: [1, 1.4, 1]`; instead attach a unit-scale anchor group at `pedestals[name].worldOriginGlb`.
- **Panel clearance**: Each `S03_panel_<id>` stands vertically at the pedestal center (`y = 0.45..4.67 m`) rotated by `yaw_deg`, with front-face 2.5D icons (`S03_ic_*`) and buttons (`S03_ic_btn_*`) extending up to `+0.0835 m` in front of the panel center. All bindings are rotated by the panel's `yaw` and placed on the front half of the pedestal top (`+Z_panel`), centered in `X_panel`, completely clear of the glass panel and icons while staying inside the inner flat top disc (`topDiscRadiusM`) with `>= 0.149 m` margin.

---

## 2. Table of Bindings (11 Roles → 26 Prop Bindings Across 6 Pedestals)

Bindings in [s03_demo_bindings.json](file:///D:/website/Nami-3D/.worktrees/MO-2e/assets-model/export/s03_demo_bindings.json) are **per prop node, not per role**: the **11** MO-2c demo roles without v2 nodes expand to **26** prop-node bindings across the 6 pedestals (9 roles comprise 2–4 distinct source meshes that need individual transforms on the pedestal). Runtime card **MO-10** consumes the flat `bindings[]` list, and a top-level `roles[]` summary block maps each of the 11 MO-2c roles to its `bindingIndices`, `sourceNodes`, and `tris`.

| Pedestal | Demo Role (MO-2c) | Source GLB | Source Node | Position `[x, y, z]` | Euler XYZ `[rx, ry, rz]` | Scale | `fitBox` min `[x, y, z]` | `fitBox` max `[x, y, z]` | Tris |
|---|---|---|---|---|---|---|---|---|---|
| `S03_pedestal_code` | window cards ×N slide in L → R | `station_1_web.glb` | `S1_Window_1` | `[-0.3679, 0.2475, 0.2904]` | `[0, 0.0803, 0]` | `[0.9, 0.9, 0.9]` | `[-0.6948, 0, 0.1192]` | `[-0.0410, 0.4950, 0.4617]` | 238 |
| `S03_pedestal_code` | window cards ×N slide in L → R | `station_1_web.glb` | `S1_Window_2` | `[0.4096, 0.2250, 0.2279]` | `[0, 0.0803, 0]` | `[0.9, 0.9, 0.9]` | `[0.1056, 0, 0.1230]` | `[0.7135, 0.4500, 0.3328]` | 238 |
| `S03_pedestal_phone` | two floating phones slide in and swap/yaw | `station_2_mobile.glb` | `S2_FloatPhone_1` | `[-0.2773, 0.3686, 0.2198]` | `[0, -0.0750, 0]` | `[0.9, 0.9, 0.9]` | `[-0.4547, 0, 0.1126]` | `[-0.0998, 0.7373, 0.3271]` | 138 |
| `S03_pedestal_phone` | two floating phones slide in and swap/yaw | `station_2_mobile.glb` | `S2_FloatPhone_2` | `[0.2413, 0.3686, 0.2588]` | `[0, -0.0750, 0]` | `[0.9, 0.9, 0.9]` | `[0.0679, 0, 0.1319]` | `[0.4146, 0.7373, 0.3857]` | 138 |
| `S03_pedestal_chart` | megaphone pulses | `station_3_marketing.glb` | `S3_Megaphone` | `[-0.1837, 0.0789, 0.1820]` | `[0, -0.1300, 0]` | `[0.72, 0.72, 0.72]` | `[-0.2219, 0, 0.1231]` | `[0.1674, 0.3799, 0.4739]` | 388 |
| `S03_pedestal_chart` | 3 social icons orbit | `station_3_marketing.glb` | `S3_Social_1` | `[-0.3545, 0.5624, 0.2430]` | `[0, -0.1300, 0]` | `[0.72, 0.72, 0.72]` | `[-0.4780, 0.4400, 0.2111]` | `[-0.2310, 0.6848, 0.2750]` | 512 |
| `S03_pedestal_chart` | 3 social icons orbit | `station_3_marketing.glb` | `S3_Social_2` | `[-0.0372, 0.6824, 0.2845]` | `[0, -0.1300, 0]` | `[0.72, 0.72, 0.72]` | `[-0.1607, 0.5600, 0.2526]` | `[0.0863, 0.8048, 0.3165]` | 388 |
| `S03_pedestal_chart` | 3 social icons orbit | `station_3_marketing.glb` | `S3_Social_3` | `[0.2801, 0.5624, 0.3260]` | `[0, -0.1300, 0]` | `[0.72, 0.72, 0.72]` | `[0.1566, 0.4400, 0.2941]` | `[0.4036, 0.6848, 0.3579]` | 464 |
| `S03_pedestal_headphones` | 4 flow nodes pop in (.03 apart) | `station_4_consulting.glb` | `S4_FlowNode_1` | `[-0.1641, 0.0413, 0.3999]` | `[0, 0.1972, 0]` | `[0.55, 0.55, 0.55]` | `[-0.2099, 0, 0.3541]` | `[-0.1182, 0.0825, 0.4457]` | 44 |
| `S03_pedestal_headphones` | 4 flow nodes pop in (.03 apart) | `station_4_consulting.glb` | `S4_FlowNode_2` | `[0.0926, 0.1293, 0.5617]` | `[0, 0.1972, 0]` | `[0.55, 0.55, 0.55]` | `[0.0468, 0.0880, 0.5159]` | `[0.1385, 0.1705, 0.6076]` | 44 |
| `S03_pedestal_headphones` | 4 flow nodes pop in (.03 apart) | `station_4_consulting.glb` | `S4_FlowNode_3` | `[0.3073, 0.0578, 0.3169]` | `[0, 0.1972, 0]` | `[0.55, 0.55, 0.55]` | `[0.2615, 0.0165, 0.2711]` | `[0.3531, 0.0990, 0.3628]` | 44 |
| `S03_pedestal_headphones` | 4 flow nodes pop in (.03 apart) | `station_4_consulting.glb` | `S4_FlowNode_4` | `[0.0646, 0.1843, 0.1411]` | `[0, 0.1972, 0]` | `[0.55, 0.55, 0.55]` | `[0.0188, 0.1430, 0.0952]` | `[0.1105, 0.2255, 0.1869]` | 44 |
| `S03_pedestal_headphones` | 3 arrows grow | `station_4_consulting.glb` | `S4_Arrow_1` | `[-0.0357, 0.0853, 0.4808]` | `[0, 0.1972, 0]` | `[0.55, 0.55, 0.55]` | `[-0.1098, 0.0548, 0.4309]` | `[0.0348, 0.1182, 0.5256]` | 88 |
| `S03_pedestal_headphones` | 3 arrows grow | `station_4_consulting.glb` | `S4_Arrow_2` | `[0.2000, 0.0935, 0.4393]` | `[0, 0.1972, 0]` | `[0.55, 0.55, 0.55]` | `[0.1337, 0.0622, 0.3691]` | `[0.2617, 0.1204, 0.5136]` | 88 |
| `S03_pedestal_headphones` | 3 arrows grow | `station_4_consulting.glb` | `S4_Arrow_3` | `[0.1860, 0.1210, 0.2290]` | `[0, 0.1972, 0]` | `[0.55, 0.55, 0.55]` | `[0.1176, 0.0795, 0.1793]` | `[0.2584, 0.1616, 0.2837]` | 88 |
| `S03_pedestal_cloud` | 2 racks rise | `station_5_cloud.glb` | `S5_Rack_1` | `[-0.2970, 0, 0.2252]` | `[0, -0.1868, 0]` | `[0.6, 0.6, 0.6]` | `[-0.4787, 0, 0.0339]` | `[-0.1153, 0.9090, 0.4196]` | 460 |
| `S03_pedestal_cloud` | 2 racks rise | `station_5_cloud.glb` | `S5_Rack_2` | `[0.1943, 0, 0.3180]` | `[0, -0.1868, 0]` | `[0.6, 0.6, 0.6]` | `[0.0126, 0, 0.1268]` | `[0.3760, 0.9090, 0.5124]` | 460 |
| `S03_pedestal_cloud` | link rings spin (stop at s .80) | `station_5_cloud.glb` | `S5_LinkRing_1` | `[-0.3271, 1.2211, 0.2231]` | `[0, -0.1868, 0]` | `[0.32, 0.32, 0.32]` | `[-0.5590, 1.0000, 0.1297]` | `[-0.0952, 1.4422, 0.3166]` | 768 |
| `S03_pedestal_cloud` | link rings spin (stop at s .80) | `station_5_cloud.glb` | `S5_LinkRing_2` | `[0.2231, 1.2038, 0.3271]` | `[0, -0.1868, 0]` | `[0.32, 0.32, 0.32]` | `[-0.0090, 1.0000, 0.2010]` | `[0.4553, 1.4075, 0.4532]` | 768 |
| `S03_pedestal_layers` | 2 wireframes converge | `station_6_design.glb` | `S6_Wireframe_1` | `[-0.3093, 0.2400, 0.3073]` | `[0, 0.1431, 0]` | `[0.64, 0.64, 0.64]` | `[-0.4797, 0, 0.2503]` | `[-0.1390, 0.4800, 0.3643]` | 184 |
| `S03_pedestal_layers` | 2 wireframes converge | `station_6_design.glb` | `S6_Wireframe_2` | `[0.3835, 0.2400, 0.2074]` | `[0, 0.1431, 0]` | `[0.64, 0.64, 0.64]` | `[0.2327, 0, 0.1057]` | `[0.5343, 0.4800, 0.3091]` | 184 |
| `S03_pedestal_layers` | stylus scribble (circular, amplitude shrinks to 0) | `station_6_design.glb` | `S6_Stylus` | `[0.0395, 0.1638, 0.2567]` | `[0, 0.1431, 0]` | `[0.9, 0.9, 0.9]` | `[-0.0299, 0, 0.1902]` | `[0.1058, 0.3021, 0.3262]` | 78 |
| `S03_pedestal_layers` | 4 swatches converge | `station_6_design.glb` | `S6_Swatch_1` | `[-0.3489, 0.6536, 0.3130]` | `[0, 0.1431, 0]` | `[0.72, 0.72, 0.72]` | `[-0.4433, 0.5600, 0.2875]` | `[-0.2545, 0.7472, 0.3384]` | 380 |
| `S03_pedestal_layers` | 4 swatches converge | `station_6_design.glb` | `S6_Swatch_2` | `[-0.0916, 0.6536, 0.2759]` | `[0, 0.1431, 0]` | `[0.72, 0.72, 0.72]` | `[-0.1860, 0.5600, 0.2504]` | `[0.0028, 0.7472, 0.3013]` | 380 |
| `S03_pedestal_layers` | 4 swatches converge | `station_6_design.glb` | `S6_Swatch_3` | `[0.1658, 0.6536, 0.2388]` | `[0, 0.1431, 0]` | `[0.72, 0.72, 0.72]` | `[0.0714, 0.5600, 0.2133]` | `[0.2601, 0.7472, 0.2643]` | 380 |
| `S03_pedestal_layers` | 4 swatches converge | `station_6_design.glb` | `S6_Swatch_4` | `[0.4231, 0.6536, 0.2017]` | `[0, 0.1431, 0]` | `[0.72, 0.72, 0.72]` | `[0.3287, 0.5600, 0.1763]` | `[0.5175, 0.7472, 0.2272]` | 380 |

*(Note: `S2_FloatPhone_1` and `S2_FloatPhone_2` each include their 18-tri child screen mesh `S2_FloatPhone_{1,2}_Screen`, giving 120 + 18 = 138 tris per phone.)*

---

## 3. Validation Output

Command: `node assets-model/scripts/s03_demo_bindings.mjs`

```text
=== S03 Demo Bindings Validation ===
GLB vs Manifest note: manifest lists panel [x, 0.45, z] & yaw_deg; GLB pedestals sit at [x, 0, z], scale [1, 1.4, 1], identity rotation, topY=0.4998m.

S03_pedestal_chart       | props= 4 | tris=1752 | maxR=0.536m (box=0.551m) / disc=0.778m | margin=0.241m | panelClear=0.045m | xCenter=-0.0000m
S03_pedestal_cloud       | props= 4 | tris=2456 | maxR=0.595m (box=0.642m) / disc=0.971m | margin=0.376m | panelClear=0.048m | xCenter=0.0000m
S03_pedestal_code        | props= 2 | tris= 476 | maxR=0.826m (box=0.834m) / disc=0.975m | margin=0.149m | panelClear=0.044m | xCenter=-0.0209m
S03_pedestal_headphones  | props= 7 | tris= 440 | maxR=0.612m (box=0.623m) / disc=0.855m | margin=0.243m | panelClear=0.026m | xCenter=0.0000m
S03_pedestal_layers      | props= 7 | tris=1966 | maxR=0.555m (box=0.617m) / disc=0.842m | margin=0.287m | panelClear=0.122m | xCenter=-0.0000m
S03_pedestal_phone       | props= 2 | tris= 276 | maxR=0.532m (box=0.566m) / disc=0.795m | margin=0.263m | panelClear=0.066m | xCenter=-0.0000m

=== S03 Triangle Budget (MO-PLAN.md §8) ===
s03_lab_v2.glb base tris       : 97,550
Robot low LOD in S03           : 14,876
Added demo props (all 6)       : 7,366 (11 roles -> 26 prop bindings)
Added demo props (peak station): 2,456 (S03_pedestal_cloud)
Combined (all 6 props loaded)  : 119,792 vs 100,000 target (+19,792) | desktop fallback 120,000 (208 remaining)
Combined (peak single station) : 114,882 vs 100,000 target
MO-2a cut dependency           : plan §8 asks MO-2a for >= 12,426 tris (97,550 + 14,876 = 112,426 -> 100,000); with 7,366 added tris MO-2a must cut >= 19,792 tris (target scene <= 77,758).

PASS (26 prop bindings across 11 roles and 6 pedestals, 7366 added tris)
```

---

## 4. Total Tris vs S03 Budget (`MO-PLAN.md` §8)

| Pedestal / Component | Tris | Notes |
|---|---:|---|
| `S03_pedestal_code` | 476 | `S1_Window_1` (238) + `S1_Window_2` (238) |
| `S03_pedestal_phone` | 276 | `S2_FloatPhone_1` (138) + `S2_FloatPhone_2` (138) |
| `S03_pedestal_chart` | 1,752 | `S3_Megaphone` (388) + `S3_Social_1..3` (512 + 388 + 464) |
| `S03_pedestal_headphones` | 440 | `S4_FlowNode_1..4` (4×44) + `S4_Arrow_1..3` (3×88) |
| `S03_pedestal_cloud` | 2,456 | `S5_Rack_1..2` (2×460) + `S5_LinkRing_1..2` (2×768) |
| `S03_pedestal_layers` | 1,966 | `S6_Wireframe_1..2` (2×184) + `S6_Stylus` (78) + `S6_Swatch_1..4` (4×380) |
| **Total Added Demo Props** | **7,366** | 11 roles → 26 prop bindings across 6 pedestals (peak single station: 2,456 tris) |
| `s03_lab_v2.glb` (current) | 97,550 | Pre-decimation count from GLB & manifest |
| Robot low LOD (S03) | 14,876 | `MO-PLAN.md` §2.4 / §8 |
| **Combined (all props + lab + robot)** | **119,792** | `+19,792` over `100,000` target; fits `120,000` desktop fallback with 208 tris margin |

**MO-2a Cut Dependency**: S03 budget compliance (`<= 100,000` tris) depends directly on card **MO-2a**'s decimation cut on `s03_lab_v2.glb`. `MO-PLAN.md` §8 asked MO-2a for `>= 12,426` tris (`97,550` lab + `14,876` robot low LOD = `112,426` → `100,000`). With the `7,366` added demo-prop tris in MO-2e, `s03_lab_v2.glb` must reach **`<= 77,758` tris** (`100,000 - 14,876 - 7,366`, a **`>= 19,792` tri** cut; any further cut, e.g. `~21–22k`, provides FX and accessory headroom). MO-2a is currently at `79,406` tris and has been asked to reach `<= 77,758`.

---

## 5. Open Questions

1. **5 chart bars vs 3 v2 icon bars (`S03_pedestal_chart`)**: MO-2c classifies `5 bars grow staggered (.15 apart)` as `bound (3 bars) / reuse (5 bars)` (`S03_ic_chart_0..2` on `S03_panel_chart` vs `S3_Bar_1..5` + `S3_ChartBase`). These bindings keep the 3 v2 icon bars as bound (`0` added tris). If Muse requires all 5 physical bars, `S3_Bar_1..5` (+430 tris) and `S3_ChartBase` (+56 tris) must be added to `S03_pedestal_chart` and `S3_Megaphone` shifted/raised.
2. **`phones pop 1.15×` target (`S03_pedestal_phone`)**: `S2_FloatPhone_1` and `S2_FloatPhone_2` are already placed on `S03_pedestal_phone` (`two floating phones slide in and swap/yaw`). At `1.15×` pop scale their outer radius reaches `~0.612 m <= 0.795 m` (`topDiscR`), so they stay inside the pedestal footprint. Confirm whether MO-10 pops these reused 3D phones, `S03_ic_phone_0..1`, or both.
3. **Pedestal top plane (`0.4998 m` rim vs `0.4760 m` inner disc)**: Ground-tier props sit at `worldTopY = 0.4998 m` (`Box3.max.y` of `S03_pedestal_*`). Since all props fit inside `topDiscRadiusM` (the flat `M_Metal_Dark` disc at `y = 0.4760 m`, `2.38 cm` below the emerald rim), confirm if MO-10 should drop ground-tier props by `-0.0238 m` to sit flush on the recessed metal disc or keep `0.4998 m`.
4. **S03 budget compliance depends on MO-2a's cut (`>= 12,426` planned vs `>= 19,792` with added props)**: `MO-PLAN.md` §8 asked card **MO-2a** for a baseline cut of `>= 12,426` tris (`97,550 + 14,876 = 112,426 -> 100,000`). With MO-2e's `7,366` added demo-prop tris across all 6 pedestals, S03 budget compliance requires `s03_lab_v2.glb` to reach **`<= 77,758` tris** (a **`>= 19,792` tri** cut, leaving `0` headroom at the `100,000` cap; FX/accessory headroom requires cutting further, e.g. `~21–22k`), unless MO-10 mounts only the active station's demo props (`peak = 2,456` tris on `cloud`, requiring `>= 14,882` cut) or uses the `120,000` desktop fallback. MO-2a is currently at `79,406` tris and has been asked to reach `<= 77,758`.
5. **`S2_FloatPhone_{1,2}_Screen` emissive animation**: Each cloned `S2_FloatPhone_*` includes its `18`-tri child screen mesh (`included in 138 tris`). Confirm MO-10 drives those child screen materials (blue glow) alongside `S03_ic_phone_2..10`.
6. **`S5_LinkRing_1` & `S5_LinkRing_2` layout (`S03_pedestal_cloud`)**: In `station_5_cloud.glb` both rings share the same origin, which violates AABB non-overlap (`fitBox`). This binding places them side-by-side (`scale 0.32`) above `S5_Rack_1` and `S5_Rack_2`. Confirm whether side-by-side spinning rings are approved or if concentric rings are preferred (relaxing the `fitBox` AABB non-overlap check for that pair).
