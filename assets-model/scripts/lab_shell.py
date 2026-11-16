"""Build lab_shell.blend and export/lab_shell.glb + manifest (card M2-03).

Blender: Z up, floor top at z = 0, the open side (camera side) is -Y, the curved wall is at +Y.
glTF:    Y up, the open side is +Z. Flat colours only, no textures, no baked lighting.
"""
import importlib
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

# run with exec(src, {"__file__": path}) so the helpers resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

importlib.reload(common)
from common import (CHARCOAL, EXPORT_DIR, GREEN, ROOT_DIR, b2g, empty_object, export_glb,  # noqa: E402
                    fix_normals_outward, make_material, mesh_object, new_scene, sweep_profile,
                    tri_count, world_bounds, write_json)

FLOOR_HALF = 15.0
FLOOR_THICK = 0.4
CENTER = Vector((0.0, -1.0, 0.0))      # centre of the wall / station arcs
WALL_R, WALL_T, WALL_H = 13.0, 0.3, 7.0
COVE_R = 1.6                          # wall curves into the ceiling
CEIL_Z = WALL_H + COVE_R              # 8.6
WALL_A0, WALL_A1 = math.radians(-15), math.radians(195)
STATION_R = 9.0
STATION_ANGLES = [160, 132, 104, 76, 48, 20]   # Station_1 on the left seen from the camera side
PLINTH_R, PLINTH_H = 1.3, 0.35
CAM_DIST, CAM_H = 5.5, 1.7

scene = new_scene()
coll = bpy.data.collections.new("Lab_Shell")
scene.collection.children.link(coll)

m_floor = make_material("Floor_LightGrey", (0.88, 0.89, 0.90), roughness=0.55)
m_white = make_material("Shell_White", (0.96, 0.965, 0.97), roughness=0.4)
m_grey = make_material("Trim_Grey", (0.83, 0.85, 0.87), roughness=0.45)
m_charcoal = make_material("Charcoal", CHARCOAL, roughness=0.45, metallic=0.3)
m_green = make_material("Accent_Green", GREEN, roughness=0.3, emission_srgb=GREEN, emission_strength=2.5)
m_panel = make_material("CeilingLight", (0.97, 0.99, 0.98), roughness=0.2,
                        emission_srgb=(0.94, 1.0, 0.97), emission_strength=3.0)


def rect(r0, r1, h0, h1):
    return [(r0, h0), (r1, h0), (r1, h1), (r0, h1)]


def chamfer_rect(r0, r1, h0, h1, c):
    return [(r0 + c, h0), (r1 - c, h0), (r1, h0 + c), (r1, h1 - c),
            (r1 - c, h1), (r0 + c, h1), (r0, h1 - c), (r0, h0 + c)]


def box(bm, lo, hi, mat_index=0):
    res = bmesh.ops.create_cube(bm, size=1.0)
    for v in res["verts"]:
        v.co = Vector(((lo[0] + hi[0]) / 2 + v.co.x * (hi[0] - lo[0]),
                       (lo[1] + hi[1]) / 2 + v.co.y * (hi[1] - lo[1]),
                       (lo[2] + hi[2]) / 2 + v.co.z * (hi[2] - lo[2])))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat_index


def floor_disc(bm, r_in, r_out, z0, z1, a0, a1, steps, mat_index, center=CENTER):
    if r_in <= 0:
        prof = [(0.0, z0), (r_out, z0), (r_out, z1), (0.0, z1)]
        sweep_profile(bm, prof, a0, a1, steps, axis="Z", mat_index=mat_index, center=tuple(center))
    else:
        sweep_profile(bm, rect(r_in, r_out, z0, z1), a0, a1, steps, axis="Z", mat_index=mat_index,
                      center=tuple(center))


root = empty_object("LabShell", coll, size=1.0)
root["nami_role"] = "lab_root"

# ---------------------------------------------------------------- floor platform + inlays
bm = bmesh.new()
box(bm, (-FLOOR_HALF, -FLOOR_HALF, -FLOOR_THICK), (FLOOR_HALF, FLOOR_HALF, 0.0))
bmesh.ops.bevel(bm, geom=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.1],
                offset=1.5, segments=6, affect="EDGES")
