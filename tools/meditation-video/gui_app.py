"""CustomTkinter GUI for AI Meditation Music Video Generator."""
from __future__ import annotations

import os
import threading
import tkinter as tk
from tkinter import filedialog, messagebox
from typing import Optional

import customtkinter as ctk

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    _DND_AVAILABLE = True
except ImportError:
    _DND_AVAILABLE = False

from renderer import RenderSettings, VideoRenderer


# ── Theme ────────────────────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

_ACCENT  = "#6C63FF"
_BG      = "#1a1a2e"
_PANEL   = "#16213e"
_CARD    = "#0f3460"
_TEXT    = "#e2e2e2"
_MUTED   = "#888899"

PARTICLE_TYPES = ["dust", "fireflies", "petals", "snow_particles",
                   "light_particles", "leaves", "raindrops", "snowflakes", "fog_wisps"]
VIZ_TYPES      = ["glow_ring", "waveform", "spectrum", "circle_spectrum", "particle_ring"]
TRANSITION_TYPES = ["crossfade", "white_fade", "black_fade", "blur",
                     "zoom", "dissolve", "light_leak", "film_burn"]
FOG_DIRS        = ["left_right", "right_left", "bottom_top", "top_bottom", "radial"]
RAIN_INTENSITIES = ["light", "normal", "heavy", "window"]
SNOW_INTENSITIES = ["slow", "normal", "fast", "blizzard"]
RESOLUTIONS     = ["1920×1080", "1280×720", "3840×2160", "1080×1920"]
FPS_OPTIONS     = ["24", "30", "60"]


class FileDrop(ctk.CTkFrame):
    """Drag-and-drop target that also opens a file dialog."""

    def __init__(self, parent, label: str, exts: list[str],
                 multiple: bool = False, **kw):
        super().__init__(parent, **kw)
        self.exts     = exts
        self.multiple = multiple
        self.paths: list[str] = []
        self.configure(border_width=2, border_color=_ACCENT,
                        fg_color=_PANEL, corner_radius=8)

        self._icon = ctk.CTkLabel(self, text="📁", font=("Segoe UI Emoji", 28))
        self._icon.pack(pady=(14, 4))
        self._label = ctk.CTkLabel(self, text=label, text_color=_MUTED,
                                    font=("Segoe UI", 11))
        self._label.pack()
        self._info = ctk.CTkLabel(self, text="No file selected",
                                   text_color=_ACCENT, font=("Segoe UI", 10),
                                   wraplength=220)
        self._info.pack(pady=(4, 10))

        btn = ctk.CTkButton(self, text="Browse", fg_color=_CARD,
                             hover_color=_ACCENT, command=self._browse,
                             corner_radius=6, height=28)
        btn.pack(pady=(0, 10))

        if _DND_AVAILABLE:
            self.drop_target_register(DND_FILES)
            self.dnd_bind("<<Drop>>", self._on_drop)

    def _on_drop(self, event):
        raw = event.data
        if raw.startswith('{'):
            items = [p.strip('{}') for p in raw.split('} {')]
        else:
            items = raw.split()
        filtered = [p for p in items
                    if any(p.lower().endswith(e) for e in self.exts)]
        if filtered:
            self.paths = filtered if self.multiple else [filtered[0]]
            self._refresh()

    def _browse(self):
        ft = [("All supported", ' '.join(f'*{e}' for e in self.exts))]
        if self.multiple:
            res = filedialog.askopenfilenames(filetypes=ft)
            if res:
                self.paths = list(res)
        else:
            res = filedialog.askopenfilename(filetypes=ft)
            if res:
                self.paths = [res]
        self._refresh()

    def _refresh(self):
        if not self.paths:
            self._info.configure(text="No file selected")
            return
        if len(self.paths) == 1:
            self._info.configure(text=os.path.basename(self.paths[0]))
        else:
            self._info.configure(text=f"{len(self.paths)} files selected")

    def get(self) -> list[str]:
        return self.paths


