import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";
import webpush from "web-push";
import {
  exportAdminAnomaliesCsv,
  exportAdminEvaluationCsv,
  exportAdminRecordsCsv,
  exportAdminUsersCsv,
  exportAdminFallbacksCsv,
  exportAdminKnowledgeCsv,
  exportAdminQuestionsCsv,
  getAdminAnomalies,
  getAdminEvaluation,
  getAdminOverview,
  getAdminRecords,
  getAdminUserDetail,
  getAdminUsers,
  getAdminStats,
  getAdminQuality,
  deleteChatEvaluation,
  upsertChatEvaluation,
} from "./adminAnalytics.js";
import { initDB } from "./database.js";

dotenv.config();

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function getRequiredEnv(name, { allowDevFallback = false, fallbackValue = "" } = {}) {
  const value = readEnv(name);
  if (value) return value;

  if (!IS_PRODUCTION && allowDevFallback && fallbackValue) {
    return fallbackValue;
  }

  throw new Error(
    `Missing required environment variable: ${name}${
      IS_PRODUCTION ? " (required in production)" : ""
    }`
  );
}

function normalizeOriginValue(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function matchesOriginPattern(origin, pattern) {
  const normalizedOrigin = normalizeOriginValue(origin);
  const normalizedPattern = normalizeOriginValue(pattern);
  if (!normalizedOrigin || !normalizedPattern) return false;
  if (normalizedOrigin === normalizedPattern) return true;

  // Support patterns like https://*.vercel.app for preview deployments.
  if (!normalizedPattern.includes("*")) return false;

  const escapedPattern = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escapedPattern}$`);
  return regex.test(normalizedOrigin);
}

function isPrivateNetworkOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    if (!hostname) return false;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) return false;

    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
      return false;
    }

    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  } catch (_error) {
    return false;
  }
}

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ||
  DEFAULT_ALLOWED_ORIGINS
);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (isPrivateNetworkOrigin(origin)) return true;
  return allowedOrigins.some((allowedOrigin) => matchesOriginPattern(origin, allowedOrigin));
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

const scrypt = promisify(scryptCallback);
const GEMINI_MODELS = [...new Set([
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-3-flash-preview",
].filter(Boolean))];

const PROFILE_STAGE_OPTIONS = new Set(["1", "2", "3"]);
const TREATMENT_OPTIONS = new Set(["กินยา", "ฉีดยา", "ไม่มี"]);
const GLUCOSE_PHASE_OPTIONS = new Set(["before", "after"]);
const USERNAME_REGEX = /^[A-Za-z0-9._-]{4,20}$/;
const SURVEY_GENDER_OPTIONS = new Set(["ชาย", "หญิง", "ไม่ระบุ"]);
const SURVEY_AGE_RANGE_OPTIONS = new Set([
  "ต่ำกว่า 30 ปี",
  "30-39 ปี",
  "40-49 ปี",
  "50-59 ปี",
  "60 ปีขึ้นไป",
]);
const SURVEY_RESPONDENT_STATUS_OPTIONS = new Set([
  "ผู้ป่วยโรคเบาหวาน",
  "ญาติหรือผู้ดูแล",
  "บุคลากรทางการแพทย์",
  "บุคคลทั่วไป",
]);
const SURVEY_SMARTPHONE_EXPERIENCE_OPTIONS = new Set([
  "น้อยกว่า 6 เดือน",
  "6 เดือน - 1 ปี",
  "1 - 3 ปี",
  "มากกว่า 3 ปี",
]);

const SESSION_COOKIE_NAME = "diabetes_session";
const ADMIN_SESSION_COOKIE_NAME = "diabetes_admin_session";
const SESSION_TTL_MS = Number.parseInt(process.env.SESSION_TTL_MS || "", 10) || 1000 * 60 * 60 * 24 * 7;
const SESSION_SECRET = getRequiredEnv("SESSION_SECRET", {
  allowDevFallback: true,
  fallbackValue: "local-dev-session-secret",
});
const SESSION_COOKIE_SAME_SITE = process.env.SESSION_COOKIE_SAME_SITE?.trim() || "Lax";
const SESSION_COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "true" ||
  SESSION_COOKIE_SAME_SITE.toLowerCase() === "none" ||
  Boolean(process.env.VERCEL);
const ADMIN_USERNAME = getRequiredEnv("ADMIN_USERNAME", {
  allowDevFallback: true,
  fallbackValue: "admin",
});
const ADMIN_PASSWORD = getRequiredEnv("ADMIN_PASSWORD", {
  allowDevFallback: true,
  fallbackValue: "admin1234",
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const db = await initDB();
const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || "Asia/Bangkok";
const VAPID_SUBJECT = getRequiredEnv("VAPID_SUBJECT", {
  allowDevFallback: true,
  fallbackValue: "mailto:support@example.com",
});
const generatedVapidKeys = !IS_PRODUCTION ? webpush.generateVAPIDKeys() : null;
const VAPID_PUBLIC_KEY =
  readEnv("VAPID_PUBLIC_KEY") ||
  getRequiredEnv("VAPID_PUBLIC_KEY", {
    allowDevFallback: true,
    fallbackValue: generatedVapidKeys?.publicKey || "",
  });
const VAPID_PRIVATE_KEY =
  readEnv("VAPID_PRIVATE_KEY") ||
  getRequiredEnv("VAPID_PRIVATE_KEY", {
    allowDevFallback: true,
    fallbackValue: generatedVapidKeys?.privateKey || "",
  });
let reminderSchedulerRunning = false;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

if (!IS_PRODUCTION && (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)) {
  console.warn(
    "Push notifications are using temporary VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for stable production subscriptions."
  );
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAdminDateInput(value) {
  const text = normalizeText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";

  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  return text;
}

function getAdminDateRange(req) {
  const startDate = parseAdminDateInput(req.query?.startDate);
  const endDate = parseAdminDateInput(req.query?.endDate);

  if (startDate && endDate && startDate > endDate) {
    return {
      startDate: endDate,
      endDate: startDate,
    };
  }

  return {
    startDate,
    endDate,
  };
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function formatZonedDateParts(date = new Date(), timeZone = REMINDER_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
  };
}

function getReminderDateKey(date = new Date()) {
  const parts = formatZonedDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getReminderMinuteKey(date = new Date()) {
  const parts = formatZonedDateParts(date);
  return `${parts.hour}:${parts.minute}`;
}

function sanitizeReminderLabel(label) {
  return normalizeText(label).slice(0, 80);
}

function sanitizeReminderTime(time) {
  return normalizeText(time);
}

function validateReminderLabel(label) {
  const value = sanitizeReminderLabel(label);
  if (!value) return "กรุณาระบุชื่อการแจ้งเตือน";
  if (value.length > 80) return "ชื่อการแจ้งเตือนยาวเกินไป";
  return "";
}

function validateReminderTime(time) {
  const value = sanitizeReminderTime(time);
  if (!/^\d{2}:\d{2}$/.test(value)) return "รูปแบบเวลาแจ้งเตือนไม่ถูกต้อง";

  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return "เวลาแจ้งเตือนไม่ถูกต้อง";
  }

  return "";
}

function normalizeReminderInput(reminder, index) {
  return {
    reminderKey: normalizeText(reminder?.id ?? reminder?.reminderKey ?? `${index + 1}`) || `${index + 1}`,
    label: sanitizeReminderLabel(reminder?.label),
    time: sanitizeReminderTime(reminder?.time),
    isEnabled: reminder?.isEnabled !== false,
  };
}

function validateReminderList(reminders) {
  if (!Array.isArray(reminders)) return "รูปแบบรายการแจ้งเตือนไม่ถูกต้อง";
  if (reminders.length > 12) return "ตั้งการแจ้งเตือนได้ไม่เกิน 12 รายการ";

  for (let i = 0; i < reminders.length; i += 1) {
    const reminder = normalizeReminderInput(reminders[i], i);
    const validationError = validateReminderLabel(reminder.label) || validateReminderTime(reminder.time);
    if (validationError) return validationError;
  }

  return "";
}

function mapReminderRow(reminder) {
  return {
    id: reminder.reminder_key,
    label: reminder.label,
    time: reminder.time,
    isEnabled: reminder.is_enabled !== false,
  };
}

function validatePushSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") {
    return "ข้อมูลการสมัครรับแจ้งเตือนไม่ถูกต้อง";
  }

  const endpoint = normalizeText(subscription.endpoint);
  const p256dh = normalizeText(subscription.keys?.p256dh);
  const auth = normalizeText(subscription.keys?.auth);

  if (!endpoint || !p256dh || !auth) {
    return "ข้อมูลการสมัครรับแจ้งเตือนไม่ครบถ้วน";
  }

  return "";
}

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function signValue(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function createSession(userId) {
  const session = {
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

function createAdminSession(username) {
  const session = {
    username,
    role: "admin",
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

function verifySessionCookie(cookieValue) {
  if (!cookieValue) return null;

  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;
  if (signValue(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session?.userId || !session?.expiresAt) return null;
    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch (_error) {
    return null;
  }
}

function verifyAdminSessionCookie(cookieValue) {
  if (!cookieValue) return null;

  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;
  if (signValue(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session?.username || !session?.expiresAt || session?.role !== "admin") return null;
    if (session.username !== ADMIN_USERNAME) return null;
    if (session.expiresAt < Date.now()) return null;
    return session;
  } catch (_error) {
    return null;
  }
}

function setCookie(res, cookieName, signedSession) {
  const cookieParts = [
    `${cookieName}=${encodeURIComponent(signedSession)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${SESSION_COOKIE_SAME_SITE}`,
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];

  if (SESSION_COOKIE_SECURE) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

function setSessionCookie(res, signedSession) {
  setCookie(res, SESSION_COOKIE_NAME, signedSession);
}

function clearCookie(res, cookieName) {
  const cookieParts = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${SESSION_COOKIE_SAME_SITE}`,
    "Max-Age=0",
  ];

  if (SESSION_COOKIE_SECURE) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

function clearSessionCookie(res) {
  clearCookie(res, SESSION_COOKIE_NAME);
}

function setAdminSessionCookie(res, signedSession) {
  setCookie(res, ADMIN_SESSION_COOKIE_NAME, signedSession);
}

function clearAdminSessionCookie(res) {
  clearCookie(res, ADMIN_SESSION_COOKIE_NAME);
}

function getSafeUser(user) {
  if (!user) return null;
  const { password: _password, ...safeUserData } = user;
  return safeUserData;
}

async function getLatestGlucoseRecord(userId) {
  return db.get(
    "SELECT * FROM glucose_history WHERE user_id = ? ORDER BY recorded_at DESC NULLS LAST, id DESC LIMIT 1",
    [userId]
  );
}

async function getMealReminders(userId) {
  const reminders = await db.all(
    "SELECT * FROM meal_reminders WHERE user_id = ? ORDER BY time ASC, id ASC",
    [userId]
  );
  return reminders.map(mapReminderRow);
}

async function saveMealReminders(userId, reminders) {
  await db.run("DELETE FROM meal_reminders WHERE user_id = ?", [userId]);

  for (let index = 0; index < reminders.length; index += 1) {
    const reminder = normalizeReminderInput(reminders[index], index);
    await db.run(
      `INSERT INTO meal_reminders (user_id, reminder_key, label, time, is_enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, reminder.reminderKey, reminder.label, reminder.time, reminder.isEnabled]
    );
  }
}

async function deletePushSubscription(endpoint) {
  await db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
}

async function sendPushToUser(userId, payload) {
  const subscriptions = await db.all(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    [userId]
  );

  for (const subscriptionRow of subscriptions) {
    const subscription = {
      endpoint: subscriptionRow.endpoint,
      keys: {
        p256dh: subscriptionRow.p256dh,
        auth: subscriptionRow.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      const statusCode = error?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await deletePushSubscription(subscriptionRow.endpoint);
        continue;
      }
      console.error("Push notification error:", error?.message || error);
    }
  }
}

async function runReminderScheduler() {
  if (reminderSchedulerRunning) return;
  reminderSchedulerRunning = true;

  try {
    const todayKey = getReminderDateKey();
    const minuteKey = getReminderMinuteKey();
    const dueReminders = await db.all(
      `SELECT * FROM meal_reminders
       WHERE is_enabled = TRUE
         AND time = ?
         AND (last_sent_on IS NULL OR last_sent_on <> ?)`,
      [minuteKey, todayKey]
    );

    for (const reminder of dueReminders) {
      await sendPushToUser(reminder.user_id, {
        title: `ถึงเวลาทาน${reminder.label}`,
        body: `ถึงเวลา ${reminder.time} น. อย่าลืมทานอาหารให้ตรงเวลาเพื่อช่วยคุมน้ำตาลนะคะ`,
        tag: `meal-reminder-${reminder.user_id}-${reminder.reminder_key}`,
      });

      await db.run("UPDATE meal_reminders SET last_sent_on = ? WHERE id = ?", [
        todayKey,
        reminder.id,
      ]);
    }
  } catch (error) {
    console.error("Reminder scheduler error:", error);
  } finally {
    reminderSchedulerRunning = false;
  }
}

async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySessionCookie(cookies[SESSION_COOKIE_NAME]);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" });
    }

    const user = await db.get("SELECT * FROM users WHERE id = ?", [session.userId]);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });
    }

    req.authUser = getSafeUser(user);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
}

function requireAdminAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifyAdminSessionCookie(cookies[ADMIN_SESSION_COOKIE_NAME]);

    if (!session) {
      clearAdminSessionCookie(res);
      return res.status(401).json({ error: "กรุณาเข้าสู่ระบบแอดมินก่อน" });
    }

    req.adminUser = {
      username: session.username,
      role: session.role,
    };
    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ" });
  }
}

function validateUsername(username) {
  const value = normalizeText(username);
  if (!value) return "กรุณากรอกชื่อผู้ใช้งาน";
  if (!USERNAME_REGEX.test(value)) {
    return "ชื่อผู้ใช้งานต้องยาว 4-20 ตัว และใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข . _ -";
  }
  return "";
}

function validatePassword(password) {
  if (typeof password !== "string" || !password) return "กรุณากรอกรหัสผ่าน";
  if (password.length < 4) return "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร";
  if (password.length > 64) return "รหัสผ่านยาวเกินไป";
  return "";
}

function validateName(name) {
  const value = normalizeText(name);
  if (!value) return "กรุณากรอกชื่อ";
  if (value.length < 2) return "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";
  if (value.length > 80) return "ชื่อยาวเกินไป กรุณากรอกไม่เกิน 80 ตัวอักษร";
  return "";
}

function validateWeight(weight) {
  const value = toNumber(weight);
  if (!Number.isFinite(value)) return "กรุณากรอกน้ำหนักเป็นตัวเลข";
  if (value < 20 || value > 300) return "น้ำหนักควรอยู่ระหว่าง 20 ถึง 300 กิโลกรัม";
  return "";
}

function validateHeight(height) {
  const value = toNumber(height);
  if (!Number.isFinite(value)) return "กรุณากรอกส่วนสูงเป็นตัวเลข";
  if (value < 100 || value > 250) return "ส่วนสูงควรอยู่ระหว่าง 100 ถึง 250 เซนติเมตร";
  return "";
}

function validateStage(stage) {
  if (!PROFILE_STAGE_OPTIONS.has(String(stage))) return "กรุณาเลือกระยะโรคให้ถูกต้อง";
  return "";
}

function validateTreatment(treatment) {
  if (!TREATMENT_OPTIONS.has(String(treatment))) return "กรุณาเลือกรูปแบบการดูแลให้ถูกต้อง";
  return "";
}

function validateAllergy(allergy) {
  const value = normalizeText(allergy);
  if (value.length > 200) return "ข้อมูลการแพ้ยาควรยาวไม่เกิน 200 ตัวอักษร";
  return "";
}

function validateChatMessage(message) {
  const value = normalizeText(message);
  if (!value) return "กรุณาระบุข้อความที่ต้องการถาม";
  if (value.length > 1000) return "ข้อความยาวเกินไป กรุณาพิมพ์ไม่เกิน 1000 ตัวอักษร";
  return "";
}

function validateGlucoseValue(value) {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return "กรุณากรอกค่าน้ำตาลเป็นตัวเลข";
  if (num < 20 || num > 600) return "ค่าน้ำตาลควรอยู่ระหว่าง 20 ถึง 600 mg/dL";
  return "";
}

function validateGlucosePhase(phase) {
  if (!GLUCOSE_PHASE_OPTIONS.has(String(phase))) return "ช่วงเวลาบันทึกค่าน้ำตาลไม่ถูกต้อง";
  return "";
}

function validateDateText(date) {
  return normalizeText(date) ? "" : "กรุณาระบุวันที่";
}

function validateTimeText(time) {
  return normalizeText(time) ? "" : "กรุณาระบุเวลา";
}

function validateRecordedAt(recordedAt) {
  const value = normalizeText(recordedAt);
  if (!value) return "";
  return Number.isNaN(Date.parse(value)) ? "วันเวลาบันทึกค่าน้ำตาลไม่ถูกต้อง" : "";
}

function validateSurveyOption(value, allowedOptions, label) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return `กรุณาเลือก${label}`;
  if (!allowedOptions.has(normalizedValue)) return `${label}ไม่ถูกต้อง`;
  return "";
}

function validateSurveyScore(value, label) {
  const score = Number.parseInt(String(value), 10);
  if (Number.isNaN(score)) return `กรุณาให้คะแนน${label}`;
  if (score < 1 || score > 5) return `${label}ต้องอยู่ระหว่าง 1 ถึง 5`;
  return "";
}

function validateSurveyText(value, label, maxLength) {
  const normalizedValue = normalizeText(value);
  if (normalizedValue.length > maxLength) {
    return `${label}ยาวเกินไป กรุณากรอกไม่เกิน ${maxLength} ตัวอักษร`;
  }
  return "";
}

function normalizeSurveyPayload(body = {}) {
  return {
    gender: normalizeText(body.gender),
    ageRange: normalizeText(body.ageRange),
    respondentStatus: normalizeText(body.respondentStatus),
    smartphoneExperience: normalizeText(body.smartphoneExperience),
    usabilityScore: Number.parseInt(String(body.usabilityScore ?? ""), 10),
    uiScore: Number.parseInt(String(body.uiScore ?? ""), 10),
    informationScore: Number.parseInt(String(body.informationScore ?? ""), 10),
    comment: normalizeText(body.comment),
    issues: normalizeText(body.issues),
    suggestions: normalizeText(body.suggestions),
  };
}

function validateSurveyPayload(payload) {
  return (
    validateSurveyOption(payload.gender, SURVEY_GENDER_OPTIONS, "เพศ") ||
    validateSurveyOption(payload.ageRange, SURVEY_AGE_RANGE_OPTIONS, "ช่วงอายุ") ||
    validateSurveyOption(
      payload.respondentStatus,
      SURVEY_RESPONDENT_STATUS_OPTIONS,
      "สถานะของผู้ตอบแบบประเมิน"
    ) ||
    validateSurveyOption(
      payload.smartphoneExperience,
      SURVEY_SMARTPHONE_EXPERIENCE_OPTIONS,
      "ประสบการณ์การใช้สมาร์ตโฟน"
    ) ||
    validateSurveyScore(payload.usabilityScore, "ด้านการใช้งาน") ||
    validateSurveyScore(payload.uiScore, "ด้านส่วนติดต่อผู้ใช้") ||
    validateSurveyScore(payload.informationScore, "ด้านข้อมูลและคำแนะนำ") ||
    validateSurveyText(payload.comment, "ความคิดเห็นเพิ่มเติม", 600) ||
    validateSurveyText(payload.issues, "ปัญหาที่พบ", 600) ||
    validateSurveyText(payload.suggestions, "ข้อเสนอแนะ", 600)
  );
}

async function getSurveyStatusForUser(userId) {
  const [surveyRow, countRow] = await Promise.all([
    db.get(
      `SELECT gender, age_range, respondent_status, smartphone_experience,
              usability_score, ui_score, information_score, comment, issues, suggestions,
              created_at, updated_at
       FROM satisfaction_surveys
       WHERE user_id = ?`,
      [userId]
    ),
    db.get("SELECT COUNT(*)::int AS total FROM satisfaction_surveys"),
  ]);

  return {
    hasSubmitted: Boolean(surveyRow),
    submittedCount: Number(countRow?.total) || 0,
    targetCount: SURVEY_TARGET_COUNT,
    survey: surveyRow
      ? {
          gender: surveyRow.gender,
          ageRange: surveyRow.age_range,
          respondentStatus: surveyRow.respondent_status,
          smartphoneExperience: surveyRow.smartphone_experience,
          usabilityScore: Number(surveyRow.usability_score) || 0,
          uiScore: Number(surveyRow.ui_score) || 0,
          informationScore: Number(surveyRow.information_score) || 0,
          comment: surveyRow.comment || "",
          issues: surveyRow.issues || "",
          suggestions: surveyRow.suggestions || "",
          createdAt: surveyRow.created_at || "",
          updatedAt: surveyRow.updated_at || "",
        }
      : null,
  };
}

function extractJsonObject(text) {
  const value = normalizeText(text).replace(/```json|```/g, "").trim();
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(value.slice(firstBrace, lastBrace + 1));
  } catch (_error) {
    return null;
  }
}

const INTENT_RULES = [
  {
    key: "greeting",
    label: "ทักทาย",
    keywords: ["สวัสดี", "hello", "hi", "hey", "ทักทาย", "หวัดดี"],
    promptHint: "ถ้าเป็นการทักทาย ให้ตอบสั้น อบอุ่น และชวนถามต่อได้เลย",
    fallback:
      "สวัสดีค่ะ วันนี้อยากให้หมอ AI ช่วยดูเรื่องอาหาร ค่าน้ำตาล อาการ หรือยา ก็บอกได้เลยนะคะ",
  },
  {
    key: "food",
    label: "แนะนำอาหาร",
    keywords: [
      "อาหาร",
      "กินอะไร",
      "ควรกิน",
      "กินได้ไหม",
      "เมนู",
      "มื้อ",
      "ผลไม้",
      "ข้าว",
      "หวาน",
      "เครื่องดื่ม",
      "ของกิน",
      "ของว่าง",
      "อาหารเช้า",
      "อาหารกลางวัน",
      "อาหารเย็น",
      "breakfast",
      "lunch",
      "dinner",
      "meal",
      "food",
      "snack",
      "fruit",
      "rice",
      "drink",
    ],
    promptHint: "ถ้าเป็นเรื่องอาหาร ให้เน้นเมนูที่เหมาะ ปริมาณที่ควรระวัง และตัวอย่างที่ทำตามได้จริง",
    fallback:
      "ถ้าอยากคุมเบาหวานให้ดี ลองเน้นผัก โปรตีนไม่ติดมัน และลดน้ำหวานหรือของหวานลงก่อนค่ะ",
  },
  {
    key: "glucose",
    label: "ประเมินค่าน้ำตาล",
    keywords: [
      "น้ำตาล",
      "mg/dl",
      "mgdl",
      "before meal",
      "after meal",
      "before food",
      "after food",
      "sugar",
      "glucose",
      "blood sugar",
      "ก่อนอาหาร",
      "หลังอาหาร",
      "สูงไหม",
      "ต่ำไหม",
      "ค่าน้ำตาล",
      "น้ำตาลขึ้น",
      "น้ำตาลลง",
      "น้ำตาลสูง",
      "น้ำตาลต่ำ",
      "ปลายนิ้ว",
    ],
    promptHint: "ถ้าเป็นตัวเลขค่าน้ำตาล ให้แปลความหมายแบบเข้าใจง่าย บอกเป้าหมายคร่าว ๆ และแนะนำการสังเกตอาการ",
    fallback:
      "ค่าน้ำตาลตัวเลขนี้ใช้ดูแนวโน้มได้ค่ะ ถ้าสูงหรือต่ำกว่าปกติบ่อย ๆ ควรจดเวลาอาหาร อาการ และคุยกับคุณหมอค่ะ",
  },
  {
    key: "symptom",
    label: "อาการผิดปกติ",
    keywords: [
      "หน้ามืด",
      "เวียนหัว",
      "ใจสั่น",
      "เหงื่อ",
      "อาการ",
      "ฉุกเฉิน",
      "โรงพยาบาล",
      "อันตราย",
      "มือสั่น",
      "หายใจไม่อิ่ม",
      "เหนื่อยมาก",
      "ชา",
      "symptom",
      "dizzy",
      "shaky",
      "sweat",
      "hospital",
      "emergency",
      "danger",
    ],
    promptHint: "ถ้าเป็นอาการผิดปกติ ให้ประเมินความเร่งด่วน ชี้สัญญาณอันตราย และบอกให้ไปพบแพทย์ทันทีเมื่อจำเป็น",
    fallback:
      "ถ้ามีหน้ามืด ใจสั่น เหงื่อแตก ซึมมาก หายใจลำบาก หรือเจ็บหน้าอก ให้รีบไปโรงพยาบาลหรือโทรฉุกเฉินทันทีค่ะ",
  },
  {
    key: "exercise",
    label: "ออกกำลังกาย",
    keywords: [
      "เดิน",
      "ออกกำลังกาย",
      "วิ่ง",
      "โยคะ",
      "ขยับ",
      "เผาผลาญ",
      "ปั่นจักรยาน",
      "ยืดเส้น",
      "exercise",
      "workout",
      "walk",
      "run",
      "yoga",
      "cardio",
      "stretch",
    ],
    promptHint: "ถ้าเป็นเรื่องออกกำลังกาย ให้แนะนำแบบปลอดภัย เหมาะกับผู้สูงอายุ และเริ่มทีละน้อย",
    fallback:
      "เริ่มจากการเดินเบา ๆ หรือขยับร่างกายหลังอาหาร 10-15 นาที จะช่วยให้ร่างกายใช้น้ำตาลได้ดีขึ้นค่ะ",
  },
  {
    key: "medicine",
    label: "ยาและการรักษา",
    keywords: [
      "ยาเบาหวาน",
      "กินยา",
      "ลืมยา",
      "หยุดยา",
      "ฉีดยา",
      "ฉีด",
      "อินซูลิน",
      "รักษา",
      "แพ้ยา",
      "แพทย์",
      "เภสัช",
      "drug",
      "medicine",
      "med",
      "insulin",
      "dose",
      "doctor",
      "tablet",
      "pill",
    ],
    promptHint: "ถ้าเกี่ยวกับยา ให้ย้ำว่าไม่ควรปรับยาเอง และควรคุยกับแพทย์หรือเภสัชกรเมื่อมีข้อสงสัย",
    fallback:
      "เรื่องยาอย่าปรับเองนะคะ ถ้ามีข้อสงสัยเรื่องยา ฉีด หรือผลข้างเคียง ควรปรึกษาคุณหมอหรือเภสัชกรที่ดูแลอยู่ค่ะ",
  },
  {
    key: "report",
    label: "รายงานสุขภาพ",
    keywords: [
      "รายงาน",
      "ประวัติ",
      "สรุป",
      "กราฟ",
      "แนวโน้ม",
      "ดูย้อนหลัง",
      "report",
      "summary",
      "history",
      "chart",
      "trend",
      "dashboard",
    ],
    promptHint: "ถ้าเป็นเรื่องรายงาน ให้สรุปแนวโน้ม จุดที่ดี จุดที่ควรระวัง และบอกสิ่งที่ควรทำต่อ",
    fallback:
      "ถ้าจะดูภาพรวมสุขภาพ ให้ดูแนวโน้มค่าน้ำตาลร่วมกับอาหาร อาการ และเวลาที่บันทึกไว้จะช่วยได้มากค่ะ",
  },
];

const DEFAULT_INTENT_RULE = {
  key: "general",
  label: "คำถามทั่วไป",
  promptHint: "ถ้าคำถามยังไม่ชัด ให้ตอบแบบประคองใจ สั้น กระชับ และถามกลับ 1 คำถามเพื่อขยายความ",
  fallback:
    "ขออภัยค่ะ ตอนนี้หมอ AI ยังตอบไม่ครบ แต่ถ้าคุณบอกเพิ่มว่าอยากถามเรื่องอาหาร ค่าน้ำตาล อาการ หรือยา ฉันจะช่วยต่อให้ได้ค่ะ",
};

const INTENT_PRIORITY = {
  symptom: 7,
  glucose: 6,
  medicine: 5,
  food: 4,
  exercise: 3,
  report: 2,
  greeting: 1,
  general: 0,
};

function getKeywordMatchScore(source, keyword) {
  const normalizedKeyword = String(keyword || "").trim().toLowerCase();
  if (!normalizedKeyword) return 0;

  if (/^[a-z0-9/_ -]+$/i.test(normalizedKeyword)) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(source) ? 2 : 0;
  }

  return source.includes(normalizedKeyword) ? Math.max(1, Math.min(normalizedKeyword.length, 6)) : 0;
}

function findIntentRule(rawIntent, originalMessage = "") {
  const source = `${normalizeText(rawIntent)} ${normalizeText(originalMessage)}`.toLowerCase();
  const scoredRules = INTENT_RULES.map((rule) => {
    const score = rule.keywords.reduce((total, keyword) => {
      return total + getKeywordMatchScore(source, keyword);
    }, 0);

    return { rule, score };
  }).filter((item) => item.score > 0);

  if (/\b\d{2,3}\b/.test(source) && /(mg\/dl|mgdl|น้ำตาล|glucose|sugar|ก่อนอาหาร|หลังอาหาร)/i.test(source)) {
    const glucoseRule = INTENT_RULES.find((rule) => rule.key === "glucose");
    if (glucoseRule) {
      const existing = scoredRules.find((item) => item.rule.key === "glucose");
      if (existing) {
        existing.score += 2;
      } else {
        scoredRules.push({ rule: glucoseRule, score: 2 });
      }
    }
  }

  if (/(ลืมยา|กินยา|ฉีดยา|ยาเบาหวาน|medicine|insulin|drug|pill|tablet|dose)/i.test(source)) {
    const medicineRule = INTENT_RULES.find((rule) => rule.key === "medicine");
    if (medicineRule) {
      const existing = scoredRules.find((item) => item.rule.key === "medicine");
      if (existing) {
        existing.score += 4;
      } else {
        scoredRules.push({ rule: medicineRule, score: 4 });
      }
    }
  }

  if (/(เดิน|ออกกำลังกาย|วิ่ง|โยคะ|ปั่นจักรยาน|ยืดเส้น|exercise|workout|walk|run|yoga|cardio|stretch)/i.test(source)) {
    const exerciseRule = INTENT_RULES.find((rule) => rule.key === "exercise");
    if (exerciseRule) {
      const existing = scoredRules.find((item) => item.rule.key === "exercise");
      if (existing) {
        existing.score += 4;
      } else {
        scoredRules.push({ rule: exerciseRule, score: 4 });
      }
    }
  }

  if (/(หน้ามืด|ใจสั่น|เหงื่อ|เวียนหัว|โรงพยาบาล|ฉุกเฉิน|อันตราย|hospital|emergency|danger|dizzy|shaky)/i.test(source)) {
    const symptomRule = INTENT_RULES.find((rule) => rule.key === "symptom");
    if (symptomRule) {
      const existing = scoredRules.find((item) => item.rule.key === "symptom");
      if (existing) {
        existing.score += 4;
      } else {
        scoredRules.push({ rule: symptomRule, score: 4 });
      }
    }
  }

  if (scoredRules.length > 0) {
    scoredRules.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (INTENT_PRIORITY[b.rule.key] || 0) - (INTENT_PRIORITY[a.rule.key] || 0);
    });
    return scoredRules[0].rule;
  }

  const cleanedIntent = normalizeText(rawIntent)
    .replace(/^intent[:：-]?\s*/i, "")
    .replace(/[{}"]/g, "")
    .trim();

  if (!cleanedIntent || cleanedIntent.length > 40) {
    return DEFAULT_INTENT_RULE;
  }

  return {
    ...DEFAULT_INTENT_RULE,
    label: cleanedIntent,
  };
}

function normalizeIntentLabel(rawIntent, originalMessage = "") {
  return findIntentRule(rawIntent, originalMessage).label;
}

const POPULAR_QUESTION_INTENT_GROUPS = {
  food: ["food"],
  exercise: ["exercise"],
  glucose: ["glucose", "symptom"],
  report: ["medicine", "report", "general"],
};

const POPULAR_QUESTION_EXCLUDED_TEXTS = [
  ...new Set([...INTENT_RULES.map((rule) => rule.label), DEFAULT_INTENT_RULE.label]),
];

const INTENT_DISPLAY_LABELS = {
  food: "อาหาร",
  exercise: "ออกกำลังกาย",
  glucose: "คุมน้ำตาล",
  symptom: "อาการผิดปกติ",
  medicine: "ยาและการรักษา",
  report: "ความรู้เรื่องโรค",
  general: "คำถามทั่วไป",
};

function normalizePopularQuestionCategory(rawCategory) {
  const category = normalizeText(rawCategory).toLowerCase();

  if (category === "knowledge") return "report";
  if (Object.prototype.hasOwnProperty.call(POPULAR_QUESTION_INTENT_GROUPS, category)) {
    return category;
  }

  return "report";
}

const KNOWLEDGE_INTENT_KEYS = new Set([
  "general",
  "greeting",
  "food",
  "glucose",
  "symptom",
  "exercise",
  "medicine",
  "report",
]);

function normalizeKnowledgeIntent(rawIntent) {
  const intent = normalizeText(rawIntent).toLowerCase();
  return KNOWLEDGE_INTENT_KEYS.has(intent) ? intent : "general";
}

function formatKnowledgeEntry(entry) {
  return {
    id: Number(entry?.id) || 0,
    title: normalizeText(entry?.title),
    content: normalizeText(entry?.content),
    tags: normalizeText(entry?.tags),
    intentKey: normalizeKnowledgeIntent(entry?.intent_key || entry?.intentKey),
    isEnabled: Boolean(entry?.is_enabled ?? entry?.isEnabled),
    sortOrder: Number(entry?.sort_order ?? entry?.sortOrder) || 0,
    createdAt: entry?.created_at || entry?.createdAt || null,
    updatedAt: entry?.updated_at || entry?.updatedAt || null,
  };
}

async function getRelevantKnowledgeEntries(intentKey, limit = 4) {
  const normalizedIntent = normalizeKnowledgeIntent(intentKey);
  const limitValue = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 10) : 4;

  const entries = await db.all(
    `SELECT id, title, content, intent_key, tags, is_enabled, sort_order, created_at, updated_at
     FROM knowledge_entries
     WHERE is_enabled = TRUE
       AND (intent_key = ? OR intent_key = 'general')
     ORDER BY
       CASE
         WHEN intent_key = ? THEN 0
         WHEN intent_key = 'general' THEN 1
         ELSE 2
       END,
       sort_order DESC,
       updated_at DESC,
       id DESC
     LIMIT ?`,
    [normalizedIntent, normalizedIntent, limitValue]
  );

  return entries.map(formatKnowledgeEntry);
}

function buildKnowledgeContextText(entries = []) {
  const cleanEntries = Array.isArray(entries)
    ? entries.filter((entry) => normalizeText(entry?.content) || normalizeText(entry?.title))
    : [];

  if (!cleanEntries.length) return "";

  return cleanEntries
    .map((entry, index) => {
      const title = normalizeText(entry.title) || `ความรู้ที่ ${index + 1}`;
      const content = normalizeText(entry.content);
      const tags = normalizeText(entry.tags);
      const tagText = tags ? ` [tags: ${tags}]` : "";
      return `${index + 1}. ${title}${tagText}\n   ${content}`;
    })
    .join("\n");
}

function validateKnowledgePayload(payload) {
  if (!normalizeText(payload?.title)) return "กรุณาระบุหัวข้อความรู้";
  if (!normalizeText(payload?.content)) return "กรุณาระบุเนื้อหาความรู้";

  if (normalizeText(payload?.title).length > 120) return "หัวข้อความรู้ควรยาวไม่เกิน 120 ตัวอักษร";
  if (normalizeText(payload?.content).length > 3000) return "เนื้อหาความรู้ควรยาวไม่เกิน 3000 ตัวอักษร";
  if (!KNOWLEDGE_INTENT_KEYS.has(normalizeKnowledgeIntent(payload?.intentKey))) {
    return "หมวดความรู้ไม่ถูกต้อง";
  }

  return "";
}

function getIntentDisplayLabel(intentKey) {
  return INTENT_DISPLAY_LABELS[intentKey] || "คำถามทั่วไป";
}

const BENCHMARK_INTENT_ORDER = [
  "general",
  "greeting",
  "food",
  "glucose",
  "symptom",
  "exercise",
  "medicine",
  "report",
];

function parseCsvText(text) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index];
    const nextCharacter = cleanText[index + 1];

    if (inQuotes) {
      if (character === '"') {
        if (nextCharacter === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (character === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    if (character === '\r') {
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function buildBenchmarkEvaluation(rows = []) {
  const labelSet = new Set(BENCHMARK_INTENT_ORDER);
  for (const row of rows) {
    labelSet.add(String(row.expected_intent_key || row.expectedIntentKey || "").trim().toLowerCase());
    labelSet.add(String(row.predicted_intent_key || row.predictedIntentKey || "").trim().toLowerCase());
  }

  const labels = [...labelSet].filter(Boolean);
  const labelIndex = new Map(labels.map((label, index) => [label, index]));
  const matrix = labels.map(() => labels.map(() => 0));

  const normalizedRows = rows.map((row) => ({
    actualIntentKey: String(row.expected_intent_key || row.expectedIntentKey || "").trim().toLowerCase(),
    predictedIntentKey: String(row.predicted_intent_key || row.predictedIntentKey || "").trim().toLowerCase(),
  }));

  for (const row of normalizedRows) {
    const actualIndex = labelIndex.get(row.actualIntentKey);
    const predictedIndex = labelIndex.get(row.predictedIntentKey);
    if (actualIndex == null || predictedIndex == null) continue;
    matrix[actualIndex][predictedIndex] += 1;
  }

  const perClass = labels.map((label, rowIndex) => {
    const tp = matrix[rowIndex][rowIndex];
    const fn = matrix[rowIndex].reduce(
      (sum, value, columnIndex) => (columnIndex === rowIndex ? sum : sum + value),
      0
    );
    const fp = matrix.reduce(
      (sum, currentRow, currentRowIndex) => (currentRowIndex === rowIndex ? sum : sum + currentRow[rowIndex]),
      0
    );
    const support = matrix[rowIndex].reduce((sum, value) => sum + value, 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      intentKey: label,
      label: getIntentDisplayLabel(label),
      support,
      tp,
      fp,
      fn,
      precision,
      recall,
      f1,
    };
  });

  const total = normalizedRows.length;
  const correct = matrix.reduce((sum, currentRow, index) => sum + (currentRow[index] || 0), 0);
  const accuracy = total ? correct / total : 0;
  const macroPrecision = perClass.length
    ? perClass.reduce((sum, item) => sum + item.precision, 0) / perClass.length
    : 0;
  const macroRecall = perClass.length
    ? perClass.reduce((sum, item) => sum + item.recall, 0) / perClass.length
    : 0;
  const macroF1 = perClass.length ? perClass.reduce((sum, item) => sum + item.f1, 0) / perClass.length : 0;

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

async function recordChatLog({ userId, message, intentKey, responseModel, usedFallback }) {
  const questionText = normalizeText(message);
  if (!questionText) return null;

  const row = await db.get(
    `INSERT INTO ai_chat_logs (user_id, question_text, intent_key, response_model, used_fallback)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id`,
    [
      userId || null,
      questionText,
      intentKey || "general",
      normalizeText(responseModel || ""),
      usedFallback === true,
    ]
  );

  return Number(row?.id) || null;
}

function validateProfilePayload(payload) {
  return (
    validateName(payload?.name) ||
    validateWeight(payload?.weight) ||
    validateHeight(payload?.height) ||
    validateStage(payload?.stage) ||
    validateTreatment(payload?.treatment) ||
    validateAllergy(payload?.allergy || "")
  );
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derivedKey).toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;

  if (!storedPassword.startsWith("scrypt$")) {
    return password === storedPassword;
  }

  const [, salt, storedHash] = storedPassword.split("$");
  if (!salt || !storedHash) return false;

  const derivedKey = await scrypt(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");
  const derivedBuffer = Buffer.from(derivedKey);

  if (storedBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedBuffer);
}

async function generateWithFallback(prompt) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.35,
        },
      });

      return { text: response.text, model };
    } catch (error) {
      lastError = error;
      console.error(`Gemini request failed for model "${model}"`, error);
    }
  }

  throw lastError ?? new Error("No Gemini model configured");
}

function buildIntentFallbackResponse({ intent, lastGlucose }) {
  const glucoseText = lastGlucose?.value ? `${lastGlucose.value} mg/dL` : null;
  const baseText = intent?.fallback || DEFAULT_INTENT_RULE.fallback;

  if (intent?.key === "glucose" && glucoseText) {
    return `${baseText} ค่าอ่านล่าสุดของคุณคือ ${glucoseText} ถ้าต้องการ ผมช่วยแปลผลให้ละเอียดขึ้นได้ค่ะ`;
  }

  return baseText;
}

function buildDiabetesChatPrompt({ user, lastGlucose, message, intent, knowledgeEntries = [] }) {
  const glucoseText = lastGlucose?.value
    ? `${lastGlucose.value} mg/dL (${lastGlucose.phase || "ไม่ระบุช่วงเวลา"})`
    : "ยังไม่มีข้อมูล";
  const knowledgeText = buildKnowledgeContextText(knowledgeEntries);

  return `
คุณคือผู้ช่วยสุขภาพภาษาไทยสำหรับผู้ป่วยเบาหวาน ชื่อ "หมอ AI"
ตอบด้วยน้ำเสียงสุภาพ อบอุ่น อ่านง่าย และสั้นพอดีกับหน้าจอมือถือ
หัวข้อที่ควรโฟกัสคือ: ${intent?.label || DEFAULT_INTENT_RULE.label}

ความรู้เพิ่มเติมจากแอดมิน:
${knowledgeText ? knowledgeText : "- ยังไม่มีข้อมูลเพิ่มเติม"}

ข้อมูลผู้ใช้:
- ชื่อ: ${user.name || "ผู้ใช้"}
- ระยะเบาหวาน: ${user.stage || "ไม่ระบุ"}
- BMI: ${user.bmi || "ไม่ระบุ"}
- วิธีดูแล/รักษา: ${user.treatment || "ไม่ระบุ"}
- แพ้ยา: ${user.allergy || "ไม่ระบุ"}
- ค่าน้ำตาลล่าสุด: ${glucoseText}

คำถามผู้ใช้:
"${message}"

กติกาการตอบ:
1. ตอบเป็นภาษาไทยเท่านั้น และใช้คำลงท้ายแบบสุภาพ "ค่ะ"
2. ตอบไม่เกิน 8 บรรทัด
3. เริ่มด้วยคำตอบตรงประเด็น 1 ประโยค
4. ต่อด้วยคำแนะนำที่ทำได้จริง 3-5 ข้อ
5. ตอบให้ตรงกับหัวข้อที่กำหนด ไม่ออกนอกเรื่อง
6. ถ้าเป็นค่าน้ำตาล ให้บอกความหมายแบบเข้าใจง่าย และควรวัดซ้ำ/สังเกตอาการเมื่อไร
7. ถ้ามีสัญญาณอันตราย เช่น หมดสติ หายใจลำบาก เจ็บหน้าอก ซึมมาก น้ำตาลสูงมากหรือต่ำมาก ให้แนะนำพบแพทย์หรือฉุกเฉินทันที
8. ห้ามสั่งหยุดยา เพิ่มยา หรือเปลี่ยนยาเอง ให้แนะนำปรึกษาแพทย์
9. ห้ามอ้างว่าเป็นการวินิจฉัยแน่นอน
10. ห้ามใช้ markdown หนัก ๆ เช่นตัวหนาหรือหัวข้อยาว
`.trim();
}

app.get("/api/push-public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    chatModels: GEMINI_MODELS,
    sessionConfigured: Boolean(SESSION_SECRET),
    pushConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
  });
});

app.post("/api/register", async (req, res) => {
  const username = normalizeText(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const requestedName = normalizeText(req.body?.name);
  const name = requestedName || username;

  try {
    const validationError = validateUsername(username) || validatePassword(password);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingUser = await db.get("SELECT * FROM users WHERE username = ?", [username]);
    if (existingUser) {
      return res.status(400).json({ message: "ชื่อผู้ใช้งานนี้ถูกใช้งานแล้ว" });
    }

    const passwordHash = await hashPassword(password);

    await db.run("INSERT INTO users (username, password, name) VALUES (?, ?, ?)", [
      username,
      passwordHash,
      name,
    ]);

    res.json({ status: "success", message: "สมัครสมาชิกสำเร็จ" });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "สมัครสมาชิกไม่สำเร็จ" });
  }
});

app.post("/api/login", async (req, res) => {
  const username = normalizeText(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  try {
    const validationError = validateUsername(username) || validatePassword(password);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
    const isValidPassword = user ? await verifyPassword(password, user.password) : false;

    if (!user || !isValidPassword) {
      return res.status(401).json({ message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" });
    }

    if (!user.password.startsWith("scrypt$")) {
      const upgradedHash = await hashPassword(password);
      await db.run("UPDATE users SET password = ? WHERE id = ?", [upgradedHash, user.id]);
      user.password = upgradedHash;
    }

    const safeUser = getSafeUser(user);
    const signedSession = createSession(user.id);
    setSessionCookie(res, signedSession);

    res.json({ status: "success", user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "ระบบเข้าสู่ระบบขัดข้อง" });
  }
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ status: "success" });
});

app.post("/api/admin/login", async (req, res) => {
  const username = normalizeText(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  try {
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง" });
    }

    const signedSession = createAdminSession(username);
    setAdminSessionCookie(res, signedSession);
    return res.json({
      status: "success",
      admin: {
        username,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ error: "เข้าสู่ระบบแอดมินไม่สำเร็จ" });
  }
});

app.post("/api/admin/logout", (_req, res) => {
  clearAdminSessionCookie(res);
  res.json({ status: "success" });
});

app.get("/api/admin/session", requireAdminAuth, (req, res) => {
  res.json({ status: "success", admin: req.adminUser });
});

app.get("/api/session", requireAuth, async (req, res) => {
  res.json({ status: "success", user: req.authUser });
});

app.get("/api/satisfaction-survey/status", requireAuth, async (req, res) => {
  try {
    const status = await getSurveyStatusForUser(req.authUser.id);
    res.json(status);
  } catch (error) {
    console.error("Fetch satisfaction survey status error:", error);
    res.status(500).json({ error: "ดึงสถานะแบบประเมินไม่สำเร็จ" });
  }
});

app.post("/api/satisfaction-survey", requireAuth, async (req, res) => {
  const payload = normalizeSurveyPayload(req.body);

  try {
    const validationError = validateSurveyPayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.run(
      `INSERT INTO satisfaction_surveys (
         user_id, gender, age_range, respondent_status, smartphone_experience,
         usability_score, ui_score, information_score, comment, issues, suggestions, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         gender = EXCLUDED.gender,
         age_range = EXCLUDED.age_range,
         respondent_status = EXCLUDED.respondent_status,
         smartphone_experience = EXCLUDED.smartphone_experience,
         usability_score = EXCLUDED.usability_score,
         ui_score = EXCLUDED.ui_score,
         information_score = EXCLUDED.information_score,
         comment = EXCLUDED.comment,
         issues = EXCLUDED.issues,
         suggestions = EXCLUDED.suggestions,
         updated_at = NOW()`,
      [
        req.authUser.id,
        payload.gender,
        payload.ageRange,
        payload.respondentStatus,
        payload.smartphoneExperience,
        payload.usabilityScore,
        payload.uiScore,
        payload.informationScore,
        payload.comment,
        payload.issues,
        payload.suggestions,
      ]
    );

    const status = await getSurveyStatusForUser(req.authUser.id);
    return res.json({
      status: "success",
      message: "บันทึกแบบประเมินความพึงพอใจเรียบร้อยแล้ว",
      surveyStatus: status,
    });
  } catch (error) {
    console.error("Save satisfaction survey error:", error);
    return res.status(500).json({ error: "บันทึกแบบประเมินไม่สำเร็จ" });
  }
});

app.get("/api/reminders", requireAuth, async (req, res) => {
  try {
    const reminders = await getMealReminders(req.authUser.id);
    res.json({ reminders });
  } catch (error) {
    console.error("Fetch reminders error:", error);
    res.status(500).json({ error: "ดึงรายการแจ้งเตือนไม่สำเร็จ" });
  }
});

app.put("/api/reminders", requireAuth, async (req, res) => {
  const reminders = req.body?.reminders;

  try {
    const validationError = validateReminderList(reminders);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await saveMealReminders(req.authUser.id, reminders);
    const savedReminders = await getMealReminders(req.authUser.id);
    res.json({ status: "success", reminders: savedReminders });
  } catch (error) {
    console.error("Save reminders error:", error);
    res.status(500).json({ error: "บันทึกรายการแจ้งเตือนไม่สำเร็จ" });
  }
});

app.post("/api/push-subscriptions", requireAuth, async (req, res) => {
  const subscription = req.body?.subscription;

  try {
    const validationError = validatePushSubscription(subscription);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.run(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent`,
      [
        req.authUser.id,
        normalizeText(subscription.endpoint),
        normalizeText(subscription.keys?.p256dh),
        normalizeText(subscription.keys?.auth),
        normalizeText(req.headers["user-agent"] || ""),
      ]
    );

    res.json({ status: "success" });
  } catch (error) {
    console.error("Save push subscription error:", error);
    res.status(500).json({ error: "บันทึกการสมัครรับแจ้งเตือนไม่สำเร็จ" });
  }
});

app.delete("/api/push-subscriptions", requireAuth, async (req, res) => {
  const endpoint = normalizeText(req.body?.endpoint);

  try {
    if (!endpoint) {
      return res.status(400).json({ error: "กรุณาระบุ subscription ที่ต้องการลบ" });
    }

    await deletePushSubscription(endpoint);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Delete push subscription error:", error);
    res.status(500).json({ error: "ลบการสมัครรับแจ้งเตือนไม่สำเร็จ" });
  }
});

app.post("/api/update-profile", requireAuth, async (req, res) => {
  const payload = {
    id: req.authUser.id,
    name: normalizeText(req.body?.name),
    weight: toNumber(req.body?.weight),
    height: toNumber(req.body?.height),
    stage: String(req.body?.stage ?? ""),
    allergy: normalizeText(req.body?.allergy || ""),
    treatment: String(req.body?.treatment ?? ""),
  };

  try {
    const validationError = validateProfilePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const heightMeters = payload.height / 100;
    const bmi = (payload.weight / (heightMeters * heightMeters)).toFixed(1);

    await db.run(
      `UPDATE users SET
        name = ?,
        weight = ?,
        height = ?,
        bmi = ?,
        stage = ?,
        allergy = ?,
        treatment = ?
       WHERE id = ?`,
      [
        payload.name,
        payload.weight,
        payload.height,
        bmi,
        payload.stage,
        payload.allergy || "ไม่มี",
        payload.treatment,
        req.authUser.id,
      ]
    );

    const updatedUser = await db.get("SELECT * FROM users WHERE id = ?", [req.authUser.id]);
    res.json({
      status: "success",
      message: "อัปเดตโปรไฟล์สำเร็จ",
      user: getSafeUser(updatedUser),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "บันทึกข้อมูลไม่สำเร็จ" });
  }
});

app.post("/api/chat", requireAuth, async (req, res) => {
  const message = normalizeText(req.body?.message);

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ text: "ระบบ AI ยังไม่ได้ตั้งค่า API key" });
    }

    const validationError = validateChatMessage(message);
    if (validationError) {
      return res.status(400).json({ text: validationError });
    }

    const lastGlucose = await getLatestGlucoseRecord(req.authUser.id);
    const intent = findIntentRule("", message);
    const knowledgeEntries = await getRelevantKnowledgeEntries(intent?.key, 4);

    const prompt = buildDiabetesChatPrompt({
      user: req.authUser,
      lastGlucose,
      message,
      intent,
      knowledgeEntries,
    });

    try {
      const { text, model } = await generateWithFallback(prompt);
      const cleanedText = normalizeText(text).replace(/\n{3,}/g, "\n\n");

      if (!cleanedText) {
        const chatLogId = await recordChatLog({
          userId: req.authUser.id,
          message,
          intentKey: intent?.key,
          responseModel: "fallback",
          usedFallback: true,
        });
        return res.json({
          text: buildIntentFallbackResponse({ intent, lastGlucose }),
          model: "fallback",
          intentKey: intent?.key,
          usedFallback: true,
          chatLogId,
        });
      }

      const chatLogId = await recordChatLog({
        userId: req.authUser.id,
        message,
        intentKey: intent?.key,
        responseModel: model,
        usedFallback: false,
      });
      return res.json({ text: cleanedText, model, intentKey: intent?.key, usedFallback: false, chatLogId });
    } catch (error) {
      console.error("Chat error:", error);
      const chatLogId = await recordChatLog({
        userId: req.authUser.id,
        message,
        intentKey: intent?.key,
        responseModel: "fallback",
        usedFallback: true,
      });
      return res.json({
        text: buildIntentFallbackResponse({ intent, lastGlucose }),
        model: "fallback",
        intentKey: intent?.key,
        usedFallback: true,
        chatLogId,
      });
    }
  } catch (error) {
    console.error("Chat error:", error);
    const details = error?.message ? ` (${error.message})` : "";
    res.status(500).json({ text: `ขออภัยค่ะ หมอ AI ติดขัดเล็กน้อย${details}` });
  }
});

