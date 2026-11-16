"""M2-00 / M3-00 / M4-00: robot clips B+C+D, then re-export robot_high.glb / robot_low.glb.

Idempotent: reopens robot_rig2.blend (built by lod_export.py: LODs, packed textures, clips A),
(re)builds the 12 clips below, rebuilds the muted NLA tracks for all 16 clips, saves robot_rig2.blend,
exports both LODs through lod_export.export_all() and adds loop flags + notes to export/manifest.json.

Usage inside Blender:
    import sys; sys.path.insert(0, r"<this folder>")
    import clips_bcd as C; C.main()

Pose values are degrees added to each joint's rest rotation (Blender local XYZ Euler), written for the
side they are used on. Directions (Blender): the robot faces -Y, robot left = +X.
  Shoulder X < 0 swings the arm forward; Shoulder Y raises it sideways (L: negative, R: positive).
  Upper (elbow) X < 0 bends the forearm forward/up. Wrist Z twists the forearm.
  Head/Neck Z > 0 turns the face to robot-left (screen right); Head X > 0 looks down; Head Y tilts.
  Finger curl about local Y: L positive, R negative.
"""
import json
import math
import os

import bpy

import lod_export as L

D = math.radians
FPS = L.FPS
FINGERS = ("Finger_1", "Finger_2", "Finger_3", "Finger_4", "Thumb")
OLD = ("Idle", "Sleep", "WakeUp", "Wave")


def curl(side, amounts):
    """{Finger_n_<side>: (0, curl, 0)} with the side's sign; amounts for Finger_1..4, Thumb."""
    s = 1 if side == "L" else -1
    return {f"{f}_{side}": (0, s * a, 0) for f, a in zip(FINGERS, amounts)}


def both(pose_l, mirror=True):
    """Mirror an _L pose dict to _R (Y and Z flip sign) and return both."""
    out = dict(pose_l)
    for k, (x, y, z) in pose_l.items():
        if k.endswith("_L"):
            out[k[:-2] + "_R"] = (x, -y, -z) if mirror else (x, y, z)
    return out


# ---------------------------------------------------------------- clip table
# Each clip: (frames, loop, notes, [(frame, {joint: (rx, ry, rz)} , {joint: (dx, dy, dz) location})])
# grid-searched within the limits for the closest hands with palms facing: palm centres end ~1.5 apart
# (shoulder inward is capped at 10 deg and the elbow at 30 deg, so the brief's 0.5 is out of reach)
CHARGE = both({"Shoulder_L": (-55, 10, 0), "Upper_L": (-25, 30, 0), "Wrist_L": (0, 0, -30), "Palm_L": (-30, -30, 0),
               **curl("L", (22, 26, 30, 34, 15))})
CHARGE["Head"] = (7, 0, 0)
OPEN = both({"Shoulder_L": (-25, -115, 0), "Upper_L": (-10, -15, 0), "Palm_L": (0, 0, 0),
             **curl("L", (0, 0, 0, 0, 0))})
OPEN.update({"Head": (-10, 0, 0), "Torso": (-6, 0, 0)})
FLY = both({"Shoulder_L": (32, -12, 0), "Upper_L": (10, 0, 0), **curl("L", (20, 25, 30, 35, 10))})
FLY.update({"Torso": (15, 0, 0), "Head": (-14, 0, 0)})
POINT_FINGERS = curl("R", (0, 80, 85, 88, 55))
DRAW_FINGERS = curl("R", (0, 75, 80, 85, 45))
THINK = {"Shoulder_R": (-62, -10, 0), "Upper_R": (-45, -30, 0), "Wrist_R": (0, 0, -40), "Palm_R": (20, 0, 0),
         **curl("R", (35, 45, 55, 60, 20))}
GRAB_REACH = both({"Shoulder_L": (-68, 6, 0), "Upper_L": (-12, 15, 0), **curl("L", (0, 0, 0, 0, 0))})
GRAB_CLOSE = both({"Shoulder_L": (-68, 6, 0), "Upper_L": (-12, 15, 0), **curl("L", (75, 80, 85, 85, 60))})
# arms in a V: straight up (Y -160) went through the head's side modules
CELEB = both({"Shoulder_L": (-25, -135, 0), "Upper_L": (0, -30, 0), **curl("L", (0, 0, 0, 0, 0))})
CELEB["Head"] = (-12, 0, 0)


def rest_of(pose):
    return {k: (0, 0, 0) for k in pose}


def merge(*ds):
    out = {}
    for d in ds:
        out.update(d)
    return out


