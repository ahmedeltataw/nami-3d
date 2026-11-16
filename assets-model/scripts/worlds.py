"""Build worlds.blend: six project mini worlds for the S05 portals (card M2-07b).
Exports export/world_<slug>.glb each and export/worlds.manifest.json.

Each world: WorldRoot at the island top centre (z = 0), front faces -Y (glTF +Z), about 4 units across.
ScreenPlane_1..3 are flat UV 0-1 faces for project screenshots. CamStart / CamEnd are camera anchors
(looking down their local -Z, like a three.js camera) for a gentle move; both look at LOOK_AT.
"""
import importlib
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

# run with exec(src, {"__file__": path}) so the helpers resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

importlib.reload(common)
import props  # noqa: E402

importlib.reload(props)
from common import EXPORT_DIR, ROOT_DIR, b2g, make_material, new_scene, write_json  # noqa: E402
from props import Asset, materials  # noqa: E402

ISLAND_R = 2.0
SCREEN_W, SCREEN_H = 0.9, 0.5625      # 16:10
LOOK_AT = Vector((0, 0, 0.9))
CAM_START = Vector((-1.6, -5.4, 2.1))
CAM_END = Vector((1.0, -4.4, 1.6))

scene = new_scene()
base_mats = materials()
base_mats["island"] = make_material("Island_Top", (0.86, 0.87, 0.88), roughness=0.6)
base_mats["rock"] = make_material("Island_Under", (0.2, 0.21, 0.23), roughness=0.7)
base_mats["wood"] = make_material("Wood", (0.55, 0.37, 0.24), roughness=0.7)
base_mats["dark"] = make_material("Deep_Black", (0.05, 0.05, 0.055), roughness=0.5)


def T(x, y, z=0.0):
    return Matrix.Translation((x, y, z))


def Rz(d):
    return Matrix.Rotation(math.radians(d), 4, "Z")


def Rx(d):
    return Matrix.Rotation(math.radians(d), 4, "X")


def Ry(d):
    return Matrix.Rotation(math.radians(d), 4, "Y")


def look_rot(pos, target):
    return (target - pos).to_track_quat("-Z", "Y").to_matrix().to_4x4()


def star_outline(r_out, r_in, n=5):
    pts = []
    for k in range(2 * n):
        a = math.radians(90 + 180 * k / n)
        r = r_out if k % 2 == 0 else r_in
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def new_world(slug, title, accent_name, accent_rgb):
    mats = dict(base_mats)
    mats["accent"] = make_material(f"Accent_{accent_name}", accent_rgb, roughness=0.35, emission_srgb=accent_rgb,
                                   emission_strength=0.3)
    A = Asset(scene, f"World_{slug}", "WorldRoot", mats, prefix=f"{slug}|")
    A.slug, A.title, A.accent = slug, title, "#%02X%02X%02X" % tuple(round(c * 255) for c in accent_rgb)
    A.file = f"world_{slug}.glb"

    def island(b):
        b.cyl((0, 0, -0.15), ISLAND_R, 0.3, "island", 64)
        b.ring((0, 0, -0.025), ISLAND_R - 0.01, ISLAND_R + 0.04, 0.06, "green", 64)  # top 5 mm proud
        b.cyl((0, 0, -0.6), ISLAND_R - 0.05, 0.6, "rock", 64)
        b.cyl((0, 0, -1.1), 1.2, 0.4, "rock", 32, r2=ISLAND_R - 0.05)
    A.node("Island", None, (0, 0, 0), island, role="island")

    for i, (x, y, yaw) in enumerate(((-1.2, 0.95, 20), (0.0, 1.3, 0), (1.2, 0.95, -20)), 1):
        M = T(x, y) @ Rz(yaw)
        zc = 1.5  # screens sit above the props so nothing hides them

        def frame(b, M=M):
            b.box((0, 0.03, zc / 2), (0.05, 0.05, zc), "grey", M=M)
            b.panel((0, 0.03, zc), SCREEN_W + 0.06, SCREEN_H + 0.06, 0.03, 0.03, "charcoal", M)
            b.cyl((0, 0.03, 0.015), 0.16, 0.03, "charcoal", 24, M=M)
        A.node(f"ScreenFrame_{i}", None, (x, y, 0), frame, role="screen_frame")
        A.node(f"ScreenPlane_{i}", None, tuple(M @ Vector((0, 0.03 - 0.019, zc))),
               lambda b, M=M: b.screen((0, 0.03 - 0.019, zc), SCREEN_W, SCREEN_H, 0.02, M),
               role="screen_plane", two_sided=True,
               extra={"uv": "0-1, u = right, v = up", "size": [SCREEN_W, SCREEN_H], "aspect": "16:10"})

    A.empty("CamStart", A.root, tuple(CAM_START), size=0.3, role="camera_start", display="CONE",
            rot=look_rot(CAM_START, LOOK_AT))
    A.empty("CamEnd", A.root, tuple(CAM_END), size=0.3, role="camera_end", display="CONE",
            rot=look_rot(CAM_END, LOOK_AT))
    return A


