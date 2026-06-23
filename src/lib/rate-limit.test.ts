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
