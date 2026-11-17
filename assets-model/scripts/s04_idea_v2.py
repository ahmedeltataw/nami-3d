"""S04 "Idea to Reality" scene (Workflow v2). Run inside Blender 5.3 with s04_idea_v2.blend open
(camera CAM_S04_hero and the robot in REF, both fitted against the reference).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts_lib as P  # noqa: E402
from s02_portal_v2 import (_arc_block, _segmented_ring, _flat_arc, _image_mat, coll, clear,  # noqa: E402
                           TEX)

PLATFORM_R = 3.0


def _obj(name, bm, m, c, parent=None, bevel=0.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = P._obj(name, bm, m, c)
    ob.parent = parent
    if bevel:
        P._bevel(ob, bevel, 2)
    return ob


def mats():
    return {
        'dark': P.material('M_Metal_Dark', '#1C3436', metallic=0.85, roughness=0.32),
        'chrome': P.material('M_Metal_Chrome', '#C9D3D4', metallic=1.0, roughness=0.14),
        'top': P.material('M_Platform_Top', '#101C1D', metallic=0.6, roughness=0.12),
        'emerald': P.material('M_Emissive_Emerald', '#25F2B0', emission='#25F2B0', strength=2.0),
        'mint': P.material('M_Emissive_Mint', '#7CFFD9', emission='#7CFFD9', strength=1.4),
        'line': P.material('M_Holo_Line', '#C8FFF0', emission='#7CFFD9', strength=2.4),
        'gold': P.material('M_Phone_Frame', '#C8B48A', metallic=1.0, roughness=0.2),
        'black': P.material('M_Phone_Back', '#0B1414', metallic=0.4, roughness=0.25),
    }


# ---------- platform ----------

def _disc_z(bm, r, z0, z1, mi, seg=128, r_top=None):
    P.disc(bm, r, z0, z1, seg=seg, mat_index=mi, r_top=r_top)


def build_platform(c):
    M = mats()
    R = PLATFORM_R
    bm = bmesh.new()
    _disc_z(bm, R, 0.0, 0.1, 0, r_top=R * 0.99)
    _disc_z(bm, R * 0.95, 0.1, 0.36, 1)
    _disc_z(bm, R * 0.9, 0.36, 0.44, 2)
    _disc_z(bm, R * 0.6, 0.44, 0.47, 0)
    plat = _obj('S04_platform', bm, [M['dark'], M['chrome'], M['top']], c, bevel=0.01)
    # light slits on the chrome band and rings on top (all in one emissive object)
    bm = bmesh.new()
    for a0, a1 in [(200, 232), (238, 262), (268, 292), (298, 340), (20, 60), (120, 160)]:
        rows = []
        r = R * 0.95 + 0.012
        for k in range(9):
            a = math.radians(a0 + (a1 - a0) * k / 8)
            rows.append((bm.verts.new((r * math.cos(a), r * math.sin(a), 0.2)),
                         bm.verts.new((r * math.cos(a), r * math.sin(a), 0.26))))
        for k in range(8):
            bm.faces.new((rows[k][0], rows[k + 1][0], rows[k + 1][1], rows[k][1]))
    P.ring(bm, R * 0.62, 0.035, 0.475, seg=160, ring_seg=8)
    P.ring(bm, R * 0.9, 0.02, 0.445, seg=160, ring_seg=6)
    _obj('S04_platform_lights', bm, [M['emerald']], c)
    # glowing core disc where the beam starts
    bm = bmesh.new()
    _disc_z(bm, R * 0.5, 0.47, 0.48, 0)
    _obj('S04_platform_core', bm, [P.material('M_Platform_Core', '#7CFFD9', emission='#7CFFD9', strength=0.6)], c)
    # floor glow rings around the base
    bm = bmesh.new()
    _flat_arc(bm, R * 1.08, 0.03, 0, 360, 0, seg=160)
    fr = _obj('S04_floor_rings', bm, [P.material('M_Emissive_FloorRing', '#25F2B0', emission='#25F2B0',
                                                  strength=1.0)], c)
    fr.location.z = 0.004
    return plat


def build_beam(c):
    """Soft light cone rising from the platform core to the holo panels (fades upward)."""
    mat = bpy.data.materials.get('M_Beam') or bpy.data.materials.new('M_Beam')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = 0.0
    ramp.inputs['From Max'].default_value = 1.0
    ramp.inputs['To Min'].default_value = 0.14  # additive; eased so the mid panel stays inside the gate
    ramp.inputs['To Max'].default_value = 0.0
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*P.hex_rgb('#A8FFE6'), 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    add = nt.nodes.new('ShaderNodeAddShader')  # additive, so the cone never veils the phone behind it
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Value'])
    nt.links.new(ramp.outputs['Result'], em.inputs['Strength'])
    nt.links.new(tr.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    try:
        mat.surface_render_method = 'BLENDED'
    except (AttributeError, TypeError):
        pass
    mat.use_backface_culling = False
    bm = bmesh.new()
    geom = bmesh.ops.create_cone(bm, cap_ends=False, segments=64, radius1=PLATFORM_R * 0.48,
                                 radius2=PLATFORM_R * 0.9, depth=2.6)
    bmesh.ops.translate(bm, verts=geom['verts'], vec=(0, 0, 0.48 + 1.3))
    return _obj('S04_beam', bm, [mat], c)


# ---------- holo panels, chevrons, orbit ----------

def _outline(bm, w, h, r, y, lw, mi, z0=0.0):
    outer = P.rrect(w, h, r)
    inner = P.rrect(w - 2 * lw, h - 2 * lw, max(r - lw, 0.01))
    P._frame(bm, [(x, z + z0) for x, z in outer], [(x, z + z0) for x, z in inner], y + 0.003, y - 0.003, mi)


def holo_materials():
    glass = P.material('M_Holo_Glass', '#0C2A28', roughness=0.12, alpha=0.38, emission='#25F2B0', strength=0.02)
    edge = P.material('M_Holo_Edge', '#9CFFF0', emission='#7CFFE8', strength=0.8)
    line = P.material('M_Holo_Line', '#C8FFF4', emission='#7CFFE8', strength=1.2)
    grid = P.material('M_Holo_Grid', '#7CFFE8', emission='#7CFFE8', strength=0.25)
    return glass, edge, line, grid


def _bar(bm, x, z, w, h, y, mi):
    """Flat rectangle in the XZ plane at depth y (front facing -Y)."""
    vs = [bm.verts.new(v) for v in ((x - w / 2, y, z - h / 2), (x + w / 2, y, z - h / 2),
                                     (x + w / 2, y, z + h / 2), (x - w / 2, y, z + h / 2))]
    bm.faces.new(vs).material_index = mi


def _ring_flat(bm, x, z, r, lw, y, mi, seg=24):
    vs = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        vs.append((bm.verts.new((x + (r - lw) * math.cos(a), y, z + (r - lw) * math.sin(a))),
                   bm.verts.new((x + r * math.cos(a), y, z + r * math.sin(a)))))
    for k in range(seg):
        j = (k + 1) % seg
        bm.faces.new((vs[k][0], vs[k][1], vs[j][1], vs[j][0])).material_index = mi


def holo_panel(name, w, h, c, phone_frac=0.62, rows=5):
    """Dark glass card with a thin, dense cyan wireframe phone (reference S04: dark glass, thin lines)."""
    glass, edge, line, grid = holo_materials()
    bm = bmesh.new()
    t = 0.02
    P._slab(bm, P.rrect(w, h, 0.08), t / 2, -t / 2, 0)
    _outline(bm, w, h, 0.08, -t / 2 - 0.002, 0.012, 1, z0=0.0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, h / 2))
    card = _obj(name, bm, [glass, edge], c)
    y = -t / 2 - 0.006
    bm = bmesh.new()
    # faint grid over the whole card
    for i in range(1, 4):
        _bar(bm, -w / 2 + i * w / 4, h / 2, 0.009, h * 0.94, y, 1)
    for i in range(1, 7):
        _bar(bm, 0, i * h / 7, w * 0.94, 0.009, y, 1)
    # phone wireframe: body, screen, notch, home bar
    pw, ph = w * phone_frac, h * 0.8
    zc = h / 2
    _outline(bm, pw, ph, pw * 0.14, y, 0.014, 0, z0=zc)
    _outline(bm, pw * 0.86, ph * 0.86, pw * 0.08, y, 0.007, 0, z0=zc)
    _bar(bm, 0, zc + ph * 0.45, pw * 0.22, 0.02, y, 0)
    _bar(bm, 0, zc - ph * 0.45, pw * 0.3, 0.012, y, 0)
    # header + UI rows with round icons
    _bar(bm, -pw * 0.12, zc + ph * 0.34, pw * 0.5, 0.025, y, 0)
    for i in range(rows):
        z = zc + ph * 0.2 - i * ph * 0.13
        _ring_flat(bm, -pw * 0.28, z, ph * 0.035, 0.007, y, 0)
        _bar(bm, pw * 0.06, z + ph * 0.012, pw * 0.42, 0.012, y, 0)
        _bar(bm, pw * 0.0, z - ph * 0.018, pw * 0.3, 0.008, y, 0)
    lines = _obj(name + '_lines', bm, [line, grid], c)
    lines.parent = card
    return card


def build_holo(c):
    M = mats()
    obs = {}
    for name, loc, w, h, yaw in [('S04_holo_back', (-2.26, 0.5, 1.68), 1.1, 2.1, -19.0),
                                 ('S04_holo_mid', (-0.6, 0.0, 1.3), 1.6, 2.85, -41.4)]:  # yaws turn each -Y face toward the robot head (-3.6, -3.4)
        ob = holo_panel(name, w, h, c)
        ob.location = loc
        ob.rotation_euler = (math.radians(-12), 0, math.radians(yaw))
        obs[name] = ob
    # chevrons between the mid panel and the phone
    bm = bmesh.new()
    for i in range(3):
        x0 = i * 0.28
        for sgn in (1, -1):
            pts = [(x0, 0), (x0 + 0.22, 0.24 * sgn), (x0 + 0.13, 0.24 * sgn), (x0 - 0.09, 0)]
            bm.faces.new([bm.verts.new((x, 0, z)) for x, z in pts])
    ch = _obj('S04_chevrons', bm, [M['line']], c)
    ch.location = (0.4, 0.1, 2.4)
    ch.rotation_euler = (0, 0, math.radians(-8))
    ch.scale = (-1, 1, 1)
    # orbit ring (tilted ellipse around the phones)
    bm = bmesh.new()
    P.ring(bm, 1.0, 0.0022, 0.0, seg=192, ring_seg=6)  # thin light trail (~8 mm at scale 3.6), not a neon tube
    orb = _obj('S04_orbit', bm, [P.material('M_Orbit', '#7CFFD9', emission='#7CFFD9', strength=1.0)], c)
    orb.location = (0.45, 0.0, 2.45)
    orb.scale = (3.6, 3.6, 3.6)
    orb.rotation_euler = (math.radians(-14), math.radians(-7), 0)
    return obs


# ---------- phone ----------

def _box(bm, x, y, z, sx, sy, sz, mi=0):
    """Axis-aligned box centred at (x, y, z) with full sizes sx, sy, sz."""
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=r['verts'])
    bmesh.ops.translate(bm, vec=(x, y, z), verts=r['verts'])
    for f in {f for v in r['verts'] for f in v.link_faces}:
        f.material_index = mi


def _lens(bm, x, y, z, rad, depth, mi, seg=24):
    """Cylinder along Y (camera lens) centred at (x, y, z)."""
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=rad, radius2=rad, depth=depth)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'), verts=r['verts'])
    bmesh.ops.translate(bm, vec=(x, y, z), verts=r['verts'])
    for f in {f for v in r['verts'] for f in v.link_faces}:
        f.material_index = mi


def build_phone(c):
    """Real handset: thick gold band, black glass front/back, recessed screen,
    bottom speaker grille + USB-C, side buttons, rear camera bump. Front = -Y."""
    M = mats()
    port = P.material('M_Phone_Port', '#030606', roughness=0.6)
    lens = P.material('M_Phone_Lens', '#05080A', metallic=0.2, roughness=0.05, coat=1.0)
    w, h, t, r = 1.75, 3.7, 0.24, 0.27
    band = 0.045
    # gold band; outer edges bevelled so the sides read as a rounded metal rail
    bm = bmesh.new()
    P._frame(bm, P.rrect(w, h, r, n=8), P.rrect(w - 2 * band, h - 2 * band, r - band, n=8),
             t / 2, -t / 2, 0)
    phone = _obj('S04_phone', bm, [M['gold']], c, bevel=0.035)
    # black glass body inside the band; the front glass sits 0.012 behind the band lip
    bm = bmesh.new()
    P._slab(bm, P.rrect(w - 2 * band + 0.004, h - 2 * band + 0.004, r - band, n=8),
            t / 2 - 0.008, -t / 2 + 0.012, 0)
    _obj('S04_phone_body', bm, [M['black']], c, phone)
    # bottom speaker holes either side of a USB-C slot, side buttons, rear camera bump + lenses
    bm = bmesh.new()
    zb = -h / 2
    for sgn in (1, -1):
        for i in range(6):
            _box(bm, sgn * (0.30 + i * 0.075), 0.0, zb - 0.001, 0.034, 0.07, 0.012, 0)
    _box(bm, 0.0, 0.0, zb - 0.001, 0.2, 0.075, 0.012, 0)
    _box(bm, w / 2 + 0.012, 0.0, 0.55, 0.03, 0.09, 0.5, 1)            # power
    for zc in (0.95, 0.5):
        _box(bm, -w / 2 - 0.012, 0.0, zc, 0.03, 0.09, 0.32, 1)        # volume
    _box(bm, -w / 2 - 0.012, 0.0, 1.35, 0.03, 0.09, 0.14, 1)          # action key
    P._slab(bm, [(x + 0.38, z + 1.33) for x, z in P.rrect(0.78, 0.78, 0.2)], t / 2 + 0.045, t / 2 - 0.004, 2)
    for lx, lz in ((0.22, 1.5), (0.22, 1.16), (0.54, 1.33)):
        _lens(bm, lx, t / 2 + 0.06, lz, 0.12, 0.05, 3)
    _obj('S04_phone_details', bm, [port, M['gold'], M['black'], lens], c, phone, bevel=0.006)
    # screen: emissive image plane just in front of the front glass, ear-clip triangulated
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    sw, sh = w - 0.2, h - 0.2
    pts = P.rrect(sw, sh, r - 0.1, n=8)
    f = bm.faces.new([bm.verts.new((x, -t / 2 + 0.008, z)) for x, z in pts])
    for loop in f.loops:
        loop[uv].uv = (0.5 + loop.vert.co.x / sw, 0.5 + loop.vert.co.z / sh)
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='EAR_CLIP')
    scr = _obj('S04_phone_screen', bm, [_image_mat('M_Phone_Screen', 's04_phone_screen.png', 1.0)], c, phone)
    # turned toward the robot; yaw eased to -30 and pitched back -20 so the on-screen box matches the
    # reference phone (280x385 px at x 1030-1310, y 275-660 in the 1671x941 hero frame)
    phone.location = (2.003, 0.3, 2.633)
    phone.rotation_euler = (math.radians(-20), math.radians(10), math.radians(-30.0))
    return phone, scr


# ---------- room ----------

def _tex(file):
    return os.path.exists(os.path.join(TEX, file))


def _keyed_card_mat(name, file, strength):
    """Image card: emission from the image, alpha from its brightness (black background drops out)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEX, file), check_existing=True)
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.03
    mr.inputs['From Max'].default_value = 0.12
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'], bw.inputs[0])
    nt.links.new(bw.outputs[0], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], mix.inputs['Fac'])
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    try:
        mat.surface_render_method = 'BLENDED'
    except (AttributeError, TypeError):
        pass
    return mat