class LabeledSlider(ctk.CTkFrame):
    def __init__(self, parent, label: str, from_: float, to: float,
                 default: float, steps: int = 100, fmt: str = ".2f", **kw):
        super().__init__(parent, fg_color="transparent", **kw)
        self._fmt = fmt
        self._var = tk.DoubleVar(value=default)
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x")
        ctk.CTkLabel(row, text=label, text_color=_TEXT,
                     font=("Segoe UI", 11), width=140, anchor="w").pack(side="left")
        self._val_lbl = ctk.CTkLabel(row, text=f"{default:{fmt}}",
                                      text_color=_ACCENT,
                                      font=("Segoe UI", 11), width=46)
        self._val_lbl.pack(side="right")
        slider = ctk.CTkSlider(self, from_=from_, to=to,
                                number_of_steps=steps,
                                variable=self._var,
                                command=self._update,
                                button_color=_ACCENT,
                                progress_color=_ACCENT)
        slider.pack(fill="x", pady=(2, 6))

    def _update(self, val):
        self._val_lbl.configure(text=f"{float(val):{self._fmt}}")

    def get(self) -> float:
        return self._var.get()

    def set(self, v: float):
        self._var.set(v)
        self._val_lbl.configure(text=f"{v:{self._fmt}}")


class LabeledSwitch(ctk.CTkFrame):
    def __init__(self, parent, label: str, default: bool = False, **kw):
        super().__init__(parent, fg_color="transparent", **kw)
        self._var = tk.BooleanVar(value=default)
        sw = ctk.CTkSwitch(self, text=label, variable=self._var,
                            onvalue=True, offvalue=False,
                            progress_color=_ACCENT,
                            font=("Segoe UI", 11))
        sw.pack(anchor="w", pady=2)

    def get(self) -> bool:
        return self._var.get()

    def set(self, v: bool):
        self._var.set(v)


class LabeledCombo(ctk.CTkFrame):
    def __init__(self, parent, label: str, values: list[str],
                 default: str = '', **kw):
        super().__init__(parent, fg_color="transparent", **kw)
        ctk.CTkLabel(self, text=label, text_color=_TEXT,
                     font=("Segoe UI", 11)).pack(anchor="w")
        self._combo = ctk.CTkOptionMenu(self, values=values,
                                         fg_color=_CARD,
                                         button_color=_ACCENT,
                                         button_hover_color=_ACCENT,
                                         font=("Segoe UI", 11))
        self._combo.set(default or values[0])
        self._combo.pack(fill="x", pady=(2, 6))

    def get(self) -> str:
        return self._combo.get()

    def set(self, v: str):
        self._combo.set(v)


class Section(ctk.CTkFrame):
    def __init__(self, parent, title: str, **kw):
        super().__init__(parent, fg_color=_PANEL, corner_radius=10, **kw)
        ctk.CTkLabel(self, text=f"  {title}",
                     font=("Segoe UI", 12, "bold"),
                     text_color=_ACCENT,
                     fg_color=_CARD, corner_radius=6,
                     anchor="w").pack(fill="x", pady=(0, 8))
        self._body = ctk.CTkFrame(self, fg_color="transparent")
        self._body.pack(fill="both", expand=True, padx=8, pady=(0, 8))

    @property
    def body(self):
        return self._body


# ── Main App ─────────────────────────────────────────────────────────────────