worlds = []


def wheel_y(b, x, y, z, r=0.1, w=0.05, M=Matrix.Identity(4)):
    b.cyl((x, y, z), r, w, "charcoal", 16, axis="Y", M=M)
    b.cyl((x, y, z), r * 0.45, w + 0.01, "grey", 12, axis="Y", M=M)


# ============================================================ 1 Rif Al-Jouf (olive farm marketplace)
A = new_world("rif-aljouf", "Rif Al-Jouf", "Olive", (0.42, 0.56, 0.14))


def olive_tree(b, x, y, s):
    M = T(x, y) @ Matrix.Scale(s, 4)
    b.cyl((0, 0, 0.35), 0.09, 0.7, "wood", 10, r2=0.05, M=M @ Ry(4))
    for (dx, dy, dz, r) in ((0, 0, 0.88, 0.36), (0.26, 0.05, 0.78, 0.27), (-0.24, -0.04, 0.8, 0.27),
                            (0.04, 0.1, 1.08, 0.25)):
        b.sphere((dx, dy, dz), r, "accent", 1, M=M)


A.node("OliveTree_1", None, (-1.25, -0.15, 0), lambda b: olive_tree(b, -1.25, -0.15, 1.0), role="prop")
A.node("OliveTree_2", None, (1.5, 0.15, 0), lambda b: olive_tree(b, 1.5, 0.15, 0.75), role="prop")


def crates(b):
    for (x, y, z) in ((-0.3, -0.95, 0.0), (0.15, -1.05, 0.0), (-0.06, -0.98, 0.26)):
        b.box((x, y, z + 0.125), (0.42, 0.3, 0.25), "wood", bevel=0.015)
        b.box((x, y, z + 0.235), (0.36, 0.24, 0.04), "accent")
        for k in range(3):
            b.sphere((x - 0.1 + 0.1 * k, y, z + 0.27), 0.035, "accent", 1)
A.node("Crates", None, (-0.06, -1.0, 0), crates, role="prop")


def stall(b):
    M = T(0.85, -0.25) @ Rz(-12)
    b.box((0, 0, 0.25), (0.95, 0.42, 0.5), "wood", bevel=0.02, M=M)
    b.box((0, 0, 0.51), (1.0, 0.46, 0.03), "white", M=M)
    for sx in (-0.46, 0.46):
        for sy in (-0.19, 0.19):
            b.box((sx, sy, 0.6), (0.04, 0.04, 1.2), "wood", M=M)
    for k in range(6):
        b.box((-0.42 + 0.168 * k, 0, 1.24), (0.17, 0.62, 0.03), "white" if k % 2 else "accent",
              M=M @ T(0, 0, 1.24) @ Rx(-12) @ T(0, 0, -1.24))
A.node("FarmStall", None, (0.85, -0.25, 0), stall, role="prop")


def cart(b):
    M = T(-1.0, -1.05) @ Rz(15)
    b.box((0, 0, 0.27), (0.62, 0.36, 0.14), "wood", bevel=0.015, M=M)
    for sy in (-0.21, 0.21):
        wheel_y(b, 0.05, sy, 0.16, 0.16, 0.04, M)
    for sy in (-0.12, 0.12):
        b.box((-0.45, sy, 0.3), (0.35, 0.03, 0.03), "wood", M=M)
    b.sphere((0.1, 0, 0.42), 0.12, "white", 1, M=M)
    b.sphere((-0.12, 0.04, 0.4), 0.1, "white", 1, M=M)
A.node("Cart", None, (-1.0, -1.05, 0), cart, role="prop")


