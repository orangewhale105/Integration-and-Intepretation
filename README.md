# 統合と解釈

理学療法学科の学生が、単一検査結果の解釈（画面1）と、ICIDH による統合と解釈（画面2）を行う Web アプリ（PWA）です。

- 仕様：[spec.md](spec.md)
- 将来の構想：[roadmap.md](roadmap.md)
- 開発の方針：[CLAUDE.md](CLAUDE.md)

インターネットに接続していなくても動きます。入力したデータは端末内（ブラウザ）と、書き出した JSON ファイルにだけ保存し、サーバーには送りません。

## 開発

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`main` ブランチに push すると、GitHub Actions がビルドして GitHub Pages に公開します（リポジトリの Settings → Pages で Source を「GitHub Actions」にしておく必要があります）。

## ファイル構成

| 場所 | 内容 |
|---|---|
| `src/model/` | データ構造（カード、ICIDH）と入力不備の判定 |
| `src/storage/` | 保存・読込・書き出しをまとめた場所（将来のスタンドアロン化ではここを差し替える） |
| `src/store.ts` | 開いているケースの状態と自動保存 |
| `src/ui/screen1/` | 画面1「単一検査結果の解釈」（カード一覧と診断名） |
| `src/ui/screen2/` | 画面2「統合と解釈」（ICIDH） |
| `src/ui/common/` | 右クリック／長押しメニュー、ドラッグ＆ドロップなどの共通部品 |
| `src/print/` | A4 横の印刷 |
| `sw/` | オフライン用の Service Worker（ビルド時にファイル一覧を埋め込む） |
| `tests/` | テスト |
