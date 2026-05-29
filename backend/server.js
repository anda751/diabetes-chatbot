import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";
import { initDB } from "./database.js";

dotenv.config();

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

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

const SESSION_COOKIE_NAME = "diabetes_session";
const SESSION_TTL_MS = Number.parseInt(process.env.SESSION_TTL_MS || "", 10) || 1000 * 60 * 60 * 24 * 7;
const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.GEMINI_API_KEY || "local-dev-session-secret";
const SESSION_COOKIE_SAME_SITE = process.env.SESSION_COOKIE_SAME_SITE?.trim() || "Lax";
const SESSION_COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "true" ||
  SESSION_COOKIE_SAME_SITE.toLowerCase() === "none" ||
  Boolean(process.env.VERCEL);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const db = await initDB();

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
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

function setSessionCookie(res, signedSession) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signedSession)}`,
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

function clearSessionCookie(res) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
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

function getSafeUser(user) {
  if (!user) return null;
  const { password: _password, ...safeUserData } = user;
  return safeUserData;
}

async function getLatestGlucoseRecord(userId) {
  return db.get(
    "SELECT * FROM glucose_history WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [userId]
  );
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

function validateChatMessage(message) {
  const value = normalizeText(message);
  if (!value) return "กรุณาระบุข้อความที่ต้องการถาม";
  if (value.length > 1000) return "ข้อความยาวเกินไป กรุณาพิมพ์ไม่เกิน 1000 ตัวอักษร";
  return "";
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
    keywords: ["สวัสดี", "hello", "hi", "ทักทาย", "หวัดดี"],
    promptHint: "ถ้าเป็นการทักทาย ให้ตอบสั้น อบอุ่น และชวนถามต่อได้เลย",
    fallback:
      "สวัสดีค่ะ วันนี้อยากให้หมอ AI ช่วยดูเรื่องอาหาร ค่าน้ำตาล อาการ หรือยา ก็บอกได้เลยนะคะ",
  },
  {
    key: "food",
    label: "แนะนำอาหาร",
    keywords: ["อาหาร", "กิน", "เมนู", "มื้อ", "ผลไม้", "ข้าว", "หวาน", "เครื่องดื่ม"],
    promptHint: "ถ้าเป็นเรื่องอาหาร ให้เน้นเมนูที่เหมาะ ปริมาณที่ควรระวัง และตัวอย่างที่ทำตามได้จริง",
    fallback:
      "ถ้าอยากคุมเบาหวานให้ดี ลองเน้นผัก โปรตีนไม่ติดมัน และลดน้ำหวานหรือของหวานลงก่อนค่ะ",
  },
  {
    key: "glucose",
    label: "ประเมินค่าน้ำตาล",
    keywords: ["น้ำตาล", "mg/dl", "mgdl", "ก่อนอาหาร", "หลังอาหาร", "สูงไหม", "ต่ำไหม"],
    promptHint: "ถ้าเป็นตัวเลขค่าน้ำตาล ให้แปลความหมายแบบเข้าใจง่าย บอกเป้าหมายคร่าว ๆ และแนะนำการสังเกตอาการ",
    fallback:
      "ค่าน้ำตาลตัวเลขนี้ใช้ดูแนวโน้มได้ค่ะ ถ้าสูงหรือต่ำกว่าปกติบ่อย ๆ ควรจดเวลาอาหาร อาการ และคุยกับคุณหมอค่ะ",
  },
  {
    key: "symptom",
    label: "อาการผิดปกติ",
    keywords: ["หน้ามืด", "เวียนหัว", "ใจสั่น", "เหงื่อ", "อาการ", "ฉุกเฉิน", "โรงพยาบาล", "อันตราย"],
    promptHint: "ถ้าเป็นอาการผิดปกติ ให้ประเมินความเร่งด่วน ชี้สัญญาณอันตราย และบอกให้ไปพบแพทย์ทันทีเมื่อจำเป็น",
    fallback:
      "ถ้ามีหน้ามืด ใจสั่น เหงื่อแตก ซึมมาก หายใจลำบาก หรือเจ็บหน้าอก ให้รีบไปโรงพยาบาลหรือโทรฉุกเฉินทันทีค่ะ",
  },
  {
    key: "exercise",
    label: "ออกกำลังกาย",
    keywords: ["เดิน", "ออกกำลังกาย", "วิ่ง", "โยคะ", "ขยับ", "เผาผลาญ"],
    promptHint: "ถ้าเป็นเรื่องออกกำลังกาย ให้แนะนำแบบปลอดภัย เหมาะกับผู้สูงอายุ และเริ่มทีละน้อย",
    fallback:
      "เริ่มจากการเดินเบา ๆ หรือขยับร่างกายหลังอาหาร 10-15 นาที จะช่วยให้ร่างกายใช้น้ำตาลได้ดีขึ้นค่ะ",
  },
  {
    key: "medicine",
    label: "ยาและการรักษา",
    keywords: ["ยา", "ฉีด", "อินซูลิน", "รักษา", "แพ้ยา", "หมอ", "แพทย์"],
    promptHint: "ถ้าเกี่ยวกับยา ให้ย้ำว่าไม่ควรปรับยาเอง และควรคุยกับแพทย์หรือเภสัชกรเมื่อมีข้อสงสัย",
    fallback:
      "เรื่องยาอย่าปรับเองนะคะ ถ้ามีข้อสงสัยเรื่องยา ฉีด หรือผลข้างเคียง ควรปรึกษาคุณหมอหรือเภสัชกรที่ดูแลอยู่ค่ะ",
  },
  {
    key: "report",
    label: "รายงานสุขภาพ",
    keywords: ["รายงาน", "ประวัติ", "สรุป", "กราฟ", "แนวโน้ม"],
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

function findIntentRule(rawIntent, originalMessage = "") {
  const source = `${normalizeText(rawIntent)} ${normalizeText(originalMessage)}`.toLowerCase();
  const matchedRule = INTENT_RULES.find((rule) =>
    rule.keywords.some((keyword) => source.includes(keyword))
  );

  if (matchedRule) return matchedRule;

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

function buildDiabetesChatPrompt({ user, lastGlucose, message, intent }) {
  const glucoseText = lastGlucose?.value
    ? `${lastGlucose.value} mg/dL (${lastGlucose.phase || "ไม่ระบุช่วงเวลา"})`
    : "ยังไม่มีข้อมูล";

  return `
