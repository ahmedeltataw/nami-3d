"""S07 'Build Your Future' — scene v2 (workflow v2, built live in Blender).

Runs inside assets-model/s07_future_v2.blend (camera CAM_S07_hero + robot rig in REF).
The LAYOUT collection holds the approved blockout volumes (BLK_*); build() replaces them
with detailed props in PROPS, a matte-painted sky/city card in BACKDROP and the look.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts_lib as P  # noqa: E402
from s02_portal_v2 import coll, TEX  # noqa: E402

CAM = 'CAM_S07_hero'
SEED = 7


# ---------------------------------------------------------------- helpers
def _obj(name, bm, mats, c, parent=None, smooth=True):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    c.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def _emit_mat(name, color, strength, additive=True):
    """Additive glow (Transparent + Emission) so faded edges never veil the frame."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*P.hex_rgb(color), 1)
    em.inputs['Strength'].default_value = strength
    if additive:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        add = nt.nodes.new('ShaderNodeAddShader')
        nt.links.new(tr.outputs[0], add.inputs[0])
        nt.links.new(em.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs['Surface'])
        m.surface_render_method = 'BLENDED'
    else:
        nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


# ---------------------------------------------------------------- rocks
def rock_mat():
    """Weathered dark basalt: vertex-colour albedo (moss on top faces, lichen flecks)
    plus a procedural bump so the faces read as eroded stone, not clay."""
    m = bpy.data.materials.get('M_Rock') or bpy.data.materials.new('M_Rock')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n1 = nt.nodes.new('ShaderNodeTexNoise')
    n1.inputs['Scale'].default_value = 3.5
    n1.inputs['Detail'].default_value = 12.0
    n1.inputs['Roughness'].default_value = 0.62
    vo = nt.nodes.new('ShaderNodeTexVoronoi')
    vo.feature = 'DISTANCE_TO_EDGE'
    vo.inputs['Scale'].default_value = 2.2
    mixb = nt.nodes.new('ShaderNodeMath')
    mixb.operation = 'MULTIPLY_ADD'
    mixb.inputs[1].default_value = 0.6
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.9
    bump.inputs['Distance'].default_value = 0.08
    # slight albedo breakup
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 0.45
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (1.15, 1.12, 1.08, 1)
    L = nt.links.new
    L(tc.outputs['Object'], n1.inputs['Vector'])
    L(tc.outputs['Object'], vo.inputs['Vector'])
    L(n1.outputs['Fac'], ramp.inputs['Fac'])
    L(col.outputs['Color'], mul.inputs['A'])
    L(ramp.outputs['Color'], mul.inputs['B'])
    L(mul.outputs['Result'], bsdf.inputs['Base Color'])
    L(vo.outputs['Distance'], mixb.inputs[0])
    L(n1.outputs['Fac'], mixb.inputs[2])
    L(mixb.outputs[0], bump.inputs['Height'])
    L(bump.outputs['Normal'], bsdf.inputs['Normal'])
    L(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.88
    return m


ROCK_DARK = (0.050, 0.047, 0.045)
ROCK_TOP = (0.115, 0.105, 0.092)
MOSS = (0.070, 0.115, 0.030)
LICHEN = (0.20, 0.19, 0.13)


def _rock_height(co, seed):
    """Eroded rock displacement: fBm body, Voronoi crack network, ridged chips and
    horizontal strata steps, so faces break into hard-edged slabs like weathered basalt."""
    o = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    d = 0.30 * noise.fractal(co * 0.55 + o, 0.55, 2.0, 5, noise_basis='PERLIN_ORIGINAL')
    dist, _pts = noise.voronoi(co * 0.9 + o, distance_metric='DISTANCE')
    crack = min(1.0, (dist[1] - dist[0]) * 3.0)
    d += 0.10 * crack - 0.05
    d += 0.07 * (noise.ridged_multi_fractal(co * 2.4 + o, 0.9, 2.1, 4, 1.0, 2.0,
                                            noise_basis='PERLIN_ORIGINAL') - 1.0)
    z = co.z * 3.0 + 1.5 * noise.noise(co * 0.6 + o)
    step = z - math.floor(z)
    d += 0.05 * (step ** 3)
    return d


def build_rock(name, blk, c, subdiv=4, seed=1, flat=None, cap=None):
    """Displaced icosphere fitted to the blockout volume `blk` (same bbox)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        n = v.co.normalized()
        h = _rock_height(v.co * 2.0, seed)
        v.co = n * (1.0 + h)
    # squash into the blockout's proportions; flatten the underside
    dims = blk.dimensions
    for v in bm.verts:
        v.co.x *= dims.x / 2.0
        v.co.y *= dims.y / 2.0
        v.co.z *= dims.z / 2.0
    if flat:  # level standing area (centre xy in rock space, radius, z)
        fx, fy, fr, fz = flat
        for v in bm.verts:
            dxy = math.hypot(v.co.x - fx, v.co.y - fy)
            if v.co.z > fz - 0.4 and dxy < fr * 1.6:
                w = max(0.0, min(1.0, (fr * 1.6 - dxy) / (fr * 0.6)))
                v.co.z = v.co.z + (fz + 0.03 * noise.noise(v.co * 3) - v.co.z) * w
    if cap:  # world-space dome cap: nothing rises above ztop - slope*dist from (cx, cy),
        cx, cy, ztop, slope = cap  # so the rock falls away from the robot's standing spot
        lx, ly, lz = blk.location
        for v in bm.verts:
            dist = math.hypot(v.co.x + lx - cx, v.co.y + ly - cy)
            zmax = ztop - slope * dist * dist - lz
            k = 0.45  # soft knee: the top keeps rounded relief instead of a sawn-flat plateau
            if v.co.z > zmax - k:
                v.co.z = zmax - k * math.exp(-(v.co.z - zmax + k) / k)
    # vertex colours: dark stone, lighter worn tops, moss on up-facing faces
    bm.normal_update()
    cl = bm.loops.layers.color.new('Col')
    rnd = random.Random(seed)
    for f in bm.faces:
        for lp in f.loops:
            v = lp.vert
            up = v.normal.z
            t = max(0.0, min(1.0, (v.co.z / (dims.z / 2.0) + 0.2)))
            base = [ROCK_DARK[i] + (ROCK_TOP[i] - ROCK_DARK[i]) * t for i in range(3)]
            mn = noise.noise(v.co * 1.3 + Vector((seed, 0, 0)))
            moss = max(0.0, min(1.0, (up - 0.55) * 3.0 + mn * 1.4))
            ln = noise.noise(v.co * 5.0 + Vector((0, seed, 0)))
            lich = max(0.0, min(1.0, (ln - 0.35) * 4.0)) * (1 - moss)
            col = [base[i] * (1 - moss) + MOSS[i] * moss for i in range(3)]
            col = [col[i] * (1 - lich * 0.6) + LICHEN[i] * lich * 0.6 for i in range(3)]
            lp[cl] = (*col, 1.0)
    ob = _obj(name, bm, [rock_mat()], c)
    ob.location = blk.location
    ob.rotation_euler = blk.rotation_euler
    return ob


# ---------------------------------------------------------------- grass
def grass_mat():
    m = bpy.data.materials.get('M_Grass') or bpy.data.materials.new('M_Grass')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(col.outputs['Color'], bsdf.inputs['Subsurface Radius'])
    bsdf.inputs['Roughness'].default_value = 0.6
    bsdf.inputs['Subsurface Weight'].default_value = 0.0
    # backlit blades glow warm-green when the sun is behind them
    bsdf.inputs['Transmission Weight'].default_value = 0.0
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    m.use_backface_culling = False
    return m


def _blade(bm, cl, root, normal, h, w, bend_dir, rnd):
    """Tapered curved blade, 4 segments, two-sided."""
    side = normal.cross(bend_dir).normalized()
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    segs = 4
    left, right = [], []
    for i in range(segs + 1):
        t = i / segs
        p = root + normal * (h * t) + bend_dir * (h * 0.45 * t * t)
        ww = w * (1 - t) ** 0.9
        left.append(bm.verts.new(p - side * ww))
        right.append(bm.verts.new(p + side * ww))
    base = Vector((0.06, 0.13, 0.025)) * (0.7 + 0.6 * rnd.random())
    tip = Vector((0.42, 0.55, 0.12)) * (0.7 + 0.5 * rnd.random())
    for i in range(segs):
        f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
        for lp in f.loops:
            t = (lp.vert.co - root).length / h
            c = base.lerp(tip, min(1.0, t))
            lp[cl] = (c.x, c.y, c.z, 1.0)


def build_grass(c, rocks, tufts):
    """Tufts dropped onto the rock surfaces by ray-casting straight down."""
    deps = bpy.context.evaluated_depsgraph_get()
    rnd = random.Random(SEED)
    bm = bmesh.new()
    cl = bm.loops.layers.color.new('Col')
    hidden = []
    for o in bpy.data.objects:
        if o.type == 'MESH' and o not in rocks and not o.hide_get():
            hidden.append(o)
            o.hide_set(True)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    placed = 0
    for (x, y, rad, count, hmax) in tufts:
        for _ in range(count):
            px = x + (rnd.random() - 0.5) * 2 * rad
            py = y + (rnd.random() - 0.5) * 2 * rad
            hit, loc, nor, *_ = bpy.context.scene.ray_cast(deps, Vector((px, py, 20)), Vector((0, 0, -1)))
            if not hit or nor.z < 0.35:
                continue
            nblades = rnd.randint(7, 14)
            for _b in range(nblades):
                r = loc + Vector(((rnd.random() - 0.5) * 0.12, (rnd.random() - 0.5) * 0.12, -0.02))
                up = (Vector((0, 0, 1)) * 2 + nor).normalized()
                bend = Vector((rnd.random() - 0.5, rnd.random() - 0.5, 0)).normalized()
                _blade(bm, cl, r, up, hmax * (0.45 + 0.55 * rnd.random()), 0.012 + 0.01 * rnd.random(), bend, rnd)
            placed += 1
    for o in hidden:
        o.hide_set(False)
    ob = _obj('S07_grass', bm, [grass_mat()], c, smooth=True)
    print('grass tufts', placed, 'tris', len(ob.data.polygons) * 2)
    return ob


# ---------------------------------------------------------------- backdrop (matte painting)
BACKDROP_DIST = 900.0
BACKDROP_GRADE = dict(top=0.36, corner=0.34)


def build_backdrop(c, overscan=1.02):
    """Shadeless card filling the camera frustum at BACKDROP_DIST, UV = frame coords."""
    cam = bpy.data.objects[CAM]
    sc = bpy.context.scene
    frame = cam.data.view_frame(scene=sc)  # 4 corners at local z = -d
    mw = cam.matrix_world
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    vs = []
    for co in frame:
        k = BACKDROP_DIST / -co.z
        vs.append(bm.verts.new(mw @ (Vector((co.x * overscan, co.y * overscan, co.z)) * k)))
    f = bm.faces.new(vs)
    for lp in f.loops:
        loc = cam.matrix_world.inverted() @ lp.vert.co
        x = loc.x / (-loc.z) / (frame[0].x / -frame[0].z)
        y = loc.y / (-loc.z) / (frame[0].y / -frame[0].z)
        lp[uv].uv = (0.5 + 0.5 * x / overscan * overscan, 0.5 + 0.5 * y)
    m = bpy.data.materials.get('M_Sky_City') or bpy.data.materials.new('M_Sky_City')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEX, 's07_sky_city.png'), check_existing=True)
    tex.extension = 'EXTEND'
    # grade toward the ref: darker zenith (painting's top is ~1.6x the ref) and a dimmer
    # bottom-right cloud bank, done in the shader so the source image stays untouched
    uvn = nt.nodes.new('ShaderNodeUVMap')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(uvn.outputs['UV'], sep.inputs[0])
    top = nt.nodes.new('ShaderNodeMapRange')       # v 0.70 -> 1.0 : x1.0 -> x0.6
    top.inputs['From Min'].default_value = 0.70
    top.inputs['From Max'].default_value = 1.0
    top.inputs['To Min'].default_value = 1.0
    top.inputs['To Max'].default_value = BACKDROP_GRADE['top']
    nt.links.new(sep.outputs['Y'], top.inputs['Value'])
    bx = nt.nodes.new('ShaderNodeMapRange')        # u 0.70 -> 0.85 ramps the corner in
    bx.inputs['From Min'].default_value = 0.70
    bx.inputs['From Max'].default_value = 0.85
    nt.links.new(sep.outputs['X'], bx.inputs['Value'])
    byy = nt.nodes.new('ShaderNodeMapRange')       # v 0.22 -> 0.10 (frame y 0.78 -> 0.90)
    byy.inputs['From Min'].default_value = 0.22
    byy.inputs['From Max'].default_value = 0.10
    nt.links.new(sep.outputs['Y'], byy.inputs['Value'])
    corner = nt.nodes.new('ShaderNodeMath')
    corner.operation = 'MULTIPLY'
    nt.links.new(bx.outputs[0], corner.inputs[0])
    nt.links.new(byy.outputs[0], corner.inputs[1])
    cdim = nt.nodes.new('ShaderNodeMapRange')
    cdim.inputs['To Min'].default_value = 1.0
    cdim.inputs['To Max'].default_value = BACKDROP_GRADE['corner']
    nt.links.new(corner.outputs[0], cdim.inputs['Value'])
    gain = nt.nodes.new('ShaderNodeMath')
    gain.operation = 'MULTIPLY'
    nt.links.new(top.outputs[0], gain.inputs[0])
    nt.links.new(cdim.outputs[0], gain.inputs[1])
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(gain.outputs[0], em.inputs['Strength'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    ob = _obj('S07_sky_city', bm, [m], c, smooth=False)
    ob.visible_shadow = False
    return ob


# ---------------------------------------------------------------- light trail
TRAIL_Z = -30.0
# frame path (x from left, y from top), traced off the reference: a loop at the bay edge
# that sweeps right in front of the cloud bank
TRAIL_UV = [(0.600, 0.818), (0.572, 0.836), (0.558, 0.858), (0.566, 0.879), (0.595, 0.895),
            (0.650, 0.913), (0.715, 0.934), (0.780, 0.950), (0.850, 0.958), (0.952, 0.954)]


def frame_to_plane(u, v, z):
    """World point where the camera ray through frame (u, v) meets the plane Z = z."""
    cam = bpy.data.objects[CAM]
    sc = bpy.context.scene
    fr = cam.data.view_frame(scene=sc)
    xs = [p.x for p in fr]
    ys = [p.y for p in fr]
    d = fr[0].z
    lx = min(xs) + u * (max(xs) - min(xs))
    ly = max(ys) - v * (max(ys) - min(ys))
    mw = cam.matrix_world
    o = mw.translation
    dirv = (mw.to_3x3() @ Vector((lx, ly, d))).normalized()
    t = (z - o.z) / dirv.z
    return o + dirv * t


def build_trail(c, radius=0.55):
    pts = [frame_to_plane(u, v, TRAIL_Z) for u, v in TRAIL_UV]
    cu = bpy.data.curves.get('S07_trail') or bpy.data.curves.new('S07_trail', 'CURVE')
    cu.splines.clear()
    cu.dimensions = '3D'
    sp = cu.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for p, w in zip(sp.points, pts):
        p.co = (*w, 1.0)
    sp.order_u = 4
    sp.use_endpoint_u = True
    sp.resolution_u = 24
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    ob = bpy.data.objects.get('S07_trail') or bpy.data.objects.new('S07_trail', cu)
    if ob.name not in c.objects:
        c.objects.link(ob)
    cu.materials.clear()
    cu.materials.append(_emit_mat('M_Trail', '#2FE6C8', 0.55))
    ob.visible_shadow = False
    # soft wide halo around the core
    halo = bpy.data.objects.get('S07_trail_halo')
    if halo is None:
        halo = bpy.data.objects.new('S07_trail_halo', cu.copy())
        c.objects.link(halo)
    halo.data.bevel_depth = radius * 3.5
    halo.data.materials.clear()
    halo.data.materials.append(_emit_mat('M_Trail_Halo', '#19C37D', 0.6))
    halo.visible_shadow = False
    return ob


# ---------------------------------------------------------------- glass N + orbit
def glass_n_mat():
    """Mint glass: refractive body + emission that grows toward grazing angles, so the
    slab reads translucent in the middle with bright glowing edges, like the ref."""
    m = bpy.data.materials.get('M_Glass_N') or bpy.data.materials.new('M_Glass_N')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    g = nt.nodes.new('ShaderNodeBsdfPrincipled')
    g.inputs['Base Color'].default_value = (*P.hex_rgb('#4CC9A0'), 1)
    g.inputs['Transmission Weight'].default_value = 0.0
    g.inputs['Roughness'].default_value = 0.04
    g.inputs['IOR'].default_value = 1.45
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.22
    rmp = nt.nodes.new('ShaderNodeMapRange')
    rmp.inputs['To Min'].default_value = 0.30
    rmp.inputs['To Max'].default_value = 3.0
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*P.hex_rgb('#2FE3A2'), 1)
    add = nt.nodes.new('ShaderNodeAddShader')
    L = nt.links.new
    L(lw.outputs['Facing'], rmp.inputs['Value'])
    L(rmp.outputs['Result'], em.inputs['Strength'])
    # see-through body: half transparent so the dusk sky reads through the slab (and the
    # same set-up survives glTF export as alpha blend)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.62
    L(tr.outputs[0], mix.inputs[1])
    L(g.outputs[0], mix.inputs[2])
    L(mix.outputs[0], add.inputs[0])
    L(em.outputs[0], add.inputs[1])
    L(add.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    m.use_transparency_overlap = False
    return m


def build_glass_n(c):
    blk = bpy.data.objects['BLK_N']
    cu = blk.data.copy()
    cu.name = 'S07_N'
    cu.extrude = 0.2          # ref slab is shallow: side faces read as a thin glowing rim
    cu.bevel_depth = 0.055    # rounded glass edges
    cu.bevel_resolution = 4
    old = bpy.data.objects.get('S07_N')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new('S07_N', cu)
    c.objects.link(ob)
    ob.matrix_world = blk.matrix_world.copy()
    cu.materials.clear()
    cu.materials.append(glass_n_mat())
    ob.visible_shadow = False
    # bright rim: glowing outline tubes on the front and back contour of the slab
    for side, dz in (('front', 1), ('back', -1)):
        nm = 'S07_N_rim_' + side
        o2 = bpy.data.objects.get(nm)
        if o2:
            bpy.data.objects.remove(o2, do_unlink=True)
        rc = blk.data.copy()
        rc.name = nm
        rc.extrude = 0.0
        rc.fill_mode = 'NONE'
        rc.bevel_depth = 0.02
        rc.bevel_resolution = 2
        rc.offset = cu.bevel_depth * 0.9  # ride the outer bevelled edge
        rc.materials.clear()
        rc.materials.append(_emit_mat('M_N_Rim_' + side, '#7DFFD9', 5.0 if dz > 0 else 0.5))
        o2 = bpy.data.objects.new(nm, rc)
        c.objects.link(o2)
        o2.matrix_world = blk.matrix_world.copy()
        o2.location = o2.matrix_world @ Vector((0, 0, dz * (cu.extrude + cu.bevel_depth * 0.5)))
        o2.visible_shadow = False
    return ob


def _arc_mesh(name, R, r, a0, a1, c, seg=160, rs=8):
    """Torus segment from angle a0 to a1 (radians) in the XY plane."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        cen = Vector((math.cos(a) * R, math.sin(a) * R, 0))
        out = Vector((math.cos(a), math.sin(a), 0))
        ring = []
        for j in range(rs):
            b = 2 * math.pi * j / rs
            ring.append(bm.verts.new(cen + out * (r * math.cos(b)) + Vector((0, 0, r * math.sin(b)))))
        rings.append(ring)
    for i in range(seg):
        for j in range(rs):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % rs], rings[i + 1][(j + 1) % rs], rings[i + 1][j]))
    return _obj(name, bm, [], c)


