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