app.get("/api/glucose", requireAuth, async (req, res) => {
  try {
    const history = await db.all(
      "SELECT * FROM glucose_history WHERE user_id = ? ORDER BY recorded_at DESC NULLS LAST, id DESC",
      [req.authUser.id]
    );

    return res.json(history);
  } catch (error) {
    console.error("Fetch glucose error:", error);
    return res.status(500).json({ error: "ดึงข้อมูลค่าน้ำตาลไม่สำเร็จ" });
  }
});

app.post("/api/glucose", requireAuth, async (req, res) => {
  const payload = {
    value: req.body?.value,
    phase: req.body?.phase,
    date: req.body?.date,
    time: req.body?.time,
    recordedAt: req.body?.recordedAt,
    reminderSlotKey: req.body?.reminderSlotKey,
  };

  try {
    const validationError =
      validateGlucoseValue(payload.value) ||
      validateGlucosePhase(payload.phase) ||
      validateDateText(payload.date) ||
      validateTimeText(payload.time) ||
      validateRecordedAt(payload.recordedAt);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.run(
      "INSERT INTO glucose_history (user_id, value, phase, date, time, recorded_at, reminder_slot_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        req.authUser.id,
        Number.parseInt(payload.value, 10),
        String(payload.phase),
        normalizeText(payload.date),
        normalizeText(payload.time),
        normalizeText(payload.recordedAt) || new Date().toISOString(),
        normalizeText(payload.reminderSlotKey),
      ]
    );

    return res.json({ status: "success" });
  } catch (error) {
    console.error("Save glucose error:", error);
    return res.status(500).json({ error: "บันทึกค่าน้ำตาลไม่สำเร็จ" });
  }
});

