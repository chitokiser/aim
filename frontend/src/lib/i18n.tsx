"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "ko" | "vi";

const T = {
  en: {
    nav: {
      home: "Home",
      missions: "Missions",
      leaderboard: "Rankings",
      myProfile: "My Profile",
      myPosts: "My Posts",
      pointHistory: "Point History",
      admin: "Admin Panel",
      advertiser: "Advertiser",
      logout: "Logout",
      startTelegram: "Start with Telegram",
    },
    home: {
      badge: "AI Creator Rewards Platform",
      heroSubtitle: "Share your AI creations on social media and earn",
      heroPoints: "points",
      heroTON: "TON coins",
      heroCTA: "Start with Telegram",
      heroExplore: "Browse Missions",
      heroNote: "10,000 AP = 1 USD · Direct withdrawal to TON wallet",
      statsCreators: "Active Creators",
      statsMissions: "Completed Missions",
      statsPoints: "Points Distributed",
      statsTON: "TON Rewards",
      howTitle: "How It Works",
      howSubtitle: "Turn your AI creations into income in 4 steps",
      step1Title: "Join Telegram Group",
      step1Desc: "Sign up via the AIM bot in our official Telegram group.",
      step2Title: "Browse & Join Missions",
      step2Desc: "Participate in various SNS missions and upload AI creations.",
      step3Title: "Auto Review & Earn",
      step3Desc: "The Telegram bot auto-verifies and instantly rewards your points.",
      step4Title: "Withdraw as TON",
      step4Desc: "Receive TON coins at 10,000 AP = 1 USD to your personal wallet.",
      activeMissionsTitle: "Active Missions",
      activeMissionsSubtitle: "Join now and earn points",
      viewAll: "View All Missions",
      pointsTitle: "How to Earn Points",
      pointsSubtitle: "Accumulate AIM points through various activities",
      pointPost: "Post Content",
      pointLike: "Receive Likes",
      pointComment: "Receive Comments",
      pointMission: "Complete Mission",
      pointMissionValue: "Varies by mission",
      pointReferral: "Referral Bonus",
      pointExchange: "TON Exchange",
      ctaTitle: "Start Right Now",
      ctaSubtitle: "Sign up easily with Telegram and start your first mission",
      ctaBtn: "Start for Free",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      advertiserLink: "Advertiser",
    },
    missions: {
      title: "Mission Center",
      subtitle: "Join AI creative missions and earn points",
      searchPlaceholder: "Search missions...",
      filterAll: "All",
      filterCF: "CF Video",
      filterBlog: "Blog",
      filterSNS: "SNS",
      filterCM: "CM Song",
      filterReview: "Review",
      filterSignup: "Signup",
      noResults: "No results found",
      noResultsHint: "Try a different keyword",
    },
    missionCard: {
      reward: "Reward",
      budget: "Budget",
      participants: "Participants",
      daysLeft: "days left",
      join: "Join Mission",
    },
  },
  ko: {
    nav: {
      home: "홈",
      missions: "미션",
      leaderboard: "랭킹",
      myProfile: "내 프로필",
      myPosts: "내 게시물",
      pointHistory: "포인트 내역",
      admin: "관리자 페이지",
      advertiser: "광고주 페이지",
      logout: "로그아웃",
      startTelegram: "텔레그램으로 시작",
    },
    home: {
      badge: "AI 창작자 리워드 플랫폼",
      heroSubtitle: "AI 창작물을 SNS에 공유하고",
      heroPoints: "포인트",
      heroTON: "TON코인",
      heroCTA: "텔레그램으로 시작하기",
      heroExplore: "미션 둘러보기",
      heroNote: "10,000 AP = 1 USD · TON코인 개인 지갑 직접 출금",
      statsCreators: "활성 창작자",
      statsMissions: "완료된 미션",
      statsPoints: "지급된 포인트",
      statsTON: "TON 보상",
      howTitle: "이렇게 작동해요",
      howSubtitle: "4단계로 AI 창작물을 수익으로 바꾸세요",
      step1Title: "텔레그램 그룹 입장",
      step1Desc: "공식 텔레그램 그룹방에서 AIM 봇을 통해 가입합니다.",
      step2Title: "미션 확인 & 참여",
      step2Desc: "다양한 SNS 미션에 참여하고 AI 창작물을 업로드하세요.",
      step3Title: "자동 검수 & 포인트 획득",
      step3Desc: "텔레그램 봇이 자동으로 검수하고 포인트를 즉시 지급합니다.",
      step4Title: "TON코인으로 출금",
      step4Desc: "10,000 AP = 1 USD 비율로 TON코인을 개인 지갑에 수령합니다.",
      activeMissionsTitle: "진행 중인 미션",
      activeMissionsSubtitle: "지금 바로 참여해 포인트를 받으세요",
      viewAll: "전체 미션 보기",
      pointsTitle: "포인트 적립 방법",
      pointsSubtitle: "다양한 활동으로 AIM 포인트를 쌓으세요",
      pointPost: "게시물 등록",
      pointLike: "좋아요 획득",
      pointComment: "댓글 획득",
      pointMission: "미션 완료",
      pointMissionValue: "미션별 상이",
      pointReferral: "추천인 보너스",
      pointExchange: "TON코인 교환",
      ctaTitle: "지금 바로 시작하세요",
      ctaSubtitle: "텔레그램으로 간편하게 가입하고 첫 미션을 시작하세요",
      ctaBtn: "무료로 시작하기",
      terms: "이용약관",
      privacy: "개인정보처리방침",
      advertiserLink: "광고주",
    },
    missions: {
      title: "미션 센터",
      subtitle: "AI 창작 미션에 참여하고 포인트를 획득하세요",
      searchPlaceholder: "미션 검색...",
      filterAll: "전체",
      filterCF: "CF 영상",
      filterBlog: "블로그",
      filterSNS: "SNS",
      filterCM: "CM송",
      filterReview: "리뷰",
      filterSignup: "가입",
      noResults: "검색 결과가 없습니다",
      noResultsHint: "다른 키워드로 검색해보세요",
    },
    missionCard: {
      reward: "보상",
      budget: "예산",
      participants: "참여자",
      daysLeft: "일 남음",
      join: "미션 참여",
    },
  },
  vi: {
    nav: {
      home: "Trang chủ",
      missions: "Nhiệm vụ",
      leaderboard: "Bảng xếp hạng",
      myProfile: "Hồ sơ của tôi",
      myPosts: "Bài đăng của tôi",
      pointHistory: "Lịch sử điểm",
      admin: "Trang quản trị",
      advertiser: "Nhà quảng cáo",
      logout: "Đăng xuất",
      startTelegram: "Bắt đầu với Telegram",
    },
    home: {
      badge: "Nền tảng thưởng nhà sáng tạo AI",
      heroSubtitle: "Chia sẻ sản phẩm AI lên mạng xã hội và nhận",
      heroPoints: "điểm thưởng",
      heroTON: "TON coin",
      heroCTA: "Bắt đầu với Telegram",
      heroExplore: "Xem nhiệm vụ",
      heroNote: "10.000 AP = 1 USD · Rút thẳng vào ví TON",
      statsCreators: "Nhà sáng tạo đang hoạt động",
      statsMissions: "Nhiệm vụ đã hoàn thành",
      statsPoints: "Điểm đã phát",
      statsTON: "Phần thưởng TON",
      howTitle: "Cách thức hoạt động",
      howSubtitle: "Biến sản phẩm AI thành thu nhập qua 4 bước",
      step1Title: "Tham gia nhóm Telegram",
      step1Desc: "Đăng ký qua bot AIM trong nhóm Telegram chính thức.",
      step2Title: "Xem & tham gia nhiệm vụ",
      step2Desc: "Tham gia các nhiệm vụ SNS đa dạng và tải lên sản phẩm AI.",
      step3Title: "Kiểm duyệt tự động & nhận điểm",
      step3Desc: "Bot Telegram tự động kiểm duyệt và thưởng điểm ngay lập tức.",
      step4Title: "Rút về TON",
      step4Desc: "Nhận TON coin với tỉ lệ 10.000 AP = 1 USD vào ví cá nhân.",
      activeMissionsTitle: "Nhiệm vụ đang diễn ra",
      activeMissionsSubtitle: "Tham gia ngay và nhận điểm thưởng",
      viewAll: "Xem tất cả nhiệm vụ",
      pointsTitle: "Cách tích lũy điểm",
      pointsSubtitle: "Tích lũy điểm AIM qua nhiều hoạt động khác nhau",
      pointPost: "Đăng bài",
      pointLike: "Nhận lượt thích",
      pointComment: "Nhận bình luận",
      pointMission: "Hoàn thành nhiệm vụ",
      pointMissionValue: "Tùy nhiệm vụ",
      pointReferral: "Thưởng giới thiệu",
      pointExchange: "Đổi TON",
      ctaTitle: "Bắt đầu ngay bây giờ",
      ctaSubtitle: "Đăng ký dễ dàng qua Telegram và bắt đầu nhiệm vụ đầu tiên",
      ctaBtn: "Bắt đầu miễn phí",
      terms: "Điều khoản sử dụng",
      privacy: "Chính sách bảo mật",
      advertiserLink: "Nhà quảng cáo",
    },
    missions: {
      title: "Trung tâm nhiệm vụ",
      subtitle: "Tham gia nhiệm vụ sáng tạo AI và kiếm điểm thưởng",
      searchPlaceholder: "Tìm kiếm nhiệm vụ...",
      filterAll: "Tất cả",
      filterCF: "Video CF",
      filterBlog: "Blog",
      filterSNS: "SNS",
      filterCM: "Nhạc CM",
      filterReview: "Đánh giá",
      filterSignup: "Đăng ký",
      noResults: "Không tìm thấy kết quả",
      noResultsHint: "Thử từ khóa khác",
    },
    missionCard: {
      reward: "Phần thưởng",
      budget: "Ngân sách",
      participants: "Người tham gia",
      daysLeft: "ngày còn lại",
      join: "Tham gia nhiệm vụ",
    },
  },
};

export type Translations = typeof T.en;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  t: T.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("aim-lang") as Lang | null;
    if (saved && (saved === "en" || saved === "ko" || saved === "vi")) {
      setLangState(saved);
    } else {
      const bl = navigator.language.slice(0, 2);
      if (bl === "ko") setLangState("ko");
      else if (bl === "vi") setLangState("vi");
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("aim-lang", l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: T[lang] as Translations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
