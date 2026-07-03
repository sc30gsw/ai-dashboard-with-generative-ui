import { expect, test } from "vite-plus/test";

import { createRateLimiter } from "~/lib/rate-limit";

//? 注入したクロックで時間を決定的に進める（Date.now の揺れに依存しない）。
function fakeClock(start = 0) {
  const state = { current: start };

  return {
    advance: (ms: number) => {
      state.current += ms;
    },
    now: () => state.current,
  };
}

test("allows up to max requests within the window", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ max: 3, now: clock.now, windowMs: 1000 });

  expect(limiter.check("ip").allowed).toBe(true);
  expect(limiter.check("ip").allowed).toBe(true);
  expect(limiter.check("ip").allowed).toBe(true);
});

test("blocks the request that exceeds max within the window", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ max: 2, now: clock.now, windowMs: 1000 });

  expect(limiter.check("ip").allowed).toBe(true);
  expect(limiter.check("ip").allowed).toBe(true);

  const blocked = limiter.check("ip");
  expect(blocked.allowed).toBe(false);
  //? 拒否時は Retry-After に使う正の秒数を返す。
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
});

test("resets after the window elapses", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ max: 1, now: clock.now, windowMs: 1000 });

  expect(limiter.check("ip").allowed).toBe(true);
  expect(limiter.check("ip").allowed).toBe(false);

  //? ウィンドウ満了後は新しいウィンドウとして再び許可される。
  clock.advance(1000);
  expect(limiter.check("ip").allowed).toBe(true);
});

test("tracks each key (IP) independently", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ max: 1, now: clock.now, windowMs: 1000 });

  expect(limiter.check("a").allowed).toBe(true);
  //? 別 IP は別バケットなので a の消費に影響されない。
  expect(limiter.check("b").allowed).toBe(true);
  expect(limiter.check("a").allowed).toBe(false);
});

test("rejects once the global aggregate cap is exceeded even when rotating the per-key (x-forwarded-for) value", () => {
  const clock = fakeClock();
  //? per-key は 1 分 100 リクエストまで許可（十分に大きい）が、グローバルは 1 分 5 リクエストまで。
  //? 攻撃者が毎回別の偽 IP を送っても、per-key チェックは常に「初回」扱いで通過してしまうため、
  //? グローバル集約ウィンドウがないと総スループットに上限がかからない。
  const limiter = createRateLimiter({
    global: { max: 5, windowMs: 60_000 },
    max: 100,
    now: clock.now,
    windowMs: 60_000,
  });

  const results = Array.from({ length: 10 }, (_, i) => limiter.check(`spoofed-ip-${i}`));

  //? 最初の 5 件は各自のバケットとしても許可されるが、6 件目以降はグローバル上限で拒否される。
  expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true);
  expect(results.slice(5).some((r) => !r.allowed)).toBe(true);

  const blocked = results.find((r) => !r.allowed);
  expect(blocked?.retryAfterSeconds).toBeGreaterThan(0);
});

test("per-key-rejected requests do not consume global slots (single-IP flood must not starve other users)", () => {
  const clock = fakeClock();
  //? per-key は 2 まで、グローバルは 5 まで。攻撃者 1 キーが 10 回連打すると、
  //? 許可されるのは 2 回だけで、残り 8 回は per-key 拒否。修正前はこの拒否リクエストも
  //? グローバル枠を消費していたため（2 + 8 > 5）、後続の別キーがグローバル拒否されていた。
  const limiter = createRateLimiter({
    global: { max: 5, windowMs: 60_000 },
    max: 2,
    now: clock.now,
    windowMs: 60_000,
  });

  const attackerResults = Array.from({ length: 10 }, () => limiter.check("attacker"));

  expect(attackerResults.filter((r) => r.allowed)).toHaveLength(2);

  //? グローバル残枠は 5 - 2 = 3。正規ユーザー 3 キーは全員許可されなければならない。
  expect(limiter.check("victim-1").allowed).toBe(true);
  expect(limiter.check("victim-2").allowed).toBe(true);
  expect(limiter.check("victim-3").allowed).toBe(true);

  //? 4 人目でグローバル上限 (5) に達し拒否される — グローバル枠自体は機能し続けている。
  expect(limiter.check("victim-4").allowed).toBe(false);
});

test("caps the number of distinct keys tracked in the Map (bucket eviction)", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({
    //? グローバル上限を高くして、この検証ではグローバル拒否の影響を受けないようにする。
    global: { max: 1_000_000, windowMs: 60_000 },
    max: 100,
    maxKeys: 10,
    now: clock.now,
    windowMs: 60_000,
  });

  for (let i = 0; i < 50; i++) {
    limiter.check(`ip-${i}`);
  }

  //? distinct key を 50 個投入しても、bucketCount は設定した上限 (10) を超えない。
  expect(limiter.bucketCount).toBeLessThanOrEqual(10);
});
