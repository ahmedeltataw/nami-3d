"""Build gallery_shell.blend and export/gallery_shell.glb + manifest (card M2-07b, S05 dark gallery).

The portal gates are not in this file: the app places portal_gate.glb on each Gate_n anchor.
Blender: Z up, floor top at z = 0, the camera side is the arc centre, gates on a radius-12 arc at +Y.
glTF: Y up. Gate_n sits at the ring centre (portal_gate's root), local -Y (glTF +Z) facing the arc centre.
"""
import importlib
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

# run with exec(src, {"__file__": path}) so the helpers resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

importlib.reload(common)
import props  # noqa: E402

importlib.reload(props)
from common import EXPORT_DIR, GREEN, ROOT_DIR, b2g, export_glb, make_material, new_scene, write_json  # noqa: E402
from props import Asset  # noqa: E402

ARC_R = 12.0
GATE_ANGLES = [165, 135, 105, 75, 45, 15]   # Gate_1 on the left seen from the arc centre
GATE_Z = 2.4                                # portal ring centre (gate outer radius 2.25 + platform)
PLAT_H = 0.12
FLOOR_R, WALL_R = 17.0, 16.0

scene = new_scene()
mats = {
    "floor": make_material("Gallery_Floor", (0.08, 0.085, 0.095), roughness=0.35, metallic=0.2),
    "charcoal": make_material("Charcoal", (0x1B / 255, 0x1D / 255, 0x20 / 255), roughness=0.45, metallic=0.3),
    "rib": make_material("Gallery_Rib", (0.16, 0.17, 0.19), roughness=0.5, metallic=0.3),
    "white": make_material("Shell_White", (0.9, 0.91, 0.92), roughness=0.35),
    "green": make_material("Accent_Green", GREEN, roughness=0.3, emission_srgb=GREEN, emission_strength=2.0),
    "green_dim": make_material("Accent_Green_Dim", GREEN, roughness=0.3, emission_srgb=GREEN,
                               emission_strength=0.5),
}
A = Asset(scene, "Gallery_Shell", "GalleryShell", mats)


def floor(b):
    b.cyl((0, 0, -0.2), FLOOR_R, 0.4, "floor", 96)
    for r in (ARC_R - 3.6, ARC_R + 2.2):
        b.ring((0, 0, 0.004), r - 0.03, r + 0.03, 0.02, "green_dim", 96)


A.node("Floor", None, (0, 0, 0), floor, role="floor")


def ribs(b):
    for k in range(37):
        a = math.radians(-10 + 200 * k / 36)
        M = Matrix.Translation((WALL_R * math.cos(a), WALL_R * math.sin(a), 0)) @ Matrix.Rotation(a, 4, "Z")
        h = 7.5 if k % 2 == 0 else 5.5
        b.box((0, 0, h / 2), (0.5, 0.18, h), "rib", bevel=0.03, M=M)
        b.box((-0.255, 0, 0.6), (0.02, 0.06, 0.8), "green_dim", M=M)


A.node("Ribs", None, (0, 0, 0), ribs, role="wall_ribs")

