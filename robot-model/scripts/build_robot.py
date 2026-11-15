"""Component builders for the robot master model. Each build_* function is idempotent:
it replaces its own objects by name, so any part can be rebuilt after a parameter change.

Usage inside Blender:
    import sys; sys.path.insert(0, r"<this folder>")
    import build_robot as B; B.reload(); B.build_all()
"""
import importlib
import math
import bpy
import bmesh
from mathutils import Vector, Matrix

import robot_lib as L

# ------------------------------------------------------------------ proportions (from reference)
HEAD = dict(a=1.04, b=0.92, c=0.80, zc=2.56, r=2.8, r2=2.25)           # superellipsoid head shell
TORSO = dict(zm=1.25, w=0.86, h_up=0.52, n_up=3.5, h_dn=1.25, n_dn=2.2)
TORSO_KY = 0.86                                               # depth / width of torso section
ARM = dict(zm=1.10, w=0.265, h_up=0.64, n_up=2.1, h_dn=0.75, n_dn=1.85)
ARM_KY, ARM_Y = 0.80, 0.02
FACE = dict(cz=2.48, ax=0.83, az=0.42, az_bot=0.47, n=2.6)    # display opening (ref: top px 518, bottom px 878)
FACE_INSET = 0.07                                             # glass recess depth
GLASS_SCALE = 0.99                                            # glass outline vs opening (thin side rim)
GLASS_TOP_BAND = 0.08                                         # wider charcoal wall above the glass (ref: ~32 px)
MODULE = dict(apothem=0.40, y=0.10, z=2.505, x_in=0.80, x_out=1.19, chamfer=(0.07, 0.78), round=0.075)
PANEL_RS = 0.86                                               # arc-length factor for head panel
SEAM_GAP = 0.006


def reload():
    importlib.reload(L)


def colls():
    m = L.get_coll("Robot_Master")
    names = ["Head", "Eyes", "Torso", "Chest_Emblem", "Left_Arm", "Right_Arm"]
    C = {n: L.get_coll(n, m) for n in names}
    for n in ("Reference", "Cameras", "Lighting", "Helpers"):
        C[n] = L.get_coll(n)
    C["Master"] = m
    return C


# ------------------------------------------------------------------ surfaces
def _h(inset=0.0):
    return (HEAD['a'] - inset, HEAD['b'] - inset, HEAD['c'] - inset, HEAD['zc'], HEAD['r'])


def head_front_surf(inset=0.0):
    a, b, c, zc, r = _h(inset)
    return L.surface(lambda x, z: Vector((x, L.se_front_y(x, z, a, b, c, zc, r, HEAD['r2']), z)))


def head_arc_surf(inset=0.0):
    a, b, c, zc, r = _h(inset)
    return L.surface(lambda x, s: L.se_arc_point(x, s / PANEL_RS, a, b, c, zc, r, HEAD['r2']))


def torso_r(z):
    return L.se_profile_r(z, TORSO)


def torso_front_surf():
    def fn(x, z):
        r = torso_r(z)
        return Vector((x, -TORSO_KY * math.sqrt(max(r * r - x * x, 1e-8)), z))
    return L.surface(fn)


def face_outline(scale=1.0, count=128):
    cz, k = FACE['cz'], FACE['az_bot'] / FACE['az']
    return [(u, v if v >= cz else cz + (v - cz) * k)             # lower half is taller than the upper
            for u, v in L.se_outline(0.0, cz, FACE['ax'] * scale, FACE['az'] * scale, FACE['n'], count)]


# ------------------------------------------------------------------ HEAD
def build_face_cutter(C):
    flat = lambda u, v, off=0.0: Vector((u, off, v))
    bm = L.decal_prism(face_outline(1.0), flat, -1.7, -0.25, rings=2)
    o = L.bm_to_obj("Face_Cutter", bm, C["Helpers"], smooth=False)
    o.display_type = 'WIRE'
    o.hide_render = True
    o.hide_set(True)
    return o


