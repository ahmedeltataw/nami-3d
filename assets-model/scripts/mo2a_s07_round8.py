"""Shorten the authored S07 entry to clear the N; preserve the hero camera."""
from math import radians, tan
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
from mo2a_export import OUT, paths

KIT = 's07_future_v2'
blend, _, _ = paths(KIT)
if Path(bpy.data.filepath).resolve() != blend.resolve():
    raise RuntimeError('Open the saved S07 blend')
cam = bpy.data.objects['CAM_S07_hero']
hero = cam.matrix_world.translation.copy()
rotation = cam.matrix_world.to_quaternion()
direction = rotation @ Vector((0, 0, -1))
old = [Vector((34, 27, 9.5)), Vector((24, 19, 7)), Vector((8, -4, 3)), hero]
u = 0.65
# De Casteljau right-hand subcurve, preserving the original endpoint and tangent.
a = [old[i].lerp(old[i+1], u) for i in range(3)]
b = [a[i].lerp(a[i+1], u) for i in range(2)]
control = [b[0].lerp(b[1], u), b[1], a[2], old[3]]


def point(t):
    v = 1-t
    return control[0]*v**3 + 3*control[1]*v*v*t + 3*control[2]*v*t*t + control[3]*t**3


sky = bpy.data.objects['S07_sky_city']
verts = [sky.matrix_world @ v.co for v in sky.data.vertices]
v0, v1, _, v3 = verts
e1, e2 = v1-v0, v3-v0
normal = e1.cross(e2).normalized()
ty, tx = tan(radians(22.9/2)), tan(radians(22.9/2))*1672/941
checks = []
for i in range(201):
    p = point(i/200)
    for x,y in ((-1,-1),(-1,1),(1,-1),(1,1)):
        ray = rotation @ Vector((x*tx,y*ty,-1))
        distance = (v0-p).dot(normal)/ray.dot(normal)
        hit = p + ray*distance-v0
        uv = [hit.dot(e1)/e1.length_squared, hit.dot(e2)/e2.length_squared]
        if distance <= 0 or min(uv) < 0 or max(uv) > 1:
            raise RuntimeError(f'Frustum leaves sky at {i/200}: {uv}')
        checks.append(uv)

specs = {'reference': {'location': hero, 'target': hero+direction, 'lens': cam.data.lens}}
for i in range(5):
    p = point(i/5)
    specs[f'flyin_{i:02d}'] = {'location': p, 'target': p+direction, 'lens': cam.data.lens}
kit_render.render_views(KIT, specs, OUT / 's07-round8')
# MO-2f owns the manifest path from round 9 onward; this script renders history only.
print('S07 round8 sampled 201 poses; UV range',min(min(p) for p in checks),max(max(p) for p in checks),flush=True)