def bottles(b):
    for (x, y, s) in ((0.45, -1.3, 1.0), (0.62, -1.22, 0.8)):
        b.cyl((x, y, 0.15 * s), 0.07 * s, 0.3 * s, "accent", 16)
        b.cyl((x, y, 0.33 * s), 0.025 * s, 0.07 * s, "accent", 10)
        b.cyl((x, y, 0.38 * s), 0.03 * s, 0.03 * s, "charcoal", 10)
A.node("OilBottles", None, (0.5, -1.27, 0), bottles, role="prop")
worlds.append(A)

# ============================================================ 2 Loryfy (loyalty / rewards)
A = new_world("loryfy", "Loryfy", "Gold", (0.95, 0.72, 0.02))


def coin_stack(b, x, y, n):
    for k in range(n):
        b.cyl((x + 0.01 * math.sin(k * 1.7), y + 0.01 * math.cos(k * 1.3), 0.022 + 0.044 * k), 0.16, 0.04,
              "accent", 24)


for i, (x, y, n) in enumerate(((-1.25, -0.55, 4), (-0.85, -1.0, 7), (1.35, -0.85, 5)), 1):
    A.node(f"CoinStack_{i}", None, (x, y, 0), lambda b, x=x, y=y, n=n: coin_stack(b, x, y, n), role="prop")
for i, (p, yaw) in enumerate((((0.15, -1.1, 0.9), 15), ((1.2, -0.5, 1.0), -20)), 1):
    def coin(b, p=p, yaw=yaw):
        M = T(*p) @ Rz(yaw)
        b.cyl((0, 0, 0), 0.17, 0.035, "accent", 28, axis="Y", M=M)
        b.prism(star_outline(0.09, 0.04), 0.045, "white", M)
    A.node(f"FloatCoin_{i}", None, p, coin, role="prop", extra={"float_bob": True, "spin": "about glTF Y"})


def gift(b, x, y, s, box_key, ribbon_key, yaw):
    M = T(x, y) @ Rz(yaw)
    b.box((0, 0, s / 2), (s, s, s), box_key, bevel=0.01, M=M)
    b.box((0, 0, s / 2), (s + 0.01, s * 0.18, s + 0.01), ribbon_key, M=M)
    b.box((0, 0, s / 2), (s * 0.18, s + 0.01, s + 0.01), ribbon_key, M=M)
    for d in (-1, 1):
        b.torus((d * 0.06, 0, s + 0.05), 0.06, 0.018, ribbon_key, 16, 6, axis="Y", M=M @ T(0, 0, 0) @ Rz(90 * d))


A.node("GiftBox_1", None, (-0.25, -0.85, 0), lambda b: gift(b, -0.25, -0.85, 0.45, "white", "green", 10),
       role="prop")
A.node("GiftBox_2", None, (0.55, -1.3, 0), lambda b: gift(b, 0.55, -1.3, 0.32, "accent", "white", -20),
       role="prop")
for i, (x, y) in enumerate(((1.25, -0.05), (-1.3, 0.25)), 1):
    def badge(b, x=x, y=y):
        b.cyl((x, y, 0.04), 0.14, 0.08, "charcoal", 24)
        b.box((x, y, 0.2), (0.04, 0.04, 0.25), "grey")
        b.prism(star_outline(0.25, 0.11), 0.07, "accent", T(x, y, 0.55))
        b.prism(star_outline(0.12, 0.055), 0.08, "white", T(x, y, 0.55))
    A.node(f"StarBadge_{i}", None, (x, y, 0), badge, role="prop")


def phone(b):
    M = T(0.45, -0.25) @ Rz(-8)
    b.box((0, 0.05, 0.03), (0.4, 0.3, 0.06), "charcoal", bevel=0.015, M=M)
    Mp = M @ T(0, 0.02, 0.5) @ Rx(-12)
    b.panel((0, 0, 0), 0.38, 0.82, 0.035, 0.05, "white", Mp)


PHONE_M = T(0.45, -0.25) @ Rz(-8) @ T(0, 0.02, 0.5) @ Rx(-12)
phone_ob = A.node("Phone", None, (0.45, -0.25, 0), phone, role="prop")
A.node("PhoneScreen", phone_ob, tuple(PHONE_M @ Vector((0, -0.022, -0.01))),
       lambda b: b.panel((0, -0.022, -0.01), 0.34, 0.7, 0.0, 0.03, "screen", PHONE_M), role="screen",
       two_sided=True)
worlds.append(A)

