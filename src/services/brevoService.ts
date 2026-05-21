const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const SENDER = {
  name: process.env.BREVO_SENDER_NAME || 'BeLife',
  email: process.env.BREVO_SENDER_EMAIL || 'noreply@belife.site',
};

interface EmailParams {
  to: string;
  toName: string;
  subject: string;
  htmlContent: string;
}

export class BrevoService {
  static async sendEmail({ to, toName, subject, htmlContent }: EmailParams) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error('❌ BREVO_API_KEY is not set');
      throw new Error('Email service not configured');
    }

    const body = JSON.stringify({
      sender: SENDER,
      to: [{ email: to, name: toName }],
      subject,
      htmlContent,
    });

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Brevo API error ${response.status}:`, errorText);
      throw new Error(`Brevo API returned ${response.status}: ${errorText}`);
    }

    console.log(`✉️ Email sent to ${to} — subject: "${subject}"`);
    return response.json();
  }

  static async sendVerificationEmail(to: string, name: string, token: string) {
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    return this.sendEmail({
      to, toName: name,
      subject: 'Verify your BeLife account',
      htmlContent: this.verifyEmailTemplate(name, verifyLink),
    });
  }

  static async sendPasswordResetEmail(to: string, name: string, token: string) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    return this.sendEmail({
      to, toName: name,
      subject: 'Reset your BeLife password',
      htmlContent: this.passwordResetTemplate(name, resetLink),
    });
  }

  static async sendWelcomeEmail(to: string, name: string) {
    return this.sendEmail({
      to, toName: name,
      subject: 'Welcome to BeLife!',
      htmlContent: this.welcomeTemplate(name),
    });
  }

  static async sendAccountDeletionEmail(to: string, name: string, token: string) {
    const deleteLink = `${process.env.FRONTEND_URL}/delete-account/${token}`;
    return this.sendEmail({
      to, toName: name,
      subject: '⚠️ Confirm your BeLife account deletion',
      htmlContent: this.accountDeletionTemplate(name, deleteLink),
    });
  }

  static async sendNewsletterWelcome(to: string) {
    return this.sendEmail({
      to, toName: 'Friend',
      subject: 'Welcome to the BeLife newsletter!',
      htmlContent: this.newsletterTemplate(),
    });
  }

  // ===== EMAIL TEMPLATES =====

  private static verifyEmailTemplate(name: string, link: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #FBF9F1; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(45,66,32,0.1); }
    .header { background: linear-gradient(135deg, #2D4220 0%, #5A7A3F 100%); padding: 40px; text-align: center; }
    .logo { color: #FBF9F1; font-size: 32px; font-weight: bold; font-family: Georgia, serif; }
    .content { padding: 40px; color: #1F3015; line-height: 1.6; }
    h1 { font-family: Georgia, serif; color: #2D4220; font-size: 26px; margin-bottom: 16px; }
    .btn { display: inline-block; background: #2D4220; color: #ffffff !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; font-size: 15px; }
    .footer { background: #F5F1E4; padding: 24px; text-align: center; color: #5A7A3F; font-size: 13px; }
    .divider { height: 1px; background: #EFE9D5; margin: 24px 0; }
    .link { font-size: 12px; color: #5A7A3F; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:40px">🌿</div>
      <div class="logo">BeLife</div>
    </div>
    <div class="content">
      <h1>Hi ${name}, welcome to BeLife!</h1>
      <p>Thank you for joining our community of mindful living and sustainability enthusiasts.</p>
      <p>Click the button below to verify your email and activate your account:</p>
      <center><a href="${link}" class="btn">Verify My Email</a></center>
      <div class="divider"></div>
      <p style="font-size:13px;color:#5A7A3F">If the button doesn't work, copy and paste this link:</p>
      <p class="link">${link}</p>
      <p style="font-size:13px;color:#5A7A3F">This link will expire in 24 hours.</p>
    </div>
    <div class="footer">
      <p>Made with love for the planet 🌍</p>
      <p>© ${new Date().getFullYear()} BeLife. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private static passwordResetTemplate(name: string, link: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #FBF9F1; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #2D4220 0%, #5A7A3F 100%); padding: 40px; text-align: center; }
    .logo { color: #FBF9F1; font-size: 32px; font-weight: bold; font-family: Georgia, serif; }
    .content { padding: 40px; color: #1F3015; line-height: 1.6; }
    h1 { font-family: Georgia, serif; color: #2D4220; font-size: 26px; }
    .btn { display: inline-block; background: #2D4220; color: #ffffff !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .warning { background: #FFF8E1; border-left: 4px solid #FFB300; padding: 16px; margin: 24px 0; border-radius: 8px; font-size: 14px; }
    .footer { background: #F5F1E4; padding: 24px; text-align: center; color: #5A7A3F; font-size: 13px; }
    .link { font-size: 12px; color: #5A7A3F; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:40px">🔐</div>
      <div class="logo">BeLife</div>
    </div>
    <div class="content">
      <h1>Hi ${name},</h1>
      <p>We received a request to reset your BeLife password.</p>
      <p>Click the button below to set a new password:</p>
      <center><a href="${link}" class="btn">Reset My Password</a></center>
      <div class="warning">⚠️ <strong>This link expires in 1 hour.</strong> If you didn't request this, ignore this email — your password won't change.</div>
      <p style="font-size:13px;color:#5A7A3F">Or copy this link:</p>
      <p class="link">${link}</p>
    </div>
    <div class="footer">
      <p>Stay safe &amp; sustainable 🌿</p>
      <p>© ${new Date().getFullYear()} BeLife. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private static welcomeTemplate(name: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #FBF9F1; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #2D4220 0%, #5A7A3F 100%); padding: 50px; text-align: center; color: #FBF9F1; }
    .content { padding: 40px; color: #1F3015; line-height: 1.7; }
    .feature { background: #F5F1E4; padding: 16px 20px; border-radius: 10px; margin: 10px 0; }
    .btn { display: inline-block; background: #2D4220; color: #ffffff !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { background: #F5F1E4; padding: 24px; text-align: center; color: #5A7A3F; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:60px">🌱</div>
      <h1 style="font-family:Georgia,serif;font-size:34px;margin:0">Welcome, ${name}!</h1>
      <p style="opacity:0.9;margin-top:8px">Your green journey starts here</p>
    </div>
    <div class="content">
      <p>We're thrilled to have you in our community of eco-conscious readers!</p>
      <h2 style="color:#2D4220;font-family:Georgia,serif">What's next?</h2>
      <div class="feature">📚 <strong>Explore stories</strong> on sustainable living</div>
      <div class="feature">✍️ <strong>Share your journey</strong> by writing your own blog</div>
      <div class="feature">🌍 <strong>Connect</strong> with like-minded people</div>
      <center style="margin-top:30px">
        <a href="${process.env.FRONTEND_URL}/blogs" class="btn">Start Exploring</a>
      </center>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} BeLife. Made with 🌿 for the planet.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private static accountDeletionTemplate(name: string, link: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #FBF9F1; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%); padding: 40px; text-align: center; }
    .logo { color: #ffffff; font-size: 32px; font-weight: bold; font-family: Georgia, serif; }
    .content { padding: 40px; color: #1F3015; line-height: 1.6; }
    h1 { font-family: Georgia, serif; color: #7f1d1d; font-size: 24px; margin-bottom: 16px; }
    .warning-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 8px; margin: 20px 0; }
    .warning-box ul { margin: 8px 0 0 0; padding-left: 20px; color: #7f1d1d; font-size: 14px; }
    .warning-box li { margin-bottom: 6px; }
    .btn { display: inline-block; background: #b91c1c; color: #ffffff !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; font-size: 15px; }
    .footer { background: #F5F1E4; padding: 24px; text-align: center; color: #5A7A3F; font-size: 13px; }
    .link { font-size: 12px; color: #7f1d1d; word-break: break-all; }
    .ignore { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 18px; border-radius: 8px; font-size: 13px; color: #166534; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:40px">⚠️</div>
      <div class="logo">BeLife</div>
      <p style="color:#fecaca;margin-top:8px;font-size:14px">Account Deletion Request</p>
    </div>
    <div class="content">
      <h1>Hi ${name}, are you sure?</h1>
      <p>We received a request to permanently delete your BeLife account. Before you proceed, please understand what this means:</p>
      <div class="warning-box">
        <strong style="color:#7f1d1d">The following will be permanently deleted:</strong>
        <ul>
          <li>Your profile and all personal account data</li>
          <li>All blog posts and articles you have published</li>
          <li>All your comments and likes</li>
          <li>Your messages and conversations</li>
        </ul>
      </div>
      <p style="font-size:14px;color:#374151">
        <strong>Your content belongs to you.</strong> BeLife does not own any content you have posted.
        Once your account is deleted, your content will be removed from our platform.
      </p>
      <p style="font-weight:600;color:#7f1d1d">This action is irreversible and cannot be undone.</p>
      <center><a href="${link}" class="btn">Yes, Delete My Account</a></center>
      <p style="font-size:13px;color:#6b7280">Or copy this link: <br/><span class="link">${link}</span></p>
      <p style="font-size:13px;color:#6b7280">This link expires in <strong>1 hour</strong>.</p>
      <div class="ignore">
        🌿 <strong>Changed your mind?</strong> Simply ignore this email and your account will remain active. No action needed.
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} BeLife. We're sorry to see you go.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private static newsletterTemplate(): string {
    return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#FBF9F1;padding:40px">
  <div style="max-width:600px;margin:auto;background:white;border-radius:20px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2D4220,#5A7A3F);padding:40px;text-align:center;color:white">
      <div style="font-size:50px">🌿</div>
      <h1 style="font-family:Georgia,serif">You're in!</h1>
    </div>
    <div style="padding:40px;color:#1F3015">
      <p>Thank you for subscribing to the BeLife Newsletter!</p>
      <p>Every week, expect:</p>
      <ul>
        <li>🌍 Curated sustainability stories</li>
        <li>🌱 Practical eco-tips</li>
        <li>📚 Featured blog highlights</li>
      </ul>
      <p>Stay green!<br/>— The BeLife Team</p>
    </div>
  </div>
</body>
</html>`;
  }
}
