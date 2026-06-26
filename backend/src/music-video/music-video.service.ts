import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { spawn } from 'child_process';
import axios from 'axios';

interface PanelScene {
  scene: number;
  description: string;
}

interface AnalysisResult {
  style: string;
  overallMood: string;
  panels: PanelScene[];
}

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

// 4 columns × 3 rows = 12 panels — smaller grid for faster generation & less memory
const GRID_COLS = 4;
const GRID_ROWS = 3;
const PANEL_COUNT = GRID_COLS * GRID_ROWS;
const PANEL_SIZE = 256;              // each cell 256×256
const GRID_W = GRID_COLS * PANEL_SIZE; // 1024
const GRID_H = GRID_ROWS * PANEL_SIZE; // 768

const POLLINATIONS_TEXT = 'https://text.pollinations.ai';

@Injectable()
export class MusicVideoService {
  /**
   * Runs generation and writes output.mp4 inside a tmpDir managed by the caller.
   * onStep(1|2|3) is called as each phase starts so the controller can track progress.
   * Returns { outputPath, tmpDir } — caller is responsible for cleanup.
   */
  async generateToFile(
    mp3Buffer: Buffer,
    text: string,
    onStep: (step: 1 | 2 | 3) => void,
  ): Promise<{ outputPath: string; tmpDir: string }> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-'));
    const mp3Path = path.join(tmpDir, 'audio.mp3');
    await fs.writeFile(mp3Path, mp3Buffer);

    onStep(1);
    const duration = await this.getAudioDuration(mp3Path);
    const analysis = await this.analyzeText(text);

    onStep(2);
    const gridImageBuffer = await this.generateGridImage(analysis);
    const panelPaths = await this.sliceGrid(gridImageBuffer, tmpDir);

    onStep(3);
    const outputPath = path.join(tmpDir, 'output.mp4');
    await this.createVideo(panelPaths, mp3Path, duration, outputPath);

