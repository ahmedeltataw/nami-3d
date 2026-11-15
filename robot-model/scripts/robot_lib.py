"""Reusable procedural geometry helpers for the robot master model.

Coordinate system: X = robot's left (+) / right (-), Z up, the robot faces -Y.
Scale: 1 unit = 400 px of the front reference image (ref_front.webp), with
pixel (917, 1680) - the bottom tip of the torso - at the world origin.
Geometry only; materials live in robot_materials.py.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix

# ---------------------------------------------------------------- reference mapping
PX = 1.0 / 400.0
CX, BASE_Y = 917.0, 1680.0


def ref(px, py):
    """Front-reference pixel -> (x, z) world."""
    return ((px - CX) * PX, (BASE_Y - py) * PX)


# ---------------------------------------------------------------- scene helpers
def get_coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def remove_obj(name):
    o = bpy.data.objects.get(name)
    if o is None:
        return
    data = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    if data is not None and data.users == 0:
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)


def bm_to_obj(name, bm, coll, smooth=True, sharp_deg=None):
    """Replace object `name` with the bmesh (idempotent rebuilds)."""
    remove_obj(name)
    if sharp_deg is not None:
        lim = math.radians(sharp_deg)
        for e in bm.edges:
            if e.is_manifold and e.calc_face_angle(0.0) > lim:
                e.smooth = False
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    me.update()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    return o


def add_subsurf(o, lv=1, rlv=2):
    m = o.modifiers.new("Subdivision", 'SUBSURF')
    m.levels, m.render_levels = lv, rlv
    return m


def add_bevel(o, width, seg=3, angle=35.0):
    m = o.modifiers.new("Bevel", 'BEVEL')
    m.width, m.segments = width, seg
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return m


def add_solidify(o, thick, offset=-1.0):
    m = o.modifiers.new("Solidify", 'SOLIDIFY')
    m.thickness, m.offset = thick, offset
    m.use_even_offset = True
    m.use_rim = True
    return m


def add_wnormal(o):
    m = o.modifiers.new("WeightedNormal", 'WEIGHTED_NORMAL')
    m.keep_sharp = True
    return m


# ---------------------------------------------------------------- analytic shapes
def se_F(x, y, z, a, b, c, r, r2=None):
    """Barr superellipsoid implicit value: (|x/a|^r + |z/c|^r)^(r2/r) + |y/b|^r2 (=1 on the surface).
    r shapes the front (XZ) outline, r2 the depth direction. r2=None -> classic single exponent."""
    r2 = r if r2 is None else r2
    return (abs(x / a) ** r + abs(z / c) ** r) ** (r2 / r) + abs(y / b) ** r2


def superellipsoid_bm(a, b, c, r, res=20, center=(0, 0, 0), r2=None):
    """Quad cube-sphere projected onto a superellipsoid (clean quad topology)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=res - 1, use_grid_fill=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    q = math.pi / 4
    C = Vector(center)
    for v in bm.verts:
        p = v.co
        d = Vector((math.tan(p.x * q), math.tan(p.y * q), math.tan(p.z * q))).normalized()
        rr = r if r2 is None else r2
        s = se_F(d.x, d.y, d.z, a, b, c, r, r2) ** (-1.0 / rr)      # F is homogeneous of degree r2
        v.co = d * s + C
    return bm


def se_profile_r(z, P):
    """Radius of a two-part superellipse profile (different top / bottom halves)."""
    dz = z - P['zm']
    h, n = (P['h_up'], P['n_up']) if dz >= 0 else (P['h_dn'], P['n_dn'])
    k = 1.0 - min(abs(dz) / h, 1.0) ** n
    return P['w'] * max(k, 0.0) ** (1.0 / n)


