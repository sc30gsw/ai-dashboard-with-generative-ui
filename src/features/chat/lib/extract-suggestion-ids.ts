//? TaskSuggestion(items=[...]) は OpenUI Lang として届く生テキスト。<Renderer> は表示専用で
//? 解決済みの props を外へ渡さないため、「適用」ボタン用に items[].id を軽量パースで抜き出す。
//? 対象は "TaskSuggestion(" の開き括弧から対応する閉じ括弧までの範囲に限定する（括弧の深さを
//? 文字単位で追跡）。末尾まで無制限にスキャンすると、後続の別ノードに含まれる無関係な
//? "id:" まで拾ってしまうため。

//? "TaskSuggestion(" の開き括弧に対応する閉じ括弧の直後の index を返す。文字列リテラル内の
//? 括弧はカウントしない（ダブルクォート文字列、バックスラッシュエスケープ対応）。
//? 対応する閉じ括弧が見つからない（ストリーミング途中で切れている等）場合は末尾までを返す。
function findBalancedSpanEnd(text: string, openParenIndex: number) {
  let depth = 0;
  let inString = false;

  for (let i = openParenIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (char === "\\") {
        i++; // skip escaped character
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;

      if (depth === 0) {
        return i + 1;
      }
    }
  }

  return text.length;
}

//? suggestionText を文字列リテラルを意識して走査し、リテラルの外側にある `id:` キーのみを
//? 対象にする。reason/title などのフィールド値に `id: "x"` という文字列が含まれていても、
//? それは文字列内部（inString）なので誤検出しない。
function extractIdKeyValues(text: string) {
  const ids: string[] = [];
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (char === "\\") {
        i++; // skip escaped character
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    const previousChar = text[i - 1];
    const isKeyBoundary = previousChar === undefined || !/\w/.test(previousChar);

    if (isKeyBoundary && char === "i" && text[i + 1] === "d") {
      const match = text.slice(i + 2).match(/^\s*:\s*"([^"]*)"/);

      if (match?.[1]) {
        ids.push(match[1]);
      }
    }
  }

  return ids;
}

export function extractSuggestionOrderedIds(openUiLangText: string) {
  const callIndex = openUiLangText.indexOf("TaskSuggestion(");

  if (callIndex === -1) {
    return [];
  }

  const openParenIndex = callIndex + "TaskSuggestion".length;
  const spanEnd = findBalancedSpanEnd(openUiLangText, openParenIndex);
  const suggestionText = openUiLangText.slice(openParenIndex, spanEnd);

  return extractIdKeyValues(suggestionText);
}
