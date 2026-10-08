import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import nodemailer from "nodemailer";

// ─── Queue definitions ────────────────────────────────────────
const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"),
};

export const emailQueue = new Queue("emails", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const aiQueue = new Queue("ai-jobs", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

export const notificationQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 1000 },
  },
});

// ─── Email job types ──────────────────────────────────────────
export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface AIJobData {
  type: "summarize" | "suggest-assignee" | "predict-deadline" | "sprint-plan";
  taskId: string;
  projectId: string;
  payload: Record<string, unknown>;
}

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

// ─── Queue jobs ───────────────────────────────────────────────
export async function queueEmail(data: EmailJobData): Promise<void> {
  await emailQueue.add("send-email", data);
}

export async function queueAIJob(data: AIJobData): Promise<string> {
  const job = await aiQueue.add(data.type, data);
  return job.id ?? "";
}

export async function queueNotification(data: NotificationJobData): Promise<void> {
  await notificationQueue.add("send-notification", data);
}

// ─── Email transporter ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Email worker (runs in separate process in production) ────
export function startEmailWorker(): Worker {
  return new Worker<EmailJobData>(
    "emails",
    async (job: Job<EmailJobData>) => {
      const { to, subject, html, text } = job.data;
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        text,
      });
      console.log(`[Email Worker] Sent email to ${to}: ${subject}`);
    },
    {
      connection,
      concurrency: 5,
    }
  );
}

// ─── Email templates ──────────────────────────────────────────
export function dueDateReminderEmail(
  userName: string,
  taskTitle: string,
  dueDate: string,
  taskUrl: string
): EmailJobData {
  return {
    to: "", // filled by caller
    subject: `⏰ Task due soon: ${taskTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Upcoming Deadline Reminder</h2>
        <p>Hi ${userName},</p>
        <p>Your task <strong>"${taskTitle}"</strong> is due on <strong>${dueDate}</strong>.</p>
        <a href="${taskUrl}" style="
          display: inline-block;
          background: #6366f1;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 16px;
        ">View Task</a>
      </div>
    `,
  };
}

export function inviteEmail(
  inviterName: string,
  orgName: string,
  inviteUrl: string
): EmailJobData {
  return {
    to: "", // filled by caller
    subject: `You've been invited to join ${orgName} on ProjectHub`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">You're invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on ProjectHub.</p>
        <a href="${inviteUrl}" style="
          display: inline-block;
          background: #6366f1;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 16px;
        ">Accept Invitation</a>
      </div>
    `,
  };
}
