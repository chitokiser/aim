#!/usr/bin/env python3
"""
Shopping Short-Form Video Generator
------------------------------------
Put in one folder:
  - video clips (.mp4 .mov .avi .mkv)   ← one or many
  - narration .mp3 / .wav / .m4a
  - script .txt  (one sentence per line, or plain paragraph)

Output: shopping_short_YYYYMMDD_HHMMSS.mp4  (1080x1920, 9:16)
"""
import os
import sys
import re
import json
import shutil
import random
import argparse
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime

# ── FFmpeg path detection ─────────────────────────────────────────────────────
def _find_ffmpeg() -> tuple[str, str]:
    """Return (ffmpeg_path, ffprobe_path) — checks PATH then common install dirs."""
    import shutil as _sh
    ff = _sh.which("ffmpeg")
    fp = _sh.which("ffprobe")
    if ff and fp:
        return ff, fp
    # Common Windows install paths
    candidates = [
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "ffmpeg/bin",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Packages" ,
        Path("C:/ffmpeg/bin"),
        Path("C:/tools/ffmpeg/bin"),
    ]
    for d in candidates:
        f1 = d / "ffmpeg.exe"
        f2 = d / "ffprobe.exe"
        if f1.exists() and f2.exists():
            return str(f1), str(f2)
    # Check common winget install path patterns
    winget_base = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Packages"
    if winget_base.exists():
        for sub in winget_base.iterdir():
            if "ffmpeg" in sub.name.lower():
                for f in sub.rglob("ffmpeg.exe"):
                    fp_path = f.parent / "ffprobe.exe"
                    if fp_path.exists():
                        return str(f), str(fp_path)
    raise RuntimeError(
        "FFmpeg not found in PATH or common locations.\n"
        "Install FFmpeg:\n"
        "  Windows: run install_ffmpeg.bat  OR  winget install Gyan.FFmpeg\n"
        "  Mac:     brew install ffmpeg\n"
        "  Linux:   sudo apt install ffmpeg"
    )

FFMPEG, FFPROBE = "", ""

def _init_ffmpeg():
    global FFMPEG, FFPROBE
    if not FFMPEG:
        FFMPEG, FFPROBE = _find_ffmpeg()

# ── constants ────────────────────────────────────────────────────────────────
W, H = 1080, 1920          # 9:16 shorts format
FPS = 30
SUBTITLE_FONT = "Malgun Gothic"   # Windows KR font; change to "NotoSansCJK" on Linux
SUBTITLE_SIZE = 24
SUBTITLE_MARGIN_V = 100          # pixels from bottom

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm", ".MP4", ".MOV"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}