def build_head_shell(C):
    a, b, c, zc, r = _h()
    bm = L.superellipsoid_bm(a, b, c, r, res=24, center=(0, 0, zc), r2=HEAD['r2'])
    o = L.bm_to_obj("Head_OuterShell", bm, C["Head"])
    L.add_subsurf(o, 2, 2)
    cut = build_face_cutter(C)
    bo = o.modifiers.new("FaceRecess", 'BOOLEAN')
    bo.object, bo.operation = cut, 'DIFFERENCE'
    try:
        bo.solver = 'EXACT'
    except TypeError:
        pass
    L.add_bevel(o, 0.010, 3, 40)
    return o


def glass_outline():
    """Opening outline shrunk by GLASS_SCALE, with its upper part pulled down by up to GLASS_TOP_BAND."""
    out = []
    for u, v in L.scale_outline(face_outline(1.0), GLASS_SCALE, (0.0, FACE['cz'])):
        t = min(max((v - FACE['cz']) / (0.9 * FACE['az']), 0.0), 1.0)
        out.append((u, v - GLASS_TOP_BAND * t * t * (3 - 2 * t)))
    return out


def build_face_display(C):
    inner = head_front_surf(FACE_INSET)
    bm = L.decal_prism(glass_outline(), inner, 0.0, -0.03, rings=10, edge_loop=0.985)
    return L.bm_to_obj("Face_Display", bm, C["Head"])


