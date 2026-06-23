//* チャットエンドポイント（Vercel AI Gateway を呼ぶ有料経路）の濫用 / wallet-DoS を防ぐための
//* 軽量なインメモリ固定ウィンドウ・レートリミッタ。本アプリは単一インスタンスの常駐 Node
//* サーバーなので、外部ストア（Redis 等）なしのインメモリ状態で十分機能する。
//! caveat: インメモリ状態はプロセス内にのみ存在する。サーバーレス（リクエストごとに別インスタンス）
//! では各呼び出し間で状態が共有されず機能しない。常駐 Node サーバー前提の実装。

type RateLimitConfig = Record<"max" | "windowMs", number>;
type RateLimitResult = {
  allowed: boolean;
  //* 拒否時のみ意味を持つ。Retry-After ヘッダに使う秒数（切り上げ）。
  retryAfterSeconds: number;
};

type CreateRateLimiterOptions = RateLimitConfig &
  Partial<{
    //? 現在時刻の供給源。テストで決定的に時間を進めるため注入可能にする（Date.now の揺れを避ける）。
    now: () => number;
  }>;

type WindowState = Record<"count" | "resetAt", number>;

export function createRateLimiter({
  max,
  windowMs,
  now = () => Date.now(),
}: CreateRateLimiterOptions) {
  const buckets = new Map<string, WindowState>();

  function check(key: string): RateLimitResult {
    const current = now();
    const state = buckets.get(key);

    //* ウィンドウ未開始、または期限切れなら新しいウィンドウを開始する（固定ウィンドウ）。
    if (!state || current >= state.resetAt) {
      buckets.set(key, { count: 1, resetAt: current + windowMs });

      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (state.count >= max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - current) / 1000)),
      };
    }

    buckets.set(key, { count: state.count + 1, resetAt: state.resetAt });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { check };
}
