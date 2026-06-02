import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { getIO } from '../socket';

interface NotifyOpts {
  type:        NotificationType;
  recipientId: string;
  actorId:     string;
  blogId?:     string;
}

// Which preference gates which notification type (others are always delivered).
const PREF_FOR_TYPE: Partial<Record<NotificationType, 'notifyLikes' | 'notifyComments' | 'notifyFollowers'>> = {
  LIKE:    'notifyLikes',
  COMMENT: 'notifyComments',
  FOLLOW:  'notifyFollowers',
};

export async function notify(opts: NotifyOpts) {
  if (opts.recipientId === opts.actorId) return; // no self-notifications

  // Respect the recipient's notification preferences.
  const prefKey = PREF_FOR_TYPE[opts.type];
  if (prefKey) {
    const recipient = await prisma.user.findUnique({
      where: { id: opts.recipientId },
      select: { [prefKey]: true },
    });
    if (recipient && (recipient as any)[prefKey] === false) return; // user opted out
  }

  const notification = await prisma.notification.create({
    data: {
      type:        opts.type,
      recipientId: opts.recipientId,
      actorId:     opts.actorId,
      blogId:      opts.blogId,
    },
    include: {
      actor: { select: { id: true, name: true, username: true, avatar: true } },
      blog:  { select: { id: true, title: true, slug: true } },
    },
  });

  try {
    getIO().to(`user:${opts.recipientId}`).emit('notification', notification);
  } catch { /* socket not yet ready */ }

  return notification;
}
