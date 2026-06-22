import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

/** Plain-text clarification — no Generative UI. */
export function createClarifyResponse(message: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = "clarify-text";

      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", delta: message, id });
      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/** Strip markdown fences or leading prose so Renderer receives valid OpenUI Lang. */
export function extractOpenUILang(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const fenced = trimmed.match(/```(?:openui(?:-lang)?|openui-lang)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]?.includes("root =")) {
    return fenced[1].trim();
  }

  const rootIndex = trimmed.indexOf("root =");

  if (rootIndex >= 0) {
    return trimmed.slice(rootIndex).trim();
  }

  if (trimmed.startsWith("root =")) {
    return trimmed;
  }

  return null;
}

export function isOpenUILangResponse(text: string) {
  return extractOpenUILang(text) !== null;
}