uv = bm.loops.layers.uv.verify()
for f in bm.faces:
    for loop in f.loops:
        loop[uv].uv = (0.5 + loop.vert.co.x / (2 * FLOOR_HALF), 0.5 + loop.vert.co.y / (2 * FLOOR_HALF))
fix_normals_outward(bm)
floor = mesh_object("Floor", bm, [m_floor], coll, parent=root)
floor["nami_role"] = "floor"

# green inlay lines: embedded 1 cm, proud 0.8 cm, so no face is coplanar with the floor top
bm = bmesh.new()
a_lo, a_hi = math.radians(8), math.radians(172)
for r in (STATION_R - 1.9, STATION_R + 1.9):
    floor_disc(bm, r - 0.04, r + 0.04, -0.01, 0.008, a_lo, a_hi, 64, 0)
for ang in STATION_ANGLES:
    a = math.radians(ang)
    w = 0.04 / (STATION_R - 1.9)
    floor_disc(bm, 3.35, STATION_R - 1.9, -0.01, 0.008, a - w, a + w, 1, 0)
fix_normals_outward(bm)
inlay = mesh_object("Floor_Accent", bm, [m_green], coll, parent=root)
inlay["nami_role"] = "accent_lines"

# central stage disc (where the robot can stand) with a green rim
bm = bmesh.new()
floor_disc(bm, 0, 3.0, -0.01, 0.06, 0, 2 * math.pi, 64, 0)
floor_disc(bm, 3.0, 3.25, -0.01, 0.04, 0, 2 * math.pi, 64, 1)
fix_normals_outward(bm)
stage = mesh_object("Stage", bm, [m_white, m_green], coll, parent=root)
stage["nami_role"] = "stage"

# ---------------------------------------------------------------- curved back wall with cove
prof = [(WALL_R, 0.0), (WALL_R + WALL_T, 0.0), (WALL_R + WALL_T, WALL_H)]
n_cove = 8
for k in range(1, n_cove + 1):  # outer cove arc, up and inward
    t = math.radians(90 * k / n_cove)
    prof.append((WALL_R - COVE_R + (COVE_R + WALL_T) * math.cos(t), WALL_H + (COVE_R + WALL_T) * math.sin(t)))
for k in range(n_cove, -1, -1):  # inner cove arc, back down
    t = math.radians(90 * k / n_cove)
    prof.append((WALL_R - COVE_R + COVE_R * math.cos(t), WALL_H + COVE_R * math.sin(t)))
bm = bmesh.new()
sweep_profile(bm, prof, WALL_A0, WALL_A1, 96, axis="Z", center=tuple(CENTER))
fix_normals_outward(bm)
wall = mesh_object("BackWall", bm, [m_white], coll, parent=root)
wall["nami_role"] = "back_wall"

# wall ribs + horizontal green accent lines on the inner face
bm = bmesh.new()
for k in range(15):
    ang = -15 + 15 * k
    if ang in (-15, 195):
        continue
    a = math.radians(ang)
    w = 0.11 / WALL_R
    sweep_profile(bm, chamfer_rect(WALL_R - 0.22, WALL_R + 0.02, 0.0, WALL_H - 0.1, 0.05), a - w, a + w, 1,
                  axis="Z", mat_index=0, center=tuple(CENTER))
for z in (1.05, 6.4):
    sweep_profile(bm, rect(WALL_R - 0.03, WALL_R + 0.02, z, z + 0.06), WALL_A0, WALL_A1, 96, axis="Z",
                  mat_index=1, center=tuple(CENTER))
# skirting
sweep_profile(bm, rect(WALL_R - 0.08, WALL_R + 0.02, 0.0, 0.22), WALL_A0, WALL_A1, 96, axis="Z", mat_index=0,
              center=tuple(CENTER))
fix_normals_outward(bm)
trim = mesh_object("BackWall_Trim", bm, [m_grey, m_green], coll, parent=root)
trim["nami_role"] = "wall_trim"

# ---------------------------------------------------------------- ceiling lid + light panels
bm = bmesh.new()
lid_r = WALL_R - COVE_R + 0.05
sweep_profile(bm, [(0.0, CEIL_Z), (lid_r, CEIL_Z), (lid_r, CEIL_Z + 0.3), (0.0, CEIL_Z + 0.3)],
              WALL_A0, WALL_A1, 96, axis="Z", center=tuple(CENTER))
