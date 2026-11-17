"""Reduce the ceiling ring for MO-2e headroom; never change pedestal objects."""
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
from mo2a_export import OUT, backup, save, stage, paths
from mo2a_inspect import read_glb, triangles

KIT = 's03_lab_v2'
backup(KIT, 's03-before-budget2')
_, glb, manifest_path = paths(KIT)
old = read_glb(glb)
before = {n['name']: triangles(old, n['mesh']) for n in old['nodes'] if 'mesh' in n}
ob = bpy.data.objects['S03_ceiling_ring']
if not ob.get('mo2a_budget2_v1'):
    mod = ob.modifiers.new('MO2a ceiling reduction', 'DECIMATE')
    mod.ratio = 0.72
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(ob.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
    ob.modifiers.clear()
    ob.data = mesh
    ob['mo2a_budget2_v1'] = True
    bpy.context.view_layer.update()
staged, doc = stage(KIT, 's03-budget2')
after = {n['name']: triangles(doc, n['mesh']) for n in doc['nodes'] if 'mesh' in n}
if sum(after.values()) > 77758:
    raise RuntimeError(f'Budget not met: {sum(after.values())}')
if any(after[n] != before[n] for n in before if n.startswith('S03_pedestal_')):
    raise RuntimeError('Pedestal geometry changed')
cam = bpy.data.objects['CAM_S03_hero']
loc = cam.matrix_world.translation.copy()
direction = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
kit_render.render_views(KIT, {'reference': {'location': loc, 'target': loc + direction, 'lens': cam.data.lens}}, OUT / 's03-budget2')
manifest = json.loads(manifest_path.read_text(encoding='utf8'))
prior = manifest['triangles_by_mesh']
table = {n: {'before': prior.get(n, {}).get('before', before.get(n, 0)), 'after': after.get(n, 0)} for n in sorted(set(prior) | set(after))}
total = save(KIT, staged, doc, {'triangles_total': sum(after.values()), 'triangles_by_mesh': table})
print('S03 budget2', sum(before.values()), '->', total, flush=True)
