import { Button } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { cn } from "cnfast";
import type { ReactNode } from "react";

import type { FileRoutesByTo } from "~/routeTree.gen";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/" },
  { label: "Tasks", to: "/tasks" },
  { label: "Chat", to: "/chat" },
] as const satisfies readonly { label: string; to: keyof FileRoutesByTo }[];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border bg-surface border-b px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-muted text-xs font-medium tracking-wide uppercase">AI Dashboard</p>
            <h1 className="text-foreground text-lg font-semibold">Task Board</h1>
          </div>
          <Button size="sm" variant="secondary">
            Phase B
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className={cn(
                  "text-muted hover:bg-accent/10 hover:text-accent rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                )}
                activeProps={{
                  className:
                    "bg-accent/12 font-semibold text-accent hover:bg-accent/15 hover:text-accent",
                }}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="border-border bg-surface text-muted border-t px-4 py-3 text-center text-xs">
        Generative UI + Web MCP experiment
      </footer>
    </div>
  );
}
