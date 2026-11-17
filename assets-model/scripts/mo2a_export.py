"""Helpers for MO-2a scripts operating on the approved open blends."""
import json
from pathlib import Path
import shutil

import bpy
from mo2a_inspect import read_glb, triangles

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results' / 'MO-2a'


def paths(kit):
    return (ROOT / 'assets-model' / (kit + '.blend'),
            ROOT / 'assets-model' / 'export' / (kit + '.glb'),
            ROOT / 'assets-model' / 'export' / (kit + '.manifest.json'))


def backup(kit, label):
    OUT.mkdir(parents=True, exist_ok=True)
    blend, glb, manifest = paths(kit)
    if Path(bpy.data.filepath).resolve() != blend.resolve():
        raise RuntimeError(f'Open {blend} before running this card')
    for path in (blend, glb, manifest):
        dest = OUT / (label + path.suffix)
        if not dest.exists():
            shutil.copy2(path, dest)


def _nodes(doc):
    nodes = doc['nodes']
    parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
    return {n['name']: (nodes[parents[i]]['name'] if i in parents else None,
                        n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]),
                        n.get('scale', [1, 1, 1]), n.get('matrix'))
            for i, n in enumerate(nodes)}


def stage(kit, label, added=()):
    _, glb, _ = paths(kit)
    old = read_glb(glb)
    previous = _nodes(old)
    names = list(previous) + list(added)
    if len(names) != len(set(names)) or any(bpy.data.objects.get(n) is None for n in names):
        raise RuntimeError('Export node names do not map uniquely to blend objects')
    bpy.ops.object.select_all(action='DESELECT')
    for name in names:
        bpy.data.objects[name].select_set(True)
    target = OUT / (label + '-staged.glb')
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_lights=False,
                              export_cameras=False, export_extras=True, export_animations=False)
    doc = read_glb(target)
    current = _nodes(doc)
    if set(current) != set(names):
        raise RuntimeError(f'Unexpected export nodes: {set(current) ^ set(names)}')
    for name, left in previous.items():
        right = current[name]
        if left[0] != right[0] or any((a is None) != (b is None) or
                (a is not None and (len(a) != len(b) or any(abs(x - y) > 1e-5 for x, y in zip(a, b))))
                for a, b in zip(left[1:], right[1:])):
            raise RuntimeError(f'Export changed hierarchy or transform of {name}')
    if len(doc.get('images', [])) < len(old.get('images', [])):
        raise RuntimeError('Export lost embedded images')
    return target, doc


def save(kit, target, doc, updates):
    blend, glb, manifest_path = paths(kit)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest.update(updates)
    total = sum(triangles(doc, node['mesh']) for node in doc['nodes'] if 'mesh' in node)
    manifest['tris_total'] = total
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    shutil.copy2(target, glb)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return total
