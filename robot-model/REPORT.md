# Robot master model: build report

**File:** `robot_master.blend` (Blender 5.3, EEVEE). The front camera is active.
**Scale:** 1 unit = 400 px of `reference/ref_front.webp`. The torso tip is at the origin. The robot is 3.38 units tall and faces −Y.
**Robot's left/right:** `Left_*` and `*_L_*` are on +X, which is screen-right in the front view.

## Rebuild
```python
import sys; sys.path.insert(0, r"<this folder>\scripts")
import build_robot as B, robot_materials as RM, scene_setup as S
B.reload(); B.build_all(); RM.assign_all(); S.setup()
```
- `robot_lib.py`: generic geometry helpers. These are superellipsoid and lathe meshes, surface-conforming prisms and ribbons, outline offsets and finger chains.
- `build_robot.py`: proportions as named constants, plus one idempotent `build_*` function per component.
- `robot_materials.py`: the PBR materials and their assignment by object name.
- `scene_setup.py`: validation cameras, lights, renders and the reference overlay. None of it is part of the robot.

## Hierarchy
Every part is parented to `Robot_ROOT`, inside the `Robot_Master` collection with these sub-collections:
- **Head:** OuterShell, Face_Display, Face_Bezel, Top_CircuitPanel and Top_CircuitTraces, Left_SideModule and Right_SideModule
- **Eyes:** Eye_Left, Eye_Right, Eye_CircuitDetails
- **Torso:** Body_MainShell (the core visible in the seam), Chest_UpperArmor, Body_LowerShell, Neck_Joint
- **Chest_Emblem:** OuterHousing, GreenInsert, WhiteSymbol
- **Left_Arm / Right_Arm:** Shoulder, Upper, Wrist, Palm, Finger_1 to Finger_4, Thumb

The `Helpers/Face_Cutter` object drives the non-destructive boolean that makes the display recess. It is hidden and not rendered.
All 35 meshes are manifold after modifiers. The model is about 162k evaluated faces with subdivision at render level, and no modifier is applied.

## Validation
- `renders/validation_front_overlay.png`: the model's silhouette in red over the reference, from an orthographic camera framed to the same pixels.
- `renders/validation_front_side_by_side.png`: the reference and the render side by side.
- `renders/front.png`, `three_quarter.png`, `side.png`, `back.png`, and the close-ups `closeup_face.png`, `closeup_emblem.png`, `closeup_hand.png`.

## Inferred or hidden geometry (not reconstructions)
- **Back and sides:** the backs of the head, torso and arms are not visible in the references. Their depths are inferred from the three-quarter image: head depth is 0.88× its width, torso depth 0.86×, arm depth 0.80×.
- **Chest seam:** the seam runs around the back at a constant height. That part of it is inferred.
- **Top panel:** the panel runs over the crown to about 112° from the front. Its back end and the trace layout behind the crown are inferred.
- **Side modules:** each is a regular octagon prism with a chamfered outer face. Its depth comes from the three-quarter reference.
- **Hands:** the finger count (4 plus a thumb), the joint layout and the hinge are a plausible mechanism that matches the visible silhouette. The reference does not resolve individual fingers.
- **Neck_Joint:** a dark connector between the head and the torso. It does not appear in the reference and was added so the head is structurally attached. It is barely visible from the side.

## Measured against the front reference (ortho render, same pixels)
- **Eyes:** the crescent outline was measured column by column from the reference. Width, top, tips and bottom all land within 2–4 px. Mean eye colour is sRGB (0.30, 0.73, 0.56) against the reference's (0.28, 0.72, 0.55). The traces and ring nodes were traced from a 4x crop.
- **Display:** the opening's lower half is taller than its upper half (az 0.42 up, 0.47 down), matching the reference's top at px 518 and bottom at px 878. The charcoal wall is about 32 px tall at the top and about 4 px at the sides and bottom, as in the reference. The glass brightens toward the chin like the reference (luminance 0.10 at the top to 0.14 at the bottom, against 0.08 to 0.15).
- **Emblem:** the green insert spans px 782–1050 by 1241–1481, matching the reference. The symbol's centreline (peak, valley and both ends running into the border) was measured from the reference, with rounded outer corners. The symbol uses the same white as the housing.
- **Chest seam:** the notch flanks were measured; the model is within 0–15 px of the reference along the seam.
- **Silhouette:** see `validation_front_overlay.png`.

## Known differences from the reference
- The top-panel traces are traced from the reference, but small traces are simplified.
- The reference's emblem strokes and border look like rounded tubes. The model's are flat with a bevel.
- The reference's chest seam is a soft overlap step. The model's is a narrow groove.
- The hands match the silhouette. Individual fingers are inferred, because the reference doesn't resolve them.
- In the three-quarter view, the matched camera is an estimate. The reference's lens and angle are unknown, so the side module and the face turn differ slightly.
- The colours depend on the light. The reference's lighting is unknown, so colours were matched by measured pixel averages under the validation lights.
