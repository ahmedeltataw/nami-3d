"""Shared helpers for the NAMI environment asset scripts (Blender 5.3).

Run the asset scripts from Blender:  exec(open(r"<path>/portal_gate.py").read())
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPTS_DIR)
EXPORT_DIR = os.path.join(ROOT_DIR, "export")

GREEN = (0x00 / 255, 0x9F / 255, 0x6F / 255)
CHARCOAL = (0x1B / 255, 0x1D / 255, 0x20 / 255)


def srgb_to_linear(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def new_scene():
    bpy.ops.wm.read_homefile(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def make_material(name, color_srgb, roughness=0.4, metallic=0.0, emission_srgb=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    lin = srgb_to_linear(color_srgb)
    bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission_srgb is not None:
        bsdf.inputs["Emission Color"].default_value = (*srgb_to_linear(emission_srgb), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = (*lin, 1.0)
    return mat


def mesh_object(name, bm, materials, collection, parent=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for m in materials:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def empty_object(name, collection, parent=None, location=(0, 0, 0), size=0.5, display="PLAIN_AXES"):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = display
    ob.empty_display_size = size
    ob.location = location
    collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def sweep_profile(bm, profile, a0, a1, steps, axis="Y", mat_index=0, closed_profile=True, cap=True,
                  center=(0, 0, 0)):
    """Revolve a 2D profile [(r, h), ...] around an axis between angles a0..a1 (radians).

    axis "Y": ring lies in the XZ plane (vertical gate facing -Y), h is the Y offset.
    axis "Z": ring lies in the XY plane (floor ring), h is the Z offset.
    Profile winding: counter-clockwise in (r, h) gives outward normals.
    """
    full = abs(abs(a1 - a0) - 2 * math.pi) < 1e-6
    n_ang = steps if full else steps + 1
    uv_layer = bm.loops.layers.uv.verify()
    cx, cy, cz = center
    rings = []
    for i in range(n_ang):
        t = i / steps
        a = a0 + (a1 - a0) * t
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for (r, h) in profile:
            if axis == "Y":
                co = (cx + r * ca, cy + h, cz + r * sa)
            else:
                co = (cx + r * ca, cy + r * sa, cz + h)
            ring.append(bm.verts.new(co))
        rings.append(ring)
    np_ = len(profile)
    seg_count = np_ if closed_profile else np_ - 1
    faces = []
    n_rows = steps
    for i in range(n_rows):
        r0 = rings[i]
        r1 = rings[(i + 1) % n_ang]
        for j in range(seg_count):
            j1 = (j + 1) % np_
            f = bm.faces.new((r0[j], r0[j1], r1[j1], r1[j]))
            f.material_index = mat_index
            us = (i / steps, (i + 1) / steps)
            vs = (j / seg_count, (j + 1) / seg_count)
            for loop, uv in zip(f.loops, ((us[0], vs[0]), (us[0], vs[1]), (us[1], vs[1]), (us[1], vs[0]))):
                loop[uv_layer].uv = uv
            faces.append(f)
    if cap and not full and closed_profile:
        for ring, rev in ((rings[0], False), (rings[-1], True)):
            vs = list(reversed(ring)) if rev else ring
            f = bm.faces.new(vs)
            f.material_index = mat_index
            for loop in f.loops:
                loop[uv_layer].uv = (0.5, 0.5)
            faces.append(f)
    return faces


def fix_normals_outward(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)


def tri_count(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    ev.to_mesh_clear()
    return n


def b2g(v):
    """Blender (x, y, z) -> glTF (x, z, -y)."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def world_bounds(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for ob in objects:
        if ob.type != "MESH":
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    return mn, mx


def export_glb(collection_name, path):
    layer_coll = bpy.context.view_layer.layer_collection.children[collection_name]
    bpy.context.view_layer.active_layer_collection = layer_coll
    # read_homefile leaves the script context without a window; the exporter needs one
    win = bpy.context.window_manager.windows[0]
    with bpy.context.temp_override(window=win, screen=win.screen):
        _gltf(path)


def _gltf(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_active_collection=True,
        use_active_collection_with_nested=True,
        export_yup=True,
        export_apply=True,
        export_lights=False,
        export_cameras=False,
        export_extras=True,
        export_animations=False,
    )


def write_json(path, data):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
