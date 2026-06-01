import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { getIO } from '../socket';

interface NotifyOpts {
  type:        NotificationType;
  recipientId: string;
  actorId:     string;
  blogId?:     string;
}

export async function notify(opts: NotifyOpts) {
  if (opts.recipientId === opts.actorId) return; // no self-notifications

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
