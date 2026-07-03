const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'without', 'of', 'in', 'on', 'at', 'to', 'from', 'by',
  'is', 'are', 'be', 'new', 'style', 'set', 'sets', 'pcs', 'pc', 'piece', 'pieces', 'pack',
  'size', 'high', 'quality', 'free', 'shipping', 'hot', 'sale', 'top', 'best', 'design',
]);

const MAX_NAME_TAGS = 6;
const MAX_TOTAL_TAGS = 8;

export function generateHashtags(nameKo: string, category?: string): string[] {
  const nameTags = (nameKo || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3 && !/^\d+$/.test(tok) && !STOPWORDS.has(tok));

  const tags: string[] = [];
  for (const tag of nameTags) {
    if (!tags.includes(tag)) tags.push(tag);
    if (tags.length >= MAX_NAME_TAGS) break;
  }

  const categoryTag = (category || '').toLowerCase().trim();
  if (categoryTag && categoryTag !== 'other' && !tags.includes(categoryTag)) {
    tags.push(categoryTag);
  }

  return tags.slice(0, MAX_TOTAL_TAGS);
}
