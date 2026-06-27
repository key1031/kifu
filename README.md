# 棋譜帳 KIFU HUB

将棋の対局結果をローカルで記録・管理・分析するための軽量 Web アプリケーションです。

## 概要

外部サービスや複雑なセットアップ不要で、Java 標準ライブラリのみで動作します。対局データは `kifu_data.json` にローカル保存され、KIF ファイルのアップロードにも対応しています。

## スクリーンショット（画面構成）

| 画面 | URL | 説明 |
|------|-----|------|
| 棋譜登録 | `/` | 対局データの入力・編集フォーム |
| 棋譜一覧 | `/list.html` | 登録済み棋譜のテーブル表示・絞り込み・削除 |
| 成績分析 | `/analysis.html` | 勝率・対局形式別・対戦型別・月別集計 |

## 必要環境

- Java 17 以上

## セットアップと起動

```bash
# コンパイル
javac KifuServer.java

# 起動
java KifuServer
```

ブラウザで `http://localhost:8080/` を開いてください。

起動時に以下が自動作成されます。
- `kifu_data.json` — データファイル（存在しない場合のみ）
- `C:\kifu\` — KIF ファイルのアップロード先ディレクトリ

## 機能一覧

### 棋譜登録（index.html）
- 対局形式・相手・アカウント名・対局日・勝敗・手番を記録
- 自戦型・対戦型をテキスト自由入力
- 終局理由・手数・悪手率・疑問手率を入力
- KIF ファイルのアップロード（`C:\kifu\` に保存）
- 振り返りコメントの記録
- 既存レコードの編集

### 棋譜一覧（list.html）
- 全棋譜をテーブル形式で表示
- 対局相手・自戦型・対戦型でリアルタイム絞り込み
- 各列ヘッダーでソート
- 対局の編集・削除操作

### 成績分析（analysis.html）
- 総対局数・勝数・負数・総合勝率の集計
- 対局形式別勝率
- 対戦型別勝率
- 月別勝率

## API 仕様

ベースURL: `http://localhost:8080`

### GET /api/kifu

登録済みの全棋譜を JSON 配列で返します。

```http
GET /api/kifu
```

**レスポンス例:**
```json
[
  {
    "id": 1,
    "gameType": "10分切れ負け",
    "opponent": "山田太郎",
    "accountName": "Dok46",
    "result": "勝ち",
    "turn": "先手",
    "myStrategy": "四間飛車藤井システム",
    "opponentStrategy": "居飛車穴熊",
    "endReason": "投了",
    "moves": 115,
    "badMoveRate": 5.20,
    "questionableMoveRate": 8.50,
    "matchDate": "2026-06-27",
    "comment": "序盤で優位を築けた",
    "kifFilePath": "C:\\kifu\\kifu_1_..."
  }
]
```

### POST /api/kifu

新規棋譜を登録します。`multipart/form-data`（KIFファイル付き）と `application/json` の両形式に対応します。

**必須フィールド:** `gameType`, `opponent`, `accountName`, `result`, `turn`, `myStrategy`, `opponentStrategy`, `endReason`, `moves`

**任意フィールド:** `badMoveRate`, `questionableMoveRate`, `comment`, `matchDate`, `kifFile`

### PUT /api/kifu/{id}

指定 ID の棋譜を更新します。

### DELETE /api/kifu/{id}

指定 ID の棋譜を削除します。

## フィールド仕様

| フィールド | 型 | 説明 | 例 |
|-----------|-----|------|-----|
| gameType | string | 対局形式 | `"10分切れ負け"` |
| opponent | string | 対局相手名 | `"山田太郎"` |
| accountName | string | 自分のアカウント名 | `"Dok46"` |
| result | string | 勝敗 | `"勝ち"` / `"負け"` / `"持将棋 / 千日手 / 引き分け"` |
| turn | string | 手番 | `"先手"` / `"後手"` |
| myStrategy | string | 自分の戦型（自由記述） | `"四間飛車藤井システム"` |
| opponentStrategy | string | 相手の戦型（自由記述） | `"居飛車穴熊"` |
| endReason | string | 終局理由 | `"投了"` / `"時間切れ"` / `"詰み"` など |
| moves | integer | 手数 | `115` |
| badMoveRate | number | 悪手率（%、省略可） | `5.2` |
| questionableMoveRate | number | 疑問手率（%、省略可） | `8.5` |
| matchDate | string | 対局日（省略可） | `"2026-06-27"` |
| comment | string | 振り返りコメント（省略可） | `"序盤で優位を築けた"` |

## ファイル構成

```
kifu/
├── KifuServer.java       # サーバー本体（コンパイル・実行対象）
├── kifu_data.json        # 対局データ（自動生成）
├── CLAUDE.md             # AIアシスタント向け説明ファイル
└── wwwroot/              # 静的フロントエンドファイル
    ├── index.html        # 棋譜登録画面
    ├── list.html         # 棋譜一覧画面
    ├── analysis.html     # 成績分析画面
    ├── app.js            # 棋譜登録画面のロジック
    ├── list.js           # 棋譜一覧画面のロジック
    ├── analysis.js       # 成績分析画面のロジック
    └── style.css         # 和風テイストのスタイル
```

## 技術的な注意点

- **JSONパーサ**: 正規表現による簡易実装です。フィールド値に `"` や改行が含まれる場合は正しくパースできない場合があります。本格運用には Jackson / Gson などのライブラリ導入を推奨します。
- **ファイル書き込み**: `synchronized` ブロックで排他制御していますが、高負荷環境での利用には DB 移行を検討してください。
- **KIFアップロード先**: `C:\kifu\` に固定されています。変更する場合は `KifuServer.java` の `UPLOAD_DIR` 定数を編集してください。

## ライセンス

個人・社内利用を想定した小規模プロジェクトです。