/* Legacy duplicate routes kept for reference but disabled to avoid overlapping handlers.
app.get("/api/reminders", requireAuth, async (req, res) => {
  try {
    const reminders = await getMealReminders(req.authUser.id);
    res.json({ reminders });
  } catch (error) {
    console.error("Fetch reminders error:", error);
    res.status(500).json({ error: "ดึงรายการแจ้งเตือนไม่สำเร็จ" });
  }
});

app.put("/api/reminders", requireAuth, async (req, res) => {
  const reminders = req.body?.reminders;

  try {
    const validationError = validateReminderList(reminders);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await saveMealReminders(req.authUser.id, reminders);
    const savedReminders = await getMealReminders(req.authUser.id);
    res.json({ status: "success", reminders: savedReminders });
  } catch (error) {
    console.error("Save reminders error:", error);
    res.status(500).json({ error: "บันทึกรายการแจ้งเตือนไม่สำเร็จ" });
  }
});

app.post("/api/push-subscriptions", requireAuth, async (req, res) => {
  const subscription = req.body?.subscription;

  try {
    const validationError = validatePushSubscription(subscription);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.run(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent`,
      [
        req.authUser.id,
        normalizeText(subscription.endpoint),
        normalizeText(subscription.keys?.p256dh),
        normalizeText(subscription.keys?.auth),
        normalizeText(req.headers["user-agent"] || ""),
      ]
    );

    res.json({ status: "success" });
  } catch (error) {
    console.error("Save push subscription error:", error);
    res.status(500).json({ error: "บันทึกการสมัครรับแจ้งเตือนไม่สำเร็จ" });
  }
});

app.delete("/api/push-subscriptions", requireAuth, async (req, res) => {
  const endpoint = normalizeText(req.body?.endpoint);

  try {
    if (!endpoint) {
      return res.status(400).json({ error: "กรุณาระบุ subscription ที่ต้องการลบ" });
    }

    await deletePushSubscription(endpoint);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Delete push subscription error:", error);
    res.status(500).json({ error: "ลบการสมัครรับแจ้งเตือนไม่สำเร็จ" });
  }
});

app.post("/api/update-profile", requireAuth, async (req, res) => {
  const payload = {
    id: req.authUser.id,
    name: normalizeText(req.body?.name),
    weight: toNumber(req.body?.weight),
    height: toNumber(req.body?.height),
    stage: String(req.body?.stage ?? ""),
    allergy: normalizeText(req.body?.allergy || ""),
    treatment: String(req.body?.treatment ?? ""),
  };

  try {
    const validationError = validateProfilePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const heightMeters = payload.height / 100;
    const bmi = (payload.weight / (heightMeters * heightMeters)).toFixed(1);

    await db.run(
      `UPDATE users SET
        name = ?,
        weight = ?,
        height = ?,
        bmi = ?,
        stage = ?,
        allergy = ?,
        treatment = ?
       WHERE id = ?`,
      [
        payload.name,
        payload.weight,
        payload.height,
        bmi,
        payload.stage,
        payload.allergy || "ไม่มี",
        payload.treatment,
        req.authUser.id,
      ]
    );

    const updatedUser = await db.get("SELECT * FROM users WHERE id = ?", [req.authUser.id]);
    res.json({
      status: "success",
      message: "อัปเดตโปรไฟล์สำเร็จ",
      user: getSafeUser(updatedUser),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "บันทึกข้อมูลไม่สำเร็จ" });
  }
});

app.post("/api/chat", requireAuth, async (req, res) => {
  const message = normalizeText(req.body?.message);

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ text: "ระบบ AI ยังไม่ได้ตั้งค่า API key" });
    }

    const validationError = validateChatMessage(message);
    if (validationError) {
      return res.status(400).json({ text: validationError });
    }

    const lastGlucose = await getLatestGlucoseRecord(req.authUser.id);
    const intent = findIntentRule("", message);
    const knowledgeEntries = await getRelevantKnowledgeEntries(intent?.key, 4);

    const prompt = buildDiabetesChatPrompt({
      user: req.authUser,
      lastGlucose,
      message,
      intent,
      knowledgeEntries,
    });

    try {
      const { text, model } = await generateWithFallback(prompt);
      const cleanedText = normalizeText(text).replace(/\n{3,}/g, "\n\n");

      if (!cleanedText) {
        const chatLogId = await recordChatLog({
          userId: req.authUser.id,
          message,
          intentKey: intent?.key,
          responseModel: "fallback",
          usedFallback: true,
        });
        return res.json({
          text: buildIntentFallbackResponse({ intent, lastGlucose }),
          model: "fallback",
          intentKey: intent?.key,
          usedFallback: true,
          chatLogId,
        });
      }

      const chatLogId = await recordChatLog({
        userId: req.authUser.id,
        message,
        intentKey: intent?.key,
        responseModel: model,
        usedFallback: false,
      });
      return res.json({ text: cleanedText, model, intentKey: intent?.key, usedFallback: false, chatLogId });
    } catch (error) {
      console.error("Chat error:", error);
      const chatLogId = await recordChatLog({
        userId: req.authUser.id,
        message,
        intentKey: intent?.key,
        responseModel: "fallback",
        usedFallback: true,
      });
      return res.json({
        text: buildIntentFallbackResponse({ intent, lastGlucose }),
        model: "fallback",
        intentKey: intent?.key,
        usedFallback: true,
        chatLogId,
      });
    }
  } catch (error) {
    console.error("Chat error:", error);
    const details = error?.message ? ` (${error.message})` : "";
    res.status(500).json({ text: `ขออภัยค่ะ หมอ AI ติดขัดเล็กน้อย${details}` });
  }
});

app.get("/api/glucose", requireAuth, async (req, res) => {
  try {
    const history = await db.all(
      "SELECT * FROM glucose_history WHERE user_id = ? ORDER BY recorded_at DESC NULLS LAST, id DESC",
      [req.authUser.id]
    );

    return res.json(history);
  } catch (error) {
    console.error("Fetch glucose error:", error);
    return res.status(500).json({ error: "ดึงข้อมูลค่าน้ำตาลไม่สำเร็จ" });
  }
});

app.post("/api/glucose", requireAuth, async (req, res) => {
  const payload = {
    value: req.body?.value,
    phase: req.body?.phase,
    date: req.body?.date,
    time: req.body?.time,
    recordedAt: req.body?.recordedAt,
    reminderSlotKey: req.body?.reminderSlotKey,
  };

  try {
    const validationError =
      validateGlucoseValue(payload.value) ||
      validateGlucosePhase(payload.phase) ||
      validateDateText(payload.date) ||
      validateTimeText(payload.time) ||
      validateRecordedAt(payload.recordedAt);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.run(
      "INSERT INTO glucose_history (user_id, value, phase, date, time, recorded_at, reminder_slot_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        req.authUser.id,
        Number.parseInt(payload.value, 10),
        String(payload.phase),
        normalizeText(payload.date),
        normalizeText(payload.time),
        normalizeText(payload.recordedAt) || new Date().toISOString(),
        normalizeText(payload.reminderSlotKey),
      ]
    );

    return res.json({ status: "success" });
  } catch (error) {
    console.error("Save glucose error:", error);
    return res.status(500).json({ error: "บันทึกค่าน้ำตาลไม่สำเร็จ" });
  }
});
*/