def build_orbit(c):
    """Thin glowing orbit (ref line weight) + two faint energy arcs sweeping round the N."""
    blk = bpy.data.objects['BLK_orbit']
    R = blk.dimensions.x / 2.0 - 0.15
    ob = _arc_mesh('S07_orbit', R, 0.035, 0.0, 2 * math.pi, c)
    ob.location = blk.matrix_world.translation
    ob.rotation_euler = blk.rotation_euler
    ob.data.materials.append(_emit_mat('M_Orbit_S07', '#5CF5CF', 7.0))
    ob.visible_shadow = False
    n = bpy.data.objects['S07_N']
    ctr = blk.matrix_world.translation
    arcs = []
    for i, (a0, a1, tilt, yaw, rr) in enumerate(((0.3, 2.6, 62, 20, 0.92), (3.4, 5.6, -58, -35, 0.8))):
        a = _arc_mesh('S07_orbit_arc%d' % (i + 1), R * rr, 0.012, a0, a1, c)
        a.location = ctr
        a.rotation_euler = (math.radians(tilt), 0, math.radians(yaw - 30))
        a.data.materials.append(_emit_mat('M_Orbit_Arc', '#3DE8A6', 2.2))
        a.visible_shadow = False
        arcs.append(a)
    return ob


# ---------------------------------------------------------------- tree branch (top-left)
def frame_to_depth(u, v, dist):
    """World point on the camera ray through frame (u, v) at `dist` metres along it."""
    cam = bpy.data.objects[CAM]
    fr = cam.data.view_frame(scene=bpy.context.scene)
    xs = [p.x for p in fr]
    ys = [p.y for p in fr]
    lx = min(xs) + u * (max(xs) - min(xs))
    ly = max(ys) - v * (max(ys) - min(ys))
    mw = cam.matrix_world
    dv = (mw.to_3x3() @ Vector((lx, ly, fr[0].z))).normalized()
    return mw.translation + dv * dist


