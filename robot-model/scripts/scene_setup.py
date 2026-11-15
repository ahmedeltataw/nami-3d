"""Validation-only scene: cameras, lights, world, renders and reference overlays.
Nothing here is part of the robot itself."""
import math
import bpy
import numpy as np
from mathutils import Vector

import build_robot as B

REF_W, REF_H = 1834, 2000


def _cam(name, coll, loc, target, lens=85.0, ortho=None):
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    o = bpy.data.objects.get(name) or bpy.data.objects.new(name, cd)
    if not o.users_collection:
        coll.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if ortho:
        cd.type, cd.ortho_scale = 'ORTHO', ortho
    else:
        cd.type, cd.lens = 'PERSP', lens
    cd.clip_end = 200
    return o


def _area(name, coll, loc, target, power, size, color=(1, 1, 1)):
    ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, 'AREA')
    ld.energy, ld.size, ld.color = power, size, color
    o = bpy.data.objects.get(name) or bpy.data.objects.new(name, ld)
    if not o.users_collection:
        coll.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


def setup():
    C = B.colls()
    sc = bpy.context.scene
    # front ortho camera framed exactly like ref_front.webp (pixel 917,1680 = origin, 400 px / unit)
    cx = (REF_W / 2 - 917) / 400.0
    cz = (1680 - REF_H / 2) / 400.0
    _cam("CAM_Front_Ortho", C["Cameras"], (cx, -30, cz), (cx, 0, cz), ortho=REF_H / 400.0)
    _cam("CAM_Front", C["Cameras"], (0, -11.5, 1.75), (0, 0, 1.68), lens=85)
    _cam("CAM_ThreeQuarter", C["Cameras"], (8.6, -7.2, 2.7), (0, 0, 1.68), lens=85)
    _cam("CAM_Side", C["Cameras"], (11.5, 0, 1.75), (0, 0, 1.68), lens=85)
    _cam("CAM_Back", C["Cameras"], (0, 11.5, 1.75), (0, 0, 1.68), lens=85)
    _cam("CAM_Face", C["Cameras"], (0, -7.5, 2.55), (0, 0, 2.5), lens=85)
    _cam("CAM_Emblem", C["Cameras"], (0.4, -6.0, 1.0), (0, -0.6, 0.8), lens=85)
    _cam("CAM_Hand", C["Cameras"], (1.9, -3.4, 0.45), (1.05, 0, 0.27), lens=85)
    _area("LGT_Key", C["Lighting"], (-5, -6, 7), (0, 0, 1.7), 900, 5)
    _area("LGT_Fill", C["Lighting"], (6, -5, 3), (0, 0, 1.7), 350, 6)
    _area("LGT_Rim", C["Lighting"], (2, 7, 6), (0, 0, 2.0), 600, 4)
    _area("LGT_Top", C["Lighting"], (0, 0, 9), (0, 0, 1.7), 90, 8)
    w = sc.world or bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.92, 0.92, 0.93, 1)
    bg.inputs[1].default_value = 0.4
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    sc.render.film_transparent = False
    try:
        sc.eevee.taa_render_samples = 128
        sc.eevee.shadow_ray_count = 3
        sc.eevee.shadow_step_count = 12
        sc.eevee.use_shadows = True
        sc.eevee.use_raytracing = False
    except AttributeError:
        pass


def render(cam, path, res=(1000, 1100), pct=100):
    sc = bpy.context.scene
    sc.camera = bpy.data.objects[cam]
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = pct
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def render_front_ortho(path, pct=50):
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    try:
        return render("CAM_Front_Ortho", path, (REF_W, REF_H), pct)
    finally:
        sc.render.film_transparent = False


def _load(p):
    im = bpy.data.images.load(p, check_existing=False)
    w, h = im.size
    a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)
    bpy.data.images.remove(im)
    return a


def _save(a, out):
    img = bpy.data.images.new("_c", a.shape[1], a.shape[0])
    img.pixels[:] = a.ravel()
    img.filepath_raw, img.file_format = out, 'PNG'
    img.save()
    bpy.data.images.remove(img)


def compare_crops(ref_path, render_path, regions, out_dir, scale=2):
    """regions: {name: (x0, y0, x1, y1)} in reference pixels (top-left origin).
    Writes <out_dir>/cmp_<name>.png = reference crop | model crop (model alpha composited on white)."""
    F, M = _load(ref_path), _load(render_path)
    h = F.shape[0]
    outs = []
    for name, (x0, y0, x1, y1) in regions.items():
        cs = []
        for a in (F, M):
            c = a[h - y1:h - y0, x0:x1].copy()
            al = c[..., 3:4]
            c[..., :3] = c[..., :3] * al + 0.97 * (1 - al)
            c[..., 3] = 1
            cs.append(np.repeat(np.repeat(c, scale, 0), scale, 1))
        gap = np.ones((cs[0].shape[0], 8, 4), np.float32)
        gap[..., :3] = 0.2
        out = f"{out_dir}\\cmp_{name}.png"
        _save(np.concatenate([cs[0], gap, cs[1]], 1), out)
        outs.append(out)
    return outs


def overlay(render_path, ref_path, out_path, mode="side"):
    """side: reference | render; blend: 50/50 mix; edges: render outline in red over the reference."""
    a = bpy.data.images.load(ref_path, check_existing=False)
    b = bpy.data.images.load(render_path, check_existing=False)
    W, H = b.size
    if tuple(a.size) != (W, H):
        a.scale(W, H)
    A = np.array(a.pixels[:], dtype=np.float32).reshape(H, W, 4)
    Bp = np.array(b.pixels[:], dtype=np.float32).reshape(H, W, 4)
    if mode == "side":
        out = np.concatenate([A, Bp], axis=1)
    elif mode == "blend":
        out = A * 0.5 + Bp * 0.5
    else:
        mask = (Bp[..., 3] > 0.5).astype(np.float32)
        edge = np.zeros_like(mask)
        edge[1:-1, 1:-1] = np.abs(mask[2:, 1:-1] - mask[:-2, 1:-1]) + np.abs(mask[1:-1, 2:] - mask[1:-1, :-2])
        edge = np.clip(edge, 0, 1)
        for k in range(1, 2):
            edge[k:, :] = np.maximum(edge[k:, :], edge[:-k, :])
            edge[:, k:] = np.maximum(edge[:, k:], edge[:, :-k])
        out = A.copy()
        out[..., 0] = np.maximum(out[..., 0], edge)
        out[..., 1] *= (1 - edge)
        out[..., 2] *= (1 - edge)
    oh, ow = out.shape[:2]
    img = bpy.data.images.new("_overlay", ow, oh, alpha=True)
    img.pixels[:] = out.ravel()
    img.filepath_raw = out_path
    img.file_format = 'PNG'
    img.save()
    for im in (a, b, img):
        bpy.data.images.remove(im)
    return out_path