def se_profile_rows(P, n_up=16, n_dn=28):
    """(z, r) rings from just below the top pole to just above the bottom pole."""
    rows = []
    for i in range(1, n_up + 1):
        psi = (math.pi / 2) * (1 - i / n_up)
        rows.append((P['zm'] + P['h_up'] * math.sin(psi) ** (2 / P['n_up']),
                     P['w'] * math.cos(psi) ** (2 / P['n_up'])))
    for i in range(1, n_dn):
        psi = (math.pi / 2) * (i / n_dn)
        rows.append((P['zm'] - P['h_dn'] * math.sin(psi) ** (2 / P['n_dn']),
                     P['w'] * math.cos(psi) ** (2 / P['n_dn'])))
    return rows, P['zm'] + P['h_up'], P['zm'] - P['h_dn']


def lathe_bm(rows, ztop, zbot, seg=48, kx=1.0, ky=1.0, xc_fn=None, y0=0.0):
    """Revolve (z, r) rings into a closed quad mesh with elliptical cross-section."""
    bm = bmesh.new()
    xc = xc_fn or (lambda z: 0.0)
    top = bm.verts.new((xc(ztop), y0, ztop))
    bot = bm.verts.new((xc(zbot), y0, zbot))
    rings = []
    for z, r in rows:
        rings.append([bm.verts.new((xc(z) + kx * r * math.cos(2 * math.pi * j / seg),
                                    y0 + ky * r * math.sin(2 * math.pi * j / seg), z))
                      for j in range(seg)])
    for j in range(seg):
        j2 = (j + 1) % seg
        bm.faces.new((top, rings[0][j2], rings[0][j]))
        for i in range(len(rings) - 1):
            bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
        bm.faces.new((rings[-1][j], rings[-1][j2], bot))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


class Profile:
    """Arc-length table of a revolve profile; maps z <-> arc length s for even panel rows."""

    def __init__(self, P, samples=600):
        ztop, zbot = P['zm'] + P['h_up'], P['zm'] - P['h_dn']
        pts = [(ztop, 0.0)]
        for i in range(1, samples):
            psi = math.pi / 2 * (1 - 2 * i / samples)  # +90 .. -90
            if psi >= 0:
                z = P['zm'] + P['h_up'] * math.sin(psi) ** (2 / P['n_up'])
                r = P['w'] * math.cos(psi) ** (2 / P['n_up'])
            else:
                z = P['zm'] - P['h_dn'] * math.sin(-psi) ** (2 / P['n_dn'])
                r = P['w'] * math.cos(psi) ** (2 / P['n_dn'])
            pts.append((z, r))
        pts.append((zbot, 0.0))
        self.pts = pts
        self.s = [0.0]
        for (z0, r0), (z1, r1) in zip(pts, pts[1:]):
            self.s.append(self.s[-1] + math.hypot(z1 - z0, r1 - r0))

    def s_of_z(self, z):
        for i in range(len(self.pts) - 1):
            z0, z1 = self.pts[i][0], self.pts[i + 1][0]
            if z1 <= z <= z0:
                t = 0.0 if z0 == z1 else (z0 - z) / (z0 - z1)
                return self.s[i] + t * (self.s[i + 1] - self.s[i])
        return 0.0 if z > self.pts[0][0] else self.s[-1]

    def zr_of_s(self, s):
        s = min(max(s, 0.0), self.s[-1])
        lo, hi = 0, len(self.s) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.s[mid] <= s:
                lo = mid
            else:
                hi = mid
        t = (s - self.s[lo]) / max(self.s[hi] - self.s[lo], 1e-12)
        (z0, r0), (z1, r1) = self.pts[lo], self.pts[hi]
        return z0 + (z1 - z0) * t, r0 + (r1 - r0) * t


