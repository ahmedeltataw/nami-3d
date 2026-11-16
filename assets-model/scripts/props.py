"""Primitive and node helpers for the prop scripts (stations, arms, generic parts). Blender 5.3."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from common import (CHARCOAL, GREEN, b2g, fix_normals_outward, make_material, sweep_profile,  # noqa: F401
                    tri_count)

YELLOW = (0xF9 / 255, 0xB2 / 255, 0x33 / 255)


def materials():
    """The shared prop palette (one set per .blend)."""
    mats = {
        "white": make_material("Shell_White", (0.95, 0.955, 0.96), roughness=0.3),
        "grey": make_material("Trim_Grey", (0.78, 0.8, 0.82), roughness=0.4),
        "charcoal": make_material("Charcoal", CHARCOAL, roughness=0.45, metallic=0.3),
        "green": make_material("Accent_Green", GREEN, roughness=0.3, emission_srgb=GREEN, emission_strength=2.0),
        "yellow": make_material("Accent_Yellow", YELLOW, roughness=0.35, emission_srgb=YELLOW,
                                emission_strength=0.5),
        "screen": make_material("Screen", (0.03, 0.035, 0.04), roughness=0.15, emission_srgb=(0.0, 0.0, 0.0),
                                emission_strength=1.0),
        "holo": make_material("Holo_Green", GREEN, roughness=0.2, emission_srgb=GREEN, emission_strength=1.5),
    }
    holo = mats["holo"]
    next(n for n in holo.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Alpha"].default_value = 0.35
    try:
        holo.surface_render_method = "BLENDED"
    except (AttributeError, TypeError):
        pass
    return mats


class Builder:
    """Collects geometry for one node in a bmesh, with a material slot list."""

    def __init__(self, mats):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.verify()
        self.slots = []
        self.mats = mats

    def slot(self, key):
        m = self.mats[key]
        if m not in self.slots:
            self.slots.append(m)
        return self.slots.index(m)

    def _finish(self, verts, key, M):
        bmesh.ops.transform(self.bm, verts=verts, matrix=M)
        idx = self.slot(key)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = idx
        return verts

    def box(self, center, size, key="white", bevel=0.0, M=Matrix.Identity(4)):
        before = set(self.bm.verts)
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        bmesh.ops.transform(self.bm, verts=res["verts"], matrix=Matrix.Diagonal((*size, 1.0)))
        if bevel > 0:
            edges = list({e for v in res["verts"] for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=1, affect="EDGES", profile=0.5)
        verts = [v for v in self.bm.verts if v not in before]
        return self._finish(verts, key, M @ Matrix.Translation(center))

    def cyl(self, center, r, depth, key="white", segs=24, r2=None, axis="Z", M=Matrix.Identity(4)):
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segs, radius1=r,
                                    radius2=r if r2 is None else r2, depth=depth)
        rot = {"Z": Matrix.Identity(4), "X": Matrix.Rotation(math.radians(90), 4, "Y"),
               "Y": Matrix.Rotation(math.radians(90), 4, "X")}[axis]
        return self._finish(res["verts"], key, M @ Matrix.Translation(center) @ rot)

    def sphere(self, center, r, key="white", subdiv=2, M=Matrix.Identity(4)):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=r)
        return self._finish(res["verts"], key, M @ Matrix.Translation(center))

    def torus(self, center, R, r, key="green", segs=48, rsegs=8, axis="Z", M=Matrix.Identity(4)):
        prof = [(R + r * math.cos(2 * math.pi * k / rsegs), r * math.sin(2 * math.pi * k / rsegs))
                for k in range(rsegs)]
        before = set(self.bm.verts)
        sweep_profile(self.bm, prof, 0, 2 * math.pi, segs, axis="Z")
        verts = [v for v in self.bm.verts if v not in before]
        rot = {"Z": Matrix.Identity(4), "Y": Matrix.Rotation(math.radians(90), 4, "X"),
               "X": Matrix.Rotation(math.radians(90), 4, "Y")}[axis]
        return self._finish(verts, key, M @ Matrix.Translation(center) @ rot)

    def ring(self, center, r0, r1, h, key="green", segs=48, M=Matrix.Identity(4)):
        before = set(self.bm.verts)
        sweep_profile(self.bm, [(r0, -h / 2), (r1, -h / 2), (r1, h / 2), (r0, h / 2)], 0, 2 * math.pi, segs,
                      axis="Z")
        verts = [v for v in self.bm.verts if v not in before]
        return self._finish(verts, key, M @ Matrix.Translation(center))

    def panel(self, center, w, h, t, r=0.04, key="white", M=Matrix.Identity(4), seg=4, uv01=False):
        """Rounded slab in the XZ plane (front = -Y), thickness t along Y."""
        return self.prism(rr_outline(w, h, r, seg), t, key, M @ Matrix.Translation(center), (w, h) if uv01 else None)

    def prism(self, out, t, key="white", M=Matrix.Identity(4), uv_wh=None):
        """Extrude an (x, z) outline (counter-clockwise seen from -Y) by t along Y; t = 0 gives one -Y face."""
        front = [self.bm.verts.new((x, -t / 2, z)) for x, z in out]
        faces = [self.bm.faces.new(front)]
        if t > 0:
            back = [self.bm.verts.new((x, t / 2, z)) for x, z in out]
            faces.append(self.bm.faces.new(list(reversed(back))))
            n = len(out)
            for i in range(n):
                j = (i + 1) % n
                faces.append(self.bm.faces.new((front[i], front[j], back[j], back[i])))
        if uv_wh:
            w, h = uv_wh
            for f in faces:
                for loop in f.loops:
                    loop[self.uv].uv = (loop.vert.co.x / w + 0.5, loop.vert.co.z / h + 0.5)
        verts = list({v for f in faces for v in f.verts})
        return self._finish(verts, key, M)

    def screen(self, center, w, h, r=0.03, M=Matrix.Identity(4)):
        """Flat UV 0-1 screen face facing -Y (one-sided)."""
        return self.panel(center, w, h, 0.0, r, "screen", M, seg=4, uv01=True)


def rr_outline(w, h, r, seg=4):
    pts = []
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    for cx, cz, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0),
                       (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


class Asset:
    """One exported GLB: a top-level collection with a root empty at the origin."""

    def __init__(self, scene, coll_name, root_name, mats, prefix=""):
        # prefix keeps object names unique when several assets in one .blend share node names;
        # export_clean() strips it for the GLB
        self.prefix = prefix
        self.coll = bpy.data.collections.new(coll_name)
        scene.collection.children.link(self.coll)
        self.root = self.empty(root_name, None, (0, 0, 0), size=0.5)
        self.mats = mats
        self.info = {}

    def empty(self, name, parent, pivot, size=0.15, role=None, display="PLAIN_AXES", rot=None):
        ob = bpy.data.objects.new(self.prefix + name, None)
        ob.empty_display_type = display
        ob.empty_display_size = size
        self.coll.objects.link(ob)
        if parent is not None:
            ob.parent = parent
        ob.matrix_world = Matrix.Translation(pivot) @ (rot if rot is not None else Matrix.Identity(4))
        if role:
            ob["nami_role"] = role
        return ob

    def node(self, name, parent, pivot, build, role=None, extra=None, two_sided=False, smooth=False):
        """build(b: Builder) writes geometry in this asset's space; the node pivot is `pivot`."""
        b = Builder(self.mats)
        build(b)
        bm = b.bm
        if not two_sided:
            fix_normals_outward(bm)
        else:
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        me = bpy.data.meshes.new(self.prefix + name)
        bm.to_mesh(me)
        bm.free()
        for m in b.slots:
            me.materials.append(m)
        me.transform(Matrix.Translation(-Vector(pivot)))
        for p in me.polygons:
            p.use_smooth = smooth
        ob = bpy.data.objects.new(self.prefix + name, me)
        self.coll.objects.link(ob)
        ob.parent = parent if parent is not None else self.root
        ob.matrix_world = Matrix.Translation(pivot)
        if role:
            ob["nami_role"] = role
        if extra:
            self.info[name] = extra
            for k, v in extra.items():
                ob[k] = v
        return ob

    def clean(self, name):
        return name[len(self.prefix):] if self.prefix and name.startswith(self.prefix) else name

    def export_clean(self, path):
        """Export with the prefix stripped from object names (only this asset's objects carry them now)."""
        from common import export_glb
        obs = list(self.coll.objects)
        ids = obs + [ob.data for ob in obs if ob.data is not None]
        for i in ids:
            i.name = self.clean(i.name)
        try:
            export_glb(self.coll.name, path)
        finally:
            for i in ids:
                i.name = self.prefix + i.name

    def tris(self):
        return sum(tri_count(o) for o in self.coll.objects if o.type == "MESH")

    def manifest_nodes(self):
        out = []
        for ob in self.coll.objects:
            d = {"name": self.clean(ob.name), "parent": self.clean(ob.parent.name) if ob.parent else None,
                 "type": "mesh" if ob.type == "MESH" else "empty",
                 "pivot_gltf": b2g(ob.matrix_world.translation)}
            if ob.type == "MESH":
                d["tris"] = tri_count(ob)
            if "nami_role" in ob.keys():
                d["role"] = ob["nami_role"]
            if self.clean(ob.name) in self.info:
                d.update(self.info[self.clean(ob.name)])
            out.append(d)
        return sorted(out, key=lambda d: d["name"])
