# KIFU HUB — CLAUDE.md

このリポジトリはローカルで動作する将棋棋譜管理の小さなWEB APIとフロントエンドを含みます。
このファイルは、Claude（または類似の補助AI）に説明するための簡潔な概要・操作方法・変更点メモです。

## Conversation Guidelines
常に日本語で返答してください。
すべての応答、説明、コメントは日本語で行ってください。

---

## 概要
- サーバー: `KifuServer.java`（組み込みHttpServer、Java 17+）
- フロントエンド: `wwwroot/` 配下の静的ファイル
- 棋譜データ保存: `kifu_data.json`（ローカルファイル、JSON配列）
- 練習カレンダーデータ: ブラウザの `localStorage`（`kifuHub_practice` キー）
- ユーザー設定: ブラウザの `localStorage`（`kifuHub_accountName` キー）
- KIFアップロード先: `C:\kifu\`（起動時に自動作成）

## 画面構成
| ファイル | URL | 役割 |
|---|---|---|
| `index.html` | `/` | 棋譜登録・編集フォーム＋直近の記録カード一覧 |
| `list.html` | `/list.html` | 棋譜一覧テーブル（検索・絞り込み・ダウンロード・削除） |
| `analysis.html` | `/analysis.html` | 成績分析（多条件フィルター・各種集計テーブル） |
| `calendar.html` | `/calendar.html` | 詰将棋・次の一手の練習カレンダー（月次集計付き） |
| `settings.html` | `/settings.html` | ユーザー設定（アカウント名など） |

## APIエンドポイント（サーバー側 / KifuServer.java）
| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/kifu` | 全棋譜をJSON配列で返す |
| POST | `/api/kifu` | 新規棋譜を登録（multipart/form-dataまたはJSON） |
| PUT | `/api/kifu/{id}` | 指定IDの棋譜を更新 |
| DELETE | `/api/kifu/{id}` | 指定IDの棋譜を削除 |
| GET | `/api/kifu/{id}/download` | 指定IDのKIFファイルをダウンロード |

## API フィールド仕様（棋譜）
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| gameType | string | ○ | 対局形式 |
| opponent | string | ○ | 対局相手名 |
| accountName | string | ○ | 自分のアカウント名 |
| result | string | ○ | 勝敗（"勝ち"/"負け"/"持将棋..."） |
| turn | string | ○ | 手番（"先手"/"後手"） |
| myStrategy | string | ○ | 自戦型（自由記述） |
| opponentStrategy | string | ○ | 対戦型（自由記述） |
| endReason | string | ○ | 終局理由 |
| moves | integer | ○ | 手数 |
| badMoveRate | number | - | 悪手率（%） |
| questionableMoveRate | number | - | 疑問手率（%） |
| matchDate | string | - | 対局日（YYYY-MM-DD） |
| comment | string | - | 振り返りコメント（記入済みで「解析済み」扱い） |
| kifFilePath | string | - | サーバー上のKIFファイルパス（自動設定） |

## 主な機能

### 棋譜登録（index.html / app.js）
- KIFファイルアップロードで先手/後手・相手名・手数・対局日などを自動入力
- KIFファイルはShift-JIS/UTF-8の両エンコーディングに対応
- アカウント名は設定画面（localStorage）から自動反映
- KIFファイルが登録済みの棋譜にはダウンロードボタンを表示

### 棋譜一覧（list.html / list.js）
- 対局相手・自戦型・対戦型でリアルタイムテキスト絞り込み
- 「未解析のみ表示」トグルで `comment` が空の棋譜だけを絞り込み
- 各列ヘッダーでソート可能
- KIFファイルが存在する行はダウンロードボタン（緑）を表示

### 成績分析（analysis.html / analysis.js）
- 5つの絞り込みフィルター（複数組み合わせ可能）：表示月・対局形式・手番・自戦型・対戦型
- 対局形式別・自戦型別・対戦型別の勝率テーブル（該当フィルター未選択時のみ表示）
- 終局理由別の割合（バーグラフ付き）

### 練習カレンダー（calendar.html / calendar.js）
- 月単位のカレンダー表示（← / → で月移動、「今月に戻る」ボタン）
- 各日付をクリックして詰将棋・次の一手の問題数を記録（＋／−ステッパー付き）
- 月次集計：詰将棋総数・次の一手総数・記録日数・1日平均（合計）
- データはブラウザの `localStorage` に保存（`kifuHub_practice` キー）

### 設定（settings.html / settings.js）
- アカウント名を設定・保存（`localStorage` の `kifuHub_accountName` キーに保存）
- 保存した名前は棋譜登録フォームのデフォルト値として自動反映
- KIFファイル読み込み時の先手/後手判定にも使用

## 実行方法（ローカル）
```bash
javac KifuServer.java
java KifuServer
```
ブラウザで `http://localhost:8080/` を開いて操作。

## ファイル構成
```
kifu/
├── KifuServer.java                   # サーバー本体（コンパイル・実行対象）
├── kifu_data.json                    # 対局データ（自動生成）
├── CLAUDE.md                         # このファイル
├── README.md                         # プロジェクト説明
└── wwwroot/
    ├── index.html / app.js           # 棋譜登録画面
    ├── list.html / list.js           # 棋譜一覧画面
    ├── analysis.html / analysis.js   # 成績分析画面
    ├── calendar.html / calendar.js   # 練習カレンダー画面
    ├── settings.html / settings.js   # 設定画面
    └── style.css                     # 和風デザイン共通スタイル
```

## 注意点
- JSONパーサは正規表現による簡易実装。フィールド値に `"` や改行が含まれると誤動作する可能性あり
- KIFダウンロードはサーバー上の `C:\kifu\` 配下のファイルのみ提供（パストラバーサル対策済み）
- `kifu_data.json` はsynchronizedブロックで排他制御しているが、高負荷時はDB移行を推奨
- 練習カレンダー・設定データはブラウザのlocalStorageに保存されるため、ブラウザデータ削除で消える点に注意
