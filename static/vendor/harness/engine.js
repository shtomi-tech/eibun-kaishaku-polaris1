// AUTO-GENERATED from dev/harness@0.1.0 (engine.js) — DO NOT EDIT. Run scripts/sync.mjs.
"use strict";
/* ============================================================
   harness/engine.js — 学習エンジン（描画非依存の純粋な状態層）
   「単元(unit) × モード(mode) × 4択」を回し、判定・進捗・復習を管理する。
   DOM は持たない。描画は各アプリが engine の状態を読んで行う。
   由来: eiken2-q1 と 英文法v2 の共通骨格。契約は SCHEMA.md 参照。
   ============================================================ */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * createEngine
 * @param {object} config  HARNESS_CONFIG（modes / clear / review / …）
 * @param {object} deps
 *   deps.store    createStore(...) のインスタンス
 *   deps.units    Unit[]（SCHEMA §1）
 */
function createEngine(config, { store, units }) {
  const modes = config.modes || [];
  const reviewLadder = (config.review && config.review.ladder) || null;
  const unitById = new Map(units.map((u) => [u.id, u]));

  function questionsFor(unitId, mode) {
    const u = unitById.get(unitId);
    return (u && u.modes && u.modes[mode]) || [];
  }

  function unresolved(unitId, mode) {
    const done = new Set(store.modeState(unitId, mode).correctIds);
    return questionsFor(unitId, mode).filter((q) => !done.has(q.id));
  }

  // モードのクリア判定。config.clear[mode].type で切替。既定 allCorrect。
  function isModeCleared(unitId, mode) {
    const rule = (config.clear && config.clear[mode]) || { type: "allCorrect" };
    const total = questionsFor(unitId, mode).length;
    if (total === 0) return false;
    const correct = new Set(store.modeState(unitId, mode).correctIds).size;
    if (rule.type === "count") return correct >= (rule.need || total);
    return correct >= total; // allCorrect
  }

  function isUnitComplete(unitId) {
    return modes.every((m) => isModeCleared(unitId, m));
  }

  // 未正解プールから1問。空なら null（＝そのモードは正解し切っている）。
  function pickNext(unitId, mode) {
    const pool = shuffle(unresolved(unitId, mode));
    return pool.length ? pool[0] : null;
  }

  /**
   * answer — 1問の解答を処理。
   * @returns {object} { correct, answer, rationale, modeCleared, unitComplete }
   */
  function answer(unitId, mode, qId, choice) {
    const q = questionsFor(unitId, mode).find((x) => x.id === qId);
    if (!q) throw new Error(`unknown question: ${unitId}/${mode}/${qId}`);
    const correct = choice === q.answer;
    const wasCleared = store.modeState(unitId, mode).cleared;

    if (correct) store.markCorrect(unitId, mode, qId);
    else store.markWrong(unitId, mode, qId);

    const nowCleared = isModeCleared(unitId, mode);
    store.modeState(unitId, mode).cleared = nowCleared;
    // 新規クリアの瞬間に Leitner を進める（設定があれば）
    if (nowCleared && !wasCleared && reviewLadder) {
      store.scheduleReview(unitId, mode, reviewLadder);
    }
    store.save();

    return {
      correct,
      answer: q.answer,
      rationale: q.rationale || {},
      modeCleared: nowCleared,
      unitComplete: isUnitComplete(unitId),
    };
  }

  // 復習期日が来た単元ID（★eiken2 にも効く新機能）
  function reviewDue(now = Date.now()) {
    const due = [];
    for (const u of units) {
      if (modes.some((m) => store.isDue(u.id, m, now))) due.push(u.id);
    }
    return due;
  }

  function progressOf(unitId, mode) {
    const total = questionsFor(unitId, mode).length;
    const correct = new Set(store.modeState(unitId, mode).correctIds).size;
    return { total, correct, remaining: Math.max(total - correct, 0) };
  }

  return {
    units,
    questionsFor,
    pickNext,
    answer,
    isModeCleared,
    isUnitComplete,
    reviewDue,
    progressOf,
  };
}

if (typeof module !== "undefined") module.exports = { createEngine, shuffle };
