"""Video rendering pipeline — orchestrates all effects per frame."""
from __future__ import annotations

import cv2
import numpy as np
import json
import os
import subprocess
from dataclasses import dataclass, asdict, field
from typing import Optional, Callable
from PIL import Image

from audio_analyzer import AudioAnalyzer
from effects import (
    apply_zoom, zoom_scale_from_audio,
    apply_glow, apply_bloom,
    apply_lens_flare, apply_god_rays, apply_sun_rays, apply_light_leak,
    FogEffect, ParticleSystem,
    RainEffect, SnowEffect,
    apply_camera_shake, apply_depth_of_field, apply_ripple,
    apply_lut, load_cube_lut,
    AudioVisualizer, TRANSITIONS,
    apply_text_overlay, parse_srt, get_subtitle_at,
    MEDITATION_QUOTES,
)


@dataclass
class RenderSettings:
    # Output
    width: int = 1920
    height: int = 1080
    fps: int = 30
    output_dir: str = 'output'

    # Timing
    seconds_per_image: float = 8.0
    transition_type: str = 'crossfade'
    transition_duration: float = 1.5

    # Zoom
    zoom_enabled: bool = True
    zoom_intensity: float = 1.0

    # Glow / Bloom
    glow_enabled: bool = True
    glow_intensity: float = 0.5
    bloom_enabled: bool = False
    bloom_intensity: float = 0.4

    # Light effects
    lens_flare: bool = False
    god_rays: bool = False
    sun_rays: bool = False
    light_leak: bool = False
    light_intensity: float = 0.4

    # Fog
    fog_enabled: bool = True
    fog_direction: str = 'left_right'
    fog_opacity_min: float = 0.10
    fog_opacity_max: float = 0.25

    # Particles
    particles_enabled: bool = True
    particle_type: str = 'petals'
    particle_count: int = 200

    # Weather
    rain_enabled: bool = False
    rain_intensity: str = 'normal'
    snow_enabled: bool = False
    snow_intensity: str = 'normal'

    # Water
    ripple_enabled: bool = False
    ripple_intensity: float = 0.5

    # Camera
    camera_shake: bool = True
    camera_shake_intensity: float = 0.5
    depth_of_field: bool = False
    dof_intensity: float = 0.5

    # Visualization
    viz_enabled: bool = False
    viz_type: str = 'glow_ring'
    viz_alpha: float = 0.7
    viz_color: tuple = field(default_factory=lambda: (255, 255, 255))

    # Text
    quotes_enabled: bool = True
    quote_interval: float = 15.0
    subtitle_path: str = ''
    text_position: str = 'bottom'

    # LUT
    lut_path: str = ''

    # AI auto
    ai_auto: bool = False


