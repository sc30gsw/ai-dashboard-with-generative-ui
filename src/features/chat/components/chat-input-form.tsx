import { Button, Input } from "@heroui/react";

import { withForm } from "~/features/chat/hooks/form";

export const ChatInputForm = withForm({
  defaultValues: { body: "" },
  props: { hasPendingApproval: false, isStreaming: false },
  render: function Render({ form, hasPendingApproval, isStreaming }) {
    return (
      <div className="flex flex-col gap-2">
        {hasPendingApproval ? (
          <p className="text-sm text-amber-700">
            保留中の確認があります。先に「承認」または「キャンセル」を選んでください。
          </p>
        ) : null}

        <form
          aria-label="Send chat message"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="body">
            {(field) => (
              <div className="flex flex-col gap-1">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    aria-label="Chat message"
                    className="flex-1"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="例: 高優先度で週次レポート提出タスクを追加"
                    value={field.state.value}
                  />
                  <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        isDisabled={!canSubmit || isStreaming || hasPendingApproval}
                        type="submit"
                      >
                        {isSubmitting ? "..." : "Send"}
                      </Button>
                    )}
                  </form.Subscribe>
                </div>
                {!field.state.meta.isValid && (
                  <em className="text-sm text-red-600" role="alert">
                    {field.state.meta.errors
                      .map(
                        (error) => (error as unknown as { message?: string } | undefined)?.message,
                      )
                      .join(", ")}
                  </em>
                )}
              </div>
            )}
          </form.Field>
        </form>
      </div>
    );
  },
});
