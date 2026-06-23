import { Button, Card, Chip } from "@heroui/react";
import { cn } from "cnfast";

import type { ToolUIPart } from "~/features/chat/utils/message-parts";
import {
  DELETE_TOOLS,
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
  const isDelete = DELETE_TOOLS.has(name);

  if (part.state === "approval-requested" && part.approval) {
    const approvalId = part.approval.id;

    return (
      <Card aria-label="操作の確認">
        <Card.Content className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-800">{label}</p>
          <p className="text-sm text-zinc-600">{summarizeToolInput(name, part.input)}</p>
          <div className="flex gap-2">
            <Button
              className={cn(destructive && "bg-red-600 text-white hover:bg-red-700")}
              onPress={() => onApprove(approvalId, true)}
              variant="primary"
            >
              {isDelete ? "削除する" : "承認"}
            </Button>
            <Button onPress={() => onApprove(approvalId, false)} variant="secondary">
              キャンセル
            </Button>
          </div>
        </Card.Content>
      </Card>
    );
  }

  if (part.state === "output-available") {
    //? success を明示判定する。未知/欠落 status を成功扱いしないため `!== "error"` は使わない（R7）。
    const ok = part.output?.status === "success";

    return (
      <Card>
        <Card.Content className="flex items-center gap-2">
          <Chip color={ok ? "success" : "danger"} size="sm" variant="secondary">
            <Chip.Label>{ok ? "完了" : "エラー"}</Chip.Label>
          </Chip>
          <span className="text-sm text-zinc-700">
            {part.output?.message ?? (ok ? "完了しました。" : "処理に失敗しました。")}
          </span>
        </Card.Content>
      </Card>
    );
  }

  if (part.state === "output-error") {
    return (
      <Card>
        <Card.Content className="flex items-center gap-2">
          <Chip color="danger" size="sm" variant="secondary">
            <Chip.Label>エラー</Chip.Label>
          </Chip>
          <span className="text-sm text-zinc-700">{part.errorText ?? "不明なエラー"}</span>
        </Card.Content>
      </Card>
    );
  }

  if (
    part.state === "output-denied" ||
    (part.state === "approval-responded" && part.approval && !part.approval.approved)
  ) {
    return (
      <Card>
        <Card.Content className="text-sm text-zinc-500">{label}をキャンセルしました。</Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Content className="text-sm text-zinc-500">{label}を準備中...</Card.Content>
    </Card>
  );
}
