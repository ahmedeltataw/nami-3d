"""S05 "Project Multiverse" scene (Workflow v2). Run inside Blender 5.3 with s05_multiverse_v2.blend open
(camera CAM_S05_hero and the robot in REF, both fitted against briefs/refs/S05.png).
World scale: platform centre at origin, floor z=0, camera at (-0.81, -22.3, 1.62) looking +Y, pitch 7 deg up.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts_lib as P  # noqa: E402
from s02_portal_v2 import _flat_arc, coll, clear, TEX, S03_BLEND  # noqa: E402
from s04_idea_v2 import _obj, _keyed_card_mat, _card, _tex  # noqa: E402

GLOBE_C = Vector((-0.2, 0.0, 3.65))
GLOBE_R = 2.36
CAM = 'CAM_S05_hero'

# bubble name -> (centre, radius, image) ; fitted by ray from the reference circles
BUBBLES = {
    'ecommerce': ((-7.15, -2.70, 4.85), 1.15, 's05_bubble_ecommerce.png'),
    'logistics': ((-5.12, 0.68, 6.78), 1.32, 's05_bubble_logistics.png'),
    'realestate': ((3.89, 0.68, 6.78), 1.43, 's05_bubble_realestate.png'),
    'investment': ((6.48, -0.68, 4.60), 1.31, 's05_bubble_investment.png'),
    'transport': ((4.00, -1.35, 2.21), 1.26, 's05_bubble_transport.png'),
}


def mats():
    return {
        'gun': P.material('M_Metal_Gunmetal', '#4A5C5E', metallic=0.6, roughness=0.32),
        'dark': P.material('M_Metal_Dark', '#1C3436', metallic=0.85, roughness=0.32),
        'chrome': P.material('M_Metal_Chrome', '#C9D3D4', metallic=1.0, roughness=0.14),
        'emerald': P.material('M_Emissive_Emerald', '#25F2B0', emission='#25F2B0', strength=2.0),
        'mint': P.material('M_Emissive_Mint', '#7CFFD9', emission='#7CFFD9', strength=1.6),
        'core': P.material('M_Platform_Core', '#B8FFE8', emission='#9DFFDF', strength=0.5),
        'grid': P.material('M_Globe_Grid', '#35F0B0', emission='#35F0B0', strength=0.25),
        'logo': P.material('M_Emissive_Logo', '#8CFFC8', emission='#8CFFC8', strength=1.7),
        'orbit': P.material('M_Orbit', '#7CFFD9', emission='#7CFFD9', strength=1.8),
    }


def _node_mat(name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    try:
        mat.surface_render_method = 'BLENDED'
    except (AttributeError, TypeError):
        pass
    mat.use_backface_culling = False
    return mat, mat.node_tree


# ---------- platform ----------

PLAT_TOP = 1.04


def _sector(bm, r0, r1, a0, a1, z0, z1, mi=0, seg=4):
    """Closed annular sector block (angles in degrees) between z0 and z1."""
    ring = []
    for k in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * k / seg)
        ca, sa = math.cos(a), math.sin(a)
        ring.append([bm.verts.new((r * ca, r * sa, z)) for r, z in ((r0, z0), (r1, z0), (r1, z1), (r0, z1))])
    faces = []
    for k in range(seg):
        for j in range(4):
            faces.append(bm.faces.new((ring[k][j], ring[k + 1][j], ring[k + 1][(j + 1) % 4], ring[k][(j + 1) % 4])))
    faces.append(bm.faces.new(list(reversed(ring[0]))))
    faces.append(bm.faces.new(ring[-1]))
    for f in faces:
        f.material_index = mi


def build_platform(c):
    """Chunky metal drum: plinth, lower drum, emerald band, 18 armour panels, gold band, chrome lip, core."""
    M = mats()
    gold = P.material('M_Metal_Gold', '#C8A86A', metallic=1.0, roughness=0.22)
    bm = bmesh.new()
    P.disc(bm, 3.3, 0.0, 0.12, seg=128, mat_index=1, r_top=3.22)
    P.disc(bm, 2.98, 0.12, 0.45, seg=128, mat_index=0, r_top=2.92)
    P.disc(bm, 2.74, 0.45, 0.92, seg=128, mat_index=1)          # recessed core behind the panels
    P.disc(bm, 2.76, 0.92, 0.97, seg=128, mat_index=3)          # gold band
    P.disc(bm, 2.8, 0.97, 1.03, seg=128, mat_index=2, r_top=2.74)  # chrome lip
    P.disc(bm, 2.3, 1.03, PLAT_TOP - 0.005, seg=128, mat_index=1)
    for k in range(18):  # armour panels with grooves between them
        a0 = k * 20 + 1.2
        _sector(bm, 2.72, 2.9, a0, a0 + 17.6, 0.5, 0.9, mi=0, seg=4)
    plat = _obj('S05_platform', bm, [M['gun'], M['dark'], M['chrome'], gold], c)
    bm = bmesh.new()
    P.ring(bm, 2.93, 0.022, 0.475, seg=192, ring_seg=6)  # emerald band
    for k in range(18):  # slit on every panel, long bar on the front three
        a0 = k * 20 + 4
        front = 250 <= a0 <= 290
        w, z0, z1 = (14, 0.64, 0.74) if front else (5, 0.66, 0.72)
        rows = []
        for kk in range(5):
            a = math.radians(a0 + w * kk / 4)
            rows.append((bm.verts.new((2.915 * math.cos(a), 2.915 * math.sin(a), z0)),
                         bm.verts.new((2.915 * math.cos(a), 2.915 * math.sin(a), z1))))
        for kk in range(4):
            bm.faces.new((rows[kk][0], rows[kk + 1][0], rows[kk + 1][1], rows[kk][1]))
    P.ring(bm, 2.6, 0.035, 1.035, seg=192, ring_seg=8)
    P.ring(bm, 3.28, 0.025, 0.125, seg=192, ring_seg=6)
    _obj('S05_platform_lights', bm, [M['emerald']], c)
    bm = bmesh.new()
    P.disc(bm, 2.1, PLAT_TOP - 0.01, PLAT_TOP, seg=96)
    _obj('S05_platform_core', bm, [M['core']], c)
    bm = bmesh.new()
    _flat_arc(bm, 4.6, 0.04, 0, 360, 0, seg=200)
    _flat_arc(bm, 3.75, 0.025, 0, 360, 0, seg=200)
    fr = _obj('S05_floor_rings', bm, [P.material('M_Emissive_FloorRing', '#25F2B0', emission='#25F2B0',
                                                  strength=1.6)], c)
    fr.location.z = 0.004
    return plat


def build_beam(c):
    """Light column from the platform core up into the globe (fades upward)."""
    mat, nt = _node_mat('M_Beam')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = 0.3
    mr.inputs['To Max'].default_value = 0.0
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*P.hex_rgb('#A8FFE6'), 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    add = nt.nodes.new('ShaderNodeAddShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], em.inputs['Strength'])
    nt.links.new(tr.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    bm = bmesh.new()
    z0, z1 = PLAT_TOP, GLOBE_C.z
    geom = bmesh.ops.create_cone(bm, cap_ends=False, segments=64, radius1=1.15, radius2=0.7, depth=z1 - z0)
    bmesh.ops.translate(bm, verts=geom['verts'], vec=(GLOBE_C.x * 0.5, 0, (z0 + z1) / 2))
    return _obj('S05_beam', bm, [mat], c)


# ---------- globe ----------

def globe_glass_mat():
    """Translucent emerald sphere: fresnel rim + procedural continents glowing brighter."""
    mat, nt = _node_mat('M_Globe_Glass')
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.6
    noise.inputs['Detail'].default_value = 6.0
    noise.inputs['Roughness'].default_value = 0.55
    land = nt.nodes.new('ShaderNodeMapRange')  # land mask
    land.inputs['From Min'].default_value = 0.52
    land.inputs['From Max'].default_value = 0.56
    dots = nt.nodes.new('ShaderNodeTexVoronoi')  # dotted land texture
    dots.inputs['Scale'].default_value = 70.0
    dmr = nt.nodes.new('ShaderNodeMapRange')
    dmr.inputs['From Min'].default_value = 0.12
    dmr.inputs['From Max'].default_value = 0.3
    dmr.inputs['To Min'].default_value = 1.0
    dmr.inputs['To Max'].default_value = 0.35
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    strength = nt.nodes.new('ShaderNodeMath')
    strength.operation = 'MULTIPLY_ADD'  # land*1.1 + fresnel
    strength.inputs[1].default_value = 0.85
    rim = nt.nodes.new('ShaderNodeMath')
    rim.operation = 'MULTIPLY_ADD'
    rim.inputs[1].default_value = 0.12
    rim.inputs[2].default_value = 0.0
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*P.hex_rgb('#35F0B0'), 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    add = nt.nodes.new('ShaderNodeAddShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(tc.outputs['Object'], dots.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], land.inputs['Value'])
    nt.links.new(dots.outputs['Distance'], dmr.inputs['Value'])
    if _tex('s05_world_dots.png'):  # real continents (Codex dotted map), UV-mapped equirectangular
        img = nt.nodes.new('ShaderNodeTexImage')
        img.image = bpy.data.images.load(os.path.join(TEX, 's05_world_dots.png'), check_existing=True)
        nt.links.new(tc.outputs['UV'], img.inputs['Vector'])
        bw = nt.nodes.new('ShaderNodeRGBToBW')
        nt.links.new(img.outputs['Color'], bw.inputs[0])
        nt.links.new(bw.outputs[0], mul.inputs[0])
        mul.inputs[1].default_value = 1.0
    else:
        nt.links.new(land.outputs['Result'], mul.inputs[0])
        nt.links.new(dmr.outputs['Result'], mul.inputs[1])
    nt.links.new(lw.outputs['Facing'], rim.inputs[0])
    nt.links.new(mul.outputs[0], strength.inputs[0])
    nt.links.new(rim.outputs[0], strength.inputs[2])
    nt.links.new(strength.outputs[0], em.inputs['Strength'])
    nt.links.new(tr.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    return mat


def _great_circle(bm, R, r, axis_rot, seg=96, rs=4):
    geom_start = len(bm.verts)
    P.ring(bm, R, r, 0.0, seg=seg, ring_seg=rs)
    bm.verts.ensure_lookup_table()
    vs = bm.verts[geom_start:]
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=axis_rot)


def build_globe(c):
    from mathutils import Matrix
    M = mats()
    root = bpy.data.objects.new('S05_globe', None)
    c.objects.link(root)
    root.location = GLOBE_C
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=GLOBE_R, calc_uvs=True)
    g = _obj('S05_globe_glass', bm, [globe_glass_mat()], c)
    g.parent = root
    g.rotation_euler = (math.radians(15), 0, math.radians(-100))  # Europe/Africa toward the camera
    bm = bmesh.new()
    for k in range(12):  # meridians
        _great_circle(bm, GLOBE_R * 1.002, 0.008, Matrix.Rotation(math.radians(15 * k), 4, 'Z')
                      @ Matrix.Rotation(math.radians(90), 4, 'X'))
    for lat in (-60, -40, -20, 0, 20, 40, 60):  # parallels
        a = math.radians(lat)
        s = len(bm.verts)
        P.ring(bm, GLOBE_R * 1.002 * math.cos(a), 0.008, GLOBE_R * 1.002 * math.sin(a), seg=96, ring_seg=4)
    grid = _obj('S05_globe_grid', bm, [M['grid']], c)
    grid.parent = root
    grid.rotation_euler = (math.radians(18), 0, math.radians(-20))
    _logo(c, M, root)
    # tilted orbit ring around the globe with a few dots on it
    bm = bmesh.new()
    P.ring(bm, GLOBE_R * 1.55, 0.022, 0.0, seg=256, ring_seg=8)
    for k in range(9):
        a = math.radians(20 + k * 37)
        geom = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.07)
        bmesh.ops.translate(bm, verts=geom['verts'],
                            vec=(GLOBE_R * 1.55 * math.cos(a), GLOBE_R * 1.55 * math.sin(a), 0))
    orb = _obj('S05_globe_orbit', bm, [M['orbit']], c)
    orb.parent = root
    orb.rotation_euler = (math.radians(14), math.radians(-9), 0)
    return root


def _logo(c, M, root):
    name = 'S05_globe_logo'
    cu = bpy.data.curves.get(name)
    if not cu:
        with bpy.data.libraries.load(S03_BLEND) as (src, dst):
            dst.curves = ['S03_platform_logo']
        cu = dst.curves[0]
        cu.name = name
    ob = bpy.data.objects.get(name) or bpy.data.objects.new(name, cu)
    if ob.name not in c.objects:
        c.objects.link(ob)
    cu.materials.clear()
    cu.materials.append(M['logo'])
    cu.extrude = 0.06
    ob.parent = root
    ob.scale = (1, 1, 1)
    ob.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    dim = max(ob.dimensions.x, ob.dimensions.z, ob.dimensions.y) or 1.0
    s = 1.9 / dim
    ob.scale = (s, s, s)
    ob.location = (0.15, -GLOBE_R * 0.55, 0.1)
    return ob


# ---------- bubbles ----------

def bubble_glass_mat():
    mat, nt = _node_mat('M_Bubble_Glass')
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.25
    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 7.0
    st = nt.nodes.new('ShaderNodeMath')
    st.operation = 'MULTIPLY'
    st.inputs[1].default_value = 2.2
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*P.hex_rgb('#7CFFD9'), 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = 0.04
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.22
    add = nt.nodes.new('ShaderNodeAddShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    nt.links.new(pw.outputs[0], st.inputs[0])
    nt.links.new(st.outputs[0], em.inputs['Strength'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    return mat


def bubble_scene_mat(name, file):
    """Mini-scene image on a disc, faded to transparent at the circular edge."""
    mat, nt = _node_mat(name)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEX, file), check_existing=True)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    vm = nt.nodes.new('ShaderNodeVectorMath')
    vm.operation = 'DISTANCE'
    vm.inputs[1].default_value = (0.5, 0.5, 0)
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.5
    mr.inputs['From Max'].default_value = 0.42
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 0.78
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['UV'], tex.inputs['Vector'])
    nt.links.new(tc.outputs['UV'], vm.inputs[0])
    nt.links.new(vm.outputs['Value'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], mix.inputs['Fac'])
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return mat


def _face_camera(ob):
    cam = bpy.data.objects[CAM]
    d = (cam.matrix_world.translation - ob.matrix_world.translation).normalized()
    ob.rotation_euler = (-d).to_track_quat('Y', 'Z').to_euler()


def build_bubbles(c):
    M = mats()
    glass = bubble_glass_mat()
    out = []
    for i, (key, (ctr, r, img)) in enumerate(BUBBLES.items()):
        root = bpy.data.objects.new(f'S05_bubble_{key}', None)
        c.objects.link(root)
        root.location = ctr
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
        g = _obj(f'S05_bubble_{key}_glass', bm, [glass], c)
        g.parent = root
        if _tex(img):
            bm = bmesh.new()
            uv = bm.loops.layers.uv.new()
            seg, rr = 48, r * 0.93
            ctrv = bm.verts.new((0, 0, 0))
            ring = [bm.verts.new((rr * math.cos(2 * math.pi * k / seg), 0, rr * math.sin(2 * math.pi * k / seg)))
                    for k in range(seg)]
            for k in range(seg):
                f = bm.faces.new((ctrv, ring[k], ring[(k + 1) % seg]))
                for loop in f.loops:
                    co = loop.vert.co
                    loop[uv].uv = (0.5 + co.x / (2 * rr), 0.5 + co.z / (2 * rr))
            d = _obj(f'S05_bubble_{key}_scene', bm, [bubble_scene_mat(f'M_Bubble_{key}', img)], c)
            d.parent = root
            bpy.context.view_layer.update()
            _face_camera(root)
        # thin tilted orbit ring around each bubble
        bm = bmesh.new()
        P.ring(bm, r * 1.28, 0.014, 0.0, seg=160, ring_seg=6)
        o = _obj(f'S05_bubble_{key}_orbit', bm, [M['orbit']], c)
        o.parent = root
        o.rotation_euler = (math.radians(-12), math.radians(8 if i % 2 else -8), 0)
        out.append(root)
    return out


def build_links(c):
    """Dashed light links from the top of the globe to the upper bubbles."""
    M = mats()
    bm = bmesh.new()
    top = GLOBE_C + Vector((0, 0, GLOBE_R * 0.75))
    for key in ('logistics', 'realestate'):
        ctr, r, _ = BUBBLES[key]
        end = Vector(ctr) - (Vector(ctr) - top).normalized() * r * 1.05
        start = top + (end - top).normalized() * GLOBE_R * 0.55
        mid = (start + end) / 2 + Vector((0, 0, 0.9))
        n = 16
        for k in range(n):
            if k % 2:
                continue
            t0, t1 = k / n, (k + 0.8) / n
            p0 = (1 - t0) ** 2 * start + 2 * (1 - t0) * t0 * mid + t0 ** 2 * end
            p1 = (1 - t1) ** 2 * start + 2 * (1 - t1) * t1 * mid + t1 ** 2 * end
            geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.03, radius2=0.03,
                                         depth=(p1 - p0).length)
            q = (p1 - p0).normalized().to_track_quat('Z', 'Y')
            bmesh.ops.rotate(bm, verts=geom['verts'], cent=(0, 0, 0), matrix=q.to_matrix())
            bmesh.ops.translate(bm, verts=geom['verts'], vec=(p0 + p1) / 2)
    return _obj('S05_links', bm, [M['orbit']], c)


# ---------- room ----------

def build_room(c):
    floor = P.material('M_Floor_Gloss_S05', '#142123', metallic=0.3, roughness=0.3)
    wall = P.material('M_Wall_Teal_S05', '#0A1F21', metallic=0.2, roughness=0.6, emission='#0E2F31', strength=0.02)
    rib = P.material('M_Rib_Dark', '#0B1A1B', metallic=0.6, roughness=0.55)
    cyan = P.material('M_Emissive_Strip', '#1FE0A8', emission='#1FE0A8', strength=2.0)
    warm = P.material('M_Emissive_Warm', '#FFD9A0', emission='#FFD9A0', strength=4.0)
    screen = P.material('M_Rack_Screen', '#0E3A36', emission='#2BD6B0', strength=0.06)
    seam = P.material('M_Floor_Seam', '#0A1416', metallic=0.2, roughness=0.5)
    # floor + tile seams
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=45)
    fl = _obj('S05_floor', bm, [floor], c)
    fl.location = (0, 10, 0)
    bm = bmesh.new()
    for k in range(-8, 9):
        g = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=g['verts'], vec=(0.05, 70, 0.01))
        bmesh.ops.translate(bm, verts=g['verts'], vec=(k * 3.6, 5, 0.005))
    for k in range(-10, 8):
        g = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=g['verts'], vec=(70, 0.05, 0.01))
        bmesh.ops.translate(bm, verts=g['verts'], vec=(0, k * 3.6, 0.005))
    _obj('S05_floor_seams', bm, [seam], c)
    # curved back wall (arc around the platform) with pillars, cyan strips and a desk glow line
    R, a0, a1 = 19.0, 8, 172
    bm = bmesh.new()
    seg = 64
    rows = []
    for k in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * k / seg)
        x, y = R * math.cos(a), R * math.sin(a) - 6
        rows.append((bm.verts.new((x, y, 0)), bm.verts.new((x, y, 16))))
    for k in range(seg):
        bm.faces.new((rows[k][0], rows[k + 1][0], rows[k + 1][1], rows[k][1]))
    _obj('S05_wall', bm, [wall], c)
    bm_p, bm_s = bmesh.new(), bmesh.new()
    for k in range(13):
        a = math.radians(a0 + (a1 - a0) * k / 12)
        x, y = (R - 0.6) * math.cos(a), (R - 0.6) * math.sin(a) - 6
        g = bmesh.ops.create_cube(bm_p, size=1.0)
        bmesh.ops.scale(bm_p, verts=g['verts'], vec=(1.2, 1.0, 16))
        bmesh.ops.rotate(bm_p, verts=g['verts'], cent=(0, 0, 0),
                         matrix=__import__('mathutils').Matrix.Rotation(a - math.pi / 2, 3, 'Z'))
        bmesh.ops.translate(bm_p, verts=g['verts'], vec=(x, y, 8))
        if 4 <= k <= 8:
            continue
        xs, ys = (R - 1.12) * math.cos(a), (R - 1.12) * math.sin(a) - 6
        g = bmesh.ops.create_cube(bm_s, size=1.0)
        bmesh.ops.scale(bm_s, verts=g['verts'], vec=(0.22, 0.05, 3.2))
        bmesh.ops.rotate(bm_s, verts=g['verts'], cent=(0, 0, 0),
                         matrix=__import__('mathutils').Matrix.Rotation(a - math.pi / 2, 3, 'Z'))
        bmesh.ops.translate(bm_s, verts=g['verts'], vec=(xs, ys, 7.5))
    _obj('S05_pillars', bm_p, [rib], c)
    _obj('S05_wall_strips', bm_s, [cyan], c)
    # desks along the wall with glowing top edge + screens
    bm_d, bm_g, bm_sc = bmesh.new(), bmesh.new(), bmesh.new()
    from mathutils import Matrix
    for k in range(12):
        a = math.radians(a0 + (a1 - a0) * (k + 0.5) / 12)
        rot = Matrix.Rotation(a - math.pi / 2, 3, 'Z')
        for bmx, rr, sc, z in ((bm_d, R - 2.2, (3.6, 1.2, 1.1), 0.55), (bm_g, R - 2.82, (3.6, 0.06, 0.05), 1.12),
                               (bm_sc, R - 1.8, (3.0, 0.05, 1.2), 1.9)):
            g = bmesh.ops.create_cube(bmx, size=1.0)
            bmesh.ops.scale(bmx, verts=g['verts'], vec=sc)
            bmesh.ops.rotate(bmx, verts=g['verts'], cent=(0, 0, 0), matrix=rot)
            bmesh.ops.translate(bmx, verts=g['verts'], vec=(rr * math.cos(a), rr * math.sin(a) - 6, z))
    _obj('S05_desks', bm_d, [rib], c)
    _obj('S05_desk_glow', bm_g, [cyan], c)
    _obj('S05_screens', bm_sc, [screen], c)
    # ceiling: dome-like tilted plane (low near the camera, rising toward the back) + ribs + warm strips
    tilt = math.radians(20)
    croot = bpy.data.objects.new('S05_ceiling_root', None)
    c.objects.link(croot)
    croot.location = (0, -1, 10)
    croot.rotation_euler = (tilt, 0, 0)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
    ceil_m = P.material('M_Ceiling_S05', '#1E3436', metallic=0.5, roughness=0.5, emission='#123C3A', strength=0.035)
    ce = _obj('S05_ceiling', bm, [ceil_m], c)
    ce.parent = croot
    ce.scale = (3, 3, 1)
    bm, bmw = bmesh.new(), bmesh.new()
    for k in range(-4, 5):  # long ribs running toward the back, fanning out
        rot = Matrix.Rotation(math.radians(k * 9), 3, 'Z')
        g = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=g['verts'], vec=(0.6, 40, 0.8))
        bmesh.ops.rotate(bm, verts=g['verts'], cent=(0, 0, 0), matrix=rot)
        bmesh.ops.translate(bm, verts=g['verts'], vec=(k * 3.2, 0, -0.4))
    for yy in (-14, -6, 2, 10):  # cross beams
        g = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=g['verts'], vec=(60, 0.5, 0.6))
        bmesh.ops.translate(bm, verts=g['verts'], vec=(0, yy, -0.35))
    rb = _obj('S05_ceiling_ribs', bm, [ceil_m], c)
    rb.parent = croot
    for x, y, z, yaw in ((-4.3, -10.0, 5.1, 22), (4.2, -10.5, 5.3, -25), (-7.5, -4.0, 7.2, 15), (7.0, -4.0, 7.4, -15)):
        g = bmesh.ops.create_cube(bmw, size=1.0)
        bmesh.ops.scale(bmw, verts=g['verts'], vec=(1.0, 0.18, 0.05))
        bmesh.ops.rotate(bmw, verts=g['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(yaw), 3, 'Z'))
        bmesh.ops.translate(bmw, verts=g['verts'], vec=(x, y, z))
    _obj('S05_ceiling_warm', bmw, [warm], c)


def ui_screen_mat():
    """Console screen: dark teal glass with glowing UI bars and a grid (procedural, no text)."""
    mat, nt = _node_mat('M_Screen_UI')
    mat.surface_render_method = 'DITHERED'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 6.0
    br.inputs['Mortar Size'].default_value = 0.04
    br.inputs['Color1'].default_value = (*P.hex_rgb('#2BD6B0'), 1)
    br.inputs['Color2'].default_value = (*P.hex_rgb('#0E3A36'), 1)
    br.inputs['Mortar'].default_value = (*P.hex_rgb('#7CFFD9'), 1)
    br.offset = 0.0
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 0.3
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['UV'], br.inputs['Vector'])
    nt.links.new(br.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return mat


def _uv_box(bm, uv, w, d, h):
    g = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=g['verts'], vec=(w, d, h))
    for f in {f for v in g['verts'] for f in v.link_faces}:
        for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = t
    return g


def build_consoles(c):
    """Side consoles with glowing UI screens near both frame edges + near pillars with cyan strips."""
    from mathutils import Matrix
    desk = P.material('M_Console_Body', '#1A2C2E', metallic=0.7, roughness=0.35)
    cyan = bpy.data.materials['M_Emissive_Strip']
    ui = ui_screen_mat()
    pillar = bpy.data.materials['M_Rib_Dark']
    for side, (x, y, yaw) in (('L', (-5.3, -13.2, 35)), ('R', (3.9, -13.0, -35))):
        bm_d, bm_s, bm_g = bmesh.new(), bmesh.new(), bmesh.new()
        uv = bm_s.loops.layers.uv.new()
        g = bmesh.ops.create_cube(bm_d, size=1.0)  # desk
        bmesh.ops.scale(bm_d, verts=g['verts'], vec=(3.2, 1.0, 1.15))
        bmesh.ops.translate(bm_d, verts=g['verts'], vec=(0, 0, 0.575))
        g = bmesh.ops.create_cube(bm_g, size=1.0)  # glowing desk edge
        bmesh.ops.scale(bm_g, verts=g['verts'], vec=(3.2, 0.05, 0.04))
        bmesh.ops.translate(bm_g, verts=g['verts'], vec=(0, -0.52, 1.15))
        for k, (sx, sz, tilt) in enumerate(((-1.05, 1.75, 18), (0.0, 1.8, 14), (1.05, 1.75, 18))):
            g = _uv_box(bm_s, uv, 0.98, 0.04, 0.62)
            bmesh.ops.rotate(bm_s, verts=g['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-tilt), 3, 'X'))
            bmesh.ops.translate(bm_s, verts=g['verts'], vec=(sx, 0.1, sz))
        rot = Matrix.Rotation(math.radians(yaw), 4, 'Z')
        for bmx, name, m in ((bm_d, 'desk', desk), (bm_g, 'desk_glow', cyan), (bm_s, 'screens', ui)):
            ob = _obj(f'S05_console_{side}_{name}', bmx, [m], c)
            ob.matrix_world = Matrix.Translation((x, y, 0)) @ rot
    # near pillars with slanted cyan strips (upper frame corners)
    bm_p, bm_s = bmesh.new(), bmesh.new()
    for x, y, lean in ((-5.0, -14.0, -12), (3.5, -14.0, 12)):
        rot = Matrix.Rotation(math.radians(lean), 3, 'Y')
        g = bmesh.ops.create_cube(bm_p, size=1.0)
        bmesh.ops.scale(bm_p, verts=g['verts'], vec=(0.45, 0.5, 4.0))
        bmesh.ops.rotate(bm_p, verts=g['verts'], cent=(0, 0, 0), matrix=rot)
        bmesh.ops.translate(bm_p, verts=g['verts'], vec=(x, y + 0.2, 4.6))
        g = bmesh.ops.create_cube(bm_s, size=1.0)
        bmesh.ops.scale(bm_s, verts=g['verts'], vec=(0.07, 0.05, 1.1))
        bmesh.ops.rotate(bm_s, verts=g['verts'], cent=(0, 0, 0), matrix=rot)
        bmesh.ops.translate(bm_s, verts=g['verts'], vec=(x + (0.12 if x < 0 else -0.12) + 3.4 * math.tan(math.radians(-lean)) * 0,
                                                          y - 0.12, 3.4))
    _obj('S05_near_pillars', bm_p, [pillar], c)
    _obj('S05_near_strips', bm_s, [cyan], c)


def build_plants(c):
    if not _tex('s03_plant_fg.png'):
        return []
    mat = _keyed_card_mat('M_Plant_Card', 's03_plant_fg.png', 0.45)
    obs = []
    for name, loc, w, h, rot in [('S05_plant_BL', (-3.6, -17.0, -0.4), 1.7, 2.5, (0, 0, 10)),
                                 ('S05_plant_BR', (2.6, -17.0, -0.3), 2.2, 3.3, (0, 0, -10)),
                                 ('S05_plant_TL', (-3.7, -17.0, 3.4), 1.6, 2.4, (180, 0, 15))]:
        ob = _card(name, mat, w, h, c)
        ob.location = loc
        ob.rotation_euler = [math.radians(a) for a in rot]
        obs.append(ob)
    return obs


LIGHTS = [  # name, type, location, rotation (deg), energy, colour, size
    ('L_globe_key', 'POINT', (-0.2, -1.0, 3.6), (0, 0, 0), 1400, (0.3, 1.0, 0.65), 2.0),
    ('L_platform_glow', 'POINT', (0.0, -1.5, 1.2), (0, 0, 0), 600, (0.35, 1.0, 0.6), 1.0),
    ('L_front_fill', 'AREA', (-2, -18, 3.6), (75, 0, 0), 500, (0.8, 0.95, 1.0), 8),
    ('L_robot_rim', 'AREA', (-1.0, -6.5, 4.0), (90, 0, 110), 900, (0.35, 1.0, 0.7), 3),
    ('L_drum_fill', 'AREA', (0.5, -9.0, 1.0), (90, 0, 0), 900, (0.8, 1.0, 0.95), 6),
    ('L_ceiling_warm', 'AREA', (0, -6, 5.8), (0, 0, 0), 400, (1.0, 0.85, 0.65), 10),
]


def look(room_name='S05_ROOM', lights=None, cam_name=None):
    s = bpy.context.scene
    room = coll(room_name)
    lights = lights or LIGHTS
    for name, typ, loc, rot, energy, col, size in lights:
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o)
        d = bpy.data.lights.get(name) or bpy.data.lights.new(name, typ)
        d.energy, d.color = energy, col
        if typ == 'AREA':
            d.size = size
        else:
            d.shadow_soft_size = size
        o = bpy.data.objects.new(name, d)
        o.location, o.rotation_euler = loc, [math.radians(a) for a in rot]
        room.objects.link(o)
    w = s.world or bpy.data.worlds.new('W')
    s.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.01, 0.03, 0.03, 1)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_WORLD')
    vol = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeVolumePrincipled'), None) or nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = 0.0015
    vol.inputs['Color'].default_value = (0.25, 0.62, 0.5, 1)
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
    cam = bpy.data.objects[cam_name or CAM].data
    cam.dof.use_dof, cam.dof.focus_distance, cam.dof.aperture_fstop = True, 21.0, 2.0
    ng = s.compositing_node_group or bpy.data.node_groups.new('S05_comp', 'CompositorNodeTree')
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
    gl.inputs['Threshold'].default_value = 0.85
    gl.inputs['Strength'].default_value = 0.35
    gl.inputs['Size'].default_value = 0.65


def build():
    props = coll('S05_PROPS')
    for o in list(props.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    build_platform(props)
    build_beam(props)
    build_globe(props)
    build_bubbles(props)
    build_links(props)
    room = coll('S05_ROOM')
    for o in list(room.objects):
        if o.type != 'LIGHT':
            bpy.data.objects.remove(o, do_unlink=True)
    build_room(room)
    build_consoles(room)
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
