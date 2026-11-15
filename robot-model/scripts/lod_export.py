"""M1-04b/c: LODs, baked materials, clip batch A, GLB export.

Idempotent: reopens robot_rig.blend (never saved over), sets LOD modifiers (non-destructive),
bakes the procedural materials to textures, builds Idle/Sleep/WakeUp, tidies Wave,
saves robot_rig2.blend and writes export/robot_high.glb, robot_low.glb, manifest.json.

Usage inside Blender:
    import sys; sys.path.insert(0, r"<this folder>")
    import lod_export as L; L.main()
"""
import json
import math
import os

import bpy
from mathutils import Vector

import rig_export as R

HERE = R.HERE
RIG = os.path.join(HERE, "robot_rig.blend")
RIG2 = os.path.join(HERE, "robot_rig2.blend")
TEX = os.path.join(HERE, "export", "textures")
EXP = R.EXP
FPS = R.FPS
D = math.radians

# Per-LOD: subsurf level, max bevel segments, default collapse ratio, planar angle (deg).
LODS = {
    "high": {"subsurf": 0, "bevel": 1, "ratio": 0.35, "angle": 3},
    "low": {"subsurf": 0, "bevel": 1, "ratio": 0.13, "angle": 8},
}
MIN_TRIS = 300
# Near-flat parts: planar dissolve keeps their outlines exact (collapse smeared the emblem shading).
PLANAR = {"Emblem_GreenInsert", "Emblem_OuterHousing", "Emblem_WhiteSymbol", "Top_CircuitPanel",
          "Face_Bezel", "Eye_Left", "Eye_Right"}
# Smooth shells: un-subdivide the base cage (before solidify/subsurf) keeps clean quad flow;
# collapse on these left lumpy shading and filled the chest seam. {name: {lod: iterations}}
UNSUB = {"Chest_UpperArmor": {"high": 1, "low": 2}, "Body_LowerShell": {"high": 1, "low": 2},
         "Body_MainShell": {"high": 2, "low": 3},
         "Arm_L_Upper": {"high": 1, "low": 2}, "Arm_R_Upper": {"high": 1, "low": 2},
         "Arm_L_Shoulder": {"high": 1, "low": 2}, "Arm_R_Shoulder": {"high": 1, "low": 2}}
# Per-mesh overrides {name: {lod: value}}: collapse ratio (1.0 = keep), applied after UNSUB.
# Tuned from close-ups. Chest/lower at UNSUB 3 let the seam core poke through, so low adds collapse.
RATIO = {n: {"high": 1.0, "low": 1.0} for n in UNSUB}
RATIO.update({
    "Chest_UpperArmor": {"high": 1.0, "low": 0.6},
    "Body_LowerShell": {"high": 1.0, "low": 0.6},
    "Arm_L_Upper": {"high": 1.0, "low": 0.75},
    "Arm_R_Upper": {"high": 1.0, "low": 0.75},
    "Head_OuterShell": {"high": 0.55, "low": 0.18},   # un-subdivide here broke the display recess rim
    "Top_CircuitTraces": {"high": 0.22, "low": 0.1},
    "Face_Display": {"high": 0.25, "low": 0.12},
    **{f"Hand_{t}_{f}": {"high": 0.2, "low": 0.07}
       for t in "LR" for f in ("Finger_1", "Finger_2", "Finger_3", "Finger_4", "Thumb")},
})
BEVEL = {"Left_SideModule": {"high": 6, "low": 3}, "Right_SideModule": {"high": 6, "low": 3}}


def meshes():
    return sorted((o for o in bpy.data.collections["Robot_Master"].all_objects if o.type == 'MESH'
                   and o.name != "Face_Cutter"), key=lambda o: o.name)


def eval_tris(objs=None):
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for o in objs or meshes():
        e = o.evaluated_get(dg)
        m = e.to_mesh()
        m.calc_loop_triangles()
        out[o.name] = len(m.loop_triangles)
        e.to_mesh_clear()
    return out


