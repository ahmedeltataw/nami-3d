"""M1-04a: joint empties + Wave proof clip + GLB/manifest export.

Idempotent: always reopens robot_master.blend (never saved over), builds the rig,
saves robot_rig.blend and writes export/robot_proof.glb, manifest.json, rest_check.txt.

Usage inside Blender:
    import sys; sys.path.insert(0, r"<this folder>")
    import rig_export as R; R.main()
"""
import json
import math
import os
import struct

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(HERE, "robot_master.blend")
RIG = os.path.join(HERE, "robot_rig.blend")
EXP = os.path.join(HERE, "export")
FPS, F0, F1 = 30, 0, 48          # 48 frames / 30 fps = 1.6 s; glTF time = frame / fps, so start at 0
ARM_Y, PALM_X, PALM_Z, YAW = 0.02, 1.14, 0.36, 22.0   # from build_robot.HAND / ARM_Y
FINGER_DY = (-0.072, -0.024, 0.024, 0.072)
D = math.radians

# Joint table: name -> (parent, pivot for the LEFT side or centre, meshes, axes/limits in Blender local deg).
# _L pivots are mirrored (x -> -x) for _R. Limit sign flips are handled in limits().
CENTRE = {
    "Torso": ("Root", (0, 0, 0.5), ["Body_MainShell", "Chest_UpperArmor", "Body_LowerShell",
                                    "Emblem_OuterHousing", "Emblem_GreenInsert", "Emblem_WhiteSymbol"],
              {"Z": (-30, 30), "X": (-10, 30)}),   # M2-clips: pitch 30 forward (+X) / 10 back
    "Neck": ("Torso", (0, 0, 1.60), ["Neck_Joint"], {"Z": (-45, 45), "X": (-15, 15)}),
    "Head": ("Neck", (0, 0, 1.86), ["Head_OuterShell", "Face_Display", "Face_Bezel", "Top_CircuitPanel",
                                    "Top_CircuitTraces", "Left_SideModule", "Right_SideModule",
                                    "Eye_CircuitDetails", "Face_Cutter"],
             {"X": (-20, 20), "Y": (-20, 20), "Z": (-45, 45)}),
}
SIDE = {   # name: (parent, left pivot, mesh name template with {t}=L/R, {side}=Left/Right)
    "Eye": ("Head", (0.375, -0.78, 2.45), ["Eye_{side}"], {"X": (-10, 10), "Z": (-10, 10)}),
    # M2-clips: shoulder inward up to 45 (Y raise toward the body, Z swing of a forward arm), elbow flex 110
    "Shoulder": ("Torso", (1.0, ARM_Y, 1.55), ["Arm_{t}_Shoulder"],
                 {"Y": (-170, 45), "X": (-90, 90), "Z": (-45, 30)}),
    "Upper": ("Shoulder", (1.005, ARM_Y, 1.1575), ["Arm_{t}_Upper"], {"Y": (-30, 30), "X": (-110, 45)}),
    "Wrist": ("Upper", (1.07, ARM_Y, 0.50), ["Arm_{t}_Wrist"], {"Z": (-90, 90)}),
    "Palm": ("Wrist", (PALM_X, ARM_Y, 0.42), ["Hand_{t}_Palm"], {"X": (-45, 45), "Y": (-30, 30)}),
}
CURL = {"Y": (0, 90)}   # finger/thumb curl on local Y (left side positive)
CURL_INDEX = {"Y": (-15, 90)}   # Finger_1 may straighten past its modelled curl (M2-clips, Point)


def finger_pivot(i, s):
    """Finger root after the palm yaw (build_robot.build_hand)."""
    p = Vector((s * (PALM_X + 0.005), ARM_Y + FINGER_DY[i], PALM_Z - 0.075 * 0.75))
    c = Vector((s * PALM_X, ARM_Y, 0))
    return c + Matrix.Rotation(D(s * YAW), 3, 'Z') @ (p - c)


def limits(lim, s):
    """Left limits are authored; mirror to the right: rotations about Y and Z flip sign."""
    if s > 0:
        return dict(lim)
    return {a: ((-hi, -lo) if a in "YZ" else (lo, hi)) for a, (lo, hi) in lim.items()}


