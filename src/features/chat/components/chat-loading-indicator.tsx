export function ChatLoadingIndicator() {
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
