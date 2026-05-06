import { PrismaClient } from '../../../src/generated/prisma';
import notificationsData from '../data/notifications.json';

interface NotificationEntry {
  user_id: number;
  title: string;
  message: string;
  type: string;
  status: string;
  is_read: boolean;
  data?: Record<string, unknown>;
}

export async function seedNotifications(prisma: PrismaClient) {
  const existing = await prisma.notification.count();
  if (existing > 0) {
    console.log(`  ⏭ ${existing} notifications already exist, skipping`);
    return;
  }

  const notifications = notificationsData as NotificationEntry[];

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        user_id: BigInt(n.user_id),
        title: n.title,
        message: n.message,
        type: n.type,
        data: n.data ?? null,
        is_read: n.is_read,
        read_at: n.is_read ? new Date() : null,
        status: n.status,
      },
    });
    console.log(`  ✔ Notification: user ${n.user_id} — ${n.title}`);
  }
}
