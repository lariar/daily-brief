#!/usr/bin/env node

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const { promises: fs } = require('fs');
const path = require('path');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';
const PORT = 3000;

class OAuthSetup {
  constructor() {
    this.clientId = null;
    this.clientSecret = null;
    this.oauth2Client = null;
    this.server = null;
  }

  async run() {
    console.log('\n🔐 Google Calendar OAuth Setup');
    console.log('=================================\n');

    try {
      await this.loadCredentials();
      await this.setupOAuth2Client();
      await this.getTokens();
      console.log('\n✅ OAuth setup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Add the displayed tokens to your GitHub repository secrets');
      console.log('2. Update your local .env file with the OAuth credentials');
      console.log('3. Test the application locally');
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async loadCredentials() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('📋 Before starting, ensure you have:');
    console.log('   • Created OAuth 2.0 Client ID in Google Cloud Console');
    console.log('   • Added http://localhost:3000/oauth/callback as authorized redirect URI');
    console.log('   • Downloaded the OAuth client credentials\n');

    try {
      const credentialsPath = await this.promptForInput(rl, 'Enter path to OAuth credentials JSON file: ');
      const credentialsData = await fs.readFile(credentialsPath, 'utf8');
      const credentials = JSON.parse(credentialsData);

      if (!credentials.web && !credentials.installed) {
        throw new Error('Invalid credentials file format');
      }

      const creds = credentials.web || credentials.installed;
      this.clientId = creds.client_id;
      this.clientSecret = creds.client_secret;

      if (!this.clientId || !this.clientSecret) {
        throw new Error('Missing client_id or client_secret in credentials file');
      }

      console.log('✅ Credentials loaded successfully\n');
    } catch (error) {
      throw new Error(`Failed to load credentials: ${error.message}`);
    } finally {
      rl.close();
    }
  }

  async setupOAuth2Client() {
    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      REDIRECT_URI
    );
  }

  async getTokens() {
    console.log('🔄 Getting OAuth tokens for both accounts...\n');
    
    const personalTokens = await this.getTokenForAccount('Personal');
    const workTokens = await this.getTokenForAccount('Work');

    console.log('\n📋 GitHub Secrets Configuration');
    console.log('=================================');
    console.log('Add these secrets to your GitHub repository:\n');
    
    console.log(`GOOGLE_OAUTH_CLIENT_ID: ${this.clientId}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET: ${this.clientSecret}`);
    console.log(`GOOGLE_PERSONAL_REFRESH_TOKEN: ${personalTokens.refresh_token}`);
    console.log(`GOOGLE_WORK_REFRESH_TOKEN: ${workTokens.refresh_token}`);

    console.log('\n📋 Local .env Configuration');
    console.log('============================');
    console.log('Add these to your .env file:\n');
    
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${this.clientId}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${this.clientSecret}`);
    console.log(`GOOGLE_PERSONAL_REFRESH_TOKEN=${personalTokens.refresh_token}`);
    console.log(`GOOGLE_WORK_REFRESH_TOKEN=${workTokens.refresh_token}`);
  }

  async getTokenForAccount(accountType) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔐 Authorizing ${accountType} Account`);
      console.log('===============================');

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });

      console.log(`\n1. Open this URL in your browser:`);
      console.log(`   ${authUrl}\n`);
      console.log(`2. Sign in with your ${accountType.toLowerCase()} Google account`);
      console.log(`3. Grant calendar read permissions`);
      console.log(`4. Wait for the authorization to complete...\n`);

      // Setup cleanup function
      const cleanup = () => {
        if (this.server) {
          this.server.close(() => {
            console.log('OAuth server stopped');
          });
          this.server = null;
        }
      };

      // Setup timeout (10 minutes)
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`OAuth authorization timed out after 10 minutes for ${accountType} account`));
      }, 10 * 60 * 1000);

      this.server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url, true);
          
          if (parsedUrl.pathname === '/oauth/callback') {
            const { code, error } = parsedUrl.query;

            if (error) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`<h1>Authorization Error</h1><p>${error}</p>`);
              clearTimeout(timeout);
              cleanup();
              reject(new Error(`Authorization error: ${error}`));
              return;
            }

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Missing Authorization Code</h1>');
              clearTimeout(timeout);
              cleanup();
              reject(new Error('Missing authorization code'));
              return;
            }

            try {
              const { tokens } = await this.oauth2Client.getToken(code);
              
              if (!tokens.refresh_token) {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('<h1>Missing Refresh Token</h1><p>Please revoke access and try again with prompt=consent</p>');
                clearTimeout(timeout);
                cleanup();
                reject(new Error('No refresh token received. Please revoke access and try again.'));
                return;
              }

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <h1>✅ ${accountType} Authorization Successful!</h1>
                <p>You can close this tab and return to the terminal.</p>
                <script>setTimeout(() => window.close(), 3000)</script>
              `);

              console.log(`✅ ${accountType} account authorized successfully`);
              
              clearTimeout(timeout);
              cleanup();
              resolve(tokens);
              
            } catch (tokenError) {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end(`<h1>Token Exchange Error</h1><p>${tokenError.message}</p>`);
              clearTimeout(timeout);
              cleanup();
              reject(new Error(`Token exchange failed: ${tokenError.message}`));
            }
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Not Found</h1>');
          }
        } catch (serverError) {
          console.error('Server error:', serverError);
          clearTimeout(timeout);
          cleanup();
          reject(serverError);
        }
      });

      this.server.listen(PORT, () => {
        console.log(`🌐 OAuth server started on http://localhost:${PORT}`);
      });

      this.server.on('error', (serverError) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`Server error: ${serverError.message}`));
      });
    });
  }

  async promptForInput(rl, question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

if (require.main === module) {
  const setup = new OAuthSetup();
  setup.run().catch(console.error);
}

module.exports = OAuthSetup;