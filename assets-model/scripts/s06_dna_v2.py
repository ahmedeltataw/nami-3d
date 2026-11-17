"""S06 "NAMI DNA" scene (Workflow v2). Run inside Blender 5.3 with s06_dna_v2.blend open
(camera CAM_S06_hero and the posed robot in REF, both fitted against briefs/refs/S06.png).

The stage (platform, helix, ring, room) is modelled in S05 units and parented to the empty
S06_stage, scaled 0.6, so the native-size robot fits beside the platform like the reference.
Camera, robot, monitors and the tablet live in world units.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts_lib as P  # noqa: E402
from s02_portal_v2 import coll, clear, TEX, S03_BLEND  # noqa: E402
from s04_idea_v2 import _obj, _keyed_card_mat, _card, _tex  # noqa: E402
import s05_multiverse_v2 as S5  # noqa: E402

CAM = 'CAM_S06_hero'
STAGE_SCALE = 0.6
HELIX_X = 0.28            # stage units
PLAT_SINK = -0.117        # stage units; drum top lands on the ref (frame y 0.80)
HELIX_Z0, HELIX_Z1 = S5.PLAT_TOP - 0.15, 6.20  # pass2: column box y 0.285-0.815 like the ref
HELIX_R = 1.32
N_Z = 3.38
N_BAND = 0.95             # half-height of the rung-free band around the N
RING = dict(R=5.985, y=2.497, z=8.33, tilt=6.0)  # pass2: top clears the frame (y 0.056-0.293 like the ref)
NODE_COUNT = 7            # value-pill connector anchors on the helix (right side)


def _rename(prefix_from, prefix_to, objs):
    for o in objs:
        if o.name.startswith(prefix_from):
            o.name = prefix_to + o.name[len(prefix_from):]
            if o.data is not None and hasattr(o.data, 'name'):
                o.data.name = o.name


# ---------- helix ----------

def helix_glass_mat():
    mat, nt = S5._node_mat('M_Helix_Glass')
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.3
    rim = nt.nodes.new('ShaderNodeMath')
    rim.operation = 'MULTIPLY_ADD'
    rim.inputs[1].default_value = 0.7
    rim.inputs[2].default_value = 0.08
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*P.hex_rgb('#7CFFD9'), 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = 0.05
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.25
    add = nt.nodes.new('ShaderNodeAddShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(lw.outputs['Facing'], rim.inputs[0])
    nt.links.new(rim.outputs[0], em.inputs['Strength'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    return mat


def _tube(bm, pts, r, seg=10):
    """Swept circular tube along a polyline."""
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        n = t.cross(a).normalized()
        b = t.cross(n).normalized()
        rings.append([bm.verts.new(p + (n * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * r)
                      for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


HELIX_TURNS = 1.25  # like the ref: the strands open into one wide bulb that wraps the N


def _strand(phase, turns=HELIX_TURNS, n=140):
    t_n = (N_Z - HELIX_Z0) / (HELIX_Z1 - HELIX_Z0)  # strands sit at the sides (widest) at the N's height
    pts = []
    for i in range(n + 1):
        t = i / n
        a = phase + 2 * math.pi * turns * (t - t_n)
        pts.append(Vector((HELIX_X + HELIX_R * math.cos(a), HELIX_R * math.sin(a), HELIX_Z0 + (HELIX_Z1 - HELIX_Z0) * t)))
    return pts


def helix_nodes():
    """Seven anchor points on the right side of the helix, top to bottom (stage units)."""
    out = []
    for k in range(NODE_COUNT):
        z = HELIX_Z1 - 0.55 - k * (HELIX_Z1 - HELIX_Z0 - 1.1) / (NODE_COUNT - 1)
        out.append(Vector((HELIX_X + HELIX_R * 0.92, -0.45, z)))
    return out


def build_helix(c):
    M = S5.mats()
    glass = helix_glass_mat()
    rung = P.material('M_Helix_Rung', '#C8FFF0', emission='#7CFFD9', strength=1.6)
    node = P.material('M_Helix_Node', '#2BFFC6', emission='#2BFFC6', strength=6.0)
    bm = bmesh.new()
    s1, s2 = _strand(0.0), _strand(math.pi)
    _tube(bm, s1, 0.13)
    _tube(bm, s2, 0.13)
    _obj('S06_helix_strands', bm, [glass], c)
    bm = bmesh.new()  # bright inner cores of the strands
    _tube(bm, s1, 0.035, seg=6)
    _tube(bm, s2, 0.035, seg=6)
    _obj('S06_helix_cores', bm, [P.material('M_Helix_Core', '#7CFFD9', emission='#7CFFD9', strength=1.0)], c)
    bm = bmesh.new()  # rungs between the strands
    for i in range(4, len(s1) - 2, 5):
        if abs(s1[i].z - N_Z) < N_BAND:  # keep the N clear: the helix wraps it, no bars across the letter
            continue
        _tube(bm, [s1[i].lerp(s2[i], 0.08), s1[i].lerp(s2[i], 0.92)], 0.03, seg=6)
    _obj('S06_helix_rungs', bm, [rung], c)
    bm = bmesh.new()
    for p in helix_nodes():
        g = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.12)
        bmesh.ops.translate(bm, verts=g['verts'], vec=p)
    _obj('S06_helix_nodes', bm, [node], c)
    _logo(c, M)


def _logo(c, M):
    name = 'S06_helix_logo'
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
    cu.materials.append(P.material('M_Emissive_Logo', '#3DE8A6', roughness=0.25, emission='#36F2AE', strength=4.0))  # emerald glow like the ref
    cu.extrude = 0.06
    ob.scale = (1, 1, 1)
    ob.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    dim = max(ob.dimensions) or 1.0
    s = 1.75 / dim  # pass3: N fills the helix bulb like the ref (was 2.3 in front, a billboard over the helix)
    ob.scale = (s, s, s)
    ob.location = (HELIX_X, 0.0, N_Z)  # on the helix axis: the front strand crosses in front of the N
    return ob


# ---------- ceiling ring ----------

def build_ring(c):
    metal = P.material('M_Ring_Metal', '#7E8E90', metallic=0.9, roughness=0.32, emission='#1E4A46', strength=0.9)
    em = P.material('M_Ring_Light', '#25F2B0', emission='#25F2B0', strength=6.0)
    R, y, z = RING['R'], RING['y'], RING['z']
    bm = bmesh.new()
    for k in range(16):  # segmented box ring
        a0 = k * 22.5 + 0.8
        S5._sector(bm, R - 0.3, R + 0.3, a0, a0 + 20.9, -0.18, 0.18, mi=0, seg=4)
    ob = _obj('S06_ceiling_ring', bm, [metal], c)
    ob.location = (0, y, z)
    ob.rotation_euler = (math.radians(RING['tilt']), 0, 0)
    bm = bmesh.new()  # emerald light segments on the underside and inner edge
    for k in range(16):
        if k % 2:
            continue
        a0 = k * 22.5 + 4
        S5._sector(bm, R - 0.32, R - 0.28, a0 + 3, a0 + 11, -0.15, -0.02, mi=0, seg=6)
        S5._sector(bm, R - 0.08, R + 0.08, a0 + 2, a0 + 12, -0.2, -0.18, mi=0, seg=6)
    lg = _obj('S06_ceiling_ring_lights', bm, [em], c)
    lg.location = (0, y, z)
    lg.rotation_euler = (math.radians(RING['tilt']), 0, 0)


# ---------- screens in world units ----------

def _ray_point(u, v, depth):
    """World point on the camera ray through frame (u, v) (v from top) at distance depth."""
    cam = bpy.data.objects[CAM]
    sc = bpy.context.scene
    fr = [cam.matrix_world @ p for p in cam.data.view_frame(scene=sc)]  # tr, br, bl, tl
    tl, tr, bl = fr[3], fr[0], fr[2]
    p = tl + (tr - tl) * u + (bl - tl) * v
    C = cam.matrix_world.translation
    return C + (p - C).normalized() * depth


def _image_card(name, file, w, h, c, strength=1.0):
    mat = S5._node_mat('M_' + name)[0]
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEX, file), check_existing=True)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return _card(name, mat, w, h, c)


def build_screens(c):
    """Side holo monitors with charts (far left/right) and the holo tablet in the robot's right hand."""
    cam = bpy.data.objects[CAM]
    frame = P.material('M_Monitor_Frame', '#1A2C2E', metallic=0.7, roughness=0.35)
    for name, file, u, v, depth, w, h, yaw in (('S06_monitor_L', 's06_monitor_a.png', 0.04, 0.44, 8.6, 1.75, 1.17, 40),
                                              ('S06_monitor_L2', 's06_tablet_n.png', 0.10, 0.62, 9.5, 0.9, 0.68, 30),
                                              ('S06_monitor_R2', 's06_tablet_n.png', 0.925, 0.63, 9.5, 0.8, 0.6, -30),
                                              ('S06_monitor_R', 's06_monitor_b.png', 0.97, 0.47, 9.5, 1.15, 0.77, -40)):
        if not _tex(file):
            continue
        p = _ray_point(u, v, depth)
        ob = _image_card(name, file, w, h, c, strength=1.4)
        ob.location = p - Vector((0, 0, h / 2))
        ob.rotation_euler = (math.radians(-6), 0, math.radians(yaw))
        bm = bmesh.new()
        g = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=g['verts'], vec=(w + 0.08, 0.04, h + 0.08))
        bmesh.ops.translate(bm, verts=g['verts'], vec=(0, 0.03, h / 2))
        fr = _obj(name + '_frame', bm, [frame], c)
        fr.location, fr.rotation_euler = ob.location, ob.rotation_euler
    if _tex('s06_tablet_n.png'):  # holo tablet in front of the robot's right hand
        dist = (Vector((-2.8, -1.4, 1.6)) - cam.matrix_world.translation).length - 1.0
        p = _ray_point(0.30, 0.685, dist)
        mat = S5._node_mat('M_Tablet_N')[0]
        nt = mat.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(os.path.join(TEX, 's06_tablet_n.png'), check_existing=True)
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = 1.3
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        mix.inputs['Fac'].default_value = 0.85
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        ob = _card('S06_tablet', mat, 0.95, 0.72, c)
        ob.location = p - Vector((0, 0, 0.36))
        ob.rotation_euler = (math.radians(-28), math.radians(-12), math.radians(22))


