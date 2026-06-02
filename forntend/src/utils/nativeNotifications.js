import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const REMINDER_CHANNEL_ID = 'meal-reminders';
const REMINDER_NOTIFICATION_ID_MIN = 200000;
const REMINDER_NOTIFICATION_ID_MAX = 299999;
const REMINDER_TEST_NOTIFICATION_ID = 399901;

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function buildReminderNotificationId(reminderId) {
  const text = String(reminderId || '');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 99999;
  }

  return REMINDER_NOTIFICATION_ID_MIN + hash;
}

function isManagedReminderNotification(id) {
  return id >= REMINDER_NOTIFICATION_ID_MIN && id <= REMINDER_NOTIFICATION_ID_MAX;
}

function parseReminderTime(timeText) {
  const value = String(timeText || '').trim();
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hour, minute] = value.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

export async function ensureNativeReminderNotificationsReady() {
  if (!isNativeAndroidApp()) {
    return { supported: false, granted: false, exactGranted: true };
  }

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    permission = await LocalNotifications.requestPermissions();
  }

  if (permission.display !== 'granted') {
    return { supported: true, granted: false, exactGranted: false };
  }

  await LocalNotifications.createChannel({
    id: REMINDER_CHANNEL_ID,
    name: 'เตือนเวลาอาหาร',
    description: 'แจ้งเตือนให้ทานอาหารตรงเวลา',
    importance: 5,
    vibration: true,
  });

  let exactGranted = true;
  try {
    const exactPermission = await LocalNotifications.checkExactNotificationSetting();
    exactGranted = exactPermission.exact_alarm === 'granted';
  } catch {
    exactGranted = true;
  }

  return { supported: true, granted: true, exactGranted };
}

export async function openExactAlarmSettings() {
  if (!isNativeAndroidApp()) return { supported: false };
  const result = await LocalNotifications.changeExactNotificationSetting();
  return { supported: true, ...result };
}

export async function syncNativeMealReminders(reminders) {
  if (!isNativeAndroidApp()) return;

  const status = await ensureNativeReminderNotificationsReady();
  if (!status.granted) return;

  const pending = await LocalNotifications.getPending();
  const managedNotifications = pending.notifications
    .filter((notification) => isManagedReminderNotification(notification.id))
    .map((notification) => ({ id: notification.id }));

  if (managedNotifications.length > 0) {
    await LocalNotifications.cancel({ notifications: managedNotifications });
  }

  const notifications = (Array.isArray(reminders) ? reminders : [])
    .filter((reminder) => reminder?.time && reminder?.label && reminder?.isEnabled !== false)
    .map((reminder) => {
      const parsedTime = parseReminderTime(reminder.time);
      if (!parsedTime) return null;

      return {
        id: buildReminderNotificationId(reminder.id),
        title: `ถึงเวลาทาน${reminder.label}`,
        body: `ถึงเวลา ${reminder.time} น. อย่าลืมทานอาหารให้ตรงเวลาเพื่อช่วยคุมน้ำตาลนะคะ`,
        channelId: REMINDER_CHANNEL_ID,
        autoCancel: true,
        schedule: {
          on: {
            hour: parsedTime.hour,
            minute: parsedTime.minute,
          },
          allowWhileIdle: true,
        },
        extra: {
          type: 'meal-reminder',
          reminderId: String(reminder.id),
        },
      };
    })
    .filter(Boolean);

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

export async function clearNativeMealReminders() {
  if (!isNativeAndroidApp()) return;

  const pending = await LocalNotifications.getPending();
  const managedNotifications = pending.notifications
    .filter((notification) => isManagedReminderNotification(notification.id))
    .map((notification) => ({ id: notification.id }));

  if (managedNotifications.length > 0) {
    await LocalNotifications.cancel({ notifications: managedNotifications });
  }
}

export async function scheduleNativeReminderTestNotification() {
  if (!isNativeAndroidApp()) return false;

  const status = await ensureNativeReminderNotificationsReady();
  if (!status.granted) return false;

  await LocalNotifications.cancel({
    notifications: [{ id: REMINDER_TEST_NOTIFICATION_ID }],
  });

  const testAt = new Date(Date.now() + 5000);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_TEST_NOTIFICATION_ID,
        title: 'ทดสอบการแจ้งเตือน',
        body: 'ถ้าเห็นข้อความนี้ แปลว่าแอปสามารถแจ้งเตือนบนเครื่องนี้ได้แล้วค่ะ',
        channelId: REMINDER_CHANNEL_ID,
        autoCancel: true,
        schedule: {
          at: testAt,
          allowWhileIdle: true,
        },
      },
    ],
  });

  return true;
}
