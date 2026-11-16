"""Build portal_gate.blend and export/portal_gate.glb + manifest (card M2-01).

Blender: Z up, gate in the XZ plane, front faces -Y (same as the robot).
glTF:    Y up, front faces +Z. Rings spin about their local Blender Y = glTF Z.
Every ring node has its origin at the ring centre, so node rotation spins it in place.
"""
import importlib
import math
import os
import sys

import bmesh
import bpy

# run with exec(src, {"__file__": path}) so the helpers resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

importlib.reload(common)
from common import (CHARCOAL, EXPORT_DIR, GREEN, ROOT_DIR, b2g, empty_object, export_glb,  # noqa: E402
                    fix_normals_outward, make_material, mesh_object, new_scene, sweep_profile,
                    tri_count, world_bounds, write_json)

OUTER_SEGMENTS = 10
SEG_GAP_DEG = 3.0
R_OUT_IN, R_OUT_OUT, OUT_HALF_DEPTH = 1.95, 2.25, 0.20
R_IN_IN, R_IN_OUT, IN_HALF_DEPTH = 1.62, 1.82, 0.12
R_CH_IN, R_CH_OUT, CH_HALF_DEPTH = 1.855, 1.915, 0.05
R_SURFACE = 1.66

scene = new_scene()
coll = bpy.data.collections.new("Portal_Gate")
scene.collection.children.link(coll)

m_white = make_material("Shell_White", (0.93, 0.94, 0.95), roughness=0.32)
m_charcoal = make_material("Charcoal", CHARCOAL, roughness=0.45, metallic=0.4)
m_green = make_material("Accent_Green", GREEN, roughness=0.3, emission_srgb=GREEN, emission_strength=4.0)
m_channel = make_material("LightChannel", GREEN, roughness=0.3, emission_srgb=GREEN, emission_strength=6.0)
m_surface = make_material("PortalSurface", CHARCOAL, roughness=0.2, emission_srgb=GREEN, emission_strength=0.3)


def chamfer_rect(r0, r1, h0, h1, c):
    return [(r0 + c, h0), (r1 - c, h0), (r1, h0 + c), (r1, h1 - c),
            (r1 - c, h1), (r0 + c, h1), (r0, h1 - c), (r0, h0 + c)]


def rect(r0, r1, h0, h1):
    return [(r0, h0), (r1, h0), (r1, h1), (r0, h1)]


root = empty_object("PortalGate", coll, size=2.6, display="CIRCLE")
root["nami_role"] = "portal_root"

outer = empty_object("OuterRing", coll, parent=root, size=0.4)
outer["nami_role"] = "ring_group"
inner = empty_object("InnerRing", coll, parent=root, size=0.4)
inner["nami_role"] = "ring_group"

seg_span = 360.0 / OUTER_SEGMENTS
segments = []
for i in range(OUTER_SEGMENTS):
    mid = 90.0 - i * seg_span  # segment 1 at the top, then clockwise seen from the front
    a0 = math.radians(mid - (seg_span - SEG_GAP_DEG) / 2)
    a1 = math.radians(mid + (seg_span - SEG_GAP_DEG) / 2)
    bm = bmesh.new()
    sweep_profile(bm, chamfer_rect(R_OUT_IN, R_OUT_OUT, -OUT_HALF_DEPTH, OUT_HALF_DEPTH, 0.045), a0, a1, 10,
                  mat_index=0)
    # green inset strips, front and back; embedded 1 cm so no face is coplanar with the shell
    ia0, ia1 = a0 + math.radians(2.0), a1 - math.radians(2.0)
    sweep_profile(bm, rect(2.05, 2.15, -OUT_HALF_DEPTH - 0.015, -OUT_HALF_DEPTH + 0.01), ia0, ia1, 10, mat_index=1)
    sweep_profile(bm, rect(2.05, 2.15, OUT_HALF_DEPTH - 0.01, OUT_HALF_DEPTH + 0.015), ia0, ia1, 10, mat_index=1)
    # charcoal inner lip
    sweep_profile(bm, rect(R_OUT_IN - 0.03, R_OUT_IN + 0.01, -0.13, 0.13), a0 + 0.01, a1 - 0.01, 10, mat_index=2)
    fix_normals_outward(bm)
    ob = mesh_object(f"OuterSeg_{i + 1:02d}", bm, [m_white, m_green, m_charcoal], coll, parent=outer)
    ob["nami_role"] = "outer_segment"
    ob["mid_angle_deg"] = mid
    segments.append((ob, mid))