def clips():
    c = {}
    # LookAround 3.0 s: head (with neck) left, right, up; eyes lead.
    eyes = lambda x, z: {"Eye_L": (x, 0, z), "Eye_R": (x, 0, z)}
    look_rest = merge({"Head": (0, 0, 0), "Neck": (0, 0, 0)}, eyes(0, 0))
    c["LookAround"] = (90, False, "head+neck yaw left/right then up; eyes lead the head", [
        (0, look_rest, {}),
        (8, merge(eyes(0, 9)), {}),
        (16, merge({"Head": (0, 0, 28), "Neck": (0, 0, 12)}, eyes(0, 6)), {}),
        (26, merge({"Head": (0, 0, 28), "Neck": (0, 0, 12)}), {}),
        (34, merge(eyes(0, -9)), {}),
        (46, merge({"Head": (0, 0, -28), "Neck": (0, 0, -12)}, eyes(0, -6)), {}),
        (56, merge({"Head": (0, 0, -28), "Neck": (0, 0, -12)}), {}),
        (62, merge(eyes(-8, 0)), {}),
        (70, merge({"Head": (-16, 0, 0), "Neck": (-6, 0, 0)}, eyes(-6, 0)), {}),
        (78, merge({"Head": (-16, 0, 0), "Neck": (-6, 0, 0)}), {}),
        (90, look_rest, {}),
    ])
    # Draw 1.6 s: right arm level at shoulder height sweeps from the side to straight ahead, index out,
    # palm turned to lead the motion; head and eyes track the hand.
    arm = lambda a: {"Shoulder_R": (a, 90, 0), "Upper_R": (-12, 0, 0), "Wrist_R": (0, 0, -90)}
    draw_rest = merge(rest_of(arm(0)), rest_of(DRAW_FINGERS), {"Head": (0, 0, 0)}, rest_of(eyes(0, 0)))
    c["Draw"] = (48, False, "right arm level, sweeps side -> front (Shoulder_R X -28 -> -86 at Y 90); "
                            "palm leads; head tracks", [
        (0, draw_rest, {}),
        (11, merge(arm(-28), DRAW_FINGERS, {"Head": (4, 0, -30)}, eyes(0, -8)), {}),
        (14, merge(arm(-30), {"Head": (4, 0, -30)}), {}),
        (36, merge(arm(-86), {"Head": (4, 0, -4)}, eyes(0, 2)), {}),
        (39, merge(arm(-86), {"Head": (4, 0, -4)}), {}),
        (48, draw_rest, {}),
    ])
    # ChargeEnergy 2.0 s: arms rise in front of the chest, palms face each other; hold the last 1 s with a
    # slight tremble. Ends in the held pose (not rest) so OpenPortal can follow.
    trem = []
    for k, f in enumerate(range(32, 61, 4)):
        a = 1.5 if k % 2 else -1.5
        trem.append((f, {"Palm_L": (-30 + a, -30, 0), "Palm_R": (-30 - a, 30, 0)}, {}))
    trem[-1] = (60, CHARGE, {})
    c["ChargeEnergy"] = (60, False, "rest -> charge pose by 0.8 s, held to 2.0 s with a palm tremble; "
                                    "ENDS in the charge pose (palm centres ~1.5 apart: inward shoulder/elbow limits)", [
        (0, rest_of(CHARGE), {}),
        (24, CHARGE, {}),
        (30, CHARGE, {}),
        *trem,
    ])
    # OpenPortal 2.0 s: from the charge pose, arms sweep outward and up, chest out, then back to rest.
    c["OpenPortal"] = (60, False, "STARTS in the ChargeEnergy end pose -> arms sweep out/up (0.8 s), hold, "
                                  "back to rest at 2.0 s", [
        (0, merge(rest_of(OPEN), CHARGE), {"Torso": (0, 0, 0)}),
        (24, OPEN, {"Torso": (0, 0, 0.03)}),
        (42, OPEN, {"Torso": (0, 0, 0.03)}),
        (60, merge(rest_of(OPEN), rest_of(CHARGE)), {"Torso": (0, 0, 0)}),
    ])
    # Fly 2.4 s loop: pitched forward (Torso X 15 = limit), arms back, float bob and slight arm sway.
    fly = []
    for f in range(0, 73, 6):
        t = f / 72
        bob = 0.05 * math.sin(2 * math.pi * t)
        sway = 4 * math.sin(2 * math.pi * t + 0.8)
        p = dict(FLY)
        p["Shoulder_L"] = (32 + sway, -12, 0)
        p["Shoulder_R"] = (32 + sway, 12, 0)
        fly.append((f, p, {"Torso": (0, 0, bob)}))
    c["Fly"] = (72, True, "loop; Torso pitched +15 deg (its limit; brief asked ~25: add the rest on a parent "
                          "group in-app), arms back, bob 0.05", fly)
    # Present 1.6 s: right arm forward-out, palm up, small head nod toward it.
    # wrist/palm values from a grid search for the most upward palm normal at this arm pose
    pres = {"Shoulder_R": (-55, 48, 0), "Upper_R": (-25, 0, 0), "Wrist_R": (0, 0, -90), "Palm_R": (-45, 0, 0),
            **curl("R", (8, 10, 12, 14, 0))}
    c["Present"] = (48, False, "right arm forward and out, palm up (forward toward the camera, slightly to "
                               "the robot's right); head looks at it and nods", [
        (0, merge(rest_of(pres), {"Head": (0, 0, 0)}), {}),
        (16, merge(pres, {"Head": (6, 0, -12)}), {}),
        (22, {"Head": (12, 0, -12)}, {}),
        (28, {"Head": (5, 0, -12)}, {}),
        (36, merge(pres, {"Head": (6, 0, -12)}), {}),
        (48, merge(rest_of(pres), {"Head": (0, 0, 0)}), {}),
    ])
    # Point 1.4 s: right arm forward-right, Finger_1 straight, the rest curled.
    pt = merge({"Shoulder_R": (-50, 82, 0), "Upper_R": (-6, 0, 0)}, POINT_FINGERS)
    c["Point"] = (42, False, "right arm level, 40 deg out from straight ahead (robot right = screen left); "
                             "Finger_1 straight, others curled; head + torso turn to it", [
        (0, merge(rest_of(pt), {"Head": (0, 0, 0), "Torso": (0, 0, 0)}), {}),
        (12, merge(pt, {"Head": (3, 0, -24), "Torso": (0, 0, -8)}), {}),
        (32, merge(pt, {"Head": (3, 0, -24), "Torso": (0, 0, -8)}), {}),
        (42, merge(rest_of(pt), {"Head": (0, 0, 0), "Torso": (0, 0, 0)}), {}),
    ])
    # Thinking 2.5 s loop: hand near the chin, head tilt 8 deg, slow sway.
    think = []
    for f in range(0, 76, 15):
        t = f / 75
        sw = math.sin(2 * math.pi * t)
        p = dict(THINK)
        p["Head"] = (5, 8 + 2 * sw, -6)
        p["Torso"] = (0, 0, 3 * sw)
        think.append((f, p, {}))
    c["Thinking"] = (75, True, "loop; right hand up by the chin, head tilt 8 deg, torso sway 3 deg", think)
    # Grab 1.2 s: both hands reach forward open, fingers close, back to rest.
    c["Grab"] = (36, False, "both arms reach forward, fingers close at 0.6-0.73 s, return to rest", [
        (0, rest_of(GRAB_CLOSE), {}),
        (12, GRAB_REACH, {}),
        (16, GRAB_REACH, {}),
        (22, GRAB_CLOSE, {}),
        (26, GRAB_CLOSE, {}),
        (36, rest_of(GRAB_CLOSE), {}),
    ])
    # React 0.5 s: quick head tilt + small hop.
    c["React"] = (15, False, "head tilt 8 deg + 0.03 hop", [
        (0, {"Head": (0, 0, 0)}, {"Torso": (0, 0, 0)}),
        (4, {"Head": (-3, 8, 0)}, {"Torso": (0, 0, 0.03)}),
        (9, {"Head": (-2, 8, 0)}, {"Torso": (0, 0, 0)}),
        (15, {"Head": (0, 0, 0)}, {"Torso": (0, 0, 0)}),
    ])
    # Celebrate 2.0 s: both arms up, fingers open, three small bounces.
    cel = [(0, rest_of(CELEB), {"Torso": (0, 0, 0)}), (12, CELEB, {"Torso": (0, 0, 0)})]
    for f in (18, 30, 42):
        cel += [(f, {}, {"Torso": (0, 0, 0.05)}), (f + 6, {}, {"Torso": (0, 0, 0)})]
    cel += [(48, CELEB, {}), (60, rest_of(CELEB), {"Torso": (0, 0, 0)})]
    c["Celebrate"] = (60, False, "both arms up, 3 bounces of 0.05", cel)
    # Guide 2.0 s: right arm sweeps from front to the robot's right side, palm open forward; head follows.
    g = lambda a: {"Shoulder_R": (a, 90, 0), "Upper_R": (-8, 0, 0), "Wrist_R": (0, 0, -90),
                   **curl("R", (5, 6, 8, 10, 0))}
    g_rest = merge(rest_of(g(0)), {"Head": (0, 0, 0)})
    c["Guide"] = (60, False, "right arm level sweeps front -> robot right (screen left), open palm forward; "
                             "head follows then returns", [
        (0, g_rest, {}),
        (14, merge(g(-80), {"Head": (0, 0, -6)}), {}),
        (34, merge(g(-14), {"Head": (0, 0, -32)}), {}),
        (44, merge(g(-14), {"Head": (0, 0, -32)}), {}),
        (52, {"Head": (0, 0, -10)}, {}),
        (60, g_rest, {}),
    ])
    return c


