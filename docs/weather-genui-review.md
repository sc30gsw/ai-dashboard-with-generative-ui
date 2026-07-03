# 天気連動 Generative UI — コードレビュー結果

> 実施日: 2026-07-03 / 対象ブランチ: `feature/add-generative-ui`
> 固定点: `HEAD`（実装は全て未コミットの working tree 変更 — 変更 23 ファイル + 新規 26 ファイル）
> 仕様ソース: [`docs/weather-genui-spec.md`](./weather-genui-spec.md) + `.agents/skills/loop-me/workflows/phase-1〜3`
> レビュー方式: 規約軸 / 仕様軸 / セキュリティ軸の 3 サブエージェント並列レビュー（軸間の統合・再ランク付けはしない）

---

## Standards（規約軸）

### (a) 規約違反【違反】

1. **feature 間依存の禁止違反（最重要）** — `.claude/rules/typescript/project-structure.md`「Feature inter-dependencies forbidden」。許可方向は chat/dashboard→(tasks|weather)、tasks→weather のみ。
   - `src/features/weather/components/weather-suggestion-panel.tsx:7-12` — weather が **chat**（`genui/library`, `utils/message-parts`）と **tasks**（`tools/adapters/tool-provider`）を import。
   - `src/features/weather/lib/apply-reorder.ts:3` — weather が `~/features/tasks/collections/tasks-collection` を import。
   - さらに `src/features/tasks/components/task-list-page.tsx:8` が weather を import するため **tasks⇄weather の循環**が成立。`WeatherSuggestionPanel` は view feature（dashboard）配下へ移すべき。

2. **`stopWhen: stepCountIs(3)` からの逸脱（ドキュメント乖離）** — `src/routes/api/chat.ts:137` が `stepCountIs(5)` に変更されたが、`.claude/rules/web/ai-streaming.md` は 3 のまま。コード変更自体は仕様（§6.3）どおりで妥当。ルール文書の同期が必要。

### (b) スメル【判断】

3. **Duplicated Code** — `readToolMap` 合成（`{ ...createReadToolMap(), ...createWeatherReadToolMap() }`）が `assistant-message.tsx:14` と `weather-suggestion-panel.tsx:14` に重複。`isOpenUiLangResponse`（panel:40-42）も `assistant-message.tsx:37-40` の簡易複製（コメントで自認）。逆 import 回避のための複製は、配置が誤っているサイン（見つけ 1 と同根）。
4. **Duplicated Code** — `WeatherToolProviderMap` 型が `weather/tools/get-weather.ts:9-12` と `weather/tools/adapters/tool-provider.ts:5-8` で二重定義。`WeatherTool` 型（get-weather.ts:14-22）は `tasks/tools/tool.ts` の `TaskTool` とほぼ同形（共有化するなら `src/types/` へ）。
5. **Duplicated Code（弱）** — WMO コード表を `weather-service.ts:14-41`（ラベル）と `weather-widget.tsx:6-33`（絵文字）で二重管理。コード追加時に二箇所修正（Shotgun Surgery 予備軍）。
6. **Speculative Generality** — `weather-widget.tsx:84-123` の DatePicker は「Phase 2 で配線」前提の無機能 UI。CLAUDE.md「Nothing speculative」に照らし、今は削るか配線するのが妥当。
7. **Primitive Obsession / 脆いパース** — `extract-suggestion-ids.ts:12` が正規表現で OpenUI Lang から id 抽出。`TaskSuggestion(` 以降**全テキスト**の `id:` を拾うため、後続ノードの id 混入余地あり。
8. **一貫性** — `weather-schema.ts:10` が `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`、task-model.ts:58 等は `z.iso.date()`。同一表現の重複定義。

### (c) React レーン

