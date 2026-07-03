import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";

import { executeWeatherWebMcpTool } from "~/features/weather/tools/adapters/web-mcp";
import { getWeatherTool } from "~/features/weather/tools/get-weather";

export function useWeatherTools() {
  const inputSchema = z.toJSONSchema(getWeatherTool.inputSchema) as Parameters<
    typeof useWebMCP
  >[0]["inputSchema"];

  useWebMCP({
    description: getWeatherTool.description,
    handler: (args) => executeWeatherWebMcpTool(args),
    inputSchema,
    name: getWeatherTool.name,
  });
}
