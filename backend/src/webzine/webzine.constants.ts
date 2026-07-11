export interface CategoryDef {
  slug: string;
  ko: string;
  en: string;
  vi: string;
  searchQuery: string;
  // Optional extra framing injected into the article-writer prompt (audience,
  // tone, angle) for categories that need a specific voice beyond what the
  // ko/en category name alone conveys.
  audienceNote?: string;
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
  { slug: 'daily-life', ko: '생활', en: 'Daily Life', vi: 'Đời sống hàng ngày', searchQuery: '생활 정보 꿀팁' },
  { slug: 'health', ko: '건강', en: 'Health', vi: 'Sức khỏe', searchQuery: '건강 뉴스' },
  { slug: 'entertainment', ko: '연예', en: 'Entertainment', vi: 'Giải trí', searchQuery: '연예 뉴스' },
  { slug: 'welfare-policy', ko: '정부복지정책', en: 'Government Welfare Policy', vi: 'Chính sách phúc lợi', searchQuery: '정부 복지 정책 지원금' },
  { slug: 'trending', ko: '실시간 이슈', en: 'Trending Now', vi: 'Xu hướng', searchQuery: '실시간 이슈' },
  { slug: 'investing', ko: '투자·재테크', en: 'Investing', vi: 'Đầu tư', searchQuery: '재테크 투자 주식 부동산' },
  { slug: 'startup', ko: '창업', en: 'Startup', vi: 'Khởi nghiệp', searchQuery: '창업 스타트업' },
  { slug: 'blogging-seo', ko: '블로그·SEO', en: 'Blogging & SEO', vi: 'Blog & SEO', searchQuery: '애드센스 SEO 블로그 수익화' },
  { slug: 'programming', ko: '프로그래밍', en: 'Programming', vi: 'Lập trình', searchQuery: '프로그래밍 Python 코딩' },
  { slug: 'ai-tools', ko: 'AI 활용법', en: 'AI Tools', vi: 'Công cụ AI', searchQuery: 'ChatGPT AI 활용법 자동화' },
  { slug: 'space-aviation', ko: '우주·항공', en: 'Space & Aviation', vi: 'Vũ trụ & Hàng không', searchQuery: '우주 항공 철도' },
  { slug: 'self-improvement', ko: '자기계발', en: 'Self-Improvement', vi: 'Phát triển bản thân', searchQuery: '자기계발 심리학 명언' },
  { slug: 'travel', ko: '여행', en: 'Travel', vi: 'Du lịch', searchQuery: '여행 정보' },
  { slug: 'cooking', ko: '요리', en: 'Cooking', vi: 'Nấu ăn', searchQuery: '요리 레시피' },
  { slug: 'pets', ko: '반려동물', en: 'Pets', vi: 'Thú cưng', searchQuery: '반려동물' },
  { slug: 'fitness', ko: '운동·피트니스', en: 'Fitness', vi: 'Thể hình', searchQuery: '운동 피트니스' },
  { slug: 'classics', ko: '고전읽기', en: 'Classic Reading', vi: 'Đọc kinh điển', searchQuery: '고전 명언 동양철학' },
  {
    slug: 'silver-ai-bootcamp',
    ko: '실버 AI부트캠프',
    en: 'Silver AI Bootcamp',
    vi: 'Trại huấn luyện AI cho người cao tuổi',
    searchQuery: '시니어 AI 활용법 50대 60대 70대 챗GPT',
    audienceNote:
      'AI는 젊은 사람들만의 기술이 아닙니다. 이 섹션은 50대, 60대, 70대 이상 독자도 쉽게 따라 할 수 있는 AI 활용법을 소개합니다. ' +
      'ChatGPT, Gemini 등 다양한 AI 도구를 활용해 글쓰기, 이미지 제작, 유튜브, 블로그, 업무 자동화, 온라인 부업까지 실생활에 도움이 되는 정보를 ' +
      '쉽고 친절한 말투로 전달하세요. 전문 용어는 풀어서 설명하고, 컴퓨터/스마트폰 조작에 익숙하지 않은 독자도 그대로 따라 할 수 있도록 단계별로 안내하세요. ' +
      '나이에 상관없이 AI와 함께 배우고 성장하며 새로운 삶을 시작할 수 있다는 응원의 톤을 유지하세요.',
  },
];

export function findCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
