import bpy,struct,numpy as np
from pathlib import Path
cam=bpy.data.objects['CAM_S07_hero'];hero=cam.matrix_world.translation.copy();rot=cam.matrix_world.to_quaternion();inv=rot.inverted();dg=bpy.context.evaluated_depsgraph_get();tx=.36;ty=tx*941/1672
sets={}
for n in ('S07_tree_branch','S07_tree_leaves','S07_rock_pedestal','S07_rock_ledge','S07_rock_fg_L','S07_rock_fg_M'):
 ob=bpy.data.objects[n].evaluated_get(dg);m=ob.to_mesh();m.calc_loop_triangles();world=np.array([tuple(ob.matrix_world@v.co) for v in m.vertices]);loc=np.array([tuple(inv@(ob.matrix_world@v.co-hero)) for v in m.vertices]);inds=np.array([list(q.vertices) for q in m.loop_triangles]); triangles=world[inds];norm=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]);sets[n]=(loc,inds,triangles.mean(axis=1),norm);ob.to_mesh_clear()
outdir=Path('test-results/MO-2f')
files=[(outdir/'round4-tree.bin').open('wb'),(outdir/'round4-rock.bin').open('wb')]
for t in [i/200 for i in range(201)]+[i/7 for i in range(8)]:
 remain=1-t;x=2.5*remain;y=-.75*remain;z=4.0*remain;p=hero+rot@__import__('mathutils').Vector((x,y,z))
 for group,names in enumerate((('S07_tree_branch','S07_tree_leaves'),('S07_rock_pedestal','S07_rock_ledge','S07_rock_fg_L','S07_rock_fg_M'))):
  data=[]
  for n in names:
   loc,inds,cent,norm=sets[n];d=-loc[:,2]+z
   xy=np.array((.5+(loc[:,0]-x)/d/tx/2,.5+(loc[:,1]-y)/d/ty/2)).T
   mask=(d[inds]>0.1).all(axis=1)
   if group and np.any((d[inds].min(axis=1)<0.1)&(d[inds].max(axis=1)>0.1)&(norm[:,2]<0)&(np.sum(norm*(np.array(p)-cent),axis=1)>0)): raise RuntimeError(f'Near-plane crossing on {n} at {t}')
   if group:mask &= (norm[:,2]<0)&(np.sum(norm*(np.array(p)-cent),axis=1)>0)
   data.extend(xy[inds[mask]].reshape(-1,6).tolist())
  files[group].write(struct.pack('<i',len(data)))
  for tri in data:files[group].write(struct.pack('<6f',*tri))
for f in files:f.close()







