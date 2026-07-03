# 天気連動 Generative UI — レビュー修正計画

> 作成日: 2026-07-03 / 対象: [`weather-genui-review.md`](./weather-genui-review.md) の全 27 指摘
> 仕様ソース: [`weather-genui-spec.md`](./weather-genui-spec.md)（§7 は本計画どおりコード側を合わせるため改訂不要）
> 方針: /grill-me で確定した下記判断に基づく。実装は Wave 単位（依存順）。各 Wave 完了時に `vp check` / `vp test`、全 Wave 後に `vp build` + spec 適合レビュー。

## 0. 確定判断（grill 結果）

| 論点 | 決定 |
| --- | --- |
| パネル配置違反（Standards-1） | `WeatherSuggestionPanel` を **`src/components/` へ抽出**（ルール明記の正規ルート）。両ページ設置は維持 |
| Pie/Bar 乖離（Spec-7） | **PieChart 化**（コード修正。元要望に PieChart 明記） |
| ルートメソッド乖離（Spec-8） | **仕様どおり GET /api/weather + PATCH /api/tasks/reorder に変更**（コード修正） |
| widget 直接供給（Spec-9） | 現状追認 — **仕様書 §8.1 に追記**（Renderer+Query 経由で充足） |
| Geolocation（Spec-3） | **仕様どおり実装**（useChat body → chat ルート Zod 検証 → get_weather 既定座標。プロンプト文字列埋め込みは廃止） |
| DatePicker（Spec-4） | **配線する**（useTriggerAction ラウンドトリップ。ローカル state 削除で React-9 も解消） |
| タイムゾーン | **クライアント TZ をリクエストで送る**（`timeZone` を body に追加）。未送信時の既定値は定数 `Asia/Tokyo` |
| レート制限（Sec MED-1） | **グローバル総量上限＋バケット数上限を併設**（IP 別制限は現状維持） |
| 裁量 3 項目 | 全部やる: 承認 UI タイトル列挙 / エラー UI 2 点 / パネル指定日 UI |
| 機械的修正 11 件 | 全部やる |

---

## Wave A — 構造移動（Standards-1 / 3 / 4 と、パネル内在の指摘を同時処理）

**対象指摘: Standards-1（違反・最重要）, Standards-3, Standards-4, React-10, React-11, React-13, Spec-6, Sec LOW-2（ダイアログ側）**

1. `src/features/weather/components/weather-suggestion-panel.tsx` → **`src/components/weather-suggestion-panel.tsx`** へ移動。
   - `src/features/weather/lib/apply-reorder.ts` / `extract-suggestion-ids.ts`（＋各テスト）はパネル専属ヘルパーのため **`src/lib/`** へ移動（`src/components/` は UI、ロジックは `src/lib/` の共有層へ。どちらも features を import 可能な共有層）。
   - `dashboard-page.tsx` / `task-list-page.tsx` の import を `~/components/weather-suggestion-panel` に変更。tasks⇄weather 循環が消滅。
2. **重複一本化（Standards-3）**: `readToolMap` 合成 `{ ...createReadToolMap(), ...createWeatherReadToolMap() }` を chat 側から export（例: `src/features/chat/genui/tool-provider-map.ts` の `createChatToolProviderMap()`）し、`assistant-message.tsx` とパネルの両方がそれを使う。`isOpenUiLangResponse` も chat の utils から export して共用（パネル側の簡易複製を削除）。
3. **型重複解消（Standards-4）**: `WeatherToolProviderMap` の二重定義を `weather/tools/` 内 1 箇所に統合。`WeatherTool` / `TaskTool` のほぼ同形問題は、共通形を **`src/types/tool.ts`** に `ToolDefinition` として抽出し両者が extend（`useWebMCP` 依存の name/description 部分は維持）。
4. **パネル内修正**（移動後の同一ファイルなので直列で同時に）:
   - React-10: 「適用」ボタンを `isStreaming` 中 `isDisabled` に（不完全 orderedIds での確定を防止）。
   - React-11: `handleConfirmApply` を `Result.tryPromise` で包み、失敗を toast 表示（better-result 規約準拠）。`apply-reorder.ts` 内 `refetchTasksCollection()` の reject も捕捉。
   - React-13: `startsWith("root =")` を `assistant-message.tsx` と同じ部分一致判定に揃える（共用化した `isOpenUiLangResponse` で自然解消）。
   - Spec-6: パネルに HeroUI DatePicker（今日〜+7 日）を追加し、`suggestionPrompt` に選択日を埋め込む。
   - Sec LOW-2（ダイアログ側）: AlertDialog の確認文言に、`tasksCollection` で id→タイトル解決した**順序付きタイトル列挙**を表示。