fix_normals_outward(bm)
ceiling = mesh_object("Ceiling", bm, [m_white], coll, parent=root)
ceiling["nami_role"] = "ceiling"

panels = []
rings = [(3.4, 4.6, 6), (6.0, 7.4, 8), (8.8, 10.2, 10)]
idx = 0
for r0, r1, count in rings:
    span = 180.0 / count
    for k in range(count):
        mid = span * (k + 0.5)
        a0 = math.radians(mid - span * 0.38)
        a1 = math.radians(mid + span * 0.38)
        bm = bmesh.new()
        # grey frame then emissive face 2 cm lower; frame top is embedded in the lid
        sweep_profile(bm, rect(r0 - 0.08, r1 + 0.08, CEIL_Z - 0.12, CEIL_Z + 0.02),
                      a0 - 0.08 / r0, a1 + 0.08 / r0, 6, axis="Z", mat_index=0, center=tuple(CENTER))
        sweep_profile(bm, rect(r0, r1, CEIL_Z - 0.14, CEIL_Z - 0.10), a0, a1, 6, axis="Z", mat_index=1,
                      center=tuple(CENTER))
        fix_normals_outward(bm)
        idx += 1
        ob = mesh_object(f"CeilingPanel_{idx:02d}", bm, [m_grey, m_panel], coll, parent=root)
        ob["nami_role"] = "ceiling_light"
        panels.append(ob)

# ---------------------------------------------------------------- stations
stations = []
for i, ang in enumerate(STATION_ANGLES, start=1):
    a = math.radians(ang)
    pos = CENTER + Vector((STATION_R * math.cos(a), STATION_R * math.sin(a), 0.0))
    to_center = (CENTER - pos).normalized()
    yaw = math.atan2(to_center.x, -to_center.y)  # local -Y faces the arc centre / camera path

    plinth = empty_object(f"StationGroup_{i}", coll, parent=root, location=pos, size=0.6)
    plinth.rotation_euler = (0, 0, yaw)
    plinth["nami_role"] = "station_group"

    bm = bmesh.new()
    sweep_profile(bm, [(0.0, 0.0), (PLINTH_R, 0.0), (PLINTH_R, PLINTH_H - 0.08), (PLINTH_R - 0.08, PLINTH_H),
                       (0.0, PLINTH_H)], 0, 2 * math.pi, 48, axis="Z", mat_index=0)
    sweep_profile(bm, rect(PLINTH_R + 0.01, PLINTH_R + 0.06, 0.0, 0.12), 0, 2 * math.pi, 48, axis="Z",
                  mat_index=1)
    fix_normals_outward(bm)
    pl = mesh_object(f"Plinth_{i}", bm, [m_white, m_grey], coll, parent=plinth)
    pl["nami_role"] = "plinth"

    m_glow = make_material(f"StationGlow_{i}", GREEN, roughness=0.3, emission_srgb=GREEN, emission_strength=2.0)
    bm = bmesh.new()
    sweep_profile(bm, rect(PLINTH_R - 0.32, PLINTH_R - 0.2, PLINTH_H - 0.01, PLINTH_H + 0.012), 0, 2 * math.pi,
                  48, axis="Z")
    # front notch marker so orientation reads
    sweep_profile(bm, rect(PLINTH_R - 0.1, PLINTH_R + 0.012, 0.08, PLINTH_H - 0.12),
                  math.radians(-90 - 12), math.radians(-90 + 12), 4, axis="Z")
    fix_normals_outward(bm)
    glow = mesh_object(f"StationGlow_{i}", bm, [m_glow], coll, parent=plinth)
    glow["nami_role"] = "station_glow"

    anchor = empty_object(f"Station_{i}", coll, parent=plinth, location=(0, 0, PLINTH_H), size=0.8,
                          display="ARROWS")
    anchor["nami_role"] = "station_anchor"

    cam_pos = pos + to_center * CAM_DIST + Vector((0, 0, CAM_H))
    look_at = pos + Vector((0, 0, 1.2))
    cam = empty_object(f"CamAnchor_{i}", coll, parent=root, location=cam_pos, size=0.4, display="CONE")
    cam.rotation_euler = (look_at - cam_pos).to_track_quat("-Z", "Y").to_euler()
    cam["nami_role"] = "camera_anchor"
    stations.append((i, ang, plinth, anchor, cam, glow, pos, look_at, cam_pos))

