import "@mcp-b/global";
import { useElicitation } from "@mcp-b/react-webmcp";

import { useTaskTools } from "~/features/tasks/hooks/use-task-tools";

export function WebMcpTools() {
  const { elicitInput } = useElicitation();

  useTaskTools(elicitInput);

  return null;
}
