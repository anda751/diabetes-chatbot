function buildWhereClause(conditions = []) {
  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

function toCsvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const headerLine = headers.map((header) => toCsvCell(header.label)).join(",");
  const bodyLines = rows.map((row) =>
    headers.map((header) => toCsvCell(row[header.key])).join(",")
  );
  return [headerLine, ...bodyLines].join("\n");
}

function buildDateConditions(columnName, range) {
  const conditions = [];
  const params = [];

  if (range.startDate) {
    conditions.push(`${columnName} >= ?::date`);
    params.push(range.startDate);
  }

  if (range.endDate) {
    conditions.push(`${columnName} < (?::date + INTERVAL '1 day')`);
    params.push(range.endDate);
  }

  return { conditions, params };
}

function buildSearchCondition(columns = [], keyword = "") {
  const searchText = String(keyword || "").trim();
  if (!searchText || !columns.length) {
    return { clause: "", params: [] };
  }

  const pattern = `%${searchText}%`;
  const clause = `(${columns.map((column) => `${column}::text ILIKE ?`).join(" OR ")})`;
  const params = columns.map(() => pattern);
  return { clause, params };
}

const EVALUATION_INTENT_ORDER = [
  "general",
  "greeting",
  "food",
  "glucose",
  "symptom",
  "exercise",
  "medicine",
  "report",
];

function normalizeEvaluationIntent(rawIntent) {
  const intent = String(rawIntent || "").trim().toLowerCase();
  return EVALUATION_INTENT_ORDER.includes(intent) ? intent : "general";
}

function collectEvaluationLabels(rows = []) {
  const labelSet = new Set(EVALUATION_INTENT_ORDER);
  for (const row of rows) {
    labelSet.add(normalizeEvaluationIntent(row.predictedIntentKey));
    labelSet.add(normalizeEvaluationIntent(row.actualIntentKey));
  }
  return [...labelSet];
}

function buildConfusionMatrix(rows = []) {
  const labels = collectEvaluationLabels(rows);
  const labelIndex = new Map(labels.map((label, index) => [label, index]));
  const matrix = labels.map(() => labels.map(() => 0));

  for (const row of rows) {
    const actualIntent = normalizeEvaluationIntent(row.actualIntentKey);
    const predictedIntent = normalizeEvaluationIntent(row.predictedIntentKey);
    const actualIndex = labelIndex.get(actualIntent);
    const predictedIndex = labelIndex.get(predictedIntent);
    if (actualIndex == null || predictedIndex == null) continue;
    matrix[actualIndex][predictedIndex] += 1;
  }

  const perClass = labels.map((label, rowIndex) => {
    const tp = matrix[rowIndex][rowIndex];
    const fn = matrix[rowIndex].reduce((sum, value, columnIndex) => (columnIndex === rowIndex ? sum : sum + value), 0);
    const fp = matrix.reduce((sum, currentRow, currentRowIndex) => (
      currentRowIndex === rowIndex ? sum : sum + currentRow[rowIndex]
    ), 0);
    const support = matrix[rowIndex].reduce((sum, value) => sum + value, 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      intentKey: label,
      support,
      tp,
      fp,
      fn,
      precision,
      recall,
      f1,
    };
  });

  const total = rows.length;
  const correct = matrix.reduce((sum, currentRow, index) => sum + (currentRow[index] || 0), 0);
  const accuracy = total ? correct / total : 0;
  const macroPrecision = perClass.length
    ? perClass.reduce((sum, item) => sum + item.precision, 0) / perClass.length
    : 0;
  const macroRecall = perClass.length
    ? perClass.reduce((sum, item) => sum + item.recall, 0) / perClass.length
    : 0;
  const macroF1 = perClass.length
    ? perClass.reduce((sum, item) => sum + item.f1, 0) / perClass.length
    : 0;

  return {
    labels,
    matrix,
    perClass,
    summary: {
      total,
      correct,
      accuracy,
      macroPrecision,
      macroRecall,
      macroF1,
    },
  };
}