5. 検証: `vp test`（移動したテスト含む全緑）、`vp lint`（feature 間 import 違反ゼロを grep でも確認: `grep -r "features/chat" src/features/weather src/features/tasks` が 0 件）。

## Wave B — ルート GET/PATCH 化（Spec-8）

**対象指摘: Spec-8（MEDIUM）**

1. `weather-routes.ts`: `POST /weather/get` → **`GET /weather`**。query は Zod（Standard Schema）で検証 — query 値は文字列のため `z.coerce.number()`（緯度経度）を使う query 専用スキーマ `GetWeatherQuerySchema` を `weather-schema.ts` に追加（`GetWeatherInputSchema` から派生）。
2. `task-routes.ts`: `POST /tasks/reorder` → **`PATCH /tasks/reorder`**（body 検証は現行のまま）。
3. `src/routes/api/$.ts`: server handlers に **`PATCH: handle` を追加**（現在 GET/POST のみ）。
4. 連鎖修正: `get-weather.ts` の run（Eden `weather.get.post(input)` → `weather.get({ query })`）、`apply-reorder.ts`（`tasks.reorder.post` → `tasks.reorder.patch`）、`reorder-tasks.ts` の run、`weather-routes.test.ts` / `task-routes.test.ts` の Request メソッド/URL、Web MCP アダプタ経由の呼び出し（Eden 経由なので run の修正で自動追随）。
5. 検証: 両ルートテスト（GET query 検証 200/422、PATCH 200/422）＋ `vp test` 全緑。

## Wave C — 日付・TZ 基盤 + Geolocation（Spec-1 HIGH / Spec-3 HIGH / React-12 / Standards-8）

`src/routes/api/chat.ts` と `weather-schema.ts` に集中するため単一 Wave（同一ファイル衝突回避）。

1. **`src/lib/timezone.ts` 新設**: `APP_DEFAULT_TIMEZONE = "Asia/Tokyo"` 定数と `todayInTimeZone(timeZone: string): string`（`Intl.DateTimeFormat("en-CA", { timeZone })` で YYYY-MM-DD）。IANA 名の妥当性は `Intl` コンストラクタの throw を `Result.try` で捕捉し不正時は既定値へフォールバック。
2. **ChatRequestSchema 拡張**（Spec-3 + TZ）:
   ```ts
   const ChatRequestSchema = z.object({
     messages: z.array(z.unknown()),
     location: z.object({
       latitude: z.number().min(-90).max(90),
       longitude: z.number().min(-180).max(180),
     }).optional(),
     timeZone: z.string().max(64).optional(),
   });
   ```
