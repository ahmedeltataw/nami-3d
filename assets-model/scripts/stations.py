"""Build stations.blend: the six Creation Lab station prop groups, the shared mechanical arms and the
generic parts (card M2-07a). Exports one GLB per asset plus export/stations.manifest.json.

Space (Blender): each asset's root is at the origin = the top centre of a lab_shell Plinth pad, Z up,
front faces -Y. That matches lab_shell's Station_n anchors (their local -Y faces the camera path), so in the
app parent station_<n>_*.glb's root under Station_n with an identity transform.
glTF: Y up, front faces +Z.
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
from common import EXPORT_DIR, ROOT_DIR, b2g, export_glb, new_scene, write_json  # noqa: E402
from props import Asset, materials  # noqa: E402

scene = new_scene()
mats = materials()
assets = []


def T(x, y, z):
    return Matrix.Translation((x, y, z))


def Rz(deg):
    return Matrix.Rotation(math.radians(deg), 4, "Z")


def Rx(deg):
    return Matrix.Rotation(math.radians(deg), 4, "X")


def aim(direction):
    """Matrix turning +Z toward direction."""
    return Vector(direction).to_track_quat("Z", "Y").to_matrix().to_4x4()


def anchors(A, prefix, robot_target, camera_focus):
    A.empty(f"{prefix}_RobotTarget", A.root, robot_target, size=0.12, role="robot_point_target", display="SPHERE")
    A.empty(f"{prefix}_CameraFocus", A.root, camera_focus, size=0.12, role="camera_focus", display="CUBE")
    A.anchors = {"robot_point_target": f"{prefix}_RobotTarget", "camera_focus": f"{prefix}_CameraFocus",
                 "robot_point_target_gltf": b2g(robot_target), "camera_focus_gltf": b2g(camera_focus)}


def floating_window(A, name, pos, yaw, w, h, with_screen=True):
    M = T(*pos) @ Rz(yaw)

    def build(b):
        b.panel((0, 0, 0), w, h, 0.025, 0.035, "white", M)
        b.box((0, -0.006, h / 2 - 0.045), (w - 0.03, 0.02, 0.06), "charcoal", M=M)       # title bar
        for k, key in enumerate(("green", "white", "grey")):
            b.cyl((-w / 2 + 0.06 + 0.045 * k, -0.017, h / 2 - 0.045), 0.014, 0.006, key, 12, axis="Y", M=M)
        if with_screen:
            b.screen((0, -0.0165, -0.04), w - 0.06, h - 0.14, 0.02, M)
    return A.node(name, None, pos, build, role="floating_panel", extra={"float_bob": True})


def screen_child(A, name, parent, pos, w, h, M):
    """Separate UV 0-1 screen node so the app can put a UI texture on it."""
    def build(b):
        b.screen((0, 0, 0), w, h, 0.02, M)
    # one-sided face: keep its -Y winding instead of recalculating normals
    return A.node(name, parent, pos, build, role="screen", extra={"uv": "0-1, u = right, v = up"}, two_sided=True)


# ============================================================ 1 Web
A = Asset(scene, "Station1_Web", "Station1_Web", mats)
A.file = "station_1_web.glb"


def s1_display(b):
    b.cyl((0, 0.05, 0.03), 0.34, 0.06, "charcoal", 32)
    b.ring((0, 0.05, 0.062), 0.24, 0.27, 0.006, "green", 32)
    b.box((0, 0.05, 0.56), (0.08, 0.08, 1.0), "grey", bevel=0.01)
    b.panel((0, 0.05, 1.45), 1.5, 0.9, 0.06, 0.05, "white")
    b.box((0, 0.09, 1.45), (0.3, 0.03, 0.2), "grey")


disp = A.node("S1_Display", None, (0, 0, 0), s1_display, role="display")
screen_child(A, "S1_Screen", disp, (0, 0.016, 1.45), 1.4, 0.8, T(0, 0.016, 1.45))
floating_window(A, "S1_Window_1", (-0.88, -0.3, 2.05), 22, 0.8, 0.55)
floating_window(A, "S1_Window_2", (0.92, -0.25, 1.85), -22, 0.7, 0.5)
for i, (pos, yaw) in enumerate((((-0.78, -0.55, 0.95), 18), ((0.8, -0.6, 1.08), -18), ((0.35, -0.7, 2.3), -8)), 1):
    M = T(*pos) @ Rz(yaw)

    def card(b, M=M, i=i):
        b.panel((0, 0, 0), 0.4, 0.26, 0.02, 0.03, "charcoal", M)
        for k, (wl, key) in enumerate(((0.22, "green"), (0.28, "white"), (0.16, "white"), (0.24, "green"))):
            x = -0.2 + 0.04 + wl / 2 + (0.03 if k in (1, 2) else 0)
            b.box((x, -0.012, 0.075 - 0.05 * k), (wl, 0.008, 0.022), key, M=M)
    A.node(f"S1_CodeCard_{i}", None, pos, card, role="code_card", extra={"float_bob": True})
anchors(A, "S1", (0, 0, 1.45), (0, 0, 1.35))
assets.append(A)

# ============================================================ 2 Mobile
A = Asset(scene, "Station2_Mobile", "Station2_Mobile", mats)
A.file = "station_2_mobile.glb"
PW, PH, PT = 0.38, 0.82, 0.035          # phone kit proportions 6.5 : 14 : 0.6


def s2_stand(b):
    b.box((0, 0.05, 0.03), (0.7, 0.5, 0.06), "charcoal", bevel=0.02)
    b.box((0, 0.05, 0.065), (0.6, 0.4, 0.01), "grey")
    b.box((0, -0.2, 0.03), (0.5, 0.012, 0.016), "green")
    b.box((0, 0.12, 0.72), (0.16, 0.16, 1.3), "white", bevel=0.02)
    b.box((0, 0.06, 1.39), (0.48, 0.16, 0.06), "charcoal", bevel=0.01)
    b.box((0, -0.01, 1.43), (0.46, 0.02, 0.06), "charcoal")


stand = A.node("S2_Stand", None, (0, 0, 0), s2_stand, role="device_stand")


def phone(A, name, pos, M, parent=None, role="phone"):
    def build(b):
        b.panel((0, 0, 0), PW, PH, PT, 0.05, "white", M)
        b.cyl((0, -PT / 2 - 0.002, PH / 2 - 0.045), 0.012, 0.004, "charcoal", 12, axis="Y", M=M)
    ob = A.node(name, parent, pos, build, role=role, extra={"float_bob": role == "floating_phone"})
    screen_child(A, f"{name}_Screen", ob, pos, PW - 0.04, PH - 0.12, M @ T(0, -PT / 2 - 0.004, -0.01))
    return ob


phone(A, "S2_StandPhone", (0, 0.06, 1.86), T(0, 0.06, 1.86) @ Rx(-10), parent=stand, role="phone")
phone(A, "S2_FloatPhone_1", (-0.8, -0.3, 1.55), T(-0.8, -0.3, 1.55) @ Rz(25) @ Rx(-6), role="floating_phone")
phone(A, "S2_FloatPhone_2", (0.82, -0.25, 1.3), T(0.82, -0.25, 1.3) @ Rz(-25) @ Rx(6), role="floating_phone")
anchors(A, "S2", (0, 0.06, 1.86), (0, 0, 1.45))
assets.append(A)

# ============================================================ 3 Marketing
A = Asset(scene, "Station3_Marketing", "Station3_Marketing", mats)
A.file = "station_3_marketing.glb"


def s3_base(b):
    b.box((0.2, 0.1, 0.04), (1.3, 0.5, 0.08), "white", bevel=0.02)
    b.box((0.2, -0.152, 0.04), (1.2, 0.01, 0.02), "green")


A.node("S3_ChartBase", None, (0, 0, 0), s3_base, role="chart_base")
heights = (0.35, 0.55, 0.8, 1.05, 1.35)
for i, hgt in enumerate(heights, 1):
    x = -0.3 + 0.25 * (i - 1)

    def bar(b, x=x, hgt=hgt):
        b.box((x, 0.1, 0.08 + (hgt - 0.06) / 2), (0.18, 0.25, hgt - 0.06), "white", bevel=0.012)
        b.box((x, 0.1, 0.08 + hgt - 0.03), (0.18, 0.25, 0.06), "green", bevel=0.012)
    A.node(f"S3_Bar_{i}", None, (x, 0.1, 0.08), bar, role="chart_bar",
           extra={"grow": "animate scale.y (glTF) 0 -> 1; pivot is the bar bottom", "height": hgt})


def arrow(b, a, c, key="green", r=0.025, head=0.07):
    a, c = Vector(a), Vector(c)
    d = c - a
    L = d.length
    M = T(*a) @ aim(d)
    b.cyl((0, 0, (L - head) / 2), r, L - head, key, 12, M=M)
    b.cyl((0, 0, L - head / 2), r * 2.6, head, key, 12, r2=0.001, M=M)


A.node("S3_GrowthArrow", None, (-0.4, -0.12, 0.6),
       lambda b: arrow(b, (-0.4, -0.12, 0.6), (0.85, -0.12, 1.75)), role="growth_arrow",
       extra={"draw_on": "pivot at the arrow tail; scale along its length to draw it"})


def megaphone(b):
    M = T(-0.82, -0.2, 1.15) @ aim((0.85, -0.3, 0.45))
    b.cyl((0, 0, 0.22), 0.07, 0.36, "white", 24, r2=0.25, M=M)
    b.ring((0, 0, 0.4), 0.23, 0.26, 0.03, "green", 24, M=M)
    b.cyl((0, 0, 0.02), 0.075, 0.06, "charcoal", 24, M=M)
    b.box((0, -0.08, 0.08), (0.05, 0.14, 0.05), "charcoal", M=M)


A.node("S3_Megaphone", None, (-0.82, -0.2, 1.15), megaphone, role="megaphone", extra={"float_bob": True})


def social(b, pos, icon):
    M = T(*pos)
    b.cyl((0, 0, 0), 0.17, 0.04, "white", 32, axis="Y", M=M)
    b.ring((0, 0, 0), 0.15, 0.17, 0.045, "grey", 32, M=M @ Rx(90))
    y = -0.025
    if icon == "play":
        # the 3-sided cone's first vertex points up; turn it to point right
        b.cyl((0, y, 0), 0.08, 0.012, "green", 3, axis="Y",
              M=M @ T(0.012, 0, 0) @ Matrix.Rotation(math.radians(90), 4, "Y"))
    elif icon == "chat":
        b.panel((0, y, 0.015), 0.17, 0.11, 0.012, 0.03, "green", M)
        b.cyl((-0.045, y, -0.05), 0.03, 0.012, "green", 3, axis="Y", M=M)
    else:  # heart
        for sx in (-0.035, 0.035):
            b.cyl((sx, y, 0.025), 0.045, 0.012, "green", 16, axis="Y", M=M)
        b.box((0, y, -0.012), (0.09, 0.012, 0.09), "green", M=M @ T(0, 0, -0.012) @ Matrix.Rotation(
            math.radians(45), 4, "Y") @ T(0, 0, 0.012))


for i, (pos, icon) in enumerate((((-0.6, -0.5, 1.95), "heart"), ((0.05, -0.55, 2.3), "play"),
                                  ((0.7, -0.45, 2.15), "chat")), 1):
    A.node(f"S3_Social_{i}", None, pos, lambda b, pos=pos, icon=icon: social(b, pos, icon), role="social_plate",
           extra={"icon": icon, "float_bob": True})
anchors(A, "S3", (0.7, 0.1, 1.43), (0.1, 0, 1.15))
assets.append(A)

# ============================================================ 4 Consulting
A = Asset(scene, "Station4_Consulting", "Station4_Consulting", mats)
A.file = "station_4_consulting.glb"


def table(b):
    b.cyl((0, 0, 0.03), 0.42, 0.06, "charcoal", 32)
    b.cyl((0, 0, 0.45), 0.11, 0.8, "white", 24)
    b.cyl((0, 0, 0.86), 0.88, 0.06, "white", 48)
    b.torus((0, 0, 0.86), 0.88, 0.022, "green", 48, 6)


A.node("S4_Table", None, (0, 0, 0), table, role="holo_table")
A.node("S4_HoloSurface", None, (0, 0, 0.905), lambda b: b.cyl((0, 0, 0.905), 0.76, 0.01, "holo", 48),
       role="holo_surface", extra={"note": "alpha 0.35 BLEND, drive emissiveIntensity"})
nodes4 = [(-0.45, 0.0, 1.22), (-0.05, -0.38, 1.38), (0.42, -0.02, 1.25), (0.05, 0.38, 1.48)]
for i, p in enumerate(nodes4, 1):
    A.node(f"S4_FlowNode_{i}", None, p,
           lambda b, p=p, i=i: b.box(p, (0.15, 0.15, 0.15), "green" if i == 1 else "white", bevel=0.025),
           role="flow_node", extra={"float_bob": True})
for i in range(1, 4):
    a, c = Vector(nodes4[i - 1]), Vector(nodes4[i])
    d = (c - a).normalized()
    a2, c2 = a + d * 0.13, c - d * 0.13
    mid = (a2 + c2) / 2
    A.node(f"S4_Arrow_{i}", None, tuple(mid), lambda b, a2=a2, c2=c2: arrow(b, a2, c2, "green", 0.012, 0.05),
           role="flow_arrow", extra={"from": f"S4_FlowNode_{i}", "to": f"S4_FlowNode_{i + 1}"})


def board(b):
    M = T(0.78, 0.62, 0) @ Rz(-35)
    for sx in (-0.3, 0.3):
        b.box((sx, 0, 0.7), (0.04, 0.04, 1.4), "grey", M=M)
    b.panel((0, 0, 1.25), 0.72, 0.62, 0.03, 0.03, "charcoal", M)
    for k, (x, z, key) in enumerate(((-0.2, 1.4, "green"), (0.0, 1.38, "white"), (0.2, 1.42, "yellow"),
                                     (-0.15, 1.15, "white"), (0.12, 1.12, "green"))):
        b.box((x, -0.02, z), (0.13, 0.012, 0.13), key, M=M)
    b.box((0, -0.02, 1.0), (0.5, 0.012, 0.02), "white", M=M)


A.node("S4_Board", None, (0.78, 0.62, 0), board, role="board")
anchors(A, "S4", (0, 0, 1.3), (0, 0, 1.1))
assets.append(A)

# ============================================================ 5 Cloud
A = Asset(scene, "Station5_Cloud", "Station5_Cloud", mats)
A.file = "station_5_cloud.glb"
for i, x in enumerate((-0.42, 0.42), 1):
    def rack(b, x=x):
        b.box((x, 0.25, 0.75), (0.52, 0.56, 1.5), "charcoal", bevel=0.025)
        b.box((x, 0.25, 1.505), (0.44, 0.48, 0.02), "grey")
        b.box((x, -0.026, 1.44), (0.4, 0.012, 0.025), "green")
        for k in range(7):
            z = 0.2 + 0.18 * k
            b.box((x - 0.04, -0.034, z), (0.36, 0.012, 0.11), "white", bevel=0.005)
            b.box((x + 0.18, -0.036, z), (0.04, 0.012, 0.03), "green")
    A.node(f"S5_Rack_{i}", None, (x, 0.25, 0), rack, role="server_rack",
           extra={"leds": "green LED blocks share Accent_Green"})
CLOUD = (0.0, -0.1, 2.25)


def cloud(b):
    for (dx, dz, r) in ((-0.32, -0.04, 0.24), (0.0, 0.08, 0.33), (0.32, -0.02, 0.26), (0.12, -0.1, 0.22),
                        (-0.14, -0.12, 0.22)):
        b.sphere((CLOUD[0] + dx, CLOUD[1], CLOUD[2] + dz), r, "white", 3)


A.node("S5_Cloud", None, CLOUD, cloud, role="cloud", extra={"float_bob": True}, smooth=True)
for i, tilt in enumerate((70, -60), 1):
    A.node(f"S5_LinkRing_{i}", None, CLOUD,
           lambda b, tilt=tilt: b.torus((0, 0, 0), 0.72, 0.016, "green", 64, 6,
                                        M=T(*CLOUD) @ Rx(tilt) @ Rz(20 * tilt / abs(tilt))),
           role="link_ring", extra={"spin": "rotate about its own local ring normal; pivot = cloud centre"})
for i, x in enumerate((-0.42, 0.42), 1):
    A.node(f"S5_Beam_{i}", None, (x, 0.25, 1.52),
           lambda b, x=x: arrow(b, (x, 0.25, 1.52), (x * 0.35, CLOUD[1] + 0.05, CLOUD[2] - 0.22), "holo", 0.02,
                                0.06),
           role="data_beam", extra={"note": "holo material; scale or fade to show data flow"})
anchors(A, "S5", CLOUD, (0, 0, 1.45))
assets.append(A)

# ============================================================ 6 Design
A = Asset(scene, "Station6_Design", "Station6_Design", mats)
A.file = "station_6_design.glb"


def easel(b):
    b.cyl((0, 0.15, 0.03), 0.34, 0.06, "charcoal", 32)
    b.ring((0, 0.15, 0.062), 0.24, 0.27, 0.006, "green", 32)
    b.box((0, 0.15, 0.6), (0.08, 0.08, 1.1), "grey", bevel=0.01)
    b.box((0, 0.1, 1.1), (0.3, 0.12, 0.06), "charcoal", bevel=0.01)


stand6 = A.node("S6_Stand", None, (0, 0, 0), easel, role="tablet_stand")
MT = T(0, 0.02, 1.4) @ Rx(-20)
A.node("S6_Tablet", stand6, (0, 0.02, 1.4), lambda b: b.panel((0, 0, 0), 0.95, 0.66, 0.04, 0.05, "charcoal", MT),
       role="tablet")
screen_child(A, "S6_TabletScreen", bpy.data.objects["S6_Tablet"], (0, 0.02, 1.4), 0.86, 0.57, MT @ T(0, -0.024, 0))


def stylus(b):
    M = T(0.5, -0.38, 1.45) @ aim((-0.4, -0.3, -0.85))
    b.cyl((0, 0, 0), 0.014, 0.34, "white", 12, M=M)
    b.cyl((0, 0, 0.19), 0.014, 0.04, "green", 12, r2=0.002, M=M)


A.node("S6_Stylus", None, (0.5, -0.38, 1.45), stylus, role="stylus", extra={"float_bob": True})
for i, key in enumerate(("green", "yellow", "charcoal", "white"), 1):
    p = (-0.78 + 0.05 * i, -0.3, 0.95 + 0.24 * i)

    def swatch(b, p=p, key=key):
        b.cyl(p, 0.11, 0.03, key, 32, axis="Y")
        b.ring((0, 0, 0), 0.11, 0.13, 0.034, "grey", 32, M=T(*p) @ Rx(90))
    A.node(f"S6_Swatch_{i}", None, p, swatch, role="palette_disc", extra={"colour": key, "float_bob": True})


def wireframe(b, pos, yaw):
    M = T(*pos) @ Rz(yaw)
    w, h = 0.55, 0.75
    b.panel((0, 0.006, 0), w, h, 0.008, 0.03, "white", M)
    for (x, z, sx, sz) in ((0, h / 2 - 0.015, w, 0.03), (0, -h / 2 + 0.015, w, 0.03),
                           (-w / 2 + 0.015, 0, 0.03, h), (w / 2 - 0.015, 0, 0.03, h)):
        b.box((x, -0.004, z), (sx, 0.012, sz), "green", M=M)
    b.box((0, -0.004, 0.22), (w - 0.12, 0.012, 0.16), "grey", M=M)
    for k in range(3):
        b.box((-0.06 + 0.0 * k, -0.004, 0.04 - 0.07 * k), (0.32 - 0.06 * k, 0.012, 0.03), "grey", M=M)
    b.box((0, -0.004, -0.27), (0.24, 0.012, 0.07), "green", M=M)


A.node("S6_Wireframe_1", None, (0.82, -0.1, 1.95), lambda b: wireframe(b, (0.82, -0.1, 1.95), -25),
       role="wireframe_card", extra={"float_bob": True})
A.node("S6_Wireframe_2", None, (-0.75, 0.15, 2.25), lambda b: wireframe(b, (-0.75, 0.15, 2.25), 25),
       role="wireframe_card", extra={"float_bob": True})
anchors(A, "S6", (0, 0.02, 1.4), (0, 0, 1.3))
assets.append(A)

# ============================================================ Mechanical arms (shared)
A = Asset(scene, "Mechanical_Arms", "MechanicalArms", mats)
A.file = "mechanical_arms.glb"
A.joints = {}


def ring_base(b):
    b.ring((0, 0, 0.06), 0.42, 0.85, 0.12, "white", 64)
    b.ring((0, 0, 0.122), 0.6, 0.64, 0.006, "green", 64)
    b.cyl((0, 0, 0.05), 0.42, 0.1, "charcoal", 48)


A.node("Arms_Ring", None, (0, 0, 0), ring_base, role="arm_ring_base")
UP, FORE = 0.7, 0.55
FDIR = Vector((0, -0.8, 0.6)).normalized()
for side, sx in (("L", 0.62), ("R", -0.62)):
    base_p = Vector((sx, 0, 0.12))
    sh_p = base_p + Vector((0, 0, 0.26))
    el_p = sh_p + Vector((0, 0, UP))
    wr_p = el_p + FDIR * FORE
    gr_p = wr_p + FDIR * 0.12

    def base(b, p=base_p):
        b.cyl(p + Vector((0, 0, 0.09)), 0.17, 0.18, "white", 32)
        b.ring(p + Vector((0, 0, 0.17)), 0.15, 0.175, 0.02, "green", 32)
    nb = A.node(f"Arm{side}_Base", None, tuple(base_p), base, role="arm_joint")

    def shoulder(b, p=sh_p):
        b.cyl(p, 0.11, 0.26, "charcoal", 24, axis="X")
        b.box(p + Vector((0, 0, UP / 2)), (0.13, 0.13, UP - 0.12), "white", bevel=0.02)
        b.box(p + Vector((0, -0.066, UP / 2)), (0.035, 0.01, UP - 0.25), "green")
    ns = A.node(f"Arm{side}_Shoulder", nb, tuple(sh_p), shoulder, role="arm_joint")

    def elbow(b, p=el_p):
        b.cyl(p, 0.09, 0.22, "charcoal", 24, axis="X")
        M = T(*p) @ aim(FDIR)
        b.box((0, 0, FORE / 2), (0.11, 0.11, FORE - 0.1), "white", bevel=0.02, M=M)
    ne = A.node(f"Arm{side}_Elbow", ns, tuple(el_p), elbow, role="arm_joint")

    def wrist(b, p=wr_p):
        b.sphere(p, 0.075, "charcoal", 2)
        M = T(*p) @ aim(FDIR)
        b.cyl((0, 0, 0.07), 0.05, 0.08, "grey", 16, M=M)
    nw = A.node(f"Arm{side}_Wrist", ne, tuple(wr_p), wrist, role="arm_joint")

    def gripper(b, p=gr_p):
        M = T(*p) @ aim(FDIR)
        b.cyl((0, 0, 0.0), 0.085, 0.05, "white", 24, M=M)
        b.ring((0, 0, 0.026), 0.06, 0.088, 0.01, "green", 24, M=M)
    ng = A.node(f"Arm{side}_Gripper", nw, tuple(gr_p), gripper, role="arm_gripper")

    # three fingers at 120 deg around the gripper axis; each hinges at the palm rim
    ref = Vector((1, 0, 0))
    radial0 = (ref - FDIR * ref.dot(FDIR)).normalized()
    fingers = []
    for k in range(3):
        radial = Matrix.Rotation(math.radians(120 * k), 3, FDIR) @ radial0
        hinge = FDIR.cross(radial).normalized()
        fp = gr_p + FDIR * 0.03 + radial * 0.06

        def finger(b, fp=fp, radial=radial):
            M = T(*fp) @ aim(FDIR + radial * 0.15)
            b.box((0, 0, 0.075), (0.028, 0.028, 0.15), "charcoal", bevel=0.006, M=M)
            b.box((0, 0, 0.148), (0.03, 0.03, 0.02), "green", M=M)
        A.node(f"Arm{side}_Finger_{k + 1}", ng, tuple(fp), finger, role="arm_finger",
               extra={"open_axis_gltf": b2g(hinge),
                      "open": "rotate about open_axis_gltf (parent space) by +angle to open, about 0-35 deg"})
        fingers.append(f"Arm{side}_Finger_{k + 1}")
    A.joints[side] = {
        "base": {"node": f"Arm{side}_Base", "axis_gltf": [0, 1, 0], "motion": "yaw"},
        "shoulder": {"node": f"Arm{side}_Shoulder", "axis_gltf": [1, 0, 0], "motion": "pitch, about -60..60 deg"},
        "elbow": {"node": f"Arm{side}_Elbow", "axis_gltf": [1, 0, 0], "motion": "pitch, about -90..60 deg"},
        "wrist": {"node": f"Arm{side}_Wrist", "axis_gltf": [1, 0, 0], "motion": "pitch; roll about the gripper axis"},
        "gripper": {"node": f"Arm{side}_Gripper", "axis_gltf": b2g(FDIR), "motion": "roll"},
        "fingers": fingers,
        "gripper_axis_gltf": b2g(FDIR),
    }
anchors(A, "Arms", tuple((Vector((0.62, 0, 0)) + Vector((0, 0, 1.08)) + FDIR * 0.75)), (0, -0.2, 1.0))
assets.append(A)

# ============================================================ Generic parts
A = Asset(scene, "Display_Platform", "DisplayPlatform", mats)
A.file = "display_platform.glb"


def platform(b):
    b.cyl((0, 0, 0.09), 0.85, 0.18, "white", 64)
    b.ring((0, 0, 0.09), 0.85, 0.87, 0.06, "green", 64)
    b.cyl((0, 0, 0.012), 0.8, 0.024, "charcoal", 64)


A.node("DisplayPlatform_Base", None, (0, 0, 0), platform, role="platform_base")


def turntable(b):
    b.cyl((0, 0, 0.2), 0.7, 0.04, "grey", 64)
    b.ring((0, 0, 0.222), 0.5, 0.54, 0.006, "green", 64)


A.node("DisplayPlatform_Top", None, (0, 0, 0.2), turntable, role="turntable",
       extra={"spin": "rotate about glTF Y; put the showcased object on top (y = 0.22)"})
anchors(A, "Platform", (0, 0, 0.6), (0, 0, 0.5))
assets.append(A)

A = Asset(scene, "Tech_Cubes", "TechCubes", mats)
A.file = "tech_cubes.glb"
for i, (p, s) in enumerate((((0, 0, 0.25), 0.5), ((0.55, 0.1, 0.18), 0.36), ((-0.48, 0.15, 0.15), 0.3),
                            ((0.1, 0.05, 0.68), 0.36), ((0.42, -0.1, 0.52), 0.26)), 1):
    def cube(b, p=p, s=s):
        b.box(p, (s, s, s), "white" if i % 2 else "grey", bevel=s * 0.06)
        for axis in range(3):
            for sign in (-1, 1):
                size = [s * 0.7, s * 0.7, s * 0.7]
                size[axis] = 0.012
                c = list(p)
                c[axis] += sign * (s / 2 + 0.002)
                strip = list(size)
                strip[(axis + 1) % 3] = s * 0.08
                b.box(tuple(c), tuple(strip), "green")
    A.node(f"TechCube_{i}", None, p, cube, role="tech_cube",
           extra={"size": s, "note": "pivot = cube centre; animate in any order (stack, orbit, snap)"})
anchors(A, "Cubes", (0, 0, 0.5), (0, 0, 0.45))
assets.append(A)

# ---------------------------------------------------------------- preview (not exported)
prev = bpy.data.collections.new("Preview")
scene.collection.children.link(prev)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.78, 0.8, 0.82, 1)
bg.inputs[1].default_value = 0.8
for name, loc, energy in (("Key", (3, -4, 4), 700), ("Fill", (-4, -3, 1.5), 250), ("Back", (0, 4, 3), 300)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = 3
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    prev.objects.link(lo)
    lo.rotation_euler = (lo.location * -1).to_track_quat("-Z", "Y").to_euler()

bpy.context.view_layer.update()
os.makedirs(EXPORT_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "stations.blend"))
for A in assets:
    export_glb(A.coll.name, os.path.join(EXPORT_DIR, A.file))

manifest = {
    "source": "assets-model/stations.blend (built by assets-model/scripts/stations.py)",
    "units": "Blender units, same as the robot (3.38 units tall) and lab_shell",
    "axes": "glTF +Y up, front faces +Z. Each root sits at its origin = top centre of a lab_shell plinth pad.",
    "placement": "Parent station_<n>_*.glb's root under lab_shell's Station_n node with an identity transform: "
                 "Station_n's front (glTF +Z) faces the camera path, the same as these props.",
    "conventions": [
        "Pivots: every node's origin is its animation centre (panels and cards: their centre; chart bars: "
        "the bar bottom; arrows: the tail or midpoint as noted; rings: the shared centre).",
        "Nodes with extras.float_bob = true are meant to bob/float.",
        "*_Screen nodes are flat UV 0-1 faces using the 'Screen' material (dark, emissive black): set "
        "emissive to white and use the UI texture as emissiveMap.",
        "Multi-material meshes load in three.js as a Group named after the node with child meshes "
        "<name>_1, <name>_2...; animate the named Group.",
        "Holo_Green is alpha 0.35 BLEND.",
    ],
    "assets": [],
}
for A in assets:
    entry = {"file": A.file, "root": A.root.name, "tris": A.tris(), "anchors": A.anchors,
             "nodes": A.manifest_nodes()}
    if hasattr(A, "joints"):
        entry["joints"] = A.joints
    manifest["assets"].append(entry)
write_json(os.path.join(EXPORT_DIR, "stations.manifest.json"), manifest)
print({A.file: A.tris() for A in assets})
