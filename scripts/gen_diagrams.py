#!/usr/bin/env python3
"""Generate theme-aware technical SVG diagrams for README.md."""

import math
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "assets"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

THEMES = {
    "light": {
        "bg": "#f8f9fb",
        "border": "#dfe3e8",
        "divider": "#e6e9ee",
        "ink": "#16181d",
        "muted": "#646b78",
        "grid": "#e2e6ec",
        "x": "#d63d2e",
        "y": "#1f8a4c",
        "z": "#2264c4",
        "start": "#7e8796",
        "sector_alpha": 0.14,
    },
    "dark": {
        "bg": "#161b22",
        "border": "#30363d",
        "divider": "#262c36",
        "ink": "#e6edf3",
        "muted": "#8b949e",
        "grid": "#232a35",
        "x": "#e66558",
        "y": "#45b572",
        "z": "#5798ec",
        "start": "#7d8590",
        "sector_alpha": 0.18,
    },
}


# ── Linear algebra helpers ───────────────────────────────────────────────────
def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def mul(v, s):
    return (v[0] * s, v[1] * s, v[2] * s)


def norm(v):
    return math.sqrt(dot(v, v))


def normalize(v):
    n = norm(v)
    return (v[0] / n, v[1] / n, v[2] / n) if n > 1e-12 else (0.0, 0.0, 0.0)


def rot_axis(v, axis, deg):
    """Rodrigues' rotation formula for right-handed axis rotation."""
    t = math.radians(deg)
    k = normalize(axis)
    c = math.cos(t)
    s = math.sin(t)
    kxv = cross(k, v)
    kdv = dot(k, v)
    return (
        v[0] * c + kxv[0] * s + k[0] * kdv * (1.0 - c),
        v[1] * c + kxv[1] * s + k[1] * kdv * (1.0 - c),
        v[2] * c + kxv[2] * s + k[2] * kdv * (1.0 - c),
    )


# ── 2D SVG helpers ───────────────────────────────────────────────────────────
def f2(x):
    return f"{x:.2f}"


def arrow_poly(p_from, p_to, length=8.5, width=3.4, color="#000", opacity=1.0):
    dx = p_to[0] - p_from[0]
    dy = p_to[1] - p_from[1]
    d = math.hypot(dx, dy)
    if d < 1e-6:
        return ""
    ux, uy = dx / d, dy / d
    px, py = -uy, ux
    bx = p_to[0] - ux * length
    by = p_to[1] - uy * length
    p1 = (p_to[0], p_to[1])
    p2 = (bx + px * width, by + py * width)
    p3 = (bx - px * width, by - py * width)
    op = f' fill-opacity="{opacity}"' if opacity < 1.0 else ""
    return (
        f'<polygon points="{f2(p1[0])},{f2(p1[1])} '
        f'{f2(p2[0])},{f2(p2[1])} {f2(p3[0])},{f2(p3[1])}" '
        f'fill="{color}"{op}/>'
    )


def trimmed_line_and_arrow(p_from, p_to, stroke_w, color, length=8.5, width=3.4, opacity=1.0, dash=""):
    dx = p_to[0] - p_from[0]
    dy = p_to[1] - p_from[1]
    d = math.hypot(dx, dy)
    if d < 1e-6:
        return ""
    trim = max(0.0, d - length * 0.72)
    ux, uy = dx / d, dy / d
    ex = p_from[0] + ux * trim
    ey = p_from[1] + uy * trim
    op = f' stroke-opacity="{opacity}"' if opacity < 1.0 else ""
    da = f' stroke-dasharray="{dash}"' if dash else ""
    line = (
        f'<line x1="{f2(p_from[0])}" y1="{f2(p_from[1])}" '
        f'x2="{f2(ex)}" y2="{f2(ey)}" '
        f'stroke="{color}" stroke-width="{stroke_w}" stroke-linecap="round"{op}{da}/>'
    )
    head = arrow_poly(p_from, p_to, length=length, width=width, color=color, opacity=opacity)
    return line + "\n" + head


def sub_text(base, sub_str):
    return f'{base}<tspan dy="3" font-size="78%">{sub_str}</tspan><tspan dy="-3">&#8203;</tspan>'


