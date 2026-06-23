//* OpenUI Lang ヘルパー: アシスタントメッセージからモデル出力の OpenUI Lang を
//* 検出・抽出し、チャットクライアントが read を <Renderer> にルーティングできるようにする。

//* マークダウンフェンスや先頭の散文を除去し、Renderer が有効な OpenUI Lang を受け取れるようにする。
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