# ============================================================ 3 Tasami (community / social)
A = new_world("tasami", "Tasami", "Coral", (1.0, 0.48, 0.35))
bubbles = [(-0.2, -0.5, 0.95, 0.2, "accent"), (0.45, -0.75, 0.75, 0.16, "white"), (0.7, -0.3, 1.1, 0.17, "green"),
           (0.05, -0.15, 1.2, 0.14, "white"), (-0.75, -0.35, 1.15, 0.15, "white")]
links = [(0, 1), (0, 3), (1, 2), (2, 3), (3, 4), (0, 4)]


def network(b):
    hub = Vector(bubbles[0][:3])
    b.cyl((hub.x, hub.y, hub.z / 2), 0.04, hub.z, "grey", 12)
    b.cyl((hub.x, hub.y, 0.03), 0.2, 0.06, "charcoal", 24)
    for i, j in links:
        a, c = Vector(bubbles[i][:3]), Vector(bubbles[j][:3])
        d = c - a
        M = T(*a) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        b.cyl((0, 0, d.length / 2), 0.018, d.length, "charcoal", 8, M=M)


A.node("BubbleLinks", None, (bubbles[0][0], bubbles[0][1], 0), network, role="prop")
for i, (x, y, z, r, key) in enumerate(bubbles, 1):
    A.node(f"Bubble_{i}", None, (x, y, z), lambda b, x=x, y=y, z=z, r=r, key=key: b.sphere((x, y, z), r, key, 3),
           role="prop", smooth=True, extra={"pulse": "scale"})
for i, (p, yaw) in enumerate((((1.3, -0.75, 0.95), -20), ((-1.3, -0.85, 0.8), 20), ((1.0, -1.4, 0.55), -10)), 1):
    def chat(b, p=p, yaw=yaw, i=i):
        M = T(*p) @ Rz(yaw)
        key = "accent" if i == 1 else "white"
        b.panel((0, 0, 0), 0.5, 0.3, 0.03, 0.06, key, M)
        b.prism([(-0.16, -0.14), (-0.06, -0.14), (-0.18, -0.24)], 0.03, key, M)
        for k, wl in enumerate((0.32, 0.24)):
            b.box((-0.2 + 0.02 + wl / 2, -0.018, 0.05 - 0.09 * k), (wl, 0.01, 0.035),
                  "white" if key == "accent" else "grey", M=M)
    A.node(f"ChatCard_{i}", None, p, chat, role="prop", extra={"float_bob": True})
for i, (x, y, key) in enumerate(((-0.9, -0.95, "accent"), (-0.3, -1.3, "green"), (0.3, -1.2, "white")), 1):
    def avatar(b, x=x, y=y, key=key):
        b.cyl((x, y, 0.15), 0.22, 0.3, "white", 32)
        b.ring((x, y, 0.29), 0.2, 0.225, 0.02, "accent", 32)
        b.cyl((x, y, 0.43), 0.15, 0.26, key if key != "white" else "grey", 20, r2=0.07)
        b.sphere((x, y, 0.65), 0.1, key if key != "white" else "grey", 2)
    A.node(f"AvatarPedestal_{i}", None, (x, y, 0), avatar, role="prop")
worlds.append(A)

# ============================================================ 4 Bena'at (construction / building materials)
A = new_world("benaat", "Bena'at", "Orange", (0.95, 0.55, 0.16))


def scaffold(b):
    x0, y0, s = -1.3, -0.85, 0.6
    for sx in (-s / 2, s / 2):
        for sy in (-s / 2, s / 2):
            b.box((x0 + sx, y0 + sy, 0.77), (0.035, 0.035, 1.54), "grey")
    for lvl in range(3):
        z = 0.42 * (lvl + 1)
        b.box((x0, y0, z), (s + 0.04, s + 0.04, 0.04), "accent")
        for sy in (-s / 2, s / 2):
            b.box((x0, y0 + sy, z + 0.25), (s, 0.025, 0.025), "grey")   # guard rail, top one at 1.51
        b.box((0, 0, 0), (s * 0.85, 0.02, 0.02), "grey", M=T(x0, y0 - s / 2, z - 0.21) @ Ry(-35))  # brace
A.node("ScaffoldTower", None, (-1.3, -0.85, 0), scaffold, role="prop")


CRANE = (1.5, -0.45)


