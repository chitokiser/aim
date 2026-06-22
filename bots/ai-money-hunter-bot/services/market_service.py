"""Financial data: stocks, crypto, forex, gold, oil via yfinance + CoinGecko."""

import asyncio
from functools import lru_cache
import yfinance as yf
from pycoingecko import CoinGeckoAPI

cg = CoinGeckoAPI()

INDICES = {
    "NASDAQ": "^IXIC",
    "S&P 500": "^GSPC",
    "KOSDAQ": "^KQ11",
    "KOSPI": "^KS11",
    "Nikkei": "^N225",
}

FOREX = {
    "USD/KRW": "KRW=X",
    "USD/JPY": "JPY=X",
    "USD/EUR": "EUR=X",
    "USD/CNY": "CNY=X",
}

COMMODITIES = {
    "Gold": "GC=F",
    "WTI Oil": "CL=F",
    "Brent Oil": "BZ=F",
    "Silver": "SI=F",
}

TOP_CRYPTOS = ["bitcoin", "ethereum", "binancecoin", "solana", "ripple", "dogecoin"]


def _fetch_ticker_sync(symbol: str) -> dict | None:
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5d", interval="1d")
        if hist.empty or len(hist) < 1:
            return None
        latest = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) >= 2 else hist.iloc[-1]
        price = float(latest["Close"])
        prev_price = float(prev["Close"])
        change_pct = ((price - prev_price) / prev_price * 100) if prev_price else 0.0
        return {"price": price, "change_pct": change_pct}
    except Exception:
        return None


async def _fetch_ticker(symbol: str) -> dict | None:
    return await asyncio.to_thread(_fetch_ticker_sync, symbol)


def _arrow(change_pct: float) -> str:
    if change_pct > 0:
        return "🟢"
    elif change_pct < 0:
        return "🔴"
    return "⚪"


async def get_market_brief() -> str:
    lines = ["📈 *글로벌 시장 브리핑*\n"]

    # Indices
    lines.append("*📊 주요 지수*")
    for name, sym in INDICES.items():
        data = await _fetch_ticker(sym)
        if data:
            sign = "+" if data["change_pct"] >= 0 else ""
            lines.append(f"{_arrow(data['change_pct'])} {name}: {sign}{data['change_pct']:.2f}%")
        else:
            lines.append(f"⚪ {name}: N/A")

    # Forex
    lines.append("\n*💱 환율*")
    for name, sym in FOREX.items():
        data = await _fetch_ticker(sym)
        if data:
            lines.append(f"• {name}: {data['price']:.2f}")
        else:
            lines.append(f"• {name}: N/A")

    # Commodities
    lines.append("\n*🛢 원자재*")
    for name, sym in COMMODITIES.items():
        data = await _fetch_ticker(sym)
        if data:
            sign = "+" if data["change_pct"] >= 0 else ""
            lines.append(f"{_arrow(data['change_pct'])} {name}: ${data['price']:,.2f} ({sign}{data['change_pct']:.2f}%)")
        else:
            lines.append(f"⚪ {name}: N/A")

    return "\n".join(lines)


async def get_crypto_brief() -> str:
    def _fetch():
        return cg.get_price(
            ids=",".join(TOP_CRYPTOS),
            vs_currencies="usd",
            include_24hr_change=True,
        )

    try:
        data = await asyncio.to_thread(_fetch)
    except Exception:
        return "❌ 암호화폐 데이터를 불러올 수 없습니다."

    lines = ["🪙 *암호화폐 시세*\n"]
    names = {
        "bitcoin": "Bitcoin (BTC)",
        "ethereum": "Ethereum (ETH)",
        "binancecoin": "BNB",
        "solana": "Solana (SOL)",
        "ripple": "Ripple (XRP)",
        "dogecoin": "Dogecoin (DOGE)",
    }
    for coin_id in TOP_CRYPTOS:
        if coin_id not in data:
            continue
        price = data[coin_id].get("usd", 0)
        change = data[coin_id].get("usd_24h_change", 0) or 0
        sign = "+" if change >= 0 else ""
        lines.append(f"{_arrow(change)} {names[coin_id]}: ${price:,.2f} ({sign}{change:.2f}%)")

    return "\n".join(lines)


async def get_gold_price() -> str:
    data = await _fetch_ticker("GC=F")
    if not data:
        return "❌ 금값 데이터를 불러올 수 없습니다."
    sign = "+" if data["change_pct"] >= 0 else ""
    arrow = _arrow(data["change_pct"])
    return (
        f"🥇 *금값 현황*\n\n"
        f"{arrow} 금 (Gold): *${data['price']:,.2f}/oz*\n"
        f"전일 대비: {sign}{data['change_pct']:.2f}%"
    )


async def get_stock_info(query: str) -> str:
    """Look up a stock by ticker or name."""
    symbol = query.upper().strip()
    # Common Korean stock aliases
    aliases = {
        "삼성전자": "005930.KS",
        "삼성": "005930.KS",
        "카카오": "035720.KS",
        "네이버": "035420.KS",
        "현대차": "005380.KS",
        "LG전자": "066570.KS",
        "SK하이닉스": "000660.KS",
        "애플": "AAPL",
        "테슬라": "TSLA",
        "엔비디아": "NVDA",
        "마이크로소프트": "MSFT",
        "구글": "GOOGL",
        "아마존": "AMZN",
        "메타": "META",
    }
    if query in aliases:
        symbol = aliases[query]

    def _fetch():
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="2d", interval="1d")
        return info, hist

    try:
        info, hist = await asyncio.to_thread(_fetch)
    except Exception:
        return f"❌ `{query}` 종목을 찾을 수 없습니다."

    if hist.empty:
        return f"❌ `{query}` 종목 데이터가 없습니다."

    latest = hist.iloc[-1]
    prev = hist.iloc[-2] if len(hist) >= 2 else hist.iloc[-1]
    price = float(latest["Close"])
    prev_price = float(prev["Close"])
    change_pct = ((price - prev_price) / prev_price * 100) if prev_price else 0.0
    sign = "+" if change_pct >= 0 else ""
    name = info.get("longName") or info.get("shortName") or symbol
    currency = info.get("currency", "USD")
    market_cap = info.get("marketCap", 0)
    cap_str = f"${market_cap/1e9:.1f}B" if market_cap else "N/A"

    return (
        f"📊 *{name}* ({symbol})\n\n"
        f"{_arrow(change_pct)} 현재가: *{price:,.2f} {currency}*\n"
        f"전일 대비: {sign}{change_pct:.2f}%\n"
        f"시가총액: {cap_str}"
    )
