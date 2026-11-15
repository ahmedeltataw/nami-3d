# Robot export conventions

## Blender (source: `robot_rig.blend`, built from `robot_master.blend` by `scripts/rig_export.py`)
- Z up. The robot faces −Y. Robot left (`_L`, `Left*`) is +X.
- 1 unit = 400 px of `reference/ref_front.webp`. The robot is 3.38 units tall.
- The origin is at the torso tip (the lowest point of the body), which is the `Root` node.

## glTF (`robot_proof.glb`)
The exporter runs with `export_yup=True`, so each Blender (x, y, z) becomes glTF (x, z, −y):
- +Y up. The robot faces **+Z**, toward a default three.js camera. Robot left stays +X.
- Node-local axes map the same way: Blender local X → glTF X, Y → −Z, Z → Y. `manifest.json` lists both.
- Units are unchanged. Scale the `Root` node in the app if you need metres.

## Rig
- The rig is a hierarchy of rigid nodes (empties) with no skinning. Each mesh is a child of one joint, and you animate the joint's rotation.
- Joints are world-aligned at rest (rotation = identity). Fingers are the exception: their rest yaw is ±22° about Blender Z. The curl axis is joint-local Y.
- Limits are authored for the `_L` side. On `_R`, rotations about Y and Z are mirrored (sign flipped). Limits are in `manifest.json` and in each joint's `extras.joint_limits_deg`.
- Mesh parent inverses are baked, so a joint's local transform is its true offset from its parent.
- Attachment points are the `LeftHand_Anchor` and `RightHand_Anchor` nodes (children of `Palm_L` and `Palm_R`), at the palm centres.

## Export
- The export contains only the `Robot_Master` collection. Cameras, lights, the reference and `Helpers/Face_Cutter` are left out.
- Modifiers, including the `FaceRecess` boolean, are applied only in the export (`export_apply`). The `.blend` files keep them live. `Face_Cutter` is parented to `Head`, so the recess follows the head.
- Clips run at 30 fps and glTF time starts at frame 0. `Wave` covers frames 0–48 (1.6 s).