def set_lod(name):
    """Configure modifiers for one LOD. Decimate goes after bevel/boolean, before weighted normals."""
    cfg = LODS[name]
    for o in meshes():
        for md in list(o.modifiers):
            if md.type == 'DECIMATE' and md.name.startswith("LOD_"):
                o.modifiers.remove(md)
        for md in o.modifiers:
            if md.type == 'SUBSURF':   # render too, so renders show the exported mesh
                md.levels = md.render_levels = cfg["subsurf"]
            elif md.type == 'BEVEL':
                key = "src_segments_" + md.name      # remember the master's value across LOD switches
                o[key] = o.get(key, md.segments)
                md.segments = min(o[key], BEVEL.get(o.name, {}).get(name, cfg["bevel"]))
        it = UNSUB.get(o.name, {}).get(name)
        if it:
            md = o.modifiers.new("LOD_Unsub", 'DECIMATE')
            md.decimate_type, md.iterations = 'UNSUBDIV', it
            o.modifiers.move(len(o.modifiers) - 1, 0)
    bpy.context.view_layer.update()
    base = eval_tris()
    for o in meshes():
        r = RATIO.get(o.name, {}).get(name, cfg["ratio"])
        if base[o.name] <= MIN_TRIS or r >= 1.0:
            continue
        md = o.modifiers.new("LOD_Decimate", 'DECIMATE')
        if o.name in PLANAR:
            md.decimate_type, md.angle_limit = 'DISSOLVE', D(cfg["angle"])
        else:
            md.decimate_type, md.ratio = 'COLLAPSE', r
        wn = [i for i, m in enumerate(o.modifiers) if m.type == 'WEIGHTED_NORMAL']
        if wn:
            o.modifiers.move(len(o.modifiers) - 1, wn[0])
    bpy.context.view_layer.update()
    return eval_tris()


# ---------------------------------------------------------------- clips (30 fps, glTF time = frame / 30)
EYE_CLOSED = 0.08                        # eye height scale when closed
EYE_PIVOT_Z = 2.45                       # world z of the eye joints (rig_export SIDE["Eye"])
HEAD_DOWN = 8.0                          # Blender +X on Head = face tilts down (brief: "pitch -8", slumped)
TORSO_SLUMP = 3.0


def _key(act, name, path, values, frame, interp='LINEAR'):
    o = bpy.data.objects[name]
    ad = o.animation_data or o.animation_data_create()
    if ad.action is not act:
        ad.action = act
    prop = getattr(o, path)
    for i, v in enumerate(values):
        if v is not None:
            prop[i] = v
    o.keyframe_insert(path, frame=frame)


def _eyes(act, f, s):
    """Eyes close by squashing joint Z. Eye_CircuitDetails hangs off Head with its origin at the
    world origin, so it gets the same squash about the eye line via location compensation."""
    for n in ("Eye_L", "Eye_R"):
        _key(act, n, "scale", (1, 1, s), f)
    c = bpy.data.objects["Eye_CircuitDetails"]
    rest_z = c.get("rest_z", c.location.z)
    c["rest_z"] = rest_z
    _key(act, "Eye_CircuitDetails", "scale", (1, 1, s), f)
    _key(act, "Eye_CircuitDetails", "location", (None, None, rest_z + (1 - s) * EYE_PIVOT_Z), f)


def _new_action(name):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    a = bpy.data.actions.new(name)
    a.use_fake_user = True
    return a


