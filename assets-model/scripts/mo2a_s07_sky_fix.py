"""Extend S07 sky at fixed texel scale and sample a hero-oriented fly-in."""
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
from mo2a_export import OUT, backup, paths, save, stage

KIT = 's07_future_v2'
backup(KIT, 's07-before-sky-fix')
_, glb, _ = paths(KIT)
sky = bpy.data.objects['S07_sky_city']
if not sky.get('mo2a_sky_overscan_v1'):
    sky.data = sky.data.copy()
    mesh = sky.data
    centre = sum((v.co for v in mesh.vertices), Vector()) / len(mesh.vertices)
    for v in mesh.vertices:
        v.co = centre + (v.co - centre) * 1.6
    for uv in mesh.uv_layers:
        for loop in uv.data:
            loop.uv = (Vector((0.5, 0.5)) + (loop.uv - Vector((0.5, 0.5))) * 1.6)
    for mat in mesh.materials:
        if mat and mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE':
                    node.extension = 'MIRROR'
    sky['mo2a_sky_overscan_v1'] = True
    bpy.context.view_layer.update()

cam = bpy.data.objects['CAM_S07_hero']
hero = cam.matrix_world.translation.copy()
rotation = cam.matrix_world.to_quaternion()
direction = rotation @ Vector((0, 0, -1))
control = [Vector((34, 27, 9.5)), Vector((24, 19, 7)), Vector((8, -4, 3)), hero]


def point(t):
    a = 1-t
    return control[0]*a**3 + 3*control[1]*a*a*t + 3*control[2]*a*t*t + control[3]*t**3


# Compute coverage in the plane's own affine coordinates for all four rays.
verts = [sky.matrix_world @ v.co for v in sky.data.vertices]
if len(verts) != 4:
    raise RuntimeError('Expected the original four-corner sky card')
v0, v1, v2, v3 = verts
e1, e2 = v1-v0, v3-v0
normal = e1.cross(e2).normalized()
tan_y = math.tan(math.radians(22.9/2))
tan_x = tan_y * 480/270
coverage = []
for i in range(101):
    t = i/100
    p = point(t)
    corners = []
    for x, y in ((-1,-1),(-1,1),(1,-1),(1,1)):
        ray = rotation @ Vector((x*tan_x, y*tan_y, -1))
        denom = ray.dot(normal)
        distance = (v0-p).dot(normal)/denom
        hit = p + ray*distance - v0
        u, v = hit.dot(e1)/e1.length_squared, hit.dot(e2)/e2.length_squared
        corners.append([u,v])
        if distance <= 0 or min(u,v) < -1e-5 or max(u,v) > 1+1e-5:
            raise RuntimeError(f'Sky misses frustum at t={t}: {u}, {v}')
    coverage.append({'t': t, 'corners_uv': corners})
specs = {'reference': {'location': hero, 'target': hero+direction, 'lens': cam.data.lens}}
for i in range(21):
    p = point(i/20)
    specs[f'flyin_{i:02d}'] = {'location': p, 'target': p+direction, 'lens': cam.data.lens}
kit_render.WIDTH, kit_render.HEIGHT = 480, 270
kit_render.render_views(KIT, specs, OUT / 's07-sky-fix')
staged, doc = stage(KIT, 's07-sky-fix')
result = save(KIT, staged, doc, {})
manifest_path = paths(KIT)[2]
manifest = json.loads(manifest_path.read_text(encoding='utf8'))
manifest['size_bytes'] = glb.stat().st_size
manifest['backdrop_overscan'] = {'scale': 1.6, 'uv_range': [-0.3, 1.3], 'wrap': 'MIRRORED_REPEAT'}
manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
(OUT / 's07-sky-coverage.json').write_text(json.dumps(coverage, indent=2)+'\n', encoding='utf8')
print('S07 sky coverage 101 samples; triangles', result, flush=True)
