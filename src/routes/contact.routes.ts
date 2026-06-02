import { Router } from 'express';
import { z } from 'zod';
import { BrevoService } from '../services/brevoService';

const router = Router();

const contactSchema = z.object({
  name:    z.string().trim().min(1, 'Name is required').max(100),
  email:   z.string().trim().email('Valid email is required').max(200),
  subject: z.string().trim().min(1, 'Subject is required').max(150),
  message: z.string().trim().min(1, 'Message is required').max(5000),
});

// POST /contact — deliver a contact-form submission to the support inbox.
router.post('/', async (req, res, next) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Invalid input' });
    }
    const { name, email, subject, message } = parsed.data;

    await BrevoService.sendContactEmail(name, email, subject, message);
    res.json({ message: "Thanks! Your message has been sent — we'll get back to you soon." });
  } catch (err) {
    next(err);
  }
});

export default router;
