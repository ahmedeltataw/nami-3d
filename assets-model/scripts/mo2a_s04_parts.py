"""Make S04 phone assembly parts and glTF extras from the approved phone.

Run on s04_idea_v2.blend with the shared Blender lock held. Existing visible
details are split by connected component; board and battery are internal.
Directions in extras use glTF-local axes (x, y, z), not Blender-local axes.
"""
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
import parts_lib as P
from mo2a_export import OUT, backup, save, stage
from mo2a_inspect import read_glb

KIT = 's04_idea_v2'
backup(KIT, 's04-before-parts')
phone = bpy.data.objects['S04_phone']
marker = 'mo2a_phone_parts_v1'
new_names = ('S04_phone_back_plate', 'S04_phone_buttons', 'S04_phone_speaker',
             'S04_phone_board', 'S04_phone_battery')
if not phone.get(marker) and any(bpy.data.objects.get(n) for n in new_names):
    raise RuntimeError('Part names already exist without the complete marker')


def hero(label):
    cam = bpy.data.objects['CAM_S04_hero']
    loc = cam.matrix_world.translation.copy()
    direction = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    kit_render.render_views(KIT, {'reference': {'location': loc, 'target': loc + direction,
                                                'lens': cam.data.lens}}, OUT / label)


def connected_face_groups(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    pending = set(bm.faces)
    groups = {'buttons': set(), 'speaker': set(), 'camera': set()}
    while pending:
        todo = [pending.pop()]
        component = set(todo)
        while todo:
            face = todo.pop()
            for vert in face.verts:
                for neighbour in vert.link_faces:
                    if neighbour in pending:
                        pending.remove(neighbour)
                        component.add(neighbour)
                        todo.append(neighbour)
        vertices = {v for face in component for v in face.verts}
        centre = sum((v.co for v in vertices), Vector()) / len(vertices)
        kind = 'speaker' if centre.z < -1.7 else 'buttons' if abs(centre.x) > 0.8 else 'camera'
        groups[kind].update(f.index for f in component)
    bm.free()
    if any(not group for group in groups.values()):
        raise RuntimeError(f'Unable to identify phone detail components: {groups}')
    return groups


def retain_faces(ob, keep):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def duplicate(original, name):
    obj = original.copy()
    obj.data = original.data.copy()
    obj.name = name
    original.users_collection[0].objects.link(obj)
    return obj


def half(ob, keep_positive):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    cut = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                  plane_co=(0, 0, 0), plane_no=(0, 1, 0), dist=1e-6,
                                  clear_inner=keep_positive, clear_outer=not keep_positive)
    edges = [e for e in cut['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_boundary]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def internal_box(name, centre, size, color):
    bm = bmesh.new()
    result = bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, verts=result['verts'], vec=size)
    bmesh.ops.translate(bm, verts=result['verts'], vec=centre)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(P.material(name + '_material', color, metallic=0.25, roughness=0.45))
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections['S04_PROPS'].objects.link(obj)
    obj.parent = phone
    return obj


parts = {
    'back_plate': ('S04_phone_back_plate', (0, 0, -1), 0.55),
    'buttons': ('S04_phone_buttons', (1, 0, 0), 0.36),
    'board': ('S04_phone_board', (0, 0, -1), 0.28),
    'battery': ('S04_phone_battery', (0, 0, 1), 0.28),
    'speaker': ('S04_phone_speaker', (0, -1, 0), 0.30),
    'camera_module': ('S04_phone_details', (0, 0, -1), 0.42),
    'glass': ('S04_phone_body', (0, 0, 1), 0.38),
    'display': ('S04_phone_screen', (0, 0, 1), 0.60),
}
if not phone.get(marker):
    hero('s04-parts-before')
    details = bpy.data.objects['S04_phone_details']
    groups = connected_face_groups(details.data)
    buttons = duplicate(details, 'S04_phone_buttons')
    speaker = duplicate(details, 'S04_phone_speaker')
    retain_faces(buttons, groups['buttons'])
    retain_faces(speaker, groups['speaker'])
    retain_faces(details, groups['camera'])
    body = bpy.data.objects['S04_phone_body']
    back = duplicate(body, 'S04_phone_back_plate')
    half(body, False)
    half(back, True)
    internal_box('S04_phone_board', (0, 0, 0.55), (1.30, 0.025, 0.95), '#204F40')
    internal_box('S04_phone_battery', (0, 0, -0.45), (1.10, 0.04, 1.45), '#222B2A')
    for _, (node, direction, distance) in parts.items():
        ob = bpy.data.objects[node]
        ob['exploded_direction'] = list(direction)
        ob['exploded_distance'] = distance
    phone[marker] = True
    bpy.context.view_layer.update()
exported = {node['name'] for node in read_glb(ROOT / 'assets-model' / 'export' / (KIT + '.glb'))['nodes']}
added = tuple(name for name in new_names if name not in exported)
staged, doc = stage(KIT, 's04-parts', added=added)
nodes = {node['name']: node for node in doc['nodes']}
manifest_parts = []
for role, (name, direction, distance) in parts.items():
    extra = nodes[name].get('extras', {})
    if list(extra.get('exploded_direction', [])) != list(direction) or abs(extra.get('exploded_distance', 0) - distance) > 1e-6:
        raise RuntimeError(f'Missing or incorrect glTF extras for {name}')
    manifest_parts.append({'role': role, 'node': name, 'exploded_direction': list(direction),
                           'exploded_distance': distance})
hero('s04-parts-after')
print('S04 triangles', save(KIT, staged, doc, {'phone_exploded_parts': manifest_parts,
                                               'phone_exploded_direction_space': 'glTF local axes'}), flush=True)
