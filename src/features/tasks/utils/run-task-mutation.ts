import { Result, TaggedError } from "better-result";

class TaskMutationError extends TaggedError("TaskMutationError")<{
  cause?: unknown;
  message: string;
}>() {}

export async function runTaskMutation(action: () => Promise<void> | void) {
  return Result.tryPromise({
    catch: (cause) =>
      new TaskMutationError({
        cause,
        message: cause instanceof Error ? cause.message : "Task operation failed",
      }),
    try: async () => {
      await action();
    },
  });
}

export function runTaskMutationSync(action: () => void) {
  return Result.try({
    catch: (cause) =>
      new TaskMutationError({
        cause,
        message: cause instanceof Error ? cause.message : "Task operation failed",
      }),
    try: action,
  });
}
