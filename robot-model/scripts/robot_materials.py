"""PBR material system for the robot (separate from geometry). Colours are linear RGB."""
import bpy


def _set(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def principled(name, base, rough, metal=0.0, coat=0.0, coat_rough=0.1, spec=0.5,
               emit=None, emit_str=0.0, variation=0.0, var_scale=6.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in [n for n in nt.nodes if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL')]:
        nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    rgba = (*base, 1.0)
    _set(bsdf, "Base Color", rgba)
    _set(bsdf, "Roughness", rough)
    _set(bsdf, "Metallic", metal)
    _set(bsdf, "Specular IOR Level", spec)
    _set(bsdf, "Coat Weight", coat)
    _set(bsdf, "Coat Roughness", coat_rough)
    if emit:
        _set(bsdf, "Emission Color", (*emit, 1.0))
        _set(bsdf, "Emission Strength", emit_str)
    if variation > 0:
        # subtle large-scale brightness variation (no dirt, no grain)
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = var_scale
        noise.inputs['Detail'].default_value = 1.0
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        lo = tuple(c * (1 - variation) for c in base)
        hi = tuple(min(1.0, c * (1 + variation)) for c in base)
        ramp.color_ramp.elements[0].color = (*lo, 1)
        ramp.color_ramp.elements[1].color = (*hi, 1)
        nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
        noise.location, ramp.location = (-700, 200), (-450, 200)
    m.diffuse_color = rgba  # viewport solid colour
    return m


def add_center_glow(m, width=0.16, strength=0.35, color=(0.25, 0.85, 0.55)):
    """Soft emissive streak along the panel's centre line (x = 0), as in the reference."""
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = 0.0, width
    mr.inputs['To Min'].default_value, mr.inputs['To Max'].default_value = strength, 0.0
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs['X'], ab.inputs[0])
    nt.links.new(ab.outputs[0], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], bsdf.inputs['Emission Strength'])
    bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
    for n, x in ((tc, -1100), (sep, -900), (ab, -700), (mr, -500)):
        n.location = (x, -300)
    return m


def add_z_gradient(m, z0, z1, c0, c1):
    """Base colour c0 at object Z >= z0 fading to c1 at Z <= z1 (the glass is lighter toward the chin)."""
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = z0, z1
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*c0, 1)
    ramp.color_ramp.elements[1].color = (*c1, 1)
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    for n, x in ((tc, -1100), (sep, -900), (mr, -700), (ramp, -450)):
        n.location = (x, 200)
    return m


def build_materials():
    return {
        "white": principled("MAT_WhitePolymer", (0.80, 0.80, 0.78), 0.30, coat=0.35, coat_rough=0.12),
        "white_lower": principled("MAT_WhitePolymer_Lower", (0.78, 0.78, 0.765), 0.36, coat=0.25, coat_rough=0.15),
        "seam": principled("MAT_SeamCore", (0.42, 0.43, 0.44), 0.5),
        "glass": principled("MAT_FaceGlass", (0.002, 0.0022, 0.003), 0.14, coat=0.0, spec=0.25),
        "bezel": principled("MAT_BezelCharcoal", (0.018, 0.022, 0.034), 0.28, metal=0.55),
        "green": principled("MAT_GreenPanel", (0.003, 0.17, 0.06), 0.42, coat=0.0, spec=0.25,
                            variation=0.12, var_scale=4.0),
        "green_module": principled("MAT_GreenModule", (0.014, 0.20, 0.08), 0.34, coat=0.2, coat_rough=0.25),
        "green_emblem": principled("MAT_EmblemGreen", (0.006, 0.26, 0.11), 0.3, coat=0.3, coat_rough=0.15,
                                   variation=0.06, var_scale=3.0),
        "eye": principled("MAT_EyeEmission", (0.02, 0.24, 0.12), 0.25, emit=(0.025, 0.30, 0.16), emit_str=0.55,
                          variation=0.15, var_scale=8.0),
        "trace": principled("MAT_CircuitTrace", (0.50, 0.80, 0.66), 0.4, emit=(0.55, 0.95, 0.75), emit_str=0.08),
        "eye_trace": principled("MAT_EyeTrace", (0.9, 1.0, 0.95), 0.3, emit=(0.85, 1.0, 0.92), emit_str=1.2),
        "dark": principled("MAT_DarkMech", (0.012, 0.012, 0.014), 0.32, metal=0.35, coat=0.3, coat_rough=0.2),
        "dark_joint": principled("MAT_DarkMechJoint", (0.03, 0.03, 0.034), 0.25, metal=0.7),
    }


ASSIGN = {
    "Head_OuterShell": "white", "Face_Display": "glass", "Face_Bezel": "bezel",
    "Top_CircuitPanel": "green", "Top_CircuitTraces": "trace",
    "Left_SideModule": "green_module", "Right_SideModule": "green_module",
    "Eye_Left": "eye", "Eye_Right": "eye", "Eye_CircuitDetails": "eye_trace",
    "Body_MainShell": "seam", "Chest_UpperArmor": "white", "Body_LowerShell": "white_lower",
    "Neck_Joint": "dark_joint",
    "Emblem_OuterHousing": "white", "Emblem_GreenInsert": "green_emblem", "Emblem_WhiteSymbol": "white",
}
PREFIX = [("Arm_", "_Shoulder", "white"), ("Arm_", "_Upper", "white"), ("Arm_", "_Wrist", "dark_joint"),
          ("Hand_", "", "dark")]


def assign_all():
    M = build_materials()
    add_center_glow(M["green"])
    add_z_gradient(M["glass"], 2.38, 2.18, (0.0015, 0.0017, 0.0022), (0.012, 0.013, 0.016))
    for o in bpy.data.collections["Robot_Master"].all_objects:
        if o.type != 'MESH':
            continue
        key = ASSIGN.get(o.name)
        if key is None:
            for pre, suf, k in PREFIX:
                if o.name.startswith(pre) and o.name.endswith(suf):
                    key = k
                    break
        if key:
            o.data.materials.clear()
            o.data.materials.append(M[key])
    return M
