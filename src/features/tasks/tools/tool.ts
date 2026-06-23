import type { useWebMCP } from "@mcp-b/react-webmcp";
import type { RendererProps } from "@openuidev/react-lang";
import type { ZodType } from "zod";

export type TaskToolProviderMap = Extract<
  NonNullable<RendererProps["toolProvider"]>,
  Record<string, unknown>
>;

export type TaskTool = Pick<Parameters<typeof useWebMCP>[0], "description" | "name"> & {
  destructive: boolean;
  exposeToWebMcp: boolean;
  inputSchema: ZodType;
  outputSchema: ZodType;
  run: TaskToolProviderMap[string];
};
