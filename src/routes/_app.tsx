import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "~/components/layout/app-shell";
import { WebMcpTools } from "~/features/tasks/components/web-mcp-tools";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <WebMcpTools />
      <Outlet />
    </AppShell>
  );
}