def joint_specs():
    """[(name, parent, pivot, rest yaw deg, meshes, limits)] in parent-first order."""
    out = [("Root", None, (0, 0, 0), 0, [], {})]
    for n, (p, piv, meshes, lim) in CENTRE.items():
        out.append((n, p, piv, 0, meshes, lim))
    for s, t, side in ((1, "L", "Left"), (-1, "R", "Right")):
        for n, (p, piv, meshes, lim) in SIDE.items():
            par = p if p in ("Head", "Torso") else f"{p}_{t}"
            out.append((f"{n}_{t}", par, (s * piv[0], piv[1], piv[2]), 0,
                        [m.format(t=t, side=side) for m in meshes], limits(lim, s)))
        for i in range(4):
            out.append((f"Finger_{i + 1}_{t}", f"Palm_{t}", tuple(finger_pivot(i, s)), s * YAW,
                        [f"Hand_{t}_Finger_{i + 1}"], limits(CURL_INDEX if i == 0 else CURL, s)))
        out.append((f"Thumb_{t}", f"Palm_{t}", (s * (PALM_X - 0.10), ARM_Y - 0.04, PALM_Z + 0.11), 0,
                    [f"Hand_{t}_Thumb"], limits(CURL, s)))
    return out


def world_mats():
    return {o.name: o.matrix_world.copy() for o in bpy.data.objects if o.type == 'MESH'}


def set_parent_keep(o, parent):
    w = o.matrix_world.copy()
    o.parent = parent
    o.matrix_parent_inverse = Matrix.Identity(4)   # bake into local transform (clean for glTF)
    o.matrix_world = w


def build_rig():
    master = bpy.data.collections["Robot_Master"]
    root = bpy.data.objects["Robot_ROOT"]
    root.name = "Root"
    J = {"Root": root}
    for name, par, piv, yaw, meshes, lim in joint_specs():
        if name != "Root":
            e = bpy.data.objects.new(name, None)
            e.empty_display_type, e.empty_display_size = 'ARROWS', 0.08
            master.objects.link(e)
            e.matrix_world = Matrix.Translation(piv) @ Matrix.Rotation(D(yaw), 4, 'Z')
            set_parent_keep(e, J[par])
            J[name] = e
        J[name]["joint_limits_deg"] = json.dumps(lim)
        for m in meshes:
            set_parent_keep(bpy.data.objects[m], J[name])
    for t, s in (("L", 1), ("R", -1)):
        a = bpy.data.objects.new(f"{'Left' if s > 0 else 'Right'}Hand_Anchor", None)
        a.empty_display_type, a.empty_display_size = 'SPHERE', 0.05
        master.objects.link(a)
        a.matrix_world = Matrix.Translation((s * PALM_X, ARM_Y, PALM_Z))
        set_parent_keep(a, J[f"Palm_{t}"])
    bpy.context.view_layer.update()
    return J


def build_wave(J):
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base, sc.frame_start, sc.frame_end = FPS, 1.0, F0, F1
    act = bpy.data.actions.new("Wave")
    keys = {   # object: [(frame, (rx, ry, rz) deg)]
        "Shoulder_R": [(1, (0, 0, 0)), (11, (0, 130, 0)), (39, (0, 130, 0)), (49, (0, 0, 0))],
        "Upper_R": [(1, (0, 0, 0)), (11, (0, 0, 0)), (18, (0, 25, 0)), (25, (0, -25, 0)),
                    (32, (0, 25, 0)), (39, (0, 0, 0)), (49, (0, 0, 0))],
        "Palm_R": [(1, (0, 0, 0)), (11, (0, 0, 0)), (18, (0, 15, 0)), (25, (0, -15, 0)),
                   (32, (0, 15, 0)), (39, (0, 0, 0)), (49, (0, 0, 0))],
        "Head": [(1, (0, 0, 0)), (14, (0, 8, 0)), (36, (0, 8, 0)), (49, (0, 0, 0))],
    }
    for name, ks in keys.items():
        o = J[name]
        o.rotation_mode = 'XYZ'
        rest = o.rotation_euler.copy()
        o.animation_data_create().action = act
        for f, r in ks:
            o.rotation_euler = (rest.x + D(r[0]), rest.y + D(r[1]), rest.z + D(r[2]))
            o.keyframe_insert("rotation_euler", frame=f - 1 + F0)   # table frames are 1-based
        o.rotation_euler = rest
    sc.frame_set(F0)
    return act


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    n = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + n])


def export_glb(path):
    lc = bpy.context.view_layer.layer_collection.children["Robot_Master"]
    bpy.context.view_layer.active_layer_collection = lc
    win = bpy.context.window_manager.windows[0]    # context is window-less after open_mainfile
    with bpy.context.temp_override(window=win, screen=win.screen, scene=bpy.context.scene,
                                   view_layer=bpy.context.view_layer):
        _gltf(path)
    return read_glb(path)


