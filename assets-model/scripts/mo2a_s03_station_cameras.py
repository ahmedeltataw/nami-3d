"""Author and sample S03 station camera keys in the approved blend."""
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
from mo2a_export import OUT, paths

KIT = 's03_lab_v2'
blend, _, manifest_path = paths(KIT)
if Path(bpy.data.filepath).resolve() != blend.resolve():
    raise RuntimeError('Open the approved S03 blend first')
cam = bpy.data.objects['CAM_S03_hero']
loc = cam.matrix_world.translation.copy()
hero_dir = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
centre = Vector((0, -0.3, loc.z))
ids = ('code', 'phone', 'chart', 'headphones', 'cloud', 'layers')
keys = []
for station in ids:
    panel = bpy.data.objects['S03_panel_' + station]
    pos = panel.matrix_world.translation
    angle = max(-36, min(36, math.degrees(math.atan2(pos.x * 0.58, 10.6))))
    rot = Matrix.Rotation(math.radians(angle), 4, 'Z')
    position = centre + rot @ (loc - centre)
    target = Vector((pos.x * 0.42, pos.y * 0.35, 2.0))
    drift = Matrix.Rotation(math.radians(3), 4, 'Z')
    end = centre + drift @ (position - centre)
    keys.append({'station': station, 'position': position, 'target': target, 'end': end})


def blend_catmull(p0, p1, p2, p3, t):
    # Centripetal Catmull-Rom, with extrapolated endpoints to avoid zero spans.
    def next_knot(a, b, knot):
        return knot + max((b - a).length ** 0.5, 1e-4)
    a = 0.0
    b = next_knot(p0, p1, a)
    c = next_knot(p1, p2, b)
    d = next_knot(p2, p3, c)
    u = b + (c - b) * t
    def lerp(x, y, u0, u1):
        return x * ((u1 - u) / (u1 - u0)) + y * ((u - u0) / (u1 - u0))
    a1, a2, a3 = lerp(p0, p1, a, b), lerp(p1, p2, b, c), lerp(p2, p3, c, d)
    b1, b2 = lerp(a1, a2, a, c), lerp(a2, a3, b, d)
    return lerp(b1, b2, b, c)


specs = {'reference': {'location': loc, 'target': loc + hero_dir, 'lens': cam.data.lens}}
manifest_keys = []
to_gltf = lambda p: [p.x, p.z, -p.y]
for i, key in enumerate(keys):
    specs['station_' + key['station']] = {'location': key['position'], 'target': key['target'], 'lens': cam.data.lens}
    specs['drift_' + key['station']] = {'location': key['end'], 'target': key['target'], 'lens': cam.data.lens}
    manifest_keys.append({'station': key['station'], 'position_gltf': to_gltf(key['position']),
                          'target_gltf': to_gltf(key['target']), 'drift_end_position_gltf': to_gltf(key['end']),
                          'drift_deg': 3})
    if i:
        p1, p2 = keys[i-1]['end'], key['position']
        p0 = keys[i-2]['end'] if i > 1 else p1 + (p1 - p2)
        p3 = keys[i+1]['position'] if i + 1 < len(keys) else p2 + (p2 - p1)
        midpoint = blend_catmull(p0, p1, p2, p3, 0.5)
        target = keys[i-1]['target'].lerp(key['target'], 0.5)
        specs[f'transition_{i:02d}'] = {'location': midpoint, 'target': target, 'lens': cam.data.lens}
        manifest_keys[-1]['transition_midpoint_gltf'] = to_gltf(midpoint)
kit_render.WIDTH, kit_render.HEIGHT = 480, 270
kit_render.render_views(KIT, specs, OUT / 's03-stations')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['mo2a_station_camera_keys'] = {'interpolation': 'centripetal Catmull-Rom; transition s=0..0.2',
                                         'station_drift': '3 degrees over s=0.2..1', 'keys': manifest_keys}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
