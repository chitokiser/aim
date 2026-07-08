import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { FirebaseService } from '../firebase/firebase.service';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  videoUrl: string | null;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  videoUrl?: string;
  tags?: string[];
  published?: boolean;
}

export interface BlogDraft {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
}

// AI119 platform context shared by both prompts — keeps keyword suggestions
// and generated drafts grounded in what the site is actually about.
const PLATFORM_CONTEXT = `AI119 is a Korean AI commerce / earning platform. Members: post SNS content links for advertisers, create AI product review videos/CF ads, generate AI music & music videos, enter business content contests, sponsor SNS accounts, and earn rewards for social follows/joins. They earn AP (real, withdrawable as TON crypto) and EXP (free gamified points spendable in the in-app Shop). The blog exists as an AdSense-monetized content hub — articles should be genuinely useful (guides, tips, industry context), not just SEO filler.`;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class BlogService {
  private anthropic: Anthropic | null = null;
  private readonly model = 'claude-opus-4-8';

  constructor(
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService,
  ) {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey && anthropicKey !== 'your-anthropic-api-key') {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }
  }

  private get collection() {
    return this.firebase.collection('blog_posts');
  }

  private extractJSON(text: string): string {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    return match ? match[1].trim() : text.trim();
  }

  async suggestKeywords(): Promise<string[]> {
    if (!this.anthropic) throw new BadRequestException('AI keyword suggestions are not configured');

    const prompt = `${PLATFORM_CONTEXT}

Suggest 8 blog post topic keywords/phrases in Korean that would currently resonate with this audience — people interested in AI tools, side income, crypto/point earning, and AI-generated content. Think about what's trending right now in those spaces (new AI tools, earning trends, crypto news angles) and phrase each as a short, specific, SEO-friendly topic a reader would search for — not generic single words.

Return ONLY a valid JSON array of 8 strings, no markdown, no explanation:
["keyword 1", "keyword 2", ...]`;

    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = resp.content[0].type === 'text' ? resp.content[0].text : '[]';
      const keywords: unknown = JSON.parse(this.extractJSON(text));
      if (!Array.isArray(keywords)) return [];
      return keywords.map((k) => String(k)).slice(0, 8);
    } catch {
      throw new BadRequestException('Failed to generate keyword suggestions');
    }
  }

  async generateDraft(keyword: string): Promise<BlogDraft> {
    if (!this.anthropic) throw new BadRequestException('AI draft generation is not configured');
    if (!keyword?.trim()) throw new BadRequestException('Keyword is required');

    const prompt = `${PLATFORM_CONTEXT}

Write a complete blog post in Korean about: "${keyword.trim()}"

Requirements:
- Genuinely informative and well-structured — this will run AdSense ads, so it needs to read as real editorial content, not filler.
- Content must be HTML using only these tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a>. Include at least 3 sections (h2 headings) with substantial paragraphs under each. Do not include <html>/<body>/<script> tags.
- Naturally mention AI119 once or twice where relevant (e.g. as an example of an earning platform), but do not turn it into an ad.

Return ONLY valid JSON, no markdown fences, in this exact shape:
{"title": "...", "excerpt": "1-2 sentence summary, under 160 characters", "content": "<h2>...</h2><p>...</p>...", "tags": ["tag1", "tag2", "tag3"]}`;

    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
      const draft = JSON.parse(this.extractJSON(text)) as Record<string, unknown>;
      return {
        title: String(draft.title ?? keyword),
        excerpt: String(draft.excerpt ?? ''),
        content: String(draft.content ?? ''),
        tags: Array.isArray(draft.tags) ? draft.tags.map((t) => String(t)) : [],
      };
    } catch {
      throw new BadRequestException('Failed to generate blog draft');
    }
  }

  private async generateUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const baseSlug = slugify(base) || 'post';
    let candidate = baseSlug;
    let suffix = 2;
    for (;;) {
      const snap = await this.collection.where('slug', '==', candidate).limit(1).get();
      const collision = !snap.empty && snap.docs[0].id !== excludeId;
      if (!collision) return candidate;
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  async listPublished(): Promise<BlogPost[]> {
    // Sorted in-memory (not via Firestore .orderBy) to avoid requiring a
    // composite index for the published + createdAt combination.
    const snap = await this.collection.where('published', '==', true).get();
    const posts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogPost, 'id'>) }));
    return posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAll(): Promise<BlogPost[]> {
    const snap = await this.collection.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogPost, 'id'>) }));
  }

  async getPublishedBySlug(slug: string): Promise<BlogPost> {
    const snap = await this.collection.where('slug', '==', slug).limit(1).get();
    if (snap.empty) throw new NotFoundException('Post not found');
    const doc = snap.docs[0];
    const data = doc.data() as Omit<BlogPost, 'id'>;
    if (!data.published) throw new NotFoundException('Post not found');
    return { id: doc.id, ...data };
  }

  async getById(id: string): Promise<BlogPost> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Post not found');
    return { id: doc.id, ...(doc.data() as Omit<BlogPost, 'id'>) };
  }

  async create(input: BlogPostInput): Promise<BlogPost> {
    if (!input.title?.trim()) throw new BadRequestException('Title is required');
    if (!input.excerpt?.trim()) throw new BadRequestException('Excerpt is required');
    if (!input.content?.trim()) throw new BadRequestException('Content is required');

    const slug = await this.generateUniqueSlug(input.slug?.trim() || input.title);
    const now = new Date().toISOString();
    const doc = {
      title: input.title.trim(),
      slug,
      excerpt: input.excerpt.trim(),
      content: input.content,
      coverImage: input.coverImage?.trim() || null,
      videoUrl: input.videoUrl?.trim() || null,
      tags: input.tags ?? [],
      published: input.published ?? false,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await this.collection.add(doc);
    return { id: ref.id, ...doc };
  }

  async update(id: string, input: BlogPostInput): Promise<BlogPost> {
    const existing = await this.getById(id);

    const update: Partial<Omit<BlogPost, 'id'>> = { updatedAt: new Date().toISOString() };
    if (input.title !== undefined) update.title = input.title.trim();
    if (input.excerpt !== undefined) update.excerpt = input.excerpt.trim();
    if (input.content !== undefined) update.content = input.content;
    if (input.coverImage !== undefined) update.coverImage = input.coverImage?.trim() || null;
    if (input.videoUrl !== undefined) update.videoUrl = input.videoUrl?.trim() || null;
    if (input.tags !== undefined) update.tags = input.tags;
    if (input.published !== undefined) update.published = input.published;
    if (input.slug !== undefined && input.slug.trim() && input.slug.trim() !== existing.slug) {
      update.slug = await this.generateUniqueSlug(input.slug.trim(), id);
    }

    await this.collection.doc(id).update(update);
    return { ...existing, ...update };
  }

  async remove(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }
}
