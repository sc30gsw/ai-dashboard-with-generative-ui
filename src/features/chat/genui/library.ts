import { createLibrary } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";

import { TaskBoard } from "~/features/chat/genui/task-board";

export const genuiLibrary = createLibrary({
  componentGroups: [
    ...(openuiChatLibrary.componentGroups ?? []),
    {
      components: ["TaskBoard"],
      name: "Task Board",
      notes: [
        "Use TaskBoard for task lists. It already includes add, edit, complete, delete, search, filter, and sort controls.",
      ],
    },
  ],
  components: [...Object.values(openuiChatLibrary.components), TaskBoard],
  root: openuiChatLibrary.root,
});