3. **system prompt への現在日付埋め込み（Spec-1）**: `chat.ts` がリクエストごとに `todayInTimeZone(timeZone ?? APP_DEFAULT_TIMEZONE)` を算出し、`boardState` と同様の形式で `## Current date` セクションを system へ連結（`system-prompt.ts` 本体は静的のまま — リクエスト依存値はルートで注入）。
4. **get_weather 既定座標（Spec-3 / §6.1 鎖の完成）**: body.location を検証後、chat ルートで `weatherChatTools` を **リクエスト座標でファクトリ生成**（`createWeatherChatTools(defaultCoords?)` に変更。execute 内で city/座標なし時に defaultCoords へフォールバックしてから `WeatherService.get`）。パネル・チャット本体の両方で `useChat` の body に `{ location, timeZone }` を載せる（`navigator.geolocation` は共通フック `src/hooks/use-geolocation.ts` に抽出しパネルの既存ロジックを移管）。プロンプト文字列への座標埋め込みは削除。
5. **weather-schema の範囲 refine 緩和（React-12）**: 今日〜+7 日の判定を UTC 基準の**±1 日許容**（today-1 〜 today+8 を受理）に緩め、精密判定は既存の service 層 `forecast_failed`（実予報窓との照合）に委譲する旨をコメント明記。
6. **日付表現統一（Standards-8）**: `weather-schema.ts` の `z.string().regex(...)` を `z.iso.date()` に統一（task-model.ts と同一表現）。
7. 検証: chat ルートの body 検証テスト（location/timeZone 不正で 400）、`todayInTimeZone` のユニットテスト（TZ 跨ぎ日付）、weather-schema テストの境界更新、`vp test` 全緑。

## Wave D — DatePicker 配線 + widget エラー状態（Spec-4 / Standards-6 / React-9 / Spec-5①）

1. `weather-widget.tsx`: `useState(selectedDate)` を**削除**（React-9）。DatePicker の `onChange` を `useTriggerAction()`（task-suggestion.tsx と同一機構）で「{選択日} の天気でタスク順序を提案して」を送信するラウンドトリップに配線（Spec-4 / Standards-6 解消）。表示日付は props.date のみ参照。
2. **エラー状態カード（Spec-5①）**: `weatherWidgetPropsSchema` に `error: z.string().nullable().describe(...)` を optional 追加し、error 時は気温等を出さないコンパクトなエラーカードを表示。system prompt の Mode 4 に「get_weather が失敗を返したら `WeatherWidget(error=...)` を emit してよい」旨を追記。
3. 検証: `vp check` ＋ Renderer 登録の整合（library.ts は変更不要、props 追加のみ）。

## Wave E — 一覧ソートの UI 適用（Spec-2 HIGH）

1. `src/features/tasks/utils/tasks-live-query.ts` / `use-filtered-tasks-query.ts`: TanStack DB の live query に **sortOrder ASC nulls-last → createdAt** の複合ソートを実装（`orderBy` の複合キー対応を確認し、非対応なら比較関数 or 事前ソートで対処）。`useAllTasksQuery` も同一規則に。
2. 前提: `TaskView`（collection の wire 型）に `sortOrder` が含まれているか確認 — 現在 `TaskViewSchema.pick` に sortOrder が無ければ **wire スキーマへ追加**（`/tasks/list` 応答に sortOrder を含める。additive なので安全）。
3. 検証: reorder 適用 → collection refetch → 一覧が提案順に並ぶことを live query のユニットテストで確認（Phase 2 検証項目 6 の充足）。

## Wave F — セキュリティ機械修正（Sec MED-1 / MED-2 / LOW-1 / LOW-2 承認カード側）

1. **MED-2**: `ReorderTasksSchema` → `z.array(z.string().min(1).max(64)).min(1).max(100)`。境界テスト追加（101 件で 422）。
2. **MED-1**: `rate-limit.ts` に**グローバル総量上限**（例: 60req/分、キー "\_\_global\_\_"）と**バケット数上限**（例: 1000。超過時は最終アクセスの古い順に削除）を追加。chat ルートで IP 別 → グローバルの順に判定。テスト: XFF を変えながらの連投がグローバル上限で 429 になること。
3. **LOW-1**: `weather-service.ts` の geocoding / forecast レスポンスに **Zod スキーマ**（緯度 ±90・経度 ±180・配列形）を定義して `safeParse`、URL 構築を `URLSearchParams` に変更（`as` キャスト廃止）。
4. **LOW-2（承認カード側）**: `summarizeToolInput` の `reorder_tasks` 分岐は server 側で collection を引けないため、**チャット承認カードの表示コンポーネント側**で orderedIds → `tasksCollection` タイトル解決を行い順序付き列挙を表示（AlertDialog 側は Wave A で対応済み）。
5. 検証: 追加テスト＋既存レートリミット/ルートテスト全緑。

