import { expect, test } from "vite-plus/test";

import { ListTasksSchema } from "~/features/tasks/api/task-model";
import {
  listInputFromTaskListFilterForm,
  taskListFilterFormFromSearch,
} from "~/features/tasks/utils/task-board-search";

//? R4 の IME ガードは「フォームが emit する search」と「ルートが返す search」の JSON.stringify 一致に依存する。
//? 両者は別経路で生成されるため、キー/値/順序のパリティが崩れるとキーストロークごとに form.reset が走り、
//? 日本語 IME 変換が壊れる（N11）。代表的な search で round-trip（search → フォーム値 → search）が
//? 安定一致することを回帰固定する。
const cases = [
  {},
  { status: "completed" },
  { priority: "high" },
  { search: "報告" },
  { priority: "low", search: "週次", status: "active" },
] as const satisfies readonly Record<string, string>[];

for (const raw of cases) {
  test(`IME guard parity: round-trip search is stable for ${JSON.stringify(raw)} (N11)`, () => {
    const validated = ListTasksSchema.parse(raw);
    const emitted = listInputFromTaskListFilterForm(taskListFilterFormFromSearch(validated));

    expect(JSON.stringify(emitted)).toBe(JSON.stringify(validated));
  });
}
