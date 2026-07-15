import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// デプロイ時に環境変数（Secrets）から static/config.json を生成する。
// config.json は gitignore 済み。ローカル/未設定時は空値＝クラウド無効＝匿名ローカル動作。
const configPath = resolve("static/config.json");
const config = {
  appBaseUrl: process.env.APP_BASE_URL || process.env.URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
};

mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Wrote ${configPath}`);
