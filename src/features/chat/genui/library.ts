import { createLibrary } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";

import { taskList } from "~/features/chat/genui/components/task-list";

export const genuiLibrary = createLibrary({
  componentGroups: [
    ...(openuiChatLibrary.componentGroups ?? []),
    {
      components: ["TaskList"],
      name: "Task domain",
      notes: [
        "Use TaskList to show/list/filter tasks — built-in search box + priority/done chips.",
      ],
    },
  ],
  components: [...Object.values(openuiChatLibrary.components), taskList],
  root: openuiChatLibrary.root,
});
