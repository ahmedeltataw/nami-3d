"""Inventory the delivered v2 GLBs and record S03 mesh counts in its manifest.

Run with Python from the worktree root. Counts refer to exported triangle
primitives, including each instance of a mesh, rather than Blender polygons.
"""
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results' / 'MO-2a'


def read_glb(path):
    with path.open('rb') as f:
        magic, version, _ = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF' or version != 2:
            raise ValueError(f'Not a glTF 2 GLB: {path}')
        size, kind = struct.unpack('<I4s', f.read(8))
        if kind != b'JSON':
            raise ValueError(f'Missing GLB JSON chunk: {path}')
        return json.loads(f.read(size))


def triangles(doc, mesh_index):
    total = 0
    for prim in doc['meshes'][mesh_index]['primitives']:
        mode = prim.get('mode', 4)
        count = doc['accessors'][prim.get('indices', prim['attributes']['POSITION'])]['count']
        if mode == 4:
            total += count // 3
        elif mode in (5, 6):
            total += max(0, count - 2)
        else:
            raise ValueError(f'Unexpected primitive mode {mode}')
    return total


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    result = {}
    for path in sorted((ROOT / 'assets-model' / 'export').glob('s0*_v2.glb')):
        doc = read_glb(path)
        nodes = doc.get('nodes', [])
        parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
        meshes = {node.get('name', f'node_{i}'): triangles(doc, node['mesh'])
                  for i, node in enumerate(nodes) if 'mesh' in node}
        result[path.stem] = {
            'triangles_total': sum(meshes.values()),
            'triangles_by_mesh': dict(sorted(meshes.items(), key=lambda pair: -pair[1])),
            'nodes': [{'name': node.get('name', f'node_{i}'),
                       'parent': nodes[parents[i]].get('name') if i in parents else None,
                       'translation': node.get('translation', [0, 0, 0]),
                       'rotation_xyzw': node.get('rotation', [0, 0, 0, 1]),
                       'scale': node.get('scale', [1, 1, 1]),
                       'mesh': 'mesh' in node,
                       'extras': node.get('extras', {})}
                      for i, node in enumerate(nodes)]}
    (OUT / 'export-inventory.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    candidates = {kit: [node['name'] for node in data['nodes'] if node['mesh']]
                  for kit, data in result.items()}
    (OUT / 'node-merge-candidates.json').write_text(json.dumps(candidates, indent=2) + '\n', encoding='utf-8')
    manifest_path = ROOT / 'assets-model' / 'export' / 's03_lab_v2.manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    current = result['s03_lab_v2']['triangles_by_mesh']
    old = manifest.get('triangles_by_mesh', {})
    names = sorted(set(current) | set(old))
    manifest['triangles_by_mesh'] = {
        name: {'before': old.get(name, {}).get('before', current.get(name, 0)),
               'after': current.get(name, 0)} for name in names}
    manifest['triangles_total'] = sum(current.values())
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    for kit, data in result.items():
        print(kit, 'triangles', data['triangles_total'], 'nodes', len(data['nodes']))
    print('S03 largest meshes:')
    for name, count in list(result['s03_lab_v2']['triangles_by_mesh'].items())[:20]:
        print(f'  {count:6d} {name}')
    print('S04 phone nodes:')
    for node in result['s04_idea_v2']['nodes']:
        if 'phone' in node['name'].lower():
            print(' ', node['name'], node['extras'])


if __name__ == '__main__':
    main()
