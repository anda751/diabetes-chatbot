const USERNAME_REGEX = /^[A-Za-z0-9._-]{4,20}$/;

export const PROFILE_STAGE_OPTIONS = ['1', '2', '3'];
export const TREATMENT_OPTIONS = ['กินยา', 'ฉีดยา', 'ไม่มี'];
export const GLUCOSE_PHASE_OPTIONS = ['before', 'after'];

export function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateUsername(username) {
  const value = normalizeText(username);

  if (!value) return 'กรุณากรอกชื่อผู้ใช้งาน';
  if (!USERNAME_REGEX.test(value)) {
    return 'ชื่อผู้ใช้งานต้องยาว 4-20 ตัว และใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข . _ -';
  }

  return '';
}

export function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';

  if (!value) return 'กรุณากรอกรหัสผ่าน';
  if (value.length < 4) return 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร';
  if (value.length > 64) return 'รหัสผ่านยาวเกินไป กรุณาใช้ไม่เกิน 64 ตัวอักษร';

  return '';
}

export function validateName(name) {
  const value = normalizeText(name);

  if (!value) return 'กรุณากรอกชื่อ-นามสกุล';
  if (value.length < 2) return 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร';
  if (value.length > 80) return 'ชื่อ-นามสกุลยาวเกินไป กรุณากรอกไม่เกิน 80 ตัวอักษร';

  return '';
}

export function validateWeight(weight) {
  const value = Number(weight);

  if (!Number.isFinite(value)) return 'กรุณากรอกน้ำหนักเป็นตัวเลข';
  if (value < 20 || value > 300) return 'น้ำหนักควรอยู่ระหว่าง 20 ถึง 300 กิโลกรัม';

  return '';
}

export function validateHeight(height) {
  const value = Number(height);

  if (!Number.isFinite(value)) return 'กรุณากรอกส่วนสูงเป็นตัวเลข';
  if (value < 100 || value > 250) return 'ส่วนสูงควรอยู่ระหว่าง 100 ถึง 250 เซนติเมตร';

  return '';
}

export function validateStage(stage) {
  if (!PROFILE_STAGE_OPTIONS.includes(String(stage))) {
    return 'กรุณาเลือกระยะของโรคให้ถูกต้อง';
  }

  return '';
}

export function validateTreatment(treatment) {
  if (!TREATMENT_OPTIONS.includes(String(treatment))) {
    return 'กรุณาเลือกรูปแบบการดูแลให้ถูกต้อง';
  }

  return '';
}

export function validateAllergy(allergy) {
  const value = normalizeText(allergy);

  if (value.length > 200) return 'ข้อมูลการแพ้ยาควรยาวไม่เกิน 200 ตัวอักษร';

  return '';
}

export function validateGlucoseValue(glucose) {
  const value = Number(glucose);

  if (!Number.isFinite(value)) return 'กรุณากรอกค่าน้ำตาลเป็นตัวเลข';
  if (value < 20 || value > 600) return 'ค่าน้ำตาลควรอยู่ระหว่าง 20 ถึง 600 mg/dL';

  return '';
}

export function validateGlucosePhase(phase) {
  if (!GLUCOSE_PHASE_OPTIONS.includes(String(phase))) {
    return 'ช่วงเวลาบันทึกค่าน้ำตาลไม่ถูกต้อง';
  }

  return '';
}

export function validateProfileForm(formData) {
  return (
    validateName(formData?.name) ||
    validateWeight(formData?.weight) ||
    validateHeight(formData?.height) ||
    validateStage(formData?.stage) ||
    validateTreatment(formData?.treatment) ||
    validateAllergy(formData?.allergy || '')
  );
}

export function validateChatMessage(message) {
  const value = normalizeText(message);

  if (!value) return 'กรุณาพิมพ์ข้อความก่อนส่ง';
  if (value.length > 1000) return 'ข้อความยาวเกินไป กรุณาพิมพ์ไม่เกิน 1000 ตัวอักษร';

  return '';
}
