import { toast } from "@heroui/react";

import { refetchTasksCollection } from "~/features/tasks/collections/tasks-collection";
import { edenClient } from "~/lib/eden";

//? WeatherSuggestionPanel の「適用」確定ハンドラ。チャットを経由せず reorder エンドポイントを
//? 直接叩き、成功時はタスク一覧の TanStack DB collection を再取得して画面に反映する。
export async function applyReorderSuggestion(orderedIds: string[]) {
  const { data, error } = await edenClient().tasks.reorder.post({ orderedIds });

  if (error) {
    toast.danger("順序の適用に失敗しました。");

    return;
  }

  if (!data.ok) {
    toast.danger(data.message);

    return;
  }

  await refetchTasksCollection();
  toast.success("タスクの順序を更新しました。");
}