# ── ffprobe helpers ──────────────────────────────────────────────────────────
def _ffprobe(path: Path) -> dict:
    _init_ffmpeg()
    cmd = [
        FFPROBE, "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        str(path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError(f"ffprobe error on {path.name}:\n{r.stderr}")
    return json.loads(r.stdout)


def get_duration(path: Path) -> float:
    info = _ffprobe(path)
    d = info.get("format", {}).get("duration")
    if d:
        return float(d)
    for s in info.get("streams", []):
        if "duration" in s:
            return float(s["duration"])
    raise RuntimeError(f"Cannot get duration: {path}")


def get_video_info(path: Path):
    """Returns (width, height, has_audio)"""
    info = _ffprobe(path)
    w = h = None
    has_audio = False
    for s in info.get("streams", []):
        if s.get("codec_type") == "video":
            w, h = int(s["width"]), int(s["height"])
        elif s.get("codec_type") == "audio":
            has_audio = True
    if w is None:
        raise RuntimeError(f"No video stream: {path}")
    return w, h, has_audio


# ── folder scanner ───────────────────────────────────────────────────────────
def scan_folder(folder: Path):
    videos, audios, scripts = [], [], []
    for f in sorted(folder.iterdir()):
        if not f.is_file():
            continue
        ext = f.suffix.lower()
        if ext in {e.lower() for e in VIDEO_EXTS}:
            videos.append(f)
        elif ext in AUDIO_EXTS:
            audios.append(f)
        elif ext == ".txt":
            scripts.append(f)
    return videos, audios, scripts


def pick_narration(audios: list[Path]) -> Path | None:
    """Return first audio that doesn't look like BGM."""
    bgm_hints = {"bgm", "music", "bg", "background", "instrumental"}
    for a in audios:
        if not any(h in a.stem.lower() for h in bgm_hints):
            return a
    return audios[0] if audios else None


# ── subtitle generator ───────────────────────────────────────────────────────
def _to_srt_ts(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec % 1) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def make_srt(script_path: Path, total_dur: float) -> str:
    """
    Split script into display chunks and assign proportional time slots.
    Weight per chunk = character count (longer sentences get more time).
    Keeps lines under ~25 chars for readability on mobile.
    """
    raw = script_path.read_text(encoding="utf-8").strip()

    # Split by sentence ending punctuation or explicit newlines
    parts = re.split(r"(?<=[.!?。！？\n])\s*", raw)
    chunks = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # Break very long chunks at ~50 chars so subtitle isn't huge
        while len(p) > 55:
            split_at = p.rfind(" ", 0, 55) or p.rfind(",", 0, 55) or 55
            chunks.append(p[:split_at].strip())
            p = p[split_at:].strip()
        if p:
            chunks.append(p)

    if not chunks:
        return ""

    weights = [max(len(c), 5) for c in chunks]
    total_w = sum(weights)

    lines = []
    t = 0.0
    for i, (chunk, w) in enumerate(zip(chunks, weights), 1):
        dur = (w / total_w) * total_dur
        end = min(t + dur - 0.05, total_dur - 0.05)
        lines += [
            str(i),
            f"{_to_srt_ts(t)} --> {_to_srt_ts(end)}",
            chunk,
            "",
        ]
        t += dur

    return "\n".join(lines)


# ── ASS subtitle file (better styling than SRT) ──────────────────────────────
def srt_to_ass(srt_text: str, font: str, size: int, margin_v: int) -> str:
    """Convert SRT to ASS with custom style."""
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Default,{font},{size},&H00FFFFFF,&H00000000,&H80000000,1,0,3,2,1,2,30,30,{margin_v}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    def srt_ts_to_ass(ts: str) -> str:
        # SRT: 00:00:01,500  →  ASS: 0:00:01.50
        h, rest = ts.split(":", 1)
        m, rest2 = rest.split(":", 1)
        s, ms = rest2.split(",")
        return f"{int(h)}:{m}:{s}.{ms[:2]}"

    events = []
    blocks = [b.strip() for b in srt_text.strip().split("\n\n") if b.strip()]
    for block in blocks:
        blines = block.splitlines()
        if len(blines) < 3:
            continue
        times = blines[1].split(" --> ")
        if len(times) != 2:
            continue
        start = srt_ts_to_ass(times[0].strip())
        end = srt_ts_to_ass(times[1].strip())
        text = r"\N".join(blines[2:])
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


# ── ffmpeg runner ─────────────────────────────────────────────────────────────
def _run(cmd: list, label: str = "", capture: bool = False):
    _init_ffmpeg()
    # Replace "ffmpeg"/"ffprobe" token with resolved path
    resolved = []
    for c in cmd:
        cs = str(c)
        if cs == "ffmpeg":
            resolved.append(FFMPEG)
        elif cs == "ffprobe":
            resolved.append(FFPROBE)
        else:
            resolved.append(cs)
    if not capture:
        print(f"  ▶ {label or ' '.join(resolved[:4])}")
    r = subprocess.run(
        resolved,
        capture_output=capture,
        text=capture,
        encoding="utf-8" if capture else None,
    )
    if r.returncode != 0:
        err = r.stderr if capture else "(see above)"
        raise RuntimeError(f"FFmpeg failed [{label}]:\n{err[-2000:]}")
    return r


# ── main build pipeline ──────────────────────────────────────────────────────
def build(
    clips: list[Path],
    narration: Path,
    ass_path: Path | None,
    output: Path,
    shuffle: bool = False,
    bgm: Path | None = None,
    progress=None,  # optional callback(step, total, msg)
):
    def log(msg: str, step=None, total=None):
        print(msg)
        if progress:
            progress(step, total, msg)

    if shuffle:
        random.shuffle(clips)

    narr_dur = get_duration(narration)
    log(f"🎙  Narration duration: {narr_dur:.1f}s", 1, 5)

    tmpdir = Path(tempfile.mkdtemp(prefix="shopping_short_"))
    try:
        # ── Phase 1: pre-process each clip (scale+crop to 9:16, strip audio) ──
        log(f"🎬 Pre-processing {len(clips)} clip(s)...", 2, 5)
        processed: list[Path] = []
        for i, clip in enumerate(clips):
            out = tmpdir / f"clip_{i:03d}.mp4"
            cw, ch, _ = get_video_info(clip)
            # Scale: cover 1080x1920, then center crop
            # If source is landscape (16:9): scale width=1080 → height will be 607 → not enough
            # Need to scale so min(W/cw, H/ch) fills the frame
            vf = (
                f"scale='if(gt(iw/ih,{W}/{H}),{W},-2)':'if(gt(iw/ih,{W}/{H}),-2,{H})',"
                f"crop={W}:{H}:(iw-{W})/2:(ih-{H})/2,"
                f"fps={FPS},setsar=1"
            )
            _run(
                ["ffmpeg", "-y", "-i", clip,
                 "-vf", vf,
                 "-an",
                 "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                 "-pix_fmt", "yuv420p",
                 out],
                label=f"clip {i+1}/{len(clips)}: {clip.name}",
                capture=True,
            )
            processed.append(out)
            log(f"   ✓ {clip.name}", 2, 5)

        # ── Phase 2: concat loop until ≥ narration duration ──
        log("🔗 Assembling clip sequence...", 3, 5)
        concat_txt = tmpdir / "concat.txt"
        total = 0.0
        concat_lines = []
        idx = 0
        while total < narr_dur + 0.5:
            p = processed[idx % len(processed)]
            concat_lines.append(f"file '{p.as_posix()}'")
            total += get_duration(p)
            idx += 1

        concat_txt.write_text("\n".join(concat_lines), encoding="utf-8")

        merged = tmpdir / "merged.mp4"
        _run(
            ["ffmpeg", "-y",
             "-f", "concat", "-safe", "0", "-i", concat_txt,
             "-t", str(narr_dur),
             "-c", "copy",
             merged],
            label="concat clips",
            capture=True,
        )

        # ── Phase 3: final encode — video + narration + subtitles ──
        log("🎞  Final encode (audio + subtitles)...", 4, 5)

        # Build audio filter
        inputs = ["-i", merged, "-i", narration]
        if bgm:
            inputs += ["-i", bgm]
            audio_filter = (
                "[1:a]volume=1.0[narr];"
                "[2:a]volume=0.12,aloop=loop=-1:size=2147483647[bg];"
                "[narr][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]"
            )
        else:
            audio_filter = "[1:a]volume=1.0[aout]"

        # Build video filter (subtitles)
        vf_parts = []
        if ass_path:
            # Use ASS filter — works cross-platform without font path issues
            ass_posix = ass_path.as_posix().replace(":", "\\:")
            vf_parts.append(f"ass='{ass_posix}'")

        cmd = [
            "ffmpeg", "-y",
            *inputs,
            "-filter_complex", audio_filter,
            "-map", "0:v",
            "-map", "[aout]",
        ]
        if vf_parts:
            cmd += ["-vf", ",".join(vf_parts)]

        cmd += [
            "-c:v", "libx264", "-preset", "fast", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            output,
        ]
        _run(cmd, label="final encode", capture=True)

        log(f"✅ Done!  →  {output}", 5, 5)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ── CLI entry point ───────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description="Shopping short-form video generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python make_short.py ./my_product/
  python make_short.py ./clips/ --shuffle --bgm ./bgm.mp3
  python make_short.py ./clips/ --no-subs --output final.mp4
        """,
    )
    ap.add_argument("folder", help="Folder containing video clips, narration audio, and script.txt")
    ap.add_argument("--shuffle", action="store_true", help="Randomize clip order")
    ap.add_argument("--bgm", help="Background music file (mixed at -18dB under narration)")
    ap.add_argument("--no-subs", action="store_true", help="Skip subtitle generation")
    ap.add_argument("--font", default=SUBTITLE_FONT, help=f"Subtitle font name (default: {SUBTITLE_FONT})")
    ap.add_argument("--font-size", type=int, default=SUBTITLE_SIZE)
    ap.add_argument("--output", "-o", help="Output file path (default: shopping_short_<timestamp>.mp4 in input folder)")
    args = ap.parse_args()

    folder = Path(args.folder).resolve()
    if not folder.is_dir():
        print(f"❌  Not a directory: {folder}")
        sys.exit(1)

    videos, audios, scripts = scan_folder(folder)
    narration = pick_narration(audios)

    print(f"\n📁  Input folder: {folder}")
    print(f"🎬  Video clips  : {len(videos)}")
    for v in videos:
        print(f"     • {v.name}")
    print(f"🎙  Narration    : {narration.name if narration else '❌ NOT FOUND'}")
    print(f"📝  Script       : {scripts[0].name if scripts else '(none)'}")
    print()

    if not videos:
        print("❌  No video files found. Supported: .mp4 .mov .avi .mkv .m4v")
        sys.exit(1)
    if not narration:
        print("❌  No audio file found. Supported: .mp3 .wav .m4a .aac")
        sys.exit(1)

    # Generate ASS subtitles
    ass_path = None
    if scripts and not args.no_subs:
        narr_dur = get_duration(narration)
        srt_text = make_srt(scripts[0], narr_dur)
        if srt_text:
            ass_text = srt_to_ass(srt_text, args.font, args.font_size, SUBTITLE_MARGIN_V)
            ass_path = folder / "_subtitles.ass"
            ass_path.write_text(ass_text, encoding="utf-8")
            print(f"📄  Subtitles generated: {scripts[0].name} → {ass_path.name}")

    output = Path(args.output) if args.output else folder / f"shopping_short_{datetime.now():%Y%m%d_%H%M%S}.mp4"
    bgm = Path(args.bgm) if args.bgm else None

    print(f"🚀  Output: {output.name}\n")

    build(
        clips=videos,
        narration=narration,
        ass_path=ass_path,
        output=output,
        shuffle=args.shuffle,
        bgm=bgm,
    )

    # Clean up temp ASS
    if ass_path and ass_path.exists():
        ass_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
