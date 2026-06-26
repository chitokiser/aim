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

export type AspectRatio = '16:9' | '9:16';

const POLLINATIONS_IMAGE = 'https://image.pollinations.ai/prompt';
const POLLINATIONS_TEXT = 'https://text.pollinations.ai';
const PANEL_COUNT = 12;
const INTRO_DURATION = 5;

function dims(ratio: AspectRatio): { w: number; h: number } {
  return ratio === '9:16' ? { w: 720, h: 1280 } : { w: 1280, h: 720 };
}

@Injectable()
export class MusicVideoService {
  async generateToFile(
    mp3Buffer: Buffer,
    text: string,
    title: string | undefined,
    ratio: AspectRatio,
    userImages: Buffer[],
    onStep: (step: 1 | 2 | 3) => void,
  ): Promise<{ outputPath: string; tmpDir: string; thumbnailPath: string }> {
    const { w: panelW, h: panelH } = dims(ratio);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-'));
    const mp3Path = path.join(tmpDir, 'audio.mp3');
    await fs.writeFile(mp3Path, mp3Buffer);

    onStep(1);
    const duration = await this.getAudioDuration(mp3Path);
    const analysis = await this.analyzeText(text);

    onStep(2);
    const panelPaths = await this.generatePanelImages(analysis, tmpDir, panelW, panelH, userImages);

    // Build intro title card from the first still cut (clean, no text overlay)
    let introPath: string | undefined;
    if (title?.trim() && panelPaths.length > 0) {
      introPath = await this.generateTitleCard(title.trim(), text, panelPaths[0], tmpDir, panelW, panelH);
    }

    // Thumbnail: intro card preferred, else first panel
    const thumbSrc = introPath ?? panelPaths[0];
    const thumbnailPath = path.join(os.tmpdir(), `mv-thumb-${Date.now()}.jpg`);
    await fs.copyFile(thumbSrc, thumbnailPath);

    onStep(3);
    const outputPath = path.join(tmpDir, 'output.mp4');
    await this.createVideo(panelPaths, mp3Path, duration, outputPath, panelW, panelH, introPath);

    return { outputPath, tmpDir, thumbnailPath };
  }

