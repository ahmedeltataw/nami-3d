"""S03 Creation Lab v2 (Workflow v2): camera-matched to briefs/refs/S03.png, built from parts_lib.

Run inside Blender (live MCP or headless). Positions come from the approved blockout
(camera match: lens 21.5 mm, camera (0.15, -10.6, 4.0), pitch 5.4 deg down; robot root at (0, 0, 1.0)).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else
                r'D:/website/Nami-3D/.claude/worktrees/blender-3d-models-improvement-1e361d/assets-model/scripts')
import parts_lib as P  # noqa: E402

KIT = 'S03'
PANEL_BASE = 0.45
# name: (x, y, top_z, width, yaw_deg) from the blockout
PANELS = {
    'cloud': (-8.233, 1.879, 3.889, 2.773, -10.7),
    'chart': (-5.729, 2.968, 3.750, 2.222, -7.45),
    'phone': (-3.378, 3.885, 3.926, 2.270, -4.3),
    'code': (3.725, 4.134, 4.670, 2.785, 4.6),
    'layers': (6.446, 2.968, 3.750, 2.407, 8.2),
    'headphones': (8.681, 1.611, 3.985, 2.443, 11.3),
}
CAMERA = {'location': (0.15, -10.6, 4.0), 'pitch_down_deg': 5.4, 'lens': 21.5}


def coll(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def clear(c):
    for o in list(c.objects):
        bpy.data.objects.remove(o)


def build_props():
    c = coll('S03_PROPS')
    clear(c)
    for n, (x, y, top, w, yaw) in PANELS.items():
        h = top - PANEL_BASE
        pn = P.glass_panel(f'{KIT}_panel_{n}', w, h, collection=c)
        pn.location = (x, y, PANEL_BASE)
        pn.rotation_euler = (0, 0, math.radians(yaw))
        pd = P.pedestal(f'{KIT}_pedestal_{n}', w * 0.5, collection=c)
        pd.location = (x, y, 0)
        a = bpy.data.objects.new(f'Label_{n}', None)
        c.objects.link(a)
        a.location = (x, y - 0.1, PANEL_BASE + h * 0.3)
        a.empty_display_size = 0.3
    pl = P.platform(f'{KIT}_platform', 3.06, collection=c)
    pl.location = (0, -0.3, 0)
    cr = P.ceiling_ring(f'{KIT}_ceiling_ring', 7.75, segments=16, collection=c)
    cr.location = (0, 6.5, 6.75)


CARD_WIDTH_SCALE = 0.92  # owner note 2026-11-17: cards taller and thinner than pass 2


def build_cards():
    """Frosted cards on the blockout anchors, full reference height, slimmer width."""
    c = coll('S03_PROPS')
    for n, (x, y, top, w, yaw) in PANELS.items():
        old = bpy.data.objects.get(f'{KIT}_panel_{n}')
        if old:
            bpy.data.objects.remove(old)
        pn = P.glass_panel(f'{KIT}_panel_{n}', w * CARD_WIDTH_SCALE, top - PANEL_BASE, collection=c)
        pn.location = (x, y, PANEL_BASE)
        pn.rotation_euler = (0, 0, math.radians(yaw))
    bpy.context.view_layer.update()
    build_icons()


def _circ(cx, cy, r, n=28, a0=0, a1=360):
    full = (a1 - a0) == 360
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + (0 if full else 1))]


def _rr(x0, y0, x1, y1, r):
    p = []
    for cx, cy, a in ((x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180), (x1 - r, y0 + r, 270)):
        p += _circ(cx, cy, r, 6, a, a + 90)
    return p


def _arrow(x, y, s, up=True):
    k = 1 if up else -1
    return [(x - 0.08 * s, y - 0.25 * s * k), (x + 0.08 * s, y - 0.25 * s * k), (x + 0.08 * s, y), (x + 0.2 * s, y),
            (x, y + 0.25 * s * k), (x - 0.2 * s, y), (x - 0.08 * s, y)]


def icon_materials():
    return {
        'white': P.material('M_Icon_White', '#E9FFF8', emission='#CFFFF0', strength=1.6),
        'green': P.material('M_Icon_Green', '#25F2B0', emission='#25F2B0', strength=2.0),
        'green2': P.material('M_Icon_Green2', '#19C37D', emission='#19C37D', strength=1.5),
        'blue': P.material('M_Icon_Blue', '#4FB8FF', emission='#4FB8FF', strength=2.0),
        'orange': P.material('M_Icon_Orange', '#FFB547', emission='#FFB547', strength=1.8),
        'pink': P.material('M_Icon_Pink', '#FF6FA8', emission='#FF6FA8', strength=1.8),
        'purple': P.material('M_Icon_Purple', '#9C7BFF', emission='#9C7BFF', strength=1.8),
        'dark': P.material('M_Icon_Dark', '#0B3A33', emission='#0E4A40', strength=0.4, alpha=0.9),
    }


def icon_shapes():
    cloud = (_circ(-0.42, -0.05, 0.3, 10, 90, 270) + [(-0.42, -0.35), (0.45, -0.35)] + _circ(0.45, -0.05, 0.3, 10, -90, 90)
             + _circ(0.02, 0.15, 0.42, 14, 20, 165))
    tiles = [(x, y) for y in (0.5, 0.18, -0.14) for x in (-0.25, 0, 0.25)]
    tile_cols = ['green', 'blue', 'orange', 'pink', 'purple', 'green', 'orange', 'blue', 'pink']
    return {
        'cloud': [(cloud, True, 'white', 0, 0), (_arrow(-0.12, -0.05, 1.4, True), True, 'green', 0.01, 0),
                  (_arrow(0.18, -0.12, 1.4, False), True, 'blue', 0.01, 0)],
        'chart': [(((x, -0.75), (x + 0.32, -0.75), (x + 0.32, t), (x, t)), True, 'green', 0, 0)
                  for x, t in ((-0.72, -0.25), (-0.22, 0.0), (0.28, 0.3))]
        + [([(-0.8, -0.1), (-0.35, 0.25), (0.05, 0.1), (0.6, 0.62)], False, 'white', 0.01, 0.035),
           ([(0.42, 0.7), (0.75, 0.75), (0.68, 0.42)], True, 'white', 0.01, 0)],
        'phone': [(_rr(-0.48, -0.88, 0.48, 0.88, 0.14), True, 'dark', 0, 0),
                  (_rr(-0.48, -0.88, 0.48, 0.88, 0.14), True, 'white', 0.005, 0.025)]
        + [(_rr(x - 0.11, y - 0.11, x + 0.11, y + 0.11, 0.04), True, cc, 0.01, 0) for (x, y), cc in zip(tiles, tile_cols)],
        'code': [(_rr(-0.85, -0.65, 0.85, 0.65, 0.1), True, 'dark', 0, 0), (_rr(-0.85, -0.65, 0.85, 0.65, 0.1), True, 'white', 0.005, 0.03),
                 ([(-0.85, 0.38), (0.85, 0.38)], False, 'white', 0.005, 0.025)]
        + [(_circ(x, 0.52, 0.05, 10), True, cc, 0.01, 0) for x, cc in ((-0.7, 'pink'), (-0.55, 'orange'), (-0.4, 'green'))]
        + [([(-0.25, 0.12), (-0.5, -0.12), (-0.25, -0.36)], False, 'green', 0.01, 0.035),
           ([(0.25, 0.12), (0.5, -0.12), (0.25, -0.36)], False, 'green', 0.01, 0.035),
           ([(0.1, 0.18), (-0.1, -0.42)], False, 'white', 0.01, 0.03)],
        'layers': [([(-0.8, y), (0, y + 0.32), (0.8, y), (0, y - 0.32)], True, cc, 0.01 * i, 0)
                   for i, (y, cc) in enumerate(((-0.4, 'green2'), (0.0, 'green'), (0.4, 'white')))],
        'headphones': [(_circ(0, 0.0, 0.62, 24, 0, 180), False, 'white', 0, 0.07),
                       (_rr(-0.82, -0.55, -0.42, 0.08, 0.12), True, 'green', 0.01, 0),
                       (_rr(0.42, -0.55, 0.82, 0.08, 0.12), True, 'green', 0.01, 0),
                       ([(0.62, -0.55), (0.62, -0.72), (0.22, -0.85)], False, 'white', 0.01, 0.03),
                       (_circ(0.13, -0.85, 0.09, 12), True, 'green', 0.01, 0)],
    }


BUTTON = [(_circ(0, 0, 0.5, 28), True, 'dark', 0, 0), (_circ(0, 0, 0.5, 28), True, 'white', 0.005, 0.035),
          ([(-0.25, 0), (0.22, 0)], False, 'white', 0.01, 0.05), ([(0.05, 0.18), (0.25, 0), (0.05, -0.18)], False, 'white', 0.01, 0.05)]
ICON_SCALE, ICON_Z, BUTTON_SCALE, BUTTON_Z = 0.3, 0.68, 0.16, 0.16  # fractions of card width / height


def _icon_set(prefix, shapes, panel, scale, zc, mats, c):
    from mathutils import Matrix
    loc, rot, _ = panel.matrix_world.decompose()
    base = Matrix.Translation(loc) @ rot.to_matrix().to_4x4()
    for i, (pts, cyc, mat, zoff, bev) in enumerate(shapes):
        name = f'{prefix}_{i}'
        cu = bpy.data.curves.new(name, 'CURVE')
        cu.dimensions = '2D'
        cu.fill_mode = 'BOTH' if (cyc and bev == 0) else 'NONE'
        cu.bevel_depth = bev * scale if bev else 0
        cu.extrude = 0 if bev else 0.004
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for j, (x, y) in enumerate(pts):
            sp.points[j].co = (x * scale, y * scale, 0, 1)
        sp.use_cyclic_u = cyc
        cu.materials.append(mats[mat])
        ob = bpy.data.objects.new(name, cu)
        c.objects.link(ob)
        ob.matrix_world = base @ Matrix.Translation((0, -0.03 - zoff, zc)) @ Matrix.Rotation(math.radians(90), 4, 'X')


def build_icons():
    c = coll('S03_PROPS')
    for o in list(bpy.data.objects):
        if o.name.startswith((f'{KIT}_ic_', f'{KIT}_icon_', f'{KIT}_button_')):
            bpy.data.objects.remove(o)
    mats = icon_materials()
    for n, shapes in icon_shapes().items():
        pn = bpy.data.objects[f'{KIT}_panel_{n}']
        w, h = pn.dimensions.x, pn.dimensions.z
        _icon_set(f'{KIT}_ic_{n}', shapes, pn, w * ICON_SCALE, h * ICON_Z, mats, c)
        _icon_set(f'{KIT}_ic_btn_{n}', BUTTON, pn, w * BUTTON_SCALE, h * BUTTON_Z, mats, c)


def build_arms(cam):
    """Arms hang from rail mounts at the wall, positioned by screen point (u, v) on plane y = y_plane."""
    c = coll('S03_PROPS')
    for n, (u, v, y_plane, flip) in {'L': (0.165, 0.30, 7.5, 1), 'R': (0.80, 0.31, 7.5, -1)}.items():
        o, d = _ray(cam, u, v)
        t = (y_plane - o.y) / d.y
        p = o + d * t
        arm = P.robot_arm(f'{KIT}_arm_{n}', reach=3.2, collection=c)
        arm.location = p
        arm.rotation_euler = (0, 0, math.radians(-20) if flip > 0 else math.radians(200))


def _ray(cam, u, v):
    sc = bpy.context.scene
    tr, br, bl, tl = cam.data.view_frame(scene=sc)
    p = tl + (tr - tl) * u + (bl - tl) * v
    o = cam.matrix_world.translation
    return o, ((cam.matrix_world @ p) - o).normalized()


def build_room():
    M = P.materials()
    c = coll('S03_ROOM')
    clear(c)
    fl = P.floor(f'{KIT}_floor', 80, collection=c)
    fl.location = (0, 0, 0)
    # cylindrical wall: windows on the sides, solid lit wall in the back
    R, H, seg = 13.0, 9.0, 72
    centre = Vector((0, 0.5, 0))
    bm = bmesh.new()
    for i in range(seg):
        a0 = 2 * math.pi * i / seg
        a1 = 2 * math.pi * (i + 1) / seg
        am = math.degrees((a0 + a1) / 2)  # 90 = straight back (+Y)
        if 225 < am < 315:  # behind the camera: open
            continue
        p0 = Vector((R * math.cos(a0), R * math.sin(a0), 0)) + centre
        p1 = Vector((R * math.cos(a1), R * math.sin(a1), 0)) + centre
        window = (20 < am < 70) or (110 < am < 160) or am < 15 or am > 345 or (165 < am < 195)
        if window:
            # mullion post at segment start + sill + head beams
            for z0, z1 in ((0, 1.0), (H - 1.2, H)):
                vs = [bm.verts.new((p.x, p.y, z)) for p, z in ((p0, z0), (p1, z0), (p1, z1), (p0, z1))]
                bm.faces.new(vs).material_index = 1
            dirv = (p1 - p0).normalized()
            q0, q1 = p0, p0 + dirv * 0.14
            n = Vector((-dirv.y, dirv.x, 0)) * 0.18
            vs = [bm.verts.new((p.x, p.y, z)) for p, z in ((q0 + n, 1.0), (q1 + n, 1.0), (q1 + n, H - 1.2), (q0 + n, H - 1.2))]
            bm.faces.new(vs).material_index = 2
            vs = [bm.verts.new((p.x, p.y, 4.6)) for p in (p0 + n * 0.5, p1 + n * 0.5)]
            vs += [bm.verts.new((p.x, p.y, 4.72)) for p in (p1 + n * 0.5, p0 + n * 0.5)]
            bm.faces.new(vs).material_index = 2
        else:
            vs = [bm.verts.new((p.x, p.y, z)) for p, z in ((p0, 0), (p1, 0), (p1, H), (p0, H))]
            bm.faces.new(vs).material_index = 0
            for zs in (2.2, 5.6):
                vs = [bm.verts.new((p.x * 0.995, p.y * 0.995 + centre.y * 0.005, z)) for p, z in ((p0, zs), (p1, zs), (p1, zs + 0.06), (p0, zs + 0.06))]
                bm.faces.new(vs).material_index = 3
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.normal_flip()
    w = P._obj(f'{KIT}_wall', bm, [M['wall2'], M['wall'], M['mullion'], M['emerald']], c)
    # ceiling
    bm = bmesh.new()
    P.disc(bm, R + 0.5, H, H + 0.2, mat_index=0)
    ce = P._obj(f'{KIT}_ceiling', bm, [M['wall']], c)
    ce.location = centre
    return w


def camera():
    cam = bpy.data.objects.get('CAM_S03_hero')
    if not cam:
        cam = bpy.data.objects.new('CAM_S03_hero', bpy.data.cameras.new('CAM_S03_hero'))
        bpy.context.scene.collection.objects.link(cam)
    cam.data.sensor_fit = 'HORIZONTAL'
    cam.data.sensor_width = 36
    cam.data.lens = CAMERA['lens']
    cam.location = CAMERA['location']
    cam.rotation_euler = Euler((math.radians(90 - CAMERA['pitch_down_deg']), 0, 0))
    bpy.context.scene.camera = cam
    bpy.context.view_layer.update()
    return cam


def build():
    P.materials()
    cam = camera()
    build_room()
    build_props()
    build_arms(cam)
    lay = bpy.data.collections.get('LAYOUT')
    if lay:
        lay.hide_render = True
        lay.hide_viewport = True


if __name__ == '__main__':
    build()
