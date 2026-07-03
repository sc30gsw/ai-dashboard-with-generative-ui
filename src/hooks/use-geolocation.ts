export type Coordinates = Record<"latitude" | "longitude", number>;

const GEOLOCATION_TIMEOUT_MS = 3000;

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
      { timeout: GEOLOCATION_TIMEOUT_MS },
    );
  });
}