## Wave G — 小掃除 + ドキュメント同期（Standards-2 / 5 / 7、仕様書改訂、Spec-5② / Spec-7）

1. **WMO 表一本化（Standards-5）**: `weather-service.ts` のラベル表と `weather-widget.tsx` の絵文字表を `src/features/weather/lib/wmo-codes.ts` に統合（`{ code, label, emoji }` の単一テーブル、両者が参照）。
2. **脆いパース補強（Standards-7）**: `extract-suggestion-ids.ts` の正規表現を「`TaskSuggestion(` から**対応する閉じ括弧まで**」に読み取り範囲を限定（括弧深度カウント）。後続ノードの id 混入テストを追加。
3. **ルール文書同期（Standards-2）**: `.claude/rules/web/ai-streaming.md` の `stepCountIs(3)` 記述を 5 に更新（理由: 提案フロー最大 4 ステップ、仕様 §6.3）。
4. **仕様書改訂**: `weather-genui-spec.md` §8.1 に「チャット外 widget は Renderer+Query 経由で供給（直接データ供給は不要と判断）」を追記。§7 は GET/PATCH 化により改訂不要。
5. **PieChart 化（Spec-7）**: `dashboard-page.tsx` の `PriorityDistributionChart` を recharts `PieChart`（`Pie` + `Cell`、優先度 3 色）に差し替え（lazy-load パターン維持、sr-only 要約は既存のまま）。
6. **リトライボタン（Spec-5②）**: `chat.tsx` とパネルのエラー表示に `useChat` の再送（`regenerate` / 最終メッセージ再送）ボタンを追加。
7. 検証: `vp check` / `vp test` / `vp build` / `vp run doctor`。

## 最終検証（全 Wave 後）

1. `vp check` / `vp test` / `vp build` フルパス。
2. spec 適合レビュー agent（従来同様の独立・敵対的レビュー）: 本計画の 27 項目 × 修正済み判定の対応表を出力させ、未解消ゼロを確認。
3. feature 間 import 違反の静的確認: weather/tasks から chat への import が 0 件、tasks⇄weather 循環なし。

## レビュー指摘 → Wave 対応表

| 指摘 | Wave | | 指摘 | Wave |
| --- | --- | --- | --- | --- |
| Standards-1 配置違反 | A | | Spec-1 現在日付 | C |
| Standards-2 ルール同期 | G | | Spec-2 一覧ソート | E |
| Standards-3 重複コード | A | | Spec-3 Geolocation | C |
| Standards-4 型重複 | A | | Spec-4 DatePicker | D |
| Standards-5 WMO 二重管理 | G | | Spec-5 エラー UI | D①+G② |
| Standards-6 投機的 UI | D | | Spec-6 パネル指定日 | A |
| Standards-7 脆いパース | G | | Spec-7 Pie 化 | G |
| Standards-8 日付表現 | C | | Spec-8 GET/PATCH 化 | B |
| React-9 stale state | D | | Spec-9 直接供給 | G（仕様書追記） |
| React-10 streaming 中適用 | A | | Sec MED-1 レート制限 | F |
| React-11 reject 未捕捉 | A | | Sec MED-2 orderedIds 上限 | F |
| React-12 UTC/JST | C | | Sec LOW-1 レスポンス検証 | F |
| React-13 startsWith | A | | Sec LOW-2 承認 UI 列挙 | A（Dialog）+F（カード） |

## 残存する既知の別課題（本計画のスコープ外）

- リモート Turso への migration 未適用（`__drizzle_migrations` bootstrap 問題、ユーザー判断待ち）
- `.agents/skills/**` 49 ファイルの整形ノイズ（`git checkout -- .agents/skills/` で復元可）
