"""Re-export robot geometry and carry forward the unchanged animation channels."""
import copy
import json
import os
import struct

import bpy
import lod_export as L
import rig_export as R
import rig_fix_mo5a

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(os.path.dirname(HERE), 'public', 'models', 'robot')


def read(path):
    with open(path, 'rb') as f:
        magic, version, total = struct.unpack('<4sII', f.read(12))
        assert magic == b'glTF' and version == 2
        size, kind = struct.unpack('<II', f.read(8))
        assert kind == 0x4e4f534a
        doc = json.loads(f.read(size))
        size, kind = struct.unpack('<II', f.read(8))
        assert kind == 0x004e4942
        return doc, f.read(size)


def write(path, doc, binary):
    raw = json.dumps(doc, separators=(',', ':')).encode('utf8')
    raw += b' ' * (-len(raw) % 4)
    binary += b'\0' * (-len(binary) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(raw) + 8 + len(binary)))
        f.write(struct.pack('<II', len(raw), 0x4e4f534a)); f.write(raw)
        f.write(struct.pack('<II', len(binary), 0x004e4942)); f.write(binary)


def carry_animations(path, original):
    dst, binary = read(path)
    src, old_binary = read(original)
    binary = bytearray(binary[:dst['buffers'][0]['byteLength']])
    nodes = {n['name']: i for i, n in enumerate(dst['nodes'])}
    assert len(nodes) == len(dst['nodes'])
    # The original LODs have different default poses on some joints. Preserve
    # every node's exact local transform, independently of Blender's save state.
    assert set(nodes) == {n['name'] for n in src['nodes']}
    for original_node in src['nodes']:
        exported_node = dst['nodes'][nodes[original_node['name']]]
        for key in ('matrix', 'translation', 'rotation', 'scale'):
            exported_node.pop(key, None)
            if key in original_node:
                exported_node[key] = copy.deepcopy(original_node[key])
    view_map, accessor_map = {}, {}

    def map_view(index):
        if index not in view_map:
            old = src['bufferViews'][index]
            assert old.get('buffer', 0) == 0
            binary.extend(b'\0' * (-len(binary) % 4))
            view = copy.deepcopy(old)
            start = old.get('byteOffset', 0)
            view['byteOffset'] = len(binary)
            binary.extend(old_binary[start:start + old['byteLength']])
            view_map[index] = len(dst['bufferViews'])
            dst['bufferViews'].append(view)
        return view_map[index]

    def map_accessor(index):
        if index not in accessor_map:
            acc = copy.deepcopy(src['accessors'][index])
            if 'bufferView' in acc:
                acc['bufferView'] = map_view(acc['bufferView'])
            if 'sparse' in acc:
                for part in ('indices', 'values'):
                    acc['sparse'][part]['bufferView'] = map_view(acc['sparse'][part]['bufferView'])
            accessor_map[index] = len(dst['accessors'])
            dst['accessors'].append(acc)
        return accessor_map[index]

    dst['animations'] = copy.deepcopy(src['animations'])
    for animation in dst['animations']:
        for sampler in animation['samplers']:
            sampler['input'] = map_accessor(sampler['input'])
            sampler['output'] = map_accessor(sampler['output'])
        for channel in animation['channels']:
            target = channel['target']
            name = src['nodes'][target['node']]['name']
            target['node'] = nodes[name]
    dst['buffers'][0]['byteLength'] = len(binary)
    write(path, dst, bytes(binary))


def main():
    L.reset_rest()
    rig_fix_mo5a.apply()
    palms = {side: bpy.data.objects[f'Hand_{side}_Palm'].data for side in 'LR'}
    for lod in ('high', 'low'):
        for side, mesh in palms.items():
            bpy.data.objects[f'Hand_{side}_Palm'].data = mesh.copy()
        rig_fix_mo5a.apply_bridges(lod)
        counts = L.set_lod(lod)
        path = os.path.join(L.EXP, f'robot_{lod}.glb')
        R.export_glb(path, animations=False)
        carry_animations(path, os.path.join(PUBLIC, f'robot_{lod}.glb'))
        print('MO5A_EXPORT', lod, sum(counts.values()), flush=True)
    for side, mesh in palms.items():
        bpy.data.objects[f'Hand_{side}_Palm'].data = mesh
    L.set_lod('high')
    with L.win_ctx():
        bpy.ops.wm.save_mainfile()


if __name__ == '__main__':
    main()
