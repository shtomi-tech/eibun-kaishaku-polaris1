# 英文解釈ポラリス1 自学トレーナー

ローカル使用向けの静的HTMLアプリです。

公開版: https://shtomi-tech.github.io/eibun-kaishaku-polaris1/

## 起動

```powershell
cd "C:\Users\shtom\dev\eibun-kaishaku-polaris1"
py -3 -m http.server 8099 --bind 127.0.0.1
```

その後、`http://127.0.0.1:8099/` を開きます。

## 学習フロー

1. 解釈
2. 比較
3. 解説
4. 宿題でポラリス本編の同じテーマを学習

## 教材追加

このアプリは授業内の導入用です。ポラリスのテーマ・狙いを参考にしつつ、英文・和訳・解説はオリジナルで作成します。
授業後、生徒は宿題としてポラリス本編の同じテーマを学習します。
先生画面でJSONを編集し、教材JSONをダウンロードします。
ダウンロードした内容を `data/polaris1.json` に反映すると、次回読み込み時に学習画面へ出ます。
