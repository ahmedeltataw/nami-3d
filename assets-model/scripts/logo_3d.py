"""Build logo_3d.blend and export/logo_3d.glb + manifest (card M4-09).

Source: public/brand/logo.svg (1300 x 444 px), imported with Blender's SVG importer, so the
outlines are the real logo paths. Parts of the SVG:
  - hex mark (2 paths, green gradient #009F6F -> #11B14E)  -> LogoMark, solid #009F6F
  - "nami" wordmark (4 paths, #232323)                       -> LogoWordmark
  - sparkle on the i (7 paths, #F9B233)                     -> LogoAccent
  - tagline under the wordmark (22 paths, #232323)          -> LogoTagline (flat, no bevel)
  - LogoProxy: one flat low-poly mesh of the front face (mark + wordmark + accent) for particle sampling.
Scale: the SVG width (1300 px) = LOGO_WIDTH units. The logo stands upright, front facing -Y (glTF +Z).
"""
import importlib
import os
import sys

import bpy
from mathutils import Matrix, Vector

# run with exec(src, {"__file__": path}) so the helpers resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

importlib.reload(common)
from common import (CHARCOAL, EXPORT_DIR, GREEN, ROOT_DIR, b2g, empty_object, export_glb,  # noqa: E402
                    make_material, new_scene, tri_count, write_json)

SVG = os.path.normpath(os.path.join(ROOT_DIR, "..", "public", "brand", "logo.svg"))
LOGO_WIDTH = 4.0
DEPTH = 0.16          # extrusion of mark / wordmark / accent
TAG_DEPTH = 0.04
BEVEL = 0.012
RES = 4               # curve resolution: keeps the tri count low, still smooth at this size

scene = new_scene()
win = bpy.context.window_manager.windows[0]
with bpy.context.temp_override(window=win, screen=win.screen):
    bpy.ops.import_curve.svg(filepath=SVG)

curves = [ob for ob in bpy.data.objects if ob.type == "CURVE"]
xs = [(ob.matrix_world @ Vector(c)).x for ob in curves for c in ob.bound_box]
svg_w = max(xs) - min(xs)
s = LOGO_WIDTH / svg_w


def kind(ob):
    mat = ob.data.materials[0] if len(ob.data.materials) and ob.data.materials[0] else None
    if mat is None:
        return "mark"
    if mat.diffuse_color[0] > 0.5:
        return "accent"
    top = max((ob.matrix_world @ Vector(c)).y for c in ob.bound_box)
    return "tagline" if top < 0.02 else "wordmark"


groups = {"mark": [], "wordmark": [], "accent": [], "tagline": []}
for ob in curves:
    groups[kind(ob)].append(ob)

coll = bpy.data.collections.new("Logo_3D")
scene.collection.children.link(coll)
m_green = make_material("Logo_Green", GREEN, roughness=0.35, metallic=0.1)
m_char = make_material("Logo_Charcoal", (0x23 / 255, 0x23 / 255, 0x23 / 255), roughness=0.45)
m_yellow = make_material("Logo_Yellow", (0xF9 / 255, 0xB2 / 255, 0x33 / 255), roughness=0.4,
                         emission_srgb=(0xF9 / 255, 0xB2 / 255, 0x33 / 255), emission_strength=0.6)
m_proxy = make_material("LogoProxy_Hidden", GREEN, roughness=1.0)


def vert_bounds(obs):
    """World bounds from the vertices (bound_box goes stale after direct vertex edits)."""
    pts = [ob.matrix_world @ v.co for ob in obs for v in ob.data.vertices]
    return (Vector([min(p[i] for p in pts) for i in range(3)]),
            Vector([max(p[i] for p in pts) for i in range(3)]))


def select_only(obs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]


def ctx():
    return bpy.context.temp_override(window=win, screen=win.screen)


def build(name, obs, depth, bevel, mat, res=RES):
    with ctx():
        select_only(obs)
        if len(obs) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = name
        cu = ob.data
        cu.dimensions = "2D"
        cu.fill_mode = "BOTH" if depth > 0 else "FRONT"
        cu.resolution_u = res
        # transform_apply(scale) on a curve also rescales later extrude values in Blender 5.3, so the curve
        # stays at SVG import size here and the mesh is scaled after conversion
        k = s
        cu.extrude = max(depth / 2 - bevel, 0.0) / k
        cu.bevel_depth = bevel / k
        cu.bevel_resolution = 1 if bevel > 0 else 0
        cu.offset = -bevel / k  # keep the outline at the true logo edge
        cu.materials.clear()
        cu.materials.append(mat)
        bpy.ops.object.convert(target="MESH")
    ob = bpy.data.objects[name]
    ob.data.transform(Matrix.Diagonal((s, s, s, 1.0)))
    ob.location = ob.location * s
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)
    return ob


# proxy first, from copies of the front-face curves
proxy_src = []
for ob in groups["mark"] + groups["wordmark"] + groups["accent"]:
    c = ob.copy()
    c.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(c)
    proxy_src.append(c)
proxy = build("LogoProxy", proxy_src, 0.0, 0.0, m_proxy, res=2)
proxy.data.materials.clear()
proxy.data.materials.append(m_proxy)

