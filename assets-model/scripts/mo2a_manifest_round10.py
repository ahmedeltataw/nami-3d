"""Update additive MO-2a metadata and correct the S07 export size and note."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
directory = ROOT / 'assets-model' / 'export'
s07_path = directory / 's07_future_v2.manifest.json'
s04_path = directory / 's04_idea_v2.manifest.json'
s07 = json.loads(s07_path.read_text(encoding='utf8'))
s04 = json.loads(s04_path.read_text(encoding='utf8'))
s07['size_bytes'] = (directory / 's07_future_v2.glb').stat().st_size
s07['backdrop_overscan'] = {'scale': 1.6, 'uv_range': [-0.3, 1.3], 'wrap': 'MIRRORED_REPEAT'}
note = s07['backdrop']['note']
old = 'UV = frame coords.'
new = 'UVs preserve hero frame coordinates and extend to [-0.3, 1.3] on the expanded card with mirrored repeat.'
if old in note:
    s07['backdrop']['note'] = note.replace(old, new)
elif new not in note:
    raise ValueError('Unexpected S07 backdrop note; refusing to alter it')
suffix = '; glTF and three.js world up is +Y, equivalent to Blender world +Z for yaw'
coords = s04['cameraSafeRange']['coordinates']
if suffix not in coords:
    s04['cameraSafeRange']['coordinates'] = coords + suffix
s04['phone_exploded_parts_note'] = 'phone_exploded_parts supersedes the legacy props.phone summary for assembly nodes.'
for path, data in ((s07_path, s07), (s04_path, s04)):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('Updated S07 overscan and S04 contract notes')
