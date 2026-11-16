"""Shared, headless kit previews. Blender coordinates and lens lengths are in metres/mm.

    from kit_render import render_views
    views = {'reference': {'location': (0, -20, 6), 'target': (0, 0, 3), 'lens': 36}, 'left': {'location': (-10, -20, 8), 'target': (0, 0, 3), 'lens': 36}}
    render_views('s04_product_hall_kit', views, output_directory)

The kit name must contain S01 through S07; reference images are read from
NAMI_REFERENCE_DIR, or from the project's briefs/refs directory. Each camera
spec is a mapping with location, target, and optional lens (default 35 mm).
The fixed preset uses Standard, exposure -0.25, gamma 1, a neutral world (0.18,
0.18, 0.18) at strength 1, and three white disk area lights aimed at (0,0,2):
key (0,-4,12), 2400 W, 12 m; fills (-12,8,8) and (12,8,8), 1400 W, 10 m.
Existing lights are temporarily hidden so the preset is repeatable.
Calibration (Blender 5.3 EEVEE, reference camera, mean Rec.709 luma of
8-bit sRGB): S03 kit 90.23 vs reference 82.34 (109.6%); S04 kit 83.66 vs
reference 73.85 (113.3%). Different geometry, cameras, and fallback engines
can change the result; this preset is not a guarantee of visual parity.
"""
from array import array
import os
from pathlib import Path
import re

import bpy
from mathutils import Vector

WIDTH, HEIGHT = 1672, 941


def _reference_path(kit):
    match = re.search(r'(?<![a-z0-9])s(0[1-7])(?![0-9])', kit.lower())
    if not match:
        raise ValueError('kit name must contain a scene ID such as s03')
    configured = os.environ.get('NAMI_REFERENCE_DIR')
    root = Path(__file__).resolve().parents[2]
    if root.parent.name == '.worktrees':
        root = root.parent.parent
    path = Path(configured) if configured else root / 'briefs' / 'refs'
    result = path / ('S' + match.group(1) + '.png')
    if not result.is_file():
        raise FileNotFoundError('reference image not found: ' + str(result))
    return result


def _compare(render_path, reference_path, output, scene):
    images = []
    combined = None
    try:
        for path in (render_path, reference_path):
            image = bpy.data.images.load(str(path), check_existing=False)
            images.append(image)
            if tuple(image.size) != (WIDTH, HEIGHT):
                image.scale(WIDTH, HEIGHT)
        combined = bpy.data.images.new('KitComparison', width=WIDTH * 2, height=HEIGHT, alpha=True)
        row_size = WIDTH * 4
        left = array('f', [0.0]) * (row_size * HEIGHT)
        right = array('f', [0.0]) * (row_size * HEIGHT)
        images[0].pixels.foreach_get(left)
        images[1].pixels.foreach_get(right)
        pixels = array('f', [0.0]) * (row_size * HEIGHT * 2)
        for y in range(HEIGHT):
            src = y * row_size
            dst = src * 2
            pixels[dst:dst + row_size] = left[src:src + row_size]
            pixels[dst + row_size:dst + 2 * row_size] = right[src:src + row_size]
        combined.pixels.foreach_set(pixels)
        exposure = scene.view_settings.exposure
        try:
            scene.view_settings.exposure = 0
            combined.save_render(str(output), scene=scene)
        finally:
            scene.view_settings.exposure = exposure
    finally:
        if combined:
            bpy.data.images.remove(combined)
        for image in images:
            bpy.data.images.remove(image)


