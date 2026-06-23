import { Result, TaggedError } from "better-result";

class TaskMutationError extends TaggedError("TaskMutationError")<{
  cause?: unknown;
  message: string;
}>() {}

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
