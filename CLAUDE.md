# KIFU HUB — CLAUDE.md

このリポジトリはローカルで動作する将棋棋譜管理の小さなWEB APIとフロントエンドを含みます。
このファイルは、Claude（または類似の補助AI）に説明するための簡潔な概要・操作方法・変更点メモです。

## Conversation Guidelines
常に日本語で返答してください。
すべての応答、説明、コメントは日本語で行ってください。

---

## 概要
- サーバー: `KifuServer.java`（組み込みHttpServer）
- フロントエンド: `wwwroot/` 配下の静的ファイル（`index.html`, `list.html`, `app.js`, `list.js`, `style.css`）
- データ保存: `kifu_data.json`（ローカルファイル、JSON配列）
- エンドポイント:
  - `GET /api/kifu` - 登録済み棋譜のJSON一覧を返す
  - `POST /api/kifu` - 棋譜をJSONで受け取り保存する

## 目的（今回の変更点）
- UIを「和風テイスト」に変更済み（色・フォント・テクスチャ等）: `wwwroot/style.css` に反映
- 自戦型 (`myStrategy`) と 対戦型 (`opponentStrategy`) を「選択」ではなく「テキスト入力形式」に変更済み（`wwwroot/index.html`のフォームと`wwwroot/app.js`の処理で対応）
- バックエンドはこれらのフィールドを受け取り保存するように既に実装済み（`KifuServer.java`）

## API フィールド仕様
- gameType: string
- opponent: string
- result: string (例: "勝ち", "負け", "持将棋 ...")
- turn: string ("先手" / "後手")
- myStrategy: string (自分の戦型/戦術を自由記述)
- opponentStrategy: string (相手の戦型/戦術を自由記述)
- endReason: string
- moves: integer
- badMoveRate: number (小数可)
- questionableMoveRate: number (小数可)

例 POST ペイロード:
{
  "gameType": "10分切れ負け",
  "opponent": "山田太郎",
  "result": "勝ち",
  "turn": "先手",
  "myStrategy": "四間飛車藤井システム",
  "opponentStrategy": "居飛車穴熊",
  "endReason": "投了",
  "moves": 115,
  "badMoveRate": 5.2,
  "questionableMoveRate": 8.5
}

## 実行方法（ローカル）
1. Java 17+ がインストールされていることを確認
2. コンパイル・実行:

```bash
javac KifuServer.java
java KifuServer
```
3. ブラウザで `http://localhost:8080/` を開いて操作

## 変更箇所（参照）
- フロントエンド: [wwwroot/index.html](wwwroot/index.html), [wwwroot/style.css](wwwroot/style.css), [wwwroot/app.js](wwwroot/app.js), [wwwroot/list.html](wwwroot/list.html), [wwwroot/list.js](wwwroot/list.js)
- バックエンド: [KifuServer.java](KifuServer.java)
- データ: [kifu_data.json](kifu_data.json)

## 注意点 / 推奨改善
- 現在のJSONパーサは簡易実装（正規表現）です。将来的にはJacksonやGsonなどのJSONライブラリ導入を推奨します。
- 入力値のサニタイズや詳細なバリデーションをサーバー側で強化すると安全性が向上します。
- `kifu_data.json` は同期的にファイル書き込みしています。高負荷時はロック設計やDB移行を検討してください。

---

必要であれば、この `CLAUDE.md` を英語版に翻訳したり、より詳しいAPI仕様（OpenAPI/Swagger）を生成することができます。どの出力が欲しいですか？
