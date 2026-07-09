import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { generateText, extractJSON, hasAiProvider, type AiKeys } from '../common/ai-text.util';
import { RouletteService } from '../roulette/roulette.service';

export interface BlogSource {
  title: string;
  url: string;
}

export interface BlogComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

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
  category: string;
  keyPoints: string[];
  sources: BlogSource[];
  aiGenerated: boolean;
  views: number;
  likes: number;
  treasureCode: string | null;
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
  category?: string;
  keyPoints?: string[];
  sources?: BlogSource[];
  aiGenerated?: boolean;
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

const SEED_COMMENT_NAMES = [
  '민준', '서연', '지훈', '하은', '도윤', '지우', '예준', '수아', '시우', '채원',
  '유준', '지아', '준서', '다은', '은우', '서준', '하윤', '지호', '소율', '건우',
];

const SEED_COMMENT_TEMPLATES = [
  '좋은 정보 감사합니다!',
  '잘 읽었습니다 👍',
  '유익한 기사네요',
  '매번 좋은 글 감사해요',
  '관심 있는 주제라 재밌게 봤습니다',
  '이런 소식 자주 올려주세요',
  '정리가 잘 되어있네요',
  '공감이 가는 내용입니다',
  '많은 도움이 됐어요',
  '다음 소식도 기대할게요',
  '흥미로운 관점이네요',
  '저장해두고 다시 볼게요',
  '댓글 남기고 갑니다 :)',
  'AI119 웹매거진 항상 잘 보고 있어요',
  '이 부분 더 자세히 알고 싶네요',
  '좋은 하루 되세요~',
  '생각할 거리를 주는 기사네요',
  '구독하고 갑니다',
  '공유했어요!',
  '다음 편도 기다릴게요',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
  private readonly aiKeys: AiKeys;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService,
    private readonly roulette: RouletteService,
  ) {
    this.aiKeys = {
      geminiKey: this.config.get<string>('GEMINI_API_KEY'),
      anthropicKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    };
  }

  private get collection() {
    return this.firebase.collection('blog_posts');
  }

  private get likesCollection() {
    return this.firebase.collection('blog_likes');
  }

  private get commentsCollection() {
    return this.firebase.collection('blog_comments');
  }

  async suggestKeywords(): Promise<string[]> {
    if (!hasAiProvider(this.aiKeys)) throw new BadRequestException('AI keyword suggestions are not configured');

    const prompt = `${PLATFORM_CONTEXT}

Suggest 8 blog post topic keywords/phrases in Korean that would currently resonate with this audience — people interested in AI tools, side income, crypto/point earning, and AI-generated content. Think about what's trending right now in those spaces (new AI tools, earning trends, crypto news angles) and phrase each as a short, specific, SEO-friendly topic a reader would search for — not generic single words.

Return ONLY a valid JSON array of 8 strings, no markdown, no explanation:
["keyword 1", "keyword 2", ...]`;

    try {
      const text = await generateText(this.aiKeys, prompt, 1024);
      const keywords: unknown = JSON.parse(extractJSON(text));
      if (!Array.isArray(keywords)) return [];
      return keywords.map((k) => String(k)).slice(0, 8);
    } catch {
      throw new BadRequestException('Failed to generate keyword suggestions');
    }
  }

  async generateDraft(keyword: string): Promise<BlogDraft> {
    if (!hasAiProvider(this.aiKeys)) throw new BadRequestException('AI draft generation is not configured');
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
      const text = await generateText(this.aiKeys, prompt, 4096);
      const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
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

  async listPublished(category?: string): Promise<BlogPost[]> {
    // Sorted in-memory (not via Firestore .orderBy) to avoid requiring a
    // composite index for the published + createdAt combination.
    const snap = await this.collection.where('published', '==', true).get();
    let posts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogPost, 'id'>) }));
    if (category) posts = posts.filter((p) => p.category === category);
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
    // Each article gets its own hidden-TIGU-mascot roulette event — a small
    // icon planted somewhere in the article body links to /event/roulette,
    // reusing the existing weighted-EXP-prize roulette wheel unmodified.
    const treasureEvent = await this.roulette.createEvent(`웹진: ${input.title.trim()}`, 'blog');
    const doc = {
      title: input.title.trim(),
      slug,
      excerpt: input.excerpt.trim(),
      content: input.content,
      coverImage: input.coverImage?.trim() || null,
      videoUrl: input.videoUrl?.trim() || null,
      tags: input.tags ?? [],
      published: input.published ?? true,
      category: input.category?.trim() || 'general',
      keyPoints: input.keyPoints ?? [],
      sources: input.sources ?? [],
      aiGenerated: input.aiGenerated ?? false,
      views: randomInt(50, 1000),
      likes: randomInt(50, 200),
      treasureCode: treasureEvent.code,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await this.collection.add(doc);
    await this.seedComments(ref.id, now);
    return { id: ref.id, ...doc };
  }

  // Seeds a handful of generic filler comments so a newly published article
  // doesn't look empty — mirrors the randomized views/likes defaults above.
  private async seedComments(postId: string, postCreatedAt: string): Promise<number> {
    const count = randomInt(1, 20);
    const baseMs = new Date(postCreatedAt).getTime();
    const batch = this.firebase.getFirestore().batch();
    for (let i = 0; i < count; i++) {
      const ref = this.commentsCollection.doc();
      const userName = SEED_COMMENT_NAMES[randomInt(0, SEED_COMMENT_NAMES.length - 1)];
      const content = SEED_COMMENT_TEMPLATES[randomInt(0, SEED_COMMENT_TEMPLATES.length - 1)];
      const createdAt = new Date(baseMs + randomInt(0, 120) * 60_000).toISOString();
      batch.set(ref, { postId, userId: `seed-${ref.id}`, userName, content, createdAt });
    }
    await batch.commit();
    return count;
  }

  // Backfills engagement data (views/likes/comments) for posts created before
  // these were seeded on create() — e.g. articles written by the older
  // seed-webzine-articles.ts script, which left views/likes at 0 and no
  // comments. Cover images are backfilled separately by the caller since
  // image generation lives in the webzine module, not here.
  async backfillEngagement(id: string): Promise<{ commentsAdded: number; viewsLikesSeeded: boolean }> {
    const post = await this.getById(id);

    const update: Partial<Omit<BlogPost, 'id'>> = {};
    if (!post.views) update.views = randomInt(50, 1000);
    if (!post.likes) update.likes = randomInt(50, 200);
    const viewsLikesSeeded = Object.keys(update).length > 0;
    if (viewsLikesSeeded) {
      update.updatedAt = new Date().toISOString();
      await this.collection.doc(id).update(update);
    }

    const existing = await this.commentsCollection.where('postId', '==', id).limit(1).get();
    const commentsAdded = existing.empty ? await this.seedComments(id, post.createdAt) : 0;

    return { commentsAdded, viewsLikesSeeded };
  }

  // Backfills a hidden-TIGU-mascot roulette code for posts created before
  // this feature existed. Returns false if the post already had one.
  async backfillTreasureCode(id: string): Promise<boolean> {
    const post = await this.getById(id);
    if (post.treasureCode) return false;
    const event = await this.roulette.createEvent(`웹진: ${post.title}`, 'blog');
    await this.collection.doc(id).update({ treasureCode: event.code });
    return true;
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
    if (input.category !== undefined) update.category = input.category.trim() || 'general';
    if (input.keyPoints !== undefined) update.keyPoints = input.keyPoints;
    if (input.sources !== undefined) update.sources = input.sources;
    if (input.slug !== undefined && input.slug.trim() && input.slug.trim() !== existing.slug) {
      update.slug = await this.generateUniqueSlug(input.slug.trim(), id);
    }

    await this.collection.doc(id).update(update);
    return { ...existing, ...update };
  }

  async remove(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }

  async incrementViews(slug: string): Promise<void> {
    const snap = await this.collection.where('slug', '==', slug).limit(1).get();
    if (snap.empty) return;
    await this.collection.doc(snap.docs[0].id).update({ views: FieldValue.increment(1) });
  }

  async listComments(slug: string): Promise<BlogComment[]> {
    const post = await this.getPublishedBySlug(slug);
    const snap = await this.commentsCollection.where('postId', '==', post.id).get();
    const comments = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogComment, 'id'>) }));
    return comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async addComment(slug: string, userId: string, userName: string, content: string): Promise<BlogComment> {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Comment content is required');
    if (trimmed.length > 1000) throw new BadRequestException('Comment is too long');

    const post = await this.getPublishedBySlug(slug);
    const now = new Date().toISOString();
    const doc = { postId: post.id, userId, userName, content: trimmed, createdAt: now };
    const ref = await this.commentsCollection.add(doc);
    return { id: ref.id, ...doc };
  }

  async deleteComment(commentId: string, userId: string, isAdmin: boolean): Promise<void> {
    const doc = await this.commentsCollection.doc(commentId).get();
    if (!doc.exists) throw new NotFoundException('Comment not found');
    const data = doc.data() as { userId: string };
    if (data.userId !== userId && !isAdmin) throw new BadRequestException('Not allowed to delete this comment');
    await this.commentsCollection.doc(commentId).delete();
  }

  async toggleLike(slug: string, userId: string): Promise<{ liked: boolean; likes: number }> {
    const post = await this.getPublishedBySlug(slug);
    const likeRef = this.likesCollection.doc(`${post.id}_${userId}`);
    const postRef = this.collection.doc(post.id);
    const likeSnap = await likeRef.get();

    if (likeSnap.exists) {
      await likeRef.delete();
      await postRef.update({ likes: FieldValue.increment(-1) });
    } else {
      await likeRef.create({ postId: post.id, userId, createdAt: new Date().toISOString() });
      await postRef.update({ likes: FieldValue.increment(1) });
    }

    const updated = await postRef.get();
    const likes = Math.max(0, Number(updated.data()?.likes ?? 0));
    return { liked: !likeSnap.exists, likes };
  }

  async getLikeStatus(slug: string, userId: string): Promise<{ liked: boolean }> {
    const post = await this.getPublishedBySlug(slug);
    const likeSnap = await this.likesCollection.doc(`${post.id}_${userId}`).get();
    return { liked: likeSnap.exists };
  }
}
