"""Internationalization strings — EN / KO / VI."""

STRINGS: dict[str, dict[str, str]] = {
    "en": {
        # /start
        "start_welcome": (
            "🗺 *Welcome to AI Treasure Hunt!*\n\n"
            "Find the coordinates hidden by the admin.\n"
            "Answer 10 AI-generated questions to reveal the exact location!\n\n"
            "🎁 New players receive *{starting_p:,} P*!\n"
            "💡 Hints: Lv1=100 P / Lv2=300 P / Lv3=500 P\n"
            "⚠️ 3 wrong answers = banned from that treasure\n\n"
            "Use the buttons below to get started 👇"
        ),
        "no_treasures_available": "No treasures available right now.\nNew ones coming soon! 🗺",
        "treasures_header": "🗺 *Available Treasures* ({count})\n\n✅=Done  ▶️=Playing  🆕=New",
        "gp_balance_body": (
            "💰 *My P Balance*\n\nBalance: *{balance:,} P*\n\n"
            "P is used for hints.\n"
            "• Lv1 Hint: 100 P\n• Lv2 Hint: 300 P\n• Lv3 Hint: 500 P"
        ),
        # language
        "lang_select": "🌐 *Select Language*\n\nChoose your preferred language:",
        "lang_changed": "✅ Language set to *English*.",
        # treasure info
        "treasure_not_found": "❌ Treasure not found.",
        "treasure_default_desc": "Find the exact location of the treasure!",
        "treasure_info": (
            "🗺 *Treasure #{id}*\n\n"
            "📍 Location: 🔒 Revealed after 10 correct answers\n"
            "🎁 Prize: *{prize:,} P*\n"
            "📝 {description}\n"
            "📋 Questions: {qtotal}{progress}"
        ),
        "progress_completed": "\n✅ *Already completed.*",
        "progress_failed": "\n💀 *Challenge failed.*",
        "progress_ongoing": "\n▶️ *In Progress* — {current}/{total} (wrong: {wrong}/3)",
        # game
        "already_failed": "💀 Already failed. Try another treasure!",
        "already_completed_body": (
            "✅ Already completed!\n\n📍 {clue}\n\n"
            "🌍 https://maps.google.com/?q={lat},{lon}"
        ),
        "game_ended": "❌ This game has already ended.",
        "question_load_error": "❌ Failed to load question.",
        "treasure_load_error": "❌ Failed to load treasure.",
        "question_header": "🗺 *Treasure #{tid} — Q{q}/{total}*\n\n❓ *{question}*\n\n",
        "purchased_hints_header": "\n💡 *Purchased Hints:*\n",
        "wrong_count_display": "\nWrong: {crosses} ({count}/3)",
        "correct_answer": (
            "✅ *Correct!* ({q}/{total})\n\n"
            "📍 Coordinate clue:\n```\n{clue}\n```\n\nNext question!"
        ),
        "victory": (
            "🎉 *Treasure Found! Congratulations!*\n\n"
            "🏆 All {total} questions answered correctly!\n\n"
            "📍 *Full Coordinates:*\n"
            "```\nLatitude: {lat:.6f}\nLongitude: {lon:.6f}\n```\n\n"
            "🌍 https://maps.google.com/?q={lat},{lon}\n\n"
            "🎁 Prize: *{prize:,} P*\n{description}"
        ),
        "wrong_answer": "❌ *Wrong!*\n\nChances left: *{remaining}*\n\nTry again!",
        "game_over": (
            "💀 *Challenge Failed!*\n\n"
            "3 wrong answers — treasure is now locked.\n\n"
            "Correct: *{correct_label}) {correct_text}*\n\nTry another! 💪"
        ),
        "hint_balance_info": "\n\n💰 P Balance: *{balance:,}*\n💡 Lv{level} Hint: *{cost:,} P*",
        "hint_insufficient": "❌ Not enough P.\nBalance: {balance:,} P / Need: {cost:,} P",
        "hint_bought": "✅ Lv{level} hint purchased! -{cost:,} P",
        "hint_already_purchased": "💡 Lv{level} hint: {text}",
        "already_answered": "You already moved to the next question.",
        "menu_text": (
            "🗺 *AI Treasure Hunt*\n\n"
            "Find coordinates through AI questions!\n\n"
            "💡 Hints: Lv1=100 P / Lv2=300 P / Lv3=500 P\n"
            "⚠️ 3 wrong = banned from that treasure"
        ),
        # keyboards
        "btn_treasure_list": "🗺 View Treasure List",
        "btn_jumpworld": "🏪 Treasure Hunt on Jumpworld",
        "btn_community": "💬 AIM Community",
        "btn_completed": "✅ Completed",
        "btn_continue": "▶️ Continue",
        "btn_start_challenge": "🎯 Start Challenge!",
        "btn_back_list": "📋 Treasure List",
        "btn_other_treasures": "📋 Try Other Treasures",
        "btn_google_maps": "🌍 View on Google Maps",
        "btn_jumpworld_visit": "🏪 Visit Jumpworld",
        "btn_next_question": "➡️ Next Question",
        "btn_retry": "🔄 Try Again",
        "btn_main_menu": "🔙 Main Menu",
        "btn_challenge": "🎯 Challenge!",
        # admin
        "admin_only": "⛔ Admin-only command.",
        "ask_coords": (
            "🗺 *Register New Treasure*\n\n"
            "Enter GPS coordinates.\nFormat: `lat lon`\nExample: `37.5665 126.9780`\n\n"
            "/cancel — Cancel"
        ),
        "invalid_coords_format": "❌ Invalid format.\nExample: `37.5665 126.9780`\n\nTry again.",
        "invalid_coords_range": "❌ Invalid range (lat ±90, lon ±180).",
        "coords_confirmed": (
            "✅ Coords: `{lat:.6f}, {lon:.6f}`\n\n"
            "Enter prize amount in P.\nExample: `5000`"
        ),
        "invalid_prize": "❌ Enter a positive number. Example: `5000`",
        "prize_confirmed": (
            "✅ Prize: *{prize:,} P*\n\n"
            "Enter treasure description.\n(Enter `-` for default)"
        ),
        "generating": "⏳ AI is generating questions...\n(~20–40 seconds)",
        "ai_failed": "❌ AI question generation failed. Try again.",
        "treasure_created_progress": (
            "✅ Treasure #{id} created!\n📍 {location}\n🎁 {prize:,} P\n"
            "📋 {count} questions\n\nAnnouncing to group..."
        ),
        "treasure_created_ok": (
            "✅ Treasure #{id} registered!\n📍 {location}\n"
            "🎁 {prize:,} P\n📋 {count} questions"
        ),
        "create_error": "❌ Error: {error}\nTry /newtreasure again.",
        "cancelled": "❌ Treasure registration cancelled.",
        "admin_panel": (
            "🛠 *Admin Panel*\n\n"
            "🗺 Treasures: {total} (active: {active})\n"
            "👥 Players: {players}\n"
            "🎮 Attempts: {attempts}\n"
            "✅ Completions: {completions}\n\n"
            "/newtreasure — Register new\n/admin — This panel"
        ),
    },

    "ko": {
        # /start
        "start_welcome": (
            "🗺 *AI 보물찾기 게임에 오신 걸 환영합니다!*\n\n"
            "운영자가 숨겨놓은 보물의 좌표를 찾아보세요.\n"
            "AI가 만든 10개의 문제를 맞히면 정확한 좌표가 공개됩니다!\n\n"
            "🎁 신규 참가자에게 *{starting_p:,} P* 지급!\n"
            "💡 힌트: Lv1=100 P / Lv2=300 P / Lv3=500 P\n"
            "⚠️ 3번 오답 시 해당 보물 도전 불가\n\n"
            "아래 버튼으로 시작하세요 👇"
        ),
        "no_treasures_available": "현재 도전할 수 있는 보물이 없습니다.\n곧 새로운 보물이 등장할 예정입니다! 🗺",
        "treasures_header": "🗺 *도전 가능한 보물 목록* ({count}개)\n\n✅=완료  ▶️=진행중  🆕=미도전",
        "gp_balance_body": (
            "💰 *내 P 잔액*\n\n현재 잔액: *{balance:,} P*\n\n"
            "P는 힌트 구매 시 사용됩니다.\n"
            "• Lv1 힌트: 100 P\n• Lv2 힌트: 300 P\n• Lv3 힌트: 500 P"
        ),
        # language
        "lang_select": "🌐 *언어 선택*\n\n사용할 언어를 선택하세요:",
        "lang_changed": "✅ 언어가 *한국어*로 설정되었습니다.",
        # treasure info
        "treasure_not_found": "❌ 해당 보물을 찾을 수 없습니다.",
        "treasure_default_desc": "보물의 위치를 찾아보세요!",
        "treasure_info": (
            "🗺 *보물 #{id}*\n\n"
            "📍 위치: 🔒 10문제 정답 시 공개\n"
            "🎁 상금: *{prize:,} P*\n"
            "📝 {description}\n"
            "📋 문제 수: {qtotal}문제{progress}"
        ),
        "progress_completed": "\n✅ *이미 완료한 보물입니다.*",
        "progress_failed": "\n💀 *도전에 실패한 보물입니다.*",
        "progress_ongoing": "\n▶️ *진행 중* — {current}/{total} 문제 (오답 {wrong}/3)",
        # game
        "already_failed": "💀 이미 실패한 보물입니다. 다른 보물에 도전하세요!",
        "already_completed_body": (
            "✅ 이미 완료한 보물입니다!\n\n📍 {clue}\n\n"
            "🌍 https://maps.google.com/?q={lat},{lon}"
        ),
        "game_ended": "❌ 이미 종료된 게임입니다.",
        "question_load_error": "❌ 문제를 불러오지 못했습니다.",
        "treasure_load_error": "❌ 보물을 찾을 수 없습니다.",
        "question_header": "🗺 *보물 #{tid} — Q{q}/{total}*\n\n❓ *{question}*\n\n",
        "purchased_hints_header": "\n💡 *구매한 힌트:*\n",
        "wrong_count_display": "\n오답 기록: {crosses} ({count}/3)",
        "correct_answer": (
            "✅ *정답입니다!* ({q}/{total})\n\n"
            "📍 좌표 단서 공개:\n```\n{clue}\n```\n\n다음 문제로 이동하세요!"
        ),
        "victory": (
            "🎉 *보물 발견! 축하합니다!*\n\n"
            "🏆 {total}문제를 모두 맞히셨습니다!\n\n"
            "📍 *전체 좌표 공개:*\n"
            "```\n위도: {lat:.6f}\n경도: {lon:.6f}\n```\n\n"
            "🌍 https://maps.google.com/?q={lat},{lon}\n\n"
            "🎁 상금: *{prize:,} P*\n{description}"
        ),
        "wrong_answer": "❌ *오답입니다!*\n\n남은 기회: *{remaining}번*\n\n다시 도전하세요!",
        "game_over": (
            "💀 *도전 실패!*\n\n"
            "3번 오답으로 도전이 종료됩니다.\n\n"
            "정답: *{correct_label}) {correct_text}*\n\n다른 보물에 도전해보세요! 💪"
        ),
        "hint_balance_info": "\n\n💰 현재 P: *{balance:,}*\n💡 Lv{level} 힌트 구매: *{cost:,} P*",
        "hint_insufficient": "❌ P가 부족합니다.\n현재 잔액: {balance:,} P / 필요: {cost:,} P",
        "hint_bought": "✅ Lv{level} 힌트 구매 완료! -{cost:,} P",
        "hint_already_purchased": "💡 Lv{level} 힌트: {text}",
        "already_answered": "이미 다음 문제로 진행했습니다.",
        "menu_text": (
            "🗺 *AI 보물찾기*\n\n"
            "보물의 좌표를 AI 문제로 찾아보세요!\n\n"
            "💡 힌트: Lv1=100 P / Lv2=300 P / Lv3=500 P\n"
            "⚠️ 3번 오답 시 해당 보물 도전 불가"
        ),
        # keyboards
        "btn_treasure_list": "🗺 보물 목록 보기",
        "btn_jumpworld": "🏪 Jumpworld 보물찾으러 가기",
        "btn_community": "💬 AIM 커뮤니티",
        "btn_completed": "✅ 완료됨",
        "btn_continue": "▶️ 이어서 도전",
        "btn_start_challenge": "🎯 도전 시작!",
        "btn_back_list": "📋 보물 목록",
        "btn_other_treasures": "📋 다른 보물 도전",
        "btn_google_maps": "🌍 Google Maps에서 확인",
        "btn_jumpworld_visit": "🏪 Jumpworld 방문하기",
        "btn_next_question": "➡️ 다음 문제",
        "btn_retry": "🔄 다시 도전",
        "btn_main_menu": "🔙 메인 메뉴",
        "btn_challenge": "🎯 도전하기",
        # admin
        "admin_only": "⛔ 관리자 전용 명령어입니다.",
        "ask_coords": (
            "🗺 *새 보물 등록*\n\n"
            "보물의 GPS 좌표를 입력해주세요.\n"
            "형식: `위도 경도`\n예시: `37.5665 126.9780`\n\n/cancel — 취소"
        ),
        "invalid_coords_format": "❌ 형식이 올바르지 않습니다.\n예시: `37.5665 126.9780`\n\n다시 입력해주세요.",
        "invalid_coords_range": "❌ 좌표 범위가 유효하지 않습니다 (위도 ±90, 경도 ±180).",
        "coords_confirmed": (
            "✅ 좌표 확인: `{lat:.6f}, {lon:.6f}`\n\n"
            "상금액을 P 단위로 입력해주세요.\n예시: `5000` (5,000 P)"
        ),
        "invalid_prize": "❌ 양수 숫자를 입력해주세요. 예: `5000`",
        "prize_confirmed": (
            "✅ 상금: *{prize:,} P*\n\n"
            "보물 설명을 입력해주세요.\n(기본값 사용: `-` 입력)"
        ),
        "generating": "⏳ AI가 보물 문제를 생성 중입니다...\n(약 20~40초 소요)",
        "ai_failed": "❌ AI 문제 생성에 실패했습니다. 다시 시도해주세요.",
        "treasure_created_progress": (
            "✅ 보물 #{id} 생성 완료!\n📍 {location}\n🎁 {prize:,} P\n"
            "📋 {count}문제 생성됨\n\n그룹에 공지 중..."
        ),
        "treasure_created_ok": (
            "✅ 보물 #{id} 등록 및 그룹 공지 완료!\n📍 위치: {location}\n"
            "🎁 상금: {prize:,} P\n📋 문제: {count}개"
        ),
        "create_error": "❌ 오류 발생: {error}\n다시 /newtreasure 로 시도해주세요.",
        "cancelled": "❌ 보물 등록이 취소되었습니다.",
        "admin_panel": (
            "🛠 *관리자 패널*\n\n"
            "🗺 전체 보물: {total}개 (활성: {active}개)\n"
            "👥 총 플레이어: {players}명\n"
            "🎮 총 도전: {attempts}회\n"
            "✅ 완료: {completions}회\n\n"
            "/newtreasure — 새 보물 등록\n/admin — 이 패널"
        ),
    },

    "vi": {
        # /start
        "start_welcome": (
            "🗺 *Chào mừng đến với Tìm Kho Báu AI!*\n\n"
            "Tìm tọa độ kho báu được quản trị viên giấu.\n"
            "Trả lời đúng 10 câu hỏi AI để lộ tọa độ chính xác!\n\n"
            "🎁 Người chơi mới nhận *{starting_p:,} P*!\n"
            "💡 Gợi ý: Lv1=100 P / Lv2=300 P / Lv3=500 P\n"
            "⚠️ Sai 3 lần = bị khóa khỏi kho báu đó\n\n"
            "Nhấn nút bên dưới để bắt đầu 👇"
        ),
        "no_treasures_available": "Hiện không có kho báu nào.\nKho báu mới sẽ sớm xuất hiện! 🗺",
        "treasures_header": "🗺 *Danh sách Kho Báu* ({count})\n\n✅=Xong  ▶️=Đang chơi  🆕=Mới",
        "gp_balance_body": (
            "💰 *Số dư P của tôi*\n\nSố dư: *{balance:,} P*\n\n"
            "P dùng để mua gợi ý.\n"
            "• Gợi ý Lv1: 100 P\n• Gợi ý Lv2: 300 P\n• Gợi ý Lv3: 500 P"
        ),
        # language
        "lang_select": "🌐 *Chọn Ngôn ngữ*\n\nHãy chọn ngôn ngữ bạn muốn:",
        "lang_changed": "✅ Đã đặt ngôn ngữ thành *Tiếng Việt*.",
        # treasure info
        "treasure_not_found": "❌ Không tìm thấy kho báu.",
        "treasure_default_desc": "Hãy tìm vị trí chính xác của kho báu!",
        "treasure_info": (
            "🗺 *Kho Báu #{id}*\n\n"
            "📍 Vị trí: 🔒 Hiển thị sau 10 câu đúng\n"
            "🎁 Phần thưởng: *{prize:,} P*\n"
            "📝 {description}\n"
            "📋 Câu hỏi: {qtotal}{progress}"
        ),
        "progress_completed": "\n✅ *Đã hoàn thành.*",
        "progress_failed": "\n💀 *Đã thất bại.*",
        "progress_ongoing": "\n▶️ *Đang chơi* — {current}/{total} câu (sai: {wrong}/3)",
        # game
        "already_failed": "💀 Đã thất bại với kho báu này. Hãy thử kho báu khác!",
        "already_completed_body": (
            "✅ Đã hoàn thành!\n\n📍 {clue}\n\n"
            "🌍 https://maps.google.com/?q={lat},{lon}"
        ),
        "game_ended": "❌ Trò chơi này đã kết thúc.",
        "question_load_error": "❌ Không thể tải câu hỏi.",
        "treasure_load_error": "❌ Không thể tải kho báu.",
        "question_header": "🗺 *Kho Báu #{tid} — C{q}/{total}*\n\n❓ *{question}*\n\n",
        "purchased_hints_header": "\n💡 *Gợi ý đã mua:*\n",
        "wrong_count_display": "\nSai: {crosses} ({count}/3)",
        "correct_answer": (
            "✅ *Đúng rồi!* ({q}/{total})\n\n"
            "📍 Gợi ý tọa độ:\n```\n{clue}\n```\n\nCâu tiếp theo!"
        ),
        "victory": (
            "🎉 *Tìm thấy Kho Báu! Chúc mừng!*\n\n"
            "🏆 Trả lời đúng tất cả {total} câu!\n\n"
            "📍 *Tọa độ đầy đủ:*\n"
            "```\nVĩ độ: {lat:.6f}\nKinh độ: {lon:.6f}\n```\n\n"
            "🌍 https://maps.google.com/?q={lat},{lon}\n\n"
            "🎁 Phần thưởng: *{prize:,} P*\n{description}"
        ),
        "wrong_answer": "❌ *Sai rồi!*\n\nCơ hội còn lại: *{remaining}*\n\nHãy thử lại!",
        "game_over": (
            "💀 *Thất bại!*\n\n"
            "Sai 3 lần — kho báu bị khóa.\n\n"
            "Đáp án đúng: *{correct_label}) {correct_text}*\n\nThử kho báu khác! 💪"
        ),
        "hint_balance_info": "\n\n💰 P hiện tại: *{balance:,}*\n💡 Gợi ý Lv{level}: *{cost:,} P*",
        "hint_insufficient": "❌ Không đủ P.\nSố dư: {balance:,} P / Cần: {cost:,} P",
        "hint_bought": "✅ Đã mua gợi ý Lv{level}! -{cost:,} P",
        "hint_already_purchased": "💡 Gợi ý Lv{level}: {text}",
        "already_answered": "Bạn đã chuyển sang câu tiếp theo rồi.",
        "menu_text": (
            "🗺 *Tìm Kho Báu AI*\n\n"
            "Tìm tọa độ qua các câu hỏi AI!\n\n"
            "💡 Gợi ý: Lv1=100 P / Lv2=300 P / Lv3=500 P\n"
            "⚠️ Sai 3 lần = bị khóa"
        ),
        # keyboards
        "btn_treasure_list": "🗺 Xem Danh sách Kho Báu",
        "btn_jumpworld": "🏪 Tìm Kho Báu trên Jumpworld",
        "btn_community": "💬 Cộng đồng AIM",
        "btn_completed": "✅ Đã hoàn thành",
        "btn_continue": "▶️ Tiếp tục",
        "btn_start_challenge": "🎯 Bắt đầu!",
        "btn_back_list": "📋 Danh sách Kho Báu",
        "btn_other_treasures": "📋 Thử Kho Báu Khác",
        "btn_google_maps": "🌍 Xem trên Google Maps",
        "btn_jumpworld_visit": "🏪 Ghé thăm Jumpworld",
        "btn_next_question": "➡️ Câu tiếp theo",
        "btn_retry": "🔄 Thử lại",
        "btn_main_menu": "🔙 Menu chính",
        "btn_challenge": "🎯 Thử thách!",
        # admin
        "admin_only": "⛔ Lệnh chỉ dành cho quản trị viên.",
        "ask_coords": (
            "🗺 *Đăng ký Kho Báu Mới*\n\n"
            "Nhập tọa độ GPS.\nĐịnh dạng: `vĩ_độ kinh_độ`\nVí dụ: `37.5665 126.9780`\n\n/cancel — Hủy"
        ),
        "invalid_coords_format": "❌ Định dạng không hợp lệ.\nVí dụ: `37.5665 126.9780`\n\nVui lòng thử lại.",
        "invalid_coords_range": "❌ Phạm vi tọa độ không hợp lệ (vĩ độ ±90, kinh độ ±180).",
        "coords_confirmed": (
            "✅ Tọa độ: `{lat:.6f}, {lon:.6f}`\n\n"
            "Nhập số tiền thưởng bằng P.\nVí dụ: `5000`"
        ),
        "invalid_prize": "❌ Vui lòng nhập số dương. Ví dụ: `5000`",
        "prize_confirmed": (
            "✅ Phần thưởng: *{prize:,} P*\n\n"
            "Nhập mô tả kho báu.\n(Nhập `-` để dùng mặc định)"
        ),
        "generating": "⏳ AI đang tạo câu hỏi...\n(~20–40 giây)",
        "ai_failed": "❌ Tạo câu hỏi AI thất bại. Vui lòng thử lại.",
        "treasure_created_progress": (
            "✅ Đã tạo Kho Báu #{id}!\n📍 {location}\n🎁 {prize:,} P\n"
            "📋 {count} câu hỏi\n\nĐang thông báo nhóm..."
        ),
        "treasure_created_ok": (
            "✅ Kho Báu #{id} đã đăng ký!\n📍 {location}\n"
            "🎁 {prize:,} P\n📋 {count} câu hỏi"
        ),
        "create_error": "❌ Lỗi: {error}\nVui lòng thử /newtreasure lại.",
        "cancelled": "❌ Đã hủy đăng ký kho báu.",
        "admin_panel": (
            "🛠 *Bảng Quản trị*\n\n"
            "🗺 Kho báu: {total} (hoạt động: {active})\n"
            "👥 Người chơi: {players}\n"
            "🎮 Lượt thử: {attempts}\n"
            "✅ Hoàn thành: {completions}\n\n"
            "/newtreasure — Đăng ký mới\n/admin — Bảng này"
        ),
    },
}

SUPPORTED_LANGS = ("en", "ko", "vi")
DEFAULT_LANG = "ko"


def t(key: str, lang: str, **kwargs) -> str:
    lang = lang if lang in SUPPORTED_LANGS else DEFAULT_LANG
    text = STRINGS[lang].get(key) or STRINGS[DEFAULT_LANG].get(key, f"[{key}]")
    return text.format(**kwargs) if kwargs else text


def detect_lang(language_code: str | None) -> str:
    if not language_code:
        return DEFAULT_LANG
    lc = language_code.lower()
    if lc.startswith("ko"):
        return "ko"
    if lc.startswith("vi"):
        return "vi"
    return "en"
