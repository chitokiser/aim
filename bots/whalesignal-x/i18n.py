from __future__ import annotations

_STRINGS: dict[str, dict[str, str]] = {
    "en": {
        "welcome": (
            "🐋 *Welcome to WhaleSignal X, {name}!*\n\n"
            "*Follow The Money* — Opportunity follows the money\n\n"
            "AI tracks global investments, grants, airdrops, hackathons,\n"
            "smart money, jobs, and government funds in real time.\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "🎁 Free: {limit} queries/day\n"
            "⭐ Pro ($9.99/mo): real-time alerts + unlimited\n"
            "👑 VIP ($29.99/mo): API + early signals\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "Select a menu item or enter a command."
        ),
        "help": (
            "📖 *WhaleSignal X Commands*\n\n"
            "💰 `/funding` — Investment & Funding\n"
            "💰 `/grants` — Grant Programs\n"
            "🏆 `/hackathon` — Hackathons\n"
            "🎁 `/airdrop` — Airdrops\n"
            "🧪 `/testnet` — Testnets\n"
            "📈 `/listings` — Exchange Listings\n"
            "🐳 `/smartmoney` — Smart Money\n"
            "👨‍💻 `/github` — GitHub Activity\n"
            "🔥 `/social` — Social Surge\n"
            "🏛 `/dao` — DAO Treasury\n"
            "💼 `/jobs` — Job Surge\n"
            "🏦 `/gov` — Government Funds\n"
            "🎮 `/gamefi` — GameFi\n"
            "🖼 `/nft` — NFT\n"
            "📡 `/depin` — DePIN\n"
            "🏢 `/rwa` — RWA\n"
            "📊 `/etf` — ETF/Institutional Funds\n"
            "💎 `/hidden` — Hidden Gem ⭐Pro\n"
            "🎯 `/top` — Top 5 Opportunities\n"
            "📅 `/calendar` — Today's Calendar\n"
            "⭐ `/subscribe` — Subscription\n"
        ),
        "loading": "🔍 Collecting data...",
        "no_data": "{title}\n\n📭 No data in this category right now.\nPlease check back later.",
        "showing_top": "\n\n_Showing top score out of {total} signals_",
        "top_loading": "🔍 Analyzing top opportunities...",
        "top_no_data": "🎯 *Top 5 Opportunities*\n\n📭 Not enough data yet.\nPlease try again later.",
        "top_disclaimer": "\n⚠️ _Research reference only, not investment advice._",
        "calendar_header": "📅 *Today's WhaleSignal Calendar*\n\n",
        "calendar_no_events": "📭 No events registered today.",
        "subscribe_header": "⭐ *WhaleSignal X Subscription Plans*\n\n",
        "subscribe_current": "Current plan: *{plan}*\nExpires: {expires}\n\n",
        "subscribe_plans": (
            "━━━━━━━━━━━━━━━━━━━━\n"
            "🆓 *Free*\n"
            "  ✅ {limit} queries/day\n"
            "  ✅ Basic category access\n\n"
            "⭐ *Pro — $9.99/mo*\n"
            "  ✅ Unlimited queries\n"
            "  ✅ Real-time alerts (WhaleScore 80+)\n"
            "  ✅ Hidden Gem access\n"
            "  ✅ Daily AI briefing\n"
            "  ✅ Smart Money detailed analysis\n\n"
            "👑 *VIP — $29.99/mo*\n"
            "  ✅ All Pro features\n"
            "  ✅ API access\n"
            "  ✅ Early signals (5-min lead)\n"
            "  ✅ Custom WhaleScore filter\n"
            "  ✅ Dedicated support\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "💳 Payment: USDT/TON/Telegram Stars\n"
            "📩 Support: @ai119_admin"
        ),
        "quota_exceeded": (
            "📊 *Daily free query limit ({limit}) reached.*\n\n"
            "⭐ Upgrade to Pro/VIP for unlimited queries + real-time alerts!\n\n"
            "Use /subscribe to upgrade."
        ),
        "pro_only": (
            "⭐ *This feature is for Pro/VIP subscribers only.*\n\n"
            "Hidden Gem & Smart Money analysis is available for paid subscribers.\n"
            "Use /subscribe to upgrade."
        ),
        "menu_text": "🐋 *WhaleSignal X* — Follow The Money\n\nSelect a menu item:",
        "start_btn": "🚀 Enter AI119 Platform",
        "community_btn": "💬 AI119 Community",
        "site_btn": "🌐 AI119",
        "refresh_btn": "🔄 Refresh",
        "top5_btn": "🎯 Top 5",
        "main_menu_btn": "🏠 Main Menu",
        "pro_upgrade_btn": "⭐ Upgrade to Pro/VIP",
        "pro_monthly_btn": "⭐ Pro - $9.99/mo",
        "vip_monthly_btn": "👑 VIP - $29.99/mo",
        "my_sub_btn": "📊 My Subscription",
        "get_analysis_btn": "🤖 Get Personal Analysis",
    },
    "ko": {
        "welcome": (
            "🐋 *WhaleSignal X에 오신 것을 환영합니다, {name}님!*\n\n"
            "*Follow The Money* — 돈이 흐르는 곳에 기회가 있다\n\n"
            "AI가 전 세계 투자금, 그랜트, 에어드랍, 해커톤,\n"
            "스마트머니, 채용, 정부지원금을 실시간 추적합니다.\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "🎁 무료 플랜: 하루 {limit}회 조회\n"
            "⭐ Pro ($9.99/월): 실시간 알림 + 무제한\n"
            "👑 VIP ($29.99/월): API + 조기 신호\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "아래 메뉴를 선택하거나 명령어를 입력하세요."
        ),
        "help": (
            "📖 *WhaleSignal X 명령어 목록*\n\n"
            "💰 `/funding` — 투자 유치 & 펀딩\n"
            "💰 `/grants` — 그랜트 프로그램\n"
            "🏆 `/hackathon` — 해커톤\n"
            "🎁 `/airdrop` — 에어드랍\n"
            "🧪 `/testnet` — 테스트넷\n"
            "📈 `/listings` — 거래소 상장\n"
            "🐳 `/smartmoney` — 스마트머니\n"
            "👨‍💻 `/github` — GitHub 활동\n"
            "🔥 `/social` — 소셜 급성장\n"
            "🏛 `/dao` — DAO Treasury\n"
            "💼 `/jobs` — 채용 급증\n"
            "🏦 `/gov` — 정부 지원사업\n"
            "🎮 `/gamefi` — GameFi\n"
            "🖼 `/nft` — NFT\n"
            "📡 `/depin` — DePIN\n"
            "🏢 `/rwa` — RWA\n"
            "📊 `/etf` — ETF/기관자금\n"
            "💎 `/hidden` — Hidden Gem ⭐Pro\n"
            "🎯 `/top` — Top 5 기회\n"
            "📅 `/calendar` — 오늘의 캘린더\n"
            "⭐ `/subscribe` — 구독 관리\n"
        ),
        "loading": "🔍 데이터 수집 중...",
        "no_data": "{title}\n\n📭 현재 해당 카테고리에 데이터가 없습니다.\n잠시 후 다시 확인해주세요.",
        "showing_top": "\n\n_총 {total}개 신호 중 최고 점수 표시 중_",
        "top_loading": "🔍 Top 기회 분석 중...",
        "top_no_data": "🎯 *Top 5 Opportunities*\n\n📭 아직 충분한 데이터가 없습니다.\n잠시 후 다시 시도해주세요.",
        "top_disclaimer": "\n⚠️ _투자 권유가 아닌 리서치 참고 정보입니다._",
        "calendar_header": "📅 *오늘의 WhaleSignal 캘린더*\n\n",
        "calendar_no_events": "📭 오늘 등록된 이벤트가 없습니다.",
        "subscribe_header": "⭐ *WhaleSignal X 구독 플랜*\n\n",
        "subscribe_current": "현재 플랜: *{plan}*\n만료일: {expires}\n\n",
        "subscribe_plans": (
            "━━━━━━━━━━━━━━━━━━━━\n"
            "🆓 *Free* (현재)\n"
            "  ✅ 하루 {limit}회 조회\n"
            "  ✅ 기본 카테고리 접근\n\n"
            "⭐ *Pro — $9.99/월*\n"
            "  ✅ 무제한 조회\n"
            "  ✅ 실시간 고점수 알림 (WhaleScore 80+)\n"
            "  ✅ Hidden Gem 접근\n"
            "  ✅ 일일 AI 브리핑\n"
            "  ✅ Smart Money 상세 분석\n\n"
            "👑 *VIP — $29.99/월*\n"
            "  ✅ Pro 모든 기능\n"
            "  ✅ API 접근\n"
            "  ✅ 조기 신호 알림 (5분 선행)\n"
            "  ✅ 커스텀 WhaleScore 필터\n"
            "  ✅ 전담 지원\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "💳 결제: USDT/TON/Telegram Stars\n"
            "📩 구독 문의: @ai119_admin"
        ),
        "quota_exceeded": (
            "📊 *오늘의 무료 조회 한도 ({limit}회)를 초과했습니다.*\n\n"
            "⭐ Pro/VIP로 업그레이드하면 무제한 조회 + 실시간 알림을 받을 수 있습니다!\n\n"
            "/subscribe 명령어로 업그레이드하세요."
        ),
        "pro_only": (
            "⭐ *이 기능은 Pro/VIP 전용입니다.*\n\n"
            "Hidden Gem & Smart Money 분석은 유료 구독 전용 기능입니다.\n"
            "/subscribe 로 업그레이드하세요."
        ),
        "menu_text": "🐋 *WhaleSignal X* — Follow The Money\n\n메뉴를 선택하세요:",
        "start_btn": "🚀 AI119 플랫폼 입장",
        "community_btn": "💬 AI119 커뮤니티",
        "site_btn": "🌐 AI119",
        "refresh_btn": "🔄 새로고침",
        "top5_btn": "🎯 Top 5",
        "main_menu_btn": "🏠 메인 메뉴",
        "pro_upgrade_btn": "⭐ Pro/VIP 업그레이드",
        "pro_monthly_btn": "⭐ Pro - $9.99/월",
        "vip_monthly_btn": "👑 VIP - $29.99/월",
        "my_sub_btn": "📊 내 구독 현황",
        "get_analysis_btn": "🤖 개인 분석 받기",
    },
    "vi": {
        "welcome": (
            "🐋 *Chào mừng đến với WhaleSignal X, {name}!*\n\n"
            "*Follow The Money* — Cơ hội theo dòng tiền\n\n"
            "AI theo dõi đầu tư, grant, airdrop, hackathon,\n"
            "smart money, việc làm và quỹ chính phủ toàn cầu theo thời gian thực.\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "🎁 Miễn phí: {limit} truy vấn/ngày\n"
            "⭐ Pro ($9.99/tháng): thông báo thời gian thực + không giới hạn\n"
            "👑 VIP ($29.99/tháng): API + tín hiệu sớm\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "Chọn menu hoặc nhập lệnh."
        ),
        "help": (
            "📖 *Lệnh WhaleSignal X*\n\n"
            "💰 `/funding` — Đầu tư & Tài trợ\n"
            "💰 `/grants` — Chương trình Grant\n"
            "🏆 `/hackathon` — Hackathon\n"
            "🎁 `/airdrop` — Airdrop\n"
            "🧪 `/testnet` — Testnet\n"
            "📈 `/listings` — Niêm yết sàn\n"
            "🐳 `/smartmoney` — Smart Money\n"
            "👨‍💻 `/github` — Hoạt động GitHub\n"
            "🔥 `/social` — Bùng nổ mạng xã hội\n"
            "🏛 `/dao` — DAO Treasury\n"
            "💼 `/jobs` — Bùng nổ tuyển dụng\n"
            "🏦 `/gov` — Quỹ chính phủ\n"
            "🎮 `/gamefi` — GameFi\n"
            "🖼 `/nft` — NFT\n"
            "📡 `/depin` — DePIN\n"
            "🏢 `/rwa` — RWA\n"
            "📊 `/etf` — ETF/Quỹ tổ chức\n"
            "💎 `/hidden` — Hidden Gem ⭐Pro\n"
            "🎯 `/top` — Top 5 cơ hội\n"
            "📅 `/calendar` — Lịch hôm nay\n"
            "⭐ `/subscribe` — Đăng ký\n"
        ),
        "loading": "🔍 Đang thu thập dữ liệu...",
        "no_data": "{title}\n\n📭 Hiện không có dữ liệu trong danh mục này.\nVui lòng kiểm tra lại sau.",
        "showing_top": "\n\n_Hiển thị điểm cao nhất trong {total} tín hiệu_",
        "top_loading": "🔍 Đang phân tích cơ hội hàng đầu...",
        "top_no_data": "🎯 *Top 5 Opportunities*\n\n📭 Chưa đủ dữ liệu.\nVui lòng thử lại sau.",
        "top_disclaimer": "\n⚠️ _Chỉ để tham khảo nghiên cứu, không phải lời khuyên đầu tư._",
        "calendar_header": "📅 *Lịch WhaleSignal hôm nay*\n\n",
        "calendar_no_events": "📭 Không có sự kiện nào được đăng ký hôm nay.",
        "subscribe_header": "⭐ *Gói đăng ký WhaleSignal X*\n\n",
        "subscribe_current": "Gói hiện tại: *{plan}*\nHết hạn: {expires}\n\n",
        "subscribe_plans": (
            "━━━━━━━━━━━━━━━━━━━━\n"
            "🆓 *Miễn phí*\n"
            "  ✅ {limit} truy vấn/ngày\n"
            "  ✅ Truy cập danh mục cơ bản\n\n"
            "⭐ *Pro — $9.99/tháng*\n"
            "  ✅ Truy vấn không giới hạn\n"
            "  ✅ Thông báo thời gian thực (WhaleScore 80+)\n"
            "  ✅ Truy cập Hidden Gem\n"
            "  ✅ Bản tin AI hàng ngày\n"
            "  ✅ Phân tích Smart Money chi tiết\n\n"
            "👑 *VIP — $29.99/tháng*\n"
            "  ✅ Tất cả tính năng Pro\n"
            "  ✅ Truy cập API\n"
            "  ✅ Tín hiệu sớm (dẫn trước 5 phút)\n"
            "  ✅ Bộ lọc WhaleScore tùy chỉnh\n"
            "  ✅ Hỗ trợ riêng\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "💳 Thanh toán: USDT/TON/Telegram Stars\n"
            "📩 Hỗ trợ: @ai119_admin"
        ),
        "quota_exceeded": (
            "📊 *Đã đạt giới hạn truy vấn miễn phí hàng ngày ({limit} lần).*\n\n"
            "⭐ Nâng cấp lên Pro/VIP để truy vấn không giới hạn + thông báo thời gian thực!\n\n"
            "Dùng /subscribe để nâng cấp."
        ),
        "pro_only": (
            "⭐ *Tính năng này dành riêng cho Pro/VIP.*\n\n"
            "Phân tích Hidden Gem & Smart Money chỉ dành cho thuê bao trả phí.\n"
            "Dùng /subscribe để nâng cấp."
        ),
        "menu_text": "🐋 *WhaleSignal X* — Follow The Money\n\nChọn menu:",
        "start_btn": "🚀 Vào nền tảng AI119",
        "community_btn": "💬 Cộng đồng AI119",
        "site_btn": "🌐 AI119",
        "refresh_btn": "🔄 Làm mới",
        "top5_btn": "🎯 Top 5",
        "main_menu_btn": "🏠 Menu chính",
        "pro_upgrade_btn": "⭐ Nâng cấp Pro/VIP",
        "pro_monthly_btn": "⭐ Pro - $9.99/tháng",
        "vip_monthly_btn": "👑 VIP - $29.99/tháng",
        "my_sub_btn": "📊 Đăng ký của tôi",
        "get_analysis_btn": "🤖 Nhận phân tích cá nhân",
    },
}

