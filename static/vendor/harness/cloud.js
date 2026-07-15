// AUTO-GENERATED from dev/harness@0.1.0 (cloud.js) — DO NOT EDIT. Run scripts/sync.mjs.
"use strict";
/* ============================================================
   harness/cloud.js — 生徒別クラウド同期（共通スキーマ app_students / app_progress）
   共有URL ?s=<id>&t=<token> があり config.json が揃うときだけ有効。
   無ければ完全に no-op ＝ 従来の匿名ローカル動作（無回帰保証）。
   由来: eiken2-q1 の startSharedSession/pushSharedProgress/queueSharedSave を APP 非依存に一般化。
   ============================================================ */

async function loadOptionalJson(path) {
  try {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) return {};
    return await r.json();
  } catch (e) {
    return {};
  }
}

function normalizeConfig(raw = {}) {
  const supabase = raw.supabase || {};
  return {
    appBaseUrl: String(raw.appBaseUrl || "").trim(),
    supabaseUrl: String(raw.supabaseUrl || supabase.url || "").trim().replace(/\/+$/, ""),
    supabaseAnonKey: String(raw.supabaseAnonKey || supabase.anonKey || "").trim(),
  };
}

function parseSharedParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    studentId: p.get("s") || p.get("student") || "",
    token: p.get("t") || p.get("token") || "",
  };
}

/**
 * createCloud — クラウド同期層。
 * @param {object} opts
 *   opts.appId          app_progress.p_app に入れる値（= config.APP_ID）
 *   opts.configPath     config.json の場所（既定 "static/config.json"）
 *   opts.getPayload     () => 保存する progress オブジェクト（store.snapshot 等）
 *   opts.applyLoaded    (progress) => クラウドから来た進捗を適用（store.replace 等）
 *   opts.onStatus       (message, tone) => UI 通知（省略可）
 */
function createCloud({ appId, configPath = "static/config.json", getPayload, applyLoaded, onStatus = () => {} }) {
  let cfg = {};
  const session = { requested: false, enabled: false, studentId: "", token: "", student: null };
  let saveTimer = null;
  let saveQueue = Promise.resolve();

  function hasConfig() {
    return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  async function rpc(name, payload) {
    if (!hasConfig()) throw new Error("Supabase設定が未完了です。");
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${name}: ${res.status} ${text || res.statusText}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // 起動時: config 読み込み → 共有URLがあれば auth→load。enabled になったら返す。
  async function init() {
    cfg = normalizeConfig(await loadOptionalJson(configPath));
    const shared = parseSharedParams();
    session.studentId = shared.studentId;
    session.token = shared.token;
    session.requested = Boolean(shared.studentId || shared.token);
    if (!session.requested) return session;

    if (!hasConfig()) {
      onStatus("共有URLですが、クラウド設定が未完了です。先生に連絡してください。", "ng");
      return session;
    }
    try {
      const authRows = await rpc("app_auth_student", {
        p_student_id: session.studentId,
        p_access_token: session.token,
      });
      const student = Array.isArray(authRows) ? authRows[0] : authRows;
      if (!student || !student.id) {
        throw new Error("生徒URLを確認できませんでした。QRコードを作り直してください。");
      }
      session.enabled = true;
      session.student = { id: String(student.id), name: String(student.display_name || student.id) };

      const loaded = await rpc("app_load_progress", {
        p_app: appId,
        p_student_id: session.studentId,
        p_access_token: session.token,
      });
      const row = Array.isArray(loaded) ? loaded[0] : loaded;
      const progress = row && typeof row === "object" ? row.progress || row : {};
      if (progress && typeof progress === "object") applyLoaded(progress);
      onStatus(`${session.student.name} さんとして学習中（進捗はクラウド保存）`, "ok");
    } catch (e) {
      console.error(e);
      onStatus(e.message || "共有URLの読み込みに失敗しました。", "ng");
    }
    return session;
  }

  async function push() {
    await rpc("app_save_progress", {
      p_app: appId,
      p_student_id: session.studentId,
      p_access_token: session.token,
      p_progress: getPayload(),
    });
  }

  // 保存はデバウンス（600ms）。直列キューで順序を保証。
  function queueSave() {
    if (!session.enabled) return;
    onStatus(`${session.student.name} さんの進捗を保存中…`, "syncing");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveQueue = saveQueue
        .then(() => push())
        .then(() => onStatus(`${session.student.name} さんの進捗を保存しました。`, "ok"))
        .catch((e) => {
          console.error(e);
          onStatus("進捗のクラウド保存に失敗しました。通信状況を確認してください。", "ng");
        });
    }, 600);
  }

  return { init, queueSave, isEnabled: () => session.enabled, getSession: () => session };
}

if (typeof module !== "undefined") {
  module.exports = { createCloud, normalizeConfig, parseSharedParams, loadOptionalJson };
}