mark = build("LogoMark", groups["mark"], DEPTH, BEVEL, m_green)
word = build("LogoWordmark", groups["wordmark"], DEPTH, BEVEL, m_char)
accent = build("LogoAccent", groups["accent"], DEPTH, 0.0, m_yellow, res=2)
tag = build("LogoTagline", groups["tagline"], TAG_DEPTH, 0.0, m_char, res=1)

# stand the logo up (front -> -Y), centre it on the mark + wordmark bounds, bake transforms into the mesh
parts = [mark, word, accent, tag, proxy]
for ob in parts:
    ob.data.name = ob.name
bpy.context.view_layer.update()
mn, mx = vert_bounds([mark, word, accent])
centre = (mn + mx) / 2
for ob in parts:
    me = ob.data
    for v in me.vertices:
        p = ob.matrix_world @ v.co - Vector((centre.x, centre.y, 0))
        v.co = Vector((p.x, -p.z, p.y))  # SVG plane XY -> XZ, extrusion +Z -> -Y (front)
    ob.matrix_world = Matrix.Identity(4)
    me.update()

# the remap (x, y, z) -> (x, -z, y) is a rotation, so normals stay outward. Put the proxy on the front face.
front_y = -DEPTH / 2
for v in proxy.data.vertices:
    v.co.y = front_y
proxy.data.update()
# make sure the proxy faces the front (-Y)
if sum(p.normal.y for p in proxy.data.polygons) > 0:
    proxy.data.flip_normals()

# per-part pivots at their own centres (handy for intro animations)
root = empty_object("Logo3D", coll, size=1.0)
root["nami_role"] = "logo_root"
for ob in parts:
    pmn, pmx = vert_bounds([ob])
    pc = (pmn + pmx) / 2
    ob.data.transform(Matrix.Translation(-pc))
    ob.location = pc
    ob.parent = root
    for p in ob.data.polygons:
        p.use_smooth = False
proxy["nami_role"] = "particle_sample_surface"

# leftovers from the import
for ob in list(bpy.data.objects):
    if ob.type == "CURVE":
        bpy.data.objects.remove(ob)
for c in list(bpy.data.collections):
    if c.name != "Logo_3D" and not c.objects and not c.children:
        bpy.data.collections.remove(c)

# preview (not exported)
prev = bpy.data.collections.new("Preview")
scene.collection.children.link(prev)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.8, 0.82, 0.84, 1)
bg.inputs[1].default_value = 0.7
for name, loc, energy in (("Key", (3, -6, 4), 900), ("Fill", (-5, -4, 1), 300)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = 4
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    prev.objects.link(lo)
    lo.rotation_euler = (lo.location * -1).to_track_quat("-Z", "Y").to_euler()
proxy.hide_render = True
proxy.hide_set(True)

bpy.context.view_layer.update()
os.makedirs(EXPORT_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "logo_3d.blend"))
proxy.hide_set(False)  # hidden objects still export (no visibility filter), keep the file state honest
export_glb("Logo_3D", os.path.join(EXPORT_DIR, "logo_3d.glb"))

bpy.context.view_layer.update()
tris = {ob.name: tri_count(ob) for ob in parts}
mn, mx = vert_bounds(parts)
manifest = {
    "file": "logo_3d.glb",
    "source": "public/brand/logo.svg -> assets-model/logo_3d.blend (built by assets-model/scripts/logo_3d.py)",
    "scale": f"SVG width 1300 px = {LOGO_WIDTH} units (1 unit = {1300 / LOGO_WIDTH:.0f} SVG px); "
             f"robot is 3.38 units tall",
    "axes": "glTF +Y up; logo front faces +Z. Root Logo3D origin = centre of mark + wordmark.",
    "depth": DEPTH,
    "tris_total": sum(tris.values()),
    "tris_visible": sum(v for k, v in tris.items() if k != "LogoProxy"),
    "bounds_gltf": {"min": b2g((mn.x, mx.y, mn.z)), "max": b2g((mx.x, mn.y, mx.z))},
    "textures": "none",
    "notes": [
        "LogoProxy is a flat, low-poly copy of the front face (mark + wordmark + accent) sitting exactly on the "
        "front plane. Set visible = false in the app and sample it (MeshSurfaceSampler) for particles.",
        "The SVG mark uses a #009F6F -> #11B14E gradient; the 3D mark is solid #009F6F. The wordmark and tagline "
        "keep the SVG #232323 and the sparkle keeps #F9B233. Retint Logo_Charcoal for dark backgrounds.",
        "Each part's pivot is its own bounds centre.",
    ],
    "nodes": [{"name": ob.name, "parent": ob.parent.name if ob.parent else None,
               "pivot_gltf": b2g(ob.matrix_world.translation),
               **({"tris": tris[ob.name], "materials": [m.name for m in ob.data.materials]}
                  if ob.type == "MESH" else {})}
              for ob in [root] + parts],
}
write_json(os.path.join(EXPORT_DIR, "logo_3d.manifest.json"), manifest)
print("logo tris", tris, "bounds", manifest["bounds_gltf"])
