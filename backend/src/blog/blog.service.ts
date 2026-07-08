import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  constructor(private readonly firebase: FirebaseService) {}

  private get collection() {
    return this.firebase.collection('blog_posts');
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
    const snap = await this.collection
      .where('published', '==', true)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogPost, 'id'>) }));
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
