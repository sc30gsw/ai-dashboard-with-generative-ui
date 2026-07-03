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
    //? x-forwarded-for のようなスプーフ可能なキーで per-key 制限が回避されても総スループットに
    //? 上限をかける、単一の共有ウィンドウ。省略時はグローバル判定を行わない。
    global: RateLimitConfig;
    //? buckets Map が保持する distinct key の上限。回転する偽キーによる無制限なメモリ増加を防ぐ。
    maxKeys: number;
  }>;

type WindowState = Record<"count" | "resetAt", number>;

//? buckets Map の既定の distinct key 上限。
const DEFAULT_MAX_KEYS = 1000;

function checkWindow(
  state: WindowState | undefined,
  limit: RateLimitConfig,
  current: number,
): { next: WindowState; result: RateLimitResult } {
  //* ウィンドウ未開始、または期限切れなら新しいウィンドウを開始する（固定ウィンドウ）。
  if (!state || current >= state.resetAt) {
    return {
      next: { count: 1, resetAt: current + limit.windowMs },
      result: { allowed: true, retryAfterSeconds: 0 },
    };
  }

  if (state.count >= limit.max) {
    return {
      next: state,
      result: {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - current) / 1000)),
      },
    };
  }

  return {
    next: { count: state.count + 1, resetAt: state.resetAt },
    result: { allowed: true, retryAfterSeconds: 0 },
  };
}

export function createRateLimiter({
  max,
  windowMs,
  now = () => Date.now(),
  global,
  maxKeys = DEFAULT_MAX_KEYS,
}: CreateRateLimiterOptions) {
  const buckets = new Map<string, WindowState>();
  let globalState: WindowState | undefined;

  //* Map の挿入順（FIFO）で最古のキーから追い出す。真の LRU には最終アクセス時刻の追跡が
  //* 追加で必要になるが、固定ウィンドウ・レートリミッタの用途では十分な近似であり、
  //* 実装をシンプルに保てるためこちらを選択した。
  function evictOldestIfOverCapacity(key: string) {
    if (buckets.has(key)) {
      //? 既存キーの更新は distinct key 数を増やさないため追い出し不要。
      return;
    }

    while (buckets.size >= maxKeys) {
      const oldestKey = buckets.keys().next().value;

      if (oldestKey === undefined) {
        break;
      }

      buckets.delete(oldestKey);
    }
  }

  function check(key: string): RateLimitResult {
    const current = now();

    //* グローバル集約と per-key の両ウィンドウを先に判定し、両方許可のときだけ同時にコミットする。
    //* グローバル側だけ先にコミットすると、per-key で拒否されるリクエストが共有ウィンドウを
    //* 消費し続け、単一 IP の連打だけでグローバル枠が枯渇して正規ユーザーまで 429 になる。
    //* x-forwarded-for のようなスプーフ可能なキーの回転に対する総量上限（グローバル）と、
    //* 単一キーの連打に対する per-key 上限が、互いの枠を奪わずに独立して機能する。
    const globalCheck = global ? checkWindow(globalState, global, current) : undefined;

    if (globalCheck && !globalCheck.result.allowed) {
      return globalCheck.result;
    }

    const keyCheck = checkWindow(buckets.get(key), { max, windowMs }, current);

    if (!keyCheck.result.allowed) {
      return keyCheck.result;
    }

    if (globalCheck) {
      globalState = globalCheck.next;
    }

    evictOldestIfOverCapacity(key);
    buckets.set(key, keyCheck.next);

    return keyCheck.result;
  }

  return {
    check,
    //? テストから distinct key 数の上限遵守を検証できるようにする。
    get bucketCount() {
      return buckets.size;
    },
  };
}
