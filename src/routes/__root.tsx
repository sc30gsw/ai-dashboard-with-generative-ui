/// <reference types="vite-plus/client" />
import { Toast } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import "@openuidev/react-ui/index.css";
import { queryClient } from "~/lib/query-client";
import themeInitScriptUrl from "~/theme-init.js?url";

import appCss from "~/styles.css?url";

const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const { TanStackRouterDevtools } = await import("~/router-devtools");
      return { default: TanStackRouterDevtools };
    })
  : null;

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorComponent,
  head: () => ({
    links: [{ href: appCss, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "AI Dashboard" },
    ],
  }),
  notFoundComponent: NotFoundComponent,
  pendingComponent: PendingComponent,
});

function RootComponent() {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* FOUC 防止: 描画前に localStorage のテーマ意図から .dark/.light を <html> に適用。
            外部静的ファイル(~/theme-init.js)への参照のみで dangerouslySetInnerHTML sink を使わない。
            defer/async を付けないのは意図的: body 描画前に同期実行を終えないと FOUC 防止の意味が無くなる。 */}
        {/* oxlint-disable-next-line react-doctor/no-undeferred-third-party, react-doctor/rendering-script-defer-async -- first-party same-origin asset (~/theme-init.js), not third-party; must block synchronously before first paint to prevent FOUC, defer/async would run this after body render. */}
        <script src={themeInitScriptUrl} />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <Toast.Provider />
        </QueryClientProvider>
        {TanStackRouterDevtools ? (
          <Suspense fallback={null}>
            <TanStackRouterDevtools position="bottom-right" />
          </Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundComponent() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">404</h1>
      <p>ページが見つかりませんでした。</p>
    </div>
  );
}

function ErrorComponent({ error }: ErrorComponentProps) {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold text-red-600">エラー</h1>
      <p>{error.message}</p>
    </div>
  );
}

function PendingComponent() {
  return (
    <div className="p-4">
      <p>読み込み中...</p>
    </div>
  );
}