def _card(name, mat, w, h, c):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    f = bm.faces.new([bm.verts.new(v) for v in ((-w / 2, 0, 0), (w / 2, 0, 0), (w / 2, 0, h), (-w / 2, 0, h))])
    for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = t
    return _obj(name, bm, [mat], c)


def _slab_box(bm, x, y, z, w, d, h):
    geom = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=geom['verts'], vec=(w, d, h))
    bmesh.ops.translate(bm, verts=geom['verts'], vec=(x, y, z))


def build_room(c):
    floor = P.material('M_Floor_Gloss_S04', '#26363A', metallic=0.5, roughness=0.1)
    wall = P.material('M_Wall_Teal_S04', '#0A1D1D', roughness=0.5, metallic=0.3)
    mull = P.material('M_Mullion', '#22383A', metallic=0.7, roughness=0.35)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    _obj('S04_floor', bm, [floor], c).location = (0, 12, 0)
    # curved back wall behind the platform (right side); the left side is the window
    R, cx, cy = 15.0, 0.0, 3.0
    bm = bmesh.new()
    rows = []
    for k in range(29):
        a = math.radians(10 + 110 * k / 28)
        rows.append((bm.verts.new((cx + R * math.cos(a), cy + R * math.sin(a), 0)),
                     bm.verts.new((cx + R * math.cos(a), cy + R * math.sin(a), 10))))
    for k in range(28):
        bm.faces.new((rows[k][0], rows[k + 1][0], rows[k + 1][1], rows[k][1]))
    _obj('S04_wall', bm, [wall], c)
    # vertical light strips on the wall
    strip = P.material('M_Emissive_Strip', '#25F2B0', emission='#25F2B0', strength=1.0)
    bm = bmesh.new()
    for a in (22, 34, 47, 61, 75):
        ar = math.radians(a)
        x, y = cx + (R - 0.05) * math.cos(ar), cy + (R - 0.05) * math.sin(ar)
        _slab_box(bm, x, y, 3.8, 0.12, 0.05, 5.5)
    _obj('S04_wall_strips', bm, [strip], c)
    # dark racks with small screens in front of the right wall (the reference interior is dark and busy)
    rack = P.material('M_Rack_Dark', '#0B1617', metallic=0.6, roughness=0.35)
    scr = P.material('M_Rack_Screen', '#25F2B0', emission='#25F2B0', strength=0.6)
    bm, bs = bmesh.new(), bmesh.new()
    for i, (x, y, h) in enumerate([(4.8, 7.5, 6.2), (6.6, 6.8, 6.8), (8.4, 5.8, 7.2), (10.0, 4.6, 7.5),
                                   (11.4, 3.2, 7.5)]):
        _slab_box(bm, x, y, h / 2, 1.5, 1.0, h)
        for k in range(4):
            _slab_box(bs, x + (k % 2 - 0.5) * 0.5, y - 0.52, 1.4 + k * 1.2, 0.36, 0.02, 0.08 + 0.05 * (k % 3))
    _obj('S04_racks', bm, [rack], c)
    _obj('S04_rack_screens', bs, [scr], c)
    # window wall on the left: mullion grid, dusk city image behind it
    win = bpy.data.objects.new('S04_window', None)
    c.objects.link(win)
    win.location = (-13.43, 5.0, 0.0)
    win.rotation_euler = (0, 0, math.radians(30))
    bm = bmesh.new()
    W, H = 13.0, 9.5
    for i in range(9):
        _slab_box(bm, -W / 2 + i * W / 8, 0, H / 2, 0.14, 0.2, H)
    for z in (0.4, 3.0, 6.0, 9.4):
        _slab_box(bm, 0, 0, z, W, 0.2, 0.16)
    mu = _obj('S04_window_mullions', bm, [mull], c, win)
    if _tex('s04_city_dusk.png'):
        city = _card('S04_city', _image_mat('M_City_Dusk', 's04_city_dusk.png', 0.95), 15.0, 9.0, c)
        city.parent = win
        city.location = (0, 3.0, -0.6)
    # ceiling: emerald arc segments over the platform + one warm strip top-left
    bm = bmesh.new()
    for a0, a1 in [(40, 95), (100, 140), (300, 330)]:
        _arc_block(bm, 8.6, 8.72, a0, a1, -0.04, 0.04, 0, seg=24)
    ce = _obj('S04_ceiling_arcs', bm, [P.material('M_Emissive_Ceiling', '#25F2B0', emission='#25F2B0',
                                                  strength=0.5)], c)
    ce.rotation_euler = (math.radians(90), 0, 0)
    ce.location = (0.5, 2.0, 7.6)
    bm = bmesh.new()
    _slab_box(bm, 0, 0, 0, 2.0, 0.18, 0.08)
    wm = _obj('S04_ceiling_warm', bm, [P.material('M_Emissive_Warm', '#FFE2B0', emission='#FFD9A0',
                                                  strength=3.0)], c)
    wm.location = (-7.5, 3.0, 7.2)
    wm.rotation_euler = (0, math.radians(12), math.radians(25))
    return mu


