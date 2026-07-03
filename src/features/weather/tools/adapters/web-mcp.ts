import { getWeatherTool } from "~/features/weather/tools/get-weather";

//* Web MCP アダプタ: get_weather は read-only のため elicitation ゲート不要。
export async function executeWeatherWebMcpTool(args: Record<string, unknown>) {
  return getWeatherTool.run(args);
}
