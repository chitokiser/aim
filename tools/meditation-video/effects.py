"""All visual effects — operates on BGR numpy arrays (OpenCV convention)."""
from __future__ import annotations

import cv2
import numpy as np
import math
import random
from typing import Optional


# ── Zoom / Scale ─────────────────────────────────────────────────────────────

def apply_zoom(frame: np.ndarray, scale: float) -> np.ndarray:
    if scale <= 1.001:
        return frame
    h, w = frame.shape[:2]
    nw = max(1, int(w / scale))
    nh = max(1, int(h / scale))
    x1 = (w - nw) // 2
    y1 = (h - nh) // 2
    cropped = frame[y1:y1 + nh, x1:x1 + nw]
    if cropped.size == 0:
        return frame
    return cv2.resize(cropped, (w, h), interpolation=cv2.INTER_LINEAR)


def zoom_scale_from_audio(rms: float, bass: float, base: float = 1.0) -> float:
    return base + rms * 0.02 + bass * 0.01


# ── Glow / Bloom ─────────────────────────────────────────────────────────────

def apply_glow(frame: np.ndarray, intensity: float, radius: int = 31) -> np.ndarray:
    if intensity <= 0:
        return frame
    ksize = max(3, radius) | 1
    blurred = cv2.GaussianBlur(frame, (ksize, ksize), 0)
    f = frame.astype(np.float32) / 255.0
    b = blurred.astype(np.float32) / 255.0
    result = 1.0 - (1.0 - f) * (1.0 - b * float(np.clip(intensity, 0, 1)))
    return np.clip(result * 255, 0, 255).astype(np.uint8)


def apply_bloom(frame: np.ndarray, intensity: float, threshold: int = 200) -> np.ndarray:
    if intensity <= 0:
        return frame
    gray = frame.astype(np.int32).sum(axis=2) // 3
    mask = gray > threshold
    src = np.zeros_like(frame)
    src[mask] = frame[mask]
    blurred = cv2.GaussianBlur(src, (51, 51), 0)
    result = frame.astype(np.float32) + blurred.astype(np.float32) * intensity
    return np.clip(result, 0, 255).astype(np.uint8)


# ── Light Effects ─────────────────────────────────────────────────────────────

