import { toast } from "@heroui/react";
import { Result, TaggedError } from "better-result";

import { refetchTasksCollection } from "~/features/tasks/collections/tasks-collection";
import { edenClient } from "~/lib/eden";

export class ReorderApplyError extends TaggedError("ReorderApplyError")<{
  cause?: unknown;
  message: string;
}>() {}

//? WeatherSuggestionPanel の「適用」確定ハンドラ。チャットを経由せず reorder エンドポイントを
//? 直接叩き、成功時はタスク一覧の TanStack DB collection を再取得して画面に反映する。
//? 失敗経路（transport エラー・サーバー拒否・再取得失敗）は必ず toast で通知する。
export async function applyReorderSuggestion(orderedIds: string[]) {
  const { data, error } = await edenClient().tasks.reorder.patch({ orderedIds });

  if (error) {
    toast.danger("順序の適用に失敗しました。");

    return;
  }

  if (!data.ok) {
    toast.danger(data.message);

    return;
  }

  const refetchResult = await Result.tryPromise({
    catch: (cause) =>
      new ReorderApplyError({ cause, message: "タスク一覧の再取得に失敗しました。" }),
    try: () => refetchTasksCollection(),
  });

  if (Result.isError(refetchResult)) {
    toast.danger(refetchResult.error.message);

    return;
  }

  toast.success("タスクの順序を更新しました。");
}
