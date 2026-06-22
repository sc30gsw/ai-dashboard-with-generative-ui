/** Escape % and _ for SQL LIKE with backslash escape. */
export function escapeLikeLiteral(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function likeContainsPattern(value: string) {
  return `%${escapeLikeLiteral(value)}%`;
}
