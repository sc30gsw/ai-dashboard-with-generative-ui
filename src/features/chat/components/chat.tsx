import { useChat } from "@ai-sdk/react";
import { BuiltinActionType } from "@openuidev/lang-core";
import { Renderer } from "@openuidev/react-lang";
import { useForm } from "@tanstack/react-form";
import {
  DefaultChatTransport,
  type InferUITools,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ToolUIPart as SdkToolUIPart,
  type UIMessage,
} from "ai";
import { cn } from "cnfast";

import { genuiLibrary } from "~/features/chat/genui/library";
import { extractOpenUILang, isOpenUILangResponse } from "~/features/chat/lib/clarify-response";
import { CreateMessageSchema } from "~/features/chat/schemas/message-schema";
import { refetchTasksCollection } from "~/features/tasks/collections/tasks-collection";
import { createReadToolMap } from "~/features/tasks/tools";
import type { chatTools } from "~/features/tasks/tools/chat-ai-tools";

const TOOL_LABELS = {
  add_task: "タスクを追加",
  bulk_add_tasks: "タスクを一括追加",
  bulk_delete_tasks: "タスクを一括削除",
  bulk_update_tasks: "タスクを一括更新",
  complete_task: "タスクを完了",
  delete_all_tasks: "全タスクを削除",
  delete_task: "タスクを削除",
  update_task: "タスクを更新",
} as const satisfies Record<keyof typeof chatTools, string>;

const DESTRUCTIVE_TOOLS = new Set(["bulk_delete_tasks", "delete_all_tasks", "delete_task"]);

//? Single source of truth: the real per-state tool-part union derived from the
//? server tool registry (input/output/approval typed per tool), not hand-kept.
type ToolUIPart = SdkToolUIPart<InferUITools<typeof chatTools>>;

function messageText(parts: UIMessage["parts"]) {
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text;
    }
  }

  return text;
}

function toolPartsOf(parts: UIMessage["parts"]) {
  return parts.filter((part) => part.type.startsWith("tool-")) as unknown as ToolUIPart[];
}

function toolNameOf(type: ToolUIPart["type"]) {
  return type.replace(/^tool-/, "");
}

function summarizeToolInput(name: ReturnType<typeof toolNameOf>, input: ToolUIPart["input"]) {
  if (!input || typeof input !== "object") {
    return "";
  }

  const record = input as Record<string, unknown>;
  const source = typeof record.sourceTitle === "string" ? record.sourceTitle : null;
  const search =
    typeof record.search === "string"
      ? record.search
      : Array.isArray(record.searchTerms)
        ? record.searchTerms.join(" / ")
        : null;
  const status = typeof record.status === "string" ? record.status : null;
  const priority = typeof record.priority === "string" ? record.priority : null;

  const changes: string[] = [];

  if (typeof record.title === "string") {
    changes.push(`タイトル → ${record.title}`);
  }

  if (priority && name !== "bulk_delete_tasks") {
    changes.push(`優先度 → ${priority}`);
  }

  if (typeof record.completed === "boolean") {
    changes.push(record.completed ? "完了にする" : "未完了に戻す");
  }

  if (name === "delete_all_tasks") {
    return "ボード上のすべてのタスクが対象です。";
  }

  const target =
    source ??
    (search ? `「${search}」を含むタスク` : null) ??
    (status === "completed" ? "完了済みのタスク" : status === "active" ? "未完了のタスク" : null) ??
    (priority ? `優先度 ${priority} のタスク` : "対象タスク");

  return changes.length > 0 ? `${target}（${changes.join(" / ")}）` : target;
}

function ChatLoadingIndicator() {
  return (
    <article className="max-w-full">
      <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Assistant</p>
      <div
        aria-busy="true"
        aria-label="Assistant is thinking"
        className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm"
      >
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-zinc-400" />
          <span className="size-2 rounded-full bg-zinc-300" />
          <span className="size-2 rounded-full bg-zinc-200" />
        </span>
        <span className="animate-pulse">考え中...</span>
      </div>
    </article>
  );
}

type ToolPartViewProps = {
  onApprove: (
    id: NonNullable<ToolUIPart["approval"]>["id"],
    approved: NonNullable<NonNullable<ToolUIPart["approval"]>["approved"]>,
  ) => void;
  part: ToolUIPart;
};