# ---------- assembly ----------

LIGHTS = [  # stage units (parented to the stage)
    ('L_helix_key', 'POINT', (0.28, -1.2, 3.6), (0, 0, 0), 900, (0.3, 1.0, 0.65), 2.0),
    ('L_platform_glow', 'POINT', (0.0, -1.5, 1.2), (0, 0, 0), 350, (0.35, 1.0, 0.6), 1.0),
    ('L_front_fill', 'AREA', (-2, -18, 3.6), (75, 0, 0), 300, (0.8, 0.95, 1.0), 8),
    ('L_robot_rim', 'AREA', (1.0, -4.0, 5.0), (70, 0, 120), 350, (0.35, 1.0, 0.7), 3),
    ('L_drum_fill', 'AREA', (0.5, -6.0, 0.9), (92, 0, 0), 500, (0.8, 1.0, 0.95), 6),
    ('L_ceiling_warm', 'AREA', (0, -6, 5.8), (0, 0, 0), 400, (1.0, 0.85, 0.65), 10),
]


def build():
    props, room, bd = coll('S06_PROPS'), coll('S06_ROOM'), coll('BACKDROP')
    for cc in (props, room, bd):
        for o in list(cc.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    stage = bpy.data.objects.new('S06_stage', None)
    props.objects.link(stage)
    before = set(bpy.data.objects)
    S5.build_platform(props)
    S5.build_beam(props)
    build_helix(props)
    build_ring(props)
    S5.build_room(room)
    S5.build_consoles(room)
    S5.build_plants(bd)
    # lights sit 0.6x closer inside the scaled stage -> scale energy by 0.6^2
    S5.look('S06_ROOM', [(n, t, l, r, e * STAGE_SCALE ** 2, c, z) for n, t, l, r, e, c, z in LIGHTS], CAM)
    new = [o for o in bpy.data.objects if o not in before]
    _rename('S05_', 'S06_', new)
    for n in ('S06_platform', 'S06_platform_core', 'S06_platform_lights', 'S06_beam'):
        ob = bpy.data.objects.get(n)
        if ob:
            ob.location.z += PLAT_SINK
    for o in new:
        if o.parent is None and o is not stage:
            o.parent = stage
    stage.scale = (STAGE_SCALE,) * 3
    bpy.context.view_layer.update()
    build_screens(room)
    # pass3: with the N moved back onto the helix axis it no longer shadows the front floor from the
    # helix key, which painted a hotspot there (floor 140%) -> the key skips the floor via light linking
    ll = bpy.data.collections.get('LL_helix_key') or bpy.data.collections.new('LL_helix_key')
    for n in ('S06_floor', 'S06_floor_seams'):
        ob = bpy.data.objects.get(n)
        if ob and ob.name not in ll.objects:
            ll.objects.link(ob)
    key = bpy.data.objects.get('L_helix_key')
    if key:
        key.light_linking.receiver_collection = ll
        for co in ll.collection_objects:
            co.light_linking.link_state = 'EXCLUDE'
    cam = bpy.data.objects[CAM].data
    cam.dof.focus_distance, cam.dof.aperture_fstop = 12.5, 2.4
    fl = bpy.data.materials.get('M_Floor_Gloss_S05')
    if fl:
        next(n for n in fl.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Roughness'].default_value = 0.45
    w = bpy.context.scene.world
    outn = next(n for n in w.node_tree.nodes if n.type == 'OUTPUT_WORLD')
    vol = outn.inputs['Volume'].links[0].from_node
    vol.inputs['Density'].default_value = 0.0007
    lay = bpy.data.collections.get('LAYOUT')
    if lay:
        lay.hide_render = True
        lay.hide_viewport = True


if __name__ == '__main__':
    build()
