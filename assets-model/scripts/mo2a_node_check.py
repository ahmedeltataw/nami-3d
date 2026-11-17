"""Compare named exported GLB nodes with their source blend objects.

Reports local transforms after the Blender-to-glTF basis change, plus parent
identity. Object-data geometry and future optimizer behavior are not tested.
Run with Blender background Python and hold the shared Blender lock.
"""
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
from mo2a_inspect import read_glb

C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
result = {}
for path in sorted((ROOT / 'assets-model' / 'export').glob('s0*_v2.glb')):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets-model' / (path.stem + '.blend')))
    doc = read_glb(path)
    nodes = doc['nodes']
    parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
    records = []
    for i, node in enumerate(nodes):
        name = node.get('name', f'node_{i}')
        ob = bpy.data.objects.get(name)
        if not ob:
            records.append({'name': name, 'status': 'missing in blend'})
            continue
        if 'matrix' in node:
            a = node['matrix']
            actual = Matrix(tuple(tuple(a[col * 4 + row] for col in range(4)) for row in range(4)))
        else:
            q = node.get('rotation', [0, 0, 0, 1])
            actual = Matrix.LocRotScale(Vector(node.get('translation', [0, 0, 0])),
                                        Quaternion((q[3], q[0], q[1], q[2])),
                                        Vector(node.get('scale', [1, 1, 1])))
        expected = C @ ob.matrix_local @ C.transposed()
        error = max(abs(actual[r][c] - expected[r][c]) for r in range(4) for c in range(4))
        exported_parent = nodes[parents[i]].get('name') if i in parents else None
        source_parent = ob.parent.name if ob.parent else None
        records.append({'name': name, 'source_parent': source_parent, 'export_parent': exported_parent,
                        'max_local_matrix_error': error,
                        'status': 'match' if error < 1e-4 and source_parent == exported_parent else 'different'})
    result[path.stem] = records
    print(path.stem, 'matched', sum(r['status'] == 'match' for r in records), '/', len(records), flush=True)
out = ROOT / 'test-results' / 'MO-2a' / 'node-check.json'
out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