9. **HIGH** — `weather-widget.tsx:86` `useState(date)`：prop 由来の初期 state。ストリーミングで `props.date` が変わっても `selectedDate` が stale（derived-state-in-state）。選択結果もどこにも作用しない（見つけ 6 と併せて削除推奨）。
10. **MEDIUM** — `weather-suggestion-panel.tsx:96` 「適用」ボタンが `isStreaming` 中に無効化されない。ストリーム途中の部分テキストから抽出した**不完全な orderedIds** で reorder を確定できる。
11. **MEDIUM** — `weather-suggestion-panel.tsx:70-82` `handleConfirmApply`：`applyReorderSuggestion` 内の `refetchTasksCollection()`（apply-reorder.ts:23）の reject が未捕捉（`onPress` は `void`）。失敗がユーザーに伝わらない。better-result.md の境界 wrap（`Result.tryPromise`）対象。
12. **MEDIUM** — `weather-schema.ts:16-19` 日付範囲判定が `toISOString()`＝UTC 基準。JST では「7 日先」が時間帯によって拒否され、`timezone=auto` の Open-Meteo 応答（現地日付）とずれる。
13. **LOW** — `weather-suggestion-panel.tsx:144` `startsWith("root =")` は前方一致のみのため、ストリーミング冒頭（`"roo"` 等）で一瞬散文表示にフォールバックしてチラつく。`assistant-message.tsx:40` は部分一致対応済みで挙動が非対称。

---

## Spec（仕様軸）

### (a) 未実装 / 部分実装

**1. [HIGH] §8.5 現在日付の埋め込みが未実装**
`src/features/chat/lib/system-prompt.ts` と `src/routes/api/chat.ts` に現在日付の埋め込みが一切ない（`today/現在日/new Date/toISOString` で grep 0 件）。仕様は「『明日』『土曜』の解決に必須」と明記。`GetWeatherInputSchema` は date を「今日〜7日先」で refine するため（`src/features/weather/schemas/weather-schema.ts:14-25`）、モデルが今日を知らないと date 生成が原理的に不安定。提案フロー・チャート・縮退指示は実装済みだが、この 1 点だけ欠落。

**2. [HIGH] §4 一覧の並び順がタスク一覧 UI に未適用**
`list_tasks`（サーバー）は sortOrder ASC nulls-last 対応済み（`task-service.ts` orderFor）だが、UI 側は `src/features/tasks/hooks/use-filtered-tasks-query.ts:26` が `orderBy(({task}) => task.createdAt, sortDirection)` のみで、`src/features/tasks` 配下に sortOrder 参照がゼロ。reorder 承認/適用後も画面の並びが変わらず、Phase 2 の検証項目 6「承認 → 一覧順序が変わる」を満たさない。

**3. [HIGH] §8.4 Geolocation → chat ルート連携が仕様と別物**
仕様は「`useChat` body `{location:{latitude,longitude}}` → chat ルートで Zod 検証 → `get_weather` の既定座標としてツールコンテキストへ」。実装は `ChatRequestSchema = z.object({ messages })` のみ（`src/routes/api/chat.ts:30`）で body.location の検証・受け渡しなし。座標はパネルがプロンプト本文に文字列で埋め込むだけ（`weather-suggestion-panel.tsx` suggestionPrompt）。チャット画面本体に geolocation なし。§6.1 のフォールバック鎖「request-default 座標」段も欠落（`weather-service.ts:152` は city/coords 無しで即 `location_required`）。

**4. [MEDIUM] §8.1 DatePicker ラウンドトリップ未配線**
`weather-widget.tsx:97-101` の onChange はローカル state 更新のみ。コード内コメント「Phase 2 will wire this to re-send a chat prompt for the picked date」が残置。Phase 2 の他項目は実装済みなのに本項のみ未了。表示データは props 固定のため日付チップの表示しか変わらない。

**5. [MEDIUM] §10 エラー UI の一部未実装**

- 天気ウィジェットの `ok:false` エラー状態カードなし（widget props にエラー系フィールドなし）。
- `useChat` エラーのリトライボタンなし（`chat.tsx:79-81`・パネルともメッセージ表示のみ。パネルは「順序提案」再押下で代替可）。

