import nodemailer from "nodemailer";

// Tạo transporter cho Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Email của bạn
    pass: process.env.EMAIL_APP_PASSWORD, // App Password của Gmail
  },
});

// Tạo OTP 6 chữ số
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Gửi email OTP
export async function sendOTPEmail(
  to: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: "Xác thực email - Loopy Social Media",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #E3AADD 0%, #C8A8E9 50%, #F6BCBA 100%); padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Chào mừng đến với Loopy! 🎉</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Xác thực email của bạn</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Cảm ơn bạn đã đăng ký tài khoản Loopy! Để hoàn tất quá trình đăng ký, 
              vui lòng sử dụng mã OTP bên dưới để xác thực email của bạn.
            </p>
            
            <div style="background: white; border: 2px dashed #E3AADD; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
              <p style="margin: 0; color: #666; font-size: 14px;">Mã xác thực của bạn:</p>
              <div style="font-size: 32px; font-weight: bold; color: #E3AADD; letter-spacing: 5px; margin: 10px 0;">
                ${otp}
              </div>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 0;">
              ⏰ Mã này sẽ hết hạn sau <strong>10 phút</strong>
            </p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
            <p>© 2024 Loopy Social Media. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// Gửi email 2FA cho thiết bị mới
export async function send2FAEmail(
  to: string,
  displayName: string,
  otp: string,
  deviceName: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: "Xác thực đăng nhập từ thiết bị mới - Loopy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #E3AADD 0%, #C8A8E9 50%, #F6BCBA 100%); padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Xác thực đăng nhập</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Xin chào ${displayName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Chúng tôi phát hiện một lần đăng nhập từ thiết bị mới. Để bảo mật tài khoản của bạn, 
              vui lòng sử dụng mã xác thực bên dưới.
            </p>
            
            <div style="background: white; border: 2px dashed #E3AADD; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
              <p style="margin: 0; color: #666; font-size: 14px;">Mã xác thực của bạn:</p>
              <div style="font-size: 32px; font-weight: bold; color: #E3AADD; letter-spacing: 5px; margin: 10px 0;">
                ${otp}
              </div>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #856404;">📱 Thông tin thiết bị:</h3>
              <p style="margin: 5px 0; color: #856404;"><strong>Thiết bị:</strong> ${deviceName}</p>
              ${ipAddress ? `<p style="margin: 5px 0; color: #856404;"><strong>IP:</strong> ${ipAddress}</p>` : ""}
              <p style="margin: 5px 0; color: #856404;"><strong>Thời gian:</strong> ${new Date().toLocaleString("vi-VN")}</p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 0;">
              ⏰ Mã này sẽ hết hạn sau <strong>5 phút</strong>
            </p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>Nếu bạn không thực hiện đăng nhập này, vui lòng thay đổi mật khẩu ngay lập tức.</p>
            <p>© 2024 Loopy Social Media. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending 2FA email:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send 2FA email",
    };
  }
}

// Gửi email chào mừng sau khi xác thực thành công
export async function sendWelcomeEmail(
  to: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: "Chào mừng bạn đến với Loopy! 🎊",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #E3AADD 0%, #C8A8E9 50%, #F6BCBA 100%); padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Xin chào ${displayName}! 🎉</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Chúc mừng! Tài khoản của bạn đã được xác thực thành công</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Bây giờ bạn có thể bắt đầu khám phá Loopy và kết nối với bạn bè!
            </p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}" 
                 style="background: linear-gradient(135deg, #E3AADD 0%, #C8A8E9 100%); 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold;
                        display: inline-block;">
                Bắt đầu khám phá Loopy
              </a>
            </div>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>© 2024 Loopy Social Media. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send welcome email",
    };
  }
}

// Send permanent ban email after 3 warnings
export async function sendPermanentBanEmail(
  to: string,
  displayName: string,
  warningCount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const banDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: "Account Permanently Banned - Loopy Social Media",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">⛔ Account Permanently Banned</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Hello ${displayName},</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Your account has been permanently banned from Loopy Social Media after receiving <strong>${warningCount} warnings</strong> for violating our community guidelines.
            </p>
            
            <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; color: #991b1b;">📋 Ban Details:</h3>
              <p style="margin: 5px 0; color: #7f1d1d;"><strong>Warning Count:</strong> ${warningCount}/3</p>
              <p style="margin: 5px 0; color: #7f1d1d;"><strong>Ban Date:</strong> ${banDate}</p>
              <p style="margin: 5px 0; color: #7f1d1d;"><strong>Status:</strong> Permanent Ban</p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              After receiving 3 warnings for community guideline violations, your account has been permanently suspended. 
              This decision was made to maintain a safe and respectful environment for all Loopy users.
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>ℹ️ Important:</strong> This ban is permanent and cannot be appealed. Your account and all associated data will remain inaccessible.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>If you believe this was a mistake, please contact our support team.</p>
            <p>© 2024 Loopy Social Media. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending permanent ban email:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send permanent ban email",
    };
  }
}
