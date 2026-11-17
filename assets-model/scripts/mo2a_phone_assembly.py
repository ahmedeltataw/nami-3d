"""Render the S04 assembly sequence using exported glTF-local part offsets."""
import json
import os
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
from mo2a_export import OUT, paths

KIT = 's04_idea_v2'
blend, _, manifest_path = paths(KIT)
if Path(bpy.data.filepath).resolve() != blend.resolve():
    raise RuntimeError('Open the saved S04 blend')
manifest = json.loads(manifest_path.read_text(encoding='utf8'))
multiplier = float(os.environ.get('MO2A_PHONE_MULTIPLIER', '1'))
if multiplier not in (1, 2.5):
    raise ValueError('Only the baseline and 2.5x comparison are supported')
parts = manifest['phone_exploded_parts']
times = [0.25, 0.29, 0.34, 0.38, 0.43, 0.47, 0.51, 0.56, 0.60]
starts = times[:-1]
ends = times[1:]
samples = [0.25, 0.29, 0.34, 0.38, 0.43, 0.47, 0.51, 0.56, 0.60]
objects = [bpy.data.objects[p['node']] for p in parts]
rest = [o.location.copy() for o in objects]
cam = bpy.data.objects['CAM_S04_hero']
loc = cam.matrix_world.translation.copy()
direction = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
spec = {'location': loc, 'target': loc + direction, 'lens': cam.data.lens}
specs = {('reference' if i == 0 else f'frame_{i:02d}'): spec for i in range(len(samples))}
index = [0]


def apply(scene):
    b = samples[min(index[0], len(samples)-1)]
    for i, (obj, part) in enumerate(zip(objects, parts)):
        progress = min(1, max(0, (b - starts[i]) / (ends[i] - starts[i])))
        offset = (1-progress)**3 * part['exploded_distance'] * multiplier
        x, y, z = part['exploded_direction']
        obj.location = rest[i] + Vector((x, -z, y)) * offset
    index[0] += 1


kit_render.WIDTH, kit_render.HEIGHT = 480, 270
bpy.app.handlers.render_pre.append(apply)
try:
    kit_render.render_views(KIT, specs, OUT / ('s04-assembly-2p5' if multiplier == 2.5 else 's04-assembly'))
finally:
    bpy.app.handlers.render_pre.remove(apply)
    for obj, location in zip(objects, rest):
        obj.location = location
print('Assembly render samples b:', samples, 'offset multiplier:', multiplier, flush=True)