function ToolPartView({ part, onApprove }: ToolPartViewProps) {
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

  if (part.state === "approval-responded" && part.approval && !part.approval.approved) {
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

export function Chat() {
  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
    onFinish: () => {
      void refetchTasksCollection();
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming";
  const lastMessageId = messages.at(-1)?.id;
  const lastMessage = messages.at(-1);
  const showLoading =
    status === "submitted" ||
    (isStreaming &&
      lastMessage?.role === "assistant" &&
      messageText(lastMessage.parts).length === 0 &&
      toolPartsOf(lastMessage.parts).length === 0);

  //? A pending approval is an unresolved tool call; the model cannot start a new
  //? action until it is approved or cancelled, so block input while one is open.
  const hasPendingApproval = messages.some(
    (message) =>
      message.role === "assistant" &&
      toolPartsOf(message.parts).some((part) => part.state === "approval-requested"),
  );

  const form = useForm({
    defaultValues: { body: "" },
    validators: { onChange: CreateMessageSchema },
    onSubmit: ({ value }) => {
      if (hasPendingApproval) {
        return;
      }

      sendMessage({ text: value.body });
      form.reset();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div aria-label="Chat history" className="flex flex-col gap-4">
        {messages.map((message) => {
          if (message.role !== "assistant") {
            return (
              <article className="flex justify-end" key={message.id}>
                <div className="max-w-[80%] rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-800 shadow-sm">
                  <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    You
                  </p>
                  <p className="text-sm leading-6 wrap-break-word">{messageText(message.parts)}</p>
                </div>
              </article>
            );
          }

          const toolParts = toolPartsOf(message.parts);
          const text = messageText(message.parts);
          const isLang = isOpenUILangResponse(text);

          if (text.length === 0 && toolParts.length === 0) {
            return null;
          }

          return (
            <article className="flex max-w-full flex-col gap-3" key={message.id}>
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Assistant</p>

              {toolParts.map((part) => (
                <ToolPartView
                  key={part.toolCallId}
                  onApprove={(id, approved) => addToolApprovalResponse({ approved, id })}
                  part={part}
                />
              ))}

              {isLang ? (
                <Renderer
                  isStreaming={isStreaming && message.id === lastMessageId}
                  library={genuiLibrary}
                  onAction={(event) => {
                    if (event.type === BuiltinActionType.ContinueConversation) {
                      sendMessage({ text: event.humanFriendlyMessage });
                    }
                  }}
                  response={extractOpenUILang(text) ?? ""}
                  toolProvider={createReadToolMap()}
                />
              ) : text.length > 0 ? (
                <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-800 shadow-sm">
                  {text}
                </div>
              ) : null}
            </article>
          );
        })}
        {showLoading ? <ChatLoadingIndicator /> : null}
      </div>

      {hasPendingApproval ? (
        <p className="text-sm text-amber-700">
          保留中の確認があります。先に「承認」または「キャンセル」を選んでください。
        </p>
      ) : null}

      <form
        aria-label="Send chat message"
        className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="body">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor={field.name}>
                Message
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Chat message"
                  className={cn(
                    "min-h-12 flex-1 rounded-md border border-zinc-300 px-3 text-base outline-offset-2 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-900",
                  )}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="例: 高優先度で週次レポート提出タスクを追加"
                  value={field.state.value}
                />
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                  {([canSubmit, isSubmitting]) => (
                    <button
                      className={cn(
                        "min-h-12 rounded-md bg-black px-5 font-medium text-white outline-offset-2 focus-visible:outline-2 focus-visible:outline-zinc-900",
                        (!canSubmit || isStreaming || hasPendingApproval) && "opacity-50",
                      )}
                      disabled={!canSubmit || isStreaming || hasPendingApproval}
                      type="submit"
                    >
                      {isSubmitting ? "..." : "Send"}
                    </button>
                  )}
                </form.Subscribe>
              </div>
              {!field.state.meta.isValid && (
                <em className="text-sm text-red-600" role="alert">
                  {field.state.meta.errors.map((error) => error?.message).join(", ")}
                </em>
              )}
            </div>
          )}
        </form.Field>
      </form>
    </div>
  );
}
