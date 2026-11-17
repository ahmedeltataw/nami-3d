"""Replace S03 pedestal collapse with regular lower-density circular topology.

Uses the original approved blend backup for exact pedestal radii and materials.
Run on the current S03 blend under the shared Blender lock.
"""
import json
import math
import shutil
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
import parts_lib as P
from mo2a_export import OUT, paths, save, stage
from mo2a_inspect import read_glb, triangles

KIT = 's03_lab_v2'
blend, glb, manifest_path = paths(KIT)
if Path(bpy.data.filepath).resolve() != blend.resolve():
    raise RuntimeError('Open the current S03 blend')
baseline_blend, baseline_glb = OUT / 's03-before.blend', OUT / 's03-before.glb'
names = ['S03_pedestal_' + n for n in ('chart', 'cloud', 'code', 'headphones', 'layers', 'phone')]
marker = 'mo2a_regular_pedestal_v1'
marked = [bool(bpy.data.objects[n].get(marker)) for n in names]
if any(marked) and not all(marked):
    raise RuntimeError('Partial refinement detected')
if not baseline_blend.exists() or not baseline_glb.exists():
    if any(marked) or bpy.data.objects['S03_ceiling_ring'].get('mo2a_budget2_v1'):
        raise RuntimeError('Original approved baseline backups are required for an already modified blend')
    OUT.mkdir(parents=True, exist_ok=True)
    if not baseline_blend.exists(): shutil.copy2(blend, baseline_blend)
    if not baseline_glb.exists(): shutil.copy2(glb, baseline_glb)
if not all(marked):
    with bpy.data.libraries.load(str(baseline_blend), link=False) as (source, loaded):
        loaded.objects = list(names)
    originals = {name: obj for name, obj in zip(names, loaded.objects)}
    for name in names:
        original = originals[name]
        if not original or original.type != 'MESH':
            raise RuntimeError(f'Missing original {name}')
        radius = max(math.hypot(v.co.x, v.co.y) for v in original.data.vertices)
        ob = bpy.data.objects[name]
        bm = bmesh.new()
        P.disc(bm, radius, 0.0, 0.12, seg=60, mat_index=0, r_top=radius * 0.97)
        P.disc(bm, radius * 0.86, 0.12, 0.26, seg=60, mat_index=1)
        P.ring(bm, radius * 0.9, 0.035, 0.2, seg=60, ring_seg=12, mat_index=2)
        P.disc(bm, radius * 0.7, 0.26, 0.34, seg=60, mat_index=0)
        P.ring(bm, radius * 0.72, 0.022, 0.335, seg=60, ring_seg=12, mat_index=2)
        mesh = bpy.data.meshes.new(name + '_mo2a_regular')
        bm.to_mesh(mesh)
        bm.free()
        for mat in original.data.materials:
            mesh.materials.append(bpy.data.materials.get(mat.name.split('.')[0]) or mat)
        for poly in mesh.polygons:
            poly.use_smooth = True
        ob.modifiers.clear()
        ob.data = mesh
        P._bevel(ob, 0.01, 2)
        ob[marker] = True
        bpy.data.objects.remove(original, do_unlink=True)
    bpy.context.view_layer.update()

staged, doc = stage(KIT, 's03-refined')
baseline = read_glb(baseline_glb)
before = {n['name']: triangles(baseline, n['mesh']) for n in baseline['nodes'] if 'mesh' in n}
after = {n['name']: triangles(doc, n['mesh']) for n in doc['nodes'] if 'mesh' in n}
if sum(before.values()) - sum(after.values()) < 12426:
    raise RuntimeError('Refined geometry does not meet the minimum triangle reduction')
cam = bpy.data.objects['CAM_S03_hero']
loc = cam.matrix_world.translation.copy()
direction = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
kit_render.render_views(KIT, {'reference': {'location': loc, 'target': loc + direction,
                                            'lens': cam.data.lens}}, OUT / 's03-refined')
table = {n: {'before': before.get(n, 0), 'after': after.get(n, 0)} for n in sorted(set(before) | set(after))}
total = save(KIT, staged, doc, {'triangles_total': sum(after.values()), 'triangles_by_mesh': table})
print('S03 refined triangles:', sum(before.values()), '->', total, 'removed', sum(before.values()) - total, flush=True)