def build_clips():
    torso_z = bpy.data.objects["Torso"].location.z
    # Idle: 4 s loop. Float z = 0.04 sin(wt), sway rotZ 0.6 deg. w = 2pi/4 so frame 120 == frame 0
    # (the brief's w = 0.9 rad/s has a 7 s period and cannot loop in 4 s).
    idle = _new_action("Idle")
    w = 2 * math.pi / 4.0
    for f in range(0, 121):
        t = f / FPS
        _key(idle, "Torso", "location", (None, None, torso_z + 0.04 * math.sin(w * t)), f)
        _key(idle, "Torso", "rotation_euler", (0, 0, D(0.6) * math.sin(w * t + math.pi / 2)), f)
    for f in (0, 120):
        _eyes(idle, f, 1.0)
        _key(idle, "Head", "rotation_euler", (0, 0, 0), f)
    # Sleep: static slumped pose, 1 s loop.
    sleep = _new_action("Sleep")
    for f in (0, 30):
        _key(sleep, "Head", "rotation_euler", (D(HEAD_DOWN), 0, 0), f)
        _key(sleep, "Torso", "rotation_euler", (D(TORSO_SLUMP), 0, 0), f)
        _key(sleep, "Torso", "location", (None, None, torso_z - 0.02), f)
        _eyes(sleep, f, EYE_CLOSED)
    # WakeUp: 1.2 s, from the Sleep pose to rest; eyes open over frames 8-30.
    wake = _new_action("WakeUp")
    for f, k in ((0, 1.0), (36, 0.0)):
        _key(wake, "Head", "rotation_euler", (D(HEAD_DOWN) * k, 0, 0), f, 'BEZIER')
        _key(wake, "Torso", "rotation_euler", (D(TORSO_SLUMP) * k, 0, 0), f, 'BEZIER')
        _key(wake, "Torso", "location", (None, None, torso_z - 0.02 * k), f, 'BEZIER')
    for f, s in ((0, EYE_CLOSED), (8, EYE_CLOSED), (30, 1.0), (36, 1.0)):
        _eyes(wake, f, s)
    # Wave (M1-04a): tidy = clamped handles (no overshoot past the authored poses), kept as an asset.
    wave = bpy.data.actions["Wave"]
    wave.use_fake_user = True
    for a in (idle, sleep, wake, wave):
        for fc in _fcurves(a):
            for k in fc.keyframe_points:
                if a is wave or k.interpolation == 'BEZIER':
                    k.interpolation = 'BEZIER'
                    k.handle_left_type = k.handle_right_type = 'AUTO_CLAMPED'
                else:
                    k.interpolation = 'LINEAR'
            fc.update()
    # No action stays active (the GLB nodes carry the rest pose). The exporter's ACTIONS mode finds
    # clips through NLA strips, so each clip gets one muted track per animated object.
    for o in bpy.data.objects:
        if o.animation_data:
            o.animation_data.action = None
            for tr in list(o.animation_data.nla_tracks):
                o.animation_data.nla_tracks.remove(tr)
    for a in (idle, sleep, wake, wave):
        for slot in a.slots:
            o = bpy.data.objects[slot.identifier[2:]]
            tr = o.animation_data.nla_tracks.new()
            tr.name, tr.mute = a.name, True
            st = tr.strips.new(a.name, 0, a)
            st.action_slot = slot
    reset_rest()
    return [idle, sleep, wake, wave]


def _fcurves(act):
    for layer in act.layers:
        for st in layer.strips:
            for cb in st.channelbags:
                yield from cb.fcurves


def reset_rest():
    for o in bpy.data.collections["Robot_Master"].all_objects:
        if o.type == 'EMPTY' and o.name not in ("Root", "LeftHand_Anchor", "RightHand_Anchor"):
            o.rotation_euler = (0, 0, o.rotation_euler.z if o.name.startswith(("Finger", "Thumb")) else 0)
            o.scale = (1, 1, 1)
    bpy.data.objects["Torso"].location.z = 0.5
    c = bpy.data.objects["Eye_CircuitDetails"]
    c.scale = (1, 1, 1)
    c.location.z = c.get("rest_z", c.location.z)