class MeditationVideoApp(TkinterDnD.Tk if _DND_AVAILABLE else ctk.CTk):  # type: ignore

    def __init__(self):
        super().__init__()
        self.title("🎵 AI Meditation Music Video Generator")
        self.geometry("1280x860")
        self.minsize(1024, 700)
        self.configure(bg=_BG)

        self._renderer: Optional[VideoRenderer] = None
        self._render_thread: Optional[threading.Thread] = None

        self._build_ui()

    # ── Layout ───────────────────────────────────────────────────────────────

    def _build_ui(self):
        # Header
        hdr = ctk.CTkFrame(self, fg_color=_PANEL, height=56, corner_radius=0)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text="  AI Meditation Music Video Generator",
                     font=("Segoe UI", 16, "bold"),
                     text_color=_ACCENT).pack(side="left", padx=16, pady=10)
        ctk.CTkLabel(hdr, text="✨ Audio-Reactive · AI Auto · 9 Particles · LUT",
                     font=("Segoe UI", 10),
                     text_color=_MUTED).pack(side="right", padx=16)

        # Main columns
        body = ctk.CTkFrame(self, fg_color=_BG)
        body.pack(fill="both", expand=True, padx=12, pady=8)
        body.columnconfigure(0, weight=3, minsize=320)
        body.columnconfigure(1, weight=7, minsize=500)
        body.rowconfigure(0, weight=1)

        # Left: file inputs + AI mode + render
        left = ctk.CTkFrame(body, fg_color=_PANEL, corner_radius=12)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        self._build_left(left)

        # Right: tabbed settings
        right = ctk.CTkScrollableFrame(body, fg_color=_BG, corner_radius=0)
        right.grid(row=0, column=1, sticky="nsew")
        self._build_tabs(right)

    # ── Left panel ───────────────────────────────────────────────────────────

    def _build_left(self, parent: ctk.CTkFrame):
        ctk.CTkLabel(parent, text="Input Files",
                     font=("Segoe UI", 13, "bold"),
                     text_color=_TEXT).pack(padx=12, pady=(14, 6), anchor="w")

        self._audio_drop = FileDrop(
            parent,
            label="Drop audio file here\n(MP3 / WAV / FLAC / OGG)",
            exts=[".mp3", ".wav", ".flac", ".ogg", ".m4a"],
            multiple=False,
        )
        self._audio_drop.pack(fill="x", padx=12, pady=4)

        self._image_drop = FileDrop(
            parent,
            label="Drop background images\n(JPG / PNG / WEBP — multiple OK)",
            exts=[".jpg", ".jpeg", ".png", ".webp", ".bmp"],
            multiple=True,
        )
        self._image_drop.pack(fill="x", padx=12, pady=4)

        ctk.CTkSeparator(parent, orientation="horizontal").pack(fill="x", padx=12, pady=10)

        # Output dir
        row = ctk.CTkFrame(parent, fg_color="transparent")
        row.pack(fill="x", padx=12, pady=2)
        ctk.CTkLabel(row, text="Output folder:", text_color=_TEXT,
                     font=("Segoe UI", 11)).pack(side="left")
        self._out_entry = ctk.CTkEntry(row, placeholder_text="output/",
                                        font=("Segoe UI", 11), height=28)
        self._out_entry.insert(0, "output")
        self._out_entry.pack(side="left", fill="x", expand=True, padx=(6, 4))
        ctk.CTkButton(row, text="…", width=32, height=28,
                       fg_color=_CARD, hover_color=_ACCENT,
                       command=self._pick_outdir).pack(side="left")

        # Resolution / FPS
        row2 = ctk.CTkFrame(parent, fg_color="transparent")
        row2.pack(fill="x", padx=12, pady=4)
        self._res_combo = LabeledCombo(row2, "Resolution", RESOLUTIONS, "1920×1080")
        self._res_combo.pack(side="left", expand=True, fill="x")
        self._fps_combo = LabeledCombo(row2, "FPS", FPS_OPTIONS, "30")
        self._fps_combo.pack(side="left", expand=True, fill="x", padx=(8, 0))

        ctk.CTkSeparator(parent, orientation="horizontal").pack(fill="x", padx=12, pady=10)

        # AI auto
        self._ai_auto = LabeledSwitch(parent, "🤖 AI Auto Mode", default=False)
        self._ai_auto.pack(padx=16, anchor="w")
        ctk.CTkLabel(parent,
                     text="Auto-adjusts fog, glow & particles\nbased on music tempo & instrument",
                     text_color=_MUTED, font=("Segoe UI", 9),
                     justify="left").pack(padx=20, anchor="w", pady=(0, 10))

        # Seconds per image
        self._secs_slider = LabeledSlider(parent, "Sec per image", 2.0, 30.0, 8.0,
                                           fmt=".1f")
        self._secs_slider.pack(fill="x", padx=12)

        ctk.CTkSeparator(parent, orientation="horizontal").pack(fill="x", padx=12, pady=10)

        # Render button
        self._render_btn = ctk.CTkButton(
            parent, text="▶  RENDER VIDEO",
            font=("Segoe UI", 14, "bold"),
            fg_color=_ACCENT, hover_color="#5750d0",
            height=46, corner_radius=10,
            command=self._on_render,
        )
        self._render_btn.pack(fill="x", padx=12, pady=(0, 8))

        self._cancel_btn = ctk.CTkButton(
            parent, text="■  Cancel",
            font=("Segoe UI", 11),
            fg_color="#4a0000", hover_color="#800000",
            height=32, corner_radius=8,
            command=self._on_cancel,
            state="disabled",
        )
        self._cancel_btn.pack(fill="x", padx=12, pady=(0, 10))

        # Progress
        self._prog_bar = ctk.CTkProgressBar(parent, progress_color=_ACCENT,
                                              corner_radius=6)
        self._prog_bar.set(0)
        self._prog_bar.pack(fill="x", padx=12, pady=4)

        self._prog_label = ctk.CTkLabel(parent, text="Ready",
                                         text_color=_MUTED,
                                         font=("Segoe UI", 10))
        self._prog_label.pack(pady=(2, 14))

        # Load / save project
        row3 = ctk.CTkFrame(parent, fg_color="transparent")
        row3.pack(fill="x", padx=12, pady=4)
        ctk.CTkButton(row3, text="Load project",
                       fg_color=_CARD, hover_color=_ACCENT,
                       height=28, font=("Segoe UI", 11),
                       command=self._load_project).pack(side="left", expand=True, fill="x", padx=(0, 4))
        ctk.CTkButton(row3, text="Save preset",
                       fg_color=_CARD, hover_color=_ACCENT,
                       height=28, font=("Segoe UI", 11),
                       command=self._save_preset).pack(side="left", expand=True, fill="x")

    # ── Right tabs ────────────────────────────────────────────────────────────

    def _build_tabs(self, parent):
        tabs = ctk.CTkTabview(parent, fg_color=_PANEL,
                               segmented_button_fg_color=_CARD,
                               segmented_button_selected_color=_ACCENT,
                               segmented_button_selected_hover_color="#5750d0",
                               corner_radius=10)
        tabs.pack(fill="both", expand=True, padx=4)

        for name in ["Particles", "Atmosphere", "Light", "Camera",
                      "Visualization", "Text", "Transitions", "Color"]:
            tabs.add(name)

        self._build_particles(tabs.tab("Particles"))
        self._build_atmosphere(tabs.tab("Atmosphere"))
        self._build_light(tabs.tab("Light"))
        self._build_camera(tabs.tab("Camera"))
        self._build_viz(tabs.tab("Visualization"))
        self._build_text(tabs.tab("Text"))
        self._build_transitions(tabs.tab("Transitions"))
        self._build_color(tabs.tab("Color"))

    # ── Particles tab ────────────────────────────────────────────────────────

    def _build_particles(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "Particle System")
        s.pack(fill="x", pady=4)
        self._particles_en = LabeledSwitch(s.body, "Enable Particles", True)
        self._particles_en.pack(anchor="w")
        self._particle_type = LabeledCombo(s.body, "Type", PARTICLE_TYPES, "petals")
        self._particle_type.pack(fill="x")
        self._particle_count = LabeledSlider(s.body, "Count", 20, 500, 200,
                                              steps=96, fmt=".0f")
        self._particle_count.pack(fill="x")

        s2 = Section(col, "Rain")
        s2.pack(fill="x", pady=4)
        self._rain_en = LabeledSwitch(s2.body, "Enable Rain")
        self._rain_en.pack(anchor="w")
        self._rain_int = LabeledCombo(s2.body, "Intensity", RAIN_INTENSITIES, "normal")
        self._rain_int.pack(fill="x")

        s3 = Section(col, "Snow")
        s3.pack(fill="x", pady=4)
        self._snow_en = LabeledSwitch(s3.body, "Enable Snow")
        self._snow_en.pack(anchor="w")
        self._snow_int = LabeledCombo(s3.body, "Intensity", SNOW_INTENSITIES, "normal")
        self._snow_int.pack(fill="x")

    # ── Atmosphere tab ───────────────────────────────────────────────────────

    def _build_atmosphere(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "Fog")
        s.pack(fill="x", pady=4)
        self._fog_en = LabeledSwitch(s.body, "Enable Fog", True)
        self._fog_en.pack(anchor="w")
        self._fog_dir = LabeledCombo(s.body, "Direction", FOG_DIRS, "left_right")
        self._fog_dir.pack(fill="x")
        self._fog_min = LabeledSlider(s.body, "Opacity min", 0.0, 0.5, 0.10, 50)
        self._fog_min.pack(fill="x")
        self._fog_max = LabeledSlider(s.body, "Opacity max", 0.05, 0.8, 0.25, 75)
        self._fog_max.pack(fill="x")

        s2 = Section(col, "Water Ripple")
        s2.pack(fill="x", pady=4)
        self._ripple_en = LabeledSwitch(s2.body, "Enable Ripple")
        self._ripple_en.pack(anchor="w")
        self._ripple_int = LabeledSlider(s2.body, "Intensity", 0.1, 2.0, 0.5, 38)
        self._ripple_int.pack(fill="x")

        s3 = Section(col, "Glow & Bloom")
        s3.pack(fill="x", pady=4)
        self._glow_en = LabeledSwitch(s3.body, "Enable Glow", True)
        self._glow_en.pack(anchor="w")
        self._glow_int = LabeledSlider(s3.body, "Glow Intensity", 0.0, 1.0, 0.5, 50)
        self._glow_int.pack(fill="x")
        self._bloom_en = LabeledSwitch(s3.body, "Enable Bloom")
        self._bloom_en.pack(anchor="w")
        self._bloom_int = LabeledSlider(s3.body, "Bloom Intensity", 0.0, 1.0, 0.4, 50)
        self._bloom_int.pack(fill="x")

    # ── Light tab ─────────────────────────────────────────────────────────────

    def _build_light(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "Light Effects")
        s.pack(fill="x", pady=4)
        self._lens_flare = LabeledSwitch(s.body, "Lens Flare")
        self._lens_flare.pack(anchor="w")
        self._god_rays = LabeledSwitch(s.body, "God Rays")
        self._god_rays.pack(anchor="w")
        self._sun_rays = LabeledSwitch(s.body, "Sun Rays")
        self._sun_rays.pack(anchor="w")
        self._light_leak = LabeledSwitch(s.body, "Light Leak")
        self._light_leak.pack(anchor="w")
        self._light_int = LabeledSlider(s.body, "Light Intensity", 0.0, 1.0, 0.4, 50)
        self._light_int.pack(fill="x")

        s2 = Section(col, "Zoom (Audio Reactive)")
        s2.pack(fill="x", pady=4)
        self._zoom_en = LabeledSwitch(s2.body, "Enable Zoom", True)
        self._zoom_en.pack(anchor="w")
        self._zoom_int = LabeledSlider(s2.body, "Zoom Intensity", 0.1, 3.0, 1.0, 58)
        self._zoom_int.pack(fill="x")

    # ── Camera tab ───────────────────────────────────────────────────────────

    def _build_camera(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "Camera Shake")
        s.pack(fill="x", pady=4)
        self._shake_en = LabeledSwitch(s.body, "Camera Shake (Beat Reactive)", True)
        self._shake_en.pack(anchor="w")
        self._shake_int = LabeledSlider(s.body, "Shake Intensity", 0.0, 2.0, 0.5, 40)
        self._shake_int.pack(fill="x")
        ctk.CTkLabel(s.body, text="Shake range: 0.5–2px, triggered on beat",
                     text_color=_MUTED, font=("Segoe UI", 9)).pack(anchor="w")

        s2 = Section(col, "Depth of Field")
        s2.pack(fill="x", pady=4)
        self._dof_en = LabeledSwitch(s2.body, "Enable Depth of Field")
        self._dof_en.pack(anchor="w")
        self._dof_int = LabeledSlider(s2.body, "DoF Intensity", 0.1, 1.0, 0.5, 45)
        self._dof_int.pack(fill="x")

    # ── Visualization tab ────────────────────────────────────────────────────

    def _build_viz(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "Audio Visualization")
        s.pack(fill="x", pady=4)
        self._viz_en = LabeledSwitch(s.body, "Show Visualizer")
        self._viz_en.pack(anchor="w")
        self._viz_type = LabeledCombo(s.body, "Type", VIZ_TYPES, "glow_ring")
        self._viz_type.pack(fill="x")
        self._viz_alpha = LabeledSlider(s.body, "Opacity", 0.1, 1.0, 0.7, 45)
        self._viz_alpha.pack(fill="x")

        s2 = Section(col, "Visualizer Color (R / G / B)")
        s2.pack(fill="x", pady=4)
        self._viz_r = LabeledSlider(s2.body, "Red", 0, 255, 255, 255, fmt=".0f")
        self._viz_r.pack(fill="x")
        self._viz_g = LabeledSlider(s2.body, "Green", 0, 255, 255, 255, fmt=".0f")
        self._viz_g.pack(fill="x")
        self._viz_b = LabeledSlider(s2.body, "Blue", 0, 255, 255, 255, fmt=".0f")
        self._viz_b.pack(fill="x")

    # ── Text tab ─────────────────────────────────────────────────────────────

    def _build_text(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "Meditation Quotes")
        s.pack(fill="x", pady=4)
        self._quotes_en = LabeledSwitch(s.body, "Random Meditation Quotes", True)
        self._quotes_en.pack(anchor="w")
        self._quote_interval = LabeledSlider(s.body, "Quote Interval (sec)",
                                              5.0, 60.0, 15.0, 55, fmt=".1f")
        self._quote_interval.pack(fill="x")
        self._text_pos = LabeledCombo(s.body, "Position",
                                       ["bottom", "center", "top"], "bottom")
        self._text_pos.pack(fill="x")

        s2 = Section(col, "SRT Subtitles")
        s2.pack(fill="x", pady=4)
        ctk.CTkLabel(s2.body, text="Subtitle file (.srt):",
                     text_color=_TEXT, font=("Segoe UI", 11)).pack(anchor="w")
        row = ctk.CTkFrame(s2.body, fg_color="transparent")
        row.pack(fill="x", pady=2)
        self._srt_entry = ctk.CTkEntry(row, placeholder_text="optional .srt file path",
                                        font=("Segoe UI", 11), height=28)
        self._srt_entry.pack(side="left", fill="x", expand=True, padx=(0, 4))
        ctk.CTkButton(row, text="Browse", width=70, height=28,
                       fg_color=_CARD, hover_color=_ACCENT,
                       command=self._pick_srt).pack(side="left")

    # ── Transitions tab ──────────────────────────────────────────────────────

    def _build_transitions(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "Scene Transition")
        s.pack(fill="x", pady=4)
        self._trans_type = LabeledCombo(s.body, "Transition Type",
                                         TRANSITION_TYPES, "crossfade")
        self._trans_type.pack(fill="x")
        self._trans_dur = LabeledSlider(s.body, "Duration (sec)",
                                         0.3, 4.0, 1.5, 37, fmt=".1f")
        self._trans_dur.pack(fill="x")

        ctk.CTkLabel(s.body,
                     text="  • Cross Fade — gentle opacity blend\n"
                          "  • White / Black Fade — through white or black\n"
                          "  • Blur — gaussian blur transition\n"
                          "  • Zoom — zoom into next scene\n"
                          "  • Dissolve — pixel-random blend\n"
                          "  • Light Leak — warm orange flash\n"
                          "  • Film Burn — film-grain burn edge",
                     text_color=_MUTED, font=("Segoe UI", 9),
                     justify="left").pack(anchor="w", pady=8)

    # ── Color tab ────────────────────────────────────────────────────────────

    def _build_color(self, tab):
        col = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        col.pack(fill="both", expand=True)

        s = Section(col, "LUT Color Grading (.cube)")
        s.pack(fill="x", pady=4)
        ctk.CTkLabel(s.body, text=".cube LUT file:",
                     text_color=_TEXT, font=("Segoe UI", 11)).pack(anchor="w")
        row = ctk.CTkFrame(s.body, fg_color="transparent")
        row.pack(fill="x", pady=2)
        self._lut_entry = ctk.CTkEntry(row, placeholder_text="optional .cube file",
                                        font=("Segoe UI", 11), height=28)
        self._lut_entry.pack(side="left", fill="x", expand=True, padx=(0, 4))
        ctk.CTkButton(row, text="Browse", width=70, height=28,
                       fg_color=_CARD, hover_color=_ACCENT,
                       command=self._pick_lut).pack(side="left")
        ctk.CTkLabel(s.body,
                     text="Leave blank for no LUT.\n"
                          "Drop any 3D .cube LUT from DaVinci Resolve, VSCO, etc.",
                     text_color=_MUTED, font=("Segoe UI", 9)).pack(anchor="w", pady=4)

        s2 = Section(col, "Preset LUTs")
        s2.pack(fill="x", pady=4)
        for name, hint in [("Warm Sunset", "Golden amber tone"),
                            ("Teal & Orange", "Cinematic film"),
                            ("Cool Blue", "Calm, underwater feel"),
                            ("Vintage Film", "Muted, nostalgic"),
                            ("Vivid Dream", "Saturated, dreamy")]:
            row = ctk.CTkFrame(s2.body, fg_color="transparent")
            row.pack(fill="x", pady=1)
            ctk.CTkLabel(row, text=f"  {name}", text_color=_TEXT,
                         font=("Segoe UI", 11), width=160, anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=hint, text_color=_MUTED,
                         font=("Segoe UI", 9)).pack(side="left")
        ctk.CTkLabel(s2.body,
                     text="Import matching .cube files for these to work.",
                     text_color=_MUTED, font=("Segoe UI", 9)).pack(anchor="w", pady=4)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _pick_outdir(self):
        d = filedialog.askdirectory()
        if d:
            self._out_entry.delete(0, "end")
            self._out_entry.insert(0, d)

    def _pick_srt(self):
        f = filedialog.askopenfilename(filetypes=[("SRT", "*.srt")])
        if f:
            self._srt_entry.delete(0, "end")
            self._srt_entry.insert(0, f)

    def _pick_lut(self):
        f = filedialog.askopenfilename(filetypes=[("CUBE LUT", "*.cube")])
        if f:
            self._lut_entry.delete(0, "end")
            self._lut_entry.insert(0, f)

    # ── Build RenderSettings from UI ─────────────────────────────────────────

    def _gather_settings(self) -> RenderSettings:
        res_str = self._res_combo.get()
        w, h = (int(v) for v in res_str.replace("×", "x").split("x"))

        return RenderSettings(
            width=w, height=h,
            fps=int(self._fps_combo.get()),
            output_dir=self._out_entry.get() or "output",
            seconds_per_image=self._secs_slider.get(),
            # Zoom
            zoom_enabled=self._zoom_en.get(),
            zoom_intensity=self._zoom_int.get(),
            # Glow
            glow_enabled=self._glow_en.get(),
            glow_intensity=self._glow_int.get(),
            bloom_enabled=self._bloom_en.get(),
            bloom_intensity=self._bloom_int.get(),
            # Light
            lens_flare=self._lens_flare.get(),
            god_rays=self._god_rays.get(),
            sun_rays=self._sun_rays.get(),
            light_leak=self._light_leak.get(),
            light_intensity=self._light_int.get(),
            # Fog
            fog_enabled=self._fog_en.get(),
            fog_direction=self._fog_dir.get(),
            fog_opacity_min=self._fog_min.get(),
            fog_opacity_max=self._fog_max.get(),
            # Particles
            particles_enabled=self._particles_en.get(),
            particle_type=self._particle_type.get(),
            particle_count=int(self._particle_count.get()),
            # Rain / snow
            rain_enabled=self._rain_en.get(),
            rain_intensity=self._rain_int.get(),
            snow_enabled=self._snow_en.get(),
            snow_intensity=self._snow_int.get(),
            # Ripple
            ripple_enabled=self._ripple_en.get(),
            ripple_intensity=self._ripple_int.get(),
            # Camera
            camera_shake=self._shake_en.get(),
            camera_shake_intensity=self._shake_int.get(),
            depth_of_field=self._dof_en.get(),
            dof_intensity=self._dof_int.get(),
            # Viz
            viz_enabled=self._viz_en.get(),
            viz_type=self._viz_type.get(),
            viz_alpha=self._viz_alpha.get(),
            viz_color=(int(self._viz_r.get()), int(self._viz_g.get()), int(self._viz_b.get())),
            # Transitions
            transition_type=self._trans_type.get(),
            transition_duration=self._trans_dur.get(),
            # Text
            quotes_enabled=self._quotes_en.get(),
            quote_interval=self._quote_interval.get(),
            text_position=self._text_pos.get(),
            subtitle_path=self._srt_entry.get(),
            # LUT
            lut_path=self._lut_entry.get(),
            # AI
            ai_auto=self._ai_auto.get(),
        )

    # ── Render logic ─────────────────────────────────────────────────────────

    def _on_render(self):
        audio_paths = self._audio_drop.get()
        image_paths = self._image_drop.get()

        if not audio_paths:
            messagebox.showerror("Missing input", "Please select an audio file.")
            return
        if not image_paths:
            messagebox.showerror("Missing input", "Please select at least one background image.")
            return

        settings = self._gather_settings()
        self._renderer = VideoRenderer(settings)
        self._render_btn.configure(state="disabled")
        self._cancel_btn.configure(state="normal")
        self._prog_bar.set(0)
        self._prog_label.configure(text="Starting…")

        def run():
            self._renderer.render(
                audio_paths[0], image_paths,
                progress_cb=self._on_progress,
                done_cb=self._on_done,
            )

        self._render_thread = threading.Thread(target=run, daemon=True)
        self._render_thread.start()

    def _on_cancel(self):
        if self._renderer:
            self._renderer.cancel()
        self._cancel_btn.configure(state="disabled")
        self._prog_label.configure(text="Cancelling…")

    def _on_progress(self, ratio: float, msg: str):
        self.after(0, lambda: (
            self._prog_bar.set(ratio),
            self._prog_label.configure(text=msg),
        ))

    def _on_done(self, success: bool, error: Optional[str]):
        def _ui():
            self._render_btn.configure(state="normal")
            self._cancel_btn.configure(state="disabled")
            if success:
                out = self._out_entry.get() or "output"
                self._prog_bar.set(1.0)
                self._prog_label.configure(text="Render complete!")
                messagebox.showinfo("Done",
                    f"Video saved to:\n{os.path.abspath(out)}/video.mp4\n\n"
                    "Thumbnail, preview, and project.json also saved.")
            else:
                self._prog_bar.set(0)
                self._prog_label.configure(text="Error — see details")
                messagebox.showerror("Render failed", str(error))
        self.after(0, _ui)

    # ── Project load / save ───────────────────────────────────────────────────

    def _load_project(self):
        path = filedialog.askopenfilename(filetypes=[("Project JSON", "*.json")])
        if not path:
            return
        try:
            s, audio, images = VideoRenderer.load_project(path)
            self._apply_settings(s)
            if audio and os.path.exists(audio):
                self._audio_drop.paths = [audio]
                self._audio_drop._refresh()
            if images:
                self._image_drop.paths = [p for p in images if os.path.exists(p)]
                self._image_drop._refresh()
            messagebox.showinfo("Loaded", "Project loaded successfully.")
        except Exception as e:
            messagebox.showerror("Load failed", str(e))

    def _save_preset(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON preset", "*.json")],
        )
        if not path:
            return
        import json
        from dataclasses import asdict
        try:
            data = {"settings": asdict(self._gather_settings())}
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            messagebox.showinfo("Saved", f"Preset saved to {path}")
        except Exception as e:
            messagebox.showerror("Save failed", str(e))

    def _apply_settings(self, s: RenderSettings):
        res = f"{s.width}×{s.height}"
        if res in RESOLUTIONS:
            self._res_combo.set(res)
        self._fps_combo.set(str(s.fps))
        self._secs_slider.set(s.seconds_per_image)
        self._ai_auto.set(s.ai_auto)
        self._zoom_en.set(s.zoom_enabled)
        self._zoom_int.set(s.zoom_intensity)
        self._glow_en.set(s.glow_enabled)
        self._glow_int.set(s.glow_intensity)
        self._bloom_en.set(s.bloom_enabled)
        self._bloom_int.set(s.bloom_intensity)
        self._lens_flare.set(s.lens_flare)
        self._god_rays.set(s.god_rays)
        self._sun_rays.set(s.sun_rays)
        self._light_leak.set(s.light_leak)
        self._light_int.set(s.light_intensity)
        self._fog_en.set(s.fog_enabled)
        self._fog_dir.set(s.fog_direction)
        self._fog_min.set(s.fog_opacity_min)
        self._fog_max.set(s.fog_opacity_max)
        self._particles_en.set(s.particles_enabled)
        self._particle_type.set(s.particle_type)
        self._particle_count.set(float(s.particle_count))
        self._rain_en.set(s.rain_enabled)
        self._rain_int.set(s.rain_intensity)
        self._snow_en.set(s.snow_enabled)
        self._snow_int.set(s.snow_intensity)
        self._ripple_en.set(s.ripple_enabled)
        self._ripple_int.set(s.ripple_intensity)
        self._shake_en.set(s.camera_shake)
        self._shake_int.set(s.camera_shake_intensity)
        self._dof_en.set(s.depth_of_field)
        self._dof_int.set(s.dof_intensity)
        self._viz_en.set(s.viz_enabled)
        if s.viz_type in VIZ_TYPES:
            self._viz_type.set(s.viz_type)
        self._viz_alpha.set(s.viz_alpha)
        r, g, b = (s.viz_color if isinstance(s.viz_color, (list, tuple))
                   else (255, 255, 255))
        self._viz_r.set(float(r))
        self._viz_g.set(float(g))
        self._viz_b.set(float(b))
        if s.transition_type in TRANSITION_TYPES:
            self._trans_type.set(s.transition_type)
        self._trans_dur.set(s.transition_duration)
        self._quotes_en.set(s.quotes_enabled)
        self._quote_interval.set(s.quote_interval)
        self._text_pos.set(s.text_position)
        self._srt_entry.delete(0, "end")
        if s.subtitle_path:
            self._srt_entry.insert(0, s.subtitle_path)
        self._lut_entry.delete(0, "end")
        if s.lut_path:
            self._lut_entry.insert(0, s.lut_path)
        out_dir = self._out_entry.get()
        if s.output_dir and s.output_dir != out_dir:
            self._out_entry.delete(0, "end")
            self._out_entry.insert(0, s.output_dir)