def _gltf(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_active_collection=True,
        use_active_collection_with_nested=True, export_apply=True, export_yup=True,
        export_animations=True, export_animation_mode='ACTIONS', export_extras=True,
        export_draco_mesh_compression_enable=False, export_cameras=False, export_lights=False)


def manifest(gl, specs, J):
    nodes = gl["nodes"]
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parent[c] = nodes[i]["name"]
    to_gl = lambda a: {"X": [1, 0, 0], "Y": [0, 0, -1], "Z": [0, 1, 0]}[a]   # Blender local -> glTF local
    joints = []
    for name, par, piv, yaw, meshes, lim in specs:
        joints.append({"name": name, "parent": par,
                       "pivot_blender": [round(v, 4) for v in piv],
                       "pivot_gltf": [round(piv[0], 4), round(piv[2], 4), round(-piv[1], 4)],
                       "rest_yaw_deg_blender_z": yaw, "meshes": meshes,
                       "axes": [{"axis_blender_local": a, "axis_gltf_local": to_gl(a), "min_deg": lo, "max_deg": hi}
                                for a, (lo, hi) in lim.items()]})
    tris = 0
    for m in gl["meshes"]:
        for p in m["primitives"]:
            acc = gl["accessors"][p["indices"]] if "indices" in p else gl["accessors"][p["attributes"]["POSITION"]]
            tris += acc["count"] // 3
    clips = []
    for a in gl.get("animations", []):
        dur = max(gl["accessors"][s["input"]]["max"][0] for s in a["samplers"])
        t0 = min(gl["accessors"][s["input"]]["min"][0] for s in a["samplers"])
        clips.append({"name": a["name"], "start_s": round(t0, 4), "duration_s": round(dur - t0, 4), "fps": FPS,
                      "targets": sorted({nodes[c["target"]["node"]]["name"] for c in a["channels"]})})
    mats = {}
    for n in nodes:
        if "mesh" in n:
            m = gl["meshes"][n["mesh"]]
            mats[n["name"]] = [gl["materials"][p["material"]]["name"] if "material" in p else None
                               for p in m["primitives"]]
    return {
        "source": "robot_rig.blend -> robot_proof.glb",
        "units": "1 unit = 400 px of ref_front.webp; robot 3.38 units tall",
        "axes": "glTF +Y up, robot faces +Z (Blender -Y), robot left = +X",
        "nodes": [{"name": n["name"], "parent": parent.get(i), "mesh": "mesh" in n} for i, n in enumerate(nodes)],
        "joints": joints,
        "material_slots": mats,
        "clips": clips,
        "anchors": {a: {"parent": J[a].parent.name,
                        "position_blender": [round(v, 4) for v in J[a].matrix_world.translation],
                        "position_gltf": [round(J[a].matrix_world.translation[i] * s, 4)
                                          for i, s in ((0, 1), (2, 1), (1, -1))]}
                    for a in ("RightHand_Anchor", "LeftHand_Anchor")},
        "triangles": tris,
    }


def main(open_master=True):
    if open_master:
        bpy.ops.wm.open_mainfile(filepath=MASTER)
    os.makedirs(EXP, exist_ok=True)
    before = world_mats()
    J = build_rig()
    J["RightHand_Anchor"], J["LeftHand_Anchor"] = (bpy.data.objects["RightHand_Anchor"],
                                                   bpy.data.objects["LeftHand_Anchor"])
    after = world_mats()
    build_wave(J)
    bpy.context.scene.frame_set(F0)
    at_f0 = world_mats()
    err = lambda a: max(max(abs(x - y) for ra, rb in zip(before[n], a[n]) for x, y in zip(ra, rb)) for n in before)
    e1, e2 = err(after), err(at_f0)
    ok = e1 < 1e-4 and e2 < 1e-4
    with open(os.path.join(EXP, "rest_check.txt"), "w") as f:
        f.write(f"meshes checked: {len(before)}\nmax |dM| after parenting: {e1:.2e}\n"
                f"max |dM| at frame {F0} with Wave assigned: {e2:.2e}\ntolerance: 1e-4\nresult: {'PASS' if ok else 'FAIL'}\n")
    bpy.ops.wm.save_as_mainfile(filepath=RIG, copy=False)
    gl = export_glb(os.path.join(EXP, "robot_proof.glb"))
    man = manifest(gl, joint_specs(), J)
    with open(os.path.join(EXP, "manifest.json"), "w") as f:
        json.dump(man, f, indent=2)
    return ok, e1, e2, man["triangles"], man["clips"]