# ---------------------------------------------------------------- materials
TEX_SIZE = 1024          # one bake serves both LODs: <= 2048 (high) and <= 1024 (low)
# Procedural materials -> baked maps. emit: None = keep constant emission;
# "base" = baseColor map reused as emissive at `strength`; "bake" = bake the emission (normalised).
BAKED = {
    "MAT_EmblemGreen": {"objs": ["Emblem_GreenInsert"], "emit": "base", "strength": 0.2},
    "MAT_EyeEmission": {"objs": ["Eye_Left", "Eye_Right"], "emit": None},
    "MAT_FaceGlass": {"objs": ["Face_Display"], "emit": "base", "strength": 0.3},
    "MAT_GreenPanel": {"objs": ["Top_CircuitPanel"], "emit": "bake", "strength": 0.35},
}


def win_ctx():
    """Operators need a window; the context is window-less after open_mainfile/revert."""
    win = bpy.context.window_manager.windows[0]
    area = next(a for a in win.screen.areas if a.type == 'VIEW_3D')
    return bpy.context.temp_override(window=win, screen=win.screen, area=area, scene=bpy.context.scene,
                                     view_layer=bpy.context.view_layer)


def _edit_unwrap(objs):
    """Smart UV project; objects passed together share one non-overlapping layout."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        if not o.data.uv_layers:
            o.data.uv_layers.new(name="UVMap")
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=D(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')


def unwrap_all():
    paired = {n for spec in BAKED.values() for n in spec["objs"] if len(spec["objs"]) > 1}
    for o in meshes():
        if o.name not in paired:
            _edit_unwrap([o])
    for spec in BAKED.values():
        if len(spec["objs"]) > 1:
            _edit_unwrap([bpy.data.objects[n] for n in spec["objs"]])


def _bake(mat, objs, kind, path):
    img = bpy.data.images.new(os.path.basename(path)[:-4], TEX_SIZE, TEX_SIZE, alpha=False)
    nt = mat.node_tree
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = img
    nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if kind == 'DIFFUSE':     # albedo only: no lighting
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=8, use_clear=True)
    else:
        bpy.ops.object.bake(type='EMIT', margin=8, use_clear=True)
    nt.nodes.remove(node)
    img.filepath_raw, img.file_format = path, 'PNG'
    img.save()
    return img


def bake_materials():
    os.makedirs(TEX, exist_ok=True)
    sc = bpy.context.scene
    engine = sc.render.engine
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 16
    for mn, spec in BAKED.items():
        mat = bpy.data.materials[mn]
        objs = [bpy.data.objects[n] for n in spec["objs"]]
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        stem = mn[4:].lower()
        base = _bake(mat, objs, 'DIFFUSE', os.path.join(TEX, f"{stem}_baseColor.png"))
        emit = None
        if spec["emit"] == "bake":   # bake emission at strength 1/strength so the map uses the full 0..1 range
            mr = next(n for n in mat.node_tree.nodes if n.type == 'MAP_RANGE')
            mr.inputs["To Min"].default_value /= spec["strength"]
            mr.inputs["To Max"].default_value /= spec["strength"]
            emit = _bake(mat, objs, 'EMIT', os.path.join(TEX, f"{stem}_emissive.png"))
        rebuild(mat, base, emit if spec["emit"] == "bake" else (base if spec["emit"] == "base" else None),
                spec.get("strength"))
    sc.render.engine = engine


def rebuild(mat, base, emit, strength):
    """Principled + image nodes only (what the glTF exporter maps 1:1). Roughness/metal stay factors."""
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for n in list(nt.nodes):
        if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'):
            nt.nodes.remove(n)
    tb = nt.nodes.new('ShaderNodeTexImage')
    tb.image, tb.location = base, (-400, 200)
    nt.links.new(tb.outputs["Color"], bsdf.inputs["Base Color"])
    if emit is not None:
        if emit is base:
            nt.links.new(tb.outputs["Color"], bsdf.inputs["Emission Color"])
        else:
            te = nt.nodes.new('ShaderNodeTexImage')
            te.image, te.location = emit, (-400, -200)
            nt.links.new(te.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = strength


# ---------------------------------------------------------------- export
LOOP = {"Idle": True, "Sleep": True, "WakeUp": False, "Wave": False}


def main(open_rig=True):
    """Full run. Call open_mainfile(RIG) outside any context override (it resets the window)."""
    if open_rig:
        bpy.ops.wm.open_mainfile(filepath=RIG)
    prepare()
    return export_all()


def prepare():
    """LOD modifiers, UVs, bakes, clips; saves robot_rig2.blend (high LOD settings)."""
    set_lod("high")
    with win_ctx():
        unwrap_all()
        bake_materials()
        build_clips()
        bpy.ops.wm.save_as_mainfile(filepath=RIG2)


def export_all():
    out = {}
    for lod in ("high", "low"):
        tris = set_lod(lod)
        gl = R.export_glb(os.path.join(EXP, f"robot_{lod}.glb"))
        out[lod] = (gl, sum(tris.values()))
    set_lod("high")
    with win_ctx():
        bpy.ops.wm.save_mainfile()
    J = {n: bpy.data.objects[n] for n in ("RightHand_Anchor", "LeftHand_Anchor")}
    man = R.manifest(out["high"][0], R.joint_specs(), J)
    man["source"] = "robot_rig2.blend (scripts/lod_export.py) -> robot_high.glb, robot_low.glb"
    man.pop("triangles")
    man["lods"] = {}
    for lod, (gl, blender_tris) in out.items():
        m = R.manifest(gl, R.joint_specs(), J)
        man["lods"][lod] = {"file": f"robot_{lod}.glb", "triangles": m["triangles"],
                            "blender_triangles": blender_tris, "texture_px": TEX_SIZE,
                            "textures": [i["name"] for i in gl.get("images", [])]}
    for c in man["clips"]:
        c["loop"] = LOOP.get(c["name"], False)
    man["clip_notes"] = {
        "Idle": "Torso float z=0.04*sin(2*pi*t/4) (glTF y), sway rotZ 0.6 deg; 4 s seamless loop",
        "Sleep": "static: Head +8 deg Blender X (face down), Torso +3 deg X, -0.02 z; eyes closed by "
                 "scale y=0.08 on Eye_L/Eye_R and Eye_CircuitDetails (glTF y)",
        "WakeUp": "Sleep pose -> rest over 1.2 s; eyes open frames 8-30",
        "Wave": "M1-04a clip, handles clamped",
        "eye_emission": "not animated in the GLB (three.js has no KHR_animation_pointer); drive "
                        "emissiveIntensity of MAT_EyeEmission in code if needed",
    }
    man["materials"] = materials_info(out["high"][0])
    with open(os.path.join(EXP, "manifest.json"), "w") as f:
        json.dump(man, f, indent=2)
    return {k: v[1] for k, v in out.items()}, man["lods"], man["clips"]


def materials_info(gl):
    tex = lambda t: gl["images"][gl["textures"][t["index"]]["source"]]["name"] if t else None
    out = []
    for m in gl["materials"]:
        pbr = m.get("pbrMetallicRoughness", {})
        ext = m.get("extensions", {})
        out.append({"name": m["name"],
                    "baseColorTexture": tex(pbr.get("baseColorTexture")),
                    "baseColorFactor": pbr.get("baseColorFactor"),
                    "metallicFactor": pbr.get("metallicFactor", 1.0),
                    "roughnessFactor": pbr.get("roughnessFactor", 1.0),
                    "emissiveTexture": tex(m.get("emissiveTexture")),
                    "emissiveFactor": m.get("emissiveFactor"),
                    "emissiveStrength": ext.get("KHR_materials_emissive_strength", {}).get("emissiveStrength"),
                    "clearcoat": ext.get("KHR_materials_clearcoat", {}).get("clearcoatFactor")})
    return out
