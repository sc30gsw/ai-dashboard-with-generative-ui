export type Coordinates = Record<"latitude" | "longitude", number>;

//? 3秒だと初回の測位（permission 許可直後のコールドスタート）が間に合わず null になりやすい。
//? maximumAge でキャッシュ済みの位置を許容し、2回目以降は即座に返るようにする。
const GEOLOCATION_TIMEOUT_MS = 10_000;
const GEOLOCATION_MAX_AGE_MS = 300_000;

//? SSR/未対応ブラウザは無視して null を返し、呼び出し側は「座標なしで質問」にフォールバックする。
//? 許可拒否・タイムアウトも同様に null 扱い（システムプロンプトの Mode 3 が現在地の再質問等を担う）。
export function getCurrentCoordinates() {
  return new Promise<Coordinates | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { maximumAge: GEOLOCATION_MAX_AGE_MS, timeout: GEOLOCATION_TIMEOUT_MS },
    );
  });
}