_CATEGORY_TITLES: dict[str, dict[str, str]] = {
    "en": {
        "funding": "💰 Latest Funding & Investment",
        "grant": "💰 Grant Programs",
        "hackathon": "🏆 Hackathons",
        "airdrop": "🎁 Airdrops",
        "testnet": "🧪 Testnets",
        "listings": "📈 Exchange Listings",
        "smartmoney": "🐳 Smart Money",
        "github": "👨‍💻 GitHub Activity",
        "social": "🔥 Social Surge",
        "dao": "🏛 DAO Treasury",
        "jobs": "💼 Job Surge",
        "gov": "🏦 Government Funds",
        "gamefi": "🎮 GameFi",
        "nft": "🖼 NFT",
        "depin": "📡 DePIN",
        "rwa": "🏢 RWA",
        "etf": "📊 ETF/Institutional Funds",
        "hidden": "💎 Hidden Gem",
        "news": "📰 News Sentiment",
    },
    "ko": {
        "funding": "💰 최신 펀딩 & 투자 유치",
        "grant": "💰 그랜트 프로그램",
        "hackathon": "🏆 해커톤",
        "airdrop": "🎁 에어드랍",
        "testnet": "🧪 테스트넷",
        "listings": "📈 거래소 상장",
        "smartmoney": "🐳 스마트머니",
        "github": "👨‍💻 GitHub 활동",
        "social": "🔥 소셜 급성장",
        "dao": "🏛 DAO Treasury",
        "jobs": "💼 채용 급증",
        "gov": "🏦 정부 지원사업",
        "gamefi": "🎮 GameFi",
        "nft": "🖼 NFT",
        "depin": "📡 DePIN",
        "rwa": "🏢 RWA",
        "etf": "📊 ETF/기관자금",
        "hidden": "💎 Hidden Gem",
        "news": "📰 뉴스 감성",
    },
    "vi": {
        "funding": "💰 Tài trợ & Đầu tư mới nhất",
        "grant": "💰 Chương trình Grant",
        "hackathon": "🏆 Hackathon",
        "airdrop": "🎁 Airdrop",
        "testnet": "🧪 Testnet",
        "listings": "📈 Niêm yết sàn giao dịch",
        "smartmoney": "🐳 Smart Money",
        "github": "👨‍💻 Hoạt động GitHub",
        "social": "🔥 Bùng nổ mạng xã hội",
        "dao": "🏛 DAO Treasury",
        "jobs": "💼 Bùng nổ tuyển dụng",
        "gov": "🏦 Quỹ chính phủ",
        "gamefi": "🎮 GameFi",
        "nft": "🖼 NFT",
        "depin": "📡 DePIN",
        "rwa": "🏢 RWA",
        "etf": "📊 ETF/Quỹ tổ chức",
        "hidden": "💎 Hidden Gem",
        "news": "📰 Cảm xúc tin tức",
    },
}


def detect_lang(language_code: str | None) -> str:
    if language_code:
        if language_code.startswith("ko"):
            return "ko"
        if language_code.startswith("vi"):
            return "vi"
    return "en"


def t(lang: str, key: str, **kwargs) -> str:
    text = _STRINGS.get(lang, _STRINGS["en"]).get(key) or _STRINGS["en"].get(key, key)
    return text.format(**kwargs) if kwargs else text


def category_title(lang: str, category: str) -> str:
    return _CATEGORY_TITLES.get(lang, _CATEGORY_TITLES["en"]).get(category, category.upper())