# ---------------------------------------------------------------- build
def build():
    L.reset_rest()
    rest_rot = {o.name: tuple(o.rotation_euler) for o in bpy.data.collections["Robot_Master"].all_objects
                if o.type == 'EMPTY'}
    rest_loc = {o.name: tuple(o.location) for o in bpy.data.collections["Robot_Master"].all_objects
                if o.type == 'EMPTY'}
    table = clips()
    acts = []
    for name, (n, loop, note, keys) in table.items():
        act = L._new_action(name)
        for f, rot, loc in keys:
            assert 0 <= f <= n, (name, f)
            for j, r in rot.items():
                rr = rest_rot[j]
                L._key(act, j, "rotation_euler", tuple(rr[i] + D(r[i]) for i in range(3)), f)
            for j, d in loc.items():
                rl = rest_loc[j]
                L._key(act, j, "location", tuple(rl[i] + d[i] for i in range(3)), f)
        for fc in L._fcurves(act):
            for k in fc.keyframe_points:
                k.interpolation = 'BEZIER'
                k.handle_left_type = k.handle_right_type = 'AUTO_CLAMPED'
            fc.update()
        acts.append(act)
        L.reset_rest()
    rebuild_nla([bpy.data.actions[a] for a in OLD] + acts)
    L.reset_rest()
    return table


