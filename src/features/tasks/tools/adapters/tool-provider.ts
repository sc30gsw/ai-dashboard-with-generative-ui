import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import type { TaskToolProviderMap } from "~/features/tasks/tools/tool";

//* OpenUI toolProvider アダプタ: read 専用ツール（list_tasks）のみを公開。
//* Query() の自動解決に使う（書き込みは AI SDK の needsApproval 経路、Mutation() ジェスチャは使わない）。
export function createReadToolMap() {
  return {
    [listTasksTool.name]: (args) => listTasksTool.run(args),
  } satisfies TaskToolProviderMap;
}
