"""Build phone_kit.blend and export/phone_kit.glb + manifest (card M3-02).

Scale: real phone proportions 6.5 x 14 x 0.8 (cm), scaled so the phone is PHONE_H = 1.2 units tall
(a hand-held prop next to the 3.38-unit robot; 1 unit = 11.67 cm). Scale the PhoneKit root in-app to change it.
Blender: Z up, the screen faces -Y. glTF: Y up, the screen faces +Z.
Every part is its own node with the pivot at its own centre; the root PhoneKit is the phone centre.
"""
import importlib
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# run with exec(src, {"__file__": path}) so the helpers resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

importlib.reload(common)
from common import (CHARCOAL, EXPORT_DIR, GREEN, ROOT_DIR, b2g, empty_object, export_glb,  # noqa: E402
                    fix_normals_outward, make_material, mesh_object, new_scene, tri_count, world_bounds,
                    write_json)

PHONE_H = 1.2
K = PHONE_H / 14.0
W, H, D = 6.5 * K, 14.0 * K, 0.8 * K      # 0.557 x 1.2 x 0.0686
R = 0.9 * K                                # corner radius
WALL = 0.12 * K                            # frame wall thickness
SEG = 12                                   # segments per corner

scene = new_scene()
coll = bpy.data.collections.new("Phone_Kit")
scene.collection.children.link(coll)

m_alu = make_material("Aluminium", (0.86, 0.87, 0.89), roughness=0.28, metallic=1.0)
m_white = make_material("Shell_White", (0.95, 0.955, 0.96), roughness=0.25)
m_char = make_material("Charcoal", CHARCOAL, roughness=0.45, metallic=0.2)
m_green = make_material("Accent_Green", GREEN, roughness=0.3, emission_srgb=GREEN, emission_strength=1.5)
m_glass = make_material("Glass", (0.06, 0.07, 0.08), roughness=0.04)
try:
    m_glass.surface_render_method = "BLENDED"
except (AttributeError, TypeError):
    pass
next(n for n in m_glass.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Alpha"].default_value = 0.18
m_display = make_material("Display", (0.0, 0.0, 0.0), roughness=0.2, emission_srgb=(0.0, 0.0, 0.0),
                          emission_strength=1.0)
m_lens = make_material("Lens", (0.02, 0.02, 0.025), roughness=0.05, metallic=0.5)
m_pcb = make_material("Board_Charcoal", (0.16, 0.18, 0.18), roughness=0.6)


def rr_outline(w, h, r, seg=SEG):
    """Rounded rectangle outline in (x, z), counter-clockwise seen from -Y."""
    pts = []
    for cx, cz, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0),
                       (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def prism(bm, outline, y0, y1, mat_index=0, uv_box=None):
    """Extrude an (x, z) outline between y0 and y1 (caps are n-gons, triangulated on export)."""
    uv = bm.loops.layers.uv.verify()
    front = [bm.verts.new((x, y0, z)) for x, z in outline]
    back = [bm.verts.new((x, y1, z)) for x, z in outline]
    faces = [bm.faces.new(front), bm.faces.new(list(reversed(back)))]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((front[i], front[j], back[j], back[i])))
    for f in faces:
        f.material_index = mat_index
        if uv_box:
            x0, x1, z0, z1 = uv_box
            for loop in f.loops:
                loop[uv].uv = ((loop.vert.co.x - x0) / (x1 - x0), (loop.vert.co.z - z0) / (z1 - z0))
    return faces


def ring(bm, outer, inner, y0, y1, mat_index=0):
    """Frame ring between two outlines with the same vertex count."""
    n = len(outer)
    of = [bm.verts.new((x, y0, z)) for x, z in outer]
    ob_ = [bm.verts.new((x, y1, z)) for x, z in outer]
    inf = [bm.verts.new((x, y0, z)) for x, z in inner]
    inb = [bm.verts.new((x, y1, z)) for x, z in inner]
    for i in range(n):
        j = (i + 1) % n
        for quad in ((of[i], of[j], ob_[j], ob_[i]), (inf[j], inf[i], inb[i], inb[j]),
                     (of[j], of[i], inf[i], inf[j]), (ob_[i], ob_[j], inb[j], inb[i])):
            bm.faces.new(quad).material_index = mat_index


def box(bm, center, size, mat_index=0):
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, verts=res["verts"],
                        matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1.0)))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat_index


def cylinder_y(bm, center, radius, depth, segs=24, mat_index=0):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=radius, radius2=radius, depth=depth)
    bmesh.ops.transform(bm, verts=res["verts"],
                        matrix=Matrix.Translation(center) @ Matrix.Rotation(math.radians(90), 4, "X"))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat_index