def render_views(scene_name, camera_specs, out_dir):
    """Render named camera specs and a reference comparison for the active scene.

    Returns paths keyed by view name plus 'compare'. The preset and preview
    objects are temporary; the caller's scene and existing lights are restored.
    """
    if not re.fullmatch(r'[A-Za-z0-9_-]+', scene_name):
        raise ValueError('scene_name must be a safe kit basename')
    if ('reference' not in camera_specs or 'compare' in camera_specs or
            any(not re.fullmatch(r'[A-Za-z0-9_-]+', n) for n in camera_specs)):
        raise ValueError('camera_specs must include reference and safe view names')
    ref = _reference_path(scene_name)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    # A scene copy keeps render, colour management, and camera settings isolated.
    preview = scene.copy()
    preview.name = 'KitRenderPreview'
    original_scene = bpy.context.window.scene
    hidden = [(obj, obj.hide_render) for obj in preview.objects if obj.type == 'LIGHT']
    collection = bpy.data.collections.new('KitRenderLights')
    preview.collection.children.link(collection)
    world = bpy.data.worlds.new('KitRenderWorld')
    camera_data = bpy.data.cameras.new('KitRenderCamera')
    camera = bpy.data.objects.new('KitRenderCamera', camera_data)
    collection.objects.link(camera)
    try:
        bpy.context.window.scene = preview
        for obj, _ in hidden:
            obj.hide_render = True
        preview.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes.get('Background')
        bg.inputs['Color'].default_value = (0.18, 0.18, 0.18, 1)
        bg.inputs['Strength'].default_value = 1
        for name, loc, power, size in (('Key', (0, -4, 12), 2400, 12),
                                       ('FillLeft', (-12, 8, 8), 1400, 10),
                                       ('FillRight', (12, 8, 8), 1400, 10)):
            data = bpy.data.lights.new('KitRender' + name, 'AREA')
            data.energy, data.shape, data.size = power, 'DISK', size
            obj = bpy.data.objects.new(data.name, data)
            collection.objects.link(obj)
            obj.location = loc
            obj.rotation_euler = (Vector((0, 0, 2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        preview.camera = camera
        preview.render.resolution_x, preview.render.resolution_y = WIDTH, HEIGHT
        preview.render.resolution_percentage = 100
        preview.render.image_settings.file_format = 'PNG'
        preview.render.image_settings.color_mode = 'RGBA'
        preview.render.film_transparent = False
        preview.render.use_compositing = False
        preview.render.use_sequencer = False
        preview.view_settings.view_transform = 'Standard'
        preview.view_settings.look = 'None'
        preview.view_settings.exposure, preview.view_settings.gamma = -0.25, 1
        try:
            preview.render.engine = 'BLENDER_EEVEE'
        except (TypeError, ValueError):
            print('EEVEE unavailable; falling back to Workbench')
            preview.render.engine = 'BLENDER_WORKBENCH'
        paths = {}
        for name, spec in camera_specs.items():
            camera.location = spec['location']
            direction = Vector(spec['target']) - camera.location
            if direction.length == 0:
                raise ValueError('camera location and target must differ')
            camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            camera_data.lens = spec.get('lens', 35)
            path = out / f'{scene_name}-{name}.png'
            preview.render.filepath = str(path.resolve())
            try:
                bpy.ops.render.render(write_still=True)
            except RuntimeError as exc:
                if preview.render.engine != 'BLENDER_EEVEE':
                    raise
                print('EEVEE render failed; falling back to Workbench:', exc)
                preview.render.engine = 'BLENDER_WORKBENCH'
                bpy.ops.render.render(write_still=True)
            paths[name] = path
        compare = out / f'{scene_name}-compare.png'
        _compare(paths['reference'], ref, compare, preview)
        paths['compare'] = compare
        return paths
    finally:
        bpy.context.window.scene = original_scene
        for obj, state in hidden:
            obj.hide_render = state
        bpy.data.scenes.remove(preview)
        for obj in list(collection.objects):
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data and data.users == 0:
                if isinstance(data, bpy.types.Light):
                    bpy.data.lights.remove(data)
                elif isinstance(data, bpy.types.Camera):
                    bpy.data.cameras.remove(data)
        bpy.data.collections.remove(collection)
        bpy.data.worlds.remove(world)