  private splitLyricsIntoChunks(text: string, count: number): string[] {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return new Array(count).fill('') as string[];
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const start = Math.floor((i / count) * lines.length);
      const end = Math.ceil(((i + 1) / count) * lines.length);
      chunks.push(lines.slice(start, end).slice(0, 2).join('\n'));
    }
    return chunks;
  }

  private async overlayLyricsOnPanels(
    text: string,
    panelPaths: string[],
    tmpDir: string,
    panelW: number,
    panelH: number,
  ): Promise<string[]> {
    const chunks = this.splitLyricsIntoChunks(text, panelPaths.length);
    const result: string[] = [];

    for (let i = 0; i < panelPaths.length; i++) {
      const chunk = chunks[i];
      if (!chunk.trim()) {
        result.push(panelPaths[i]);
        continue;
      }

      const lines = chunk.split('\n').filter(Boolean);
      const maxChars = panelW >= 1000 ? 56 : 40;
      const fontSize = panelW >= 1000 ? 36 : 32;
      const lineHeight = fontSize + 12;
      const totalTextH = lines.length * lineHeight;
      const startY = panelH - 60 - totalTextH;
      const gradTop = Math.max(0, Math.floor(((startY - 20) / panelH) * 100));

      const textElems = lines
        .map(
          (line, li) =>
            `<text x="${panelW / 2}" y="${startY + li * lineHeight}" ` +
            `text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" ` +
            `fill="white" font-weight="600" ` +
            `paint-order="stroke" stroke="#000" stroke-width="3" stroke-linejoin="round">` +
            `${this.escapeXml(line.slice(0, maxChars))}</text>`,
        )
        .join('\n');

      const svg = `<svg width="${panelW}" height="${panelH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lg${i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="${gradTop}%" stop-color="#000" stop-opacity="0"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
          </linearGradient>
        </defs>
        <rect width="${panelW}" height="${panelH}" fill="url(#lg${i})"/>
        ${textElems}
      </svg>`;

      const outPath = path.join(tmpDir, `panel_${i}_lyr.jpg`);
      await sharp(panelPaths[i])
        .composite([{ input: Buffer.from(svg), blend: 'over' }])
        .jpeg({ quality: 92 })
        .toFile(outPath);
      result.push(outPath);
    }

    return result;
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
    panelW: number,
    panelH: number,
  ): Promise<string> {
    const shortDesc = text.split('\n').filter(Boolean).slice(0, 2).join(' · ').slice(0, 90);
    const titleFontSize = panelW >= 1000 ? 54 : 36;
    const descFontSize = panelW >= 1000 ? 26 : 20;
    const titleMaxChars = panelW >= 1000 ? 55 : 35;
    const safeTitle = this.escapeXml(title.slice(0, titleMaxChars));
    const safeDesc = this.escapeXml(shortDesc.slice(0, panelW >= 1000 ? 90 : 55));

    const svg = `<svg width="${panelW}" height="${panelH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="55%" stop-color="#000" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect width="${panelW}" height="${panelH}" fill="url(#g)"/>
      <text x="64" y="${panelH - 100}" font-family="Arial Black,Arial,sans-serif" font-size="${titleFontSize}" font-weight="bold" fill="white" opacity="0.97">${safeTitle}</text>
      <text x="64" y="${panelH - 44}" font-family="Arial,sans-serif" font-size="${descFontSize}" fill="#e8e8e8" opacity="0.82">${safeDesc}</text>
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

  private async generatePanelImages(
    analysis: AnalysisResult,
    tmpDir: string,
    panelW: number,
    panelH: number,
    userImages: Buffer[] = [],
  ): Promise<string[]> {
    const { style, overallMood, panels } = analysis;

    const saveUserImage = async (imgBuffer: Buffer, idx: number): Promise<string> => {
      const panelPath = path.join(tmpDir, `panel_${idx}.jpg`);
      await sharp(imgBuffer)
        .resize(panelW, panelH, { fit: 'cover' })
        .jpeg({ quality: 95 })
        .toFile(panelPath);
      return panelPath;
    };

    const generateOne = async (panel: PanelScene, idx: number, attempt = 0): Promise<string> => {
      const prompt =
        `${panel.description}, ${style} art style, ${overallMood} mood, ` +
        `music video scene, cinematic composition, high resolution, detailed`;
      const url =
        `${POLLINATIONS_IMAGE}/${encodeURIComponent(prompt)}` +
        `?width=${panelW}&height=${panelH}&seed=${idx * 13 + 7}&model=flux&nologo=true&enhance=true`;

      try {
        const res = await axios.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 120000,
        });
        const panelPath = path.join(tmpDir, `panel_${idx}.jpg`);
        await sharp(Buffer.from(res.data))
          .resize(panelW, panelH, { fit: 'cover' })
          .jpeg({ quality: 95 })
          .toFile(panelPath);
        return panelPath;
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } }).response?.status;
        if (attempt < 5 && (status === 429 || status === 503 || status === 502)) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
          return generateOne(panel, idx, attempt + 1);
        }
        throw e;
      }
    };

    // Use user-uploaded images first; AI-generate the rest sequentially
    const paths: string[] = [];
    let aiRequestCount = 0;
    for (let i = 0; i < panels.length; i++) {
      if (userImages[i]) {
        paths.push(await saveUserImage(userImages[i], i));
      } else {
        if (aiRequestCount > 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        paths.push(await generateOne(panels[i], i));
        aiRequestCount++;
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
    panelW: number,
    panelH: number,
    introPath?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const panelCount = panelPaths.length;
      const panelDuration = totalDuration / panelCount;
      const dt = panelDuration.toFixed(3);

      const scaledW = Math.round(panelW * 1.3);
      const scaledH = Math.round(panelH * 1.3);
      const maxPX = scaledW - panelW;
      const maxPY = scaledH - panelH;

      const inputArgs: string[] = [];

      if (introPath) {
        inputArgs.push('-r', '25', '-loop', '1', '-t', String(INTRO_DURATION), '-i', introPath);
      }

      panelPaths.forEach((p) => {
        inputArgs.push('-r', '25', '-loop', '1', '-t', dt, '-i', p);
      });

      const panelOffset = introPath ? 1 : 0;
      const audioInputIdx = panelOffset + panelCount;

      const filterParts: string[] = [];

      if (introPath) {
        const introPX = Math.floor(maxPX / 2);
        const introPY = Math.floor(maxPY / 2);
        filterParts.push(
          `[0:v]scale=${scaledW}:${scaledH},` +
          `crop=${panelW}:${panelH}:x='${introPX}*t/${INTRO_DURATION}':y='${introPY}*t/${INTRO_DURATION}',` +
          `setpts=PTS-STARTPTS[v_intro]`,
        );
      }

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
          `crop=${panelW}:${panelH}:x='${cropX}':y='${cropY}',` +
          `setpts=PTS-STARTPTS[v${i}]`,
        );
      });

      const introConcat = introPath ? '[v_intro]' : '';
      const panelConcat = panelPaths.map((_, i) => `[v${i}]`).join('');
      const totalSegments = (introPath ? 1 : 0) + panelCount;

      const audioMap = `${audioInputIdx}:a`;

      const filterComplex =
        filterParts.join('; ') +
        `; ${introConcat}${panelConcat}concat=n=${totalSegments}:v=1:a=0[video]`;

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
        '-r', '25',
        '-g', '50',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
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