def leaf_mat():
    m = bpy.data.materials.get('M_Leaf') or bpy.data.materials.new('M_Leaf')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    nt.links.new(col.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.45
    # thin leaves glow when the sunset is behind them
    tl = nt.nodes.new('ShaderNodeBsdfTranslucent')
    nt.links.new(col.outputs['Color'], tl.inputs['Color'])
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.55
    nt.links.new(b.outputs[0], mix.inputs[1])
    nt.links.new(tl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    m.use_backface_culling = False
    return m


def bark_mat():
    return P.material('M_Bark', '#1A140F', roughness=0.85)


TREE_DIST = 4.6
# main branch + twigs as frame paths (u, v) with radius at each point (metres)
TREE_BRANCHES = [
    [(-0.06, 0.02, 0.07), (0.02, 0.07, 0.055), (0.08, 0.11, 0.04), (0.14, 0.15, 0.028), (0.19, 0.20, 0.016)],
    [(0.04, 0.085, 0.03), (0.07, 0.03, 0.02), (0.11, -0.02, 0.012)],
    [(0.10, 0.125, 0.022), (0.11, 0.19, 0.014), (0.10, 0.235, 0.008)],
    [(0.15, 0.16, 0.014), (0.20, 0.13, 0.009), (0.23, 0.15, 0.006)],
    [(0.02, 0.07, 0.025), (0.00, 0.18, 0.016), (0.02, 0.26, 0.009)],
]
# leaf clusters: (u, v, spread_uv, count)
TREE_LEAVES = [(0.02, 0.02, 0.06, 160), (0.10, 0.02, 0.05, 110), (0.10, 0.20, 0.045, 120),
               (0.20, 0.17, 0.035, 90), (0.02, 0.20, 0.05, 120), (0.23, 0.13, 0.03, 50),
               (0.065, 0.12, 0.04, 70)]


def build_tree(c):
    rnd = random.Random(SEED + 3)
    # branches: one bmesh of tapered tubes
    bm = bmesh.new()
    for path in TREE_BRANCHES:
        pts = [(frame_to_depth(u, v, TREE_DIST + rnd.uniform(-0.15, 0.15)), r) for u, v, r in path]
        # densify with catmull-rom-ish linear subdivision
        dense = []
        for i in range(len(pts) - 1):
            for k in range(6):
                t = k / 6
                p = pts[i][0].lerp(pts[i + 1][0], t)
                p += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.01
                dense.append((p, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t))
        dense.append(pts[-1])
        rings = []
        for i, (p, r) in enumerate(dense):
            tng = (dense[min(i + 1, len(dense) - 1)][0] - dense[max(i - 1, 0)][0]).normalized()
            a = tng.orthogonal().normalized()
            b = tng.cross(a)
            rings.append([bm.verts.new(p + (a * math.cos(t) + b * math.sin(t)) * r)
                          for t in [2 * math.pi * j / 8 for j in range(8)]])
        for i in range(len(rings) - 1):
            for j in range(8):
                bm.faces.new((rings[i][j], rings[i][(j + 1) % 8], rings[i + 1][(j + 1) % 8], rings[i + 1][j]))
    br = _obj('S07_tree_branch', bm, [bark_mat()], c)
    # leaves: pointed ovals (6 tris), random orientation, hanging slightly
    bm = bmesh.new()
    cl = bm.loops.layers.color.new('Col')
    dark = Vector((0.020, 0.045, 0.012))
    lit = Vector((0.30, 0.42, 0.06))
    for (u, v, sp, n) in TREE_LEAVES:
        for _ in range(n):
            uu = u + rnd.gauss(0, sp * 0.5)
            vv = v + rnd.gauss(0, sp * 0.5)
            p = frame_to_depth(uu, vv, TREE_DIST + rnd.uniform(-0.4, 0.3))
            L = rnd.uniform(0.07, 0.11)
            W = L * 0.42
            rot = Matrix.Rotation(rnd.uniform(0, 6.28), 3, 'Z') @ Matrix.Rotation(rnd.uniform(-1.2, 1.2), 3, 'X') \
                @ Matrix.Rotation(rnd.uniform(-0.6, 0.6), 3, 'Y')
            prof = [(0, 0), (W * 0.5, L * 0.25), (W * 0.45, L * 0.6), (0, L), (-W * 0.45, L * 0.6), (-W * 0.5, L * 0.25)]
            vs = [bm.verts.new(p + rot @ Vector((x, y, 0.02 * math.sin(y / L * 3.14)))) for x, y in prof]
            f = bm.faces.new(vs)
            # backlit warm-yellow leaves toward the sun side, dark near the trunk
            t = max(0.0, min(1.0, rnd.random() * 0.6 + (uu - 0.02) * 2.0))
            col = dark.lerp(lit, t * t)
            for lp in f.loops:
                lp[cl] = (col.x, col.y, col.z, 1.0)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    lv = _obj('S07_tree_leaves', bm, [leaf_mat()], c)
    return br, lv


# grass tufts placed by frame position (u, v): (u, v, spread_uv, tufts, blade height m)
GRASS_UV = [(0.02, 0.76, 0.03, 22, 0.6), (0.06, 0.75, 0.03, 16, 0.45), (0.30, 0.755, 0.04, 14, 0.22),
            (0.36, 0.76, 0.03, 12, 0.2), (0.43, 0.82, 0.03, 18, 0.35), (0.52, 0.88, 0.03, 16, 0.4),
            (0.48, 0.95, 0.04, 16, 0.5), (0.14, 0.75, 0.04, 14, 0.25), (0.25, 0.86, 0.05, 10, 0.3),
            (0.005, 0.70, 0.02, 14, 0.7)]


def build_grass_uv(c):
    """Cast camera rays through the frame spots in GRASS_UV and grow tufts where they land."""
    cam = bpy.data.objects[CAM]
    rocks = [o for o in bpy.data.objects if o.name.startswith('S07_rock')]
    hidden = [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE') and o not in rocks and not o.hide_get()]
    for o in hidden:
        o.hide_set(True)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    rnd = random.Random(SEED + 5)
    bm = bmesh.new()
    cl = bm.loops.layers.color.new('Col')
    org = cam.matrix_world.translation
    placed = 0
    for (u, v, sp, n, hmax) in GRASS_UV:
        for _ in range(n):
            p = frame_to_depth(u + rnd.gauss(0, sp * 0.5), v + rnd.gauss(0, sp * 0.3), 10.0)
            hit, loc, nor, *_ = bpy.context.scene.ray_cast(deps, org, (p - org).normalized())
            if not hit or nor.z < -0.1:
                continue
            for _b in range(rnd.randint(9, 16)):
                r = loc + Vector((rnd.uniform(-0.08, 0.08), rnd.uniform(-0.08, 0.08), -0.02))
                up = (Vector((0, 0, 1)) * 2 + nor).normalized()
                bend = Vector((rnd.random() - 0.5, rnd.random() - 0.5, 0)).normalized()
                _blade(bm, cl, r, up, hmax * (0.4 + 0.6 * rnd.random()), 0.010 + 0.008 * rnd.random(), bend, rnd)
            placed += 1
    for o in hidden:
        o.hide_set(False)
    ob = _obj('S07_grass', bm, [grass_mat()], c)
    print('grass tufts', placed, 'faces', len(ob.data.polygons))
    return ob


# ---------------------------------------------------------------- look + build
ROBOT_SINK = -0.06   # dome bottom rests in the rock (Muse blockout review: no sky gap)
LIGHTS = [  # name, type, location, rotation (deg), energy, colour, size
    ('L_sun', 'SUN', (0, 0, 10), (80, 0, 135), 14.0, (1.0, 0.70, 0.45), 0),
    ('L_fill_cam', 'AREA', (-7, -12, 4), (70, 0, -60), 300.0, (0.55, 0.68, 0.85), 8),
]
SUN_EXCLUDE = ('S07_N', 'S07_N_rim_front', 'S07_N_rim_back',             # no hot glints
               'Right_SideModule', 'Left_SideModule', 'Face_Bezel', 'Face_Display')
FILL_EXCLUDE = ('S07_tree_branch', 'S07_tree_leaves')                   # tree stays a silhouette


def _link_exclude(light, coll_name, names):
    ll = bpy.data.collections.get(coll_name) or bpy.data.collections.new(coll_name)
    for o in list(ll.objects):
        ll.objects.unlink(o)
    for n in names:
        if n in bpy.data.objects:
            ll.objects.link(bpy.data.objects[n])
    light.light_linking.receiver_collection = ll
    for co in ll.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'


def look(c):
    sc = bpy.context.scene
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    w = sc.world
    w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.10, 0.14, 0.20, 1)
    bg.inputs['Strength'].default_value = 2.0
    # an EEVEE world volume is infinite and swallows the sun: no world haze in this scene
    outw = next(n for n in nt.nodes if n.type == 'OUTPUT_WORLD')
    for lk in list(outw.inputs['Volume'].links):
        nt.links.remove(lk)
    sc.eevee.use_raytracing = True
    for name, typ, loc, rot, energy, col, size in LIGHTS:
        o = bpy.data.objects.get(name)
        if o is None:
            o = bpy.data.objects.new(name, bpy.data.lights.new(name, typ))
            c.objects.link(o)
        o.location = loc
        o.rotation_euler = [math.radians(a) for a in rot]
        o.data.energy = energy
        o.data.color = col
        if typ == 'AREA':
            o.data.size = size
        if typ == 'SUN':
            o.data.angle = math.radians(2)
    _link_exclude(bpy.data.objects['L_sun'], 'LL_sun', SUN_EXCLUDE)
    _link_exclude(bpy.data.objects['L_fill_cam'], 'LL_fill', FILL_EXCLUDE)


ROCKS = [  # name, blockout, subdiv, seed, flat, cap
    ('S07_rock_pedestal', 'BLK_rock_pedestal', 5, 1, (-0.3, -0.2, 0.7, 2.2), (0, 0, 0.30, 0.10)),
    ('S07_rock_ledge', 'BLK_rock_ledge', 5, 2, None, (0, 0, 0.10, 0.10)),
    ('S07_rock_fg_L', 'BLK_rock_fg_L', 5, 3, None, (-2.96, -6.84, -0.15, 0.04)),
    ('S07_rock_fg_M', 'BLK_rock_fg_M', 4, 4, None, (-1.51, -8.8, -0.55, 0.05)),
]


def build():
    c = coll('PROPS')
    bd = coll('BACKDROP')
    L = bpy.data.objects
    for o in bpy.data.collections['LAYOUT'].objects:
        o.hide_set(True)
        o.hide_render = True
    L['Root'].location.z = ROBOT_SINK
    build_backdrop(bd)
    for name, blk, sub, seed, flat, cap in ROCKS:
        build_rock(name, L[blk], c, sub, seed, flat=flat, cap=cap)
    build_trail(c, radius=0.38)
    bpy.data.objects['S07_trail_halo'].data.materials[0].node_tree.nodes['Emission'].inputs['Strength'].default_value = 0.25
    build_glass_n(c)
    build_orbit(c)
    bpy.data.materials['M_Orbit_S07'].node_tree.nodes['Emission'].inputs['Strength'].default_value = 4.0
    build_tree(c)
    build_grass_uv(c)
    look(c)
