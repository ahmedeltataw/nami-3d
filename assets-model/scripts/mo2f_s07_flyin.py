"""MO-2f: S07 approach; render and measure eight frames."""
import json, sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'assets-model/scripts'))
import kit_render
KIT='s07_future_v2'
OUT=ROOT/'test-results/MO-2f'
OUT.mkdir(parents=True,exist_ok=True)
manifest_path=ROOT/'assets-model/export/s07_future_v2.manifest.json'
cam=bpy.data.objects['CAM_S07_hero']
hero=cam.matrix_world.translation.copy()
rotation=cam.matrix_world.to_quaternion()
direction=rotation @ Vector((0,0,-1))
travel=4.0
lateral=2.5
vertical_start=-0.75
start=hero-direction*travel+(rotation @ Vector((lateral,vertical_start,0)))
control=[start, start.lerp(hero,1/3),start.lerp(hero,2/3),hero]
def progress(t):
 return t
# The camera horizontal fit yields tan(vFOV/2) = tan(hFOV/2)/aspect.
ty=(cam.data.sensor_width/(2*cam.data.lens))*kit_render.HEIGHT/kit_render.WIDTH
tx=cam.data.sensor_width/(2*cam.data.lens)
deps=bpy.context.evaluated_depsgraph_get()
def vertices(objects):
 result=[]
 for ob in objects:
  ev=ob.evaluated_get(deps)
  mesh=ev.to_mesh()
  if mesh:
   result.extend(rotation.inverted() @ (ev.matrix_world @ v.co-hero) for v in mesh.vertices)
   ev.to_mesh_clear()
 return result
robot=vertices([o for o in bpy.data.collections['REF'].objects if o.type=='MESH' and not o.hide_render])
names=['S07_N','S07_N_rim_front','S07_N_rim_back','S07_orbit','S07_orbit_arc1','S07_orbit_arc2']
logo=vertices([bpy.data.objects[n] for n in names])
trees={n:vertices([bpy.data.objects[n]]) for n in ('S07_tree_branch','S07_tree_leaves')}
branch_base=trees['S07_tree_branch'][:8]  # First ring of the main branch tube.
def bounds(points,t,vertical=0):
 xy=[(0.5+(v.x-lateral*(1-t))/(-v.z+travel*(1-t))/tx/2,0.5+(v.y-vertical)/(-v.z+travel*(1-t))/ty/2) for v in points if -v.z+travel*(1-t)>0]
 if not xy: raise RuntimeError('No projected vertices')
 return [min(p[0] for p in xy),min(p[1] for p in xy),max(p[0] for p in xy),max(p[1] for p in xy)]
sky=bpy.data.objects['S07_sky_city']
v0,v1,_,v3=[sky.matrix_world @ v.co for v in sky.data.vertices]
e1,e2=v1-v0,v3-v0
normal=e1.cross(e2).normalized()
coverage=[]; heights=[]; tree_samples=[]
tree_area=[int(x) for x in (OUT/'round4-tree-area.txt').read_text().splitlines()]
rock_area=[int(x) for x in (OUT/'round4-rock-area.txt').read_text().splitlines()]
if len(tree_area)!=209 or len(rock_area)!=209 or any(a>b for a,b in zip(tree_area[:200],tree_area[1:201])): raise RuntimeError('Missing or non-monotonic silhouette measurement')
if max(rock_area[:201])/(836*471)>.15: raise RuntimeError('Rock underside exceeds 15 percent')
for i in range(201):
 t=i/200; f=progress(t); vertical=vertical_start*(1-f); p=start.lerp(hero,f)
 for x,y in ((-1,-1),(-1,1),(1,-1),(1,1)):
  ray=rotation @ Vector((x*tx,y*ty,-1))
  d=(v0-p).dot(normal)/ray.dot(normal)
  hit=p+ray*d-v0
  uv=[hit.dot(e1)/e1.length_squared,hit.dot(e2)/e2.length_squared]
  if d<=0 or min(uv)<0 or max(uv)>1: raise RuntimeError(f'Sky edge at {t}: {uv}')
  coverage.append(uv)
 b=bounds(robot,f,vertical); heights.append(b[3]-b[1])
 if min(b[0],b[1],1-b[2],1-b[3])<0: raise RuntimeError(f'Robot clipped at {t}: {b}')
 lb=bounds(logo,f,vertical)
 if min(lb[0],lb[1],1-lb[2],1-lb[3])<0: raise RuntimeError(f'N or ring clipped at {t}: {lb}')
 tree_boxes={name:bounds(points,f,vertical) for name,points in trees.items()}
 for name,q in tree_boxes.items():
  if q[2]>0 and q[0]<1 and q[3]>0 and q[1]<1 and (q[0]>=0 or q[3]<=1): raise RuntimeError(f'Tree enters away from hero corner at {t}: {name} {q}')
 base=bounds(branch_base,f,vertical)
 visible=any(q[2]>0 and q[0]<1 and q[3]>0 and q[1]<1 for q in tree_boxes.values())
 if visible and base[2]>=0 and base[1]<1: raise RuntimeError(f'Branch base not off the top-left corner at {t}: {base}')
 tree_samples.append({'t':t,'tree_bbox_normalized':tree_boxes,'branch_base_bbox_normalized':base,'robot_bbox_normalized':b,'robot_fully_inside':True,'rock_underside_area_upper_fraction':rock_area[i]/(836*471),'tree_projected_silhouette_pixels_836x471':tree_area[i]})