app.get("/api/admin/health", requireAdminAuth, async (_req, res) => {
  try {
    const dbHealth = await db.get("SELECT NOW() AS current_time");
    res.json({
      status: "ok",
      services: {
        backend: true,
        database: Boolean(dbHealth?.current_time),
        aiConfigured: Boolean(process.env.GEMINI_API_KEY),
        pushConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
        adminConfigured: Boolean(ADMIN_USERNAME && ADMIN_PASSWORD),
        sessionConfigured: Boolean(SESSION_SECRET),
      },
      chatModels: GEMINI_MODELS,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Fetch admin health error:", error);
    res.status(500).json({ error: "ดึงสถานะระบบไม่สำเร็จ" });
  }
});

app.get("/api/admin/overview", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const overview = await getAdminOverview({
      db,
      range,
      excludedTexts: POPULAR_QUESTION_EXCLUDED_TEXTS,
      getIntentDisplayLabel,
    });
    res.json(overview);
  } catch (error) {
    console.error("Fetch admin overview error:", error);
    res.status(500).json({ error: "ดึงภาพรวมแอดมินไม่สำเร็จ" });
  }
});

app.get("/api/admin/quality", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const quality = await getAdminQuality({
      db,
      range,
      getIntentDisplayLabel,
    });
    res.json(quality);
  } catch (error) {
    console.error("Fetch admin quality error:", error);
    res.status(500).json({ error: "ดึงข้อมูลคุณภาพ AI ไม่สำเร็จ" });
  }
});

