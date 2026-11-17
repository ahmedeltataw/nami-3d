"""Add a verified glTF-space phone pose to the S04 manifest.

Run with Blender background Python from the worktree root. The exported node
must agree before the manifest is written. Existing keys are left untouched.
"""
import json
import math
from pathlib import Path
import sys

from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
from mo2a_inspect import read_glb

manifest_path = ROOT / 'assets-model' / 'export' / 's04_idea_v2.manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
pose = manifest['phone_pose']
location = Vector(pose['location_blender'])
rotation = Euler(tuple(math.radians(v) for v in pose['rotation_euler_xyz_deg']), 'XYZ').to_matrix()
basis = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
converted = basis @ rotation @ basis.transposed()
quaternion = converted.to_quaternion()
position = basis @ location
node = next(n for n in read_glb(ROOT / 'assets-model' / 'export' / 's04_idea_v2.glb')['nodes'] if n.get('name') == 'S04_phone')
export_q = node['rotation']
xyzw = [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
if sum(a * b for a, b in zip(xyzw, export_q)) < 0:
    xyzw = [-x for x in xyzw]
assert max(abs(a - b) for a, b in zip(xyzw, export_q)) < 1e-6
assert max(abs(a - b) for a, b in zip(position, node['translation'])) < 1e-6
# Transform one handset-local corner, including the change of local axes.
corner = Vector((0.875, -0.12, 1.85))
blender_result = basis @ (location + rotation @ corner)
gltf_result = position + converted @ (basis @ corner)
error = (blender_result - gltf_result).length
assert error < 1e-6
manifest['phone_pose_gltf'] = {'position': list(position), 'quaternion_xyzw': xyzw}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
out = ROOT / 'test-results' / 'MO-2a' / 'phone-pose-check.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'corner_blender_local': list(corner), 'blender_result_gltf': list(blender_result),
                           'gltf_result': list(gltf_result), 'error_m': error,
                           'export_node_position': node['translation'], 'export_node_quaternion_xyzw': export_q}, indent=2) + '\n', encoding='utf-8')
print('Verified phone pose; corner error:', error)
