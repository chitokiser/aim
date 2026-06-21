import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseTelegrafBotService } from '../base/base-telegraf-bot.service';
import { FirebaseService } from '../../firebase/firebase.service';
import { Markup } from 'telegraf';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'name' | 'skills' | 'location' | 'languages' | 'bio' | 'done';
type FindStep = 'describe' | 'done';

interface WizardState {
  step: WizardStep;
  data: Partial<BizMatchProfile>;
}

interface FindState {
  step: FindStep;
}

interface FavoriteCandidate {
  name: string;
  role: string;
  skills: string;
  location: string;
  languages: string;
  bio: string;
  profileUrl: string;
  source: string;
  score: number;
  savedAt: string;
}

interface BizMatchProfile {
  telegramId: string;
  username: string;
  name: string;
  skills: string;
  location: string;
  languages: string;
  bio: string;
  premium: boolean;
  dailyMatchCount: number;
  lastMatchDate: string;
  favorites: FavoriteCandidate[];
  createdAt: string;
  updatedAt: string;
}

interface SearchCandidate {
  name: string;
  role?: string;
  skills?: string;
  location?: string;
  languages?: string;
  bio?: string;
  profileUrl?: string;
  source: string;
}

interface MatchResult {
  candidate: SearchCandidate;
  totalScore: number;
  breakdown: {
    location: number;
    language: number;
    skills: number;
    interests: number;
    activity: number;
    trust: number;
  };
  summary: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTION = 'bizmatch_profiles';
const FREE_DAILY_LIMIT = 3;
const GROUP_LINK = 'https://t.me/ai119link';

const SCORE_WEIGHTS = {
  location: 0.15,
  language: 0.15,
  skills: 0.30,
  interests: 0.20,
  activity: 0.10,
  trust: 0.10,
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BizMatchBotService extends BaseTelegrafBotService {
  private anthropic: Anthropic | null = null;
  private model = 'claude-opus-4-8';
  private readonly wizardSessions = new Map<number, WizardState>();
  private readonly findSessions = new Map<number, FindState>();
  private readonly lastMatchResults = new Map<number, MatchResult[]>();

  constructor(
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
  ) {
    super();
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey && anthropicKey !== 'your-anthropic-api-key') {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }
  }

  protected getBotToken(): string | undefined {
    return this.config.get<string>('BIZMATCH_BOT_TOKEN');
  }

  // ─── JSON extraction helper ─────────────────────────────────────────────────

  private extractJSON(text: string): string {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    return match ? match[1].trim() : text.trim();
  }

  // ─── Profile helpers ────────────────────────────────────────────────────────

  private async getProfile(telegramId: string): Promise<BizMatchProfile | null> {
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('telegramId', '==', telegramId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as BizMatchProfile;
  }

  private async saveProfile(profile: BizMatchProfile): Promise<void> {
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('telegramId', '==', profile.telegramId)
      .limit(1)
      .get();

    if (snap.empty) {
      await this.firebase.collection(COLLECTION).add(profile);
    } else {
      await snap.docs[0].ref.update({ ...profile, updatedAt: new Date().toISOString() });
    }
  }

  private async canUseMatch(profile: BizMatchProfile): Promise<boolean> {
    if (profile.premium) return true;
    const today = new Date().toISOString().slice(0, 10);
    if (profile.lastMatchDate !== today) return true;
    return profile.dailyMatchCount < FREE_DAILY_LIMIT;
  }

  private async incrementMatchCount(profile: BizMatchProfile): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('telegramId', '==', profile.telegramId)
      .limit(1)
      .get();
    if (snap.empty) return;
    const resetToday = profile.lastMatchDate !== today;
    await snap.docs[0].ref.update({
      dailyMatchCount: resetToday ? 1 : profile.dailyMatchCount + 1,
      lastMatchDate: today,
    });
  }

  // ─── Web search ─────────────────────────────────────────────────────────────

  private async webSearch(query: string): Promise<SearchCandidate[]> {
    const tavily = this.config.get<string>('TAVILY_API_KEY');
    const serper = this.config.get<string>('SERPER_API_KEY');

    if (tavily) {
      try {
        const res = await axios.post(
          'https://api.tavily.com/search',
          { query, search_depth: 'basic', max_results: 10 },
          { headers: { Authorization: `Bearer ${tavily}` }, timeout: 8000 },
        );
        return this.parseTavilyResults(res.data?.results ?? []);
      } catch { /* fallthrough */ }
    }

    if (serper) {
      try {
        const res = await axios.post(
          'https://google.serper.dev/search',
          { q: query, num: 10 },
          { headers: { 'X-API-KEY': serper }, timeout: 8000 },
        );
        return this.parseSerperResults(res.data?.organic ?? []);
      } catch { /* fallthrough */ }
    }

    return [];
  }

  private parseTavilyResults(results: Record<string, unknown>[]): SearchCandidate[] {
    return results.map((r) => ({
      name: String(r.title ?? '').split('|')[0].split('-')[0].trim(),
      bio: String(r.content ?? '').slice(0, 200),
      profileUrl: String(r.url ?? ''),
      source: new URL(String(r.url ?? 'https://unknown')).hostname.replace('www.', ''),
    }));
  }

  private parseSerperResults(results: Record<string, unknown>[]): SearchCandidate[] {
    return results.map((r) => ({
      name: String(r.title ?? '').split('|')[0].split('-')[0].trim(),
      bio: String(r.snippet ?? '').slice(0, 200),
      profileUrl: String(r.link ?? ''),
      source: new URL(String(r.link ?? 'https://unknown')).hostname.replace('www.', ''),
    }));
  }

  // ─── AI scoring ─────────────────────────────────────────────────────────────

  private async scoreWithAI(
    myProfile: BizMatchProfile,
    candidates: SearchCandidate[],
    searchQuery: string,
  ): Promise<MatchResult[]> {
    if (!this.anthropic || candidates.length === 0) {
      return candidates.map((c) => ({
        candidate: c,
        totalScore: 50,
        breakdown: { location: 50, language: 50, skills: 50, interests: 50, activity: 50, trust: 50 },
        summary: 'AI scoring unavailable. Configure ANTHROPIC_API_KEY for detailed analysis.',
      }));
    }

    const prompt = `You are an expert talent-matching AI. Score each candidate (0-100) on how well they match the user.

USER PROFILE:
Name: ${myProfile.name}
Skills: ${myProfile.skills}
Location: ${myProfile.location}
Languages: ${myProfile.languages}
Bio: ${myProfile.bio}

SEARCH INTENT: ${searchQuery}

CANDIDATES:
${candidates.map((c, i) => `
[${i}] ${c.name}
Role: ${c.role ?? 'unknown'}
Skills: ${c.skills ?? 'unknown'}
Location: ${c.location ?? 'unknown'}
Languages: ${c.languages ?? 'unknown'}
Bio: ${c.bio ?? ''}
Source: ${c.source}
`).join('\n')}

Return ONLY a valid JSON array (no markdown, no explanation) with one object per candidate:
[{"index":0,"location":<0-100>,"language":<0-100>,"skills":<0-100>,"interests":<0-100>,"activity":<0-100>,"trust":<0-100>,"summary":"<2-sentence match reason in English>"}]`;

    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = resp.content[0].type === 'text' ? resp.content[0].text : '[]';
      const scores: Record<string, number>[] = JSON.parse(this.extractJSON(text));

      return candidates.map((c, i) => {
        const s = scores.find((x) => x.index === i) ?? {} as Record<string, number>;
        const breakdown = {
          location: Number(s.location ?? 50),
          language: Number(s.language ?? 50),
          skills: Number(s.skills ?? 50),
          interests: Number(s.interests ?? 50),
          activity: Number(s.activity ?? 50),
          trust: Number(s.trust ?? 50),
        };
        const totalScore = Math.round(
          breakdown.location * SCORE_WEIGHTS.location +
          breakdown.language * SCORE_WEIGHTS.language +
          breakdown.skills * SCORE_WEIGHTS.skills +
          breakdown.interests * SCORE_WEIGHTS.interests +
          breakdown.activity * SCORE_WEIGHTS.activity +
          breakdown.trust * SCORE_WEIGHTS.trust,
        );
        return { candidate: c, totalScore, breakdown, summary: String(s.summary ?? '') };
      });
    } catch (err) {
      this.logger.error('Claude scoring failed', err);
      return candidates.map((c) => ({
        candidate: c,
        totalScore: 50,
        breakdown: { location: 50, language: 50, skills: 50, interests: 50, activity: 50, trust: 50 },
        summary: 'AI analysis temporarily unavailable.',
      }));
    }
  }