connectors = []
for i in range(OUTER_SEGMENTS):
    mid = 90.0 - i * seg_span - seg_span / 2  # in the gaps between segments
    half = math.radians(2.6)
    bm = bmesh.new()
    sweep_profile(bm, chamfer_rect(R_OUT_IN - 0.05, R_OUT_OUT + 0.05, -0.15, 0.15, 0.03),
                  math.radians(mid) - half, math.radians(mid) + half, 2, mat_index=0)
    fix_normals_outward(bm)
    ob = mesh_object(f"Connector_{i + 1:02d}", bm, [m_charcoal], coll, parent=outer)
    ob["nami_role"] = "connector"
    ob["mid_angle_deg"] = mid
    connectors.append((ob, mid))

# inner ring: one continuous charcoal band with 24 green notches on both faces
bm = bmesh.new()
sweep_profile(bm, chamfer_rect(R_IN_IN, R_IN_OUT, -IN_HALF_DEPTH, IN_HALF_DEPTH, 0.03), 0, 2 * math.pi, 120,
              mat_index=0)
for k in range(24):
    a = math.radians(k * 15.0)
    w = math.radians(1.6 if k % 6 else 3.2)
    for h0, h1 in ((-IN_HALF_DEPTH - 0.012, -IN_HALF_DEPTH + 0.01), (IN_HALF_DEPTH - 0.01, IN_HALF_DEPTH + 0.012)):
        sweep_profile(bm, rect(1.67, 1.77, h0, h1), a - w, a + w, 1, mat_index=1)
fix_normals_outward(bm)
inner_body = mesh_object("InnerRing_Body", bm, [m_charcoal, m_green], coll, parent=inner)
inner_body["nami_role"] = "inner_ring"

channels = []
for k in range(4):
    mid = 45.0 + 90.0 * k
    bm = bmesh.new()
    sweep_profile(bm, rect(R_CH_IN, R_CH_OUT, -CH_HALF_DEPTH, CH_HALF_DEPTH),
                  math.radians(mid - 32), math.radians(mid + 32), 16, mat_index=0)
    fix_normals_outward(bm)
    ob = mesh_object(f"LightChannel_{k + 1}", bm, [m_channel], coll, parent=root)
    ob["nami_role"] = "light_channel"
    ob["mid_angle_deg"] = mid
    channels.append((ob, mid))

# portal surface: flat disc in the gate plane, facing -Y, planar UV 0-1
bm = bmesh.new()
uv = bm.loops.layers.uv.verify()
n = 64
center = bm.verts.new((0, 0, 0))
rim = [bm.verts.new((R_SURFACE * math.cos(2 * math.pi * k / n), 0, R_SURFACE * math.sin(2 * math.pi * k / n)))
       for k in range(n)]
for k in range(n):
    f = bm.faces.new((center, rim[(k + 1) % n], rim[k]))
    for loop in f.loops:
        co = loop.vert.co
        loop[uv].uv = (0.5 + co.x / (2 * R_SURFACE), 0.5 + co.z / (2 * R_SURFACE))
bm.normal_update()
bm.faces.ensure_lookup_table()
if bm.faces[0].normal.y > 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
surface = mesh_object("PortalSurface", bm, [m_surface], coll, parent=root)
surface["nami_role"] = "portal_surface"

for ob in coll.objects:
    if ob.type == "MESH":
        for p in ob.data.polygons:
            p.use_smooth = False

