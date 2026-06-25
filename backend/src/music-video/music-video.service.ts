import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { spawn } from 'child_process';
import axios from 'axios';

interface PanelScene {
  scene: number;
  description: string; // short, ≤10 words
}

interface AnalysisResult {
  style: string;
  overallMood: string;
  panels: PanelScene[];
}

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

// 4 columns × 3 rows = 12 panels
const GRID_COLS = 4;
const GRID_ROWS = 3;
const PANEL_COUNT = GRID_COLS * GRID_ROWS;
const PANEL_SIZE = 512;
const GRID_W = GRID_COLS * PANEL_SIZE; // 2048
const GRID_H = GRID_ROWS * PANEL_SIZE; // 1536

@Injectable()
export class MusicVideoService {
  private readonly anthropic = new Anthropic();

  async generate(mp3Buffer: Buffer, text: string): Promise<Buffer> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-'));

    try {
      const mp3Path = path.join(tmpDir, 'audio.mp3');
      await fs.writeFile(mp3Path, mp3Buffer);

      const duration = await this.getAudioDuration(mp3Path);
      const analysis = await this.analyzeText(text);
      const gridImageBuffer = await this.generateGridImage(analysis);
      const panelPaths = await this.sliceGrid(gridImageBuffer, tmpDir);
      const outputPath = path.join(tmpDir, 'output.mp4');
      await this.createVideo(panelPaths, mp3Path, duration, outputPath);

      return await fs.readFile(outputPath);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  private async analyzeText(text: string): Promise<AnalysisResult> {
    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this song lyrics/text and create exactly 12 short visual scene descriptions for a music video storyboard.

Text: "${text}"

Return ONLY valid JSON (no markdown):
{
  "style": "art style keyword (e.g. 'cinematic noir', 'anime', 'watercolor', 'vibrant pop art')",
  "overallMood": "mood",
  "panels": [
    { "scene": 1, "description": "max 8 words, vivid visual" },
    { "scene": 2, "description": "..." },
    ...up to 12
  ]
}

Keep each description under 8 words. Focus on visual imagery: subject, action, lighting, color.`,
      }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new HttpException('AI analysis failed', HttpStatus.INTERNAL_SERVER_ERROR);

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new HttpException('Failed to parse scene analysis', HttpStatus.INTERNAL_SERVER_ERROR);

    const result = JSON.parse(jsonMatch[0]) as AnalysisResult;
    // Ensure exactly 12 panels
    while (result.panels.length < PANEL_COUNT) {
      const last = result.panels[result.panels.length - 1];
      result.panels.push({ scene: result.panels.length + 1, description: last.description });
    }
    result.panels = result.panels.slice(0, PANEL_COUNT);
    return result;
  }

  private async generateGridImage(analysis: AnalysisResult): Promise<Buffer> {
    const { panels, style, overallMood } = analysis;

    const panelList = panels
      .map((p) => `${p.scene}.${p.description}`)
      .join(', ');

    const prompt =
      `12-panel storyboard comic grid, 4 columns 3 rows, thin black borders separating each panel, ` +
      `${style} art style, ${overallMood} mood, consistent visual style throughout. ` +
      `Panels left-to-right top-to-bottom: ${panelList}. ` +
      `High quality illustration, clear composition in each panel.`;

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
    // Ensure the downloaded image is exactly GRID_W × GRID_H before slicing
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
          .jpeg({ quality: 92 })
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
      const fps = 25;
      const panelCount = panelPaths.length;
      const panelDuration = totalDuration / panelCount;
      const panelFrames = Math.round(panelDuration * fps);
      const zoomInc = (0.3 / panelFrames).toFixed(6);

      const inputArgs: string[] = [];
      panelPaths.forEach((p) => {
        inputArgs.push('-loop', '1', '-t', panelDuration.toFixed(3), '-i', p);
      });

      const filterParts = panelPaths.map((_, i) =>
        `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
        `zoompan=z='min(zoom+${zoomInc},1.3)':` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
        `d=${panelFrames}:s=1280x720:fps=${fps}[v${i}]`,
      );

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
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
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
