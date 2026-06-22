export type ResolvedMutationPin = {
  args: Record<string, unknown>;
  matchedCount: number;
  singleTargetId?: string;
  tool: string;
};

export type PinnedMutations = {
  _resolved?: ResolvedMutationPin;
} & Partial<Record<string, Record<string, unknown>>>;

let latestPinnedMutations: PinnedMutations | null = null;

export function setLatestPinnedMutations(pinned: PinnedMutations | null) {
  latestPinnedMutations = pinned;
}

export function getLatestPinnedMutations() {
  return latestPinnedMutations;
}

function isNullish(value: unknown) {
  return value === null || value === undefined;
}

function mergePinOntoArgs(args: Record<string, unknown>, pin: Record<string, unknown> | undefined) {
  if (!pin) {
    return args;
  }

  const merged = { ...args };

  for (const [key, value] of Object.entries(pin)) {
    if (!isNullish(value)) {
      merged[key] = value;
    }
  }

  return merged;
}

const ID_ONLY_TOOLS = new Set(["complete_task", "delete_task"]);

function normalizeForTool(toolName: string, merged: Record<string, unknown>) {
  if (ID_ONLY_TOOLS.has(toolName)) {
    const id = merged.id;

    if (typeof id === "string" && id.trim()) {
      return { id: id.trim() };
    }
  }

  return merged;
}

/** Server-pinned args win over OpenUI-bound Mutation args (null id at bind time). */
export function mergeToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  pinned: PinnedMutations | null = getLatestPinnedMutations(),
) {
  const store = pinned ?? getLatestPinnedMutations();

  if (!store) {
    return args;
  }

  const resolved = store._resolved;

  if (resolved?.singleTargetId && ID_ONLY_TOOLS.has(toolName)) {
    return { id: resolved.singleTargetId };
  }

  if (resolved && toolName === resolved.tool) {
    return normalizeForTool(toolName, mergePinOntoArgs(args, resolved.args));
  }

  let merged = { ...args };

  for (const [key, pin] of Object.entries(store)) {
    if (key === "_resolved" || !pin || typeof pin !== "object") {
      continue;
    }

    merged = mergePinOntoArgs(merged, pin);
  }

  merged = mergePinOntoArgs(merged, store[toolName]);

  if (ID_ONLY_TOOLS.has(toolName) && isNullish(merged.id) && resolved?.singleTargetId) {
    merged.id = resolved.singleTargetId;
  }

  return normalizeForTool(toolName, merged);
}

export function hasPinnedMutation(toolName: string, pinned: PinnedMutations | null) {
  const store = pinned ?? getLatestPinnedMutations();

  return Boolean(store?.[toolName] && Object.keys(store[toolName]!).length > 0);
}

export function pinnedMutationsNeedMerge(
  toolName: string,
  args: Record<string, unknown>,
  pinned: PinnedMutations | null,
) {
  const pin = (pinned ?? getLatestPinnedMutations())?.[toolName];

  if (!pin) {
    return false;
  }

  return Object.entries(pin).some(([key, value]) => !isNullish(value) && isNullish(args[key]));
}