app.get("/api/admin/evaluation", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const search = normalizeText(req.query?.search);
    const limitValue = Number.parseInt(String(req.query?.limit || "40"), 10);
    const offsetValue = Number.parseInt(String(req.query?.offset || "0"), 10);
    const result = await getAdminEvaluation({
      db,
      range,
      search,
      limit: Number.isNaN(limitValue) ? 40 : limitValue,
      offset: Number.isNaN(offsetValue) ? 0 : offsetValue,
      getIntentDisplayLabel,
    });
    res.json(result);
  } catch (error) {
    console.error("Fetch admin evaluation error:", error);
    res.status(500).json({ error: "ดึงข้อมูลประเมินความถูกต้องไม่สำเร็จ" });
  }
});

app.get("/api/admin/evaluation/benchmark", requireAdminAuth, async (_req, res) => {
  try {
    const csvText = readFileSync(new URL("./generated/evaluation-benchmark-1000.csv", import.meta.url), "utf8");
    const rows = parseCsvText(csvText);

    if (rows.length < 2) {
      return res.status(404).json({ error: "ไม่พบไฟล์ benchmark หรือไฟล์ยังไม่มีข้อมูล" });
    }

    const [headerRow, ...dataRows] = rows;
    const headerIndex = new Map(headerRow.map((value, index) => [String(value || "").trim(), index]));
    const expectedIndex = headerIndex.get("expected_intent_key");
    const predictedIndex = headerIndex.get("predicted_intent_key");

    if (expectedIndex == null || predictedIndex == null) {
      return res.status(400).json({ error: "ไฟล์ benchmark ต้องมีคอลัมน์ expected_intent_key และ predicted_intent_key" });
    }

    const benchmarkRows = dataRows
      .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
      .map((row) => ({
        expected_intent_key: String(row[expectedIndex] || "").trim().toLowerCase(),
        predicted_intent_key: String(row[predictedIndex] || "").trim().toLowerCase(),
      }))
      .filter((row) => row.expected_intent_key && row.predicted_intent_key);

    const evaluation = buildBenchmarkEvaluation(benchmarkRows);
    const labels = evaluation.labels.map((intentKey) => ({
      intentKey,
      label: getIntentDisplayLabel(intentKey),
    }));

    res.json({
      summary: {
        totalReviewed: evaluation.summary.total,
        accuracy: Number(evaluation.summary.accuracy.toFixed(3)),
        macroPrecision: Number(evaluation.summary.macroPrecision.toFixed(3)),
        macroRecall: Number(evaluation.summary.macroRecall.toFixed(3)),
        macroF1: Number(evaluation.summary.macroF1.toFixed(3)),
      },
      labels,
      confusionMatrix: {
        labels,
        rows: evaluation.labels.map((actualIntentKey, rowIndex) => ({
          actualIntentKey,
          actualLabel: getIntentDisplayLabel(actualIntentKey),
          cells: evaluation.labels.map((predictedIntentKey, columnIndex) => ({
            predictedIntentKey,
            predictedLabel: getIntentDisplayLabel(predictedIntentKey),
            count: evaluation.matrix[rowIndex][columnIndex],
          })),
        })),
      },
      classMetrics: evaluation.perClass.map((item) => ({
        ...item,
        precision: Number(item.precision.toFixed(3)),
        recall: Number(item.recall.toFixed(3)),
        f1: Number(item.f1.toFixed(3)),
      })),
      reviewQueue: [],
      updatedAt: new Date().toISOString(),
      source: "benchmark-file",
    });
  } catch (error) {
    console.error("Fetch admin benchmark evaluation error:", error);
    res.status(500).json({ error: "อ่านไฟล์ benchmark ไม่สำเร็จ" });
  }
});

