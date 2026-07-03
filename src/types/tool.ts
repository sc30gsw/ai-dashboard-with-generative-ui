import type { useWebMCP } from "@mcp-b/react-webmcp";
import type { RendererProps } from "@openuidev/react-lang";
import type { ZodType } from "zod";

//? OpenUI <Renderer toolProvider={...}> に渡す read-only 関数マップの形。tasks/weather
//? どちらの feature も同じ形を使うため、ここに一元化する（features 間の直接依存を避ける）。
export type ToolProviderMap = Extract<
  NonNullable<RendererProps["toolProvider"]>,
  Record<string, unknown>
>;

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