# ── Rotation Sequence Diagram (3 panels, 960x320) ────────────────────────────
def build_rotation_sequence(theme_name, pal):
    W, H = 960, 320
    PW = 320

    # Right-handed Y-up perspective camera
    C = (5.2, 3.6, 6.6)
    T = (0.72, 0.55, 0.25)
    fov = math.radians(36.0)
    fwd = normalize(sub(T, C))
    right = normalize(cross(fwd, (0.0, 1.0, 0.0)))
    up = cross(right, fwd)
    f_scale = (224.0 * 0.5) / math.tan(fov * 0.5)

    def proj(p, panel_idx):
        cx = panel_idx * PW + 156.0
        cy = 166.0
        rel = sub(p, C)
        rx = dot(rel, right)
        ry = dot(rel, up)
        rz = dot(rel, fwd)
        sx = cx + (rx / rz) * f_scale
        sy = cy - (ry / rz) * f_scale
        return (sx, sy)

    v0 = (2.0, 1.0, 1.0)
    v1 = rot_axis(v0, (1.0, 0.0, 0.0), 30.0)
    v2 = rot_axis(v1, (0.0, 1.0, 0.0), 45.0)
    v3 = rot_axis(v2, (0.0, 0.0, 1.0), 60.0)

    panels = [
        {
            "title": f'1. Rotate around X (<tspan fill="{pal["x"]}">θ</tspan><tspan fill="{pal["x"]}" dy="2.5" font-size="80%">x</tspan><tspan dy="-2.5"> = 30°</tspan>)',
            "axis_key": "x",
            "axis_vec": (1.0, 0.0, 0.0),
            "deg": 30.0,
            "v_start": v0,
            "v_end": v1,
            "start_lbl": ('v', '0'),
            "end_lbl": ('v', '1'),
            "end_color": pal["x"],
            "arc_color": pal["x"],
            "caption": "v₁ = Rₓ v₀ = (2.000, 0.366, 1.366)",
            "start_off": (10, -8),
            "end_off": (8, 13),
            "deg_off": (17, -1),
        },
        {
            "title": f'2. Rotate around Y (<tspan fill="{pal["y"]}">θ</tspan><tspan fill="{pal["y"]}" dy="2.5" font-size="80%">y</tspan><tspan dy="-2.5"> = 45°</tspan>)',
            "axis_key": "y",
            "axis_vec": (0.0, 1.0, 0.0),
            "deg": 45.0,
            "v_start": v1,
            "v_end": v2,
            "start_lbl": ('v', '1'),
            "end_lbl": ('v', '2'),
            "end_color": pal["y"],
            "arc_color": pal["y"],
            "caption": "v₂ = Rᵧ v₁ = (2.380, 0.366, −0.448)",
            "start_off": (8, 12),
            "end_off": (10, -4),
            "deg_off": (14, 12),
        },
        {
            "title": f'3. Rotate around Z (<tspan fill="{pal["z"]}">θ</tspan><tspan fill="{pal["z"]}" dy="2.5" font-size="80%">z</tspan><tspan dy="-2.5"> = 60°</tspan>)',
            "axis_key": "z",
            "axis_vec": (0.0, 0.0, 1.0),
            "deg": 60.0,
            "v_start": v2,
            "v_end": v3,
            "start_lbl": ('v', '2'),
            "end_lbl": ('v′', ''),
            "end_color": pal["ink"],
            "arc_color": pal["z"],
            "caption": "v′ = R_z v₂ = (0.873, 2.244, −0.448)".replace("R_z", "R\u209b"),  # placeholder fixed below
            "start_off": (10, 4),
            "end_off": (-16, -6),
            "deg_off": (14, -4),
        },
    ]

    # Use clean SVG tspan captions so no missing Unicode subscript glyphs occur on any OS
    captions = [
        f'v<tspan dy="2.5" font-size="78%">1</tspan><tspan dy="-2.5"> = R</tspan><tspan dy="2.5" font-size="78%">x</tspan><tspan dy="-2.5">v</tspan><tspan dy="2.5" font-size="78%">0</tspan><tspan dy="-2.5"> = (2.000, 0.366, 1.366)</tspan>',
        f'v<tspan dy="2.5" font-size="78%">2</tspan><tspan dy="-2.5"> = R</tspan><tspan dy="2.5" font-size="78%">y</tspan><tspan dy="-2.5">v</tspan><tspan dy="2.5" font-size="78%">1</tspan><tspan dy="-2.5"> = (2.380, 0.366, −0.448)</tspan>',
        f'v′ = R<tspan dy="2.5" font-size="78%">z</tspan><tspan dy="-2.5">v</tspan><tspan dy="2.5" font-size="78%">2</tspan><tspan dy="-2.5"> = (0.873, 2.244, −0.448)</tspan>',
    ]

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" rx="8" fill="{pal["bg"]}" stroke="{pal["border"]}"/>',
        f'<line x1="{PW}" y1="16" x2="{PW}" y2="{H-16}" stroke="{pal["divider"]}"/>',
        f'<line x1="{PW*2}" y1="16" x2="{PW*2}" y2="{H-16}" stroke="{pal["divider"]}"/>',
    ]

    axes_def = [
        ("x", (1.0, 0.0, 0.0), 2.75, (-0.5, 0.0, 0.0), (10, 4)),
        ("y", (0.0, 1.0, 0.0), 2.55, (0.0, -0.4, 0.0), (10, -2)),
        ("z", (0.0, 0.0, 1.0), 2.70, (0.0, 0.0, -0.5), (-11, 5)),
    ]

    for idx, p in enumerate(panels):
        cx_panel = idx * PW + PW * 0.5
        parts.append(
            f'<text x="{f2(cx_panel)}" y="27" text-anchor="middle" '
            f'font-family="{SANS}" font-size="12.5" font-weight="600" fill="{pal["ink"]}">{p["title"]}</text>'
        )

        # Ground XZ grid (-1..2)
        for g in (-1, 0, 1, 2):
            if g != 0:
                a1, a2 = proj((-1, 0, g), idx), proj((2, 0, g), idx)
                b1, b2 = proj((g, 0, -1), idx), proj((g, 0, 2), idx)
                parts.append(f'<line x1="{f2(a1[0])}" y1="{f2(a1[1])}" x2="{f2(a2[0])}" y2="{f2(a2[1])}" stroke="{pal["grid"]}" stroke-width="1"/>')
                parts.append(f'<line x1="{f2(b1[0])}" y1="{f2(b1[1])}" x2="{f2(b2[0])}" y2="{f2(b2[1])}" stroke="{pal["grid"]}" stroke-width="1"/>')

        o2d = proj((0.0, 0.0, 0.0), idx)

        # Axes (inactive first, active on top)
        ordered_axes = sorted(axes_def, key=lambda item: item[0] == p["axis_key"])
        for akey, avec, alen, aneg, albl_off in ordered_axes:
            is_act = akey == p["axis_key"]
            op = 0.95 if is_act else 0.36
            sw = 1.5 if is_act else 1.15
            col = pal[akey]
            neg2d = proj(aneg, idx)
            pos2d = proj(mul(avec, alen), idx)
            parts.append(
                f'<line x1="{f2(neg2d[0])}" y1="{f2(neg2d[1])}" x2="{f2(o2d[0])}" y2="{f2(o2d[1])}" '
                f'stroke="{col}" stroke-width="1.1" stroke-dasharray="3 3" stroke-opacity="{0.35 if is_act else 0.2}"/>'
            )
            parts.append(trimmed_line_and_arrow(o2d, pos2d, sw, col, length=6.5, width=2.5, opacity=op))
            parts.append(
                f'<text x="{f2(pos2d[0] + albl_off[0])}" y="{f2(pos2d[1] + albl_off[1])}" '
                f'text-anchor="middle" font-family="{MONO}" font-size="11" font-style="italic" font-weight="600" '
                f'fill="{col}" fill-opacity="{1.0 if is_act else 0.6}">{akey}</text>'
            )

        # Rotation center, sector, and arc
        av = p["axis_vec"]
        vs = p["v_start"]
        ve = p["v_end"]
        center3d = mul(av, dot(vs, av))
        c2d = proj(center3d, idx)
        vs2d = proj(vs, idx)
        ve2d = proj(ve, idx)

        n_seg = 32
        arc3d = [rot_axis(vs, av, p["deg"] * i / n_seg) for i in range(n_seg + 1)]
        arc2d = [proj(pt, idx) for pt in arc3d]
        poly_pts = " ".join(f"{f2(pt[0])},{f2(pt[1])}" for pt in ([c2d] + arc2d))
        parts.append(f'<polygon points="{poly_pts}" fill="{p["arc_color"]}" fill-opacity="{pal["sector_alpha"]}"/>')

        # Dashed radius lines from projection center on axis
        parts.append(
            f'<line x1="{f2(c2d[0])}" y1="{f2(c2d[1])}" x2="{f2(vs2d[0])}" y2="{f2(vs2d[1])}" '
            f'stroke="{p["arc_color"]}" stroke-width="1" stroke-dasharray="2.5 2.5" stroke-opacity="0.55"/>'
        )
        parts.append(
            f'<line x1="{f2(c2d[0])}" y1="{f2(c2d[1])}" x2="{f2(ve2d[0])}" y2="{f2(ve2d[1])}" '
            f'stroke="{p["arc_color"]}" stroke-width="1" stroke-dasharray="2.5 2.5" stroke-opacity="0.65"/>'
        )
        parts.append(f'<circle cx="{f2(c2d[0])}" cy="{f2(c2d[1])}" r="2.3" fill="{p["arc_color"]}"/>')

        # Smooth arc path (trimmed slightly before last point so arrowhead hits v_end cleanly)
        arc_path = "M " + " L ".join(f"{f2(pt[0])},{f2(pt[1])}" for pt in arc2d[:-1])
        parts.append(f'<path d="{arc_path}" fill="none" stroke="{p["arc_color"]}" stroke-width="1.7" stroke-linecap="round"/>')
        parts.append(arrow_poly(arc2d[-3], arc2d[-1], length=6.5, width=2.6, color=p["arc_color"]))

        # Angle value label near arc midpoint
        mid_arc = arc2d[n_seg // 2]
        parts.append(
            f'<text x="{f2(mid_arc[0] + p["deg_off"][0])}" y="{f2(mid_arc[1] + p["deg_off"][1])}" '
            f'text-anchor="middle" font-family="{MONO}" font-size="10.5" font-weight="600" fill="{p["arc_color"]}">{int(p["deg"])}°</text>'
        )

        # Start vector (dashed) & End vector (solid)
        parts.append(
            f'<line x1="{f2(o2d[0])}" y1="{f2(o2d[1])}" x2="{f2(vs2d[0])}" y2="{f2(vs2d[1])}" '
            f'stroke="{pal["start"]}" stroke-width="1.7" stroke-dasharray="4 3" stroke-linecap="round"/>'
        )
        parts.append(f'<circle cx="{f2(vs2d[0])}" cy="{f2(vs2d[1])}" r="2.6" fill="{pal["start"]}"/>')
        parts.append(trimmed_line_and_arrow(o2d, ve2d, 2.4, p["end_color"], length=9.0, width=3.5))
        parts.append(f'<circle cx="{f2(o2d[0])}" cy="{f2(o2d[1])}" r="2.6" fill="{pal["ink"]}"/>')

        # Vector labels
        sl_b, sl_s = p["start_lbl"]
        sl_txt = f'{sl_b}<tspan dy="2.5" font-size="78%">{sl_s}</tspan>' if sl_s else sl_b
        parts.append(
            f'<text x="{f2(vs2d[0] + p["start_off"][0])}" y="{f2(vs2d[1] + p["start_off"][1])}" '
            f'text-anchor="middle" font-family="{MONO}" font-size="11" fill="{pal["muted"]}">{sl_txt}</text>'
        )

        el_b, el_s = p["end_lbl"]
        el_txt = f'{el_b}<tspan dy="2.5" font-size="78%">{el_s}</tspan>' if el_s else el_b
        parts.append(
            f'<text x="{f2(ve2d[0] + p["end_off"][0])}" y="{f2(ve2d[1] + p["end_off"][1])}" '
            f'text-anchor="middle" font-family="{MONO}" font-size="11.5" font-weight="600" fill="{p["end_color"]}">{el_txt}</text>'
        )

        # Bottom equation caption
        parts.append(
            f'<text x="{f2(cx_panel)}" y="299" text-anchor="middle" '
            f'font-family="{MONO}" font-size="11" fill="{pal["muted"]}">{captions[idx]}</text>'
        )

    parts.append("</svg>")
    return "\n".join(parts) + "\n"


# ── Axis Convention Diagram (3 panels, 960x220) ──────────────────────────────
def build_axis_convention(theme_name, pal):
    W, H = 960, 220
    PW = 320
    theta_deg = 32.0
    theta_rad = math.radians(theta_deg)

    panels = [
        {
            "head": f'R<tspan dy="2.5" font-size="78%">x</tspan><tspan dy="-2.5">(+θ</tspan><tspan dy="2.5" font-size="78%">x</tspan><tspan dy="-2.5">)</tspan>',
            "out_lbl": "+x",
            "out_col": pal["x"],
            "h_lbl": "+y",
            "h_col": pal["y"],
            "v_lbl": "+z",
            "v_col": pal["z"],
            "h_prime": "y′",
            "v_prime": "z′",
            "theta_lbl": ('+θ', 'x'),
            "caption": "+x out of page · +y → +z",
        },
        {
            "head": f'R<tspan dy="2.5" font-size="78%">y</tspan><tspan dy="-2.5">(+θ</tspan><tspan dy="2.5" font-size="78%">y</tspan><tspan dy="-2.5">)</tspan>',
            "out_lbl": "+y",
            "out_col": pal["y"],
            "h_lbl": "+z",
            "h_col": pal["z"],
            "v_lbl": "+x",
            "v_col": pal["x"],
            "h_prime": "z′",
            "v_prime": "x′",
            "theta_lbl": ('+θ', 'y'),
            "caption": "+y out of page · +z → +x",
        },
        {
            "head": f'R<tspan dy="2.5" font-size="78%">z</tspan><tspan dy="-2.5">(+θ</tspan><tspan dy="2.5" font-size="78%">z</tspan><tspan dy="-2.5">)</tspan>',
            "out_lbl": "+z",
            "out_col": pal["z"],
            "h_lbl": "+x",
            "h_col": pal["x"],
            "v_lbl": "+y",
            "v_col": pal["y"],
            "h_prime": "x′",
            "v_prime": "y′",
            "theta_lbl": ('+θ', 'z'),
            "caption": "+z out of page · +x → +y",
        },
    ]

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" rx="8" fill="{pal["bg"]}" stroke="{pal["border"]}"/>',
        f'<line x1="{PW}" y1="14" x2="{PW}" y2="{H-14}" stroke="{pal["divider"]}"/>',
        f'<line x1="{PW*2}" y1="14" x2="{PW*2}" y2="{H-14}" stroke="{pal["divider"]}"/>',
    ]

    for idx, p in enumerate(panels):
        cx = idx * PW + 132.0
        cy = 136.0
        panel_mid = idx * PW + PW * 0.5

        parts.append(
            f'<text x="{f2(panel_mid)}" y="26" text-anchor="middle" '
            f'font-family="{MONO}" font-size="13" font-weight="600" fill="{pal["ink"]}">{p["head"]}</text>'
        )

        # Horizontal +axis and vertical +axis
        h_end = (cx + 88.0, cy)
        v_end = (cx, cy - 80.0)
        parts.append(trimmed_line_and_arrow((cx, cy), h_end, 1.7, p["h_col"], length=7.0, width=2.7))
        parts.append(trimmed_line_and_arrow((cx, cy), v_end, 1.7, p["v_col"], length=7.0, width=2.7))

        parts.append(
            f'<text x="{f2(h_end[0] + 14)}" y="{f2(h_end[1] + 4)}" text-anchor="middle" '
            f'font-family="{MONO}" font-size="11.5" font-weight="600" fill="{p["h_col"]}">{p["h_lbl"]}</text>'
        )
        parts.append(
            f'<text x="{f2(v_end[0])}" y="{f2(v_end[1] - 8)}" text-anchor="middle" '
            f'font-family="{MONO}" font-size="11.5" font-weight="600" fill="{p["v_col"]}">{p["v_lbl"]}</text>'
        )

        # Rotated basis axes (CCW by 32°)
        r_len = 76.0
        hp_end = (cx + r_len * math.cos(theta_rad), cy - r_len * math.sin(theta_rad))
        vp_end = (cx - r_len * math.sin(theta_rad), cy - r_len * math.cos(theta_rad))
        parts.append(trimmed_line_and_arrow((cx, cy), hp_end, 1.5, p["h_col"], length=6.5, width=2.4, opacity=0.68, dash="4 3"))
        parts.append(trimmed_line_and_arrow((cx, cy), vp_end, 1.5, p["v_col"], length=6.5, width=2.4, opacity=0.68, dash="4 3"))

        parts.append(
            f'<text x="{f2(hp_end[0] + 12)}" y="{f2(hp_end[1] + 2)}" text-anchor="middle" '
            f'font-family="{MONO}" font-size="11" font-style="italic" fill="{p["h_col"]}">{p["h_prime"]}</text>'
        )
        parts.append(
            f'<text x="{f2(vp_end[0] - 11)}" y="{f2(vp_end[1] - 5)}" text-anchor="middle" '
            f'font-family="{MONO}" font-size="11" font-style="italic" fill="{p["v_col"]}">{p["v_prime"]}</text>'
        )

        # CCW rotation arc from 0° to 32° at r = 42
        arc_r = 42.0
        arc_pts = [
            (cx + arc_r * math.cos(theta_rad * i / 18), cy - arc_r * math.sin(theta_rad * i / 18))
            for i in range(19)
        ]
        arc_d = "M " + " L ".join(f"{f2(pt[0])},{f2(pt[1])}" for pt in arc_pts[:-1])
        parts.append(f'<path d="{arc_d}" fill="none" stroke="{p["out_col"]}" stroke-width="1.6" stroke-linecap="round"/>')
        parts.append(arrow_poly(arc_pts[-3], arc_pts[-1], length=6.0, width=2.4, color=p["out_col"]))

        # Secondary subtle CCW arc from 90° to 122° at r = 34
        arc2_r = 34.0
        arc2_pts = [
            (cx + arc2_r * math.cos(math.pi * 0.5 + theta_rad * i / 16), cy - arc2_r * math.sin(math.pi * 0.5 + theta_rad * i / 16))
            for i in range(17)
        ]
        arc2_d = "M " + " L ".join(f"{f2(pt[0])},{f2(pt[1])}" for pt in arc2_pts[:-1])
        parts.append(f'<path d="{arc2_d}" fill="none" stroke="{p["out_col"]}" stroke-width="1.3" stroke-opacity="0.7" stroke-linecap="round"/>')
        parts.append(arrow_poly(arc2_pts[-3], arc2_pts[-1], length=5.2, width=2.1, color=p["out_col"], opacity=0.75))

        # +θ label outside primary arc
        t_mid = theta_rad * 0.5
        lbl_r = 59.0
        lx = cx + lbl_r * math.cos(t_mid)
        ly = cy - lbl_r * math.sin(t_mid) + 4.0
        tb, ts = p["theta_lbl"]
        parts.append(
            f'<text x="{f2(lx)}" y="{f2(ly)}" text-anchor="middle" '
            f'font-family="{MONO}" font-size="11" font-weight="600" fill="{p["out_col"]}">'
            f'{tb}<tspan dy="2.5" font-size="78%">{ts}</tspan></text>'
        )

        # Out-of-page origin marker ⊙
        parts.append(f'<circle cx="{f2(cx)}" cy="{f2(cy)}" r="6.5" fill="{pal["bg"]}" stroke="{p["out_col"]}" stroke-width="1.5"/>')
        parts.append(f'<circle cx="{f2(cx)}" cy="{f2(cy)}" r="2.2" fill="{p["out_col"]}"/>')
        parts.append(
            f'<text x="{f2(cx - 18)}" y="{f2(cy + 18)}" text-anchor="end" '
            f'font-family="{MONO}" font-size="11" font-weight="600" fill="{p["out_col"]}">{p["out_lbl"]}</text>'
        )

        # Bottom caption
        parts.append(
            f'<text x="{f2(panel_mid)}" y="201" text-anchor="middle" '
            f'font-family="{MONO}" font-size="11" fill="{pal["muted"]}">{p["caption"]}</text>'
        )

    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def main():
    for theme_name, pal in THEMES.items():
        seq_svg = build_rotation_sequence(theme_name, pal)
        (OUT_DIR / f"rotation-sequence-{theme_name}.svg").write_text(seq_svg, encoding="utf-8")

        conv_svg = build_axis_convention(theme_name, pal)
        (OUT_DIR / f"axis-convention-{theme_name}.svg").write_text(conv_svg, encoding="utf-8")

    print("Generated 4 SVGs in", OUT_DIR)


if __name__ == "__main__":
    main()
