import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';
import { encrypt, decrypt } from '../lib/encryption';

const userSelect = { id: true, name: true, avatar: true };

export async function getConversations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;

    const convs = await prisma.conversation.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: { select: userSelect },
        user2: { select: userSelect },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = convs.map((conv) => {
      const other = conv.user1Id === userId ? conv.user2 : conv.user1;
      const last = conv.messages[0];
      return {
        id: conv.id,
        other,
        lastMessage: last
          ? { content: decrypt(last.content), createdAt: last.createdAt, isRead: last.isRead, isMine: last.senderId === userId }
          : null,
        updatedAt: conv.updatedAt,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const otherId = req.params.userId;

    if (userId === otherId) return res.status(400).json({ message: 'Cannot message yourself' });

    const other = await prisma.user.findUnique({ where: { id: otherId }, select: userSelect });
    if (!other) return res.status(404).json({ message: 'User not found' });

    let conv = await prisma.conversation.findFirst({
      where: { OR: [{ user1Id: userId, user2Id: otherId }, { user1Id: otherId, user2Id: userId }] },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: userSelect } },
        },
      },
    });

    if (!conv) {
      conv = await prisma.conversation.create({
        data: { user1Id: userId, user2Id: otherId },
        include: { messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: userSelect } } } },
      });
    } else {
      const marked = await prisma.message.updateMany({
        where: { conversationId: conv.id, senderId: otherId, isRead: false },
        data: { isRead: true },
      });
      // Tell the original sender their messages were just read (live read-receipt).
      if (marked.count > 0) {
        try { getIO().to(`user:${otherId}`).emit('messages_read', { conversationId: conv.id, readerId: userId }); } catch {}
      }
    }

    res.json({
      conversationId: conv.id,
      other,
      messages: conv.messages.map((m) => ({ ...m, content: decrypt(m.content) })),
    });
  } catch (err) { next(err); }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const otherId = req.params.userId;
    const { content } = req.body;

    if (!content?.trim()) return res.status(400).json({ message: 'Message cannot be empty' });
    if (userId === otherId) return res.status(400).json({ message: 'Cannot message yourself' });

    const other = await prisma.user.findUnique({ where: { id: otherId }, select: userSelect });
    if (!other) return res.status(404).json({ message: 'User not found' });

    let conv = await prisma.conversation.findFirst({
      where: { OR: [{ user1Id: userId, user2Id: otherId }, { user1Id: otherId, user2Id: userId }] },
    });

    if (!conv) {
      conv = await prisma.conversation.create({ data: { user1Id: userId, user2Id: otherId } });
    }

    const message = await prisma.message.create({
      data: { content: encrypt(content.trim()), conversationId: conv.id, senderId: userId },
      include: { sender: { select: userSelect } },
    });

    await prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });

    const payload = { ...message, content: content.trim() };

    try { getIO().to(`user:${otherId}`).emit('new_message', payload); } catch {}

    res.status(201).json(payload);
  } catch (err) { next(err); }
}
