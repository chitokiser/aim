from __future__ import annotations

STRINGS: dict[str, dict[str, str]] = {
    "en": {
        # Welcome / Start
        "welcome_title": "⚽ AI119 Global Football Predictor",
        "welcome_new": (
            "Welcome, {name}! 🎉\n\n"
            "You received *{p:,} P* (free points) as a welcome bonus.\n\n"
            "Predict football match results and rise to the top of the global leaderboard!\n\n"
            "📌 *How to play:*\n"
            "1️⃣ Claim 10,000 P daily via /daily\n"
            "2️⃣ Browse matches with /predict\n"
            "3️⃣ Place your prediction with P (free points)\n"
            "4️⃣ Win and earn more P!\n\n"
            "💡 *Redeem your P points for AI119 premium services!*"
        ),
        "welcome_back": "Welcome back, {name}! 👋\n🎟️ Points: *{p:,} P*",
        # Daily
        "daily_title": "📅 Daily Reward",
        "daily_claimed": "✅ You claimed *{p:,} P* today!\nStreak: *{streak} days* 🔥\nP Balance: *{p_balance:,} P*",
        "daily_already": "⏳ You already claimed today's reward.\nCome back tomorrow! P Balance: *{p_balance:,} P*",
        # Profile / Bet History
        "profile_title": "📊 My Bet History",
        "profile_body": (
            "👤 *{name}*\n\n"
            "🎟️ P Balance: *{p_balance:,} P*\n"
            "🎯 Predictions: *{total}* (✅ {correct} correct)\n"
            "📈 Win Rate: *{rate}%*\n"
            "🔥 Daily Streak: *{streak} days*\n\n"
            "💡 Use your P points to access AI119 premium services!\n\n"
            "🏅 *Achievements:*\n{achievements}"
        ),
        "no_achievements": "None yet — start predicting!",
        # Bet History
        "bets_title": "📊 My Bet History",
        "bets_active": "🕐 *Active Bets*",
        "bets_past": "📋 *Past Results*",
        "bets_empty": "No bets yet. Use /predict to place your first bet!",
        "bets_stats": "📊 Total: *{total}* | ✅ *{correct}* correct | 📈 *{rate}%* win rate",
        # Matches / Predict
        "matches_title": "🗓 Upcoming Matches",
        "no_matches": "No upcoming matches available right now.\nAdmin can add matches with /addmatch.",
        "match_closed": "⛔ Predictions are closed (kick-off in less than {min} minutes).",
        "already_predicted": "✅ You already placed a prediction for this match.",
        "match_detail": "⚽ *{home}* vs *{away}*\n🏆 {league}\n🕐 {time} (KST)",
        "choose_pred_type": "Select prediction type:",
        "choose_home_away": "🏠 Home: *{home}*\n✈️ Away: *{away}*\n\nPick your prediction:",
        "choose_btts": "Both Teams to Score?",
        "choose_ou": "Total Goals Over / Under 2.5?",
        "choose_first": "Which team scores first?",
        "choose_score": "Enter exact score (e.g. *2-1* for Home 2 - Away 1):",
        "choose_handicap": "Asian Handicap — Home team -1 goal:\n🏠 Home wins by 2+ → Home\n✈️ Otherwise → Away",
        "choose_currency": (
            "Choose your bet currency:\n\n"
            "🎟️ *P* — Free daily points\n"
            "💰 *AP* — Premium points\n\n"
            "Your balance — AP: *{ap:,}* | P: *{p:,}*"
        ),
        "btn_bet_ap": "💰 Bet with AP ({ap:,})",
        "btn_bet_p": "🎟️ Bet with P ({p:,})",
        "choose_stake": "Stake amount? Balance: *{balance:,} AP*\nPotential payout: *{payout:,} AP* (×{mult})",
        "choose_stake_p": "Stake amount? P Balance: *{balance:,} P*\nPotential payout: *{payout:,} P* (×{mult})",
        "confirm_pred": (
            "✅ *Confirm Prediction?*\n\n"
            "⚽ {home} vs {away}\n"
            "📊 {type_label}: *{value_label}*\n"
            "💰 Stake: *{stake:,} AP*\n"
            "🏆 Payout: *{payout:,} AP* (×{mult})"
        ),
        "confirm_pred_p": (
            "✅ *Confirm Prediction?*\n\n"
            "⚽ {home} vs {away}\n"
            "📊 {type_label}: *{value_label}*\n"
            "🎟️ Stake: *{stake:,} P*\n"
            "🏆 Payout: *{payout:,} P* (×{mult})"
        ),
        "pred_placed": "✅ Prediction placed!\n⚽ {home} vs {away} — *{value_label}*\nStake: *{stake:,} AP* | Win: *{payout:,} AP*",
        "pred_placed_p": "✅ Prediction placed!\n⚽ {home} vs {away} — *{value_label}*\nStake: *{stake:,} P* | Win: *{payout:,} P*",
        "pred_cancelled": "❌ Prediction cancelled.",
        "insufficient_ap": "❌ Insufficient AP. Balance: *{balance:,} AP*, required: *{stake:,} AP*.",
        "insufficient_p": "❌ Insufficient P. Balance: *{balance:,} P*, required: *{stake:,} P*.",
        "invalid_score": "❌ Invalid format. Use *X-Y* (e.g. 2-1).",
        # Ranking
        "ranking_title": "🏆 Global Leaderboard",
        "ranking_empty": "No ranked players yet.",
        "ranking_row": "{rank}. *{name}* — {correct} wins | {rate}%",
        "ranking_footer": "Your rank: #{my_rank}",
        # Admin
        "admin_menu": "🔧 Admin Panel\n\nCommands:\n/addmatch — Add a match\n/settle <id> <H>-<A> — Settle match\n/cancelbet <match_id> — Cancel all bets on a match\n/broadcast <msg> — Broadcast to all users",
        "addmatch_prompt": (
            "Send match info in this format:\n\n"
            "`Home Team | Away Team | League | YYYY-MM-DD HH:MM`\n\n"
            "Time is in KST (UTC+9)."
        ),
        "addmatch_ok": "✅ Match added! ID: `{id}`\n⚽ {home} vs {away} — {time}",
        "addmatch_err": "❌ Invalid format. Use: `Home | Away | League | YYYY-MM-DD HH:MM`",
        "settle_ok": "✅ Match settled: {home} {hs} - {as_} {away}\n🏆 Winners: {winners} | Total payout: {payout:,} P",
        "settle_not_found": "❌ Match ID {id} not found.",
        "settle_err": "❌ Usage: /settle <id> <H>-<A>  (e.g. /settle 5 2-1)",
        "broadcast_sent": "📢 Broadcast sent to {count} users.",
        "broadcast_usage": "❌ Usage: /broadcast <message>",
        # Analysis
        "analysis_title": "🤖 AI Match Analysis",
        "analysis_generating": "⏳ Generating AI analysis... Please wait.",
        "analysis_unavailable": "❌ AI analysis unavailable at the moment.",
        # Buttons
        "btn_daily": "📅 Daily Reward",
        "btn_predict": "⚽ Predict",
        "btn_ranking": "🏆 Rankings",
        "btn_profile": "📊 My Bet History",
        "btn_help": "❓ Help",
        "btn_community": "⚽ Join Football Community",
        "btn_platform": "🚀 AI119 Platform",
        "btn_home": "🏠 Home Win",
        "btn_draw": "🤝 Draw",
        "btn_away": "✈️ Away Win",
        "btn_yes": "✅ Yes",
        "btn_no": "❌ No",
        "btn_over": "📈 Over 2.5",
        "btn_under": "📉 Under 2.5",
        "btn_first_home": "🏠 Home Scores First",
        "btn_first_away": "✈️ Away Scores First",
        "btn_handicap_home": "🏠 Home (win by 2+)",
        "btn_handicap_away": "✈️ Away (draw/win/lose by 1)",
        "btn_score_input": "🎯 Exact Score",
        "btn_analysis": "🤖 AI Analysis",
        "btn_confirm": "✅ Confirm",
        "btn_cancel": "❌ Cancel",
        "btn_back": "⬅️ Back",
        # Prediction type labels
        "type_1x2": "Match Result (1X2)",
        "type_score": "Exact Score",
        "type_btts": "Both Teams Score",
        "type_ou": "Over/Under 2.5",
        "type_first": "First Scoring Team",
        "type_handicap": "Handicap (-1)",
        # Value labels
        "val_home": "Home Win",
        "val_draw": "Draw",
        "val_away": "Away Win",
        "val_yes": "Yes (BTTS)",
        "val_no": "No (BTTS)",
        "val_over": "Over 2.5",
        "val_under": "Under 2.5",
        "val_home_first": "Home Scores First",
        "val_away_first": "Away Scores First",
        "val_home_hcp": "Home −1 Win",
        "val_away_hcp": "Away +1",
        # Help
        "help_text": (
            "⚽ *AI119 Football Predictor — Help*\n\n"
            "/start — Register / Home menu\n"
            "/predict — Browse upcoming matches\n"
            "/daily — Claim daily 10,000 P (free points)\n"
            "/my — View your bet history\n"
            "/ranking — Global leaderboard\n"
            "/help — This message\n\n"
            "💡 *Prediction types & payouts:*\n"
            "• Match Result (1X2) — ×1.9\n"
            "• Exact Score — ×8.0\n"
            "• Both Teams Score — ×1.85\n"
            "• Over/Under 2.5 — ×1.85\n"
            "• First Scoring Team — ×2.2\n"
            "• Handicap (Home −1) — ×1.85\n\n"
            "🎟️ P = free daily points. Use /daily to claim.\n"
            "💡 Redeem P points for AI119 premium services!"
        ),
    },
    "ko": {
        "welcome_title": "⚽ AI119 글로벌 축구 예측봇",
        "welcome_new": (
            "{name}님 환영합니다! 🎉\n\n"
            "가입 보너스로 *{p:,} P* (무료 포인트)를 받았습니다.\n\n"
            "축구 경기 결과를 예측하고 글로벌 랭킹 1위에 도전하세요!\n\n"
            "📌 *이용 방법:*\n"
            "1️⃣ /daily로 매일 10,000 P 무료 획득\n"
            "2️⃣ /predict로 경기 목록 확인\n"
            "3️⃣ P(무료 포인트)로 예측 배팅\n"
            "4️⃣ 적중 시 더 많은 P 포인트 획득!\n\n"
            "💡 *쌓은 P 포인트로 AI119 유료 서비스를 이용할 수 있어요!*"
        ),
        "welcome_back": "돌아오셨군요, {name}님! 👋\n🎟️ 보유 포인트: *{p:,} P*",
        "daily_title": "📅 일일 보상",
        "daily_claimed": "✅ 오늘 *{p:,} P*를 받았습니다!\n연속 출석: *{streak}일* 🔥\nP 잔액: *{p_balance:,} P*",
        "daily_already": "⏳ 오늘 보상은 이미 받았습니다.\n내일 다시 와주세요! P 잔액: *{p_balance:,} P*",
        "profile_title": "📊 내 베팅전적",
        "profile_body": (
            "👤 *{name}*\n\n"
            "🎟️ P 잔액: *{p_balance:,} P*\n"
            "🎯 예측 횟수: *{total}* (✅ {correct}회 적중)\n"
            "📈 적중률: *{rate}%*\n"
            "🔥 연속 출석: *{streak}일*\n\n"
            "💡 P 포인트로 AI119 유료 서비스 이용 가능!\n\n"
            "🏅 *업적:*\n{achievements}"
        ),
        "no_achievements": "아직 없습니다 — 예측을 시작해 보세요!",
        # Bet History
        "bets_title": "📊 내 베팅전적",
        "bets_active": "🕐 *진행 중인 베팅*",
        "bets_past": "📋 *과거 베팅 결과*",
        "bets_empty": "베팅 내역이 없습니다. /predict 로 첫 배팅을 해보세요!",
        "bets_stats": "📊 총 *{total}*건 | ✅ *{correct}*회 적중 | 📈 적중률 *{rate}%*",
        "matches_title": "🗓 예정 경기",
        "no_matches": "현재 예정된 경기가 없습니다.\n관리자가 /addmatch로 경기를 추가할 수 있습니다.",
        "match_closed": "⛔ 예측 마감 (킥오프 {min}분 전부터 불가).",
        "already_predicted": "✅ 이미 이 경기에 예측을 했습니다.",
        "match_detail": "⚽ *{home}* vs *{away}*\n🏆 {league}\n🕐 {time} (KST)",
        "choose_pred_type": "예측 유형을 선택하세요:",
        "choose_home_away": "🏠 홈: *{home}*\n✈️ 원정: *{away}*\n\n예측을 선택하세요:",
        "choose_btts": "양 팀 모두 득점하나요?",
        "choose_ou": "총 골 수 오버/언더 2.5?",
        "choose_first": "첫 번째 득점 팀은?",
        "choose_score": "정확한 스코어를 입력하세요 (예: *2-1* = 홈 2 - 원정 1):",
        "choose_handicap": "핸디캡 — 홈팀 -1골:\n🏠 홈팀 2골 차 이상 승리 → 홈\n✈️ 그 외 → 원정",
        "choose_currency": (
            "배팅 포인트를 선택하세요:\n\n"
            "🎟️ *P* — 매일 무료 포인트\n"
            "💰 *AP* — 프리미엄 포인트\n\n"
            "현재 잔액 — AP: *{ap:,}* | P: *{p:,}*"
        ),
        "btn_bet_ap": "💰 AP로 배팅 ({ap:,})",
        "btn_bet_p": "🎟️ P로 배팅 ({p:,})",
        "choose_stake": "배팅 금액? 잔액: *{balance:,} AP*\n예상 당첨금: *{payout:,} AP* (×{mult})",
        "choose_stake_p": "배팅 금액? P 잔액: *{balance:,} P*\n예상 당첨금: *{payout:,} P* (×{mult})",
        "confirm_pred": (
            "✅ *예측 확인?*\n\n"
            "⚽ {home} vs {away}\n"
            "📊 {type_label}: *{value_label}*\n"
            "💰 배팅: *{stake:,} AP*\n"
            "🏆 당첨금: *{payout:,} AP* (×{mult})"
        ),
        "confirm_pred_p": (
            "✅ *예측 확인?*\n\n"
            "⚽ {home} vs {away}\n"
            "📊 {type_label}: *{value_label}*\n"
            "🎟️ 배팅: *{stake:,} P*\n"
            "🏆 당첨금: *{payout:,} P* (×{mult})"
        ),
        "pred_placed": "✅ 예측 완료!\n⚽ {home} vs {away} — *{value_label}*\n배팅: *{stake:,} AP* | 당첨: *{payout:,} AP*",
        "pred_placed_p": "✅ 예측 완료!\n⚽ {home} vs {away} — *{value_label}*\n배팅: *{stake:,} P* | 당첨: *{payout:,} P*",
        "pred_cancelled": "❌ 예측이 취소됐습니다.",
        "insufficient_ap": "❌ AP 부족. 잔액: *{balance:,} AP*, 필요: *{stake:,} AP*.",
        "insufficient_p": "❌ P 부족. 잔액: *{balance:,} P*, 필요: *{stake:,} P*.",
        "invalid_score": "❌ 잘못된 형식입니다. *X-Y* 형식으로 입력하세요 (예: 2-1).",
        "ranking_title": "🏆 글로벌 랭킹",
        "ranking_empty": "랭킹 데이터가 없습니다.",
        "ranking_row": "{rank}. *{name}* — {correct}회 적중 | {rate}%",
        "ranking_footer": "내 순위: #{my_rank}",
        "admin_menu": "🔧 관리자 패널\n\n명령어:\n/addmatch — 경기 추가\n/settle <id> <홈>-<원정> — 경기 정산\n/cancelbet <경기id> — 배팅 취소\n/broadcast <메시지> — 전체 공지",
        "addmatch_prompt": (
            "다음 형식으로 경기 정보를 입력하세요:\n\n"
            "`홈팀 | 원정팀 | 리그 | YYYY-MM-DD HH:MM`\n\n"
            "시간은 KST (UTC+9) 기준입니다."
        ),
        "addmatch_ok": "✅ 경기 추가 완료! ID: `{id}`\n⚽ {home} vs {away} — {time}",
        "addmatch_err": "❌ 잘못된 형식. 사용: `홈 | 원정 | 리그 | YYYY-MM-DD HH:MM`",
        "settle_ok": "✅ 경기 정산 완료: {home} {hs} - {as_} {away}\n🏆 당첨자: {winners}명 | 총 지급: {payout:,} P",
        "settle_not_found": "❌ 경기 ID {id}를 찾을 수 없습니다.",
        "settle_err": "❌ 사용법: /settle <id> <홈>-<원정> (예: /settle 5 2-1)",
        "broadcast_sent": "📢 {count}명에게 공지를 보냈습니다.",
        "broadcast_usage": "❌ 사용법: /broadcast <메시지>",
        "analysis_title": "🤖 AI 경기 분석",
        "analysis_generating": "⏳ AI 분석 중... 잠시 기다려 주세요.",
        "analysis_unavailable": "❌ 현재 AI 분석을 이용할 수 없습니다.",
        "btn_daily": "📅 일일 보상",
        "btn_predict": "⚽ 배팅하기",
        "btn_ranking": "🏆 랭킹",
        "btn_profile": "📊 내 베팅전적",
        "btn_help": "❓ 도움말",
        "btn_community": "⚽ Football 커뮤니티 참여",
        "btn_platform": "🚀 AI119 플랫폼",
        "btn_home": "🏠 홈 승리",
        "btn_draw": "🤝 무승부",
        "btn_away": "✈️ 원정 승리",
        "btn_yes": "✅ 예",
        "btn_no": "❌ 아니오",
        "btn_over": "📈 오버 2.5",
        "btn_under": "📉 언더 2.5",
        "btn_first_home": "🏠 홈팀 선취",
        "btn_first_away": "✈️ 원정팀 선취",
        "btn_handicap_home": "🏠 홈 (2골 차 이상 승)",
        "btn_handicap_away": "✈️ 원정 (무승부/승리/1골 차 패)",
        "btn_score_input": "🎯 정확한 스코어",
        "btn_analysis": "🤖 AI 분석",
        "btn_confirm": "✅ 확인",
        "btn_cancel": "❌ 취소",
        "btn_back": "⬅️ 뒤로",
        "type_1x2": "승무패 (1X2)",
        "type_score": "정확한 스코어",
        "type_btts": "양 팀 모두 득점",
        "type_ou": "오버/언더 2.5",
        "type_first": "첫 득점 팀",
        "type_handicap": "핸디캡 (-1)",
        "val_home": "홈 승",
        "val_draw": "무승부",
        "val_away": "원정 승",
        "val_yes": "예 (양팀 득점)",
        "val_no": "아니오 (양팀 득점 X)",
        "val_over": "오버 2.5",
        "val_under": "언더 2.5",
        "val_home_first": "홈팀 선취",
        "val_away_first": "원정팀 선취",
        "val_home_hcp": "홈 핸디 승",
        "val_away_hcp": "원정 핸디 승",
        "help_text": (
            "⚽ *AI119 축구 예측봇 — 도움말*\n\n"
            "/start — 등록 / 홈 메뉴\n"
            "/predict — 예정 경기 보기\n"
            "/daily — 매일 10,000 P 무료 받기\n"
            "/my — 내 베팅전적 보기\n"
            "/ranking — 글로벌 랭킹\n"
            "/help — 이 메시지\n\n"
            "💡 *예측 유형 & 배당률:*\n"
            "• 승무패 (1X2) — ×1.9\n"
            "• 정확한 스코어 — ×8.0\n"
            "• 양팀 득점 — ×1.85\n"
            "• 오버/언더 2.5 — ×1.85\n"
            "• 첫 득점 팀 — ×2.2\n"
            "• 핸디캡 (홈 −1) — ×1.85\n\n"
            "🎟️ P = 무료 포인트. /daily로 매일 수령.\n"
            "💡 쌓은 P 포인트로 AI119 유료 서비스 이용 가능!"
        ),
    },
    "vi": {
        "welcome_title": "⚽ AI119 Dự Đoán Bóng Đá Toàn Cầu",
        "welcome_new": (
            "Chào mừng, {name}! 🎉\n\n"
            "Bạn nhận được *{p:,} P* (điểm miễn phí) làm thưởng chào mừng.\n\n"
            "Dự đoán kết quả bóng đá và leo lên bảng xếp hạng toàn cầu!\n\n"
            "📌 *Cách chơi:*\n"
            "1️⃣ Nhận 10,000 P mỗi ngày qua /daily\n"
            "2️⃣ Xem trận đấu với /predict\n"
            "3️⃣ Đặt cược bằng P (điểm miễn phí)\n"
            "4️⃣ Thắng và kiếm thêm P!\n\n"
            "💡 *Dùng P để truy cập dịch vụ cao cấp của AI119!*"
        ),
        "welcome_back": "Chào mừng trở lại, {name}! 👋\n🎟️ Điểm: *{p:,} P*",
        "daily_title": "📅 Phần Thưởng Hàng Ngày",
        "daily_claimed": "✅ Bạn đã nhận *{p:,} P* hôm nay!\nChuỗi: *{streak} ngày* 🔥\nSố dư P: *{p_balance:,} P*",
        "daily_already": "⏳ Bạn đã nhận thưởng hôm nay rồi.\nQuay lại vào ngày mai! Số dư P: *{p_balance:,} P*",
        "profile_title": "📊 Lịch Sử Cược",
        "profile_body": (
            "👤 *{name}*\n\n"
            "🎟️ Số dư P: *{p_balance:,} P*\n"
            "🎯 Dự đoán: *{total}* (✅ {correct} đúng)\n"
            "📈 Tỷ lệ thắng: *{rate}%*\n"
            "🔥 Chuỗi hàng ngày: *{streak} ngày*\n\n"
            "💡 Dùng P để truy cập dịch vụ cao cấp AI119!\n\n"
            "🏅 *Thành tích:*\n{achievements}"
        ),
        "no_achievements": "Chưa có — hãy bắt đầu dự đoán!",
        # Bet History
        "bets_title": "📊 Lịch Sử Cược",
        "bets_active": "🕐 *Cược Đang Chờ*",
        "bets_past": "📋 *Kết Quả Cũ*",
        "bets_empty": "Chưa có cược nào. Dùng /predict để đặt cược đầu tiên!",
        "bets_stats": "📊 Tổng: *{total}* | ✅ *{correct}* đúng | 📈 *{rate}%* thắng",
        "matches_title": "🗓 Trận Đấu Sắp Tới",
        "no_matches": "Không có trận đấu sắp tới.\nAdmin có thể thêm trận bằng /addmatch.",
        "match_closed": "⛔ Đóng dự đoán (còn chưa đầy {min} phút trước khi bắt đầu).",
        "already_predicted": "✅ Bạn đã đặt dự đoán cho trận này rồi.",
        "match_detail": "⚽ *{home}* vs *{away}*\n🏆 {league}\n🕐 {time} (KST)",
        "choose_pred_type": "Chọn loại dự đoán:",
        "choose_home_away": "🏠 Chủ nhà: *{home}*\n✈️ Khách: *{away}*\n\nChọn dự đoán:",
        "choose_btts": "Cả hai đội đều ghi bàn?",
        "choose_ou": "Tổng số bàn thắng Trên/Dưới 2.5?",
        "choose_first": "Đội nào ghi bàn trước?",
        "choose_score": "Nhập tỷ số chính xác (ví dụ: *2-1* = Chủ nhà 2 - Khách 1):",
        "choose_handicap": "Chấp bóng — Chủ nhà -1 bàn:\n🏠 Chủ nhà thắng 2+ bàn → Chủ nhà\n✈️ Còn lại → Khách",
        "choose_currency": (
            "Chọn điểm để đặt cược:\n\n"
            "🎟️ *P* — Điểm miễn phí hàng ngày\n"
            "💰 *AP* — Điểm cao cấp\n\n"
            "Số dư — AP: *{ap:,}* | P: *{p:,}*"
        ),
        "btn_bet_ap": "💰 Cược bằng AP ({ap:,})",
        "btn_bet_p": "🎟️ Cược bằng P ({p:,})",
        "choose_stake": "Số AP đặt cược? Số dư: *{balance:,} AP*\nThưởng dự kiến: *{payout:,} AP* (×{mult})",
        "choose_stake_p": "Số P đặt cược? Số dư P: *{balance:,} P*\nThưởng dự kiến: *{payout:,} P* (×{mult})",
        "confirm_pred": (
            "✅ *Xác nhận Dự đoán?*\n\n"
            "⚽ {home} vs {away}\n"
            "📊 {type_label}: *{value_label}*\n"
            "💰 Cược: *{stake:,} AP*\n"
            "🏆 Thưởng: *{payout:,} AP* (×{mult})"
        ),
        "confirm_pred_p": (
            "✅ *Xác nhận Dự đoán?*\n\n"
            "⚽ {home} vs {away}\n"
            "📊 {type_label}: *{value_label}*\n"
            "🎟️ Cược: *{stake:,} P*\n"
            "🏆 Thưởng: *{payout:,} P* (×{mult})"
        ),
        "pred_placed": "✅ Đã đặt dự đoán!\n⚽ {home} vs {away} — *{value_label}*\nCược: *{stake:,} AP* | Thắng: *{payout:,} AP*",
        "pred_placed_p": "✅ Đã đặt dự đoán!\n⚽ {home} vs {away} — *{value_label}*\nCược: *{stake:,} P* | Thắng: *{payout:,} P*",
        "pred_cancelled": "❌ Đã hủy dự đoán.",
        "insufficient_ap": "❌ Không đủ AP. Số dư: *{balance:,} AP*, cần: *{stake:,} AP*.",
        "insufficient_p": "❌ Không đủ P. Số dư: *{balance:,} P*, cần: *{stake:,} P*.",
        "invalid_score": "❌ Định dạng không hợp lệ. Dùng *X-Y* (ví dụ: 2-1).",
        "ranking_title": "🏆 Bảng Xếp Hạng Toàn Cầu",
        "ranking_empty": "Chưa có người chơi nào.",
        "ranking_row": "{rank}. *{name}* — {correct} thắng | {rate}%",
        "ranking_footer": "Hạng của bạn: #{my_rank}",
        "admin_menu": "🔧 Bảng Quản Trị\n\nLệnh:\n/addmatch — Thêm trận đấu\n/settle <id> <H>-<A> — Giải quyết trận\n/cancelbet <id> — Hủy tất cả cược\n/broadcast <tin> — Gửi thông báo",
        "addmatch_prompt": (
            "Gửi thông tin trận đấu theo định dạng:\n\n"
            "`Chủ nhà | Khách | Giải | YYYY-MM-DD HH:MM`\n\n"
            "Thời gian theo KST (UTC+9)."
        ),
        "addmatch_ok": "✅ Đã thêm trận! ID: `{id}`\n⚽ {home} vs {away} — {time}",
        "addmatch_err": "❌ Sai định dạng. Dùng: `Chủ nhà | Khách | Giải | YYYY-MM-DD HH:MM`",
        "settle_ok": "✅ Đã giải quyết: {home} {hs} - {as_} {away}\n🏆 Người thắng: {winners} | Tổng thưởng: {payout:,} P",
        "settle_not_found": "❌ Không tìm thấy trận ID {id}.",
        "settle_err": "❌ Dùng: /settle <id> <H>-<A> (ví dụ: /settle 5 2-1)",
        "broadcast_sent": "📢 Đã gửi thông báo đến {count} người.",
        "broadcast_usage": "❌ Dùng: /broadcast <tin nhắn>",
        "analysis_title": "🤖 Phân Tích AI",
        "analysis_generating": "⏳ Đang phân tích... Vui lòng chờ.",
        "analysis_unavailable": "❌ Phân tích AI tạm thời không khả dụng.",
        "btn_daily": "📅 Phần Thưởng Hàng Ngày",
        "btn_predict": "⚽ Dự đoán",
        "btn_ranking": "🏆 Xếp Hạng",
        "btn_profile": "📊 Lịch Sử Cược",
        "btn_help": "❓ Trợ Giúp",
        "btn_community": "⚽ Tham Gia Football Community",
        "btn_platform": "🚀 Nền Tảng AI119",
        "btn_home": "🏠 Chủ Nhà Thắng",
        "btn_draw": "🤝 Hòa",
        "btn_away": "✈️ Khách Thắng",
        "btn_yes": "✅ Có",
        "btn_no": "❌ Không",
        "btn_over": "📈 Trên 2.5",
        "btn_under": "📉 Dưới 2.5",
        "btn_first_home": "🏠 Chủ Nhà Ghi Trước",
        "btn_first_away": "✈️ Khách Ghi Trước",
        "btn_handicap_home": "🏠 Chủ Nhà (thắng 2+)",
        "btn_handicap_away": "✈️ Khách (còn lại)",
        "btn_score_input": "🎯 Tỷ Số Chính Xác",
        "btn_analysis": "🤖 Phân Tích AI",
        "btn_confirm": "✅ Xác Nhận",
        "btn_cancel": "❌ Hủy",
        "btn_back": "⬅️ Quay Lại",
        "type_1x2": "Kết quả (1X2)",
        "type_score": "Tỷ số chính xác",
        "type_btts": "Cả hai đội ghi bàn",
        "type_ou": "Trên/Dưới 2.5",
        "type_first": "Đội ghi bàn trước",
        "type_handicap": "Chấp bóng (−1)",
        "val_home": "Chủ Nhà Thắng",
        "val_draw": "Hòa",
        "val_away": "Khách Thắng",
        "val_yes": "Có (cả hai ghi)",
        "val_no": "Không (cả hai ghi)",
        "val_over": "Trên 2.5",
        "val_under": "Dưới 2.5",
        "val_home_first": "Chủ Nhà Ghi Trước",
        "val_away_first": "Khách Ghi Trước",
        "val_home_hcp": "Chủ Nhà Chấp Thắng",
        "val_away_hcp": "Khách Chấp Thắng",
        "help_text": (
            "⚽ *AI119 Dự Đoán Bóng Đá — Trợ Giúp*\n\n"
            "/start — Đăng ký / Menu chính\n"
            "/predict — Xem trận sắp tới\n"
            "/daily — Nhận 10,000 P miễn phí mỗi ngày\n"
            "/my — Lịch sử cược\n"
            "/ranking — Bảng xếp hạng\n"
            "/help — Tin nhắn này\n\n"
            "💡 *Loại dự đoán & hệ số:*\n"
            "• Kết quả (1X2) — ×1.9\n"
            "• Tỷ số chính xác — ×8.0\n"
            "• Cả hai đội ghi bàn — ×1.85\n"
            "• Trên/Dưới 2.5 — ×1.85\n"
            "• Đội ghi bàn trước — ×2.2\n"
            "• Chấp bóng (Chủ −1) — ×1.85\n\n"
            "🎟️ P = điểm miễn phí. Nhận hàng ngày qua /daily.\n"
            "💡 Dùng P để truy cập dịch vụ cao cấp AI119!"
        ),
    },
}


def detect_lang(telegram_lang: str | None) -> str:
    if telegram_lang:
        if telegram_lang.startswith("ko"):
            return "ko"
        if telegram_lang.startswith("vi"):
            return "vi"
    return "en"


def t(lang: str, key: str, **kwargs: object) -> str:
    text = STRINGS.get(lang, STRINGS["en"]).get(key) or STRINGS["en"].get(key, key)
    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, ValueError):
            pass
    return text