คุณคือผู้ช่วยสุขภาพภาษาไทยสำหรับผู้ป่วยเบาหวาน ชื่อ "หมอ AI"
ตอบด้วยน้ำเสียงสุภาพ อบอุ่น อ่านง่าย และสั้นพอดีกับหน้าจอมือถือ
หัวข้อที่ควรโฟกัสคือ: ${intent?.label || DEFAULT_INTENT_RULE.label}

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

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    chatModels: GEMINI_MODELS,
    sessionConfigured: Boolean(SESSION_SECRET),
  });
});

app.post("/api/register", async (req, res) => {
  const username = normalizeText(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const name = normalizeText(req.body?.name);

  try {
    const validationError =
      validateUsername(username) ||
      validatePassword(password) ||
      validateName(name);

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

app.get("/api/session", requireAuth, async (req, res) => {
  res.json({ status: "success", user: req.authUser });
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

    try {
      await db.run(
        `INSERT INTO question_stats (question_text, count)
         VALUES (?, 1)
         ON CONFLICT(question_text) DO UPDATE
         SET count = question_stats.count + 1`,
        [intent.label]
      );
    } catch (error) {
      console.warn("Intent recording error:", error?.message || error);
    }

    const prompt = buildDiabetesChatPrompt({
      user: req.authUser,
      lastGlucose,
      message,
      intent,
    });

    try {
      const { text, model } = await generateWithFallback(prompt);
      const cleanedText = normalizeText(text).replace(/\n{3,}/g, "\n\n");

      if (!cleanedText) {
        return res.json({
          text: buildIntentFallbackResponse({ intent, lastGlucose }),
          model: "fallback",
        });
      }

      return res.json({ text: cleanedText, model });
    } catch (error) {
      console.error("Chat error:", error);
      return res.json({
        text: buildIntentFallbackResponse({ intent, lastGlucose }),
        model: "fallback",
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
      "SELECT * FROM glucose_history WHERE user_id = ? ORDER BY id DESC",
      [req.authUser.id]
    );

    res.json(history);
  } catch (error) {
    console.error("Fetch glucose error:", error);
    res.status(500).json({ error: "ดึงข้อมูลล้มเหลว" });
  }
});

app.post("/api/glucose", requireAuth, async (req, res) => {
  const payload = {
    value: req.body?.value,
    phase: req.body?.phase,
    date: req.body?.date,
    time: req.body?.time,
  };

  try {
    const validationError =
      validateGlucoseValue(payload.value) ||
      validateGlucosePhase(payload.phase) ||
      validateDateText(payload.date) ||
      validateTimeText(payload.time);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.run(
      "INSERT INTO glucose_history (user_id, value, phase, date, time) VALUES (?, ?, ?, ?, ?)",
      [
        req.authUser.id,
        Number.parseInt(payload.value, 10),
        String(payload.phase),
        normalizeText(payload.date),
        normalizeText(payload.time),
      ]
    );

    res.json({ status: "success" });
  } catch (error) {
    console.error("Save glucose error:", error);
    res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
});

app.get("/api/admin/stats", async (_req, res) => {
  try {
    const stats = await db.all("SELECT * FROM question_stats ORDER BY count DESC");
    res.json(stats);
  } catch (error) {
    console.error("Fetch admin stats error:", error);
    res.status(500).json({ error: "ดึงข้อมูลสถิติล้มเหลว" });
  }
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => console.log(`Backend ready on http://${HOST}:${PORT}`));
}

export default app;
