import nodemailer from 'nodemailer';

// Hardcoded email configuration
const EMAIL_CONFIG = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 587,
  SMTP_USER: 'himbazaalain022@gmail.com',
  SMTP_PASS: 'ubyrxzfqbknyfclp',
  FROM_EMAIL: 'himbazaalain022@gmail.com'
};

// Debug function
const debugEmailConfig = () => {
  console.log('=== Email Service Debug ===');
  console.log('SMTP_HOST:', EMAIL_CONFIG.SMTP_HOST);
  console.log('SMTP_PORT:', EMAIL_CONFIG.SMTP_PORT);
  console.log('SMTP_USER:', EMAIL_CONFIG.SMTP_USER);
  console.log('SMTP_PASS:', EMAIL_CONFIG.SMTP_PASS ? '[SET]' : 'NOT SET');
  console.log('FROM_EMAIL:', EMAIL_CONFIG.FROM_EMAIL);
  console.log('===========================');
};

// Validate email configuration
const validateEmailConfig = () => {
  debugEmailConfig(); // Add debugging
  
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(key => !EMAIL_CONFIG[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing email configuration:', missing);
    return false;
  }
  console.log('✅ All email configuration variables are present');
  return true;
};

// Create transporter with validation
const createTransporter = () => {
  if (!validateEmailConfig()) {
    console.warn('⚠️  Email service disabled due to missing configuration');
    return null;
  }

  console.log('📧 Creating email transporter...');
  
  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.SMTP_HOST,
      port: EMAIL_CONFIG.SMTP_PORT,
      secure: EMAIL_CONFIG.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_CONFIG.SMTP_USER,
        pass: EMAIL_CONFIG.SMTP_PASS
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000,     // 5 seconds
      socketTimeout: 10000,      // 10 seconds
    });
    
    console.log('✅ Email transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('❌ Error creating email transporter:', error);
    return null;
  }
};

const transporter = createTransporter();

// Get sender information
const getSenderInfo = () => {
  const senderName = 'Inshuti y\'Umuryango';
  const senderEmail = EMAIL_CONFIG.SMTP_USER;
  return `"${senderName}" <${senderEmail}>`;
};

// Welcome email template
const welcomeEmailTemplate = (userName, userEmail) => {
  return {
    from: getSenderInfo(),
    to: userEmail,
    subject: 'Welcome to Our Platform!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Inshuti y'umuryango!</h2>
        <p>Hi ${userName},</p>
        <p>Thank you for joining our platform. Your account has been created successfully.</p>
        <p>You can now start exploring and joining groups that interest you.</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Inshuti y'Umuryango Team</p>
      </div>
    `
  };
};

// Group approval email template
const groupApprovalEmailTemplate = (userName, userEmail, groupName, groupLink) => {
  const groupUrl = groupLink;
  
  return {
    from: getSenderInfo(),
    to: userEmail,
    subject: `You've been approved to join ${groupName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Congratulations!</h2>
        <p>Hi ${userName},</p>
        <p>Great news! Your request to join the group <strong>${groupName}</strong> has been approved.</p>
        <p>You can now access the group and start participating in discussions.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${groupUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Visit Group
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p><a href="${groupUrl}">${groupUrl}</a></p>
        <p>Best regards,<br>The Inshuti y'Umuryango Team</p>
      </div>
    `
  };
};

// Group rejection email template
const groupRejectionEmailTemplate = (userName, userEmail, groupName) => {
  return {
    from: getSenderInfo(),
    to: userEmail,
    subject: `Update on your request to join ${groupName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">Request Update</h2>
        <p>Hi ${userName},</p>
        <p>We're writing to inform you that your request to join the group <strong>${groupName}</strong> has been declined by the group administrator.</p>
        <p>Don't worry! There are many other groups available on our platform that might interest you.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Explore Other Groups
          </a>
        </div>
        <p>If you have any questions about this decision, you may contact the group administrator directly.</p>
        <p>Best regards,<br>The Inshuti y'Umuryango Team</p>
      </div>
    `
  };
};

// Send welcome email
export const sendWelcomeEmail = async (userName, userEmail) => {
  if (!transporter) {
    console.log('⚠️  Email service not configured - skipping welcome email');
    return;
  }

  try {
    console.log(`📧 Sending welcome email to: ${userEmail}`);
    const mailOptions = welcomeEmailTemplate(userName, userEmail);
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully to:', userEmail);
    console.log('📧 Message ID:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error.message);
    throw error;
  }
};

// Send group approval email
export const sendGroupApprovalEmail = async (userName, userEmail, groupName, groupLink) => {
  if (!transporter) {
    console.log('⚠️  Email service not configured - skipping group approval email');
    return;
  }

  try {
    console.log(`📧 Sending group approval email to: ${userEmail}`);
    const mailOptions = groupApprovalEmailTemplate(userName, userEmail, groupName, groupLink);
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Group approval email sent successfully to:', userEmail);
    console.log('📧 Message ID:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Error sending group approval email:', error.message);
    throw error;
  }
};

// Send group rejection email
export const sendGroupRejectionEmail = async (userName, userEmail, groupName) => {
  if (!transporter) {
    console.log('⚠️  Email service not configured - skipping group rejection email');
    return;
  }

  try {
    console.log(`📧 Sending group rejection email to: ${userEmail}`);
    const mailOptions = groupRejectionEmailTemplate(userName, userEmail, groupName);
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Group rejection email sent successfully to:', userEmail);
    console.log('📧 Message ID:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Error sending group rejection email:', error.message);
    throw error;
  }
};

// Test email connection
export const testEmailConnection = async () => {
  if (!transporter) {
    console.log('⚠️  Email service not configured');
    return false;
  }

  try {
    console.log('🔍 Testing email connection...');
    await transporter.verify();
    console.log('✅ Email server is ready to take our messages');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error.message);
    return false;
  }
};