def crane(b):
    x0, y0 = CRANE
    b.box((x0, y0, 0.08), (0.45, 0.45, 0.16), "charcoal", bevel=0.02)
    for sx in (-0.12, 0.12):
        for sy in (-0.12, 0.12):
            b.box((x0 + sx, y0 + sy, 1.3), (0.035, 0.035, 2.3), "accent")
    for k in range(8):
        b.box((x0, y0 - 0.12, 0.35 + 0.27 * k), (0.24, 0.02, 0.02), "accent")
        b.box((x0, y0 + 0.12, 0.35 + 0.27 * k), (0.24, 0.02, 0.02), "accent")
    b.box((x0 - 0.15, y0, 2.48), (0.3, 0.3, 0.2), "white", bevel=0.02)
    b.box((x0 - 0.85, y0, 2.62), (1.8, 0.12, 0.08), "accent")
    b.box((x0 + 0.3, y0, 2.62), (0.5, 0.14, 0.08), "accent")
    b.box((x0 + 0.48, y0, 2.48), (0.2, 0.22, 0.22), "charcoal")
A.node("Crane", None, (CRANE[0], CRANE[1], 0), crane, role="prop")
HOOK = (CRANE[0] - 0.95, CRANE[1])
A.node("CraneHook", None, (HOOK[0], HOOK[1], 2.58),
       lambda b: (b.cyl((HOOK[0], HOOK[1], 2.08), 0.008, 1.0, "charcoal", 6),
                  b.box((HOOK[0], HOOK[1], 1.55), (0.08, 0.06, 0.08), "charcoal")),
       role="prop", extra={"swing": "rotate about glTF Z; pivot at the jib"})


def bricks(b):
    b.box((0.15, -1.0, 0.04), (0.62, 0.42, 0.08), "wood")
    for lvl in range(3):
        for k in range(4):
            for j in range(2):
                b.box((-0.05 + 0.13 * k + (0.03 if lvl % 2 else 0), -1.1 + 0.2 * j, 0.13 + 0.09 * lvl),
                      (0.12, 0.19, 0.08), "accent", bevel=0.008)
A.node("Bricks", None, (0.15, -1.0, 0), bricks, role="prop")


def rolls(b):
    for k, (y, z) in enumerate(((-1.25, 0.05), (-1.12, 0.05), (-1.185, 0.15))):
        b.cyl((-0.55, y, z), 0.055, 0.5, "white", 16, axis="X")
        b.cyl((-0.55 + 0.255, y, z), 0.056, 0.012, "green", 16, axis="X")
A.node("BlueprintRolls", None, (-0.55, -1.18, 0), rolls, role="prop")


def drafting(b):
    M = T(0.95, -0.85) @ Rz(-20)
    for sx in (-0.25, 0.25):
        b.box((sx, 0.1, 0.4), (0.04, 0.04, 0.8), "grey", M=M)
    Mt = M @ T(0, 0, 0.85) @ Rx(-35)
    b.panel((0, 0, 0), 0.65, 0.45, 0.03, 0.02, "white", Mt)
    for k in range(4):
        b.box((-0.1 + 0.05 * k, -0.017, 0.05 - 0.07 * k), (0.35 - 0.05 * k, 0.006, 0.012), "green", M=Mt)
    b.box((0.15, -0.017, -0.05), (0.012, 0.006, 0.25), "green", M=Mt)
A.node("DraftingTable", None, (0.95, -0.85, 0), drafting, role="prop")
worlds.append(A)

# ============================================================ 5 Al-Humairi Hajj (pilgrimage services)
A = new_world("alhumairi-hajj", "Al-Humairi Hajj", "Gold", (0.79, 0.64, 0.15))


def monument(b):
    b.cyl((0, 0.15, 0.03), 0.9, 0.06, "white", 48)
    b.box((0, 0.15, 0.56), (1.0, 1.0, 1.0), "dark")
    b.box((0, 0.15, 0.82), (1.02, 1.02, 0.09), "accent")
A.node("CubeMonument", None, (0, 0.15, 0), monument, role="prop",
       extra={"note": "abstract black cube with a gold band; no figures or text"})