root = empty_object("PhoneKit", coll, size=0.3)
root["nami_role"] = "phone_root"
parts = {}


def part(name, bm, mats, explode_dir, explode_dist, order):
    """Create a part node with its pivot at its own bounds centre."""
    fix_normals_outward(bm)
    ob = mesh_object(name, bm, mats, coll, parent=root)
    pts = [v.co for v in ob.data.vertices]
    c = Vector([(min(p[i] for p in pts) + max(p[i] for p in pts)) / 2 for i in range(3)])
    ob.data.transform(Matrix.Translation(-c))
    ob.location = c
    for p in ob.data.polygons:
        p.use_smooth = False
    d = Vector(explode_dir).normalized()
    ob["nami_role"] = "phone_part"
    ob["assembled_position"] = b2g(c)
    ob["exploded_direction"] = b2g(d)
    ob["exploded_distance"] = explode_dist
    ob["assembly_order"] = order
    parts[name] = (ob, c, d, explode_dist, order)
    return ob


y_front, y_back = -D / 2, D / 2
outer = rr_outline(W, H, R)
inner = rr_outline(W - 2 * WALL, H - 2 * WALL, R - WALL)

# Frame: aluminium band (the green accent is the power button in Buttons)
bm = bmesh.new()
ring(bm, outer, inner, y_front + 0.004, y_back - 0.004, 0)
part("Frame", bm, [m_alu], (0, 0, 0), 0.0, 0)

# BackPlate: white glass back, sits in the frame's back opening
bm = bmesh.new()
prism(bm, rr_outline(W - 0.002, H - 0.002, R - 0.001), y_back - 0.0045, y_back, 0)
# small green brand dot
cylinder_y(bm, (0, y_back + 0.0004, -0.18), 0.022, 0.0012, 20, 1)
part("BackPlate", bm, [m_white, m_green], (0, 1, 0), 0.7, 6)

# Display: flat panel facing -Y with UV 0-1 over its bounds (for UI textures)
dw, dh, dr = W - 2 * WALL - 0.004, H - 2 * WALL - 0.004, R - WALL
bm = bmesh.new()
uv = bm.loops.layers.uv.verify()
dout = rr_outline(dw, dh, dr)
verts = [bm.verts.new((x, y_front + 0.0055, z)) for x, z in dout]
f = bm.faces.new(verts)
for loop in f.loops:
    loop[uv].uv = (loop.vert.co.x / dw + 0.5, loop.vert.co.z / dh + 0.5)
bmesh.ops.triangulate(bm, faces=[f])
bm.normal_update()
if sum(fc.normal.y for fc in bm.faces) > 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
ob = mesh_object("Display", bm, [m_display], coll, parent=root)
c = Vector((0, y_front + 0.0055, 0))
ob.data.transform(Matrix.Translation(-c))
ob.location = c
d = Vector((0, -1, 0))
ob["nami_role"] = "phone_part"
ob["assembled_position"], ob["exploded_direction"] = b2g(c), b2g(d)
ob["exploded_distance"], ob["assembly_order"] = 0.38, 7
parts["Display"] = (ob, c, d, 0.38, 7)

# Glass: front cover, slightly transparent, with a dark front-camera dot
bm = bmesh.new()
prism(bm, rr_outline(W - 0.002, H - 0.002, R - 0.001), y_front, y_front + 0.0034, 0)  # 0.0006 gap to the frame cap (no z-fight)
cylinder_y(bm, (0, y_front - 0.0003, H / 2 - 0.06), 0.012, 0.001, 16, 1)
part("Glass", bm, [m_glass, m_lens], (0, -1, 0), 0.6, 8)

# Battery: charcoal pack with a green label stripe
by = 0.005
bm = bmesh.new()
box(bm, (0, by, -0.13), (W - 0.16, 0.014, 0.56), 0)
box(bm, (0, by + 0.0075, -0.13), (W - 0.24, 0.002, 0.04), 1)
part("Battery", bm, [m_char, m_green], (-1, 0.25, -0.35), 0.6, 3)

# Board: logic board with chips
bm = bmesh.new()
box(bm, (0, by, 0.33), (W - 0.12, 0.006, 0.36), 0)
for (x, z, sx, sz) in ((-0.08, 0.38, 0.12, 0.12), (0.1, 0.4, 0.08, 0.06), (0.06, 0.25, 0.1, 0.05),
                       (-0.12, 0.22, 0.05, 0.08)):
    box(bm, (x, by - 0.0055, z), (sx, 0.005, sz), 1)
box(bm, (0.0, by - 0.0035, 0.31), (0.3, 0.001, 0.006), 2)   # green trace
part("Board", bm, [m_pcb, m_char, m_green], (1, 0.25, 0.45), 0.6, 2)