async function getOverviewFromChatLogs(db, range, excludedTexts) {
  const userDateFilter = buildDateConditions("created_at", range);
  const glucoseDateFilter = buildDateConditions("recorded_at", range);
  const chatDateFilter = buildDateConditions("created_at", range);
  const topQuestionConditions = [...chatDateFilter.conditions, "question_text <> ALL(?)"];
  const topQuestionParams = [...chatDateFilter.params, excludedTexts];

  const [userSummary, glucoseSummary, questionSummary, reminderSummary, topIntentRow, topQuestionRow, intentStats, topQuestions] =
    await Promise.all([
      db.get(
        `SELECT COUNT(*)::int AS total_users
         FROM users
         ${buildWhereClause(userDateFilter.conditions)}`,
        userDateFilter.params
      ),
      db.get(
        `SELECT COUNT(*)::int AS total_glucose_records
         FROM glucose_history
         ${buildWhereClause(glucoseDateFilter.conditions)}`,
        glucoseDateFilter.params
      ),
      db.get(
        `SELECT
           COUNT(DISTINCT question_text)::int AS total_question_types,
           COUNT(*)::int AS total_questions
         FROM ai_chat_logs
         ${buildWhereClause(chatDateFilter.conditions)}`,
        chatDateFilter.params
      ),
      db.get(
        "SELECT COUNT(DISTINCT user_id)::int AS active_reminder_users FROM meal_reminders WHERE is_enabled = TRUE"
      ),
      db.get(
        `SELECT intent_key, COUNT(*)::int AS total
         FROM ai_chat_logs
         ${buildWhereClause(chatDateFilter.conditions)}
         GROUP BY intent_key
         ORDER BY total DESC, intent_key ASC
         LIMIT 1`,
        chatDateFilter.params
      ),
      db.get(
        `SELECT question_text, intent_key, COUNT(*)::int AS count, MAX(created_at) AS updated_at
         FROM ai_chat_logs
         ${buildWhereClause(topQuestionConditions)}
         GROUP BY question_text, intent_key
         ORDER BY count DESC, MAX(created_at) DESC, question_text ASC
         LIMIT 1`,
        topQuestionParams
      ),
      db.all(
        `SELECT intent_key, COUNT(*)::int AS count
         FROM ai_chat_logs
         ${buildWhereClause(chatDateFilter.conditions)}
         GROUP BY intent_key
         ORDER BY count DESC, intent_key ASC`,
        chatDateFilter.params
      ),
      db.all(
        `SELECT question_text, intent_key, COUNT(*)::int AS count, MAX(created_at) AS updated_at
         FROM ai_chat_logs
         ${buildWhereClause(topQuestionConditions)}
         GROUP BY question_text, intent_key
         ORDER BY count DESC, updated_at DESC, question_text ASC
         LIMIT 20`,
        topQuestionParams
      ),
    ]);

  return {
    summary: {
      totalUsers: Number(userSummary?.total_users) || 0,
      totalGlucoseRecords: Number(glucoseSummary?.total_glucose_records) || 0,
      totalQuestions: Number(questionSummary?.total_questions) || 0,
      totalQuestionTypes: Number(questionSummary?.total_question_types) || 0,
      activeReminderUsers: Number(reminderSummary?.active_reminder_users) || 0,
      topIntentRow,
      topQuestionRow,
    },
    intentStats,
    topQuestions,
  };
}

export async function getAdminOverview({
  db,
  range,
  excludedTexts,
  getIntentDisplayLabel,
}) {
  const chatOverview = await getOverviewFromChatLogs(db, range, excludedTexts);

  return {
    summary: {
      totalUsers: chatOverview.summary.totalUsers,
      totalGlucoseRecords: chatOverview.summary.totalGlucoseRecords,
      totalQuestions: chatOverview.summary.totalQuestions,
      totalQuestionTypes: chatOverview.summary.totalQuestionTypes,
      activeReminderUsers: chatOverview.summary.activeReminderUsers,
      averageQuestionsPerType: chatOverview.summary.totalQuestionTypes
        ? Math.round(chatOverview.summary.totalQuestions / chatOverview.summary.totalQuestionTypes)
        : 0,
      topCategory: chatOverview.summary.topIntentRow
        ? {
            intentKey: chatOverview.summary.topIntentRow.intent_key,
            label: getIntentDisplayLabel(chatOverview.summary.topIntentRow.intent_key),
            count: Number(chatOverview.summary.topIntentRow.total) || 0,
          }
        : null,
      topQuestion: chatOverview.summary.topQuestionRow
        ? {
            questionText: chatOverview.summary.topQuestionRow.question_text,
            intentKey: chatOverview.summary.topQuestionRow.intent_key,
            label: getIntentDisplayLabel(chatOverview.summary.topQuestionRow.intent_key),
            count: Number(chatOverview.summary.topQuestionRow.count) || 0,
            updatedAt: chatOverview.summary.topQuestionRow.updated_at || null,
          }
        : null,
    },
    intentStats: chatOverview.intentStats.map((item) => ({
      intentKey: item.intent_key,
      label: getIntentDisplayLabel(item.intent_key),
      count: Number(item.count) || 0,
    })),
    topQuestions: chatOverview.topQuestions.map((item) => ({
      questionText: item.question_text,
      intentKey: item.intent_key,
      label: getIntentDisplayLabel(item.intent_key),
      count: Number(item.count) || 0,
      updatedAt: item.updated_at,
    })),
    range,
    updatedAt: new Date().toISOString(),
  };
}

export async function getAdminStats({ db, range, excludedTexts, getIntentDisplayLabel }) {
  const chatDateFilter = buildDateConditions("created_at", range);
  const conditions = [...chatDateFilter.conditions, "question_text <> ALL(?)"];
  const rows = await db.all(
    `SELECT
       question_text,
       intent_key,
       COUNT(*)::int AS count,
       MAX(created_at) AS updated_at
     FROM ai_chat_logs
     ${buildWhereClause(conditions)}
     GROUP BY question_text, intent_key
     ORDER BY count DESC, updated_at DESC, question_text ASC`,
    [...chatDateFilter.params, excludedTexts]
  );

  return rows.map((item) => ({
    questionText: item.question_text,
    intentKey: item.intent_key,
    label: getIntentDisplayLabel(item.intent_key),
    count: Number(item.count) || 0,
    updatedAt: item.updated_at,
  }));
}

