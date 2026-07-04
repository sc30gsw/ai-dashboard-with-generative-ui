import { Button, type Theme, useTheme } from "@heroui/react";
import { cn } from "cnfast";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
// oxlint-disable-next-line react-doctor/no-flush-sync -- flushSync is required inside document.startViewTransition's callback below; no declarative <ViewTransition> export exists in the installed React 19.2.7. See usage-site comment for full justification.
import { flushSync } from "react-dom";

const THEME_OPTIONS = [
  { Icon: Sun, label: "Light theme", value: "light" },
  { Icon: Moon, label: "Dark theme", value: "dark" },
  { Icon: Monitor, label: "System theme", value: "system" },
] as const satisfies readonly { Icon: typeof Sun; label: string; value: Theme }[];

function subscribeNoop() {
  return () => {};
}

//? SSR は "system" を返すが実際のクライアント値は localStorage 依存のため、
//? ハイドレーション後の実値反映まで isHydrated=false として一致させる。
function useIsHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

//? クリック位置から画面の最遠角までの距離。ここまでの半径があれば円が画面全体を覆う。
function farthestCornerDistance(x: number, y: number) {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

async function switchThemeWithReveal(
  target: HTMLElement,
  value: Theme,
  setTheme: (next: Theme) => void,
) {
  const skipReveal =
    typeof document === "undefined" ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (skipReveal) {
    setTheme(value);
    return;
  }

  //? React 19.2.7（このプロジェクトの installed バージョン）は宣言的な
  //? <ViewTransition> をまだエクスポートしていない（node_modules/react 全体を
  //? grep して確認済み、0件）ため react-doctor の提案は現時点で採用不可。
  //? ここは HeroUI 自身の Toast 実装と同じ「document.startViewTransition +
  //? flushSync」パターン（node_modules/@heroui/react/dist/components/toast/toast-queue.js）。
  // oxlint-disable-next-line react-doctor/no-document-start-view-transition -- no declarative <ViewTransition> export exists in the installed React 19.2.7 (confirmed via full grep of node_modules/react, 0 hits); HeroUI's own Toast implementation uses this exact pattern (see comment above).
  await document.startViewTransition(() => {
    // oxlint-disable-next-line react-doctor/no-flush-sync -- must run inside document.startViewTransition's callback so the DOM mutation is captured synchronously for the transition snapshot; see justification above.
    flushSync(() => setTheme(value));
  }).ready;

  //? CSS の @keyframes/カスタムプロパティに頼らず、押されたボタンの中心座標を
  //? 使って Web Animations API で直接 ::view-transition-new(root) を動かす。
  //? CSS カスケード（レイヤー順や !important の衝突）に一切依存しないため、
  //? styles.css 側は ::view-transition-old/new(root) の既定アニメーションを
  //? 無効化するだけで済む（見た目のクリッピングはすべてここで完結する）。
  const { top, left, width, height } = target.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const radius = farthestCornerDistance(x, y);

  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: 500, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
  );
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme("system");
  const isHydrated = useIsHydrated();

  return (
    <fieldset aria-label="Theme" className="m-0 flex items-center gap-1 border-0 p-0">
      {THEME_OPTIONS.map(({ Icon, label, value }) => {
        const isActive = isHydrated && theme === value;

        return (
          <Button
            key={value}
            isIconOnly
            aria-label={label}
            aria-pressed={isActive}
            onPress={(event) => switchThemeWithReveal(event.target as HTMLElement, value, setTheme)}
            size="sm"
            variant={isActive ? "primary" : "secondary"}
          >
            <Icon className={cn("size-4")} />
          </Button>
        );
      })}
    </fieldset>
  );
}