for ob in coll.objects:
    if ob.type == "MESH":
        for p in ob.data.polygons:
            p.use_smooth = False

# ---------------------------------------------------------------- preview lights (not exported)
prev = bpy.data.collections.new("Preview")
scene.collection.children.link(prev)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.85, 0.88, 0.9, 1)
bg.inputs[1].default_value = 0.6
sun_d = bpy.data.lights.new("Sun", "SUN")
sun_d.energy = 2.5
sun = bpy.data.objects.new("Sun", sun_d)
sun.rotation_euler = (math.radians(40), math.radians(10), math.radians(-20))
prev.objects.link(sun)
cam_d = bpy.data.cameras.new("PreviewCam")
cam_d.lens = 28
pcam = bpy.data.objects.new("PreviewCam", cam_d)
prev.objects.link(pcam)
pcam.location = (0, -14, 3.0)
pcam.rotation_euler = (Vector((0, 3, 1.5)) - pcam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = pcam
scene.render.resolution_x, scene.render.resolution_y = 1280, 720

bpy.context.view_layer.update()

# ---------------------------------------------------------------- save, export, manifest
os.makedirs(EXPORT_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "lab_shell.blend"))
export_glb("Lab_Shell", os.path.join(EXPORT_DIR, "lab_shell.glb"))

meshes = [ob for ob in coll.objects if ob.type == "MESH"]
tris = {ob.name: tri_count(ob) for ob in meshes}
mn, mx = world_bounds(meshes)


def fwd_gltf(ob, axis):
    v = ob.matrix_world.to_3x3() @ Vector(axis)
    return b2g(v.normalized())


manifest = {
    "file": "lab_shell.glb",
    "source": "assets-model/lab_shell.blend (built by assets-model/scripts/lab_shell.py)",
    "units": "Blender units, same as the robot (robot is 3.38 units tall). Floor top is y = 0.",
    "axes": "glTF +Y up; the open side of the lab (camera side) is +Z, the curved wall is at -Z",
    "tris_total": sum(tris.values()),
    "textures": "none (flat PBR colours)",
    "bounds_gltf": {"min": b2g((mn.x, mx.y, mn.z)), "max": b2g((mx.x, mn.y, mx.z))},
    "arc_centre_gltf": b2g(CENTER),
    "station_arc_radius": STATION_R,
    "stations": [
        {
            "index": i,
            "anchor": anchor.name,
            "group": plinth.name,
            "glow_node": glow.name,
            "glow_material": glow.data.materials[0].name,
            "position_gltf": b2g(anchor.matrix_world.translation),
            "facing_gltf": fwd_gltf(anchor, (0, -1, 0)),
            "camera_anchor": cam.name,
            "camera_position_gltf": b2g(cam_pos),
            "camera_look_at_gltf": b2g(look_at),
        }
        for (i, ang, plinth, anchor, cam, glow, pos, look_at, cam_pos) in stations
    ],
    "notes": [
        "Station_n sits on the plinth top; its facing_gltf (node local +Z in glTF) points at the arc centre, "
        "where the camera spline runs. Stations run 1..6 left to right seen from the open side.",
        "CamAnchor_n: suggested camera spline point per station (looks at the station, -Z forward like a "
        "three.js camera). The spline order is 1..6.",
        "Each StationGlow_n has its own material StationGlow_n so stations can light up one at a time.",
        "Ceiling panels share the CeilingLight material; set emissiveIntensity in-app. No lights are exported.",
    ],
    "nodes": [{"name": ob.name, "parent": ob.parent.name if ob.parent else None,
               "type": ob.type.lower(), "position_gltf": b2g(ob.matrix_world.translation),
               **({"tris": tris[ob.name]} if ob.type == "MESH" else {})}
              for ob in sorted(coll.objects, key=lambda o: o.name)],
}
write_json(os.path.join(EXPORT_DIR, "lab_shell.manifest.json"), manifest)
print("lab tris", manifest["tris_total"], "bounds", manifest["bounds_gltf"])
