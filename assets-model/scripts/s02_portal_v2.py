"""S02 "Break the Screen" portal scene (Workflow v2). Run inside Blender 5.3 with the
s02_portal_v2.blend open (it holds the camera CAM_S02_hero and the robot in REF).

Portal local frame: ring in the XZ plane, +Y goes into the tunnel, origin at the ring centre.
The root empty sits at PORTAL_CENTRE with yaw PORTAL_YAW (both fitted against the reference).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts_lib as P  # noqa: E402

PORTAL_CENTRE = (4.5, 10.5, 3.6)
PORTAL_YAW = -15.0
S03_BLEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 's03_lab_v2.blend')


def coll(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def clear(c):
    for o in list(c.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def mats():
    return {
        'gun': P.material('M_Metal_Gunmetal', '#5E6B6E', metallic=0.9, roughness=0.3),
        'plate': P.material('M_Metal_Plate', '#B4C0C2', metallic=1.0, roughness=0.24),
        'dark': P.material('M_Metal_Dark', '#1C3436', metallic=0.85, roughness=0.32),
        'emerald': P.material('M_Emissive_Emerald', '#22F08C', emission='#12E85E', strength=2.2),
        'mint': P.material('M_Emissive_Mint', '#5CFF96', emission='#3CFA7C', strength=1.5),
        'warm': P.material('M_Emissive_Warm', '#FFE2B0', emission='#FFD9A0', strength=4.0),
        'core': P.material('M_Emissive_Core', '#B8FFD0', emission='#6CFF9C', strength=3.8),
        'floor_ring': P.material('M_Emissive_FloorRing', '#22F08C', emission='#12E85E', strength=0.9),
        'logo': P.material('M_Emissive_Logo', '#5CFF9E', emission='#1EEB6A', strength=1.0),
    }


# ---------- geometry helpers (local portal frame) ----------

def _arc_block(bm, r0, r1, a0, a1, y0, y1, mi, seg=6, chamfer=0.0):
    """Annular sector block between radii r0..r1, angles a0..a1 (deg), depth y0..y1."""
    rows = []
    for k in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * k / seg)
        c, s = math.cos(a), math.sin(a)
        rf0, rf1 = r0 + chamfer, r1 - chamfer
        rows.append([
            bm.verts.new((r0 * c, y1, r0 * s)), bm.verts.new((r1 * c, y1, r1 * s)),
            bm.verts.new((rf1 * c, y0, rf1 * s)), bm.verts.new((rf0 * c, y0, rf0 * s)),
        ])
    for k in range(seg):
        a, b = rows[k], rows[k + 1]
        for j in range(4):
            f = bm.faces.new((a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]))
            f.material_index = mi
    for cap in (rows[0][::-1], rows[-1]):
        f = bm.faces.new(cap)
        f.material_index = mi


def _segmented_ring(bm, r0, r1, y0, y1, count, gap, mi, start=0.0, chamfer=0.0, skip=()):
    span = 360.0 / count
    for i in range(count):
        if i in skip:
            continue
        a0 = start + i * span + gap / 2
        _arc_block(bm, r0, r1, a0, a0 + span - gap, y0, y1, mi, seg=max(3, int(span / 4)), chamfer=chamfer)


def _obj(name, bm, m, c, parent, bevel=0.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = P._obj(name, bm, m, c)
    ob.parent = parent
    if bevel:
        P._bevel(ob, bevel, 2)
    return ob


# ---------- parts ----------

def build_portal(c):
    M = mats()
    root = bpy.data.objects.new('S02_portal', None)
    c.objects.link(root)
    root.location = PORTAL_CENTRE
    root.rotation_euler = (0, 0, math.radians(PORTAL_YAW))

    # outer housing: chunky gunmetal blocks with lighter inset plates
    bm = bmesh.new()
    _segmented_ring(bm, 6.6, 8.7, -0.7, 1.4, 14, 2.6, 0, start=90 - 360 / 28, chamfer=0.18, skip=(0,))
    _segmented_ring(bm, 6.85, 8.2, -0.82, -0.7, 28, 4.0, 1, start=90 - 360 / 56, skip=(0, 1))
    _obj('S02_portal_housing', bm, [M['gun'], M['plate']], c, root, bevel=0.03)

    # emissive inlays on the housing face: one strip per block, short bars on the sides
    bm = bmesh.new()
    _segmented_ring(bm, 7.35, 7.55, -0.86, -0.8, 14, 9.0, 0, start=90 - 360 / 28, skip=(0,))
    for a in (8, 172, 196, 344, 216, 324):
        _arc_block(bm, 8.0, 8.55, a - 1.2, a + 1.2, -0.76, -0.72, 1, seg=2)
    _obj('S02_portal_inlays', bm, [M['emerald'], M['warm']], c, root)

    # grey frame band (the ring that the blockout torus fitted)
    bm = bmesh.new()
    _segmented_ring(bm, 5.0, 6.45, -0.45, 1.1, 24, 1.2, 0, chamfer=0.08)
    _segmented_ring(bm, 5.75, 6.3, -0.52, -0.45, 24, 6.0, 1)
    _obj('S02_portal_frame', bm, [M['plate'], M['gun']], c, root, bevel=0.02)

    # main glow ring: thick emissive segments just inside the frame
    bm = bmesh.new()
    _segmented_ring(bm, 4.66, 4.86, -0.38, -0.2, 24, 2.2, 0, start=7.5)
    _segmented_ring(bm, 4.4, 5.0, -0.2, 0.9, 12, 1.4, 1, start=7.5, chamfer=0.06)
    _segmented_ring(bm, 4.32, 4.42, -0.25, -0.1, 36, 4.0, 2, start=3.0)
    _obj('S02_portal_glow', bm, [M['emerald'], M['plate'], M['mint']], c, root)

    # tunnel: rings recede along +Y and shrink; each has a metal band and an emissive lip
    tun = []
    for i, (y, r) in enumerate([(1.3, 4.1), (2.4, 3.95), (3.5, 3.82), (4.6, 3.7), (5.7, 3.6), (6.8, 3.52)]):
        bm = bmesh.new()
        n = 16 + 2 * i
        _segmented_ring(bm, r, r + 0.45, y, y + 0.75, n, 1.6, 0, start=i * 7.0, chamfer=0.05)
        _segmented_ring(bm, r - 0.06, r + 0.02, y - 0.02, y + 0.12, 6, 6.0 + 3 * i, 1, start=i * 23.0)
        tun.append(_obj('S02_tunnel_%d' % i, bm, [M['gun'], M['emerald'] if i % 2 == 0 else M['mint']],
                        c, root, bevel=0.015 if i < 2 else 0.0))
    # bright core ring a little inside the tunnel (the brightest ring in the reference)
    bm = bmesh.new()
    _segmented_ring(bm, 3.92, 4.12, 1.2, 1.5, 5, 2.5, 0, start=20.0)
    _obj('S02_portal_core_ring', bm, [M['core']], c, root)
    # tunnel sleeve so no gaps show the backdrop between rings
    bm = bmesh.new()
    _arc_block(bm, 3.95, 4.6, 0, 360, 0.9, 7.8, 0, seg=96)
    sleeve = _obj('S02_tunnel_sleeve', bm, [M['dark']], c, root)
    for s in sleeve.data.polygons:
        s.use_smooth = True

    # N emblem housing at the top of the frame
    bm = bmesh.new()
    _arc_block(bm, 3.6, 4.9, 79, 101, -0.9, 0.6, 0, seg=4, chamfer=0.18)
    _obj('S02_emblem_housing', bm, [M['gun']], c, root, bevel=0.04)
    logo = _logo(c, M)
    logo.parent = root
    logo.location = (0.0, -0.93, 4.22)
    return root


def _logo(c, M):
    name = 'S02_emblem_logo'
    cu = bpy.data.curves.get(name)
    if not cu:
        with bpy.data.libraries.load(S03_BLEND) as (src, dst):
            dst.curves = ['S03_platform_logo']
        cu = dst.curves[0]
        cu.name = name
    ob = bpy.data.objects.new(name, cu)
    c.objects.link(ob)
    cu.materials.clear()
    cu.materials.append(M['logo'])
    cu.extrude = 0.02
    ob.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    dim = max(ob.dimensions.x, ob.dimensions.y) or 1.0
    s = 1.2 / dim
    ob.scale = (s, s, s)
    ob.rotation_euler = (math.radians(90), 0, 0)
    return ob


TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'textures')
FLOOR_Z = -1.0


def _image_mat(name, file, strength):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEX, file), check_existing=True)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return mat


def build_lab(c, root):
    """Disc at the far end of the tunnel showing the Codex lab image (vanishing point at centre)."""
    R, y, img_h = 3.95, 7.6, 7.2
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    seg = 96
    centre = bm.verts.new((0, y, 0))
    ring_v = [bm.verts.new((R * math.cos(2 * math.pi * i / seg), y, R * math.sin(2 * math.pi * i / seg)))
              for i in range(seg)]
    img_w = img_h * 1672 / 941
    for i in range(seg):
        f = bm.faces.new((centre, ring_v[(i + 1) % seg], ring_v[i]))
        for loop in f.loops:
            co = loop.vert.co
            loop[uv].uv = (0.5 + co.x / img_w, 0.5 + co.z / img_h)
    ob = _obj('S02_lab_view', bm, [_image_mat('M_Lab_View', 's02_lab_portal.png', 1.25)], c, root)
    return ob


def build_floor(c, root):
    M = mats()
    fl = P.material('M_Floor_Gloss_S02', '#3A4E4D', metallic=0.5, roughness=0.16)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    ob = _obj('S02_floor', bm, [fl], c, None)
    ob.location = (0, 15, FLOOR_Z)
    # emissive rings on the floor in front of the portal (partial arcs, like the reference)
    bm = bmesh.new()
    for r, w, a0, a1 in [(1.9, 0.025, 0, 360), (2.7, 0.035, 150, 400), (3.7, 0.03, 170, 330),
                         (3.7, 0.03, 345, 380), (4.8, 0.04, 160, 380)]:
        _flat_arc(bm, r, w, a0, a1, 0)
    rings = _obj('S02_floor_rings', bm, [M['floor_ring']], c, None)
    rings.location = (4.3, 7.7, FLOOR_Z + 0.004)
    rings.scale = (1.0, 0.45, 1.0)
    return ob


def _flat_arc(bm, r, w, a0, a1, mi, seg=48):
    vs = []
    for k in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * k / seg)
        vs.append((bm.verts.new(((r - w) * math.cos(a), (r - w) * math.sin(a), 0)),
                   bm.verts.new(((r + w) * math.cos(a), (r + w) * math.sin(a), 0))))
    for k in range(seg):
        f = bm.faces.new((vs[k][0], vs[k][1], vs[k + 1][1], vs[k + 1][0]))
        f.material_index = mi


def build_backdrop(c):
    """Dark teal curved wall behind the robot with slanted emerald light bars (DOF blurs them)."""
    import random
    rnd = random.Random(7)
    wall = P.material('M_Wall_Teal_S02', '#1B4B4A', roughness=0.6, emission='#0E2F31', strength=0.25)
    bar = P.material('M_Emissive_Bar', '#22F08C', emission='#12E85E', strength=1.5)
    bm = bmesh.new()
    R, cx, cy = 22.0, 3.0, 4.0
    rows = []
    for k in range(25):
        a = math.radians(100 + 80 * k / 24)
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        rows.append((bm.verts.new((x, y, FLOOR_Z)), bm.verts.new((x, y, 16.0))))
    for k in range(24):
        bm.faces.new((rows[k][0], rows[k + 1][0], rows[k + 1][1], rows[k][1]))
    ob = _obj('S02_backdrop_wall', bm, [wall], c, None)
    bm = bmesh.new()
    for _ in range(11):
        a = math.radians(rnd.uniform(118, 168))
        z = rnd.uniform(1.0, 13.0)
        ln, w, tilt = rnd.uniform(0.8, 2.6), rnd.uniform(0.06, 0.14), math.radians(rnd.uniform(20, 40))
        p = Vector((cx + (R - 0.05) * math.cos(a), cy + (R - 0.05) * math.sin(a), z))
        t = Vector((-math.sin(a), math.cos(a), 0))
        d = (t * math.cos(tilt) + Vector((0, 0, 1)) * math.sin(tilt)) * ln / 2
        n = t.cross(Vector((0, 0, 1))).normalized()
        q = d.cross(n).normalized() * w / 2
        bm.faces.new([bm.verts.new(v) for v in (p - d - q, p + d - q, p + d + q, p - d + q)])
    _obj('S02_backdrop_bars', bm, [bar], c, None)
    return ob


def build_fx(c, root):
    """Static energy swirls inside the portal mouth (thin emissive ellipses, tilted)."""
    fx = P.material('M_FX_Swirl', '#C8FFDC', emission='#3CFA7C', strength=3.2)
    obs = []
    for i, (R, sx, tilt, spin, y) in enumerate([(3.7, 1.0, 12, 0, 0.6), (3.4, 0.82, -18, 40, 1.6),
                                                 (3.9, 0.9, 25, 110, 2.6)]):
        bm = bmesh.new()
        P.ring(bm, R, 0.022, 0.0, seg=128, ring_seg=6)
        ob = _obj('S02_fx_swirl_%d' % i, bm, [fx], c, root)
        ob.location = (0, y, -0.2)
        ob.rotation_euler = (math.radians(90 + tilt), math.radians(spin), 0)
        ob.scale = (1.0, sx, 1.0)
        obs.append(ob)
    return obs


LIGHTS = [  # name, type, location, rotation (deg), energy, colour, size
    ('L_key_left', 'AREA', (-3, 1, 9), (35, 0, -45), 1500, (0.85, 0.95, 1), 6),
    ('L_tunnel_inner', 'POINT', (5.6, 17.5, 3.4), (0, 0, 0), 400, (0.35, 1, 0.55), 1),
    ('L_rim_right', 'AREA', (13, 6, 7), (60, 0, 70), 500, (0.7, 0.9, 0.9), 5),
    ('L_amber_pool', 'POINT', (-1.0, 4.5, -0.5), (0, 0, 0), 400, (1, 0.6, 0.3), 1),
    ('L_floor_glow', 'AREA', (4.0, 7.5, 2.5), (0, 0, 0), 550, (0.35, 1, 0.55), 7),
]


def look():
    """Lights, world haze, colour management, bloom and DOF (measured pass1: all bands 91-119%)."""
    s = bpy.context.scene
    room = coll('S02_ROOM')
    for name, typ, loc, rot, energy, col, size in LIGHTS:
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o)
        d = bpy.data.lights.get(name) or bpy.data.lights.new(name, typ)
        d.energy, d.color = energy, col
        if typ == 'AREA':
            d.size = size
        o = bpy.data.objects.new(name, d)
        o.location, o.rotation_euler = loc, [math.radians(a) for a in rot]
        room.objects.link(o)
    w = s.world or bpy.data.worlds.new('W')
    s.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.012, 0.035, 0.034, 1)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_WORLD')
    vol = next((n for n in nt.nodes if n.type == 'VOLUME_PRINCIPLED'), None) or nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = 0.004
    vol.inputs['Color'].default_value = (0.3, 0.62, 0.4, 1)
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    try:
        s.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        pass
    s.eevee.use_raytracing = True
    s.view_settings.view_transform = 'Standard'
    s.view_settings.look = 'Medium High Contrast'
    s.view_settings.exposure = 0.0
    cam = bpy.data.objects['CAM_S02_hero'].data
    cam.dof.use_dof, cam.dof.focus_distance, cam.dof.aperture_fstop = True, 8.0, 1.0
    ng = s.compositing_node_group or bpy.data.node_groups.new('S02_comp', 'CompositorNodeTree')
    s.compositing_node_group = ng
    if not any(i.in_out == 'OUTPUT' for i in ng.interface.items_tree):
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    gl = next((n for n in ng.nodes if n.bl_idname == 'CompositorNodeGlare'), None)
    if gl is None:
        rl = ng.nodes.new('CompositorNodeRLayers')
        dn = ng.nodes.new('CompositorNodeDenoise')
        gl = ng.nodes.new('CompositorNodeGlare')
        go = ng.nodes.new('NodeGroupOutput')
        ng.links.new(rl.outputs['Image'], dn.inputs[0])
        ng.links.new(dn.outputs[0], gl.inputs[0])
        ng.links.new(gl.outputs[0], go.inputs[0])
    rl = next(n for n in ng.nodes if n.bl_idname == 'CompositorNodeRLayers')
    dn = next((n for n in ng.nodes if n.bl_idname == 'CompositorNodeDenoise'), None)
    vl = s.view_layers[0]
    vl.use_pass_normal = True
    vl.use_pass_diffuse_color = True
    if dn is not None:
        ng.links.new(rl.outputs['Normal'], dn.inputs['Normal'])
        ng.links.new(rl.outputs['Diffuse Color'], dn.inputs['Albedo'])
    s.eevee.volumetric_samples = 128
    s.eevee.volumetric_tile_size = '4'
    s.eevee.taa_render_samples = 128
    gl.inputs['Type'].default_value = 'Bloom'
    gl.inputs['Threshold'].default_value = 0.9
    gl.inputs['Strength'].default_value = 0.35
    gl.inputs['Size'].default_value = 0.6


def build():
    c = coll('S02_PROPS')
    clear(c)
    root = build_portal(c)
    build_lab(c, root)
    room = coll('S02_ROOM')
    for o in list(room.objects):
        if o.type != 'LIGHT':
            bpy.data.objects.remove(o, do_unlink=True)
    build_floor(room, root)
    clear(coll('BACKDROP'))
    build_backdrop(coll('BACKDROP'))
    fx = coll('FX')
    clear(fx)
    build_fx(fx, root)
    look()
    lay = bpy.data.collections.get('LAYOUT')
    if lay:
        lay.hide_render = True
        lay.hide_viewport = True
    return root


if __name__ == '__main__':
    build()
