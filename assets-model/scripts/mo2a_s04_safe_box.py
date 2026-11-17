"""Sample a conservative S04 camera box relative to accepted hero card edges.

Each visible edge is compared at its clipped endpoints. Non-hero edge IDs,
missing hero edge IDs, or >2% movement on either screen axis fail. The test
is geometric and ignores occlusion; safety between samples is not proven.
"""
import json
import math
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets-model' / 'scripts'))
import kit_render
from mo2a_export import OUT, paths

KIT = 's04_idea_v2'
blend, _, manifest_path = paths(KIT)
if Path(bpy.data.filepath).resolve() != blend.resolve():
    raise RuntimeError('Open the approved S04 blend')
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y = 1671, 941
scene.render.resolution_percentage = 100
cam = bpy.data.objects['CAM_S04_hero']
card = bpy.data.objects['S04_city']
if cam.parent:
    raise RuntimeError('Expected an unparented hero camera')
bpy.context.view_layer.update()
vertices = [card.matrix_world @ v.co for v in card.data.vertices]
location = cam.matrix_world.translation.copy()
q = cam.matrix_world.to_quaternion()
forward = q @ Vector((0,0,-1))
mode, old_rotation, old_location = cam.rotation_mode, cam.rotation_euler.copy(), cam.location.copy()
cam.rotation_mode = 'QUATERNION'


def clipped(a,b):
    if min(a.z,b.z) <= 0:
        raise RuntimeError('Card vertex behind camera; projection not supported')
    x,y,dx,dy = a.x,a.y,b.x-a.x,b.y-a.y
    lo,hi=0.,1.
    for p,r in ((-dx,x),(dx,1-x),(-dy,y),(dy,1-y)):
        if abs(p)<1e-12:
            if r<0:
                return None
        else:
            t=r/p
            if p<0: lo=max(lo,t)
            else: hi=min(hi,t)
            if lo>hi: return None
    return ((x+lo*dx,y+lo*dy),(x+hi*dx,y+hi*dy))


def pose(yaw,pitch,dolly):
    cam.location = location + forward*dolly
    cam.rotation_quaternion = Quaternion((0,0,1),math.radians(yaw)) @ q @ Quaternion((1,0,0),math.radians(pitch))
    bpy.context.view_layer.update()
    return cam.rotation_quaternion.copy()


def edges():
    proj=[world_to_camera_view(scene,cam,v) for v in vertices]
    return {str(e.index):p for e in card.data.edges if (p:=clipped(proj[e.vertices[0]],proj[e.vertices[1]])) is not None}


pose(0,0,0)
baseline=edges()
if not baseline:
    raise RuntimeError('Expected visible hero edges; inspect scene first')


def check(yaw,pitch,dolly):
    pose(yaw,pitch,dolly)
    current=edges()
    if set(current)!=set(baseline):
        return False, {'changed_edge_set':True}
    dx=max(abs(current[k][i][0]-baseline[k][i][0]) for k in baseline for i in (0,1))
    dy=max(abs(current[k][i][1]-baseline[k][i][1]) for k in baseline for i in (0,1))
    return dx<=0.02 and dy<=0.02, {'dx':dx,'dy':dy}


def grid(scale, n):
    maxdx=maxdy=0.
    for yi in range(n):
        y=(2*yi/(n-1)-1)*scale
        for pi in range(n):
            p=(2*pi/(n-1)-1)*scale
            for di in range(n):
                d=(2*di/(n-1)-1)*scale*0.1
                valid, delta=check(y,p,d)
                if not valid:
                    return False, {'yaw':y,'pitch':p,'dolly':d,**delta}
                maxdx=max(maxdx,delta['dx']);maxdy=max(maxdy,delta['dy'])
    return True, {'max_dx':maxdx,'max_dy':maxdy}


try:
    lo,hi=0.,5.
    for _ in range(11):
        mid=(lo+hi)/2
        if grid(mid,7)[0]: lo=mid
        else: hi=mid
    # Round inward and sample more densely, including the eight joint corners.
    # Leave measurable margin to the 2% boundary between discrete samples.
    half=max(0, math.floor(lo*100)/100 - 0.02)
    half=round(half, 3)
    while half>0:
        passed,stats=grid(half,11)
        if passed: break
        half=round(half-0.001,3)
    if half<=0: raise RuntimeError('No positive sampled safe box found')
    for axis in range(3):
        for i in range(101):
            vals=[0.,0.,0.]
            vals[axis]=(2*i/100-1)*half*(0.1 if axis==2 else 1)
            ok,detail=check(*vals)
            if not ok: raise RuntimeError(f'Independent sample failed: {vals} {detail}')
    specs={}
    keys={'reference':(0,0,0),'yaw_min':(-half,0,0),'yaw_max':(half,0,0),
          'pitch_min':(0,-half,0),'pitch_max':(0,half,0),
          'dolly_min':(0,0,-half*.1),'dolly_max':(0,0,half*.1)}
    for ys in (-1,1):
        for ps in (-1,1):
            for ds in (-1,1):
                keys['corner_' + '_'.join('p' if v > 0 else 'm' for v in (ys,ps,ds))]=(ys*half,ps*half,ds*half*.1)
    for name, vals in keys.items():
        rot=pose(*vals)
        p=cam.matrix_world.translation.copy()
        d=rot @ Vector((0,0,-1))
        specs[name]={'location':p,'target':p+d,'lens':cam.data.lens,'rotation_quaternion':rot}
    kit_render.WIDTH,kit_render.HEIGHT=480,270
    kit_render.render_views(KIT,specs,OUT/'s04-safe-box')
    manifest=json.loads(manifest_path.read_text(encoding='utf8'))
    manifest['cameraSafeRange']={
        'status':'ok',
        'criterion':'No new S04_city edge ID in viewport; every hero-visible edge remains visible and its clipped endpoint coordinates move at most 0.02 frame widths horizontally and 0.02 frame heights vertically.',
        'reference':'camera_hero',
        'coordinates':'yaw around Blender world +Z, pitch around camera local +X, dolly along hero forward; combined yaw then hero rotation then pitch',
        'yaw_deg':{'min':-half,'max':half},'pitch_deg':{'min':-half,'max':half},
        'dolly_m':{'min':-round(half*.1,4),'max':round(half*.1,4)},
        'sampled_joint_grid':[11,11,11],'independent_samples_per_axis':101,
        'samples_do_not_prove_continuous_safety':True,
        'max_sampled_edge_shift_fraction':stats,'evidence':'test-results/MO-2a/s04-safe-box/'}
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print('S04 sampled box',half,'deg',half*.1,'m',stats,flush=True)
finally:
    cam.location=old_location
    cam.rotation_mode=mode
    cam.rotation_euler=old_rotation