def revolve_panel_bm(prof, z_lo_fn, z_hi_fn, ky, seg=72, rows=28, rscale=1.0):
    """A ring-shaped patch of a revolve surface between z_lo(theta) and z_hi(theta).
    Ends that reach a pole are closed with a fan."""
    bm = bmesh.new()
    s_top, s_bot = 0.0, prof.s[-1]
    cols = []
    for j in range(seg):
        th = 2 * math.pi * j / seg
        s_a, s_b = prof.s_of_z(z_hi_fn(th)), prof.s_of_z(z_lo_fn(th))
        s_a, s_b = max(s_a, s_top + 0.004), min(s_b, s_bot - 0.004)
        col = []
        for i in range(rows + 1):
            # cosine spacing gives edge-support loops at both borders
            t = 0.5 - 0.5 * math.cos(math.pi * i / rows)
            z, r = prof.zr_of_s(s_a + (s_b - s_a) * t)
            r *= rscale
            col.append(bm.verts.new((r * math.cos(th), ky * r * math.sin(th), z)))
        cols.append(col)
    for j in range(seg):
        j2 = (j + 1) % seg
        for i in range(rows):
            bm.faces.new((cols[j][i], cols[j2][i], cols[j2][i + 1], cols[j][i + 1]))
    # close poles where the patch reaches them
    if all(prof.s_of_z(z_hi_fn(2 * math.pi * j / seg)) <= 0.005 for j in range(seg)):
        pole = bm.verts.new((0, 0, prof.pts[0][0]))
        for j in range(seg):
            bm.faces.new((pole, cols[(j + 1) % seg][0], cols[j][0]))
    if all(prof.s_of_z(z_lo_fn(2 * math.pi * j / seg)) >= prof.s[-1] - 0.005 for j in range(seg)):
        pole = bm.verts.new((0, 0, prof.pts[-1][0]))
        for j in range(seg):
            bm.faces.new((pole, cols[j][-1], cols[(j + 1) % seg][-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


# ---------------------------------------------------------------- surface parametrisations
def surface(fn, eps=1e-3):
    """Wrap a 2D->3D surface fn(u, v) into surf(u, v, off) that offsets along the normal.
    Parameter order must be chosen so cross(dP/du, dP/dv) points outward."""
    def s(u, v, off=0.0):
        p = fn(u, v)
        if off == 0.0:
            return p
        n = (fn(u + eps, v) - fn(u - eps, v)).cross(fn(u, v + eps) - fn(u, v - eps))
        if n.length < 1e-12:
            n = Vector((0, -1, 0))
        return p + n.normalized() * off
    return s


def se_front_y(x, z, a, b, c, zc, r, r2=None):
    r2 = r if r2 is None else r2
    q = abs(x / a) ** r + abs((z - zc) / c) ** r
    k = 1.0 - min(q, 1.0) ** (r2 / r)
    return -b * max(k, 1e-9) ** (1.0 / r2)


def se_arc_point(x, phi, a, b, c, zc, r, r2=None):
    """Point on a superellipsoid at lateral x and angle phi in the YZ plane
    (phi = 0 front (-Y), pi/2 top, pi back)."""
    dy, dz = -math.cos(phi), math.sin(phi)
    lo, hi = 0.0, 2.0 * max(b, c)
    for _ in range(40):                      # F grows monotonically with t along the ray
        t = (lo + hi) / 2
        if se_F(x, t * dy, t * dz, a, b, c, r, r2) < 1.0:
            lo = t
        else:
            hi = t
    t = lo
    return Vector((x, t * dy, zc + t * dz))


# ---------------------------------------------------------------- 2D outlines
def se_outline(cx, cz, ax, az, n, count=96):
    pts = []
    for i in range(count):
        t = 2 * math.pi * i / count
        c, s = math.cos(t), math.sin(t)
        pts.append((cx + ax * math.copysign(abs(c) ** (2 / n), c),
                    cz + az * math.copysign(abs(s) ** (2 / n), s)))
    return pts


def circle_outline(cx, cz, r, count=24):
    return [(cx + r * math.cos(2 * math.pi * i / count), cz + r * math.sin(2 * math.pi * i / count))
            for i in range(count)]


def rounded_poly(pts, rad, seg=6):
    """Fillet every corner of a convex polygon (CCW) with radius `rad`."""
    out = []
    n = len(pts)
    for i in range(n):
        P, A, B = Vector(pts[i]), Vector(pts[i - 1]), Vector(pts[(i + 1) % n])
        da, db = (A - P).normalized(), (B - P).normalized()
        th = math.acos(max(-1.0, min(1.0, da.dot(db))))
        d = min(rad / math.tan(th / 2), (A - P).length * 0.49, (B - P).length * 0.49)
        rr = d * math.tan(th / 2)
        T1, T2 = P + da * d, P + db * d
        C = P + (da + db).normalized() * (rr / math.sin(th / 2))
        a1 = math.atan2(T1.y - C.y, T1.x - C.x)
        a2 = math.atan2(T2.y - C.y, T2.x - C.x)
        delta = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for k in range(seg + 1):
            a = a1 + delta * k / seg
            out.append((C.x + rr * math.cos(a), C.y + rr * math.sin(a)))
    return out


def scale_outline(pts, s, center=None):
    if center is None:
        center = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    return [(center[0] + (u - center[0]) * s, center[1] + (v - center[1]) * s) for u, v in pts]


# ---------------------------------------------------------------- surface-conforming solids
def decal_prism(outline, surf, h_top, h_bot, rings=5, center=None, edge_loop=0.96):
    """Closed solid whose top/bottom follow a curved surface. Convex outlines only."""
    n = len(outline)
    if center is None:
        center = (sum(p[0] for p in outline) / n, sum(p[1] for p in outline) / n)
    cu, cv = center
    ts = [1.0, edge_loop] + [edge_loop * (1.0 - (i + 1) / rings) for i in range(rings - 1)]
    bm = bmesh.new()

    def layer(h):
        R = [[bm.verts.new(surf(cu + (u - cu) * t, cv + (v - cv) * t, h)) for (u, v) in outline]
             for t in ts]
        return R, bm.verts.new(surf(cu, cv, h))

    T, tc = layer(h_top)
    B, bc = layer(h_bot)
    for R, c in ((T, tc), (B, bc)):
        for i in range(len(R) - 1):
            for j in range(n):
                j2 = (j + 1) % n
                bm.faces.new((R[i][j], R[i][j2], R[i + 1][j2], R[i + 1][j]))
        for j in range(n):
            bm.faces.new((R[-1][j], R[-1][(j + 1) % n], c))
    for j in range(n):
        j2 = (j + 1) % n
        bm.faces.new((T[0][j], B[0][j], B[0][j2], T[0][j2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def ring_prism(outer, inner, surf, h_top, h_bot):
    """Closed frame between two outlines with equal vertex counts (e.g. a badge border)."""
    n = len(outer)
    assert n == len(inner)
    mid_o = [(o[0] + (i[0] - o[0]) * 0.08, o[1] + (i[1] - o[1]) * 0.08) for o, i in zip(outer, inner)]
    mid_i = [(o[0] + (i[0] - o[0]) * 0.92, o[1] + (i[1] - o[1]) * 0.92) for o, i in zip(outer, inner)]
    bm = bmesh.new()
    loops_top = [[bm.verts.new(surf(u, v, h_top)) for u, v in ol] for ol in (outer, mid_o, mid_i, inner)]
    ob = [bm.verts.new(surf(u, v, h_bot)) for u, v in outer]
    ib = [bm.verts.new(surf(u, v, h_bot)) for u, v in inner]
    seq = [ob] + loops_top + [ib]
    for a, b in zip(seq, seq[1:]):
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((a[j], a[j2], b[j2], b[j]))
    for j in range(n):  # bottom
        j2 = (j + 1) % n
        bm.faces.new((ib[j], ib[j2], ob[j2], ob[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def polyline_outline(pts, width, round_seg=0):
    """Closed outline of a thick polyline; CCW for a left-to-right stroke.
    Inner corners are mitred; outer corners are mitred, or rounded with `round_seg` arc segments."""
    P = [Vector(p) for p in pts]
    hw = width / 2

    def offset(sign):
        out = []
        for i, p in enumerate(P):
            if i == 0 or i == len(P) - 1:
                t = (P[1] - P[0]) if i == 0 else (P[-1] - P[-2])
                t.normalize()
                out.append(p + Vector((-t.y, t.x)) * hw * sign)
                continue
            t1, t2 = (P[i] - P[i - 1]).normalized(), (P[i + 1] - P[i]).normalized()
            n1, n2 = Vector((-t1.y, t1.x)), Vector((-t2.y, t2.x))
            outer = (t1.x * t2.y - t1.y * t2.x) * sign < 0
            if round_seg and outer:
                a1 = math.atan2(n1.y * sign, n1.x * sign)
                d = (math.atan2(n2.y * sign, n2.x * sign) - a1 + math.pi) % (2 * math.pi) - math.pi
                out += [p + Vector((math.cos(a1 + d * k / round_seg), math.sin(a1 + d * k / round_seg))) * hw
                        for k in range(round_seg + 1)]
            else:
                m = (n1 + n2).normalized()
                out.append(p + m * (hw / max(m.dot(n1), 0.2)) * sign)
        return out

    left, right = offset(1.0), offset(-1.0)
    return [tuple(v) for v in right + list(reversed(left))]


def wrapped_prism(outline, surf, h_top, h_bot, cuts=4):
    """Prism of any simple (also concave) outline: built flat as (u, h, v), triangulated,
    subdivided, then every vertex is wrapped onto `surf` at its own height."""
    bm = bmesh.new()
    top = [bm.verts.new((u, h_top, v)) for u, v in outline]
    bot = [bm.verts.new((u, h_bot, v)) for u, v in outline]
    n = len(outline)
    ft = bm.faces.new(top)
    fb = bm.faces.new(list(reversed(bot)))
    for j in range(n):
        j2 = (j + 1) % n
        bm.faces.new((top[j], bot[j], bot[j2], top[j2]))
    bmesh.ops.triangulate(bm, faces=[ft, fb], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        u, h, w = v.co
        v.co = surf(u, w, h)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def densify_closed(pts, step):
    return [tuple(p) for p in densify(list(pts) + [pts[0]], step)[:-1]]


def densify(pts, step):
    out = [Vector(pts[0])]
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        k = max(1, int(math.ceil((b - a).length / step)))
        for i in range(1, k + 1):
            out.append(a + (b - a) * (i / k))
    return out


def strip_prism(pts, width, surf, h_top, h_bot, step=0.02, bm=None):
    """Mitred flat ribbon along a 2D polyline, conforming to `surf`."""
    P = densify(pts, step)
    hw = width / 2
    L, R = [], []
    for i, p in enumerate(P):
        if i == 0 or i == len(P) - 1:
            t = (P[1] - P[0]) if i == 0 else (P[-1] - P[-2])
            t.normalize()
            nrm, m = Vector((-t.y, t.x)), 1.0
        else:
            t1, t2 = (P[i] - P[i - 1]).normalized(), (P[i + 1] - P[i]).normalized()
            n1, n2 = Vector((-t1.y, t1.x)), Vector((-t2.y, t2.x))
            nrm = n1 + n2
            nrm = n1 if nrm.length < 1e-6 else nrm.normalized()
            m = 1.0 / max(0.35, nrm.dot(n1))
        L.append(p + nrm * hw * m)
        R.append(p - nrm * hw * m)
    own = bm is None
    bm = bm or bmesh.new()
    lt = [bm.verts.new(surf(q.x, q.y, h_top)) for q in L]
    rt = [bm.verts.new(surf(q.x, q.y, h_top)) for q in R]
    lb = [bm.verts.new(surf(q.x, q.y, h_bot)) for q in L]
    rb = [bm.verts.new(surf(q.x, q.y, h_bot)) for q in R]
    new_faces = []
    for i in range(len(P) - 1):
        new_faces += [bm.faces.new((lt[i], rt[i], rt[i + 1], lt[i + 1])),
                      bm.faces.new((lb[i + 1], rb[i + 1], rb[i], lb[i])),
                      bm.faces.new((lt[i + 1], lb[i + 1], lb[i], lt[i])),
                      bm.faces.new((rt[i], rb[i], rb[i + 1], rt[i + 1]))]
    new_faces += [bm.faces.new((lt[0], lb[0], rb[0], rt[0])),
                  bm.faces.new((lt[-1], rt[-1], rb[-1], lb[-1]))]
    bmesh.ops.recalc_face_normals(bm, faces=new_faces)
    return bm


def merge_bm(dst, src):
    """Append src bmesh geometry into dst (src is freed)."""
    me = bpy.data.meshes.new("_tmp_merge")
    src.to_mesh(me)
    src.free()
    dst.from_mesh(me)
    bpy.data.meshes.remove(me)
    return dst


# ---------------------------------------------------------------- mechanical primitives
def add_cyl(bm, p0, p1, r0, r1=None, seg=20, caps=True):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    M = Matrix.Translation((p0 + p1) / 2) @ rot
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg,
                          radius1=r0, radius2=r0 if r1 is None else r1, depth=d.length, matrix=M)


def add_sphere(bm, p, r, seg=20, rings=12, scale=(1, 1, 1)):
    M = Matrix.Translation(Vector(p)) @ Matrix.Diagonal((*scale, 1.0))
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r, matrix=M)


def add_capsule(bm, p0, p1, r, seg=24, rings=12):
    """Capsule (cylinder with hemispherical ends) from p0 to p1, all quads except the pole fans."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    tmp = bmesh.new()
    bmesh.ops.create_uvsphere(tmp, u_segments=seg, v_segments=rings, radius=r)
    for v in tmp.verts:
        v.co.z += L / 2 if v.co.z > 1e-6 else (-L / 2 if v.co.z < -1e-6 else 0.0)
    M = Matrix.Translation((p0 + p1) / 2) @ Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(tmp, matrix=M, verts=tmp.verts[:])
    merge_bm(bm, tmp)


def capsule_finger_bm(base, direction, curl_axis, lengths, radii, curls, gap=0.006, bm=None):
    """Finger made of separate capsule phalanges with thin seams between them (reference style)."""
    bm = bm or bmesh.new()
    pos, d = Vector(base), Vector(direction).normalized()
    ax = Vector(curl_axis).normalized()
    for L, r, ang in zip(lengths, radii, curls):
        d = (Matrix.Rotation(ang, 3, ax) @ d).normalized()
        end = pos + d * L
        a, b = pos + d * (r * 0.15 + gap), end - d * (r * 0.15)
        add_capsule(bm, a, b, r)
        pos = end
    return bm


def finger_bm(base, direction, curl_axis, lengths, radii, curls, joint_scale=1.2, bm=None):
    """Segmented robotic finger: joint ball + tapered link per phalanx, rounded tip."""
    bm = bm or bmesh.new()
    pos, d = Vector(base), Vector(direction).normalized()
    ax = Vector(curl_axis).normalized()
    for L, r, ang in zip(lengths, radii, curls):
        add_sphere(bm, pos, r * joint_scale, seg=16, rings=10)
        d = (Matrix.Rotation(ang, 3, ax) @ d).normalized()
        end = pos + d * L
        add_cyl(bm, pos, end, r, r * 0.92, seg=16)
        pos = end
    add_sphere(bm, pos, radii[-1] * 0.98, seg=16, rings=10)
    return bm