def build_plants(c):
    if not _tex('s03_plant_fg.png'):
        return []
    mat = _keyed_card_mat('M_Plant_Card', 's03_plant_fg.png', 0.6)
    obs = []
    for name, loc, w, h, yaw in [('S04_plant_L', (-8.6, 1.5, 0.0), 3.4, 5.1, 30),
                                 ('S04_plant_L2', (-6.0, 4.0, 0.0), 2.4, 3.6, 20),
                                 ('S04_plant_R', (2.05, -7.0, -0.2), 0.95, 1.4, -10)]:
        ob = _card(name, mat, w, h, c)
        ob.location = loc
        ob.rotation_euler = (0, 0, math.radians(yaw))
        obs.append(ob)
    return obs


LIGHTS = [  # name, type, location, rotation (deg), energy, colour, size
    ('L_window_dusk', 'AREA', (-10, 5, 4.5), (90, 0, -60), 1200, (1.0, 0.75, 0.7), 8),
    ('L_platform_glow', 'POINT', (0.2, 0.2, 1.6), (0, 0, 0), 600, (0.35, 1, 0.55), 1),
    ('L_front_fill', 'AREA', (-1, -8, 4), (70, 0, 0), 500, (0.85, 0.95, 1), 6),
    ('L_rim_right', 'AREA', (6, -2, 5), (60, 0, 50), 300, (0.6, 1, 0.8), 3),
    # warm card at the mirror angle of the phone's right rail, so the gold band reads from the camera
    ('L_phone_gold', 'AREA', (3.9, 1.1, 2.9), (85.7, 0, 113.4), 450, (1.0, 0.86, 0.62), 3),
]