# CameraModule: raised island on the back, top-left seen from the back (= +X side from the front)
cx, cz = W / 2 - 0.13, H / 2 - 0.15
bm = bmesh.new()
isl = [(x + cx, z + cz) for x, z in rr_outline(0.2, 0.2, 0.05, 6)]
prism(bm, isl, y_back, y_back + 0.012, 0)
for (lx, lz) in ((-0.045, 0.045), (-0.045, -0.045), (0.045, 0.045)):
    cylinder_y(bm, (cx + lx, y_back + 0.0145, cz + lz), 0.034, 0.005, 24, 2)   # green ring
    cylinder_y(bm, (cx + lx, y_back + 0.016, cz + lz), 0.026, 0.006, 24, 1)    # lens
cylinder_y(bm, (cx + 0.045, y_back + 0.0135, cz - 0.045), 0.012, 0.003, 12, 3)  # flash
part("CameraModule", bm, [m_char, m_lens, m_green, m_white], (0, 1, 0.25), 0.8, 5)

# Speaker: bottom grille block
bm = bmesh.new()
box(bm, (0, by, -H / 2 + 0.07), (0.22, 0.02, 0.05), 0)
for k in range(6):
    box(bm, (-0.075 + 0.03 * k, by - 0.0105, -H / 2 + 0.07), (0.012, 0.002, 0.03), 1)
part("Speaker", bm, [m_char, m_green], (0, 0, -1), 0.4, 4)

# Buttons: power (+X, green) and volume rocker (-X)
bm = bmesh.new()
box(bm, (W / 2 + 0.003, 0, 0.18), (0.008, D * 0.45, 0.11), 0)
box(bm, (-W / 2 - 0.003, 0, 0.26), (0.008, D * 0.45, 0.18), 1)
part("Buttons", bm, [m_green, m_alu], (1, 0, 0), 0.35, 1)

# ---------------------------------------------------------------- preview (not exported)
prev = bpy.data.collections.new("Preview")
scene.collection.children.link(prev)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.75, 0.78, 0.8, 1)
bg.inputs[1].default_value = 0.8
for name, loc, energy in (("Key", (2, -3, 2), 150), ("Fill", (-3, -1, 0.5), 60), ("Back", (0, 3, 1), 80)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = 1.5
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    prev.objects.link(lo)
    lo.rotation_euler = (lo.location * -1).to_track_quat("-Z", "Y").to_euler()

bpy.context.view_layer.update()
os.makedirs(EXPORT_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "phone_kit.blend"))
export_glb("Phone_Kit", os.path.join(EXPORT_DIR, "phone_kit.glb"))

meshes = [p[0] for p in parts.values()]
tris = {ob.name: tri_count(ob) for ob in meshes}
mn, mx = world_bounds(meshes)
manifest = {
    "file": "phone_kit.glb",
    "source": "assets-model/phone_kit.blend (built by assets-model/scripts/phone_kit.py)",
    "scale": f"real 6.5 x 14 x 0.8 cm proportions, phone height = {PHONE_H} units "
             f"(1 unit = {14 / PHONE_H:.2f} cm); robot is 3.38 units tall. Scale PhoneKit in-app if needed.",
    "axes": "glTF +Y up; the screen faces +Z. PhoneKit origin = phone centre.",
    "size_units": [round(W, 4), round(H, 4), round(D, 4)],
    "tris_total": sum(tris.values()),
    "textures": "none",
    "bounds_gltf": {"min": b2g((mn.x, mx.y, mn.z)), "max": b2g((mx.x, mn.y, mx.z))},
    "explode": "exploded position = assembled_position + exploded_direction * exploded_distance (parent space, "
               "glTF units). assembly_order: 0 = Frame stays put, then parts fly in 1..8. The same values are "
               "in each node's extras.",
    "display": "Display is a flat panel facing +Z, UV 0-1 over its bounds (u = +X, v = +Y), material 'Display' "
               "is black with emissive 1.0 x black: set emissiveMap / map to the UI texture.",
    "glass": "Glass material has alpha 0.18 (alphaMode BLEND); the display shows through.",
    "parts": [
        {"name": n, "assembled_position": b2g(c), "exploded_direction": b2g(d), "exploded_distance": dist,
         "assembly_order": order, "tris": tris[n], "materials": [m.name for m in ob.data.materials]}
        for n, (ob, c, d, dist, order) in sorted(parts.items(), key=lambda kv: kv[1][4])
    ],
}
write_json(os.path.join(EXPORT_DIR, "phone_kit.manifest.json"), manifest)
print("phone tris", manifest["tris_total"], tris, manifest["bounds_gltf"])