export async function getAdminQuality({ db, range, getIntentDisplayLabel }) {
  const chatDateFilter = buildDateConditions("created_at", range);
  const fallbackConditions = [...chatDateFilter.conditions, "used_fallback = TRUE"];

  const [summaryRow, fallbackQuestions, recentFallbacks, modelStats] = await Promise.all([
    db.get(
      `SELECT
         COUNT(*)::int AS total_chats,
         COALESCE(SUM(CASE WHEN used_fallback THEN 1 ELSE 0 END), 0)::int AS fallback_count
       FROM ai_chat_logs
       ${buildWhereClause(chatDateFilter.conditions)}`,
      chatDateFilter.params
    ),
    db.all(
      `SELECT question_text, intent_key, COUNT(*)::int AS count
       FROM ai_chat_logs
       ${buildWhereClause(fallbackConditions)}
       GROUP BY question_text, intent_key
       ORDER BY count DESC, question_text ASC
       LIMIT 12`,
      chatDateFilter.params
    ),
    db.all(
      `SELECT question_text, intent_key, response_model, created_at
       FROM ai_chat_logs
       ${buildWhereClause(fallbackConditions)}
       ORDER BY created_at DESC
       LIMIT 12`,
      chatDateFilter.params
    ),
    db.all(
      `SELECT response_model, COUNT(*)::int AS count
       FROM ai_chat_logs
       ${buildWhereClause(chatDateFilter.conditions)}
       GROUP BY response_model
       ORDER BY count DESC, response_model ASC`,
      chatDateFilter.params
    ),
  ]);

  const totalChats = Number(summaryRow?.total_chats) || 0;
  const fallbackCount = Number(summaryRow?.fallback_count) || 0;

  return {
    summary: {
      totalChats,
      fallbackCount,
      successCount: Math.max(totalChats - fallbackCount, 0),
      fallbackRate: totalChats ? Number(((fallbackCount / totalChats) * 100).toFixed(1)) : 0,
    },
    fallbackQuestions: fallbackQuestions.map((item) => ({
      questionText: item.question_text,
      intentKey: item.intent_key,
      label: getIntentDisplayLabel(item.intent_key),
      count: Number(item.count) || 0,
    })),
    recentFallbacks: recentFallbacks.map((item) => ({
      questionText: item.question_text,
      intentKey: item.intent_key,
      label: getIntentDisplayLabel(item.intent_key),
      responseModel: item.response_model || "fallback",
      createdAt: item.created_at,
    })),
    modelStats: modelStats.map((item) => ({
      model: item.response_model || "unknown",
      count: Number(item.count) || 0,
    })),
    range,
    updatedAt: new Date().toISOString(),
  };
}

