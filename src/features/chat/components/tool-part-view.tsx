import { cn } from "cnfast";

import type { ToolUIPart } from "~/features/chat/utils/message-parts";
import {
  DESTRUCTIVE_TOOLS,
  summarizeToolInput,
  TOOL_LABELS,
  toolNameOf,
} from "~/features/tasks/utils/tool-approval-summary";

export type ToolPartViewProps = {
  onApprove: (
    id: NonNullable<ToolUIPart["approval"]>["id"],
    approved: NonNullable<NonNullable<ToolUIPart["approval"]>["approved"]>,
  ) => void;
  part: ToolUIPart;
};

export function ToolPartView({ part, onApprove }: ToolPartViewProps) {
  const name = toolNameOf(part.type);
  const label = TOOL_LABELS[name as keyof typeof TOOL_LABELS] ?? name;
  const destructive = DESTRUCTIVE_TOOLS.has(name);

  if (part.state === "approval-requested" && part.approval) {
    const approvalId = part.approval.id;

    return (
      <fieldset
        aria-label="操作の確認"
        className={cn(
          "min-w-0 rounded-lg border p-4 shadow-sm",
          destructive ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50",
        )}
      >
        <p className="text-sm font-semibold text-zinc-800">{label}</p>
        <p className="mt-1 text-sm text-zinc-600">{summarizeToolInput(name, part.input)}</p>
        <div className="mt-3 flex gap-2">
          <button
            className={cn(
              "min-h-9 rounded-md px-4 text-sm font-medium text-white",
              destructive ? "bg-red-600" : "bg-zinc-900",
            )}
            onClick={() => onApprove(approvalId, true)}
            type="button"
          >
            {destructive ? "削除する" : "承認"}
          </button>
          <button
            className="min-h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700"
            onClick={() => onApprove(approvalId, false)}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </fieldset>
    );
  }

  if (part.state === "output-available") {
    const ok = part.output?.status !== "error";

    return (
      <div
        className={cn(
          "rounded-lg border px-4 py-3 text-sm",
          ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800",
        )}
        role={ok ? "status" : "alert"}
      >
        {part.output?.message ?? (ok ? "完了しました。" : "処理に失敗しました。")}
      </div>
    );
  }

  if (part.state === "output-error") {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        エラー: {part.errorText ?? "不明なエラー"}
      </div>
    );
  }

  if (
    part.state === "output-denied" ||
    (part.state === "approval-responded" && part.approval && !part.approval.approved)
  ) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
        {label}をキャンセルしました。
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
      {label}を準備中...
    </div>
  );
}
