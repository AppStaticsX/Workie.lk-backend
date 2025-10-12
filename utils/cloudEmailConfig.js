// Cloud hosting email configuration
// This file provides alternative email configurations for different cloud providers

const createCloudOptimizedTransporter = (nodemailer) => {
  // Primary configuration (Gmail SMTP)
  const primaryConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 25000, // 25 seconds
    greetingTimeout: 15000,   // 15 seconds  
    socketTimeout: 25000,     // 25 seconds
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    rateDelta: 3000,
    rateLimit: 2,
    tls: {
      rejectUnauthorized: true,
      ciphers: 'TLSv1.2'
    }
  };

  // Alternative configuration for problematic networks
  const alternativeConfig = {
    host: 'smtp.gmail.com',
    port: 465, // SSL
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 30000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    pool: false, // Disable pooling for problematic networks
    tls: {
      rejectUnauthorized: false,
      servername: 'smtp.gmail.com'
    }
  };

  // Return primary config by default, alternative can be used via env var
  const config = process.env.USE_ALTERNATIVE_SMTP === 'true' ? alternativeConfig : primaryConfig;
  
  return nodemailer.createTransport(config);
};

// Enhanced error handling for cloud environments
const handleCloudEmailError = (error, attempt, maxAttempts) => {
  const isLastAttempt = attempt >= maxAttempts;
  
  switch (error.code) {
    case 'ETIMEDOUT':
    case 'ECONNECTION':
      return {
        shouldRetry: !isLastAttempt,
        message: isLastAttempt 
          ? 'SMTP connection timeout. Cloud hosting may be blocking Gmail SMTP. Consider using SendGrid or Mailgun.'
          : `Connection timeout (attempt ${attempt}/${maxAttempts}). Retrying...`,
        delay: Math.min(2000 * Math.pow(2, attempt), 30000) // Exponential backoff up to 30s
      };
      
    case 'EAUTH':
      return {
        shouldRetry: false,
        message: 'Gmail authentication failed. Check EMAIL_USER and EMAIL_PASS environment variables.',
        delay: 0
      };
      
    case 'EDNS':
      return {
        shouldRetry: !isLastAttempt,
        message: isLastAttempt 
          ? 'DNS resolution failed. Check network connectivity.'
          : `DNS resolution failed (attempt ${attempt}/${maxAttempts}). Retrying...`,
        delay: 5000
      };
      
    default:
      return {
        shouldRetry: !isLastAttempt && attempt < 3, // Limit retries for unknown errors
        message: `Email error: ${error.message} (Code: ${error.code})`,
        delay: 3000
      };
  }
};

// Cloud provider specific recommendations
const getCloudProviderAdvice = () => {
  const recommendations = {
    render: {
      name: 'Render',
      issues: 'May block SMTP connections',
      solutions: [
        'Use SendGrid add-on from Render marketplace',
        'Set USE_ALTERNATIVE_SMTP=true in environment variables',
        'Consider upgrading to paid plan for better network access'
      ]
    },
    heroku: {
      name: 'Heroku',
      issues: 'Restricts outbound SMTP on free tier',
      solutions: [
        'Use SendGrid Heroku add-on',
        'Upgrade to paid dyno for SMTP access',
        'Use Mailgun Heroku add-on'
      ]
    },
    vercel: {
      name: 'Vercel',
      issues: 'Serverless functions have time limits',
      solutions: [
        'Use Vercel email integration',
        'Implement async email sending',
        'Use external email service API'
      ]
    },
    netlify: {
      name: 'Netlify',
      issues: 'Functions may have SMTP restrictions',
      solutions: [
        'Use Netlify Functions with email service API',
        'Implement webhook-based email sending',
        'Use third-party email service'
      ]
    }
  };

  return recommendations;
};

module.exports = {
  createCloudOptimizedTransporter,
  handleCloudEmailError,
  getCloudProviderAdvice
};