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

  //? OpenUI Lang は行頭の `root =` で始まる。散文中に現れる "root =" を誤検出しないよう
  //? 行頭アンカー（multiline）で判定し、その位置以降を抽出する。
  const rootMatch = trimmed.match(/^root\s*=/m);

  if (rootMatch?.index !== undefined) {
    return trimmed.slice(rootMatch.index).trim();
  }

  return null;
}

export function isOpenUILangResponse(text: string) {
  return extractOpenUILang(text) !== null;
}