**6. [LOW] §8.3 定型プロンプトに「指定日」なし**
`suggestionPrompt` は「今日の天気をふまえて…」固定。仕様の「指定日・座標込み」のうち日付指定 UI が無い。

### (c) 実装相違

**7. [MEDIUM] §9 優先度別内訳が PieChart でなく BarChart**
`dashboard-page.tsx:24-37`（PieChart は 0 件）。積み上げ BarChart・ComposedChart（Bar=新規/Line=完了）・クライアント集計・recharts 直接依存（package.json:52 "recharts": "2.15.4"）は仕様どおり。

**8. [MEDIUM] §7 ルートのメソッド/形が相違**
`GET /api/weather`（query Zod 検証）→ 実装は `POST /api/weather/get`（body 検証、`weather-routes.ts:18-27`）。`PATCH /api/tasks/reorder` → `POST /tasks/reorder`（`task-routes.ts:136-137`）。Eden 経由で機能同等・二重検証と Result→plain 変換は維持されているが、仕様が 2 回明記したメソッドと不一致。

**9. [LOW] §8.1 チャット外の天気ウィジェット直接データ供給なし**
パネルは Renderer+toolProvider（Query 自動解決）経由のみ。§8.3 方式には準拠しているため実害は小。

### (b) スコープ外

大きな逸脱なし。仕様に無い追加として: `extract-suggestion-ids.ts` の OpenUI Lang 正規表現パース（§8.3 実現手段の範囲内だが未仕様・脆弱）、weather-routes の汎用エラーメッセージ化。いずれも許容範囲。

### 適合確認済み（主要点）

§4 スキーマ/マイグレーション additive・dueDate/location の optional 追加・sortOrder 非露出 ✓ / §5 レイアウト+ルール改定+WMO 表+TaggedError ✓ / §6.1 3 アダプタ+toolProvider+read-only フラグ ✓ / §6.2 全体再採番・db.batch による原子適用・未知/重複 id 事前検証・policy `{mutates:true, needsApproval:true}` ✓ / §6.3 `stepCountIs(5)` ✓ / §8.2 二面適用（onAction→reorder_tasks / AlertDialog→Eden 直）✓ / §8.3 両ページ配置・専用エンドポイントなし ✓ / §11 座標・日付範囲の Zod 検証 ✓

---

## Security（セキュリティ軸）

CRITICAL / HIGH: **なし**。

### 指摘事項

**MEDIUM-1: レート制限キーが偽装可能ヘッダ依存 — `src/routes/api/chat.ts:40-44`**
`clientKey` は `x-forwarded-for` / `x-real-ip` のみ参照。信頼できるプロキシ前提がない直接公開 Node サーバーでは、攻撃者が XFF を毎回変えるだけで 20req/分制限（wallet-DoS 対策と明記）を無制限に回避でき、加えてインメモリ limiter のバケットが無限増殖しメモリも膨らむ。修正: ソケットアドレス基準にするか、IP 別制限に加えグローバル総量上限を併設。

**MEDIUM-2: `orderedIds` に上限なし — `src/features/tasks/api/task-model.ts:220-222`**
`ReorderTasksSchema` は `z.array(z.string().min(1)).min(1)` のみで `.max()` も id 長上限もない。Web MCP 外部エージェント/直接 POST が数万要素を送ると `inArray`（SQLite 変数上限 ~32766）や `db.batch` の N ステートメントで 500/DoS。修正: `.max(100)` 程度と `z.string().min(1).max(64)` を追加。

**LOW-1: 外部 API レスポンス未検証のまま URL 補間 — `src/features/weather/api/weather-service.ts:77,92,99`**
geocoding/forecast レスポンスを `as` キャストのみで使用し、geocode 由来の `latitude/longitude` を無検証でテンプレートリテラル補間（ホスト固定なので SSRF ピボット不可、クエリ汚染止まり）。security.md の境界検証方針に反する。修正: レスポンスを Zod parse（数値・範囲）し、URL は `URLSearchParams` で構築。

