from __future__ import annotations

_STRINGS: dict[str, dict[str, str]] = {
    "en": {
        "subscribe_already": "✅ You're already subscribed!\n\n⏰ You'll receive a daily hustle idea at 9 AM and a market briefing at 6 PM.",
        "subscribe_success": "🔔 *Subscribed!*\n\n⏰ You'll receive daily:\n• 9 AM: Today's opportunity\n• 6 PM: Global market briefing\n\nTo unsubscribe: /unsubscribe",
        "unsubscribe_success": "🔕 Notifications disabled.\n\nTo re-subscribe: /subscribe",
        "welcome_user": (
            "💰 *AI Money Hunter Bot*\n\n"
            "Welcome, *{name}*!\n\n"
            "🤖 I deliver AI-analyzed money-making opportunities and global market data daily.\n\n"
            "📋 *Commands*\n"
            "/today — Today's opportunity\n"
            "/market — Global market overview\n"
            "/crypto — Crypto prices\n"
            "/gold — Gold price\n"
            "/stock AAPL — Stock lookup\n"
            "/trend — AI trend analysis\n"
            "/subscribe — Auto-alert subscription\n"
            "/unsubscribe — Cancel alerts\n\n"
            "⏰ *Auto briefings*\n"
            "• 9 AM daily: Today's opportunity\n"
            "• 6 PM daily: Global market briefing"
        ),
        "welcome_group": (
            "💰 *AI Money Hunter Bot*\n\n"
            "Welcome, group *{name}*!\n\n"
            "🤖 I deliver AI-analyzed money-making opportunities and global market data daily.\n\n"
            "📋 *Commands*\n"
            "/today — Today's opportunity\n"
            "/market — Global market\n"
            "/crypto — Crypto prices\n"
            "/gold — Gold price\n"
            "/trend — AI trends\n\n"
            "⏰ *Auto briefings*\n"
            "• 9 AM daily: Today's opportunity\n"
            "• 6 PM daily: Market briefing"
        ),
        "analyzing": "🔍 AI is analyzing today's opportunities...",
        "loading_market": "📡 Loading market data...",
        "loading_crypto": "📡 Loading crypto data...",
        "loading_gold": "📡 Loading gold price...",
        "loading_trend": "🧠 Analyzing AI trends...",
        "loading_stock": "📡 Loading *{query}* data...",
        "stock_usage": "📊 Enter a stock name or ticker.\nExample: `/stock Samsung` or `/stock AAPL`",
        "refreshing": "🔍 AI is re-analyzing...",
        "refreshing_market": "📡 Refreshing market data...",
        "refreshing_crypto": "📡 Refreshing crypto data...",
        "refreshing_gold": "📡 Refreshing gold price...",
        "refreshing_trend": "🧠 Re-analyzing AI trends...",
        "error": "❌ Error: {e}",
        "btn_refresh": "🔄 Refresh",
        "btn_platform": "🌐 AI119",
        "btn_community": "💬 AI119 Community",
    },
    "ko": {
        "subscribe_already": "✅ 이미 알림을 구독 중입니다!\n\n⏰ 매일 오전 9시 돈벌이 아이디어 + 오후 6시 시장 브리핑을 받으실 거예요.",
        "subscribe_success": "🔔 *알림 구독 완료!*\n\n⏰ 매일 받게 될 정보:\n• 오전 9시: 오늘의 돈벌이 아이디어\n• 오후 6시: 글로벌 시장 브리핑\n\n알림을 끄려면 /unsubscribe 를 사용하세요.",
        "unsubscribe_success": "🔕 알림이 해제되었습니다.\n\n다시 구독하려면 /subscribe 를 사용하세요.",
        "welcome_user": (
            "💰 *AI Money Hunter Bot*에 오신 것을 환영합니다, *{name}*님!\n\n"
            "🤖 저는 AI가 분석한 최신 돈벌이 기회와 글로벌 시장 정보를 매일 제공합니다.\n\n"
            "📋 *주요 명령어*\n"
            "/today — 오늘의 돈벌이 아이디어\n"
            "/market — 글로벌 시장 현황\n"
            "/crypto — 암호화폐 시세\n"
            "/gold — 금값 조회\n"
            "/stock 삼성전자 — 특정 종목 조회\n"
            "/trend — AI 트렌드 분석\n"
            "/subscribe — 자동 알림 구독\n"
            "/unsubscribe — 알림 해제\n\n"
            "⏰ *자동 브리핑*\n"
            "• 매일 오전 9시: 오늘의 돈벌이 아이디어\n"
            "• 매일 오후 6시: 글로벌 시장 브리핑"
        ),
        "welcome_group": (
            "💰 *AI Money Hunter Bot*에 오신 것을 환영합니다, 그룹 *{name}*!\n\n"
            "🤖 저는 AI가 분석한 최신 돈벌이 기회와 글로벌 시장 정보를 매일 제공합니다.\n\n"
            "📋 *주요 명령어*\n"
            "/today — 오늘의 기회\n"
            "/market — 글로벌 시장 현황\n"
            "/crypto — 암호화폐 시세\n"
            "/gold — 금값 조회\n"
            "/trend — AI 트렌드 분석\n\n"
            "⏰ *자동 브리핑*\n"
            "• 매일 오전 9시: 오늘의 기회\n"
            "• 매일 오후 6시: 시장 브리핑"
        ),
        "analyzing": "🔍 AI가 오늘의 기회를 분석 중입니다...",
        "loading_market": "📡 시장 데이터를 불러오는 중...",
        "loading_crypto": "📡 암호화폐 데이터를 불러오는 중...",
        "loading_gold": "📡 금값 데이터를 불러오는 중...",
        "loading_trend": "🧠 AI 트렌드를 분석 중입니다...",
        "loading_stock": "📡 *{query}* 데이터를 불러오는 중...",
        "stock_usage": "📊 종목명 또는 티커를 입력하세요.\n예시: `/stock 삼성전자` 또는 `/stock AAPL`",
        "refreshing": "🔍 AI가 재분석 중입니다...",
        "refreshing_market": "📡 시장 데이터 새로고침 중...",
        "refreshing_crypto": "📡 암호화폐 데이터 새로고침 중...",
        "refreshing_gold": "📡 금값 데이터 새로고침 중...",
        "refreshing_trend": "🧠 AI 트렌드 재분석 중...",
        "error": "❌ 오류: {e}",
        "btn_refresh": "🔄 새로고침",
        "btn_platform": "🌐 AI119",
        "btn_community": "💬 AI119 커뮤니티",
    },
    "vi": {
        "subscribe_already": "✅ Bạn đã đăng ký thông báo rồi!\n\n⏰ Bạn sẽ nhận ý tưởng kiếm tiền lúc 9 SA và bản tin thị trường lúc 6 CH hàng ngày.",
        "subscribe_success": "🔔 *Đăng ký thành công!*\n\n⏰ Hàng ngày bạn sẽ nhận:\n• 9 SA: Cơ hội hôm nay\n• 6 CH: Bản tin thị trường\n\nHủy đăng ký: /unsubscribe",
        "unsubscribe_success": "🔕 Đã tắt thông báo.\n\nĐăng ký lại: /subscribe",
        "welcome_user": (
            "💰 *AI Money Hunter Bot*\n\n"
            "Chào mừng, *{name}*!\n\n"
            "🤖 Tôi cung cấp các cơ hội kiếm tiền và thông tin thị trường toàn cầu được AI phân tích hàng ngày.\n\n"
            "📋 *Lệnh*\n"
            "/today — Cơ hội hôm nay\n"
            "/market — Tổng quan thị trường\n"
            "/crypto — Giá tiền điện tử\n"
            "/gold — Giá vàng\n"
            "/stock AAPL — Tra cứu cổ phiếu\n"
            "/trend — Phân tích xu hướng AI\n"
            "/subscribe — Đăng ký thông báo\n"
            "/unsubscribe — Hủy thông báo\n\n"
            "⏰ *Bản tin tự động*\n"
            "• 9 AM hàng ngày: Cơ hội hôm nay\n"
            "• 6 PM hàng ngày: Bản tin thị trường"
        ),
        "welcome_group": (
            "💰 *AI Money Hunter Bot*\n\n"
            "Chào mừng nhóm *{name}*!\n\n"
            "🤖 Tôi cung cấp các cơ hội kiếm tiền và thông tin thị trường toàn cầu được AI phân tích hàng ngày.\n\n"
            "📋 *Lệnh*\n"
            "/today — Cơ hội hôm nay\n"
            "/market — Thị trường\n"
            "/crypto — Giá crypto\n"
            "/gold — Giá vàng\n"
            "/trend — Xu hướng AI\n\n"
            "⏰ *Bản tin tự động*\n"
            "• 9 AM: Cơ hội hôm nay\n"
            "• 6 PM: Bản tin thị trường"
        ),
        "analyzing": "🔍 AI đang phân tích cơ hội hôm nay...",
        "loading_market": "📡 Đang tải dữ liệu thị trường...",
        "loading_crypto": "📡 Đang tải dữ liệu tiền điện tử...",
        "loading_gold": "📡 Đang tải dữ liệu giá vàng...",
        "loading_trend": "🧠 Đang phân tích xu hướng AI...",
        "loading_stock": "📡 Đang tải dữ liệu *{query}*...",
        "stock_usage": "📊 Nhập tên cổ phiếu hoặc mã.\nVí dụ: `/stock Samsung` hoặc `/stock AAPL`",
        "refreshing": "🔍 AI đang phân tích lại...",
        "refreshing_market": "📡 Đang làm mới dữ liệu thị trường...",
        "refreshing_crypto": "📡 Đang làm mới dữ liệu crypto...",
        "refreshing_gold": "📡 Đang làm mới giá vàng...",
        "refreshing_trend": "🧠 Đang phân tích lại xu hướng AI...",
        "error": "❌ Lỗi: {e}",
        "btn_refresh": "🔄 Làm mới",
        "btn_platform": "🌐 AI119",
        "btn_community": "💬 Cộng đồng AI119",
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
