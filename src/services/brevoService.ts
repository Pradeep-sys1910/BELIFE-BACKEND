import * as Brevo from '@getbrevo/brevo';

const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY!
);

interface EmailParams {
  to: string;
  toName: string;
  subject: string;
  htmlContent: string;
}

const SENDER = {
  name: process.env.BREVO_SENDER_NAME || 'BeLife',
  email: process.env.BREVO_SENDER_EMAIL || 'noreply@belife.com',
};

export class BrevoService {
  static async sendEmail({ to, toName, subject, htmlContent }: EmailParams) {
    const email = new Brevo.SendSmtpEmail();
    email.sender = SENDER;
    email.to = [{ email: to, name: toName }];
    email.subject = subject;
    email.htmlContent = htmlContent;

    try {
      const result = await apiInstance.sendTransacEmail(email);
      console.log(`✉️ Email sent to ${to}`);
      return result;
    } catch (error: any) {
      console.error('❌ Brevo email error:', error.message);
      throw new Error('Failed to send email');
    }
  }

  static async sendVerificationEmail(to: string, name: string, token: string) {
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    const html = this.verifyEmailTemplate(name, verifyLink);
    return this.sendEmail({ to, toName: name, subject: '🌿 Verify your BeLife account', htmlContent: html });
  }

  static async sendPasswordResetEmail(to: string, name: string, token: string) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    const html = this.passwordResetTemplate(name, resetLink);
    return this.sendEmail({ to, toName: name, subject: '🔐 Reset your BeLife password', htmlContent: html });
  }

  static async sendWelcomeEmail(to: string, name: string) {
    const html = this.welcomeTemplate(name);
    return this.sendEmail({ to, toName: name, subject: '🌱 Welcome to BeLife!', htmlContent: html });
  }

  static async sendNewsletterWelcome(to: string) {
    const html = this.newsletterTemplate();
    return this.sendEmail({ to, toName: 'Friend', subject: '🌿 Welcome to our green community!', htmlContent: html });
  }

  // ===== EMAIL TEMPLATES =====
  
  private static verifyEmailTemplate(name: string, link: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #FBF9F1; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(45, 66, 32, 0.1); }
        .header { background: linear-gradient(135deg, #2D4220 0%, #5A7A3F 100%); padding: 40px; text-align: center; }
        .logo { color: #FBF9F1; font-size: 32px; font-weight: bold; font-family: Georgia, serif; }
        .leaf { font-size: 40px; }
        .content { padding: 40px; color: #1F3015; line-height: 1.6; }
        h1 { font-family: Georgia, serif; color: #2D4220; font-size: 28px; margin-bottom: 16px; }
        .button { display: inline-block; background: #2D4220; color: #FBF9F1 !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .footer { background: #F5F1E4; padding: 24px; text-align: center; color: #5A7A3F; font-size: 13px; }
        .divider { height: 1px; background: #EFE9D5; margin: 24px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="leaf">🌿</div>
          <div class="logo">BeLife</div>
        </div>
        <div class="content">
          <h1>Hi ${name}! Welcome to BeLife 🌱</h1>
          <p>Thank you for joining our community of mindful living and sustainability enthusiasts.</p>
          <p>To get started, please verify your email address by clicking the button below:</p>
          <center>
            <a href="${link}" class="button">Verify My Email</a>
          </center>
          <div class="divider"></div>
          <p style="font-size: 13px; color: #5A7A3F;">If the button doesn't work, copy this link:</p>
          <p style="font-size: 12px; color: #5A7A3F; word-break: break-all;">${link}</p>
          <p style="font-size: 13px; color: #5A7A3F;">This link will expire in 24 hours.</p>
        </div>
        <div class="footer">
          <p>🌍 Made with love for the planet</p>
          <p>© ${new Date().getFullYear()} BeLife. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  private static passwordResetTemplate(name: string, link: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #FBF9F1; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(45, 66, 32, 0.1); }
        .header { background: linear-gradient(135deg, #2D4220 0%, #5A7A3F 100%); padding: 40px; text-align: center; }
        .logo { color: #FBF9F1; font-size: 32px; font-weight: bold; font-family: Georgia, serif; }
        .content { padding: 40px; color: #1F3015; line-height: 1.6; }
        h1 { font-family: Georgia, serif; color: #2D4220; font-size: 28px; margin-bottom: 16px; }
        .button { display: inline-block; background: #2D4220; color: #FBF9F1 !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .warning { background: #FFF8E1; border-left: 4px solid #FFB300; padding: 16px; margin: 24px 0; border-radius: 8px; font-size: 14px; }
        .footer { background: #F5F1E4; padding: 24px; text-align: center; color: #5A7A3F; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size: 40px;">🔐</div>
          <div class="logo">BeLife</div>
        </div>
        <div class="content">
          <h1>Hi ${name},</h1>
          <p>We received a request to reset your password for your BeLife account.</p>
          <p>Click the button below to create a new password:</p>
          <center>
            <a href="${link}" class="button">Reset My Password</a>
          </center>
          <div class="warning">
            ⚠️ <strong>Security tip:</strong> This link will expire in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.
          </div>
          <p style="font-size: 13px; color: #5A7A3F;">Or copy this link:</p>
          <p style="font-size: 12px; color: #5A7A3F; word-break: break-all;">${link}</p>
        </div>
        <div class="footer">
          <p>🌿 Stay safe & sustainable</p>
          <p>© ${new Date().getFullYear()} BeLife. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  private static welcomeTemplate(name: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #FBF9F1; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #2D4220 0%, #5A7A3F 100%); padding: 50px; text-align: center; color: #FBF9F1; }
        .content { padding: 40px; color: #1F3015; line-height: 1.7; }
        .feature { background: #F5F1E4; padding: 20px; border-radius: 12px; margin: 16px 0; }
        .button { display: inline-block; background: #2D4220; color: #FBF9F1 !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #F5F1E4; padding: 24px; text-align: center; color: #5A7A3F; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size: 60px;">🌱</div>
          <h1 style="font-family: Georgia, serif; font-size: 36px; margin: 0;">Welcome, ${name}!</h1>
          <p style="font-size: 18px; opacity: 0.9;">Your green journey starts here</p>
        </div>
        <div class="content">
          <p>We're thrilled to have you in our community of <strong>10,000+ eco-conscious readers</strong>!</p>
          <h2 style="color: #2D4220; font-family: Georgia, serif;">What's next?</h2>
          <div class="feature">📚 <strong>Explore stories</strong> on sustainable living</div>
          <div class="feature">✍️ <strong>Share your journey</strong> by writing your own blog</div>
          <div class="feature">🌍 <strong>Connect</strong> with like-minded people</div>
          <center style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/blogs" class="button">Start Exploring</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} BeLife. Made with 🌿 for the planet.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  private static newsletterTemplate(): string {
    return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #FBF9F1; padding: 40px;">
      <div style="max-width: 600px; margin: auto; background: white; border-radius: 20px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #2D4220, #5A7A3F); padding: 40px; text-align: center; color: white;">
          <div style="font-size: 50px;">🌿</div>
          <h1 style="font-family: Georgia, serif;">You're in!</h1>
        </div>
        <div style="padding: 40px; color: #1F3015;">
          <p>Thank you for subscribing to the BeLife Newsletter! 🌱</p>
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