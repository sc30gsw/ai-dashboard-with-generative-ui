//? 内部の Error メッセージをクライアントへ漏らさないための汎用メッセージ。
const GENERIC_ERROR_MESSAGE = "操作に失敗しました。";

//? 詳細はサーバー側に残し、クライアントには汎用メッセージのみ返す。
//? 応答 SHAPE（{ ok: false, message }）は維持し、Eden クライアント / collection / tool 側の data.ok・data.message 依存を壊さない。
export function errorResponse(tag: string, error: Record<"message", string>) {
  console.error(`[${tag}]`, error.message);

  return { message: GENERIC_ERROR_MESSAGE, ok: false as const };
}
