// AUTO-GENERATED from dev/harness@0.1.0 (store.js) — DO NOT EDIT. Run scripts/sync.mjs.
"use strict";
/* ============================================================
   harness/store.js — 進捗の永続化（localStorage）＋ Leitner 間隔反復
   純粋な状態層。DOM も fetch も持たない。
   由来: eiken2-q1 loadProgress/saveProgress/unit ＋ v2 stateFor/scheduleReview
   ============================================================ */

function defaultModeState() {
  return {
    correctIds: [],
    cleared: false,
    wrongQueue: [],
    reviewStage: 0,
    nextReviewAt: null,
  };
}

/**
 * createStore — 単元(unit) × モード(mode) 単位の進捗を保持。
 * @param {object} opts
 *   opts.appId     アプリID（localStorage キーの名前空間）
 *   opts.modes     モード名の配列
 *   opts.onChange  保存が走ったときのフック（cloud への queueSave など）
 */
function createStore({ appId, modes, onChange = () => {} }) {
  const KEY = `harness.${appId}.progress`;
  let data = {}; // { [unitId]: { [mode]: ModeState } }

  function normalizeMode(m) {
    const s = { ...defaultModeState(), ...(m || {}) };
    if (!Array.isArray(s.correctIds)) s.correctIds = [];
    if (!Array.isArray(s.wrongQueue)) s.wrongQueue = [];
    if (typeof s.cleared !== "boolean") s.cleared = false;
    if (typeof s.reviewStage !== "number") s.reviewStage = 0;
    return s;
  }

  function unitState(unitId) {
    if (!data[unitId]) data[unitId] = {};
    const u = data[unitId];
    for (const mode of modes) u[mode] = normalizeMode(u[mode]);
    return u;
  }
  function modeState(unitId, mode) {
    return unitState(unitId)[mode];
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = {};
    }
    return data;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore quota errors */
    }
    onChange(data);
  }

  function markCorrect(unitId, mode, qId) {
    const s = modeState(unitId, mode);
    if (!s.correctIds.includes(qId)) s.correctIds.push(qId);
    s.wrongQueue = s.wrongQueue.filter((id) => id !== qId);
  }
  function markWrong(unitId, mode, qId) {
    const s = modeState(unitId, mode);
    if (!s.wrongQueue.includes(qId)) s.wrongQueue.push(qId);
  }

  // Leitner: クリア時に次回復習日を進める（ladder 日数、既定 [1,3,7,14]）
  function scheduleReview(unitId, mode, ladder = [1, 3, 7, 14]) {
    const s = modeState(unitId, mode);
    const stage = Math.min(s.reviewStage || 0, ladder.length - 1);
    const next = new Date();
    next.setDate(next.getDate() + ladder[stage]);
    s.nextReviewAt = next.toISOString();
    s.reviewStage = Math.min(stage + 1, ladder.length - 1);
  }
  function isDue(unitId, mode, now = Date.now()) {
    const s = modeState(unitId, mode);
    return Boolean(s.nextReviewAt) && new Date(s.nextReviewAt).getTime() <= now;
  }

  function resetMode(unitId, mode) {
    data[unitId] && (data[unitId][mode] = defaultModeState());
  }
  function resetAll() {
    data = {};
  }

  // クラウド load 時に丸ごと差し替える用（app_load_progress の戻り）
  function replace(next) {
    data = next && typeof next === "object" ? next : {};
  }
  function snapshot() {
    return data;
  }

  return {
    load, save, snapshot, replace, resetAll, resetMode,
    unitState, modeState,
    markCorrect, markWrong,
    scheduleReview, isDue,
  };
}

if (typeof module !== "undefined") module.exports = { createStore, defaultModeState };
