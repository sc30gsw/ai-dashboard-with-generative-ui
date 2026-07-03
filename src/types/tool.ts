import type { useWebMCP } from "@mcp-b/react-webmcp";
import type { ZodType } from "zod";

//? tasks/weather の各ツール定義（TaskTool / WeatherTool）に共通する形。ドメイン固有の
//? inputSchema/outputSchema/run の型だけジェネリクスで差し替える。
export type ToolDefinition<
  TRun,
  TInputSchema extends ZodType = ZodType,
  TOutputSchema extends ZodType = ZodType,
> = Pick<Parameters<typeof useWebMCP>[0], "description" | "name"> & {
  additive: boolean;
  destructive: boolean;
  exposeToWebMcp: boolean;
  inputSchema: TInputSchema;
  mutates: boolean;
  outputSchema: TOutputSchema;
  run: TRun;
};