app.post("/api/admin/evaluation/:chatLogId", requireAdminAuth, async (req, res) => {
  try {
    const result = await upsertChatEvaluation({
      db,
      chatLogId: req.params?.chatLogId,
      actualIntentKey: req.body?.actualIntentKey,
      notes: req.body?.notes,
      getIntentDisplayLabel,
    });
    res.json({ status: "success", item: result });
  } catch (error) {
    console.error("Save admin evaluation error:", error);
    res.status(500).json({ error: error.message || "บันทึกการประเมินไม่สำเร็จ" });
  }
});

app.delete("/api/admin/evaluation/:chatLogId", requireAdminAuth, async (req, res) => {
  try {
    const deleted = await deleteChatEvaluation({ db, chatLogId: req.params?.chatLogId });
    if (!deleted) {
      return res.status(404).json({ error: "ไม่พบรายการประเมิน" });
    }
    res.json({ status: "success" });
  } catch (error) {
    console.error("Delete admin evaluation error:", error);
    res.status(500).json({ error: error.message || "ลบการประเมินไม่สำเร็จ" });
  }
});

app.get("/api/admin/knowledge", requireAdminAuth, async (_req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, title, content, intent_key, tags, is_enabled, sort_order, created_at, updated_at
       FROM knowledge_entries
       ORDER BY is_enabled DESC, sort_order DESC, updated_at DESC, id DESC`
    );

    res.json({ items: rows.map(formatKnowledgeEntry) });
  } catch (error) {
    console.error("Fetch admin knowledge error:", error);
    res.status(500).json({ error: "à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸²à¸™à¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ" });
  }
});

app.post("/api/admin/knowledge", requireAdminAuth, async (req, res) => {
  const payload = {
    title: normalizeText(req.body?.title),
    content: normalizeText(req.body?.content),
    intentKey: normalizeKnowledgeIntent(req.body?.intentKey),
    tags: normalizeText(req.body?.tags),
    sortOrder: Number.parseInt(String(req.body?.sortOrder ?? "0"), 10) || 0,
    isEnabled: req.body?.isEnabled !== false,
  };

  try {
    const validationError = validateKnowledgePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await db.run(
      `INSERT INTO knowledge_entries (title, content, intent_key, tags, is_enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        payload.title,
        payload.content,
        payload.intentKey,
        payload.tags,
        payload.isEnabled,
        payload.sortOrder,
      ]
    );

    const created = await db.get(
      `SELECT id, title, content, intent_key, tags, is_enabled, sort_order, created_at, updated_at
       FROM knowledge_entries
       WHERE id = ?`,
      [result?.lastID]
    );

    res.status(201).json({
      status: "success",
      item: created ? formatKnowledgeEntry(created) : null,
    });
  } catch (error) {
    console.error("Create admin knowledge error:", error);
    res.status(500).json({ error: "à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ" });
  }
});