export async function getAdminEvaluation({ db, range, search = "", limit = 50, offset = 0, getIntentDisplayLabel }) {
  const chatDateFilter = buildDateConditions("cl.created_at", range);
  const keyword = String(search || "").trim();
  const searchCondition = buildSearchCondition(
    ["u.username", "u.name", "cl.question_text", "cl.intent_key", "ev.actual_intent_key", "cl.response_model"],
    keyword
  );
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const baseConditions = [...chatDateFilter.conditions];
  const baseParams = [...chatDateFilter.params];
  if (searchCondition.clause) {
    baseConditions.push(searchCondition.clause);
    baseParams.push(...searchCondition.params);
  }

  const reviewedRows = await db.all(
    `SELECT
       cl.id,
       cl.user_id,
       u.username,
       u.name,
       cl.question_text,
       cl.intent_key AS predicted_intent_key,
       cl.response_model,
       cl.used_fallback,
       cl.created_at,
       ev.actual_intent_key,
       ev.notes,
       ev.reviewed_at
     FROM ai_chat_logs cl
     LEFT JOIN users u ON u.id = cl.user_id
     INNER JOIN chat_evaluations ev ON ev.chat_log_id = cl.id
     ${buildWhereClause(baseConditions)}
     ORDER BY cl.created_at DESC, cl.id DESC`,
    baseParams
  );

  const queueRows = await db.all(
    `SELECT
       cl.id,
       cl.user_id,
       u.username,
       u.name,
       cl.question_text,
       cl.intent_key AS predicted_intent_key,
       cl.response_model,
       cl.used_fallback,
       cl.created_at,
       ev.actual_intent_key,
       ev.notes,
       ev.reviewed_at
     FROM ai_chat_logs cl
     LEFT JOIN users u ON u.id = cl.user_id
     LEFT JOIN chat_evaluations ev ON ev.chat_log_id = cl.id
     ${buildWhereClause(baseConditions)}
     ORDER BY COALESCE(ev.reviewed_at, cl.created_at) DESC, cl.id DESC
     LIMIT ? OFFSET ?`,
    [...baseParams, safeLimit, safeOffset]
  );

  const matrixData = buildConfusionMatrix(
    reviewedRows.map((item) => ({
      predictedIntentKey: item.predicted_intent_key,
      actualIntentKey: item.actual_intent_key,
    }))
  );

  const reviewQueue = queueRows.map((item) => ({
    id: Number(item.id) || 0,
    userId: Number(item.user_id) || 0,
    username: item.username,
    name: item.name,
    questionText: item.question_text,
    predictedIntentKey: item.predicted_intent_key,
    predictedLabel: getIntentDisplayLabel(item.predicted_intent_key),
    responseModel: item.response_model || "unknown",
    usedFallback: Boolean(item.used_fallback),
    createdAt: item.created_at,
    actualIntentKey: item.actual_intent_key || "",
    actualLabel: item.actual_intent_key ? getIntentDisplayLabel(item.actual_intent_key) : "",
    notes: item.notes || "",
    reviewedAt: item.reviewed_at || null,
    isReviewed: Boolean(item.actual_intent_key),
  }));

  const totalReviewed = matrixData.summary.total;
  const classMetrics = matrixData.perClass.map((item) => ({
    ...item,
    label: getIntentDisplayLabel(item.intentKey),
    precision: Number(item.precision.toFixed(3)),
    recall: Number(item.recall.toFixed(3)),
    f1: Number(item.f1.toFixed(3)),
  }));

  return {
    summary: {
      totalReviewed,
      accuracy: Number(matrixData.summary.accuracy.toFixed(3)),
      macroPrecision: Number(matrixData.summary.macroPrecision.toFixed(3)),
      macroRecall: Number(matrixData.summary.macroRecall.toFixed(3)),
      macroF1: Number(matrixData.summary.macroF1.toFixed(3)),
    },
    labels: matrixData.labels.map((intentKey) => ({
      intentKey,
      label: getIntentDisplayLabel(intentKey),
    })),
    confusionMatrix: {
      labels: matrixData.labels.map((intentKey) => ({
        intentKey,
        label: getIntentDisplayLabel(intentKey),
      })),
      rows: matrixData.labels.map((actualIntentKey, rowIndex) => ({
        actualIntentKey,
        actualLabel: getIntentDisplayLabel(actualIntentKey),
        cells: matrixData.labels.map((predictedIntentKey, columnIndex) => ({
          predictedIntentKey,
          predictedLabel: getIntentDisplayLabel(predictedIntentKey),
          count: matrixData.matrix[rowIndex][columnIndex],
        })),
      })),
    },
    classMetrics,
    reviewQueue,
    range,
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertChatEvaluation({ db, chatLogId, actualIntentKey, notes = "", getIntentDisplayLabel }) {
  const id = Number(chatLogId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("รหัสรายการไม่ถูกต้อง");
  }

  const normalizedIntent = normalizeEvaluationIntent(actualIntentKey);
  const cleanNotes = String(notes || "").trim();

  await db.run(
    `INSERT INTO chat_evaluations (chat_log_id, actual_intent_key, notes, reviewed_at)
     VALUES (?, ?, ?, NOW())
     ON CONFLICT (chat_log_id) DO UPDATE SET
       actual_intent_key = EXCLUDED.actual_intent_key,
       notes = EXCLUDED.notes,
       reviewed_at = NOW()`,
    [id, normalizedIntent, cleanNotes]
  );

  const row = await db.get(
    `SELECT chat_log_id, actual_intent_key, notes, reviewed_at
     FROM chat_evaluations
     WHERE chat_log_id = ?`,
    [id]
  );

  return {
    chatLogId: Number(row?.chat_log_id) || id,
    actualIntentKey: row?.actual_intent_key || normalizedIntent,
    actualLabel: getIntentDisplayLabel
      ? getIntentDisplayLabel(row?.actual_intent_key || normalizedIntent)
      : row?.actual_intent_key || normalizedIntent,
    notes: row?.notes || "",
    reviewedAt: row?.reviewed_at || null,
  };
}

export async function deleteChatEvaluation({ db, chatLogId }) {
  const id = Number(chatLogId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("รหัสรายการไม่ถูกต้อง");
  }

  const result = await db.run("DELETE FROM chat_evaluations WHERE chat_log_id = ?", [id]);
  return Boolean(result?.changes);
}

export async function exportAdminEvaluationCsv({
  db,
  range,
  search = "",
  getIntentDisplayLabel,
}) {
  const data = await getAdminEvaluation({
    db,
    range,
    search,
    limit: 1000,
    offset: 0,
    getIntentDisplayLabel,
  });

  return toCsv(
    [
      { key: "id", label: "id" },
      { key: "username", label: "username" },
      { key: "questionText", label: "question_text" },
      { key: "predictedIntentKey", label: "predicted_intent_key" },
      { key: "predictedLabel", label: "predicted_label" },
      { key: "actualIntentKey", label: "actual_intent_key" },
      { key: "actualLabel", label: "actual_label" },
      { key: "responseModel", label: "response_model" },
      { key: "usedFallback", label: "used_fallback" },
      { key: "reviewedAt", label: "reviewed_at" },
      { key: "notes", label: "notes" },
    ],
    data.reviewQueue.map((item) => ({
      id: item.id,
      username: item.username || "",
      questionText: item.questionText || "",
      predictedIntentKey: item.predictedIntentKey || "",
      predictedLabel: item.predictedLabel || "",
      actualIntentKey: item.actualIntentKey || "",
      actualLabel: item.actualLabel || "",
      responseModel: item.responseModel || "",
      usedFallback: item.usedFallback,
      reviewedAt: item.reviewedAt || "",
      notes: item.notes || "",
    }))
  );
}

export async function exportAdminQuestionsCsv({
  db,
  range,
  excludedTexts,
  getIntentDisplayLabel,
}) {
  const chatDateFilter = buildDateConditions("created_at", range);
  const questionConditions = [...chatDateFilter.conditions, "question_text <> ALL(?)"];
  const rows = await db.all(
    `SELECT
       question_text,
       intent_key,
       COUNT(*)::int AS count,
       MAX(created_at) AS last_seen_at
     FROM ai_chat_logs
     ${buildWhereClause(questionConditions)}
     GROUP BY question_text, intent_key
     ORDER BY count DESC, last_seen_at DESC, question_text ASC`,
    [...chatDateFilter.params, excludedTexts]
  );

  return toCsv(
    [
      { key: "questionText", label: "question_text" },
      { key: "intentKey", label: "intent_key" },
      { key: "intentLabel", label: "intent_label" },
      { key: "count", label: "count" },
      { key: "lastSeenAt", label: "last_seen_at" },
      { key: "startDate", label: "filter_start_date" },
      { key: "endDate", label: "filter_end_date" },
    ],
    rows.map((item) => ({
      questionText: item.question_text,
      intentKey: item.intent_key,
      intentLabel: getIntentDisplayLabel(item.intent_key),
      count: Number(item.count) || 0,
      lastSeenAt: item.last_seen_at,
      startDate: range.startDate || "",
      endDate: range.endDate || "",
    }))
  );
}

export async function exportAdminFallbacksCsv({ db, range, getIntentDisplayLabel }) {
  const chatDateFilter = buildDateConditions("created_at", range);
  const fallbackConditions = [...chatDateFilter.conditions, "used_fallback = TRUE"];
  const rows = await db.all(
    `SELECT
       question_text,
       intent_key,
       response_model,
       created_at
     FROM ai_chat_logs
     ${buildWhereClause(fallbackConditions)}
     ORDER BY created_at DESC`,
    chatDateFilter.params
  );

  return toCsv(
    [
      { key: "questionText", label: "question_text" },
      { key: "intentKey", label: "intent_key" },
      { key: "intentLabel", label: "intent_label" },
      { key: "responseModel", label: "response_model" },
      { key: "createdAt", label: "created_at" },
      { key: "startDate", label: "filter_start_date" },
      { key: "endDate", label: "filter_end_date" },
    ],
    rows.map((item) => ({
      questionText: item.question_text,
      intentKey: item.intent_key,
      intentLabel: getIntentDisplayLabel(item.intent_key),
      responseModel: item.response_model || "fallback",
      createdAt: item.created_at,
      startDate: range.startDate || "",
      endDate: range.endDate || "",
    }))
  );
}

export async function exportAdminKnowledgeCsv({ db }) {
  const rows = await db.all(
    `SELECT id, title, content, intent_key, tags, is_enabled, sort_order, created_at, updated_at
     FROM knowledge_entries
     ORDER BY is_enabled DESC, sort_order DESC, updated_at DESC, id DESC`
  );

  return toCsv(
    [
      { key: "id", label: "id" },
      { key: "title", label: "title" },
      { key: "content", label: "content" },
      { key: "intentKey", label: "intent_key" },
      { key: "tags", label: "tags" },
      { key: "isEnabled", label: "is_enabled" },
      { key: "sortOrder", label: "sort_order" },
      { key: "createdAt", label: "created_at" },
      { key: "updatedAt", label: "updated_at" },
    ],
    rows.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      intentKey: item.intent_key,
      tags: item.tags,
      isEnabled: item.is_enabled,
      sortOrder: item.sort_order,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
  );
}

export async function getAdminUsers({ db, search = "", limit = 50, offset = 0 }) {
  const keyword = String(search || "").trim();
  const searchCondition = buildSearchCondition(["u.username", "u.name", "u.id"], keyword);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [totalRow, rows] = await Promise.all([
    db.get(
      `SELECT COUNT(*)::int AS total
       FROM users u
       ${searchCondition.clause ? `WHERE ${searchCondition.clause}` : ""}`,
      searchCondition.params
    ),
    db.all(
      `SELECT
         u.id,
         u.username,
         u.name,
         u.created_at,
         u.weight,
         u.height,
         u.bmi,
         u.stage,
         u.allergy,
         u.treatment,
         COALESCE(g.glucose_count, 0)::int AS glucose_count,
         g.last_glucose_at,
         g.last_glucose_value,
         COALESCE(c.chat_count, 0)::int AS chat_count,
         c.last_question_at,
         COALESCE(
           GREATEST(
             COALESCE(g.last_glucose_at, u.created_at),
             COALESCE(c.last_question_at, u.created_at),
             u.created_at
           ),
           u.created_at
         ) AS last_activity_at
       FROM users u
       LEFT JOIN (
         SELECT
           user_id,
           COUNT(*)::int AS glucose_count,
           MAX(recorded_at) AS last_glucose_at,
           (ARRAY_AGG(value ORDER BY recorded_at DESC NULLS LAST, id DESC))[1] AS last_glucose_value
         FROM glucose_history
         GROUP BY user_id
       ) g ON g.user_id = u.id
       LEFT JOIN (
         SELECT
           user_id,
           COUNT(*)::int AS chat_count,
           MAX(created_at) AS last_question_at
         FROM ai_chat_logs
         GROUP BY user_id
       ) c ON c.user_id = u.id
       ${searchCondition.clause ? `WHERE ${searchCondition.clause}` : ""}
       ORDER BY last_activity_at DESC NULLS LAST, u.id DESC
       LIMIT ? OFFSET ?`,
      [...searchCondition.params, safeLimit, safeOffset]
    ),
  ]);

  return {
    total: Number(totalRow?.total) || 0,
    items: rows.map((item) => ({
      id: Number(item.id) || 0,
      username: item.username,
      name: item.name,
      createdAt: item.created_at,
      weight: Number(item.weight) || 0,
      height: Number(item.height) || 0,
      bmi: Number(item.bmi) || 0,
      stage: item.stage,
      allergy: item.allergy,
      treatment: item.treatment,
      glucoseCount: Number(item.glucose_count) || 0,
      lastGlucoseAt: item.last_glucose_at || null,
      lastGlucoseValue: item.last_glucose_value ?? null,
      chatCount: Number(item.chat_count) || 0,
      lastQuestionAt: item.last_question_at || null,
      lastActivityAt: item.last_activity_at || item.created_at || null,
    })),
  };
}

export async function getAdminUserDetail({ db, userId }) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const [user, recentGlucose, recentQuestions, reminders] = await Promise.all([
    db.get(
      `SELECT
         u.id,
         u.username,
         u.name,
         u.created_at,
         u.weight,
         u.height,
         u.bmi,
         u.stage,
         u.allergy,
         u.treatment,
         COALESCE(g.glucose_count, 0)::int AS glucose_count,
         g.last_glucose_at,
         g.last_glucose_value,
         COALESCE(c.chat_count, 0)::int AS chat_count,
         c.last_question_at
       FROM users u
       LEFT JOIN (
         SELECT
           user_id,
           COUNT(*)::int AS glucose_count,
           MAX(recorded_at) AS last_glucose_at,
           (ARRAY_AGG(value ORDER BY recorded_at DESC NULLS LAST, id DESC))[1] AS last_glucose_value
         FROM glucose_history
         GROUP BY user_id
       ) g ON g.user_id = u.id
       LEFT JOIN (
         SELECT
           user_id,
           COUNT(*)::int AS chat_count,
           MAX(created_at) AS last_question_at
         FROM ai_chat_logs
         GROUP BY user_id
       ) c ON c.user_id = u.id
       WHERE u.id = ?`,
      [id]
    ),
    db.all(
      `SELECT id, value, phase, date, time, recorded_at, reminder_slot_key
       FROM glucose_history
       WHERE user_id = ?
       ORDER BY recorded_at DESC NULLS LAST, id DESC
       LIMIT 25`,
      [id]
    ),
    db.all(
      `SELECT id, question_text, intent_key, response_model, used_fallback, created_at
       FROM ai_chat_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [id]
    ),
    db.all(
      `SELECT id, reminder_key, label, time, is_enabled, last_sent_on
       FROM meal_reminders
       WHERE user_id = ?
       ORDER BY time ASC, id ASC`,
      [id]
    ),
  ]);

  if (!user) return null;

  return {
    user: {
      id: Number(user.id) || 0,
      username: user.username,
      name: user.name,
      createdAt: user.created_at,
      weight: Number(user.weight) || 0,
      height: Number(user.height) || 0,
      bmi: Number(user.bmi) || 0,
      stage: user.stage,
      allergy: user.allergy,
      treatment: user.treatment,
      glucoseCount: Number(user.glucose_count) || 0,
      lastGlucoseAt: user.last_glucose_at || null,
      lastGlucoseValue: user.last_glucose_value ?? null,
      chatCount: Number(user.chat_count) || 0,
      lastQuestionAt: user.last_question_at || null,
    },
    recentGlucose: recentGlucose.map((item) => ({
      id: Number(item.id) || 0,
      value: Number(item.value) || 0,
      phase: item.phase,
      date: item.date,
      time: item.time,
      recordedAt: item.recorded_at,
      reminderSlotKey: item.reminder_slot_key,
    })),
    recentQuestions: recentQuestions.map((item) => ({
      id: Number(item.id) || 0,
      questionText: item.question_text,
      intentKey: item.intent_key,
      responseModel: item.response_model || "unknown",
      usedFallback: Boolean(item.used_fallback),
      createdAt: item.created_at,
    })),
    reminders: reminders.map((item) => ({
      id: Number(item.id) || 0,
      reminderKey: item.reminder_key,
      label: item.label,
      time: item.time,
      isEnabled: Boolean(item.is_enabled),
      lastSentOn: item.last_sent_on || null,
    })),
  };
}

export async function getAdminRecords({
  db,
  type = "all",
  search = "",
  userId = "",
  phase = "",
  range = {},
  limit = 100,
  offset = 0,
}) {
  const recordType = String(type || "all").toLowerCase();
  const keyword = String(search || "").trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const userFilter = Number(userId);
  const hasUserFilter = Number.isInteger(userFilter) && userFilter > 0;
  const phaseFilter = String(phase || "").trim().toLowerCase();

  const glucoseSearch = buildSearchCondition(
    [
      "u.username",
      "u.name",
      "gh.value",
      "gh.phase",
      "gh.date",
      "gh.time",
      "gh.reminder_slot_key",
    ],
    keyword
  );
  const chatSearch = buildSearchCondition(
    ["u.username", "u.name", "cl.question_text", "cl.intent_key", "cl.response_model"],
    keyword
  );
  const glucoseDateFilter = buildDateConditions("gh.recorded_at", range);
  const chatDateFilter = buildDateConditions("cl.created_at", range);

  const glucoseConditions = ["1=1"];
  const glucoseParams = [];
  if (glucoseDateFilter.conditions.length) {
    glucoseConditions.push(...glucoseDateFilter.conditions);
    glucoseParams.push(...glucoseDateFilter.params);
  }
  if (hasUserFilter) {
    glucoseConditions.push("gh.user_id = ?");
    glucoseParams.push(userFilter);
  }
  if (phaseFilter) {
    glucoseConditions.push("gh.phase = ?");
    glucoseParams.push(phaseFilter);
  }
  if (glucoseSearch.clause) {
    glucoseConditions.push(glucoseSearch.clause);
    glucoseParams.push(...glucoseSearch.params);
  }

  const chatConditions = ["1=1"];
  const chatParams = [];
  if (chatDateFilter.conditions.length) {
    chatConditions.push(...chatDateFilter.conditions);
    chatParams.push(...chatDateFilter.params);
  }
  if (hasUserFilter) {
    chatConditions.push("cl.user_id = ?");
    chatParams.push(userFilter);
  }
  if (glucoseSearch.clause && recordType === "glucose") {
    // no-op
  }
  if (chatSearch.clause) {
    chatConditions.push(chatSearch.clause);
    chatParams.push(...chatSearch.params);
  }

  const glucoseQuery = recordType === "chat" ? null : db.all(
    `SELECT
       gh.id,
       gh.user_id,
       u.username,
       u.name,
       gh.value,
       gh.phase,
       gh.date,
       gh.time,
       gh.recorded_at,
       gh.reminder_slot_key
     FROM glucose_history gh
     JOIN users u ON u.id = gh.user_id
     WHERE ${glucoseConditions.join(" AND ")}
     ORDER BY gh.recorded_at DESC NULLS LAST, gh.id DESC
     LIMIT ? OFFSET ?`,
    [...glucoseParams, safeLimit, safeOffset]
  );

  const chatQuery = recordType === "glucose" ? null : db.all(
    `SELECT
       cl.id,
       cl.user_id,
       u.username,
       u.name,
       cl.question_text,
       cl.intent_key,
       cl.response_model,
       cl.used_fallback,
       cl.created_at
     FROM ai_chat_logs cl
     JOIN users u ON u.id = cl.user_id
     WHERE ${chatConditions.join(" AND ")}
     ORDER BY cl.created_at DESC, cl.id DESC
     LIMIT ? OFFSET ?`,
    [...chatParams, safeLimit, safeOffset]
  );

  const [glucoseRows, chatRows] = await Promise.all([
    glucoseQuery,
    chatQuery,
  ]);

  const records = [];
  if (recordType !== "chat") {
    for (const item of glucoseRows || []) {
      records.push({
        recordType: "glucose",
        id: Number(item.id) || 0,
        userId: Number(item.user_id) || 0,
        username: item.username,
        name: item.name,
        title: "บันทึกน้ำตาล",
        subtitle: `${item.phase || "-"} • ${item.value ?? "-"} mg/dL`,
        value: Number(item.value) || 0,
        phase: item.phase,
        date: item.date,
        time: item.time,
        recordedAt: item.recorded_at,
        reminderSlotKey: item.reminder_slot_key,
      });
    }
  }

  if (recordType !== "glucose") {
    for (const item of chatRows || []) {
      records.push({
        recordType: "chat",
        id: Number(item.id) || 0,
        userId: Number(item.user_id) || 0,
        username: item.username,
        name: item.name,
        title: item.question_text,
        subtitle: `${item.intent_key || "general"} • ${item.response_model || "unknown"}`,
        questionText: item.question_text,
        intentKey: item.intent_key,
        responseModel: item.response_model || "unknown",
        usedFallback: Boolean(item.used_fallback),
        createdAt: item.created_at,
      });
    }
  }

  records.sort((left, right) => {
    const leftTime = new Date(left.recordedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.recordedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime || right.id - left.id;
  });

  return {
    items: records.slice(0, safeLimit),
  };
}

export async function getAdminAnomalies({ db, range = {}, highThreshold = 250, lowThreshold = 70, minFallbackCount = 3 }) {
  const glucoseDateFilter = buildDateConditions("gh.recorded_at", range);
  const chatDateFilter = buildDateConditions("cl.created_at", range);

  const [glucoseAlerts, fallbackAlerts, repeatedQuestionAlerts] = await Promise.all([
    db.all(
      `SELECT
         gh.id,
         gh.user_id,
         u.username,
         u.name,
         gh.value,
         gh.phase,
         gh.recorded_at
       FROM glucose_history gh
       JOIN users u ON u.id = gh.user_id
       WHERE ${[...glucoseDateFilter.conditions, "(gh.value >= ? OR gh.value <= ?)"].join(" AND ")}
       ORDER BY gh.recorded_at DESC NULLS LAST, gh.id DESC
       LIMIT 30`,
      [...glucoseDateFilter.params, Number(highThreshold) || 250, Number(lowThreshold) || 70]
    ),
    db.all(
      `SELECT
         cl.user_id,
         u.username,
         u.name,
         COUNT(*)::int AS fallback_count,
         MAX(cl.created_at) AS last_seen_at
       FROM ai_chat_logs cl
       JOIN users u ON u.id = cl.user_id
       WHERE ${[...chatDateFilter.conditions, "cl.used_fallback = TRUE"].join(" AND ")}
       GROUP BY cl.user_id, u.username, u.name
       HAVING COUNT(*) >= ?
       ORDER BY fallback_count DESC, last_seen_at DESC
       LIMIT 20`,
      [...chatDateFilter.params, Number(minFallbackCount) || 3]
    ),
    db.all(
      `SELECT
         cl.user_id,
         u.username,
         u.name,
         cl.question_text,
         COUNT(*)::int AS question_count,
         MAX(cl.created_at) AS last_seen_at
       FROM ai_chat_logs cl
       JOIN users u ON u.id = cl.user_id
       WHERE ${chatDateFilter.conditions.join(" AND ") || "TRUE"}
       GROUP BY cl.user_id, u.username, u.name, cl.question_text
       HAVING COUNT(*) >= 4
       ORDER BY question_count DESC, last_seen_at DESC
       LIMIT 20`,
      chatDateFilter.params
    ),
  ]);

  return {
    summary: {
      glucoseAlerts: glucoseAlerts.length,
      fallbackUsers: fallbackAlerts.length,
      repeatedQuestions: repeatedQuestionAlerts.length,
    },
    glucoseAlerts: glucoseAlerts.map((item) => ({
      id: Number(item.id) || 0,
      userId: Number(item.user_id) || 0,
      username: item.username,
      name: item.name,
      value: Number(item.value) || 0,
      phase: item.phase,
      recordedAt: item.recorded_at,
      severity:
        Number(item.value) >= Number(highThreshold) ? "high" : Number(item.value) <= Number(lowThreshold) ? "low" : "medium",
    })),
    fallbackAlerts: fallbackAlerts.map((item) => ({
      userId: Number(item.user_id) || 0,
      username: item.username,
      name: item.name,
      fallbackCount: Number(item.fallback_count) || 0,
      lastSeenAt: item.last_seen_at,
    })),
    repeatedQuestionAlerts: repeatedQuestionAlerts.map((item) => ({
      userId: Number(item.user_id) || 0,
      username: item.username,
      name: item.name,
      questionText: item.question_text,
      questionCount: Number(item.question_count) || 0,
      lastSeenAt: item.last_seen_at,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function exportAdminUsersCsv({ db, search = "" }) {
  const data = await getAdminUsers({ db, search, limit: 200, offset: 0 });
  return toCsv(
    [
      { key: "id", label: "id" },
      { key: "username", label: "username" },
      { key: "name", label: "name" },
      { key: "stage", label: "stage" },
      { key: "bmi", label: "bmi" },
      { key: "glucoseCount", label: "glucose_count" },
      { key: "chatCount", label: "chat_count" },
      { key: "lastActivityAt", label: "last_activity_at" },
      { key: "createdAt", label: "created_at" },
    ],
    data.items.map((item) => ({
      ...item,
    }))
  );
}

export async function exportAdminRecordsCsv({ db, type = "all", search = "", userId = "", phase = "", range = {} }) {
  const data = await getAdminRecords({ db, type, search, userId, phase, range, limit: 200, offset: 0 });
  return toCsv(
    [
      { key: "recordType", label: "record_type" },
      { key: "id", label: "id" },
      { key: "userId", label: "user_id" },
      { key: "username", label: "username" },
      { key: "name", label: "name" },
      { key: "title", label: "title" },
      { key: "subtitle", label: "subtitle" },
      { key: "recordedAt", label: "recorded_at" },
      { key: "createdAt", label: "created_at" },
      { key: "phase", label: "phase" },
      { key: "value", label: "value" },
      { key: "intentKey", label: "intent_key" },
      { key: "responseModel", label: "response_model" },
      { key: "usedFallback", label: "used_fallback" },
    ],
    data.items.map((item) => ({
      recordType: item.recordType,
      id: item.id,
      userId: item.userId,
      username: item.username || "",
      name: item.name || "",
      title: item.title || "",
      subtitle: item.subtitle || "",
      recordedAt: item.recordedAt || "",
      createdAt: item.createdAt || "",
      phase: item.phase || "",
      value: item.value ?? "",
      intentKey: item.intentKey || "",
      responseModel: item.responseModel || "",
      usedFallback: item.usedFallback ?? "",
    }))
  );
}

export async function exportAdminAnomaliesCsv({ db, range = {} }) {
  const data = await getAdminAnomalies({ db, range });
  const rows = [
    ...data.glucoseAlerts.map((item) => ({
      category: "glucose",
      userId: item.userId,
      username: item.username,
      name: item.name,
      title: `${item.phase || ""} ${item.value || ""}`.trim(),
      observedAt: item.recordedAt,
      note: item.severity,
    })),
    ...data.fallbackAlerts.map((item) => ({
      category: "fallback",
      userId: item.userId,
      username: item.username,
      name: item.name,
      title: "fallback spike",
      observedAt: item.lastSeenAt,
      note: `count=${item.fallbackCount}`,
    })),
    ...data.repeatedQuestionAlerts.map((item) => ({
      category: "repeat-question",
      userId: item.userId,
      username: item.username,
      name: item.name,
      title: item.questionText,
      observedAt: item.lastSeenAt,
      note: `count=${item.questionCount}`,
    })),
  ];

  return toCsv(
    [
      { key: "category", label: "category" },
      { key: "userId", label: "user_id" },
      { key: "username", label: "username" },
      { key: "name", label: "name" },
      { key: "title", label: "title" },
      { key: "observedAt", label: "observed_at" },
      { key: "note", label: "note" },
    ],
    rows
  );
}
