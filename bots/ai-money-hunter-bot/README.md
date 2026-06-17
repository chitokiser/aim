# 💰 AI Money Hunter Bot

AI가 최신 트렌드와 금융 데이터를 분석하여 **돈벌이 아이디어**와 **시장 정보**를 자동 제공하는 텔레그램 봇.

## 기능

| 기능 | 설명 |
|------|------|
| 🔥 AI Side Hustle Scanner | 매일 새로운 부업 아이디어 (OpenAI + Tavily) |
| 📈 글로벌 시장 브리핑 | NASDAQ, KOSDAQ, 환율, 금, 유가 |
| 🪙 암호화폐 시세 | BTC, ETH, BNB, SOL 등 실시간 |
| ⚡ 급등/급락 알림 | 30분마다 자동 체크 |
| 📢 그룹 자동 브리핑 | 매일 오전 9시 + 오후 6시 |

## 명령어

```
/start          봇 시작
/today          오늘의 돈벌이 아이디어
/market         글로벌 시장 현황
/crypto         암호화폐 시세
/gold           금값 조회
/stock 삼성전자  특정 종목 조회
/trend          AI 트렌드 분석
/subscribe      자동 알림 구독
/unsubscribe    알림 해제
```

## 설치

```bash
git clone <repo>
cd ai-money-hunter-bot
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# .env 파일에 API 키 입력
python bot.py
```

## 환경 변수

`.env.example` 참조. 필수 항목:

| 키 | 출처 |
|----|------|
| `BOT_TOKEN` | @BotFather |
| `OPENAI_API_KEY` | platform.openai.com |
| `TAVILY_API_KEY` | tavily.com |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `ADMIN_IDS` | 관리자 텔레그램 ID (쉼표 구분) |

## Railway 배포

```bash
railway login
railway init
railway add --database postgresql
railway variables set BOT_TOKEN=...
railway variables set OPENAI_API_KEY=...
railway variables set TAVILY_API_KEY=...
railway variables set ADMIN_IDS=...
railway up
```

## 프로젝트 구조

```
bot.py                      # 엔트리포인트
config.py                   # 환경변수 로드
database.py                 # PostgreSQL ORM (SQLAlchemy)
handlers/
  commands.py               # /today /market /crypto /gold /stock /trend
  subscribe.py              # /subscribe /unsubscribe
  admin.py                  # /admin /stats /broadcast
services/
  ai_service.py             # OpenAI + Tavily 트렌드 분석
  market_service.py         # yfinance + CoinGecko
  scheduler_service.py      # APScheduler 자동 브리핑
utils/
  keyboards.py              # 파트너 버튼 인라인 키보드
```