def bus(b):
    M = T(-1.2, -0.75) @ Rz(25)
    b.box((0, 0, 0.36), (1.1, 0.46, 0.46), "white", bevel=0.05, M=M)
    for sy in (-0.233, 0.233):
        b.box((0.05, sy, 0.45), (0.85, 0.01, 0.14), "charcoal", M=M)
        b.box((0, sy, 0.27), (1.0, 0.01, 0.04), "green", M=M)
    b.box((-0.556, 0, 0.45), (0.01, 0.38, 0.18), "charcoal", M=M)
    for sx in (-0.33, 0.33):
        for sy in (-0.21, 0.21):
            wheel_y(b, sx, sy, 0.11, 0.11, 0.06, M)
A.node("Bus", None, (-1.2, -0.75, 0), bus, role="prop")
for i, (p, yaw) in enumerate((((1.05, -0.95, 0.85), -20), ((1.4, -0.5, 1.05), -30)), 1):
    def ticket(b, p=p, yaw=yaw):
        M = T(*p) @ Rz(yaw) @ Ry(8)
        b.panel((0, 0, 0), 0.36, 0.18, 0.012, 0.02, "white", M)
        b.box((-0.11, -0.008, 0), (0.05, 0.006, 0.17), "accent", M=M)
        b.box((0.05, -0.008, 0.03), (0.16, 0.006, 0.02), "grey", M=M)
        b.box((0.03, -0.008, -0.03), (0.12, 0.006, 0.02), "grey", M=M)
    A.node(f"Ticket_{i}", None, p, ticket, role="prop", extra={"float_bob": True})
for i, (x, y, key, s) in enumerate(((0.75, -1.2, "accent", 1.0), (1.15, -1.3, "white", 0.8)), 1):
    def suitcase(b, x=x, y=y, key=key, s=s):
        M = T(x, y) @ Rz(-15) @ Matrix.Scale(s, 4)
        b.box((0, 0, 0.27), (0.32, 0.16, 0.42), key, bevel=0.03, M=M)
        b.box((0, 0, 0.27), (0.33, 0.17, 0.03), "charcoal", M=M)
        b.box((0, 0, 0.52), (0.12, 0.03, 0.06), "charcoal", M=M)
        for sx in (-0.11, 0.11):
            b.cyl((sx, 0, 0.035), 0.03, 0.03, "charcoal", 10, axis="Y", M=M)
    A.node(f"Suitcase_{i}", None, (x, y, 0), suitcase, role="prop")


def palm(b):
    x0, y0 = 1.35, 0.35
    for k in range(5):
        b.cyl((x0 + 0.015 * k, y0, 0.15 + 0.3 * k), 0.07 - 0.006 * k, 0.3, "wood", 8)
    top = (x0 + 0.06, y0, 1.6)
    for k in range(7):
        M = T(*top) @ Rz(k * 360 / 7) @ Ry(-25 if k % 2 else -15)
        b.box((0.32, 0, 0), (0.62, 0.14, 0.025), "green", M=M)
A.node("PalmTree", None, (1.35, 0.35, 0), palm, role="prop")
worlds.append(A)

# ============================================================ 6 Shahntak (shipping / logistics)
A = new_world("shahntak", "Shahntak", "Blue", (0.18, 0.49, 0.96))


def container(b, c, key, yaw=0):
    M = T(*c) @ Rz(yaw)
    b.box((0, 0, 0.21), (1.0, 0.42, 0.42), key, bevel=0.01, M=M)
    for k in range(9):
        for sy in (-0.212, 0.212):
            b.box((-0.4 + 0.1 * k, sy, 0.21), (0.03, 0.012, 0.38), key, M=M)
    b.box((0.502, 0, 0.21), (0.012, 0.36, 0.36), "charcoal", M=M)


for i, (c, key) in enumerate((((-1.15, 0.05, 0), "green"), ((-1.15, -0.42, 0), "accent"),
                               ((-1.15, -0.18, 0.42), "white")), 1):
    A.node(f"Container_{i}", None, c, lambda b, c=c, key=key: container(b, c, key, 0), role="prop")


def truck(b):
    M = T(0.75, -0.35) @ Rz(-15)
    b.box((-0.2, 0, 0.35), (0.95, 0.4, 0.46), "white", bevel=0.02, M=M)
    b.box((-0.2, -0.201, 0.22), (0.9, 0.01, 0.04), "green", M=M)
    b.box((0.47, 0, 0.3), (0.32, 0.4, 0.4), "accent", bevel=0.04, M=M)
    b.box((0.6, 0, 0.4), (0.06, 0.36, 0.14), "charcoal", M=M)
    for sx in (-0.5, -0.25, 0.47):
        for sy in (-0.2, 0.2):
            wheel_y(b, sx, sy, 0.1, 0.1, 0.06, M)
