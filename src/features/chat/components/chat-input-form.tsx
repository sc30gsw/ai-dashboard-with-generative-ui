import { cn } from "cnfast";

import { withForm } from "~/features/chat/hooks/form";

export const ChatInputForm = withForm({
  defaultValues: { body: "" },
  props: { hasPendingApproval: false, isStreaming: false },
  render: function Render({ form, hasPendingApproval, isStreaming }) {
    return (
      <>
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
      </>
    );
  },
});