  private async generateSearchQuery(myProfile: BizMatchProfile, description: string): Promise<string> {
    if (!this.anthropic) return description;
    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Generate a web search query to find professionals matching:
Description: ${description}
Searcher skills: ${myProfile.skills}
Searcher location: ${myProfile.location}
Return only the search query, no explanation.`,
        }],
      });
      return resp.content[0].type === 'text' ? resp.content[0].text.trim() : description;
    } catch {
      return description;
    }
  }

  // ─── Message formatters ─────────────────────────────────────────────────────

  private formatMatchCard(r: MatchResult, rank: number): string {
    const bar = (score: number) => '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
    const url = r.candidate.profileUrl ? `\n🔗 ${r.candidate.profileUrl}` : '';
    return `${medal} *${r.candidate.name}* — ${r.totalScore}% Match
${r.candidate.role ? `💼 ${r.candidate.role}` : ''}
📊 Skills   ${bar(r.breakdown.skills)} ${r.breakdown.skills}%
📍 Location ${bar(r.breakdown.location)} ${r.breakdown.location}%
🌐 Language ${bar(r.breakdown.language)} ${r.breakdown.language}%
💡 Interests ${bar(r.breakdown.interests)} ${r.breakdown.interests}%
⚡ Activity  ${bar(r.breakdown.activity)} ${r.breakdown.activity}%
🛡 Trust     ${bar(r.breakdown.trust)} ${r.breakdown.trust}%

${r.summary}${url}`;
  }

  private formatFavoriteCard(fav: FavoriteCandidate, index: number): string {
    const bar = (score: number) => '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    const url = fav.profileUrl ? `\n🔗 ${fav.profileUrl}` : '';
    const savedDate = new Date(fav.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `*${index}. ${fav.name}* — ${fav.score}% Match
${fav.role ? `💼 ${fav.role}` : ''}
🛠 ${fav.skills || 'Skills not specified'}
📍 ${fav.location || 'Location unknown'} | 🌐 ${fav.languages || 'Language unknown'}
📝 ${fav.bio ? fav.bio.slice(0, 120) + (fav.bio.length > 120 ? '…' : '') : ''}
🌍 via ${fav.source} | 📅 Saved ${savedDate}${url}`;
  }

  // ─── Register handlers ──────────────────────────────────────────────────────

  protected registerHandlers() {
    if (!this.bot) return;

    // /start
    this.bot.command('start', async (ctx) => {
      const name = ctx.from.first_name || 'there';
      await ctx.reply(
        `👋 Hello, *${name}!*

🤖 *MatchAI BizMatch Bot* — AI-powered professional matching.

I help you find the perfect collaborators, partners, and clients by searching LinkedIn, GitHub, Upwork, Freelancer, X, Reddit, and more — then scoring matches with AI.

📋 *Commands:*
• /profile — Set up your profile
• /find — Describe who you're looking for
• /match — Get AI-powered matches
• /favorites — View saved candidates
• /premium — Unlock unlimited matches
• /report — Report inappropriate content

🌐 Join our community 👇`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🚀 Join AI119 Community', GROUP_LINK)],
            [Markup.button.callback('📝 Set Up Profile', 'start_profile')],
            [Markup.button.callback('🔍 Find People', 'start_find')],
          ]),
        },
      );
    });

    // /profile
    this.bot.command('profile', async (ctx) => {
      await this.handleProfileCommand(ctx);
    });

    this.bot.action('start_profile', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleProfileCommand(ctx);
    });

    this.bot.action('update_profile', async (ctx) => {
      await ctx.answerCbQuery();
      this.initUpdateWizard(ctx.from.id);
      await ctx.reply(
        `✏️ *Update your profile*\n\nStep 1/5: What is your *full name* or professional alias?`,
        { parse_mode: 'Markdown' },
      );
    });

    // /find
    this.bot.command('find', async (ctx) => {
      await this.handleFindCommand(ctx);
    });

    this.bot.action('start_find', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleFindCommand(ctx);
    });

    // /match
    this.bot.command('match', async (ctx) => {
      const profile = await this.getProfile(String(ctx.from.id));
      if (!profile) {
        await ctx.reply('📝 Please set up your profile first with /profile');
        return;
      }
      await this.handleFindCommand(ctx);
    });

    // /favorites
    this.bot.command('favorites', async (ctx) => {
      await this.handleFavoritesCommand(ctx);
    });

    this.bot.action('view_favorites', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleFavoritesCommand(ctx);
    });

    // /premium
    this.bot.command('premium', async (ctx) => {
      await ctx.reply(
        `⭐ *MatchAI Premium*

🆓 *Free plan:*
• 3 AI matches per day
• Basic profile
• Save up to 20 favorites

💎 *Premium plan:*
• Unlimited AI matches
• Priority ranking in search results
• Advanced filters (country, language, skill level)
• Export contact list
• Business analytics dashboard

🏢 *Enterprise:*
• Team matching for companies
• API access
• Custom scoring weights
• Dedicated support

💰 *Pricing:* Coming soon (AP-based economy)

Join our community to stay updated 👇`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🌐 Join AI119 Community', GROUP_LINK)],
          ]),
        },
      );
    });

    // /report
    this.bot.command('report', async (ctx) => {
      await ctx.reply(
        `🚩 *Report a User*

To report inappropriate content or behavior, please send:
1. The username or Telegram ID of the person
2. Description of the issue

Send your report to @ai119admin or join our community 👇`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🌐 AI119 Community', GROUP_LINK)],
          ]),
        },
      );
    });

    // Save to favorites — index-based to avoid Telegram 64-byte callback limit
    this.bot.action(/^save_fav:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery('⭐ Saved to favorites!');
      const idx = parseInt(ctx.match[1], 10);
      const telegramId = String(ctx.from.id);
      const profile = await this.getProfile(telegramId);
      if (!profile) return;

      const results = this.lastMatchResults.get(ctx.from.id);
      if (!results || !results[idx]) return;

      const r = results[idx];
      const alreadySaved = profile.favorites.some(
        (f) => f.profileUrl === (r.candidate.profileUrl ?? ''),
      );
      if (alreadySaved) {
        await ctx.answerCbQuery('Already in favorites!');
        return;
      }

      const newFav: FavoriteCandidate = {
        name: r.candidate.name,
        role: r.candidate.role ?? '',
        skills: r.candidate.skills ?? '',
        location: r.candidate.location ?? '',
        languages: r.candidate.languages ?? '',
        bio: r.candidate.bio ?? '',
        profileUrl: r.candidate.profileUrl ?? '',
        source: r.candidate.source,
        score: r.totalScore,
        savedAt: new Date().toISOString(),
      };

      const snap = await this.firebase
        .collection(COLLECTION)
        .where('telegramId', '==', telegramId)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          favorites: [...profile.favorites, newFav],
        });
      }
    });

    // Remove from favorites
    this.bot.action(/^del_fav:(\d+)$/, async (ctx) => {
      const idx = parseInt(ctx.match[1], 10);
      const telegramId = String(ctx.from.id);
      const profile = await this.getProfile(telegramId);
      if (!profile) return;

      const updated = profile.favorites.filter((_, i) => i !== idx);
      const snap = await this.firebase
        .collection(COLLECTION)
        .where('telegramId', '==', telegramId)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({ favorites: updated });
      }
      await ctx.answerCbQuery('🗑 Removed from favorites');
      await this.handleFavoritesCommand(ctx);
    });

    // Handle text input for active wizard sessions
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const text = ctx.message.text;

      if (this.wizardSessions.has(userId)) {
        await this.handleProfileWizard(ctx, text);
        return;
      }

      if (this.findSessions.has(userId)) {
        await this.handleFindInput(ctx, text);
        return;
      }
    });
  }

  // ─── Profile wizard ─────────────────────────────────────────────────────────

  private async handleProfileCommand(ctx: { from: { id: number; username?: string; first_name?: string }; reply: Function }) {
    const telegramId = String(ctx.from.id);
    const existing = await this.getProfile(telegramId);

    if (existing) {
      await ctx.reply(
        `📋 *Your Current Profile*

👤 *Name:* ${existing.name}
💼 *Skills:* ${existing.skills}
📍 *Location:* ${existing.location}
🌐 *Languages:* ${existing.languages}
📝 *Bio:* ${existing.bio}
⭐ *Premium:* ${existing.premium ? 'Yes' : 'No'}
🔢 *Favorites:* ${existing.favorites.length}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Update Profile', 'update_profile')],
            [Markup.button.callback('🔍 Find Matches', 'start_find')],
            [Markup.button.url('🌐 AI119 Community', GROUP_LINK)],
          ]),
        },
      );
    } else {
      this.wizardSessions.set(ctx.from.id, { step: 'name', data: {} });
      await ctx.reply(
        `📝 *Let's set up your BizMatch profile!*

Step 1/5: What is your *full name* or professional alias?`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  private async handleProfileWizard(ctx: { from: { id: number; username?: string }; reply: Function }, text: string) {
    const userId = ctx.from.id;
    const session = this.wizardSessions.get(userId);
    if (!session) return;

    switch (session.step) {
      case 'name':
        session.data.name = text;
        session.step = 'skills';
        await ctx.reply(
          `✅ Name saved: *${text}*

Step 2/5: What are your *key skills*?
_(e.g., React, Node.js, Python, Marketing, Graphic Design)_`,
          { parse_mode: 'Markdown' },
        );
        break;

      case 'skills':
        session.data.skills = text;
        session.step = 'location';
        await ctx.reply(
          `✅ Skills saved!

Step 3/5: Where are you *located*?
_(e.g., Seoul, South Korea / Remote / Ho Chi Minh City)_`,
          { parse_mode: 'Markdown' },
        );
        break;

      case 'location':
        session.data.location = text;
        session.step = 'languages';
        await ctx.reply(
          `✅ Location saved!

Step 4/5: Which *languages* do you speak?
_(e.g., English, Korean, Vietnamese)_`,
          { parse_mode: 'Markdown' },
        );
        break;

      case 'languages':
        session.data.languages = text;
        session.step = 'bio';
        await ctx.reply(
          `✅ Languages saved!

Step 5/5: Write a short *professional bio*
_(2-3 sentences about your experience and goals)_`,
          { parse_mode: 'Markdown' },
        );
        break;

      case 'bio': {
        session.data.bio = text;
        this.wizardSessions.delete(userId);

        const profile: BizMatchProfile = {
          telegramId: String(userId),
          username: ctx.from.username ?? '',
          name: session.data.name ?? '',
          skills: session.data.skills ?? '',
          location: session.data.location ?? '',
          languages: session.data.languages ?? '',
          bio: text,
          premium: false,
          dailyMatchCount: 0,
          lastMatchDate: '',
          favorites: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await this.saveProfile(profile);

        await ctx.reply(
          `🎉 *Profile created successfully!*

👤 *${profile.name}*
💼 ${profile.skills}
📍 ${profile.location} | 🌐 ${profile.languages}
📝 ${profile.bio}

Now you're ready to find matches! 🚀`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔍 Find Matches Now', 'start_find')],
              [Markup.button.url('🌐 Join AI119 Community', GROUP_LINK)],
            ]),
          },
        );
        break;
      }
    }
  }

  // ─── Update profile ──────────────────────────────────────────────────────────

  private initUpdateWizard(userId: number) {
    this.wizardSessions.set(userId, { step: 'name', data: {} });
  }

  // ─── Find / Match flow ───────────────────────────────────────────────────────

  private async handleFindCommand(ctx: { from: { id: number }; reply: Function }) {
    const telegramId = String(ctx.from.id);
    const profile = await this.getProfile(telegramId);

    if (!profile) {
      await ctx.reply(
        '📝 You need a profile before searching.\nUse /profile to create one.',
        Markup.inlineKeyboard([[Markup.button.callback('📝 Create Profile', 'start_profile')]]),
      );
      return;
    }

    const canMatch = await this.canUseMatch(profile);
    if (!canMatch) {
      await ctx.reply(
        `⚠️ *Daily limit reached* (${FREE_DAILY_LIMIT} matches/day on free plan).

Upgrade to Premium for unlimited matches!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⭐ View Premium', 'premium_info')],
            [Markup.button.url('🌐 AI119 Community', GROUP_LINK)],
          ]),
        },
      );
      return;
    }

    this.findSessions.set(ctx.from.id, { step: 'describe' });
    await ctx.reply(
      `🔍 *Find Your Perfect Match*

Describe the type of person you're looking for:
_(e.g., "Looking for a React developer in Seoul with startup experience" or "Need a Vietnamese marketing expert for TikTok campaigns")_`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleFindInput(ctx: { from: { id: number }; reply: Function }, description: string) {
    const userId = ctx.from.id;
    this.findSessions.delete(userId);

    const telegramId = String(userId);
    const profile = await this.getProfile(telegramId);
    if (!profile) return;

    await ctx.reply('🔄 Searching across LinkedIn, GitHub, Upwork, Freelancer and more...\n_This may take a moment._', {
      parse_mode: 'Markdown',
    });

    try {
      const query = await this.generateSearchQuery(profile, description);
      const rawResults = await this.webSearch(query);

      let candidates = rawResults;

      if (candidates.length === 0 && this.anthropic) {
        candidates = await this.synthesizeCandidates(profile, description);
      }

      if (candidates.length === 0) {
        await ctx.reply(
          '😔 No candidates found. Try a different description or configure search API keys (TAVILY_API_KEY or SERPER_API_KEY).',
          Markup.inlineKeyboard([[Markup.button.url('🌐 AI119 Community', GROUP_LINK)]]),
        );
        return;
      }

      const top5 = candidates.slice(0, 5);
      const scored = await this.scoreWithAI(profile, top5, description);
      scored.sort((a, b) => b.totalScore - a.totalScore);

      this.lastMatchResults.set(userId, scored);

      await this.incrementMatchCount(profile);

      await ctx.reply(
        `🎯 *Top ${scored.length} AI Matches for "${description}"*\n\n` +
        scored.slice(0, 3).map((r, i) => this.formatMatchCard(r, i + 1)).join('\n\n---\n\n'),
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            ...(scored.slice(0, 3).map((r, i) => [
              Markup.button.callback(`⭐ Save #${i + 1} (${r.totalScore}%)`, `save_fav:${i}`),
            ])),
            [Markup.button.callback('🔍 Search Again', 'start_find')],
            [Markup.button.callback('⭐ View Favorites', 'view_favorites')],
            [Markup.button.url('🌐 AI119 Community', GROUP_LINK)],
          ]),
        },
      );
    } catch (err) {
      this.logger.error('Match search failed', err);
      await ctx.reply('❌ Search failed. Please try again later.');
    }
  }

  private async synthesizeCandidates(profile: BizMatchProfile, description: string): Promise<SearchCandidate[]> {
    if (!this.anthropic) return [];
    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Generate 5 realistic professional profiles that match: "${description}"
User searching: ${profile.skills} in ${profile.location}

Return ONLY a valid JSON array (no markdown, no explanation):
[{"name":"...","role":"...","skills":"...","location":"...","languages":"...","bio":"...","profileUrl":"https://linkedin.com/in/example","source":"linkedin"}]`,
        }],
      });
      const text = resp.content[0].type === 'text' ? resp.content[0].text : '[]';
      const raw: unknown = JSON.parse(this.extractJSON(text));
      const arr: unknown[] = Array.isArray(raw)
        ? raw
        : ((raw as Record<string, unknown>).profiles as unknown[] ?? (raw as Record<string, unknown>).results as unknown[] ?? []);
      return arr.map((item) => {
        const r = item as Record<string, unknown>;
        return {
          name: String(r.name ?? ''),
          role: String(r.role ?? ''),
          skills: String(r.skills ?? ''),
          location: String(r.location ?? ''),
          languages: String(r.languages ?? ''),
          bio: String(r.bio ?? ''),
          profileUrl: String(r.profileUrl ?? ''),
          source: String(r.source ?? 'ai-generated'),
        };
      });
    } catch {
      return [];
    }
  }

  // ─── Favorites ──────────────────────────────────────────────────────────────

  private async handleFavoritesCommand(ctx: { from: { id: number }; reply: Function }) {
    const profile = await this.getProfile(String(ctx.from.id));
    if (!profile) {
      await ctx.reply('📝 Set up your profile first with /profile');
      return;
    }

    if (profile.favorites.length === 0) {
      await ctx.reply(
        `⭐ *Your Favorites*

No saved candidates yet.
Use /find to discover and save matches!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('🔍 Find People', 'start_find')]]),
        },
      );
      return;
    }

    const favs = profile.favorites.slice(0, 10);
    const cards = favs.map((fav, i) => this.formatFavoriteCard(fav, i + 1)).join('\n\n---\n\n');

    const deleteButtons = favs.map((_, i) => [
      Markup.button.callback(`🗑 Remove #${i + 1}`, `del_fav:${i}`),
    ]);

    await ctx.reply(
      `⭐ *Your Favorites* (${profile.favorites.length})\n\n${cards}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          ...deleteButtons,
          [Markup.button.callback('🔍 Find More', 'start_find')],
          [Markup.button.url('🌐 AI119 Community', GROUP_LINK)],
        ]),
      },
    );
  }
}
