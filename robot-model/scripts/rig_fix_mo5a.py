"""Shorten the distal forearm shell without moving any joint or anchor."""
import bpy
import bmesh
import json
import os
import struct
from mathutils import Vector, Matrix


def apply():
    bpy.context.view_layer.update()
    for side in 'LR':
        obj = bpy.data.objects[f'Arm_{side}_Upper']
        if obj.get('mo5a_forearm_fixed'):
            continue
        world = obj.matrix_world.copy()
        inverse = world.inverted()
        for vertex in obj.data.vertices:
            point = world @ vertex.co
            if point.z < 0.8:
                point.z = 0.8 + (point.z - 0.8) * (0.30 / 0.45)
                vertex.co = inverse @ point
        obj['mo5a_forearm_fixed'] = True
    bpy.context.view_layer.update()

    # Enlarge each capsule slightly to close the original seams, then add a
    # low-poly knuckle at its pivot. The knuckle moves with the finger.
    for side in 'LR':
        for part in ('Finger_1', 'Finger_2', 'Finger_3', 'Finger_4', 'Thumb'):
            obj = bpy.data.objects[f'Hand_{side}_{part}']
            if obj.get('mo5a_attachment_fixed'):
                continue
            joint = bpy.data.objects[f'{part}_{side}']
            center = obj.matrix_world.inverted() @ joint.matrix_world.translation
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            remaining = set(bm.verts)
            while remaining:
                stack = [remaining.pop()]
                group = []
                while stack:
                    vertex = stack.pop()
                    group.append(vertex)
                    for edge in vertex.link_edges:
                        other = edge.other_vert(vertex)
                        if other in remaining:
                            remaining.remove(other)
                            stack.append(other)
                centroid = sum((v.co for v in group), Vector()) / len(group)
                for vertex in group:
                    vertex.co = centroid + (vertex.co - centroid) * 1.22
            result = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.065 if part == 'Thumb' else 0.050)
            bmesh.ops.translate(bm, verts=result['verts'], vec=center)
            for face in bm.faces:
                face.smooth = True
            bm.to_mesh(obj.data)
            bm.free()
            obj.data.update()
            obj['mo5a_attachment_fixed'] = True
    bpy.context.view_layer.update()


def apply_bridges(lod):
    """Attach each knuckle to the palm at the pivot in this LOD."""
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    path = os.path.join(base, 'public', 'models', 'robot', f'robot_{lod}.glb')
    with open(path, 'rb') as f:
        f.read(12)
        size, _ = struct.unpack('<II', f.read(8))
        doc = json.loads(f.read(size))
    for side in 'LR':
        obj = bpy.data.objects[f'Hand_{side}_Palm']
        palm = bpy.data.objects[f'Palm_{side}']
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        starts = Vector((0, 0, -0.055))
        for part in ('Finger_1', 'Finger_2', 'Finger_3', 'Finger_4', 'Thumb'):
            node = next(n for n in doc['nodes'] if n.get('name') == f'{part}_{side}')
            x, y, z = node.get('translation', (0, 0, 0))
            endpoint = Vector((x, -z, y))
            delta = endpoint - starts
            direction = delta.normalized()
            midpoint = (starts + endpoint) * .5
            local_to_obj = obj.matrix_world.inverted() @ palm.matrix_world
            rotation = direction.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            transform = local_to_obj @ Matrix.Translation(midpoint) @ rotation
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8,
                radius1=.032, radius2=.032, depth=delta.length + .02, matrix=transform)
        for face in bm.faces:
            face.smooth = True
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    bpy.context.view_layer.update()