    return { outputPath, tmpDir };
  }

  private buildScenePrompt(text: string): string {
    return `Analyze this song lyrics/text and create exactly 12 short visual scene descriptions for a music video storyboard.\n\nText: "${text.slice(0, 800)}"\n\nReturn ONLY valid JSON (no markdown):\n{\n  "style": "art style keyword (e.g. 'cinematic noir', 'anime', 'watercolor', 'vibrant pop art')",\n  "overallMood": "mood",\n  "panels": [\n    { "scene": 1, "description": "max 8 words, vivid visual" },\n    { "scene": 2, "description": "..." }\n  ]\n}\n\nProvide exactly 12 panels. Keep each description under 8 words. Focus on visual imagery.`;
  }

  private padPanels(result: AnalysisResult): AnalysisResult {
    while (result.panels.length < PANEL_COUNT) {
      const last = result.panels[result.panels.length - 1];
      result.panels.push({ scene: result.panels.length + 1, description: last?.description ?? 'vivid scene' });
    }
    result.panels = result.panels.slice(0, PANEL_COUNT);
    return result;
  }

  private fallbackAnalysis(text: string): AnalysisResult {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const panels: PanelScene[] = [];
    for (let i = 0; i < PANEL_COUNT; i++) {
      const lineIdx = Math.floor((i / PANEL_COUNT) * lines.length);
      const words = (lines[lineIdx] ?? `scene ${i + 1}`).split(/\s+/).slice(0, 8).join(' ');
      panels.push({ scene: i + 1, description: words });
    }
    return { style: 'cinematic', overallMood: 'emotional', panels };
  }

  private async analyzeText(text: string): Promise<AnalysisResult> {
    const prompt = this.buildScenePrompt(text);
    try {
      const res = await axios.get<string>(
        `${POLLINATIONS_TEXT}/${encodeURIComponent(prompt)}?model=openai&seed=42`,
        { timeout: 30000 },
      );
      const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON in response');
      const result = JSON.parse(jsonMatch[0]) as AnalysisResult;
      if (!Array.isArray(result.panels) || result.panels.length === 0) throw new Error('no panels');
      return this.padPanels(result);
    } catch {
      return this.fallbackAnalysis(text);
    }
  }

  private async generateGridImage(analysis: AnalysisResult): Promise<Buffer> {
    const { panels, style, overallMood } = analysis;
    const panelList = panels.map((p) => `${p.scene}.${p.description}`).join(', ');
    const prompt =
      `12-panel storyboard comic grid, 4 columns 3 rows, thin black borders separating panels, ` +
      `${style} art style, ${overallMood} mood, consistent visual style. ` +
      `Panels left-to-right top-to-bottom: ${panelList}. High quality illustration.`;

    const encodedPrompt = encodeURIComponent(prompt);
    const url =
      `${POLLINATIONS_BASE}/${encodedPrompt}` +
      `?width=${GRID_W}&height=${GRID_H}&seed=42&nologo=true&enhance=true`;

    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 90000,
    });

    return Buffer.from(res.data);
  }

  private async sliceGrid(imageBuffer: Buffer, tmpDir: string): Promise<string[]> {
    const resized = await (sharp as unknown as (input: Buffer) => sharp.Sharp)(imageBuffer)
      .resize(GRID_W, GRID_H, { fit: 'fill' })
      .toBuffer();

    const paths: string[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const panelPath = path.join(tmpDir, `panel_${idx}.jpg`);
        await (sharp as unknown as (input: Buffer) => sharp.Sharp)(resized)
          .extract({ left: col * PANEL_SIZE, top: row * PANEL_SIZE, width: PANEL_SIZE, height: PANEL_SIZE })
          .resize(1280, 720, { fit: 'cover' })
          .jpeg({ quality: 88 })
          .toFile(panelPath);
        paths.push(panelPath);
      }
    }
    return paths;
  }

  private getAudioDuration(mp3Path: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        mp3Path,
      ]);
      let stdout = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) return reject(new HttpException('ffprobe failed', HttpStatus.INTERNAL_SERVER_ERROR));
        const duration = parseFloat(stdout.trim());
        if (isNaN(duration)) return reject(new HttpException('Invalid audio duration', HttpStatus.INTERNAL_SERVER_ERROR));
        resolve(duration);
      });
    });
  }

  private createVideo(
    panelPaths: string[],
    audioPath: string,
    totalDuration: number,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const panelCount = panelPaths.length;
      const panelDuration = totalDuration / panelCount;
      const dt = panelDuration.toFixed(3);

      // Scale each panel 1.3× then crop with time-varying offset — same Ken Burns look
      // but processed as a vectorised crop instead of frame-by-frame zoompan (much faster)
      const scaledW = 1664; // 1280 * 1.3
      const scaledH = 936;  // 720  * 1.3
      const maxPX = scaledW - 1280; // 384
      const maxPY = scaledH - 720;  // 216

      const inputArgs: string[] = [];
      panelPaths.forEach((p) => {
        inputArgs.push('-loop', '1', '-t', dt, '-i', p);
      });

      const filterParts = panelPaths.map((_, i) => {
        const dir = i % 4;
        const cropX =
          dir === 0 ? `${maxPX}*t/${dt}` :
          dir === 1 ? `${maxPX}*(1-t/${dt})` :
          String(Math.floor(maxPX / 2));
        const cropY =
          dir === 2 ? `${maxPY}*t/${dt}` :
          dir === 3 ? `${maxPY}*(1-t/${dt})` :
          String(Math.floor(maxPY / 2));
        return (
          `[${i}:v]scale=${scaledW}:${scaledH},` +
          `crop=1280:720:x='${cropX}':y='${cropY}',` +
          `setpts=PTS-STARTPTS[v${i}]`
        );
      });

      const concatInputs = panelPaths.map((_, i) => `[v${i}]`).join('');
      const filterComplex = filterParts.join('; ') + `; ${concatInputs}concat=n=${panelCount}:v=1:a=0[video]`;

      const args = [
        '-y',
        ...inputArgs,
        '-i', audioPath,
        '-filter_complex', filterComplex,
        '-map', '[video]',
        '-map', `${panelCount}:a`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        outputPath,
      ];

      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new HttpException(
            `FFmpeg failed: ${stderr.slice(-500)}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          ));
        }
        resolve();
      });
    });
  }
}