class VideoRenderer:
    def __init__(self, settings: RenderSettings):
        self.s = settings
        self.cancelled = False

    def cancel(self):
        self.cancelled = True

    def render(self, audio_path: str, image_paths: list[str],
               progress_cb: Optional[Callable[[float, str], None]] = None,
               done_cb: Optional[Callable[[bool, Optional[str]], None]] = None):
        try:
            self._run(audio_path, image_paths, progress_cb)
            if done_cb:
                done_cb(True, None)
        except Exception as e:
            if done_cb:
                done_cb(False, str(e))

    def _run(self, audio_path: str, image_paths: list[str],
             pcb: Optional[Callable]):
        s = self.s
        os.makedirs(s.output_dir, exist_ok=True)

        def p(ratio: float, msg: str):
            if pcb:
                pcb(ratio, msg)

        # ── 1. Audio analysis ────────────────────────────────────────────────
        p(0.02, "Analyzing audio…")
        analyzer = AudioAnalyzer(audio_path, fps=s.fps)
        frame_data = analyzer.analyze(lambda r: pcb and pcb(r * 0.18, "Analyzing audio…"))
        n_frames = len(frame_data)
        duration = n_frames / s.fps

        # ── 2. Load images ───────────────────────────────────────────────────
        p(0.20, "Loading images…")
        images: list[np.ndarray] = []
        for path in image_paths:
            img = cv2.imread(path)
            if img is None:
                try:
                    img = np.array(Image.open(path).convert('RGB'))
                    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                except Exception:
                    img = np.full((s.height, s.width, 3), 80, dtype=np.uint8)
            images.append(cv2.resize(img, (s.width, s.height), interpolation=cv2.INTER_LANCZOS4))

        if not images:
            raise ValueError("No images loaded")

        frames_per_img = max(1, int(s.fps * s.seconds_per_image))
        trans_frames   = max(1, int(s.fps * s.transition_duration))

        # ── 3. AI auto mode ──────────────────────────────────────────────────
        if s.ai_auto and frame_data:
            is_slow = frame_data[0].is_slow
            avg_rms = float(np.mean([f.rms for f in frame_data]))
            if is_slow:
                s.fog_opacity_max = min(0.40, s.fog_opacity_max * 1.6)
                s.glow_intensity   = min(1.0, s.glow_intensity * 1.4)
                s.particle_count   = max(40, s.particle_count // 2)
                s.camera_shake_intensity = max(0.1, s.camera_shake_intensity * 0.5)
            else:
                s.particle_count = min(400, int(s.particle_count * 1.8))
                s.zoom_intensity = min(2.0, s.zoom_intensity * 1.3)
                s.transition_duration = max(0.5, s.transition_duration * 0.7)

        # ── 4. Init effects ──────────────────────────────────────────────────
        fog = FogEffect(s.width, s.height, s.fog_direction,
                        s.fog_opacity_min, s.fog_opacity_max) if s.fog_enabled else None
        particles = (ParticleSystem(s.particle_type, s.width, s.height, s.particle_count)
                     if s.particles_enabled else None)
        rain_fx = RainEffect(s.rain_intensity, s.width, s.height) if s.rain_enabled else None
        snow_fx = SnowEffect(s.snow_intensity, s.width, s.height) if s.snow_enabled else None
        viz     = (AudioVisualizer(s.width, s.height, s.viz_color, s.viz_alpha)
                   if s.viz_enabled else None)
        lut     = load_cube_lut(s.lut_path) if s.lut_path and os.path.exists(s.lut_path) else None
        subs    = parse_srt(s.subtitle_path) if s.subtitle_path and os.path.exists(s.subtitle_path) else []
        waveform = analyzer.get_waveform()

        # ── 5. Video writer ──────────────────────────────────────────────────
        tmp = os.path.join(s.output_dir, '_tmp_video.mp4')
        writer = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*'mp4v'),
                                  s.fps, (s.width, s.height))
        if not writer.isOpened():
            raise RuntimeError("Cannot open VideoWriter")

        # Quote state
        q_idx, q_text, q_alpha, q_timer = 0, '', 0.0, 0

        p(0.25, "Rendering frames…")

        # ── 6. Frame loop ────────────────────────────────────────────────────
        for fi in range(n_frames):
            if self.cancelled:
                writer.release()
                if os.path.exists(tmp):
                    os.remove(tmp)
                return

            ad = frame_data[fi]
            t  = fi / s.fps

            # Which image pair
            img_idx  = (fi // frames_per_img) % len(images)
            next_idx = (img_idx + 1) % len(images)
            pos      = fi % frames_per_img

            # Transition blend
            if pos >= frames_per_img - trans_frames:
                tt = (pos - (frames_per_img - trans_frames)) / trans_frames
                fn = TRANSITIONS.get(s.transition_type, TRANSITIONS['crossfade'])
                frame = fn(images[img_idx], images[next_idx], float(np.clip(tt, 0, 1)))
            else:
                frame = images[img_idx].copy()

            # Zoom
            if s.zoom_enabled:
                if ad.instrument_type == 'singing_bowl':
                    scale = 1.0 + ad.rms * 0.025
                elif ad.instrument_type == 'guitar':
                    scale = 1.0 + ad.bass * 0.03 + ad.rms * 0.01
                else:
                    scale = zoom_scale_from_audio(ad.rms, ad.bass)
                scale = 1.0 + (scale - 1.0) * s.zoom_intensity
                if scale > 1.001:
                    frame = apply_zoom(frame, scale)

            # Glow
            if s.glow_enabled:
                g_int = s.glow_intensity * (1.5 if ad.instrument_type == 'singing_bowl' else 1.0)
                frame = apply_glow(frame, g_int + ad.rms * 0.15)
            if s.bloom_enabled:
                frame = apply_bloom(frame, s.bloom_intensity * (0.5 + ad.rms * 0.5))

            # Light
            if s.lens_flare:
                cx = s.width // 2 + int(np.sin(t * 0.08) * s.width * 0.1)
                cy = int(s.height * 0.12)
                frame = apply_lens_flare(frame, cx, cy, s.light_intensity * (0.5 + ad.rms))
            if s.god_rays:
                frame = apply_god_rays(frame, s.width // 2, int(s.height * 0.05),
                                        s.light_intensity * (0.3 + ad.rms * 0.4))
            if s.sun_rays:
                frame = apply_sun_rays(frame, s.light_intensity * 0.3)
            if s.light_leak:
                frame = apply_light_leak(frame, s.light_intensity * 0.4 * ad.rms, fi)

            # Fog
            if fog:
                frame = fog.render(frame, fi, ad.rms)

            # Particles
            if particles:
                particles.update(ad.rms, ad.beat)
                frame = particles.render(frame, ad.rms)

            # Weather
            if rain_fx:
                frame = rain_fx.render(frame, ad.rms)
            if snow_fx:
                frame = snow_fx.render(frame, ad.rms)

            # Ripple
            if s.ripple_enabled:
                frame = apply_ripple(frame, fi, s.ripple_intensity)

            # Camera shake
            if s.camera_shake:
                frame = apply_camera_shake(frame, ad.rms, s.camera_shake_intensity, ad.beat)

            # Depth of field
            if s.depth_of_field:
                frame = apply_depth_of_field(frame, 0.5, s.dof_intensity)

            # Visualization
            if viz:
                spectrum = analyzer.get_spectrum_at_frame(fi)
                vt = s.viz_type
                if vt == 'waveform':
                    frame = viz.draw_waveform(frame, waveform)
                elif vt == 'spectrum':
                    frame = viz.draw_spectrum(frame, spectrum)
                elif vt == 'circle_spectrum':
                    frame = viz.draw_circle_spectrum(frame, spectrum)
                elif vt == 'glow_ring':
                    frame = viz.draw_glow_ring(frame, ad.rms, fi)
                elif vt == 'particle_ring':
                    frame = viz.draw_particle_ring(frame, ad.rms, fi)

            # Subtitles
            if subs:
                sub_t = get_subtitle_at(subs, t)
                if sub_t:
                    frame = apply_text_overlay(frame, sub_t, 0.85, s.text_position)

            # Quotes
            if s.quotes_enabled:
                q_timer += 1
                interval_f = int(s.fps * s.quote_interval)
                if q_timer >= interval_f or not q_text:
                    q_text  = MEDITATION_QUOTES[q_idx % len(MEDITATION_QUOTES)]
                    q_idx  += 1
                    q_timer = 0
                    q_alpha = 0.0
                cycle = q_timer / max(1, interval_f)
                if cycle < 0.15:
                    q_alpha = cycle / 0.15
                elif cycle > 0.85:
                    q_alpha = (1.0 - cycle) / 0.15
                else:
                    q_alpha = 1.0
                frame = apply_text_overlay(frame, q_text, q_alpha * 0.75,
                                            s.text_position, color=(255, 255, 230))

            # LUT
            if lut is not None:
                fr_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                fr_rgb = apply_lut(fr_rgb, lut)
                frame  = cv2.cvtColor(fr_rgb, cv2.COLOR_RGB2BGR)

            writer.write(frame)

            if fi % 30 == 0:
                p(0.25 + 0.65 * (fi / n_frames), f"Frame {fi}/{n_frames}")

        writer.release()

        # ── 7. Mux audio ─────────────────────────────────────────────────────
        p(0.91, "Muxing audio…")
        out_video = os.path.join(s.output_dir, 'video.mp4')
        self._mux(tmp, audio_path, out_video)
        if os.path.exists(tmp):
            os.remove(tmp)

        # ── 8. Thumbnail ─────────────────────────────────────────────────────
        p(0.94, "Generating thumbnail…")
        thumb = cv2.resize(images[0], (1280, 720), interpolation=cv2.INTER_LANCZOS4)
        cv2.imwrite(os.path.join(s.output_dir, 'thumbnail.jpg'), thumb)

        # ── 9. Preview ───────────────────────────────────────────────────────
        p(0.96, "Generating preview…")
        self._preview(out_video, os.path.join(s.output_dir, 'preview.mp4'))

        # ── 10. Project JSON ─────────────────────────────────────────────────
        with open(os.path.join(s.output_dir, 'project.json'), 'w', encoding='utf-8') as f:
            proj = {'settings': asdict(self.s), 'audio': audio_path,
                    'images': image_paths, 'duration': duration}
            json.dump(proj, f, indent=2, ensure_ascii=False)

        p(1.0, "Done!")

    @staticmethod
    def _mux(video: str, audio: str, out: str):
        cmd = ['ffmpeg', '-y', '-i', video, '-i', audio,
               '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
               '-c:a', 'aac', '-b:a', '192k',
               '-movflags', '+faststart', '-shortest', out]
        r = subprocess.run(cmd, capture_output=True)
        if r.returncode != 0:
            cmd2 = ['ffmpeg', '-y', '-i', video, '-i', audio,
                    '-c:v', 'copy', '-c:a', 'aac', '-shortest', out]
            subprocess.run(cmd2, capture_output=True)

    @staticmethod
    def _preview(src: str, dst: str, dur: int = 30):
        subprocess.run(['ffmpeg', '-y', '-i', src, '-t', str(dur),
                        '-vf', 'scale=960:540',
                        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
                        '-c:a', 'aac', '-b:a', '96k', dst],
                       capture_output=True)

    @staticmethod
    def load_project(path: str) -> tuple[RenderSettings, str, list[str]]:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        s = RenderSettings(**{k: v for k, v in data['settings'].items()
                               if k in RenderSettings.__dataclass_fields__})
        return s, data.get('audio', ''), data.get('images', [])
