//? SQL LIKE 用に % と _ をバックスラッシュでエスケープする。
function escapeLikeLiteral(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function likeContainsPattern(value: string) {
  return `%${escapeLikeLiteral(value)}%`;
}
