"""S01 'Awakening' hero — scene v2 (workflow v2, built live in Blender).

Runs inside assets-model/s01_hero_v2.blend (camera CAM_S01_hero + robot rig in REF).
Blockout: frame-fitted volumes for the room shell, window view, floor disc, ceiling ring
and plants; detail passes replace them in place.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts_lib as P  # noqa: E402
from s02_portal_v2 import coll, TEX  # noqa: E402
import s07_future_v2 as S7  # noqa: E402

CAM = 'CAM_S01_hero'
S7.CAM = CAM
frame_to_plane = S7.frame_to_plane
frame_to_depth = S7.frame_to_depth
_obj = S7._obj
_emit_mat = S7._emit_mat

# The ref's city horizon sits at frame y 0.70 and the floor disc just under it (0.77), so
# the eye is at robot height looking slightly up across a large atrium; the robot floats.
CAMERA = dict(location=(0.0, -13.0, 1.7), rotation_deg=(98.0, 0.0, 0.0), lens=28.0)
ROBOT = dict(location=(-2.15, -5.0, 1.25), tilt_deg=15.0, yaw_deg=22.0,
             # pass2 pose (Muse): ~15 deg lean, reaching arm foreshortened toward the camera,
             # open hand turned palm-out with spread fingers, left arm out to the side.
             shoulder_r=(0.6399, -0.6784, -0.1693, -0.3189),
             shoulder_l=(0.8396, -0.4299, -0.2995, -0.1431),
             wrist_r=(0.1268, 0.8734, 0.1801, 0.4344),
             wrist_r_loc=(-0.079, 0.0, -0.80),   # out to the forearm shell tip (was buried 0.15 m inside)
             palm_r_scale=1.6,
             fingers_r=((0.9336, 0.1384, -0.0559, 0.3258), (0.9925, 0.0471, -0.019, 0.1108),
                        (0.9925, -0.0471, 0.019, -0.1108), (0.9336, -0.1384, 0.0559, -0.3258)),
             # finger meshes re-attached to their joint empties (rig quirk: they floated ~0.45 m off)
             finger_mesh_loc={'Hand_R_Finger_1': (1.044, 0.1397, -0.2131), 'Hand_R_Finger_2': (1.0067, 0.0979, -0.1845),
                              'Hand_R_Finger_3': (0.993, 0.0507, -0.1687), 'Hand_R_Finger_4': (1.1147, -0.0484, -0.3107),
                              'Hand_R_Thumb': (1.0713, 0.0046, -0.4434),
                              'Hand_L_Finger_1': (-1.044, 0.1394, -0.2135), 'Hand_L_Finger_2': (-1.007, 0.0982, -0.184),
                              'Hand_L_Finger_3': (-0.9948, 0.0416, -0.1821), 'Hand_L_Finger_4': (-1.103, -0.0482, -0.3055),
                              'Hand_L_Thumb': (-1.0385, 0.0284, -0.3825)},
             wrist_l_loc=(0.0794, 0.0, -0.8032),
             fingers_l=((0.9511, 0.1079, 0.0436, -0.2863), (0.9945, 0.0365, 0.0147, -0.0968),
                        (0.9945, -0.0365, -0.0147, 0.0968), (0.9511, -0.1079, -0.0436, 0.2863)))


def setup_camera_robot():
    L = bpy.data.objects
    cam = L[CAM]
    cam.location = CAMERA['location']
    cam.rotation_euler = [math.radians(a) for a in CAMERA['rotation_deg']]
    cam.data.lens = CAMERA['lens']
    r = L['Root']
    r.location = ROBOT['location']
    r.rotation_quaternion = Euler((0, math.radians(ROBOT['tilt_deg']), math.radians(ROBOT['yaw_deg'])), 'ZYX').to_quaternion()
    L['Shoulder_R'].rotation_quaternion = Quaternion(ROBOT['shoulder_r'])
    L['Shoulder_L'].rotation_quaternion = Quaternion(ROBOT['shoulder_l'])
    L['Wrist_R'].location = ROBOT['wrist_r_loc']
    L['Wrist_R'].rotation_quaternion = Quaternion(ROBOT['wrist_r'])
    L['Palm_R'].scale = (ROBOT['palm_r_scale'],) * 3
    for i, q in enumerate(ROBOT['fingers_r']):
        L['Finger_%d_R' % (i + 1)].rotation_quaternion = Quaternion(q)
    L['Wrist_L'].location = ROBOT['wrist_l_loc']
    for i, q in enumerate(ROBOT['fingers_l']):
        L['Finger_%d_L' % (i + 1)].rotation_quaternion = Quaternion(q)
    for n, loc in ROBOT['finger_mesh_loc'].items():
        L[n].location = loc
    # white back of the hand like the ref (palm mesh is single-user)
    L['Hand_R_Palm'].data.materials[0] = bpy.data.materials['MAT_WhitePolymer']
    bpy.context.view_layer.update()


def _mat(name, hexc, **kw):
    return P.material(name, hexc, **kw)


def _plane_quad(name, corners, mat, c):
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in corners])
    return _obj(name, bm, [mat], c, smooth=False)


def blk_floor(c):
    m = _mat('BLK_M_floor', '#3A4448', roughness=0.25, metallic=0.2)
    s = 40
    return _plane_quad('BLK_floor', [(-s, -20, 0), (s, -20, 0), (s, 40, 0), (-s, 40, 0)], m, c)


DISC_SQUASH = 1.7


def blk_disc(c):
    """Floor disc with the N: centre and outer ring traced from the ref (centre frame 0.51, 0.77)."""
    ctr = frame_to_plane(0.51, 0.768, 0.0)
    edge = frame_to_plane(0.30, 0.768, 0.0)
    R = (edge - ctr).length
    bm = bmesh.new()
    P.disc(bm, R, 0.0, 0.03, seg=96)
    ob = _obj('BLK_disc', bm, [_emit_mat('BLK_M_disc', '#3DE8A6', 1.5, additive=False)], c)
    ob.location = (ctr.x, ctr.y, 0.0)
    ob.scale.y = DISC_SQUASH  # depth-stretched so the hero view shows the ref's ellipse height
    return ob, ctr, R


def blk_ceiling_ring(c, ctr):
    """Ceiling with a big oval opening: the far inner lip lands at frame y ~0.20 and the
    hole spans x ~0.27-0.73 like the ref (seen from below, near rim above the frame)."""
    bm = bmesh.new()
    seg = 96
    rin, rout, z0, z1 = CEIL['r_in'], CEIL['r_out'], CEIL['z'], CEIL['z'] + 0.6
    inner_lo = [bm.verts.new((rin * math.cos(2 * math.pi * i / seg), rin * math.sin(2 * math.pi * i / seg), z0)) for i in range(seg)]
    outer_lo = [bm.verts.new((rout * math.cos(2 * math.pi * i / seg), rout * math.sin(2 * math.pi * i / seg), z0)) for i in range(seg)]
    inner_hi = [bm.verts.new((v.co.x, v.co.y, z1)) for v in inner_lo]
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((inner_lo[i], inner_lo[j], outer_lo[j], outer_lo[i]))
        bm.faces.new((inner_hi[i], inner_hi[j], inner_lo[j], inner_lo[i]))
    ob = _obj('BLK_ceiling_ring', bm, [_mat('BLK_M_ring', '#3A4549', roughness=0.35)], c)
    ob.location = (ctr.x + CEIL['centre'][0], ctr.y + CEIL['centre'][1], CEIL['centre'][2])
    return ob


CEIL = dict(centre=(0.0, -6.0, 13.0), r_in=10.0, r_out=17.0, z=0.0)  # offset from the disc centre


def blk_window_wall(c, ctr):
    """Curved back wall (half cylinder) with one big arched window opening on the left half."""
    m = _mat('BLK_M_wall', '#2A3337', roughness=0.4)
    R = 16.0
    H = 21.0
    bm = bmesh.new()
    seg = 64
    a0, a1 = math.radians(-10), math.radians(190)
    # window opening (angles in deg measured from +X, CCW): roughly 95..170, z 1.0..6.5
    for i in range(seg):
        aa = a0 + (a1 - a0) * i / seg
        ab = a0 + (a1 - a0) * (i + 1) / seg
        amid = math.degrees((aa + ab) / 2)
        zs = [0.0, H] if not (WINDOW_A[0] < amid < WINDOW_A[1]) else [0.0, WINDOW_Z[0], WINDOW_Z[1], H]
        spans = [(zs[0], zs[1])] if len(zs) == 2 else [(zs[0], zs[1]), (zs[2], zs[3])]
        for z0, z1 in spans:
            vs = [bm.verts.new((ctr.x + R * math.cos(a), ctr.y + R * math.sin(a), z)) for a, z in
                  ((aa, z0), (ab, z0), (ab, z1), (aa, z1))]
            bm.faces.new(vs)
    return _obj('BLK_window_wall', bm, [m], c, smooth=False)


WINDOW_A = (68.0, 206.0)
WINDOW_Z = (0.4, 19.0)


def blk_window_view(c, scale=0.556):
    """Painted sunset city card behind the window: the landmark tower lands at frame x 0.50
    with its top at y ~0.45 and the horizon at y 0.70, like the ref. Mirrored at the sides."""
    dist = 120.0
    tower_u, horizon_v, top_v = 0.52, 0.70, 0.27  # in the painting
    # frame position of painting corners: frame = f0 + scale * (painting - p0)
    fx0 = 0.50 - scale * tower_u
    fy0 = 0.70 - scale * horizon_v
    corners_uv = [(-0.6, 1.0), (1.6, 1.0), (1.6, 0.0), (-0.6, 0.0)]   # painting u,v (v up)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    vs = []
    for pu, pv in corners_uv:
        fx = fx0 + scale * pu
        fy = fy0 + scale * (1 - pv)
        vs.append(bm.verts.new(frame_to_depth(fx, fy, dist)))
    f = bm.faces.new(vs)
    for lp, (pu, pv) in zip(f.loops, corners_uv):
        lp[uvl].uv = (pu, pv)
    m = bpy.data.materials.get('M_Window_City') or bpy.data.materials.new('M_Window_City')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEX, 's01_window_city.png'), check_existing=True)
    tex.extension = 'MIRROR'
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    ob = _obj('S01_window_city', bm, [m], c, smooth=False)
    ob.visible_shadow = False
    return ob


def blk_plants(c):
    m = _mat('BLK_M_plant', '#2F6B3A', roughness=0.6)
    out = []
    for name, (u, v, dist, r) in {'BLK_plant_L': (0.06, 0.62, 5.0, 0.55), 'BLK_plant_R': (0.93, 0.9, 3.2, 0.55)}.items():
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
        ob = _obj(name, bm, [m], c)
        ob.location = frame_to_depth(u, v, dist)
        out.append(ob)
    return out


def blk_pillars(c):
    m = _mat('BLK_M_pillar', '#20282B', roughness=0.4)
    out = []
    for name, (u, dist) in {'BLK_pillar_L': (0.02, 6.0), 'BLK_wall_R': (0.95, 7.0)}.items():
        p = frame_to_plane(u, 0.85, 0.0)
        d = (p - bpy.data.objects[CAM].location).normalized()
        p = bpy.data.objects[CAM].location + d * dist
        bm = bmesh.new()
        S7_box = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(0.8, 0.8, 9.0), verts=S7_box['verts'])
        bmesh.ops.translate(bm, vec=(p.x, p.y, 4.5), verts=S7_box['verts'])
        out.append(_obj(name, bm, [m], c, smooth=False))
    return out


def blockout():
    setup_camera_robot()
    c = coll('LAYOUT')
    bd = coll('BACKDROP')
    blk_floor(c)
    disc, ctr, R = blk_disc(c)
    blk_ceiling_ring(c, ctr)
    blk_window_wall(c, ctr)
    blk_window_view(bd)
    blk_plants(c)
    blk_pillars(c)
    print('disc centre', tuple(round(v, 2) for v in ctr), 'R', round(R, 2))


# ====================================================================== pass1 detail
import random  # noqa: E402
from mathutils import Matrix  # noqa: E402

S03_BLEND = os.path.join(os.path.dirname(TEX), 's03_lab_v2.blend')


def _tube(bm, pts, r, seg=8, closed=False):
    rings = []
    n = len(pts)
    for i, p in enumerate(pts):
        a = pts[(i + 1) % n] if closed else pts[min(i + 1, n - 1)]
        b = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        t = (a - b).normalized()
        u = t.orthogonal().normalized()
        v = t.cross(u)
        rings.append([bm.verts.new(p + (u * math.cos(k * 2 * math.pi / seg) + v * math.sin(k * 2 * math.pi / seg)) * r)
                      for k in range(seg)])
    for i in range(n if closed else n - 1):
        r0, r1 = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))


def _circle(cx, cy, z, R, n=128):
    return [Vector((cx + R * math.cos(2 * math.pi * i / n), cy + R * math.sin(2 * math.pi * i / n), z)) for i in range(n)]


def room_mats():
    return dict(
        floor=_mat('M_S01_Floor', '#161D20', roughness=0.7, metallic=0.1),
        wall=_mat('M_S01_Wall', '#2C3C42', roughness=0.5, metallic=0.2),
        frame=_mat('M_S01_Frame', '#8D989E', roughness=0.25, metallic=0.85),
        ceil=_mat('M_S01_Ceiling', '#1A2225', roughness=0.35, metallic=0.5),
        plate=_mat('M_S01_DiscPlate', '#141B1D', roughness=0.3, metallic=0.5),
        seam=_mat('M_S01_Seam', '#3C474C', roughness=0.3, metallic=0.6),
    )


def build_floor(c, M, ctr, R):
    """Glossy dark floor + concentric seam rings around the disc (the ref floor pattern)."""
    s = 60
    _plane_quad('S01_floor', [(-s, -20, 0), (s, -20, 0), (s, 50, 0), (-s, 50, 0)], M['floor'], c)
    bm = bmesh.new()
    for rr in (1.25, 1.55, 1.9, 2.4):
        _tube(bm, _circle(0, 0, 0.004, R * rr, 160), 0.03, 4, closed=True)
    ob = _obj('S01_floor_seams', bm, [M['seam']], c, smooth=False)
    ob.location = (ctr.x, ctr.y, 0)
    ob.scale.y = DISC_SQUASH
    return ob


def build_disc(c, M, ctr, R):
    """Dark plate, three glowing rings and the emerald N in the middle (the ref floor emblem)."""
    bm = bmesh.new()
    P.disc(bm, R * 0.8, 0.0, 0.05, seg=128)
    plate = _obj('S01_disc_plate', bm, [M['plate']], c)
    plate.location = (ctr.x, ctr.y, 0)
    plate.scale.y = DISC_SQUASH
    bm = bmesh.new()
    for rr, w in ((0.75, 0.03), (0.71, 0.02), (0.53, 0.018)):   # thin double outer ring + inner ring, ref size
        _tube(bm, _circle(0, 0, 0.07, R * rr, 160), w, 6, closed=True)
    rings = _obj('S01_disc_rings', bm, [_emit_mat('M_S01_DiscRing', '#3DF2B5', 1.4)], c)
    rings.location = plate.location
    rings.scale.y = DISC_SQUASH
    rings.visible_shadow = False
    name = 'S01_disc_logo'
    cu = bpy.data.curves.get(name)
    if not cu:
        with bpy.data.libraries.load(S03_BLEND) as (src, dst):
            dst.curves = ['S03_platform_logo']
        cu = dst.curves[0]
        cu.name = name
    ob = bpy.data.objects.get(name) or bpy.data.objects.new(name, cu)
    if ob.name not in c.objects:
        c.objects.link(ob)
    cu.extrude = 0.02
    cu.materials.clear()
    cu.materials.append(_emit_mat('M_S01_DiscLogo', '#1FC98A', 0.9))   # emerald, not blown white
    ob.rotation_euler = (0, 0, 0)
    ob.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    s = (R * 0.42) / max(ob.dimensions.x, 1e-3)
    ob.scale = (s, s * DISC_SQUASH, s)
    ob.location = (ctr.x, ctr.y, 0.08)
    ob.visible_shadow = False
    return plate


def build_ceiling(c, M, ctr):
    """Dark floating ceiling ring: emerald lip strip round the hole + light pods underneath."""
    ring = blk_ceiling_ring(c, ctr)
    old = bpy.data.objects.get('S01_ceiling_ring')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ring.name = 'S01_ceiling_ring'
    ring.data.materials.clear()
    ring.data.materials.append(M['ceil'])
    cx, cy, cz = ring.location
    bm = bmesh.new()
    _tube(bm, _circle(0, 0, -0.08, CEIL['r_in'] + 0.35, 192), 0.09, 6, closed=True)
    lip = _obj('S01_ceiling_lip', bm, [_emit_mat('M_S01_CeilLip', '#5CF5CF', 5.0)], c)
    lip.location = (cx, cy, cz)
    lip.visible_shadow = False
    bm = bmesh.new()
    for i in range(14):
        a = 2 * math.pi * i / 14 + 0.2
        p = Vector(((CEIL['r_in'] + 2.6) * math.cos(a), (CEIL['r_in'] + 2.6) * math.sin(a), -0.04))
        t = Vector((-math.sin(a), math.cos(a), 0))
        _tube(bm, [p - t * 0.7, p + t * 0.7], 0.08, 6)
    pods = _obj('S01_ceiling_pods', bm, [_emit_mat('M_S01_CeilPod', '#5CF5CF', 6.0)], c)
    pods.location = (cx, cy, cz)
    pods.visible_shadow = False
    # dark cap above the oval hole: the ref hole reads as a deep dark recess, not open sky
    bm = bmesh.new()
    P.disc(bm, CEIL['r_in'] + 1.0, 3.0, 3.2, seg=96)
    cap = _obj('S01_ceiling_cap', bm, [_mat('M_S01_Recess', '#0B1012', roughness=0.6)], c)
    cap.location = (cx, cy, cz)
    return ring


def build_walls(c, M, ctr):
    wall = blk_window_wall(c, ctr)
    old = bpy.data.objects.get('S01_wall')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    wall.name = 'S01_wall'
    wall.data.materials.clear()
    wall.data.materials.append(M['wall'])
    Rw = 16.0
    bm = bmesh.new()
    a0, a1 = math.radians(WINDOW_A[0]), math.radians(WINDOW_A[1])
    for z in WINDOW_Z:
        pts = [Vector((ctr.x + (Rw - 0.2) * math.cos(a0 + (a1 - a0) * i / 80),
                       ctr.y + (Rw - 0.2) * math.sin(a0 + (a1 - a0) * i / 80), z)) for i in range(81)]
        _tube(bm, pts, 0.28, 8)
    am = a0 + (a1 - a0) * 0.36
    for a, rr in ((a0, 0.35), (a1, 0.35), (am, 0.18)):
        p0 = Vector((ctr.x + (Rw - 0.2) * math.cos(a), ctr.y + (Rw - 0.2) * math.sin(a), WINDOW_Z[0]))
        _tube(bm, [p0, p0 + Vector((0, 0, WINDOW_Z[1] - WINDOW_Z[0]))], rr, 8)
    _obj('S01_window_frame', bm, [M['frame']], c)
    em = _emit_mat('M_S01_Strip', '#3DF2B5', 5.0)
    bm = bmesh.new()
    for (u, v0, v1, dist) in ((0.012, 0.05, 0.62, 6.0), (0.965, 0.05, 0.75, 8.0), (0.985, 0.1, 0.8, 7.0)):
        _tube(bm, [frame_to_depth(u, v0, dist), frame_to_depth(u, v1, dist)], 0.035, 6)
    for (u0, u1, v, dist) in ((0.73, 0.87, 0.755, 14.0), (0.60, 0.70, 0.735, 20.0), (0.0, 0.12, 0.84, 7.0)):
        _tube(bm, [frame_to_depth(u0, v, dist), frame_to_depth(u1, v, dist)], 0.03, 6)
    st = _obj('S01_strips', bm, [em], c)
    st.visible_shadow = False
    return wall


def build_pillars(c, M):
    """Left pillar (narrow, so the window opens to frame x ~0.06) and the dark right wall."""
    out = []
    for name, (u, dist, w) in {'S01_pillar_L': (-0.03, 6.0, 0.45), 'S01_wall_R': (0.97, 7.0, 1.6)}.items():
        p = frame_to_depth(u, 0.6, dist)
        bm = bmesh.new()
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w, 0.8, 22.0), verts=r['verts'])
        bmesh.ops.translate(bm, vec=(p.x, p.y, 11.0), verts=r['verts'])
        out.append(_obj(name, bm, [M['wall']], c, smooth=False))
    return out


def _leaf_plant(bm, cl, base, h, n, rnd, leaf_len=(0.28, 0.42), spread=0.55):
    """Rubber-plant style: stems fanning up from the pot, broad oval leaves along them."""
    dark = Vector((0.02, 0.07, 0.03))
    lit = Vector((0.26, 0.52, 0.14))
    for i in range(n):
        ang = rnd.uniform(0, 2 * math.pi)
        tip = base + Vector((math.cos(ang) * spread * rnd.uniform(0.4, 1), math.sin(ang) * spread * rnd.uniform(0.4, 1),
                             h * rnd.uniform(0.6, 1.0)))
        for k in range(6):
            t = 0.35 + 0.65 * k / 5
            p = base.lerp(tip, t) + Vector((0, 0, math.sin(t * math.pi) * 0.1))
            L = rnd.uniform(*leaf_len)
            W = L * 0.5
            out = (p - base).normalized()
            rot = Matrix.Rotation(math.atan2(out.y, out.x) - math.pi / 2 + rnd.uniform(-0.6, 0.6), 3, 'Z') @ \
                Matrix.Rotation(rnd.uniform(0.4, 1.2), 3, 'X')
            prof = [(0, 0), (W * 0.5, L * 0.3), (W * 0.42, L * 0.7), (0, L), (-W * 0.42, L * 0.7), (-W * 0.5, L * 0.3)]
            vs = [bm.verts.new(p + rot @ Vector((x, y, 0.03 * math.sin(y / L * math.pi)))) for x, y in prof]
            f = bm.faces.new(vs)
            col = dark.lerp(lit, rnd.random() ** 1.5)
            for lp in f.loops:
                lp[cl] = (col.x, col.y, col.z, 1.0)


LEAF_VALUE = 1.8
LEAF_GLOW = 0.9   # S01 leaves read lighter than S07's tree (ref plant_L is a bright sunlit green)


def _bright_leaf(base, value):
    """Copy of the shared leaf material with the vertex colour lifted, so S07 is untouched."""
    m = bpy.data.materials.get('M_S01_Leaf')
    if m:
        return m
    m = base.copy()
    m.name = 'M_S01_Leaf'
    nt = m.node_tree
    vc = next(n for n in nt.nodes if n.type == 'VERTEX_COLOR')
    hs = nt.nodes.new('ShaderNodeHueSaturation')
    hs.inputs['Value'].default_value = value
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    nt.links.new(hs.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = LEAF_GLOW   # sunlit leaves, not black cut-outs
    for l in list(vc.outputs['Color'].links):
        nt.links.new(hs.outputs['Color'], l.to_socket)
    nt.links.new(vc.outputs['Color'], hs.inputs['Color'])
    return m


def build_plants(c):
    rnd = random.Random(11)
    leaf = _bright_leaf(S7.leaf_mat(), LEAF_VALUE)
    pot = _mat('M_S01_Pot', '#9AA2A2', roughness=0.55)
    obs = []
    for name, (u, v, dist, h, n, potr) in {'S01_plant_L': (-0.035, 0.80, 5.6, 1.7, 15, 0.38),
                                           'S01_plant_R': (0.97, 1.08, 3.6, 0.9, 6, 0.0)}.items():
        base = frame_to_depth(u, v, dist)
        if potr:  # pot stands on the floor; the plant grows from its rim
            base.z = 0.75
        bm = bmesh.new()
        cl = bm.loops.layers.color.new('Col')
        _leaf_plant(bm, cl, base, h, n, rnd, leaf_len=(0.3, 0.5) if potr else (0.3, 0.45), spread=0.6)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        obs.append(_obj(name, bm, [leaf], c))
        if potr:
            bm = bmesh.new()
            P.disc(bm, potr, 0.0, 0.78, seg=48, r_top=potr * 1.15)
            po = _obj(name + '_pot', bm, [pot], c)
            po.location = (0, 0, 0)
            po.data.transform(Matrix.Translation((base.x, base.y, 0)))
            obs.append(po)
    return obs


SWIRL_BACK = 0.35


def build_swirl(c):
    """Emerald energy swirl round the reaching hand: three loose spiral ribbons + sparks."""
    bpy.context.view_layer.update()
    hand = bpy.data.objects['RightHand_Anchor'].matrix_world.translation.copy()
    cam = bpy.data.objects[CAM].matrix_world.translation
    view = (hand - cam).normalized()
    hand = hand + view * SWIRL_BACK   # sit behind the open hand so the fingers stay clear
    u = view.orthogonal().normalized()
    w = view.cross(u)
    rnd = random.Random(5)
    bm = bmesh.new()
    for k, (R0, tilt, turns, ph) in enumerate(((0.75, 0.35, 1.3, 0.0), (0.95, -0.25, 1.1, 2.0), (0.6, 0.6, 1.6, 4.0))):
        pts = []
        for i in range(140):
            t = i / 139
            a = ph + t * turns * 2 * math.pi
            r = R0 * (0.65 + 0.35 * math.sin(t * math.pi))
            p = hand + (u * math.cos(a) + w * math.sin(a) * (0.55 + tilt * 0.3)) * r + view * (abs(math.sin(a) * tilt) * 0.4)
            p += Vector((0, 0, (t - 0.5) * 0.5))
            pts.append(p)
        _tube(bm, pts, 0.005 + 0.002 * k, 6)
    sw = _obj('S01_swirl', bm, [_emit_mat('M_S01_Swirl', '#2FD88F', 0.8)], c)
    sw.visible_shadow = False
    bm = bmesh.new()
    for i in range(36):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0.4, 1.1)
        p = hand + (u * math.cos(a) + w * math.sin(a) * 0.6) * r + view * rnd.uniform(0.0, 0.4)
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rnd.uniform(0.008, 0.02), matrix=Matrix.Translation(p))
    sp = _obj('S01_swirl_sparks', bm, [_emit_mat('M_S01_Spark', '#B8FFEA', 1.5)], c)
    sp.visible_shadow = False
    return sw


LIGHTS = [  # name, type, location, rotation (deg), energy, colour, size
    ('L_sun_window', 'SUN', (0, 0, 20), (78, 0, 205), 1.0, (1.0, 0.78, 0.55), 0),
    ('L_fill_cam', 'AREA', (2.0, -12.0, 3.0), (80, 0, 10), 600.0, (0.65, 0.78, 0.9), 6),
    ('L_disc_glow', 'AREA', (0.4, 19.6, 0.6), (0, 0, 0), 600.0, (0.3, 1.0, 0.7), 12),
    ('L_robot_rim', 'AREA', (-6.0, 0.0, 4.0), (70, 0, -120), 800.0, (1.0, 0.8, 0.6), 4),
]


def look(c):
    sc = bpy.context.scene
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    nt = sc.world.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.06, 0.09, 0.10, 1)
    bg.inputs['Strength'].default_value = 1.5
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
    cam = bpy.data.objects[CAM].data
    cam.dof.use_dof = True
    cam.dof.focus_distance = 8.6
    cam.dof.aperture_fstop = 1.4


def build():
    setup_camera_robot()
    lay = coll('LAYOUT')
    for o in list(lay.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    c = coll('PROPS')
    bd = coll('BACKDROP')
    M = room_mats()
    ctr = frame_to_plane(0.51, 0.768, 0.0)
    R = (frame_to_plane(0.30, 0.768, 0.0) - ctr).length
    build_floor(c, M, ctr, R)
    build_disc(c, M, ctr, R)
    build_ceiling(c, M, ctr)
    build_walls(c, M, ctr)
    build_pillars(c, M)
    blk_window_view(bd)
    build_plants(c)
    build_swirl(c)
    look(c)