**LOW-2: reorder 承認 UI が対象 id を提示しない — `src/features/tasks/utils/tool-approval-summary.ts:73-76` / `weather-suggestion-panel.tsx:105-110` / `extract-suggestion-ids.ts:12-14`**
承認カードは「N件のタスク」、AlertDialog も件数すら出さず、適用される id 列（LLM 生成、表示タイトルと一致する保証なし）をユーザーは確認できない。未知/重複 id はサーバーで原子的に拒否され sortOrder のみの非破壊操作なので実害は小さいが、承認内容と実対象の一致という HITL 原則が弱い。修正: 確認文言に対象タスクのタイトル順序を列挙（collection で id→title 解決）。

### 合格リスト

- get_weather 二重検証: `get-weather.ts:35` の Zod parse + `weather-routes.ts:27` の body スキーマ、AI SDK 側も `inputSchema` で検証 — 合格
- 日付 today..+7d refine・緯度±90/経度±180 境界: `weather-schema.ts:7-25` — 合格
- reorder_tasks 二重検証: `reorder-tasks.ts:16` parse + `task-routes.ts:145` body — 合格
- reorder_tasks の needsApproval:true は defs 単一ポリシー由来（`defs/index.ts:21`）、Web MCP は `isMutatingTool`（未知名 default true）による全 mutation elicitation ゲートで destructive フラグ非依存（`web-mcp.ts:50-59`）— 合格
- パネル適用はダイアログ確定 `handleConfirmApply` 経由のみで、ゲートなし mutation 経路は不検出 — 合格
- toolProvider は list_tasks / get_weather の read のみ（両 `tool-provider.ts`）— 合格
- SSRF/injection: city は `encodeURIComponent`、raw SQL なし（`sql.raw(" ")` は静的区切り、LIKE は `like-search.ts` でエスケープ）— 合格
- XSS: `dangerouslySetInnerHTML` ゼロ、title/reason/天気ラベルは React エスケープのみ — 合格
- Secrets: 新規キーなし、変更コードに `process.env`/`VITE_` の露出なし — 合格
- エラー漏洩: 両ルートとも汎用メッセージのみ返し詳細は `console.error`、Error/cause の wire 直列化なし — 合格
- chat body: 薄い Zod + `validateUIMessages`、位置情報はメッセージ本文埋め込みで余剰フィールド注入経路なし（Zod strip）— 合格
- プロンプト注入: board state は JSON+「データであり指示ではない」ガード付き（`chat.ts:80-88`）、承認なし mutation は additive の add 系のみ（設計上許容）— 合格
- reorder 整合性: 事前存在チェック＋長さ比較で未知/重複 id を全拒否、`db.batch` で原子的適用（`task-service.ts:284-320`）— 合格

---

## サマリ

| 軸        | 件数                                   | 最重要                                                                    |
| --------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Standards | 違反 2 + スメル 6 + React 5            | weather→chat/tasks の feature 間 import 違反（tasks⇄weather 循環）        |
| Spec      | HIGH 3 / MEDIUM 4 / LOW 2              | §8.5 現在日付のシステムプロンプト埋め込み欠落（日付解決が原理的に不安定） |
| Security  | MEDIUM 2 / LOW 2（CRITICAL/HIGH なし） | `orderedIds` 上限なし（1 行修正で DoS 面を閉じられる）                    |

軸間の優先順位付けは意図的にしていない（各軸独立レビューの原則）。ただし相互関連として: Standards-1（配置違反）を直すと Standards-3（重複コード）が同時に解消し、Spec-4（DatePicker 未配線）を実装すると Standards-6/9（投機的 UI・stale state）の判断が変わる。