def rebuild_nla(actions):
    """One muted NLA track per (clip, object): the exporter's ACTIONS mode finds clips through these."""
    for o in bpy.data.objects:
        if o.animation_data:
            o.animation_data.action = None
            for tr in list(o.animation_data.nla_tracks):
                o.animation_data.nla_tracks.remove(tr)
    for a in actions:
        for slot in a.slots:
            o = bpy.data.objects[slot.identifier[2:]]
            ad = o.animation_data or o.animation_data_create()
            tr = ad.nla_tracks.new()
            tr.name, tr.mute = a.name, True
            st = tr.strips.new(a.name, 0, a)
            st.action_slot = slot


def check_limits(table):
    """Every keyed rotation stays inside the joint's limits (sampled per frame, so overshoot counts)."""
    bad = []
    for name in table:
        act = bpy.data.actions[name]
        for slot in act.slots:
            o = bpy.data.objects[slot.identifier[2:]]
            lim = json.loads(o.get("joint_limits_deg", "{}"))
            rest = o.rotation_euler.copy()
            for layer in act.layers:
                for st in layer.strips:
                    cb = st.channelbag(slot)
                    if not cb:
                        continue
                    for fc in cb.fcurves:
                        if fc.data_path != "rotation_euler":
                            continue
                        ax = "XYZ"[fc.array_index]
                        lo, hi = lim.get(ax, (0, 0))
                        f0, f1 = fc.range()
                        for f in range(int(f0), int(f1) + 1):
                            v = math.degrees(fc.evaluate(f) - rest[fc.array_index])
                            if v < lo - 0.5 or v > hi + 0.5:
                                bad.append((name, o.name, ax, f, round(v, 1), (lo, hi)))
                                break
    return bad


def main(open_rig=True):
    if open_rig:
        bpy.ops.wm.open_mainfile(filepath=L.RIG2)
    table = build()
    bad = check_limits(table)
    if bad:
        raise RuntimeError(f"joint limits exceeded: {bad[:10]}")
    with L.win_ctx():
        bpy.ops.wm.save_mainfile()
    L.LOOP.update({n: loop for n, (_, loop, _, _) in table.items()})
    tris, lods, man_clips = L.export_all()
    path = os.path.join(L.EXP, "manifest.json")
    with open(path) as f:
        man = json.load(f)
    man["source"] = ("robot_rig2.blend (scripts/lod_export.py, clips B-D by scripts/clips_bcd.py) -> "
                     "robot_high.glb, robot_low.glb")
    man["clip_notes"].update({n: note for n, (_, _, note, _) in table.items()})
    man["clip_notes"]["rest"] = ("non-looping clips start and end at rest, except ChargeEnergy (ends in its "
                                 "held pose) and OpenPortal (starts from that pose)")
    with open(path, "w") as f:
        json.dump(man, f, indent=2)
    return tris, lods, [(c["name"], c["duration_s"], c["loop"]) for c in man["clips"]]
