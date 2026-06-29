"""Librosa-based audio analyzer — returns per-frame audio data."""
from __future__ import annotations

import numpy as np
import librosa
from dataclasses import dataclass
from typing import Optional, Callable


@dataclass
class FrameAudioData:
    rms: float          # 0-1 overall loudness
    peak: float         # 0-1 peak amplitude
    bass: float         # 0-1  0–250 Hz
    mid: float          # 0-1  250–4000 Hz
    high: float         # 0-1  4000 Hz+
    beat: bool          # True on beat frame
    tempo: float        # BPM
    is_slow: bool       # True if tempo < 80 BPM
    instrument_type: str  # 'singing_bowl' | 'guitar' | 'general'


class AudioAnalyzer:
    def __init__(self, audio_path: str, fps: int = 30):
        self.audio_path = audio_path
        self.fps = fps
        self.y: Optional[np.ndarray] = None
        self.sr: Optional[int] = None
        self.frame_data: list[FrameAudioData] = []
        self.tempo: float = 0.0
        self.duration: float = 0.0

    def analyze(self, progress_cb: Optional[Callable[[float], None]] = None) -> list[FrameAudioData]:
        self.y, self.sr = librosa.load(self.audio_path, sr=None, mono=True)
        self.duration = float(librosa.get_duration(y=self.y, sr=self.sr))

        hop = int(self.sr / self.fps)

        # Tempo & beats
        tempo_arr, beat_frames = librosa.beat.beat_track(y=self.y, sr=self.sr)
        self.tempo = float(np.mean(tempo_arr)) if hasattr(tempo_arr, '__len__') else float(tempo_arr)
        beat_times = librosa.frames_to_time(beat_frames, sr=self.sr)

        # STFT magnitude
        stft = librosa.stft(self.y, hop_length=hop, n_fft=2048)
        mag = np.abs(stft)
        freqs = librosa.fft_frequencies(sr=self.sr, n_fft=2048)

        bass_m = freqs <= 250
        mid_m = (freqs > 250) & (freqs <= 4000)
        high_m = freqs > 4000

        n_stft = mag.shape[1]
        bass_e = mag[bass_m].mean(axis=0) if bass_m.any() else np.zeros(n_stft)
        mid_e  = mag[mid_m].mean(axis=0)  if mid_m.any()  else np.zeros(n_stft)
        high_e = mag[high_m].mean(axis=0) if high_m.any() else np.zeros(n_stft)

        rms_frames = librosa.feature.rms(y=self.y, hop_length=hop)[0]

        def norm(a: np.ndarray) -> np.ndarray:
            mn, mx = a.min(), a.max()
            return (a - mn) / (mx - mn + 1e-8)

        rms_n  = norm(rms_frames)
        bass_n = norm(bass_e)
        mid_n  = norm(mid_e)
        high_n = norm(high_e)

        # Instrument type: spectral centroid + bandwidth
        sc = librosa.feature.spectral_centroid(y=self.y, sr=self.sr, hop_length=hop)[0]
        sb = librosa.feature.spectral_bandwidth(y=self.y, sr=self.sr, hop_length=hop)[0]
        avg_c, avg_b = float(sc.mean()), float(sb.mean())

        if avg_c < 800 and avg_b < 1000:
            inst = 'singing_bowl'
        elif avg_c > 1500 or avg_b > 2000:
            inst = 'guitar'
        else:
            inst = 'general'

        is_slow = self.tempo < 80
        n_frames = int(self.duration * self.fps)
        self.frame_data = []

        for i in range(n_frames):
            t   = i / self.fps
            fi  = min(i, len(rms_n) - 1)
            is_beat = any(abs(t - bt) < (1.0 / self.fps) for bt in beat_times)

            self.frame_data.append(FrameAudioData(
                rms=float(rms_n[fi]),
                peak=float(rms_n[fi]),
                bass=float(bass_n[min(fi, len(bass_n)-1)]),
                mid=float(mid_n[min(fi, len(mid_n)-1)]),
                high=float(high_n[min(fi, len(high_n)-1)]),
                beat=is_beat,
                tempo=self.tempo,
                is_slow=is_slow,
                instrument_type=inst,
            ))

            if progress_cb and i % 100 == 0:
                progress_cb(i / n_frames * 0.2)

        return self.frame_data

    def get_spectrum_at_frame(self, frame_idx: int, n_bins: int = 64) -> np.ndarray:
        if self.y is None or self.sr is None:
            return np.zeros(n_bins)
        hop = int(self.sr / self.fps)
        start = frame_idx * hop
        chunk = self.y[start:min(start + hop * 4, len(self.y))]
        if len(chunk) < 256:
            chunk = np.pad(chunk, (0, 256 - len(chunk)))
        n_fft = min(1024, len(chunk))
        spec = np.abs(librosa.stft(chunk, n_fft=n_fft, hop_length=n_fft // 4))
        reduced = np.array([
            spec[j * len(spec) // n_bins:(j + 1) * len(spec) // n_bins].mean()
            for j in range(n_bins)
        ])
        mx = reduced.max()
        return reduced / (mx + 1e-8)

    def get_waveform(self, n_points: int = 1024) -> np.ndarray:
        if self.y is None:
            return np.zeros(n_points)
        idx = np.linspace(0, len(self.y) - 1, n_points).astype(int)
        return self.y[idx]