gates = []
for i, ang in enumerate(GATE_ANGLES, 1):
    a = math.radians(ang)
    radial = Vector((math.cos(a), math.sin(a), 0))
    tangent = Vector((-math.sin(a), math.cos(a), 0))
    pos = radial * ARC_R
    yaw = math.atan2(-radial.x, radial.y)            # local -Y faces the arc centre
    R = Matrix.Rotation(yaw, 4, "Z")
    M = Matrix.Translation(pos) @ R

    def frame(b, M=M):
        b.box((0, 0, PLAT_H / 2), (5.4, 1.4, PLAT_H), "charcoal", bevel=0.03, M=M)
        b.box((0, -0.705, PLAT_H / 2), (5.0, 0.02, 0.03), "green", M=M)
        for sx in (-2.6, 2.6):
            b.box((sx, 0, 2.4), (0.24, 0.5, 4.8), "rib", bevel=0.04, M=M)
            b.box((sx, -0.255, 2.4), (0.05, 0.02, 3.6), "green_dim", M=M)
        b.box((0, 0, 4.86), (5.44, 0.5, 0.18), "rib", bevel=0.04, M=M)

    A.node(f"GateFrame_{i}", None, tuple(pos), frame, role="gate_frame")
    gate_p = pos + Vector((0, 0, GATE_Z))
    A.empty(f"Gate_{i}", A.root, tuple(gate_p), size=1.0, role="gate_anchor", display="ARROWS", rot=R)

    # robot standing pad: in front of the gate (toward the centre) and to its right seen from the centre
    spot = pos - radial * 2.3 - tangent * 2.0
    A.node(f"RobotPad_{i}", None, tuple(spot),
           lambda b, s=spot: (b.cyl((s.x, s.y, 0.075), 0.9, 0.15, "charcoal", 48),
                              b.ring((s.x, s.y, 0.152), 0.72, 0.78, 0.006, "green", 48)), role="robot_pad")
    to_c = (-spot).normalized()
    spot_yaw = math.atan2(to_c.x, -to_c.y)
    A.empty(f"RobotSpot_{i}", A.root, (spot.x, spot.y, 0.153), size=0.6, role="robot_spot", display="ARROWS",
            rot=Matrix.Rotation(spot_yaw, 4, "Z"))
    gates.append((i, ang, gate_p, R, spot, spot_yaw))

# preview (not exported)
prev = bpy.data.collections.new("Preview")
scene.collection.children.link(prev)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.011, 0.012, 0.014, 1)
for name, loc, energy in (("Key", (0, -6, 10), 4000), ("Fill", (0, 8, 6), 1500)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = 10
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    prev.objects.link(lo)
    lo.rotation_euler = (Vector((0, 6, 0)) - lo.location).to_track_quat("-Z", "Y").to_euler()
cam_d = bpy.data.cameras.new("PreviewCam")
cam_d.lens = 24
pcam = bpy.data.objects.new("PreviewCam", cam_d)
prev.objects.link(pcam)
pcam.location = (0, -4, 3.5)
pcam.rotation_euler = (Vector((0, 10, 2.4)) - pcam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = pcam
scene.render.resolution_x, scene.render.resolution_y = 1280, 720

bpy.context.view_layer.update()
os.makedirs(EXPORT_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "gallery_shell.blend"))
export_glb("Gallery_Shell", os.path.join(EXPORT_DIR, "gallery_shell.glb"))


def facing(R):
    return b2g((R.to_3x3() @ Vector((0, -1, 0))).normalized())


manifest = {
    "file": "gallery_shell.glb",
    "source": "assets-model/gallery_shell.blend (built by assets-model/scripts/gallery_shell.py)",
    "units": "same as the robot (3.38 units tall). Floor top is y = 0.",
    "axes": "glTF +Y up; gates on a radius-12 arc around the origin at -Z; the camera path is near the origin.",
    "tris_total": A.tris(),
    "textures": "none",
    "ambient": "dark world: set clear colour / ambient to charcoal #1B1D20 in-app; no lights exported",
    "gates": [
        {"index": i, "gate_anchor": f"Gate_{i}", "gate_position_gltf": b2g(gp), "gate_facing_gltf": facing(R),
         "robot_spot": f"RobotSpot_{i}", "robot_spot_gltf": b2g((s.x, s.y, 0.153)),
         "robot_facing_gltf": facing(Matrix.Rotation(sy, 4, "Z"))}
        for (i, ang, gp, R, s, sy) in gates
    ],
    "notes": [
        "Parent a portal_gate.glb instance (its PortalGate root) under each Gate_n with an identity transform: "
        "Gate_n is the ring centre and its local +Z (glTF) faces the arc centre, like the portal's front.",
        "RobotSpot_n is the top of a small pad in front of and beside gate n, local +Z facing the arc centre.",
        "Gates are numbered 1..6 left to right seen from the arc centre.",
    ],
    "nodes": A.manifest_nodes(),
}
write_json(os.path.join(EXPORT_DIR, "gallery_shell.manifest.json"), manifest)
print("gallery tris", manifest["tris_total"])
