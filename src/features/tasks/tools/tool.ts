import type { ToolDefinition, ToolProviderMap } from "~/types/tool";

export type TaskToolProviderMap = ToolProviderMap;

export type TaskTool = ToolDefinition<TaskToolProviderMap[string]>;
