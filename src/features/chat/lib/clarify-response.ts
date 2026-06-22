//* OpenUI Lang helpers: detect and extract model-emitted OpenUI Lang from assistant
//* message text, so the chat client can route reads to the <Renderer>.

//* Strip markdown fences or leading prose so Renderer receives valid OpenUI Lang.
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
