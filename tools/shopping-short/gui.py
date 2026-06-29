#!/usr/bin/env python3
"""
Shopping Short-Form GUI
Double-click to run. No command line needed.
"""
import os
import sys
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path

# Import core logic
sys.path.insert(0, str(Path(__file__).parent))
from make_short import scan_folder, pick_narration, get_duration, make_srt, srt_to_ass, build


BG = "#111111"
BG2 = "#1e1e1e"
ACCENT = "#7c3aed"
ACCENT2 = "#06b6d4"
TEXT = "#f0f0f0"
MUTED = "#888888"
GREEN = "#22c55e"
RED = "#ef4444"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("쇼핑 숏폼 생성기")
        self.geometry("620x720")
        self.resizable(False, False)
        self.configure(bg=BG)

        self._folder = tk.StringVar()
        self._bgm = tk.StringVar()
        self._output = tk.StringVar()
        self._shuffle = tk.BooleanVar(value=False)
        self._no_subs = tk.BooleanVar(value=False)
        self._font_size = tk.IntVar(value=24)

        self._build_ui()

    # ── UI ──────────────────────────────────────────────────────────────────
    def _build_ui(self):
        pad = dict(padx=20, pady=6)

        # Title
        tk.Label(self, text="🎬 쇼핑 숏폼 생성기", font=("Malgun Gothic", 18, "bold"),
                 bg=BG, fg=TEXT).pack(pady=(20, 4))
        tk.Label(self, text="영상 + 나레이션MP3 + 대본TXT 폴더를 선택하세요",
                 font=("Malgun Gothic", 10), bg=BG, fg=MUTED).pack(pady=(0, 16))

        # ── Folder picker ───────────────────────────────────────────────────
        self._section("📁 입력 폴더")
        row = tk.Frame(self, bg=BG)
        row.pack(fill="x", **pad)
        tk.Entry(row, textvariable=self._folder, bg=BG2, fg=TEXT,
                 insertbackground=TEXT, font=("Consolas", 9),
                 relief="flat", bd=8).pack(side="left", fill="x", expand=True)
        self._btn(row, "폴더 선택", self._pick_folder).pack(side="right", padx=(8, 0))

        # ── File preview ────────────────────────────────────────────────────
        self._preview_frame = tk.Frame(self, bg=BG2, relief="flat")
        self._preview_frame.pack(fill="x", padx=20, pady=4)
        self._preview_label = tk.Label(self._preview_frame, text="",
                                       font=("Consolas", 8), bg=BG2, fg=MUTED,
                                       justify="left", anchor="w", wraplength=560)
        self._preview_label.pack(padx=10, pady=8, fill="x")

        # ── BGM (optional) ──────────────────────────────────────────────────
        self._section("🎵 배경음악 (선택사항)")
        row2 = tk.Frame(self, bg=BG)
        row2.pack(fill="x", **pad)
        tk.Entry(row2, textvariable=self._bgm, bg=BG2, fg=TEXT,
                 insertbackground=TEXT, font=("Consolas", 9),
                 relief="flat", bd=8).pack(side="left", fill="x", expand=True)
        self._btn(row2, "BGM 선택", self._pick_bgm).pack(side="right", padx=(8, 0))

        # ── Output ──────────────────────────────────────────────────────────
        self._section("💾 출력 파일 (선택사항 — 비워두면 입력폴더에 자동 저장)")
        row3 = tk.Frame(self, bg=BG)
        row3.pack(fill="x", **pad)
        tk.Entry(row3, textvariable=self._output, bg=BG2, fg=TEXT,
                 insertbackground=TEXT, font=("Consolas", 9),
                 relief="flat", bd=8).pack(side="left", fill="x", expand=True)
        self._btn(row3, "저장 위치", self._pick_output).pack(side="right", padx=(8, 0))

        # ── Options ─────────────────────────────────────────────────────────
        self._section("⚙️ 옵션")
        opts = tk.Frame(self, bg=BG)
        opts.pack(fill="x", padx=20)

        tk.Checkbutton(opts, text="클립 순서 랜덤 섞기", variable=self._shuffle,
                       bg=BG, fg=TEXT, selectcolor=BG2, activebackground=BG,
                       activeforeground=TEXT, font=("Malgun Gothic", 10)).grid(row=0, column=0, sticky="w")
        tk.Checkbutton(opts, text="자막 없이 출력", variable=self._no_subs,
                       bg=BG, fg=TEXT, selectcolor=BG2, activebackground=BG,
                       activeforeground=TEXT, font=("Malgun Gothic", 10)).grid(row=0, column=1, sticky="w", padx=20)

        tk.Label(opts, text="자막 폰트 크기:", bg=BG, fg=MUTED,
                 font=("Malgun Gothic", 9)).grid(row=1, column=0, sticky="w", pady=(8, 0))
        tk.Spinbox(opts, from_=14, to=40, textvariable=self._font_size,
                   width=5, bg=BG2, fg=TEXT, buttonbackground=BG2,
                   relief="flat").grid(row=1, column=1, sticky="w", padx=20, pady=(8, 0))

        # ── Generate button ──────────────────────────────────────────────────
        tk.Frame(self, bg=BG, height=16).pack()
        self._gen_btn = tk.Button(
            self, text="🚀  쇼핑 숏폼 생성",
            font=("Malgun Gothic", 13, "bold"),
            bg=ACCENT, fg="white", activebackground="#6d28d9", activeforeground="white",
            relief="flat", padx=28, pady=12, cursor="hand2",
            command=self._generate,
        )
        self._gen_btn.pack()

        # ── Progress ─────────────────────────────────────────────────────────
        self._progress_var = tk.DoubleVar()
        self._progress = ttk.Progressbar(self, variable=self._progress_var,
                                         maximum=5, length=560)
        ttk.Style().configure("TProgressbar", troughcolor=BG2, background=ACCENT2)
        self._progress.pack(padx=20, pady=(14, 4))

        # ── Log ──────────────────────────────────────────────────────────────
        self._log = tk.Text(self, height=9, bg=BG2, fg=TEXT,
                            font=("Consolas", 8), relief="flat",
                            state="disabled", wrap="word")
        self._log.pack(fill="x", padx=20, pady=(4, 20))
        self._log.tag_configure("ok", foreground=GREEN)
        self._log.tag_configure("err", foreground=RED)

    def _section(self, label: str):
        tk.Label(self, text=label, font=("Malgun Gothic", 9, "bold"),
                 bg=BG, fg=MUTED).pack(anchor="w", padx=20, pady=(12, 2))

    def _btn(self, parent, text, cmd):
        return tk.Button(parent, text=text, command=cmd,
                         font=("Malgun Gothic", 9),
                         bg=BG2, fg=TEXT, activebackground="#333",
                         activeforeground=TEXT, relief="flat", padx=10, pady=4,
                         cursor="hand2")

    # ── actions ─────────────────────────────────────────────────────────────
    def _pick_folder(self):
        d = filedialog.askdirectory(title="입력 폴더 선택")
        if d:
            self._folder.set(d)
            self._refresh_preview(Path(d))

    def _pick_bgm(self):
        f = filedialog.askopenfilename(
            title="배경음악 선택",
            filetypes=[("Audio", "*.mp3 *.wav *.m4a *.aac"), ("All", "*.*")]
        )
        if f:
            self._bgm.set(f)

    def _pick_output(self):
        f = filedialog.asksaveasfilename(
            title="출력 파일",
            defaultextension=".mp4",
            filetypes=[("MP4 Video", "*.mp4")]
        )
        if f:
            self._output.set(f)

    def _refresh_preview(self, folder: Path):
        videos, audios, scripts = scan_folder(folder)
        narration = pick_narration(audios)
        lines = []
        for v in videos:
            lines.append(f"  🎬 {v.name}")
        if narration:
            lines.append(f"  🎙 {narration.name}")
        else:
            lines.append("  ❌ 나레이션 MP3 없음!")
        if scripts:
            lines.append(f"  📝 {scripts[0].name}")
        else:
            lines.append("  ⚠️  script.txt 없음 (자막 생략)")
        self._preview_label.config(text="\n".join(lines))

    def _log_write(self, msg: str, tag: str = ""):
        self._log.config(state="normal")
        self._log.insert("end", msg + "\n", tag)
        self._log.see("end")
        self._log.config(state="disabled")

    def _set_progress(self, step, total, msg):
        if step is not None:
            self._progress_var.set(step)
        if msg:
            tag = "ok" if "✅" in msg or "✓" in msg else ("err" if "❌" in msg else "")
            self._log_write(msg, tag)
        self.update_idletasks()

    def _generate(self):
        folder_str = self._folder.get().strip()
        if not folder_str:
            messagebox.showerror("오류", "입력 폴더를 선택해주세요.")
            return

        folder = Path(folder_str)
        videos, audios, scripts = scan_folder(folder)
        narration = pick_narration(audios)

        if not videos:
            messagebox.showerror("오류", "영상 파일이 없습니다.\n.mp4 .mov .avi 파일을 폴더에 넣어주세요.")
            return
        if not narration:
            messagebox.showerror("오류", "나레이션 오디오 파일이 없습니다.\n.mp3 파일을 폴더에 넣어주세요.")
            return

        self._gen_btn.config(state="disabled", text="⏳ 생성 중...")
        self._log.config(state="normal")
        self._log.delete("1.0", "end")
        self._log.config(state="disabled")
        self._progress_var.set(0)

        def run():
            try:
                ass_path = None
                if scripts and not self._no_subs.get():
                    narr_dur = get_duration(narration)
                    srt_text = make_srt(scripts[0], narr_dur)
                    if srt_text:
                        ass_text = srt_to_ass(srt_text, "Malgun Gothic",
                                              self._font_size.get(), 100)
                        ass_path = folder / "_subtitles.ass"
                        ass_path.write_text(ass_text, encoding="utf-8")

                from datetime import datetime
                output_str = self._output.get().strip()
                output = Path(output_str) if output_str else \
                    folder / f"shopping_short_{datetime.now():%Y%m%d_%H%M%S}.mp4"

                bgm_str = self._bgm.get().strip()
                bgm = Path(bgm_str) if bgm_str else None

                build(
                    clips=videos,
                    narration=narration,
                    ass_path=ass_path,
                    output=output,
                    shuffle=self._shuffle.get(),
                    bgm=bgm,
                    progress=lambda s, t, m: self.after(0, self._set_progress, s, t, m),
                )

                if ass_path and ass_path.exists():
                    ass_path.unlink(missing_ok=True)

                self.after(0, lambda: messagebox.showinfo(
                    "완료!", f"영상 생성 완료!\n\n{output}"
                ))
            except Exception as e:
                self.after(0, lambda err=str(e): (
                    self._log_write(f"❌ 오류: {err}", "err"),
                    messagebox.showerror("오류 발생", err)
                ))
            finally:
                self.after(0, lambda: self._gen_btn.config(
                    state="normal", text="🚀  쇼핑 숏폼 생성"
                ))

        threading.Thread(target=run, daemon=True).start()


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