def build_face_bezel(C):
    """Recessed charcoal wall from the shell opening down to the glass."""
    outer, inner = head_front_surf(0.0), head_front_surf(FACE_INSET)
    base, glass = face_outline(1.0), glass_outline()
    n, K = len(base), 6
    bm = bmesh.new()
    front = []
    for k in range(K + 1):
        t = k / K
        e = 1 - (1 - t) ** 2                                     # wall curves into the glass
        pts = [(b[0] + (g[0] - b[0]) * e, b[1] + (g[1] - b[1]) * e) for b, g in zip(base, glass)]
        front.append([bm.verts.new(outer(u, v).lerp(inner(u, v), t ** 0.8) + Vector((0, -0.002, 0)))
                      for u, v in pts])
    back = [[bm.verts.new(v.co + Vector((0, 0.03, 0))) for v in loop] for loop in (front[0], front[-1])]
    seq = [back[0]] + front + [back[1]]
    for A, B in zip(seq, seq[1:]):
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((A[j], A[j2], B[j2], B[j]))
    for j in range(n):
        j2 = (j + 1) % n
        bm.faces.new((back[1][j], back[1][j2], back[0][j2], back[0][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return L.bm_to_obj("Face_Bezel", bm, C["Head"])


def build_side_modules(C):
    out = []
    R = MODULE['apothem'] / math.cos(math.pi / 8)
    for side, name in ((1, "Left_SideModule"), (-1, "Right_SideModule")):
        bm = bmesh.new()
        loops = []
        # inner end, start of chamfer, chamfered outer face (front view reads as a trapezoid)
        ch = MODULE['chamfer']
        for x, sc in ((MODULE['x_in'], 1.0), (MODULE['x_out'] - ch[0], 1.0), (MODULE['x_out'], ch[1])):
            loops.append([bm.verts.new((side * x, MODULE['y'] + sc * R * math.cos(math.pi / 8 + k * math.pi / 4),
                                        MODULE['z'] + sc * R * math.sin(math.pi / 8 + k * math.pi / 4)))
                          for k in range(8)])
        for A, Bl in zip(loops, loops[1:]):
            for k in range(8):
                k2 = (k + 1) % 8
                bm.faces.new((A[k], A[k2], Bl[k2], Bl[k]))
        bm.faces.new(loops[0])
        bm.faces.new(list(reversed(loops[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        o = L.bm_to_obj(name, bm, C["Head"], smooth=True)
        bv = L.add_bevel(o, MODULE['round'], 6, 20)
        bv.profile = 0.55
        L.add_wnormal(o)
        out.append(o)
    return out


def _panel_front_s():
    a, b, c, zc, r = _h()
    lo, hi = 0.0, math.pi / 2                     # bisection: phi where z = 3.04 at x = 0
    for _ in range(50):
        mid = (lo + hi) / 2
        if L.se_arc_point(0.0, mid, a, b, c, zc, r, HEAD['r2']).z < 3.04:
            lo = mid
        else:
            hi = mid
    return lo * PANEL_RS


PANEL = dict(hw_front=0.375, hw_top=0.46, hw_back=0.46, flare=1.25, back_phi=2.35, corner=0.075,
             thick_top=0.012, thick_bot=-0.06, front_lift=0.032)


def panel_hw(s, s0, s_top, s1):
    """Half-width along the panel: concave flare from the front edge to the crown, then near-constant."""
    if s <= s_top:
        t = max(0.0, (s - s0) / (s_top - s0))
        return PANEL['hw_front'] + (PANEL['hw_top'] - PANEL['hw_front']) * t ** PANEL['flare']
    return PANEL['hw_top'] + (PANEL['hw_back'] - PANEL['hw_top']) * (s - s_top) / (s1 - s_top)


def panel_outline():
    s0 = _panel_front_s()
    s_top, s1 = (math.pi / 2) * PANEL_RS, PANEL['back_phi'] * PANEL_RS
    rc = PANEL['corner']
    hw = lambda s: panel_hw(s, s0, s_top, s1)
    right = [(hw(s0 + rc + (s1 - s0 - 2 * rc) * i / 40), s0 + rc + (s1 - s0 - 2 * rc) * i / 40) for i in range(41)]
    pts = []
    h0, h1 = hw(s0 + rc), hw(s1 - rc)
    for i in range(7):                                    # front-right corner
        a = -math.pi / 2 + (math.pi / 2) * i / 6
        pts.append((h0 - rc + rc * math.cos(a), s0 + rc + rc * math.sin(a)))
    pts += right[1:-1]
    for i in range(7):                                    # back-right corner
        a = (math.pi / 2) * i / 6
        pts.append((h1 - rc + rc * math.cos(a), s1 - rc + rc * math.sin(a)))
    for i in range(7):                                    # back-left corner
        a = math.pi / 2 + (math.pi / 2) * i / 6
        pts.append((-h1 + rc + rc * math.cos(a), s1 - rc + rc * math.sin(a)))
    pts += [(-x, s) for x, s in reversed(right[1:-1])]
    for i in range(7):                                    # front-left corner
        a = math.pi + (math.pi / 2) * i / 6
        pts.append((-h0 + rc + rc * math.cos(a), s0 + rc + rc * math.sin(a)))
    return L.densify_closed(pts, 0.03), s0


def panel_surf():
    """Head surface under the panel, lifted at the front edge (thick visible lip) and easing to flush at the crown."""
    base, s0, s_top = head_arc_surf(), _panel_front_s(), (math.pi / 2) * PANEL_RS
    def surf(u, s, off=0.0):
        t = min(max((s - s0) / (s_top - s0), 0.0), 1.0)
        return base(u, s, off + PANEL['front_lift'] * (1.0 - t) ** 1.5)
    return surf


def build_top_panel(C):
    surf = panel_surf()
    outline, _ = panel_outline()
    bm = L.decal_prism(outline, surf, PANEL['thick_top'], PANEL['thick_bot'], rings=10)
    o = L.bm_to_obj("Top_CircuitPanel", bm, C["Head"])
    L.add_bevel(o, 0.02, 5, 35)
    L.add_wnormal(o)
    return o


# Traces traced from a 2x crop of ref_front.webp (crop origin px 700,320); cy <= 50 means
# "starts at the crown" and the trace is continued back over the head by the given length.
PANEL_TRACES_CROP = [
    ([(205, 40), (205, 118), (238, 148), (238, 248)], 0.55),
    ([(222, 40), (222, 110), (262, 140), (262, 248)], 0.35),
    ([(283, 40), (283, 170), (300, 188), (300, 248)], 0.60),
    ([(302, 40), (302, 160), (322, 178), (322, 248)], 0.30),
    ([(360, 40), (360, 93)], 0.50),
    ([(362, 122), (362, 134), (342, 154), (342, 248)], None),
    ([(397, 68), (397, 130), (380, 148), (380, 248)], None),
    ([(437, 40), (437, 165), (505, 205), (505, 248)], 0.62),
    ([(437, 165), (437, 205)], None),
    ([(458, 215), (470, 230), (470, 248)], None),
    ([(492, 240), (512, 224), (512, 206)], None),
    ([(470, 52), (470, 150), (560, 210), (600, 245)], None),
    ([(505, 40), (505, 155)], 0.42),
    ([(550, 40), (550, 108)], 0.58),
    ([(600, 40), (600, 68), (580, 95), (580, 195)], 0.33),
    ([(628, 40), (625, 108)], 0.48),
    ([(500, 185), (520, 205), (538, 215)], None),
    ([(395, 182), (395, 248)], None),
]
PANEL_NODES_CROP = [(362, 93), (362, 122), (397, 68), (437, 205), (458, 215), (492, 240), (470, 52),
                    (505, 155), (550, 108), (580, 195), (625, 108), (538, 215), (395, 182)]
PANEL_BACK_NODES = (0, 2, 4, 7, 12, 14)        # traces that end in a terminal over the crown


def crop_to_xz(cx, cy):
    return L.ref(700 + cx / 2.0, 320 + cy / 2.0)


def xz_to_s(x, z):
    a, b, c, zc, r = _h()
    lo, hi = 0.0, math.pi / 2
    if z >= L.se_arc_point(x, hi, a, b, c, zc, r, HEAD['r2']).z:
        return hi * PANEL_RS
    for _ in range(50):
        mid = (lo + hi) / 2
        if L.se_arc_point(x, mid, a, b, c, zc, r, HEAD['r2']).z < z:
            lo = mid
        else:
            hi = mid
    return lo * PANEL_RS


def panel_traces():
    """Returns ([(x, s) polylines], [(x, s) terminal centres])."""
    s_top = (math.pi / 2) * PANEL_RS
    traces, nodes = [], []
    for i, (crop_pts, ext) in enumerate(PANEL_TRACES_CROP):
        pts = []
        for cx, cy in crop_pts:
            x, z = crop_to_xz(cx, cy)
            pts.append((x, s_top if cy <= 50 else xz_to_s(x, z)))
        if ext:
            pts.insert(0, (pts[0][0], s_top + ext))
            if i in PANEL_BACK_NODES:
                nodes.append(pts[0])
        traces.append(pts)
    for cx, cy in PANEL_NODES_CROP:
        x, z = crop_to_xz(cx, cy)
        nodes.append((x, s_top if cy <= 50 else xz_to_s(x, z)))
    return traces, nodes


def build_panel_circuits(C):
    surf = panel_surf()
    top = PANEL['thick_top']
    traces, nodes = panel_traces()
    bm = bmesh.new()
    for tr in traces:
        L.strip_prism(tr, 0.0033, surf, top + 0.004, top - 0.004, step=0.025, bm=bm)
    for (x, s) in nodes:
        L.merge_bm(bm, L.ring_prism(L.circle_outline(x, s, 0.0115, 20), L.circle_outline(x, s, 0.0058, 20),
                                    surf, top + 0.005, top - 0.004))
    return L.bm_to_obj("Top_CircuitTraces", bm, C["Head"], smooth=False)

def build_neck(C):
    bm = bmesh.new()
    L.add_cyl(bm, (0, 0, 1.60), (0, 0, 1.86), 0.24, 0.26, seg=48)
    return L.bm_to_obj("Neck_Joint", bm, C["Torso"], sharp_deg=40)


# ------------------------------------------------------------------ EYES
# Crescent eyes measured from ref_front (both eyes: 131 px wide, top px 663, tips px 725, bottom 730 mid / 737 ends)
EYE = dict(x=0.3706, dx=0.0044, zm=2.3875,   # ref centres: px 771 / 1067 (both a little right of the axis)
 w=0.164, top=0.155, n_top=1.75, sag=(0.0125, 0.02), n_bot=6.0)
# traces in local (u = x / half-width, v = (z - zm) / top), traced from a 4x crop of the reference
EYE_TRACES = {
    -1: [[(-0.50, 0.77), (0.34, 0.85)],
         [(-0.56, 0.64), (0.34, 0.73), (0.60, 0.40), (0.77, 0.42)],
         [(-0.16, 0.52), (0.30, 0.55), (0.56, 0.16), (0.94, 0.11)],
         [(-0.91, 0.23), (-0.27, 0.27)],
         [(-0.66, 0.04), (-0.30, 0.04)],
         [(-0.10, 0.07), (0.33, 0.10)]],
    1: [[(-0.56, 0.28), (-0.17, 0.28), (-0.17, 0.69), (0.58, 0.74)],
        [(-0.73, 0.04), (-0.11, 0.07), (0.18, 0.50), (0.76, 0.55)],
        [(-0.02, -0.03), (0.16, 0.20), (0.93, 0.23)],
        [(0.24, -0.02), (0.35, 0.08), (0.95, 0.10)]],
}
EYE_NODES = {-1: [((0.77, 0.42), 0.0095), ((-0.27, 0.27), 0.0095), ((-0.30, 0.04), 0.009), ((0.33, 0.10), 0.0095)],
             1: [((-0.56, 0.28), 0.013), ((-0.73, 0.04), 0.013)]}


def eye_outline(side, count=48):
    """Dome top (superellipse) over a shallow concave bottom; rounded tips."""
    cx, w, zm = side * EYE['x'] + EYE['dx'], EYE['w'], EYE['zm']
    nt, nb, (s0, s1) = EYE['n_top'], EYE['n_bot'], EYE['sag']
    pts = []
    for i in range(count + 1):                       # top: right tip -> left tip
        u = math.cos(math.pi * i / count)
        pts.append((cx + w * u, zm + EYE['top'] * (1 - abs(u) ** nt) ** (1 / nt)))
    for i in range(1, count):                        # bottom: left tip -> right tip
        u = -math.cos(math.pi * i / count)
        pts.append((cx + w * u, zm - (s0 + s1 * u * u) * (1 - abs(u) ** nb) ** (1 / nb)))
    return pts


def build_eyes(C):
    surf = head_front_surf(FACE_INSET)
    out = []
    tb = bmesh.new()
    for side, name in ((1, "Eye_Left"), (-1, "Eye_Right")):
        bm = L.decal_prism(eye_outline(side), surf, 0.010, -0.006, rings=5)
        o = L.bm_to_obj(name, bm, C["Eyes"])
        L.add_bevel(o, 0.004, 2, 35)
        out.append(o)
        cx, w, h, zm = side * EYE['x'] + EYE['dx'], EYE['w'], EYE['top'], EYE['zm']
        to_xz = lambda p: (cx + p[0] * w, zm + p[1] * h)
        for tr in EYE_TRACES[side]:
            L.strip_prism([to_xz(p) for p in tr], 0.0058, surf, 0.0135, 0.007, step=0.02, bm=tb)
        for p, r in EYE_NODES[side]:
            x, z = to_xz(p)
            L.merge_bm(tb, L.ring_prism(L.circle_outline(x, z, r, 20), L.circle_outline(x, z, r * 0.45, 20),
                                        surf, 0.0145, 0.007))
    out.append(L.bm_to_obj("Eye_CircuitDetails", tb, C["Eyes"], smooth=False))
    return out


# ------------------------------------------------------------------ TORSO
def chest_seam(th):
    """Seam between upper chest armour and lower shell: high notch above the badge, low at the sides."""
    u, fr = abs(math.cos(th)), max(0.0, -math.sin(th))
    t = min(max((u - 0.24) / (0.74 - 0.24), 0.0), 1.0)   # notch flanks measured on ref (px 1310 at x=720)
    bump = 0.38 * (1 - t * t * (3 - 2 * t))
    return 0.83 + bump * fr ** 1.5


def build_torso(C):
    rows, zt, zb = L.se_profile_rows(TORSO, 18, 30)
    core = L.lathe_bm([(z, r * 0.975) for z, r in rows], zt - 0.01, zb + 0.01, seg=64, ky=TORSO_KY)
    o_core = L.bm_to_obj("Body_MainShell", core, C["Torso"])
    L.add_subsurf(o_core, 1, 2)
    prof = L.Profile(TORSO)
    up = L.revolve_panel_bm(prof, lambda th: chest_seam(th) + SEAM_GAP, lambda th: 9.0, TORSO_KY, seg=96, rows=30)
    o_up = L.bm_to_obj("Chest_UpperArmor", up, C["Torso"])
    L.add_solidify(o_up, 0.03, -1.0)
    L.add_subsurf(o_up, 1, 2)
    lo = L.revolve_panel_bm(prof, lambda th: -9.0, lambda th: chest_seam(th) - SEAM_GAP, TORSO_KY, seg=96, rows=34)
    o_lo = L.bm_to_obj("Body_LowerShell", lo, C["Torso"])
    L.add_solidify(o_lo, 0.03, -1.0)
    L.add_subsurf(o_lo, 1, 2)
    return o_core, o_up, o_lo


# ------------------------------------------------------------------ CHEST EMBLEM
BADGE_C = L.ref(917, 1362)
BADGE_HEX = [(0.37, 0.0), (0.206, 0.3375), (-0.206, 0.3375), (-0.37, 0.0), (-0.206, -0.3375), (0.206, -0.3375)]
BADGE_INSERT = 0.895          # green insert vs housing outline (ref insert: px 782..1050 x 1241..1481)
# stroke centreline measured from the reference; both ends run into the white border
SYMBOL = [L.ref(819, 1440), L.ref(902, 1297), L.ref(935, 1419), L.ref(1016, 1280)]
SYMBOL_W = 0.052


def badge_outline(scale=1.0):
    cx, cz = BADGE_C
    hexa = [(cx + x * scale, cz + z * scale) for x, z in BADGE_HEX]
    return L.densify_closed(L.rounded_poly(hexa, 0.05 * scale, 6), 0.02)


def build_emblem(C):
    surf = torso_front_surf()
    outer = badge_outline(1.0)
    inner = L.scale_outline(outer, BADGE_INSERT - 0.005, BADGE_C)
    o1 = L.bm_to_obj("Emblem_OuterHousing", L.ring_prism(outer, inner, surf, 0.036, -0.03), C["Chest_Emblem"])
    L.add_bevel(o1, 0.007, 3, 35)
    L.add_wnormal(o1)
    o2 = L.bm_to_obj("Emblem_GreenInsert", L.decal_prism(L.scale_outline(outer, BADGE_INSERT, BADGE_C), surf,
                                                       0.024, -0.02, rings=6), C["Chest_Emblem"])
    L.add_bevel(o2, 0.004, 2, 35)
    sym = L.wrapped_prism(L.polyline_outline(SYMBOL, SYMBOL_W, round_seg=6), surf, 0.036, 0.010, cuts=3)
    o3 = L.bm_to_obj("Emblem_WhiteSymbol", sym, C["Chest_Emblem"])
    L.add_bevel(o3, 0.006, 3, 35)
    L.add_wnormal(o3)
    return o1, o2, o3


# ------------------------------------------------------------------ ARMS & HANDS
def arm_xc(side):
    return lambda z: side * (1.0 + 0.04 * (1.74 - z) / 1.365)


def build_arm(C, side):
    tag, coll = ("L", C["Left_Arm"]) if side > 0 else ("R", C["Right_Arm"])
    rows, zt, zb = L.se_profile_rows(ARM, 12, 28)
    p_out, p_in = Vector((side * 1.18, 0, 1.275)), Vector((side * 0.83, 0, 1.04))
    d = (p_in - p_out).normalized()
    n = Vector((d.z, 0, -d.x))
    if n.z < 0:
        n = -n
    mid = (p_out + p_in) / 2
    parts = []
    for name, keep_upper in ((f"Arm_{tag}_Shoulder", True), (f"Arm_{tag}_Upper", False)):
        bm = L.lathe_bm(rows, zt, zb, seg=40, ky=ARM_KY, xc_fn=arm_xc(side), y0=ARM_Y)
        co = mid + n * (SEAM_GAP if keep_upper else -SEAM_GAP)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                               plane_co=co, plane_no=n, clear_inner=keep_upper, clear_outer=not keep_upper)
        edges = [e for e in bm.edges if e.is_boundary]
        cap = bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]
        for _ in range(2):
            cap = bmesh.ops.inset_region(bm, faces=cap, thickness=0.03, depth=0.0)["faces"]
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        o = L.bm_to_obj(name, bm, coll)
        L.add_subsurf(o, 1, 2)
        parts.append(o)
    return parts


HAND = dict(x=1.14, block=(0.078, 0.10, 0.075), block_z=0.36, finger_r=(0.043, 0.041, 0.039),
            finger_len=(0.12, 0.09, 0.064), curl=(0.15, 0.85, 1.0), spread=(-0.072, -0.024, 0.024, 0.072),
            vary_len=(0.94, 1.04, 1.0, 0.9), vary_curl=(1.08, 0.97, 0.88, 0.8), yaw=22.0)


def build_hand(C, side):
    """Reference hand: wrist connector, a large rounded wrist block, four chunky fingers of three
    capsule phalanges (row front-to-back, curling toward the body) and an inner thumb."""
    s = side
    tag, coll = ("L", C["Left_Arm"]) if side > 0 else ("R", C["Right_Arm"])
    x0, y0, bz = s * HAND['x'], ARM_Y, HAND['block_z']
    bx, by, bzh = HAND['block']
    bm = bmesh.new()
    L.add_cyl(bm, (s * 1.06, y0, 0.50), (s * 1.08, y0, bz + bzh * 0.6), 0.075, seg=32)
    L.bm_to_obj(f"Arm_{tag}_Wrist", bm, coll, sharp_deg=40)
    # palm + fingers turn about the wrist axis so the finger row fans toward the front (as seen in the reference)
    yaw = lambda b: bmesh.ops.rotate(b, verts=b.verts[:], cent=(x0, y0, 0),
                                     matrix=Matrix.Rotation(math.radians(s * HAND['yaw']), 3, 'Z'))
    pb = L.superellipsoid_bm(bx, by, bzh, 3.0, res=8, center=(x0, y0, bz))
    yaw(pb)
    o = L.bm_to_obj(f"Hand_{tag}_Palm", pb, coll)
    L.add_subsurf(o, 1, 2)
    ax = Vector((0, 1, 0))
    for i, dy in enumerate(HAND['spread']):
        fb = L.capsule_finger_bm((x0 + s * 0.005, y0 + dy, bz - bzh * 0.75), (-s * 0.10, dy * 0.2, -1.0), ax,
                                 tuple(l * HAND['vary_len'][i] for l in HAND['finger_len']), HAND['finger_r'],
                                 tuple(s * c * HAND['vary_curl'][i] for c in HAND['curl']))
        yaw(fb)
        L.bm_to_obj(f"Hand_{tag}_Finger_{i + 1}", fb, coll, sharp_deg=60)
    tb = L.capsule_finger_bm((x0 - s * 0.10, y0 - 0.04, bz + 0.11), (-s * 0.5, -0.2, -0.85), ax,
                             (0.075, 0.06), (0.044, 0.042), (0.0, s * 0.15))
    L.bm_to_obj(f"Hand_{tag}_Thumb", tb, coll, sharp_deg=60)

# ------------------------------------------------------------------ hierarchy
def parent_all(C):
    root = bpy.data.objects.get("Robot_ROOT")
    if root is None:
        root = bpy.data.objects.new("Robot_ROOT", None)
        root.empty_display_type = 'PLAIN_AXES'
        root.empty_display_size = 0.6
        C["Master"].objects.link(root)
    for key in ("Head", "Eyes", "Torso", "Chest_Emblem", "Left_Arm", "Right_Arm", "Helpers"):
        for o in C[key].objects:
            if o.parent is None and o is not root:
                o.parent = root
    return root


def build_primary():
    C = colls()
    build_head_shell(C)
    build_face_display(C)
    build_torso(C)
    for s in (1, -1):
        build_arm(C, s)
    parent_all(C)


def build_secondary():
    C = colls()
    build_face_bezel(C)
    build_side_modules(C)
    build_top_panel(C)
    build_emblem(C)
    build_neck(C)
    for s in (1, -1):
        build_hand(C, s)
    parent_all(C)


def build_details():
    C = colls()
    build_panel_circuits(C)
    build_eyes(C)
    parent_all(C)


def build_all():
    build_primary()
    build_secondary()
    build_details()
