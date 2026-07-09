export interface CategoryDef {
  slug: string;
  ko: string;
  en: string;
  vi: string;
  searchQuery: string;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: 'politics', ko: '정치', en: 'Politics', vi: 'Chính trị', searchQuery: '정치 뉴스' },
  { slug: 'economy', ko: '경제', en: 'Economy', vi: 'Kinh tế', searchQuery: '경제 뉴스' },
  { slug: 'ai', ko: 'AI', en: 'AI', vi: 'AI', searchQuery: '인공지능 AI 뉴스' },
  { slug: 'it', ko: 'IT', en: 'IT', vi: 'Công nghệ', searchQuery: 'IT 기술 뉴스' },
  { slug: 'science', ko: '과학', en: 'Science', vi: 'Khoa học', searchQuery: '과학 뉴스' },
  { slug: 'industry', ko: '산업', en: 'Industry', vi: 'Công nghiệp', searchQuery: '산업 뉴스' },
  { slug: 'auto', ko: '자동차', en: 'Automotive', vi: 'Ô tô', searchQuery: '자동차 뉴스' },
  { slug: 'world', ko: '국제', en: 'World', vi: 'Quốc tế', searchQuery: '국제 뉴스' },
  { slug: 'philosophy', ko: '철학', en: 'Philosophy', vi: 'Triết học', searchQuery: '철학' },
  { slug: 'history', ko: '역사', en: 'History', vi: 'Lịch sử', searchQuery: '역사' },
  { slug: 'sports', ko: '스포츠', en: 'Sports', vi: 'Thể thao', searchQuery: '스포츠 뉴스' },
  { slug: 'game', ko: '게임', en: 'Games', vi: 'Trò chơi', searchQuery: '게임 뉴스' },
  { slug: 'culture', ko: '문화', en: 'Culture', vi: 'Văn hóa', searchQuery: '문화 뉴스' },
  { slug: 'life', ko: '라이프', en: 'Life', vi: 'Đời sống', searchQuery: '라이프 생활 정보' },
  { slug: 'shopping', ko: '쇼핑', en: 'Shopping', vi: 'Mua sắm', searchQuery: '쇼핑 트렌드' },
  { slug: 'event', ko: '이벤트', en: 'Events', vi: 'Sự kiện', searchQuery: '이벤트 프로모션' },
];

export function findCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