def apply_lens_flare(frame: np.ndarray, cx: int, cy: int, intensity: float = 0.7) -> np.ndarray:
    if intensity <= 0:
        return frame
    h, w = frame.shape[:2]
    overlay = np.zeros((h, w, 3), dtype=np.float32)
    s = float(np.clip(intensity, 0, 1))

    cv2.circle(overlay, (cx, cy), int(20 * s), (100, 180, 200), -1)
    cv2.circle(overlay, (cx, cy), int(80 * s), (100, 100, 200), 2)
    cv2.circle(overlay, (cx, cy), int(130 * s), (80, 80, 150), 1)

    dx, dy = cx - w // 2, cy - h // 2
    flares = [(0.3, 15, (200, 180, 255)), (0.5, 8, (180, 200, 255)),
              (0.7, 20, (255, 220, 180)), (-0.3, 12, (200, 255, 200)),
              (-0.6, 18, (255, 200, 150)), (-0.9, 10, (200, 200, 255))]
    for t, r, col in flares:
        fx, fy = int(w // 2 + dx * t), int(h // 2 + dy * t)
        if 0 <= fx < w and 0 <= fy < h:
            cv2.circle(overlay, (fx, fy), r, col, -1)

    overlay = cv2.GaussianBlur(overlay, (21, 21), 0)
    result = cv2.addWeighted(frame.astype(np.float32), 1.0, overlay, s * 0.8, 0)
    return np.clip(result, 0, 255).astype(np.uint8)


def apply_god_rays(frame: np.ndarray, cx: int, cy: int, intensity: float = 0.5) -> np.ndarray:
    if intensity <= 0:
        return frame
    h, w = frame.shape[:2]
    mask = np.zeros((h, w), dtype=np.float32)
    cv2.circle(mask, (cx, cy), w // 6, 1.0, -1)
    ray = cv2.GaussianBlur(mask, (201, 201), 0) * float(intensity) * 255
    ray_rgb = np.stack([ray * 0.9, ray * 0.95, ray], axis=2).astype(np.uint8)
    return cv2.addWeighted(frame, 1.0, ray_rgb, float(intensity) * 0.6, 0)


def apply_sun_rays(frame: np.ndarray, intensity: float = 0.4) -> np.ndarray:
    h, w = frame.shape[:2]
    return apply_god_rays(frame, w // 2, -h // 8, intensity)


def apply_light_leak(frame: np.ndarray, intensity: float = 0.4, frame_idx: int = 0) -> np.ndarray:
    if intensity <= 0:
        return frame
    h, w = frame.shape[:2]
    colors = [(255, 150, 100), (255, 200, 80), (200, 100, 255), (100, 200, 255)]
    color = colors[(frame_idx // 60) % len(colors)]
    corners = [(0, 0), (w, 0), (0, h), (w, h)]
    cx_c, cy_c = corners[(frame_idx // 120) % 4]

    leak = np.zeros((h, w, 3), dtype=np.float32)
    xs = np.linspace(0.0, 1.0, w)
    ys = np.linspace(0.0, 1.0, h)
    gx = (1 - xs) if cx_c == w else xs
    gy = (1 - ys) if cy_c == h else ys
    g = np.outer(gy, gx) * 255 * float(intensity)
    for c_idx, c_val in enumerate(color):
        leak[:, :, c_idx] = g * (c_val / 255.0)

    result = cv2.addWeighted(frame.astype(np.float32), 1.0, leak, 0.6, 0)
    return np.clip(result, 0, 255).astype(np.uint8)


# ── Fog Effect ────────────────────────────────────────────────────────────────

class FogEffect:
    def __init__(self, width: int, height: int, direction: str = 'left_right',
                 opacity_min: float = 0.10, opacity_max: float = 0.30):
        self.w = width
        self.h = height
        self.direction = direction
        self.opacity_min = opacity_min
        self.opacity_max = opacity_max
        self._tex: Optional[np.ndarray] = None
        self._generate()

    def _generate(self):
        tw, th = self.w * 3, self.h * 3
        n1 = np.random.rand(th // 4, tw // 4).astype(np.float32)
        n1 = cv2.GaussianBlur(n1, (31, 31), 10)
        n1 = cv2.resize(n1, (tw, th), interpolation=cv2.INTER_LINEAR)
        n2 = np.random.rand(th // 8, tw // 8).astype(np.float32)
        n2 = cv2.GaussianBlur(n2, (21, 21), 7)
        n2 = cv2.resize(n2, (tw, th), interpolation=cv2.INTER_LINEAR)
        self._tex = np.clip(n1 * 0.7 + n2 * 0.3, 0, 1)

    def render(self, frame: np.ndarray, frame_idx: int, rms: float) -> np.ndarray:
        if self._tex is None:
            return frame
        opacity = self.opacity_min + rms * (self.opacity_max - self.opacity_min)
        speed = 0.4
        th, tw = self._tex.shape[:2]
        max_ox, max_oy = tw - self.w, th - self.h

        d = self.direction
        if d == 'left_right':
            ox = int((frame_idx * speed) % max(1, max_ox))
            oy = th // 3
        elif d == 'right_left':
            ox = int((max_ox - frame_idx * speed) % max(1, max_ox))
            oy = th // 3
        elif d == 'top_bottom':
            ox = tw // 3
            oy = int((frame_idx * speed) % max(1, max_oy))
        else:
            ox = int((frame_idx * speed * 0.7) % max(1, max_ox))
            oy = int((frame_idx * speed * 0.4) % max(1, max_oy))

        crop = self._tex[oy:oy + self.h, ox:ox + self.w]
        if crop.shape[:2] != (self.h, self.w):
            crop = cv2.resize(crop, (self.w, self.h))

        fog_rgb = np.stack([crop * 255] * 3, axis=2).astype(np.uint8)
        return cv2.addWeighted(frame, 1.0, fog_rgb, float(opacity), 0)


# ── Particle System ───────────────────────────────────────────────────────────

_PCFG: dict[str, dict] = {
    'dust':       {'color': (200, 180, 160), 'size': (1, 3),  'speed': (0.2, 0.8),  'zone': 'any',    'glow': False},
    'fireflies':  {'color': (180, 255, 100), 'size': (2, 5),  'speed': (0.5, 1.5),  'zone': 'any',    'glow': True},
    'petals':     {'color': (255, 200, 220), 'size': (3, 8),  'speed': (0.8, 2.5),  'zone': 'top',    'glow': False},
    'snow':       {'color': (240, 240, 255), 'size': (2, 5),  'speed': (1.0, 3.0),  'zone': 'top',    'glow': False},
    'light':      {'color': (255, 250, 200), 'size': (1, 4),  'speed': (0.5, 2.0),  'zone': 'bottom', 'glow': True},
    'leaves':     {'color': (160, 110, 40),  'size': (5, 12), 'speed': (1.5, 3.5),  'zone': 'top',    'glow': False},
    'rain':       {'color': (150, 180, 220), 'size': (1, 2),  'speed': (8.0, 15.0), 'zone': 'top',    'glow': False},
    'snowflakes': {'color': (210, 230, 255), 'size': (3, 7),  'speed': (0.5, 1.8),  'zone': 'top',    'glow': False},
    'fog':        {'color': (200, 200, 210), 'size': (8, 20), 'speed': (0.2, 0.6),  'zone': 'any',    'glow': False},
}
# columns: x y vx vy size alpha r g b age lifespan rot rot_speed
_NC = 13


class ParticleSystem:
    def __init__(self, ptype: str, width: int, height: int, max_count: int = 250):
        self.ptype = ptype
        self.w = width
        self.h = height
        self.max_count = max_count
        self.cfg = _PCFG.get(ptype, _PCFG['dust'])
        self.particles = np.zeros((0, _NC), dtype=np.float32)

    def _spawn(self) -> np.ndarray:
        cfg = self.cfg
        sz_min, sz_max = cfg['size']
        sp_min, sp_max = cfg['speed']
        br, bg, bb = cfg['color']
        zone = cfg['zone']

        x = float(np.random.uniform(0, self.w))
        if zone == 'top':
            y = float(np.random.uniform(-20, 0))
        elif zone == 'bottom':
            y = float(np.random.uniform(self.h, self.h + 20))
        else:
            y = float(np.random.uniform(0, self.h))

        speed = float(np.random.uniform(sp_min, sp_max))
        pt = self.ptype

        if pt == 'dust' or pt == 'fog':
            ang = float(np.random.uniform(0, 2 * math.pi))
            vx, vy = math.cos(ang) * speed * 0.4, math.sin(ang) * speed * 0.2
        elif pt == 'fireflies':
            ang = float(np.random.uniform(0, 2 * math.pi))
            vx, vy = math.cos(ang) * speed * 0.6, math.sin(ang) * speed * 0.6
        elif pt == 'light':
            vx = float(np.random.uniform(-0.4, 0.4)) * speed
            vy = -speed
        elif pt == 'rain':
            vx, vy = speed * 0.25, speed
        else:
            vx = float(np.random.uniform(-speed * 0.4, speed * 0.4))
            vy = speed

        size = float(np.random.uniform(sz_min, sz_max))
        alpha = float(np.random.uniform(0.6, 1.0))
        life = float(np.random.uniform(80, 220))
        r = float(np.clip(br + np.random.randint(-20, 20), 0, 255))
        g = float(np.clip(bg + np.random.randint(-20, 20), 0, 255))
        b = float(np.clip(bb + np.random.randint(-20, 20), 0, 255))
        rot = float(np.random.uniform(0, 360))
        rot_sp = float(np.random.uniform(-3, 3))
        return np.array([x, y, vx, vy, size, alpha, r, g, b, 0, life, rot, rot_sp], dtype=np.float32)

    def update(self, rms: float, beat: bool):
        if len(self.particles) > 0:
            spd = 1.0 + rms * 1.5
            self.particles[:, 0] += self.particles[:, 2] * spd
            self.particles[:, 1] += self.particles[:, 3] * spd
            self.particles[:, 9] += 1
            self.particles[:, 11] += self.particles[:, 12]

            if self.ptype == 'fireflies':
                self.particles[:, 2] += np.random.uniform(-0.1, 0.1, len(self.particles))
                self.particles[:, 3] += np.random.uniform(-0.1, 0.1, len(self.particles))
                speeds = np.sqrt(self.particles[:, 2]**2 + self.particles[:, 3]**2)
                cap = 1.5
                too_fast = speeds > cap
                self.particles[too_fast, 2] *= cap / (speeds[too_fast] + 1e-8)
                self.particles[too_fast, 3] *= cap / (speeds[too_fast] + 1e-8)

            age_r = self.particles[:, 9] / (self.particles[:, 10] + 1e-8)
            fade = age_r > 0.7
            self.particles[fade, 5] = (1 - age_r[fade]) / 0.3

            m = 60
            alive = (
                (self.particles[:, 9] < self.particles[:, 10]) &
                (self.particles[:, 0] > -m) & (self.particles[:, 0] < self.w + m) &
                (self.particles[:, 1] > -m) & (self.particles[:, 1] < self.h + m) &
                (self.particles[:, 5] > 0.01)
            )
            self.particles = self.particles[alive]

        target = int(self.max_count * (0.3 + rms * 0.7))
        if beat:
            target = min(int(target * 1.5), self.max_count)
        to_spawn = min(max(0, target - len(self.particles)), 15)
        if to_spawn > 0:
            new_p = np.array([self._spawn() for _ in range(to_spawn)])
            self.particles = np.vstack([self.particles, new_p]) if len(self.particles) > 0 else new_p

    def render(self, frame: np.ndarray, rms: float = 0.5) -> np.ndarray:
        if len(self.particles) == 0:
            return frame
        result = frame.copy()
        h, w = result.shape[:2]
        pt = self.ptype
        glow = self.cfg['glow']

        for p in self.particles:
            px, py = int(p[0]), int(p[1])
            size = max(1, int(p[4]))
            alpha = float(p[5])
            r, g, b = int(p[6]), int(p[7]), int(p[8])
            rot = float(p[11])

            if not (0 <= px < w and 0 <= py < h):
                continue

            a_bgr = (int(b * alpha), int(g * alpha), int(r * alpha))

            if pt == 'rain':
                vx, vy = float(p[2]), float(p[3])
                sp = math.sqrt(vx**2 + vy**2) + 1e-8
                ex = int(px - vx / sp * size * 5)
                ey = int(py - vy / sp * size * 5)
                cv2.line(result, (px, py), (ex, ey), a_bgr, 1)

            elif pt == 'snowflakes':
                for arm in range(0, 360, 60):
                    rad = math.radians(arm + rot)
                    x1 = int(px + math.cos(rad) * size)
                    y1 = int(py + math.sin(rad) * size)
                    cv2.line(result, (px, py), (x1, y1), a_bgr, 1)

            elif pt in ('leaves', 'petals'):
                axes = (max(1, size), max(1, size // 2 if pt == 'petals' else size // 3))
                cv2.ellipse(result, (px, py), axes, int(rot), 0, 360, a_bgr, -1)

            elif pt == 'fog':
                overlay = result.copy()
                cv2.circle(overlay, (px, py), size * 4, (b, g, r), -1)
                overlay = cv2.GaussianBlur(overlay, (size * 8 + 1 | 1, size * 8 + 1 | 1), 0)
                result = cv2.addWeighted(result, 1.0, overlay, alpha * 0.08, 0)

            elif glow and size >= 2:
                gr = max(3, size * 3) | 1
                glow_img = np.zeros_like(result, dtype=np.float32)
                cv2.circle(glow_img, (px, py), gr, (float(b), float(g), float(r)), -1)
                ksize = gr * 2 + 1
                glow_img = cv2.GaussianBlur(glow_img, (ksize, ksize), gr // 2 + 1)
                result = np.clip(
                    result.astype(np.float32) + glow_img * alpha * 0.6, 0, 255
                ).astype(np.uint8)
                cv2.circle(result, (px, py), max(1, size // 2), a_bgr, -1)

            else:
                cv2.circle(result, (px, py), size, a_bgr, -1)

        return result


# ── Weather ───────────────────────────────────────────────────────────────────

class RainEffect:
    def __init__(self, intensity: str = 'normal', width: int = 1920, height: int = 1080):
        self.intensity = intensity
        self.w = width
        self.h = height
        counts = {'light': 40, 'normal': 100, 'heavy': 250, 'window': 20}
        n = counts.get(intensity, 100)
        self._drops = [(random.uniform(0, width), random.uniform(0, height),
                        random.uniform(1.5, 3.0), random.uniform(8, 20)) for _ in range(n)]

    def render(self, frame: np.ndarray, rms: float) -> np.ndarray:
        result = frame.copy()
        spd_m = 1.0 + rms * 1.5

        if self.intensity == 'window':
            for i, (dx, dy, vspd, size) in enumerate(self._drops):
                px, py = int(dx), int(dy)
                if 0 <= px < self.w and 0 <= py < self.h:
                    cv2.circle(result, (px, py), int(size), (180, 200, 220), 1)
                    cv2.line(result, (px, py + int(size)), (px + random.randint(-3, 3),
                             py + int(size) + random.randint(10, 30)), (180, 200, 220), 1)
                new_dy = dy + vspd * spd_m * 0.5
                self._drops[i] = (dx, new_dy if new_dy < self.h else -10, vspd, size)
        else:
            for i, (dx, dy, vspd, length) in enumerate(self._drops):
                px, py = int(dx), int(dy)
                ex = int(px + length * 0.15)
                ey = int(py + length)
                alpha = random.uniform(0.4, 0.7)
                color = (int(150 * alpha), int(180 * alpha), int(220 * alpha))
                cv2.line(result, (px, py), (ex, ey), color, 1)
                new_dy = dy + vspd * spd_m
                new_dx = dx + vspd * 0.15 * spd_m
                if new_dy > self.h or new_dx > self.w:
                    new_dy = random.uniform(-20, 0)
                    new_dx = random.uniform(0, self.w)
                self._drops[i] = (new_dx, new_dy, vspd, length)
        return result


class SnowEffect:
    def __init__(self, intensity: str = 'normal', width: int = 1920, height: int = 1080):
        counts = {'slow': 60, 'fast': 180, 'blizzard': 450}
        n = counts.get(intensity, 100)
        self.w, self.h = width, height
        self._flakes = [(random.uniform(0, width), random.uniform(0, height),
                         random.uniform(0.4, 1.8), random.uniform(2, 6)) for _ in range(n)]

    def render(self, frame: np.ndarray, rms: float) -> np.ndarray:
        result = frame.copy()
        spd_m = 1.0 + rms * 2.0
        for i, (fx, fy, vspd, size) in enumerate(self._flakes):
            px, py = int(fx), int(fy)
            if 0 <= px < self.w and 0 <= py < self.h:
                cv2.circle(result, (px, py), max(1, int(size)), (240, 240, 255), -1)
            nfy = fy + vspd * spd_m
            nfx = fx + random.uniform(-0.6, 0.6)
            if nfy > self.h:
                nfy = -10
                nfx = random.uniform(0, self.w)
            self._flakes[i] = (nfx, nfy, vspd, size)
        return result


# ── Camera ────────────────────────────────────────────────────────────────────

def apply_camera_shake(frame: np.ndarray, rms: float, intensity: float = 1.0,
                       beat: bool = False) -> np.ndarray:
    if intensity <= 0:
        return frame
    mag = min(2.0, 0.5 + rms * intensity * 1.5) * (1.5 if beat else 1.0)
    dx = random.uniform(-mag, mag)
    dy = random.uniform(-mag, mag)
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    h, w = frame.shape[:2]
    return cv2.warpAffine(frame, M, (w, h), flags=cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT)


def apply_depth_of_field(frame: np.ndarray, focus_y_ratio: float = 0.5,
                          intensity: float = 1.0) -> np.ndarray:
    if intensity <= 0:
        return frame
    h, w = frame.shape[:2]
    blurred = cv2.GaussianBlur(frame, (21, 21), 0)
    focus_y = int(h * focus_y_ratio)
    ys = np.abs(np.arange(h) - focus_y).astype(np.float32)
    mask = np.clip(ys / (h / 2) * intensity, 0, 1)[:, np.newaxis, np.newaxis]
    result = frame.astype(np.float32) * (1 - mask) + blurred.astype(np.float32) * mask
    return np.clip(result, 0, 255).astype(np.uint8)


# ── Water Ripple ─────────────────────────────────────────────────────────────

def apply_ripple(frame: np.ndarray, frame_idx: int, intensity: float = 0.5) -> np.ndarray:
    if intensity <= 0:
        return frame
    h, w = frame.shape[:2]
    amp = intensity * 5
    freq = 0.05
    xs = np.tile(np.arange(w), (h, 1)).astype(np.float32)
    ys = np.tile(np.arange(h)[:, np.newaxis], (1, w)).astype(np.float32)
    dx = (amp * np.sin(ys * freq + frame_idx * 0.1)).astype(np.float32)
    map_x = (xs + dx).clip(0, w - 1).astype(np.float32)
    map_y = ys.astype(np.float32)
    return cv2.remap(frame, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ── LUT Color Grading ─────────────────────────────────────────────────────────

def load_cube_lut(path: str) -> Optional[np.ndarray]:
    try:
        with open(path, 'r') as f:
            lines = f.readlines()
        lut_size = 33
        data: list[list[float]] = []
        for line in lines:
            line = line.strip()
            if line.startswith('LUT_3D_SIZE'):
                lut_size = int(line.split()[-1])
            elif line and not line.startswith(('#', 'TITLE', 'DOMAIN', 'LUT')):
                try:
                    vals = list(map(float, line.split()))
                    if len(vals) == 3:
                        data.append(vals)
                except ValueError:
                    pass
        if len(data) == lut_size ** 3:
            return np.array(data, dtype=np.float32).reshape(lut_size, lut_size, lut_size, 3)
    except Exception:
        pass
    return None


def apply_lut(frame_rgb: np.ndarray, lut: np.ndarray) -> np.ndarray:
    if lut is None:
        return frame_rgb
    s = lut.shape[0]
    f = frame_rgb.astype(np.float32) / 255.0
    ri = (f[:, :, 0] * (s - 1)).clip(0, s - 1).astype(int)
    gi = (f[:, :, 1] * (s - 1)).clip(0, s - 1).astype(int)
    bi = (f[:, :, 2] * (s - 1)).clip(0, s - 1).astype(int)
    mapped = lut[ri, gi, bi]
    return np.clip(mapped * 255, 0, 255).astype(np.uint8)


# ── Audio Visualization ───────────────────────────────────────────────────────

class AudioVisualizer:
    def __init__(self, width: int, height: int,
                 color: tuple = (255, 255, 255), alpha: float = 0.8):
        self.w = width
        self.h = height
        self.color = color
        self.alpha = alpha

    def draw_waveform(self, frame: np.ndarray, waveform: np.ndarray,
                       bar_height: int = 80) -> np.ndarray:
        overlay = frame.copy()
        n = len(waveform)
        y_base = self.h - 25
        r, g, b = self.color
        pts = [(int(i / n * self.w), int(y_base - float(v) * bar_height))
               for i, v in enumerate(waveform)]
        for i in range(len(pts) - 1):
            cv2.line(overlay, pts[i], pts[i + 1], (b, g, r), 1)
        return cv2.addWeighted(frame, 1 - self.alpha, overlay, self.alpha, 0)

    def draw_spectrum(self, frame: np.ndarray, spectrum: np.ndarray,
                       max_h: int = 120) -> np.ndarray:
        overlay = frame.copy()
        n = len(spectrum)
        bw = max(1, self.w // n)
        for i, v in enumerate(spectrum):
            bh = int(float(v) * max_h)
            x1 = i * bw
            y1 = self.h - bh - 10
            hue = int(240 - (i / n) * 240)
            c_hsv = np.uint8([[[hue, 200, 200]]])
            c_bgr = cv2.cvtColor(c_hsv, cv2.COLOR_HSV2BGR)[0][0].tolist()
            cv2.rectangle(overlay, (x1, y1), (x1 + bw - 1, self.h - 10), c_bgr, -1)
        return cv2.addWeighted(frame, 1 - self.alpha * 0.7, overlay, self.alpha * 0.7, 0)

    def draw_circle_spectrum(self, frame: np.ndarray, spectrum: np.ndarray,
                              radius: int = 0) -> np.ndarray:
        overlay = frame.copy()
        n = len(spectrum)
        cx, cy = self.w // 2, self.h // 2
        if radius == 0:
            radius = min(self.w, self.h) // 5
        for i, v in enumerate(spectrum):
            ang = (i / n) * 2 * math.pi - math.pi / 2
            inner_r = radius
            outer_r = radius + int(float(v) * radius * 0.8)
            x1 = int(cx + inner_r * math.cos(ang))
            y1 = int(cy + inner_r * math.sin(ang))
            x2 = int(cx + outer_r * math.cos(ang))
            y2 = int(cy + outer_r * math.sin(ang))
            hue = int((i / n) * 180)
            c_hsv = np.uint8([[[hue, 220, 220]]])
            c_bgr = cv2.cvtColor(c_hsv, cv2.COLOR_HSV2BGR)[0][0].tolist()
            cv2.line(overlay, (x1, y1), (x2, y2), c_bgr, 2)
        return cv2.addWeighted(frame, 1 - self.alpha * 0.8, overlay, self.alpha * 0.8, 0)

    def draw_glow_ring(self, frame: np.ndarray, rms: float, frame_idx: int = 0) -> np.ndarray:
        cx, cy = self.w // 2, self.h // 2
        base_r = min(self.w, self.h) // 5
        radius = int(base_r * (1.0 + rms * 0.3))
        mask = np.zeros((self.h, self.w), dtype=np.float32)
        cv2.circle(mask, (cx, cy), radius, 1.0, 4)
        mask = cv2.GaussianBlur(mask, (21, 21), 7)
        r, g, b = self.color
        glow = np.stack([mask * b, mask * g, mask * r], axis=2) * 255
        result = np.clip(
            frame.astype(np.float32) + glow * self.alpha, 0, 255
        ).astype(np.uint8)
        return result

    def draw_particle_ring(self, frame: np.ndarray, rms: float, frame_idx: int = 0) -> np.ndarray:
        result = frame.copy()
        cx, cy = self.w // 2, self.h // 2
        ring_r = min(self.w, self.h) // 5
        n = int(20 + rms * 60)
        r, g, b = self.color
        for i in range(n):
            ang = (i / n) * 2 * math.pi + frame_idx * 0.02
            r_off = random.uniform(-10, 10) * rms
            px = int(cx + (ring_r + r_off) * math.cos(ang))
            py = int(cy + (ring_r + r_off) * math.sin(ang))
            sz = max(1, int(2 + rms * 4))
            if 0 <= px < self.w and 0 <= py < self.h:
                cv2.circle(result, (px, py), sz, (b, g, r), -1)
        return result


# ── Scene Transitions ─────────────────────────────────────────────────────────

def _blend(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    return cv2.addWeighted(a, 1.0 - t, b, t, 0)

def crossfade(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    return _blend(a, b, t)

def white_fade(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    white = np.full_like(a, 255)
    if t < 0.5:
        return _blend(a, white, t * 2)
    return _blend(white, b, (t - 0.5) * 2)

def black_fade(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    black = np.zeros_like(a)
    if t < 0.5:
        return _blend(a, black, t * 2)
    return _blend(black, b, (t - 0.5) * 2)

def blur_transition(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    ksize = max(3, int(min(t, 1 - t) * 2 * 61)) | 1
    if t < 0.5:
        blurred = cv2.GaussianBlur(a, (ksize, ksize), 0)
        return _blend(a, blurred, t * 2)
    blurred = cv2.GaussianBlur(b, (ksize, ksize), 0)
    return _blend(blurred, b, (t - 0.5) * 2)

def zoom_transition(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    if t < 0.5:
        zoomed = apply_zoom(a, 1.0 + t * 0.12)
        return _blend(zoomed, b, t * 2)
    zoomed = apply_zoom(b, 1.0 + (1 - t) * 0.12)
    return _blend(a, zoomed, (t - 0.5) * 2)

def dissolve(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    rng = np.random.default_rng(42)
    mask = rng.random(a.shape[:2]).astype(np.float32)
    bm = (mask < t).astype(np.float32)[:, :, np.newaxis]
    return (a * (1 - bm) + b * bm).astype(np.uint8)

def light_leak_transition(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    base = _blend(a, b, t)
    h, w = base.shape[:2]
    peak = (1 - abs(t - 0.5) * 2) * 0.8
    cx = int(w * t)
    xs = np.arange(w)[np.newaxis, :]
    leak_r = np.exp(-((xs - cx) ** 2) / (w * 0.08)) * peak * 200
    leak = np.zeros((h, w, 3), dtype=np.float32)
    leak[:, :, 2] = leak_r
    leak[:, :, 1] = leak_r * 0.7
    return np.clip(base.astype(float) + leak, 0, 255).astype(np.uint8)

def film_burn(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    base = _blend(a, b, t)
    peak = (1 - abs(t - 0.5) * 2) * 80
    warmth = np.zeros_like(base, dtype=np.float32)
    warmth[:, :, 2] = peak
    warmth[:, :, 1] = peak * 0.5
    return np.clip(base.astype(float) + warmth, 0, 255).astype(np.uint8)

TRANSITIONS: dict[str, object] = {
    'crossfade': crossfade,
    'white_fade': white_fade,
    'black_fade': black_fade,
    'blur': blur_transition,
    'zoom': zoom_transition,
    'dissolve': dissolve,
    'light_leak': light_leak_transition,
    'film_burn': film_burn,
}


# ── Text / Quotes / Subtitles ─────────────────────────────────────────────────

MEDITATION_QUOTES = [
    "호흡하세요.",
    "지금 이 순간을 느껴보세요.",
    "마음을 비우세요.",
    "평온함이 내 안에 있습니다.",
    "내 숨결이 나를 안정시킵니다.",
    "생각을 흘려보내세요.",
    "지금 여기, 이 순간에 있으세요.",
    "당신은 이미 완전합니다.",
    "고요함 속에서 답을 찾으세요.",
    "Breathe deeply.",
    "Be present.",
    "Let go.",
    "This moment is enough.",
    "Peace begins within.",
]


def apply_text_overlay(frame: np.ndarray, text: str, alpha: float,
                        position: str = 'bottom',
                        color: tuple = (255, 255, 255),
                        font_scale: float = 1.2) -> np.ndarray:
    if not text or alpha <= 0:
        return frame
    overlay = frame.copy()
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = 2
    (tw, th), _ = cv2.getTextSize(text, font, font_scale, thickness)
    tx = (w - tw) // 2
    ty = (h // 2 + th // 2) if position == 'center' else (h - 60)
    r, g, b = color
    cv2.putText(overlay, text, (tx + 2, ty + 2), font, font_scale, (0, 0, 0), thickness + 1)
    cv2.putText(overlay, text, (tx, ty), font, font_scale, (b, g, r), thickness)
    return cv2.addWeighted(frame, 1 - alpha, overlay, alpha, 0)


def parse_srt(path: str) -> list[dict]:
    subs: list[dict] = []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        for block in content.strip().split('\n\n'):
            lines = block.strip().split('\n')
            if len(lines) >= 3:
                times = lines[1].split(' --> ')
                if len(times) == 2:
                    def _t(ts: str) -> float:
                        ts = ts.strip().replace(',', '.')
                        p = ts.split(':')
                        return int(p[0]) * 3600 + int(p[1]) * 60 + float(p[2])
                    subs.append({'start': _t(times[0]), 'end': _t(times[1]),
                                  'text': ' '.join(lines[2:])})
    except Exception:
        pass
    return subs


def get_subtitle_at(subs: list[dict], t: float) -> Optional[str]:
    for s in subs:
        if s['start'] <= t <= s['end']:
            return s['text']
    return None