# ---------------------------------------------------------------- preview (not exported)
prev = bpy.data.collections.new("Preview")
scene.collection.children.link(prev)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.02, 0.022, 0.025, 1)
bg.inputs[1].default_value = 1.0
for name, loc, energy in (("Key", (3, -6, 4), 800), ("Fill", (-5, -4, 1), 300), ("Rim", (0, 5, 3), 400)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = 3
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    prev.objects.link(lo)
    lo.rotation_euler = (lo.location * -1).to_track_quat("-Z", "Y").to_euler()

# ---------------------------------------------------------------- save, export, manifest
os.makedirs(EXPORT_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "portal_gate.blend"))
glb_path = os.path.join(EXPORT_DIR, "portal_gate.glb")
export_glb("Portal_Gate", glb_path)

meshes = [ob for ob in coll.objects if ob.type == "MESH"]
tris = {ob.name: tri_count(ob) for ob in meshes}
mn, mx = world_bounds(meshes)


def node(ob, extra=None):
    d = {"name": ob.name, "parent": ob.parent.name if ob.parent else None,
         "pivot_gltf": b2g(ob.matrix_world.translation)}
    if ob.type == "MESH":
        d["tris"] = tris[ob.name]
        d["materials"] = [m.name for m in ob.data.materials]
    if extra:
        d.update(extra)
    return d


spin = {"rotation_axis_gltf": "local Z (+Z points out of the gate front)", "rotation_axis_blender": "local Y"}
manifest = {
    "file": "portal_gate.glb",
    "source": "assets-model/portal_gate.blend (built by assets-model/scripts/portal_gate.py)",
    "units": "Blender units, same as the robot (robot is 3.38 units tall)",
    "axes": "glTF +Y up; gate front faces +Z (toward a default three.js camera)",
    "outer_diameter": round(2 * R_OUT_OUT, 3),
    "root_note": "PortalGate origin = ring centre. Place it about 2.4 units above the floor for the bottom to clear it.",
    "tris_total": sum(tris.values()),
    "bounds_gltf": {"min": b2g((mn.x, mx.y, mn.z)), "max": b2g((mx.x, mn.y, mx.z))},
    "animation": {
        "OuterRing": {**spin, "spin": "clockwise seen from the front = negative rotation.z"},
        "InnerRing": {**spin, "spin": "counter-clockwise seen from the front = positive rotation.z"},
        "segments": "OuterSeg_01 is at the top; numbers run clockwise seen from the front. Each segment's "
                    "mid_angle_deg (in extras) is measured from glTF +X toward +Y. For the stagger assembly, "
                    "offset each segment along its radial direction (cos a, sin a, 0) or rotate it about Z; "
                    "its origin is the ring centre.",
        "light_channels": "LightChannel_1..4 share the 'LightChannel' material; drive emissiveIntensity on it.",
        "portal_surface": "PortalSurface is a flat disc, radius %.2f, UV 0-1 planar (u = +X, v = +Y), "
                          "for a ShaderMaterial / render target." % R_SURFACE,
    },
    "materials": {
        "Shell_White": "base #EDEFF2-ish, rough 0.32",
        "Charcoal": "#1B1D20, metal 0.4, rough 0.45",
        "Accent_Green": "#009F6F emissive x4",
        "LightChannel": "#009F6F emissive x6",
        "PortalSurface": "#1B1D20 + faint green emissive, placeholder for the shader",
    },
    "nodes": [node(root), node(outer, spin), node(inner, spin)]
             + [node(o, {"mid_angle_deg": a}) for o, a in segments]
             + [node(o, {"mid_angle_deg": a}) for o, a in connectors]
             + [node(inner_body)]
             + [node(o, {"mid_angle_deg": a}) for o, a in channels]
             + [node(surface)],
}
write_json(os.path.join(EXPORT_DIR, "portal_gate.manifest.json"), manifest)
print("portal tris", manifest["tris_total"], "bounds", manifest["bounds_gltf"])
