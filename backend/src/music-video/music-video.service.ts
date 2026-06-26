import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as (input: Buffer | string) => import('sharp').Sharp;
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

const POLLINATIONS_IMAGE = 'https://image.pollinations.ai/prompt';
const POLLINATIONS_TEXT = 'https://text.pollinations.ai';
const PANEL_COUNT = 12;
const PANEL_W = 1280;
const PANEL_H = 720;
const INTRO_DURATION = 5;

@Injectable()
export class MusicVideoService {
  async generateToFile(
    mp3Buffer: Buffer,
    text: string,
    title: string | undefined,
    onStep: (step: 1 | 2 | 3) => void,
  ): Promise<{ outputPath: string; tmpDir: string }> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-'));
    const mp3Path = path.join(tmpDir, 'audio.mp3');
    await fs.writeFile(mp3Path, mp3Buffer);

    onStep(1);
    const duration = await this.getAudioDuration(mp3Path);
    const analysis = await this.analyzeText(text);

    onStep(2);
    const panelPaths = await this.generatePanelImages(analysis, tmpDir);

    // Build intro title card from the first story-matched still cut
    let introPath: string | undefined;
    if (title?.trim() && panelPaths.length > 0) {
      introPath = await this.generateTitleCard(title.trim(), text, panelPaths[0], tmpDir);
    }

    onStep(3);
    const outputPath = path.join(tmpDir, 'output.mp4');
    await this.createVideo(panelPaths, mp3Path, duration, outputPath, introPath);

    return { outputPath, tmpDir };
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async generateTitleCard(
    title: string,
    text: string,
    firstPanelPath: string,
    tmpDir: string,
  ): Promise<string> {
    const shortDesc = text.split('\n').filter(Boolean).slice(0, 2).join(' · ').slice(0, 90);
    const safeTitle = this.escapeXml(title.slice(0, 55));
    const safeDesc = this.escapeXml(shortDesc);

    const svg = `<svg width="${PANEL_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="55%" stop-color="#000" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect width="${PANEL_W}" height="${PANEL_H}" fill="url(#g)"/>
      <text x="64" y="${PANEL_H - 100}" font-family="Arial Black,Arial,sans-serif" font-size="54" font-weight="bold" fill="white" opacity="0.97">${safeTitle}</text>
      <text x="64" y="${PANEL_H - 44}" font-family="Arial,sans-serif" font-size="26" fill="#e8e8e8" opacity="0.82">${safeDesc}</text>
    </svg>`;

    const cardPath = path.join(tmpDir, 'intro_card.jpg');
    await sharp(firstPanelPath)
      .composite([{ input: Buffer.from(svg), blend: 'over' }])
      .jpeg({ quality: 95 })
      .toFile(cardPath);
    return cardPath;
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

  private async generatePanelImages(analysis: AnalysisResult, tmpDir: string): Promise<string[]> {
    const { style, overallMood, panels } = analysis;

    const generateOne = async (panel: PanelScene, idx: number, attempt = 0): Promise<string> => {
      const prompt =
        `${panel.description}, ${style} art style, ${overallMood} mood, ` +
        `music video scene, cinematic composition, high resolution, detailed`;
      const url =
        `${POLLINATIONS_IMAGE}/${encodeURIComponent(prompt)}` +
        `?width=${PANEL_W}&height=${PANEL_H}&seed=${idx * 13 + 7}&model=flux&nologo=true&enhance=true`;

      try {
        const res = await axios.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 120000,
        });
        const panelPath = path.join(tmpDir, `panel_${idx}.jpg`);
        await sharp(Buffer.from(res.data))
          .resize(PANEL_W, PANEL_H, { fit: 'cover' })
          .jpeg({ quality: 95 })
          .toFile(panelPath);
        return panelPath;
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } }).response?.status;
        if (attempt < 3 && (status === 429 || status === 503 || status === 502)) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
          return generateOne(panel, idx, attempt + 1);
        }
        throw e;
      }
    };

    // Process in batches of 3 to stay under Pollinations rate limits
    const paths: string[] = new Array(panels.length) as string[];
    for (let i = 0; i < panels.length; i += 3) {
      const chunk = panels.slice(i, i + 3);
      const chunkPaths = await Promise.all(chunk.map((panel, j) => generateOne(panel, i + j)));
      chunkPaths.forEach((p, j) => { paths[i + j] = p; });
      if (i + 3 < panels.length) {
        await new Promise((r) => setTimeout(r, 500));
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
    introPath?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const panelCount = panelPaths.length;
      const panelDuration = totalDuration / panelCount;
      const dt = panelDuration.toFixed(3);

      const scaledW = 1664;
      const scaledH = 936;
      const maxPX = scaledW - 1280;
      const maxPY = scaledH - 720;

      const inputArgs: string[] = [];

      if (introPath) {
        inputArgs.push('-loop', '1', '-t', String(INTRO_DURATION), '-i', introPath);
      }

      panelPaths.forEach((p) => {
        inputArgs.push('-loop', '1', '-t', dt, '-i', p);
      });

      const panelOffset = introPath ? 1 : 0;
      const audioInputIdx = panelOffset + panelCount;

      const filterParts: string[] = [];

      // Intro card: subtle slow zoom-in for 5 seconds
      if (introPath) {
        const introPX = Math.floor(maxPX / 2);
        const introPY = Math.floor(maxPY / 2);
        filterParts.push(
          `[0:v]scale=${scaledW}:${scaledH},` +
          `crop=1280:720:x='${introPX}*t/${INTRO_DURATION}':y='${introPY}*t/${INTRO_DURATION}',` +
          `setpts=PTS-STARTPTS[v_intro]`,
        );
      }

      // Panel Ken Burns
      panelPaths.forEach((_, i) => {
        const inputIdx = panelOffset + i;
        const dir = i % 4;
        const cropX =
          dir === 0 ? `${maxPX}*t/${dt}` :
          dir === 1 ? `${maxPX}*(1-t/${dt})` :
          String(Math.floor(maxPX / 2));
        const cropY =
          dir === 2 ? `${maxPY}*t/${dt}` :
          dir === 3 ? `${maxPY}*(1-t/${dt})` :
          String(Math.floor(maxPY / 2));
        filterParts.push(
          `[${inputIdx}:v]scale=${scaledW}:${scaledH},` +
          `crop=1280:720:x='${cropX}':y='${cropY}',` +
          `setpts=PTS-STARTPTS[v${i}]`,
        );
      });

      const introConcat = introPath ? '[v_intro]' : '';
      const panelConcat = panelPaths.map((_, i) => `[v${i}]`).join('');
      const totalSegments = (introPath ? 1 : 0) + panelCount;

      // Delay audio by intro duration so it starts after the title card
      const audioFilter = introPath
        ? `; [${audioInputIdx}:a]adelay=${INTRO_DURATION * 1000}|${INTRO_DURATION * 1000}[audio]`
        : '';
      const audioMap = introPath ? '[audio]' : `${audioInputIdx}:a`;

      const filterComplex =
        filterParts.join('; ') +
        `; ${introConcat}${panelConcat}concat=n=${totalSegments}:v=1:a=0[video]` +
        audioFilter;

      const args = [
        '-y',
        ...inputArgs,
        '-i', audioPath,
        '-filter_complex', filterComplex,
        '-map', '[video]',
        '-map', audioMap,
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
