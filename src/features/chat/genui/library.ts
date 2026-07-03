import { createLibrary } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";

import { taskList } from "~/features/chat/genui/components/task-list";
import { taskSuggestion } from "~/features/chat/genui/components/task-suggestion";
import { weatherWidget } from "~/features/weather/components/weather-widget";

export const genuiLibrary = createLibrary({
  componentGroups: [
    ...(openuiChatLibrary.componentGroups ?? []),
    {
      components: ["TaskList", "WeatherWidget", "TaskSuggestion"],
      name: "Task domain",
      notes: [
        "Use TaskList to show/list/filter tasks — built-in search box + priority/done chips.",
        "Use WeatherWidget to show a weather forecast for a location, with a date picker and 7-day strip.",
        "Use TaskSuggestion to show a weather-aware suggested task order with a reason per item — emit at ROOT, not wrapped in Card.",
      ],
    },
  ],
  components: [
    ...Object.values(openuiChatLibrary.components),
    taskList,
    weatherWidget,
    taskSuggestion,
  ],
  root: openuiChatLibrary.root,
});
