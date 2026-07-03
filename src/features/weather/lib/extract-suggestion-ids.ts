//? TaskSuggestion(items=[...]) は OpenUI Lang として届く生テキスト。<Renderer> は表示専用で
//? 解決済みの props を外へ渡さないため、「適用」ボタン用に items[].id を軽量パースで抜き出す。
//? 対象は TaskSuggestion 呼び出し以降のテキストに限定し、他ノードの id と混同しない。
export function extractSuggestionOrderedIds(openUiLangText: string) {
  const startIndex = openUiLangText.indexOf("TaskSuggestion(");

  if (startIndex === -1) {
    return [];
  }

  const suggestionText = openUiLangText.slice(startIndex);
  const idMatches = suggestionText.matchAll(/\bid\s*:\s*"([^"]*)"/g);

  return Array.from(idMatches, (match) => match[1] ?? "").filter((id) => id.length > 0);
}
