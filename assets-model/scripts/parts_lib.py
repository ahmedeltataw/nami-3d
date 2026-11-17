"""NAMI shared parts library (Workflow v2). Units: metres, Z up, Blender 5.3.

Every scene builds its props from these functions so look and names stay consistent:
    import parts_lib as P
    P.materials()
    P.glass_panel('S03_panel_cloud', 2.7, 3.2)
Parts are created at the origin, facing -Y (towards a camera on -Y), base at z=0.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

PALETTE = {
    'emerald': '#25F2B0', 'emerald_deep': '#19C37D', 'mint': '#7CFFD9', 'teal_bg': '#0E2F31',
    'teal_bg2': '#153D3F', 'floor': '#1A2A2C', 'metal_dark': '#1C3436', 'white': '#F4F7F7', 'daylight': '#BFD9E8',
}


def hex_rgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def _principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def _set(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def material(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0, alpha=1.0,
             transmission=0.0, coat=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = _principled(mat)
    _set(bsdf, 'Base Color', (*hex_rgb(color), 1))
    _set(bsdf, 'Metallic', metallic)
    _set(bsdf, 'Roughness', roughness)
    _set(bsdf, 'Alpha', alpha)
    _set(bsdf, 'Transmission Weight', transmission)
    _set(bsdf, 'Coat Weight', coat)
    if emission:
        _set(bsdf, 'Emission Color', (*hex_rgb(emission), 1))
        _set(bsdf, 'Emission Strength', strength)
    if alpha < 1.0 or transmission > 0:
        try:
            mat.surface_render_method = 'BLENDED'
        except (AttributeError, TypeError):
            pass
    return mat


def materials():
    """Shared named materials (names are the contract with the web runtime)."""
    return {
        'glass': material('M_Glass_Holo', '#1F6F60', roughness=0.04, alpha=0.32, emission='#25F2B0', strength=0.12),
        'glass_edge': material('M_Glass_Edge', '#6FE8C8', roughness=0.08, alpha=0.75, emission='#7CFFD9', strength=1.2),
        'header': material('M_Glass_Header', '#0F4A3E', roughness=0.1, alpha=0.7, emission='#19C37D', strength=0.6),
        'emerald': material('M_Emissive_Emerald', '#25F2B0', emission='#25F2B0', strength=8.0),
        'mint': material('M_Emissive_Mint', '#7CFFD9', emission='#7CFFD9', strength=5.0),
        'icon': material('M_Emissive_Icon', '#9CFFE0', emission='#7CFFD9', strength=6.0),
        'metal_dark': material('M_Metal_Dark', '#1C3436', metallic=0.85, roughness=0.32),
        'metal': material('M_Metal_Brushed', '#8E9C9E', metallic=1.0, roughness=0.3),
        'white': material('M_Plastic_White', '#F4F7F7', roughness=0.22, coat=0.6),
        'joint': material('M_Plastic_Dark', '#20282A', roughness=0.35),
        'floor': material('M_Floor_Gloss', '#1A2A2C', metallic=0.4, roughness=0.08),
        'wall': material('M_Wall_Teal', '#0E2F31', roughness=0.55),
        'wall2': material('M_Wall_Teal2', '#153D3F', metallic=0.3, roughness=0.4),
        'mullion': material('M_Mullion', '#22383A', metallic=0.7, roughness=0.35),
    }


def _obj(name, bm, mats, collection=None):
    me = bpy.data.meshes.get(name)
    if me:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def _bevel(ob, width, segments=3, angle=40):
    mod = ob.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = True
    return mod


def rrect(w, h, r, n=6):
    """Rounded rectangle outline in XZ, centred on origin, counter-clockwise."""
    r = min(r, w / 2 - 1e-3, h / 2 - 1e-3)
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def _slab(bm, pts, y0, y1, mat_index=0):
    """Extrude a closed XZ outline between y0 and y1 (y1 < y0 is the front)."""
    front = [bm.verts.new((x, y1, z)) for x, z in pts]
    back = [bm.verts.new((x, y0, z)) for x, z in pts]
    f = bm.faces.new(front)
    f.material_index = mat_index
    b = bm.faces.new(list(reversed(back)))
    b.material_index = mat_index
    n = len(pts)
    for i in range(n):
        s = bm.faces.new((front[i], back[i], back[(i + 1) % n], front[(i + 1) % n]))
        s.material_index = mat_index
    return f


def _frame(bm, outer, inner, y0, y1, mat_index):
    """Ring between two outlines with the same point count, extruded y0..y1."""
    n = len(outer)
    of = [bm.verts.new((x, y1, z)) for x, z in outer]
    inf = [bm.verts.new((x, y1, z)) for x, z in inner]
    ob = [bm.verts.new((x, y0, z)) for x, z in outer]
    ib = [bm.verts.new((x, y0, z)) for x, z in inner]
    for i in range(n):
        j = (i + 1) % n
        for quad in ((of[i], of[j], inf[j], inf[i]), (ob[j], ob[i], ib[i], ib[j]),
                     (of[j], of[i], ob[i], ob[j]), (inf[i], inf[j], ib[j], ib[i])):
            bm.faces.new(quad).material_index = mat_index


def card_materials():
    """Frosted holo card look from the S03 reference (owner note 2026-11-17: clear glass, little glow)."""
    glass = material('M_Card_Glass', '#A8EBDA', roughness=0.32, alpha=0.16, emission='#25F2B0', strength=0.05)
    nt = glass.node_tree
    bsdf = _principled(glass)
    # vertical gradient: a little more milky at the top, clearer at the bottom
    if 'CardGrad' not in nt.nodes:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        rng = nt.nodes.new('ShaderNodeMapRange')
        rng.name = 'CardGrad'
        rng.inputs['To Min'].default_value = 0.1
        rng.inputs['To Max'].default_value = 0.26
        nt.links.new(tc.outputs['Generated'], sep.inputs[0])
        nt.links.new(sep.outputs['Z'], rng.inputs['Value'])
        nt.links.new(rng.outputs['Result'], bsdf.inputs['Alpha'])
    edge = material('M_Card_Edge', '#DFFFF5', roughness=0.1, emission='#7CFFD9', strength=0.9)
    return glass, edge


def glass_panel(name, w, h, thickness=0.035, radius=0.1, edge=0.018, collection=None):
    """Thin frosted holo card: one glass sheet + a thin luminous edge rim (no header band).
    Origin at bottom centre, front faces -Y."""
    glass, edge_mat = card_materials()
    bm = bmesh.new()
    t = thickness
    _slab(bm, rrect(w - edge, h - edge, radius), t / 2, -t / 2, 0)
    _frame(bm, rrect(w, h, radius + edge / 2), rrect(w - 2 * edge, h - 2 * edge, max(radius - edge, 0.02)),
           t / 2 + 0.004, -t / 2 - 0.004, 1)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, h / 2))
    ob = _obj(name, bm, [glass, edge_mat], collection)
    _bevel(ob, 0.004, 2)
    return ob


def disc(bm, r, z0, z1, seg=96, mat_index=0, r_top=None):
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r_top or r, depth=z1 - z0)
    bmesh.ops.translate(bm, verts=geom['verts'], vec=(0, 0, (z0 + z1) / 2))
    for f in {f for v in geom['verts'] for f in v.link_faces}:
        f.material_index = mat_index


def ring(bm, R, r, z, seg=96, ring_seg=12, mat_index=0, scale_z=1.0):
    vs = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for j in range(ring_seg):
            b = 2 * math.pi * j / ring_seg
            row.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a),
                                     z + r * math.sin(b) * scale_z)))
        vs.append(row)
    for i in range(seg):
        for j in range(ring_seg):
            f = bm.faces.new((vs[i][j], vs[(i + 1) % seg][j], vs[(i + 1) % seg][(j + 1) % ring_seg],
                              vs[i][(j + 1) % ring_seg]))
            f.material_index = mat_index


def pedestal(name, r, collection=None):
    """Low stacked disc base with emerald ring; top at z=0.34."""
    M = materials()
    bm = bmesh.new()
    disc(bm, r, 0.0, 0.12, mat_index=0, r_top=r * 0.97)
    disc(bm, r * 0.86, 0.12, 0.26, mat_index=1)
    ring(bm, r * 0.9, 0.035, 0.2, mat_index=2)
    disc(bm, r * 0.7, 0.26, 0.34, mat_index=0)
    ring(bm, r * 0.72, 0.022, 0.335, mat_index=2)
    ob = _obj(name, bm, [M['metal_dark'], M['metal'], M['emerald']], collection)
    _bevel(ob, 0.01, 2)
    return ob


def platform(name, r, collection=None):
    """Central robot platform: three tiers, glowing rings, glossy top. Top at z=0.42."""
    M = materials()
    bm = bmesh.new()
    disc(bm, r, 0.0, 0.14, mat_index=0, r_top=r * 0.98)
    ring(bm, r * 0.985, 0.04, 0.1, mat_index=2)
    disc(bm, r * 0.9, 0.14, 0.3, mat_index=1)
    ring(bm, r * 0.88, 0.05, 0.3, mat_index=2, seg=128)
    disc(bm, r * 0.82, 0.3, 0.42, mat_index=3)
    ring(bm, r * 0.55, 0.03, 0.425, mat_index=4, seg=128)
    ring(bm, r * 0.35, 0.02, 0.425, mat_index=4, seg=96)
    ob = _obj(name, bm, [M['metal_dark'], M['metal'], M['emerald'], M['floor'], M['mint']], collection)
    _bevel(ob, 0.012, 2)
    return ob


def ceiling_ring(name, R, segments=14, collection=None):
    """Overhead ring: brushed metal band, dark inner lip, emerald light segments facing down."""
    M = materials()
    bm = bmesh.new()
    seg = 160
    w_band, h_band = 0.9, 0.5
    for k, (r0, r1, z0, z1, mi) in enumerate(((R - w_band / 2, R + w_band / 2, -h_band / 2, h_band / 2, 0),)):
        pass
    outer = [(math.cos(2 * math.pi * i / seg), math.sin(2 * math.pi * i / seg)) for i in range(seg)]

    def band(ra, rb, za, zb, mi):
        a = [bm.verts.new((ra * c, ra * s, za)) for c, s in outer]
        b = [bm.verts.new((rb * c, rb * s, za)) for c, s in outer]
        c_ = [bm.verts.new((rb * c, rb * s, zb)) for c, s in outer]
        d = [bm.verts.new((ra * c, ra * s, zb)) for c, s in outer]
        for i in range(seg):
            j = (i + 1) % seg
            for q in ((a[j], a[i], b[i], b[j]), (b[j], b[i], c_[i], c_[j]), (c_[j], c_[i], d[i], d[j]),
                      (d[j], d[i], a[i], a[j])):
                bm.faces.new(q).material_index = mi
    band(R - 0.55, R + 0.55, -0.3, 0.3, 0)
    band(R - 0.75, R - 0.55, -0.12, 0.12, 1)
    # emissive segments on the underside
    for k in range(segments):
        a0 = 2 * math.pi * k / segments + 0.04
        a1 = a0 + 2 * math.pi / segments * 0.62
        n = 10
        top = []
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            top.append((math.cos(a), math.sin(a)))
        v_in = [bm.verts.new(((R - 0.35) * c, (R - 0.35) * s, -0.31)) for c, s in top]
        v_out = [bm.verts.new(((R + 0.35) * c, (R + 0.35) * s, -0.31)) for c, s in top]
        v_in2 = [bm.verts.new(((R - 0.35) * c, (R - 0.35) * s, -0.36)) for c, s in top]
        v_out2 = [bm.verts.new(((R + 0.35) * c, (R + 0.35) * s, -0.36)) for c, s in top]
        for i in range(n):
            for q in ((v_in2[i], v_out2[i], v_out2[i + 1], v_in2[i + 1]), (v_in[i], v_in2[i], v_in2[i + 1], v_in[i + 1]),
                      (v_out2[i], v_out[i], v_out[i + 1], v_out2[i + 1])):
                bm.faces.new(q).material_index = 2
    ob = _obj(name, bm, [M['metal'], M['metal_dark'], M['emerald']], collection)
    _bevel(ob, 0.02, 2)
    return ob


def _capsule(bm, p0, p1, r, mi, seg=24):
    d = Vector(p1) - Vector(p0)
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r * 0.92, depth=d.length)
    rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, verts=geom['verts'], matrix=Matrix.Translation((Vector(p0) + Vector(p1)) / 2) @ rot)
    for f in {f for v in geom['verts'] for f in v.link_faces}:
        f.material_index = mi


def _joint(bm, p, r, axis, mi, w=None):
    a = Vector(axis).normalized()
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=r, radius2=r, depth=w or r * 1.4)
    rot = a.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, verts=geom['verts'], matrix=Matrix.Translation(p) @ rot)
    for f in {f for v in geom['verts'] for f in v.link_faces}:
        f.material_index = mi


def robot_arm(name, reach=2.6, collection=None):
    """Chunky industrial arm mounted on a wall bracket (mount at origin, arm reaching +X and down).
    3 visible joints (shoulder, elbow, wrist), white links, dark joints, emerald accent rings, gripper."""
    M = materials()
    bm = bmesh.new()
    s = reach / 2.6
    mount = Vector((0, 0, 0))
    shoulder = Vector((0.45 * s, 0, -0.1 * s))
    elbow = Vector((1.35 * s, 0, 0.55 * s))
    wrist = Vector((2.3 * s, 0, -0.15 * s))
    tip = Vector((2.55 * s, 0, -0.55 * s))
    # wall bracket
    b = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.25 * s, 0.6 * s, 0.7 * s), verts=b['verts'])
    for f in {f for v in b['verts'] for f in v.link_faces}:
        f.material_index = 1
    _capsule(bm, mount, shoulder, 0.16 * s, 0)
    _joint(bm, shoulder, 0.26 * s, (0, 1, 0), 1, 0.42 * s)
    _capsule(bm, shoulder, elbow, 0.19 * s, 0)
    _joint(bm, elbow, 0.22 * s, (0, 1, 0), 1, 0.38 * s)
    _capsule(bm, elbow, wrist, 0.15 * s, 0)
    _joint(bm, wrist, 0.16 * s, (0, 1, 0), 1, 0.3 * s)
    _capsule(bm, wrist, tip, 0.09 * s, 0)
    for p, r in ((shoulder, 0.27), (elbow, 0.23), (wrist, 0.17)):
        ring_geom = bmesh.new()
        ring_geom.free()
        _joint(bm, p + Vector((0, 0.22 * s, 0)) * (r / 0.27), r * s * 0.8, (0, 1, 0), 2, 0.03 * s)
    # gripper prongs
    for side in (-1, 1):
        _capsule(bm, tip, tip + Vector((0.12 * s, side * 0.12 * s, -0.25 * s)), 0.035 * s, 1)
    ob = _obj(name, bm, [M['white'], M['joint'], M['emerald']], collection)
    _bevel(ob, 0.015 * s, 2)
    return ob


def floor(name, size=60, collection=None):
    M = materials()
    bm = bmesh.new()
    g = bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    for f in bm.faces:
        f.material_index = 0
    return _obj(name, bm, [M['floor']], collection)
