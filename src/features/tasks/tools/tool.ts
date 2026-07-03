import type { RendererProps } from "@openuidev/react-lang";

import type { ToolDefinition } from "~/types/tool";

export type TaskToolProviderMap = Extract<
  NonNullable<RendererProps["toolProvider"]>,
  Record<string, unknown>
>;

export type TaskTool = ToolDefinition<TaskToolProviderMap[string]>;
