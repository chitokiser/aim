export interface WebzineCategory {
  slug: string;
  ko: string;
  en: string;
  vi: string;
}

// Mirrors backend/src/webzine/webzine.constants.ts — kept in sync manually
// since the frontend (static export) and backend (NestJS) are separate apps.
export const WEBZINE_CATEGORIES: WebzineCategory[] = [
  { slug: "politics", ko: "정치", en: "Politics", vi: "Chính trị" },
  { slug: "economy", ko: "경제", en: "Economy", vi: "Kinh tế" },
  { slug: "ai", ko: "AI", en: "AI", vi: "AI" },
  { slug: "it", ko: "IT", en: "IT", vi: "Công nghệ" },
  { slug: "science", ko: "과학", en: "Science", vi: "Khoa học" },
  { slug: "industry", ko: "산업", en: "Industry", vi: "Công nghiệp" },
  { slug: "auto", ko: "자동차", en: "Automotive", vi: "Ô tô" },
  { slug: "world", ko: "국제", en: "World", vi: "Quốc tế" },
  { slug: "philosophy", ko: "철학", en: "Philosophy", vi: "Triết học" },
  { slug: "history", ko: "역사", en: "History", vi: "Lịch sử" },
  { slug: "sports", ko: "스포츠", en: "Sports", vi: "Thể thao" },
  { slug: "game", ko: "게임", en: "Games", vi: "Trò chơi" },
  { slug: "culture", ko: "문화", en: "Culture", vi: "Văn hóa" },
  { slug: "life", ko: "라이프", en: "Life", vi: "Đời sống" },
  { slug: "shopping", ko: "쇼핑", en: "Shopping", vi: "Mua sắm" },
  { slug: "event", ko: "이벤트", en: "Events", vi: "Sự kiện" },
  { slug: "daily-life", ko: "생활", en: "Daily Life", vi: "Đời sống hàng ngày" },
  { slug: "health", ko: "건강", en: "Health", vi: "Sức khỏe" },
  { slug: "entertainment", ko: "연예", en: "Entertainment", vi: "Giải trí" },
  { slug: "welfare-policy", ko: "정부복지정책", en: "Government Welfare Policy", vi: "Chính sách phúc lợi" },
  { slug: "trending", ko: "실시간 이슈", en: "Trending Now", vi: "Xu hướng" },
  { slug: "general", ko: "일반", en: "General", vi: "Chung" },
];

export function webzineCategoryLabel(slug: string, lang: "en" | "ko" | "vi"): string {
  const found = WEBZINE_CATEGORIES.find((c) => c.slug === slug);
  if (!found) return slug;
  return found[lang];
}
