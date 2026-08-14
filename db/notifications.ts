import { env } from "cloudflare:workers";

type NotifyEvent = "new_task" | "money_request" | "task_submitted";

type NotifyPayload = {
  event: NotifyEvent;
  to: string[];
  subject: string;
  message: string;
  actionUrl?: string;
};

function list(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const notifyEmails = {
  alex: () => list(env.ALEX_EMAIL),
  mama: () => list(env.MAMA_EMAIL),
  otec: () => list(env.OTEC_EMAIL),
  parents: () => list(env.PARENT_EMAILS),
};

export function appUrl() {
  return env.ALEX_APP_URL || "http://192.168.31.193:3008";
}

export async function sendNotification(payload: NotifyPayload) {
  if (!env.NOTIFY_WEBHOOK_URL || !env.NOTIFY_SECRET || payload.to.length === 0) return;

  try {
    await fetch(env.NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, secret: env.NOTIFY_SECRET }),
    });
  } catch (error) {
    console.warn("Notification failed", error);
  }
}