A.node("Truck", None, (0.75, -0.35, 0), truck, role="prop")


def parcels(b):
    for (x, y, z, s) in ((-0.25, -1.05, 0, 0.26), (0.05, -1.1, 0, 0.22), (-0.12, -1.05, 0.26, 0.2),
                         (0.28, -1.25, 0, 0.18)):
        b.box((x, y, z + s / 2), (s, s, s), "white", bevel=0.01)
        b.box((x, y, z + s / 2), (s + 0.005, s * 0.15, s + 0.005), "accent")
A.node("Parcels", None, (0.0, -1.1, 0), parcels, role="prop")
route = [Vector(p) for p in ((-1.6, -1.3, 0), (-1.0, -1.55, 0), (-0.3, -1.6, 0), (0.4, -1.55, 0), (1.0, -1.25, 0),
                             (1.45, -0.85, 0), (1.6, -0.3, 0))]


def route_line(b):
    for a, c in zip(route, route[1:]):
        d = c - a
        n = max(2, int(d.length / 0.12))
        for k in range(n):
            p = a + d * ((k + 0.5) / n)
            M = T(p.x, p.y, 0.006) @ Rz(math.degrees(math.atan2(d.y, d.x)))
            b.box((0, 0, 0), (d.length / n * 0.6, 0.04, 0.012), "green", M=M)
A.node("RouteLine", None, (0, -1.4, 0), route_line, role="prop", extra={"note": "dashes; reveal left to right"})
for i, idx in enumerate((0, 3, 6), 1):
    p = route[idx]

    def pin(b, p=p, i=i):
        key = "accent" if i != 2 else "green"
        b.cyl((p.x, p.y, 0.15), 0.005, 0.26, key, 16, r2=0.09)
        b.sphere((p.x, p.y, 0.33), 0.1, key, 2)
        b.sphere((p.x, p.y - 0.06, 0.34), 0.04, "white", 1)
    A.node(f"Pin_{i}", None, (p.x, p.y, 0), pin, role="prop", extra={"drop_in": "pivot at the pin tip"})
worlds.append(A)

# ---------------------------------------------------------------- preview (not exported)
prev = bpy.data.collections.new("Preview")
scene.collection.children.link(prev)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.06, 0.065, 0.07, 1)
for name, loc, energy in (("Key", (3, -4, 5), 700), ("Fill", (-4, -3, 2), 250), ("Back", (0, 4, 3), 300)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = 3
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    prev.objects.link(lo)
    lo.rotation_euler = (lo.location * -1).to_track_quat("-Z", "Y").to_euler()

bpy.context.view_layer.update()
os.makedirs(EXPORT_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "worlds.blend"))
for A in worlds:
    A.export_clean(os.path.join(EXPORT_DIR, A.file))

manifest = {
    "source": "assets-model/worlds.blend (built by assets-model/scripts/worlds.py)",
    "units": "same as the robot (3.38 units tall); each island is 4 units across",
    "axes": "glTF +Y up, front faces +Z. WorldRoot = island top centre (y = 0); the island hangs below to y = -1.3.",
    "conventions": [
        "ScreenPlane_1..3: one-sided 16:10 faces (0.9 x 0.5625), UV 0-1 (u = right, v = up), material 'Screen' "
        "(emissive black): set emissive to white and use the screenshot as emissiveMap.",
        "CamStart / CamEnd look down their local -Z at camera_look_at_gltf; lerp position and slerp rotation.",
        "Nodes with extras.float_bob are meant to float; every other prop stands on the island.",
        "Each prop is its own node with its pivot at its base centre (floating props: their centre).",
    ],
    "camera_look_at_gltf": b2g(LOOK_AT),
    "worlds": [
        {"slug": A.slug, "title": A.title, "file": A.file, "accent": A.accent, "tris": A.tris(),
         "cam_start_gltf": b2g(CAM_START), "cam_end_gltf": b2g(CAM_END),
         "screen_planes": [f"ScreenPlane_{i}" for i in (1, 2, 3)],
         "nodes": A.manifest_nodes()}
        for A in worlds
    ],
}
write_json(os.path.join(EXPORT_DIR, "worlds.manifest.json"), manifest)
print({A.file: A.tris() for A in worlds})