def look():
    s = bpy.context.scene
    room = coll('S04_ROOM')
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
    # the gold card lights only the phone rail; otherwise it paints a hotspot on the glossy floor
    ll = bpy.data.collections.get('LL_phone_gold') or bpy.data.collections.new('LL_phone_gold')
    ob = bpy.data.objects.get('S04_phone')  # band only: the lenses would flare white
    if ob and ob.name not in ll.objects:
        ll.objects.link(ob)
    bpy.data.objects['L_phone_gold'].light_linking.receiver_collection = ll
    w = s.world or bpy.data.worlds.new('W')
    s.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.012, 0.03, 0.03, 1)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_WORLD')
    vol = next((n for n in nt.nodes if n.type == 'VOLUME_PRINCIPLED'), None) or nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = 0.0018
    vol.inputs['Color'].default_value = (0.3, 0.62, 0.45, 1)
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    try:
        s.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        pass
    s.eevee.use_raytracing = True
    rt = s.eevee.ray_tracing_options
    rt.resolution_scale = '1'
    rt.use_denoise = True
    s.eevee.volumetric_samples = 128
    s.eevee.volumetric_tile_size = '4'
    s.eevee.taa_render_samples = 128
    s.view_settings.view_transform = 'Standard'
    s.view_settings.look = 'Medium High Contrast'
    s.view_settings.exposure = 0.0
    cam = bpy.data.objects['CAM_S04_hero'].data
    cam.dof.use_dof, cam.dof.focus_distance, cam.dof.aperture_fstop = True, 10.0, 2.8
    ng = s.compositing_node_group or bpy.data.node_groups.new('S04_comp', 'CompositorNodeTree')
    s.compositing_node_group = ng
    if not any(i.in_out == 'OUTPUT' for i in ng.interface.items_tree):
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    if not any(n.bl_idname == 'CompositorNodeDenoise' for n in ng.nodes):
        for n in list(ng.nodes):
            ng.nodes.remove(n)
        rl = ng.nodes.new('CompositorNodeRLayers')
        dn = ng.nodes.new('CompositorNodeDenoise')
        gl = ng.nodes.new('CompositorNodeGlare')
        go = ng.nodes.new('NodeGroupOutput')
        ng.links.new(rl.outputs['Image'], dn.inputs[0])
        ng.links.new(dn.outputs[0], gl.inputs[0])
        ng.links.new(gl.outputs[0], go.inputs[0])
    vl = s.view_layers[0]
    vl.use_pass_normal = True
    vl.use_pass_diffuse_color = True
    rl = next(n for n in ng.nodes if n.bl_idname == 'CompositorNodeRLayers')
    dn = next(n for n in ng.nodes if n.bl_idname == 'CompositorNodeDenoise')
    gl = next(n for n in ng.nodes if n.bl_idname == 'CompositorNodeGlare')
    ng.links.new(rl.outputs['Normal'], dn.inputs['Normal'])
    ng.links.new(rl.outputs['Diffuse Color'], dn.inputs['Albedo'])
    gl.inputs['Type'].default_value = 'Bloom'
    gl.inputs['Threshold'].default_value = 0.9
    gl.inputs['Strength'].default_value = 0.35
    gl.inputs['Size'].default_value = 0.6


def build():
    props = coll('S04_PROPS')
    clear(props)
    build_platform(props)
    build_beam(props)
    build_holo(props)
    if _tex('s04_phone_screen.png'):
        build_phone(props)
    room = coll('S04_ROOM')
    for o in list(room.objects):
        if o.type != 'LIGHT':
            bpy.data.objects.remove(o, do_unlink=True)
    build_room(room)
    bd = coll('BACKDROP')
    clear(bd)
    build_plants(bd)
    lay = bpy.data.collections.get('LAYOUT')
    if lay:
        lay.hide_render = True
        lay.hide_viewport = True
    look()


if __name__ == '__main__':
    build()
