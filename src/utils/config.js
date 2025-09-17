require('dotenv').config();

class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  validateRequiredEnvVars() {
    const required = ['TODOIST_API_TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    this.validateGoogleOAuthConfig();
  }

  validateGoogleOAuthConfig() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const hasPersonalToken = process.env.GOOGLE_PERSONAL_REFRESH_TOKEN;
    const hasWorkToken = process.env.GOOGLE_WORK_REFRESH_TOKEN;

    // If any OAuth config is provided, validate it's complete
    if (clientId || clientSecret || hasPersonalToken || hasWorkToken) {
      const oauthErrors = [];

      if (!clientId) {
        oauthErrors.push('GOOGLE_OAUTH_CLIENT_ID is missing');
      } else if (!this.isValidClientId(clientId)) {
        oauthErrors.push('GOOGLE_OAUTH_CLIENT_ID appears invalid (should end with .apps.googleusercontent.com)');
      }

      if (!clientSecret) {
        oauthErrors.push('GOOGLE_OAUTH_CLIENT_SECRET is missing');
      } else if (clientSecret.length < 20) {
        oauthErrors.push('GOOGLE_OAUTH_CLIENT_SECRET appears too short (should be longer)');
      }

      if (!hasPersonalToken && !hasWorkToken) {
        oauthErrors.push('At least one refresh token is required (GOOGLE_PERSONAL_REFRESH_TOKEN or GOOGLE_WORK_REFRESH_TOKEN)');
      }

      if (hasPersonalToken && !this.isValidRefreshToken(hasPersonalToken)) {
        oauthErrors.push('GOOGLE_PERSONAL_REFRESH_TOKEN appears invalid');
      }

      if (hasWorkToken && !this.isValidRefreshToken(hasWorkToken)) {
        oauthErrors.push('GOOGLE_WORK_REFRESH_TOKEN appears invalid');
      }

      if (oauthErrors.length > 0) {
        throw new Error(`Google OAuth configuration errors:\n- ${oauthErrors.join('\n- ')}\n\nRun 'node scripts/oauth-setup.js' to fix these issues.`);
      }

      console.log('✅ Google OAuth configuration validated successfully');
    } else {
      console.warn('⚠️  Warning: No Google Calendar OAuth configuration provided. Calendar features will be disabled.');
    }
  }

  isValidClientId(clientId) {
    return clientId && clientId.endsWith('.apps.googleusercontent.com');
  }

  isValidRefreshToken(token) {
    // Basic validation - refresh tokens should be reasonably long and contain certain patterns
    return token && token.length > 50 && token.includes('1//');
  }

  get todoist() {
    return {
      apiToken: process.env.TODOIST_API_TOKEN
    };
  }

  get google() {
    return {
      oauth: {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
      },
      personal: {
        refreshToken: process.env.GOOGLE_PERSONAL_REFRESH_TOKEN,
        calendarId: process.env.PERSONAL_CALENDAR_ID || 'primary'
      },
      work: {
        refreshToken: process.env.GOOGLE_WORK_REFRESH_TOKEN,
        calendarId: process.env.WORK_CALENDAR_ID || 'primary'
      }
    };
  }

  get email() {
    return {
      service: process.env.EMAIL_SERVICE,
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    };
  }

  get slack() {
    return {
      webhookUrl: process.env.SLACK_WEBHOOK_URL
    };
  }

  get app() {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      outputDir: process.env.OUTPUT_DIR || './output',
      timezone: process.env.TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  hasPersonalCalendar() {
    return !!(this.google.oauth.clientId && this.google.oauth.clientSecret && this.google.personal.refreshToken);
  }

  hasWorkCalendar() {
    return !!(this.google.oauth.clientId && this.google.oauth.clientSecret && this.google.work.refreshToken);
  }

  hasEmailConfig() {
    return !!(this.email.service && this.email.user && this.email.pass);
  }

  hasSlackConfig() {
    return !!this.slack.webhookUrl;
  }

  isProduction() {
    return this.app.nodeEnv === 'production';
  }

  isDevelopment() {
    return this.app.nodeEnv === 'development';
  }
}

module.exports = new Config();