app.patch("/api/admin/knowledge/:id", requireAdminAuth, async (req, res) => {
  const id = Number.parseInt(String(req.params?.id), 10);

  try {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "à¸£à¸«à¸±à¸ªà¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡" });
    }

    const existing = await db.get(
      `SELECT id, title, content, intent_key, tags, is_enabled, sort_order, created_at, updated_at
       FROM knowledge_entries
       WHERE id = ?`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: "à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰" });
    }

    const nextPayload = {
      title: req.body?.title !== undefined ? normalizeText(req.body?.title) : normalizeText(existing.title),
      content:
        req.body?.content !== undefined ? normalizeText(req.body?.content) : normalizeText(existing.content),
      intentKey:
        req.body?.intentKey !== undefined
          ? normalizeKnowledgeIntent(req.body?.intentKey)
          : normalizeKnowledgeIntent(existing.intent_key),
      tags: req.body?.tags !== undefined ? normalizeText(req.body?.tags) : normalizeText(existing.tags),
      sortOrder:
        req.body?.sortOrder !== undefined
          ? Number.parseInt(String(req.body?.sortOrder), 10) || 0
          : Number(existing.sort_order) || 0,
      isEnabled:
        req.body?.isEnabled !== undefined ? Boolean(req.body?.isEnabled) : Boolean(existing.is_enabled),
    };

    const validationError = validateKnowledgePayload(nextPayload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.run(
      `UPDATE knowledge_entries
       SET title = ?, content = ?, intent_key = ?, tags = ?, is_enabled = ?, sort_order = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        nextPayload.title,
        nextPayload.content,
        nextPayload.intentKey,
        nextPayload.tags,
        nextPayload.isEnabled,
        nextPayload.sortOrder,
        id,
      ]
    );

    const updated = await db.get(
      `SELECT id, title, content, intent_key, tags, is_enabled, sort_order, created_at, updated_at
       FROM knowledge_entries
       WHERE id = ?`,
      [id]
    );

    res.json({
      status: "success",
      item: updated ? formatKnowledgeEntry(updated) : null,
    });
  } catch (error) {
    console.error("Update admin knowledge error:", error);
    res.status(500).json({ error: "à¸­à¸±à¸›à¹€à¸”à¸•à¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ" });
  }
});

app.delete("/api/admin/knowledge/:id", requireAdminAuth, async (req, res) => {
  const id = Number.parseInt(String(req.params?.id), 10);

  try {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "à¸£à¸«à¸±à¸ªà¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡" });
    }

    const result = await db.run("DELETE FROM knowledge_entries WHERE id = ?", [id]);
    if (!result?.changes) {
      return res.status(404).json({ error: "à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰" });
    }

    res.json({ status: "success" });
  } catch (error) {
    console.error("Delete admin knowledge error:", error);
    res.status(500).json({ error: "à¸¥à¸šà¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ" });
  }
});

app.get("/api/admin/users", requireAdminAuth, async (req, res) => {
  try {
    const search = normalizeText(req.query?.search);
    const limitValue = Number.parseInt(String(req.query?.limit || "50"), 10);
    const offsetValue = Number.parseInt(String(req.query?.offset || "0"), 10);
    const result = await getAdminUsers({
      db,
      search,
      limit: Number.isNaN(limitValue) ? 50 : limitValue,
      offset: Number.isNaN(offsetValue) ? 0 : offsetValue,
    });
    res.json(result);
  } catch (error) {
    console.error("Fetch admin users error:", error);
    res.status(500).json({ error: "ดึงรายชื่อผู้ใช้ไม่สำเร็จ" });
  }
});

app.get("/api/admin/users/:id", requireAdminAuth, async (req, res) => {
  try {
    const detail = await getAdminUserDetail({ db, userId: req.params?.id });
    if (!detail) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้รายนี้" });
    }
    res.json(detail);
  } catch (error) {
    console.error("Fetch admin user detail error:", error);
    res.status(500).json({ error: "ดึงรายละเอียดผู้ใช้ไม่สำเร็จ" });
  }
});

app.get("/api/admin/records", requireAdminAuth, async (req, res) => {
  try {
    const type = normalizeText(req.query?.type) || "all";
    const search = normalizeText(req.query?.search);
    const userId = normalizeText(req.query?.userId);
    const phase = normalizeText(req.query?.phase);
    const limitValue = Number.parseInt(String(req.query?.limit || "100"), 10);
    const offsetValue = Number.parseInt(String(req.query?.offset || "0"), 10);

    const result = await getAdminRecords({
      db,
      type,
      search,
      userId,
      phase,
      range: getAdminDateRange(req),
      limit: Number.isNaN(limitValue) ? 100 : limitValue,
      offset: Number.isNaN(offsetValue) ? 0 : offsetValue,
    });

    res.json(result);
  } catch (error) {
    console.error("Fetch admin records error:", error);
    res.status(500).json({ error: "ดึงรายการบันทึกไม่สำเร็จ" });
  }
});

app.delete("/api/admin/records/:type/:id", requireAdminAuth, async (req, res) => {
  const type = normalizeText(req.params?.type).toLowerCase();
  const id = Number.parseInt(String(req.params?.id), 10);

  try {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "รหัสรายการไม่ถูกต้อง" });
    }

    if (type === "glucose") {
      const result = await db.run("DELETE FROM glucose_history WHERE id = ?", [id]);
      if (!result?.changes) {
        return res.status(404).json({ error: "ไม่พบรายการน้ำตาล" });
      }
      return res.json({ status: "success" });
    }

    if (type === "chat") {
      const result = await db.run("DELETE FROM ai_chat_logs WHERE id = ?", [id]);
      if (!result?.changes) {
        return res.status(404).json({ error: "ไม่พบรายการคำถาม" });
      }
      return res.json({ status: "success" });
    }

    return res.status(400).json({ error: "ประเภทรายการไม่ถูกต้อง" });
  } catch (error) {
    console.error("Delete admin record error:", error);
    res.status(500).json({ error: "ลบรายการไม่สำเร็จ" });
  }
});

app.get("/api/admin/anomalies", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const highThresholdValue = Number.parseInt(String(req.query?.highThreshold || "250"), 10);
    const lowThresholdValue = Number.parseInt(String(req.query?.lowThreshold || "70"), 10);
    const minFallbackCountValue = Number.parseInt(String(req.query?.minFallbackCount || "3"), 10);

    const result = await getAdminAnomalies({
      db,
      range,
      highThreshold: Number.isNaN(highThresholdValue) ? 250 : highThresholdValue,
      lowThreshold: Number.isNaN(lowThresholdValue) ? 70 : lowThresholdValue,
      minFallbackCount: Number.isNaN(minFallbackCountValue) ? 3 : minFallbackCountValue,
    });
    res.json(result);
  } catch (error) {
    console.error("Fetch admin anomalies error:", error);
    res.status(500).json({ error: "ดึง anomaly ไม่สำเร็จ" });
  }
});

app.get("/api/admin/export/users.csv", requireAdminAuth, async (req, res) => {
  try {
    const csv = await exportAdminUsersCsv({ db, search: normalizeText(req.query?.search) });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="admin-users.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export admin users error:", error);
    res.status(500).json({ error: "ส่งออกรายชื่อผู้ใช้ไม่สำเร็จ" });
  }
});

app.get("/api/admin/export/records.csv", requireAdminAuth, async (req, res) => {
  try {
    const csv = await exportAdminRecordsCsv({
      db,
      type: normalizeText(req.query?.type) || "all",
      search: normalizeText(req.query?.search),
      userId: normalizeText(req.query?.userId),
      phase: normalizeText(req.query?.phase),
      range: getAdminDateRange(req),
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="admin-records.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export admin records error:", error);
    res.status(500).json({ error: "ส่งออกรายการไม่สำเร็จ" });
  }
});

app.get("/api/admin/export/anomalies.csv", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const csv = await exportAdminAnomaliesCsv({ db, range });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="admin-anomalies.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export admin anomalies error:", error);
    res.status(500).json({ error: "ส่งออก anomaly ไม่สำเร็จ" });
  }
});

app.get("/api/admin/export/evaluation.csv", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const csv = await exportAdminEvaluationCsv({
      db,
      range,
      search: normalizeText(req.query?.search),
      getIntentDisplayLabel,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="admin-evaluation.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export admin evaluation error:", error);
    res.status(500).json({ error: "ส่งออก evaluation ไม่สำเร็จ" });
  }
});

app.get("/api/admin/export/questions.csv", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const csv = await exportAdminQuestionsCsv({
      db,
      range,
      excludedTexts: POPULAR_QUESTION_EXCLUDED_TEXTS,
      getIntentDisplayLabel,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="admin-questions.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export admin questions error:", error);
    res.status(500).json({ error: "ส่งออกข้อมูลคำถามไม่สำเร็จ" });
  }
});

app.get("/api/admin/export/fallbacks.csv", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const csv = await exportAdminFallbacksCsv({
      db,
      range,
      getIntentDisplayLabel,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="admin-fallbacks.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export admin fallbacks error:", error);
    res.status(500).json({ error: "ส่งออกข้อมูล fallback ไม่สำเร็จ" });
  }
});

app.get("/api/admin/export/knowledge.csv", requireAdminAuth, async (_req, res) => {
  try {
    const csv = await exportAdminKnowledgeCsv({ db });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="admin-knowledge.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export admin knowledge error:", error);
    res.status(500).json({ error: "ส่งออกข้อมูลความรู้ไม่สำเร็จ" });
  }
});

app.get("/api/admin/stats", requireAdminAuth, async (req, res) => {
  try {
    const range = getAdminDateRange(req);
    const stats = await getAdminStats({
      db,
      range,
      excludedTexts: POPULAR_QUESTION_EXCLUDED_TEXTS,
      getIntentDisplayLabel,
    });
    res.json(stats);
  } catch (error) {
    console.error("Fetch admin stats error:", error);
    res.status(500).json({ error: "ดึงข้อมูลสถิติล้มเหลว" });
  }
});

app.get("/api/questions/popular", requireAuth, async (req, res) => {
  try {
    const category = normalizePopularQuestionCategory(req.query?.category);
    const limitValue = Number.parseInt(String(req.query?.limit || "5"), 10);
    const limit = Number.isNaN(limitValue) ? 5 : Math.min(Math.max(limitValue, 1), 10);
    const intentKeys = POPULAR_QUESTION_INTENT_GROUPS[category] || POPULAR_QUESTION_INTENT_GROUPS.report;

    const questions = await db.all(
      `SELECT question_text, intent_key, COUNT(*)::int AS count, MAX(created_at) AS updated_at
       FROM ai_chat_logs
       WHERE intent_key = ANY(?)
         AND question_text <> ALL(?)
       GROUP BY question_text, intent_key
       ORDER BY count DESC, updated_at DESC, question_text ASC
       LIMIT ?`,
      [intentKeys, POPULAR_QUESTION_EXCLUDED_TEXTS, limit]
    );

    res.json({
      category,
      questions,
    });
  } catch (error) {
    console.error("Fetch popular questions error:", error);
    res.status(500).json({ error: "ดึงคำถามยอดนิยมไม่สำเร็จ" });
  }
});

app.get("/api/questions/history", requireAuth, async (req, res) => {
  try {
    const category = normalizePopularQuestionCategory(req.query?.category);
    const limitValue = Number.parseInt(String(req.query?.limit || "10"), 10);
    const limit = Number.isNaN(limitValue) ? 10 : Math.min(Math.max(limitValue, 1), 20);
    const intentKeys = POPULAR_QUESTION_INTENT_GROUPS[category] || POPULAR_QUESTION_INTENT_GROUPS.report;

    const questions = await db.all(
      `SELECT question_text, intent_key, COUNT(*)::int AS count, MAX(created_at) AS updated_at
       FROM ai_chat_logs
       WHERE user_id = ?
         AND intent_key = ANY(?)
       GROUP BY question_text, intent_key
       ORDER BY updated_at DESC, count DESC, question_text ASC
       LIMIT ?`,
      [req.authUser.id, intentKeys, limit]
    );

    res.json({
      category,
      questions,
    });
  } catch (error) {
    console.error("Fetch user question history error:", error);
    res.status(500).json({ error: "ดึงประวัติคำถามของคุณไม่สำเร็จ" });
  }
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

runReminderScheduler().catch((error) => {
  console.error("Initial reminder scheduler run failed:", error);
});
setInterval(() => {
  runReminderScheduler().catch((error) => {
    console.error("Reminder scheduler tick failed:", error);
  });
}, 30000);

if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => console.log(`Backend ready on http://${HOST}:${PORT}`));
}

export default app;