if any(a>b+1e-7 for a,b in zip(heights,heights[1:])): raise RuntimeError('Robot screen height is not monotonic')
rows=[]; specs={}
for i in range(8):
 t=i/7; f=progress(t); vertical=vertical_start*(1-f); p=start.lerp(hero,f); b=bounds(logo,f,vertical); rb=bounds(robot,f,vertical)
 row={'frame':i+1,'t':t,'robot_height_px':(rb[3]-rb[1])*kit_render.HEIGHT,'robot_bbox_normalized':rb,'tree_bbox_normalized':{name:bounds(points,f,vertical) for name,points in trees.items()},'branch_base_bbox_normalized':bounds(branch_base,f,vertical),'robot_fully_inside':True,'rock_underside_area_upper_fraction':rock_area[201+i]/(836*471),'tree_projected_silhouette_pixels_836x471':tree_area[201+i],'logo_ring_bbox_normalized':b,'logo_ring_margins_px':{'left':b[0]*kit_render.WIDTH,'right':(1-b[2])*kit_render.WIDTH,'top':(1-b[3])*kit_render.HEIGHT,'bottom':b[1]*kit_render.HEIGHT}}
 rows.append(row)
 specs['reference' if i==7 else f'frame_{i+1:02d}']={'location':p,'target':p+direction,'lens':cam.data.lens,'rotation_quaternion':rotation}
if min(rows[0]['logo_ring_margins_px'].values())<15: raise RuntimeError(f'Opening N or ring clipped: {rows[0]}')
(OUT/'s07-measurements.json').write_text(json.dumps({'frames':rows,'coverage_samples':201,'sky_card_uv_min':min(min(p) for p in coverage),'sky_card_uv_max':max(max(p) for p in coverage),'robot_height_monotonic_samples':201,'tree_samples':tree_samples,'underside_measurement':{'resolution':[836,471],'method':'upper bound: raster union of camera-facing downward-normal rock triangles without occlusion','max_fraction':max(rock_area[:201])/(836*471)},'tree_silhouette_measurement':{'resolution':[836,471],'monotonic':True,'method':'unoccluded union of projected evaluated tree triangles'}},indent=2)+'\n',encoding='utf8')
print('MEASUREMENTS',json.dumps(rows),flush=True)
kit_render.render_views(KIT,specs,OUT/'frames')
g=lambda p:[p.x,p.z,-p.y]
manifest=json.loads(manifest_path.read_text(encoding='utf8'))
manifest['mo2a_jump6_camera']={'description':'MO-2f round 9: 4 m approach from a 2.5 m camera-right and 0.75 m camera-down offset, fixed hero orientation; linear cubic Bezier','control_points_gltf':[g(p) for p in control],'look_dir_gltf':g(direction),'vertical_fov_deg':22.9,'coverage_samples':201,'robot_scale_samples':201,'travel_m':travel,'camera_right_offset_m':lateral,'camera_up_offset_m':vertical_start,'tree_boundary_samples':201}
manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print('MO-2f complete',flush=True)

