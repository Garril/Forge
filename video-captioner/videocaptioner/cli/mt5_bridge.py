"""Read-only MT5 market data bridge for Forge."""

import argparse
import json
import sys


def output(payload, exit_code=0):
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    return exit_code


def main():
    parser = argparse.ArgumentParser(description="Read-only MetaTrader 5 market data bridge")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    symbols = sub.add_parser("symbols")
    symbols.add_argument("--limit", type=int, default=200)
    bars = sub.add_parser("bars")
    bars.add_argument("symbol")
    bars.add_argument("timeframe", choices=["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"])
    bars.add_argument("--count", type=int, default=500)
    bars.add_argument("--start", type=int, default=0, help="从当前向历史方向跳过的 K 线数量")
    tick = sub.add_parser("tick")
    tick.add_argument("symbol")
    args = parser.parse_args()

    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return output({"success": False, "message": "未安装 MetaTrader5 Python 模块，请执行 pip install MetaTrader5", "detail": str(exc)}, 2)

    if not mt5.initialize():
        error = mt5.last_error()
        return output({"success": False, "message": "无法连接 MT5，请确认终端已启动并登录模拟账户", "detail": str(error)}, 3)

    try:
        account = mt5.account_info()
        account_data = None
        if account:
            account_data = {
                "login": account.login,
                "server": account.server,
                "company": account.company,
                "balance": account.balance,
                "equity": account.equity,
                "currency": account.currency,
                "tradeMode": int(account.trade_mode),
            }
        if args.command == "status":
            return output({"success": True, "connected": True, "account": account_data})
        if args.command == "symbols":
            items = []
            for item in (mt5.symbols_get() or [])[:args.limit]:
                items.append({"name": item.name, "description": item.description, "visible": bool(item.visible)})
            return output({"success": True, "account": account_data, "symbols": items})
        if not mt5.symbol_select(args.symbol, True):
            return output({"success": False, "message": f"MT5 中不存在或无法选择品种：{args.symbol}"}, 4)
        if args.command == "tick":
            value = mt5.symbol_info_tick(args.symbol)
            if value is None:
                return output({"success": False, "message": f"无法读取 {args.symbol} 的最新报价"}, 5)
            return output({"success": True, "symbol": args.symbol, "tick": {"time": int(value.time), "bid": value.bid, "ask": value.ask, "last": value.last, "volume": value.volume}})
        timeframe = getattr(mt5, f"TIMEFRAME_{args.timeframe}")
        values = mt5.copy_rates_from_pos(args.symbol, timeframe, max(0, args.start), max(10, min(args.count, 5000)))
        if values is None:
            return output({"success": False, "message": f"无法读取 {args.symbol} 的历史 K 线：{mt5.last_error()}"}, 6)
        result = [{"time": int(row["time"]), "open": float(row["open"]), "high": float(row["high"]), "low": float(row["low"]), "close": float(row["close"]), "volume": int(row["tick_volume"])} for row in values]
        result.sort(key=lambda item: item["time"])
        return output({"success": True, "symbol": args.symbol, "timeframe": args.timeframe, "account": account_data, "bars": result})
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    sys.exit(main())
