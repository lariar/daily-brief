const { google } = require('googleapis');

class OAuthClient {
  constructor(clientId, clientSecret, refreshToken) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.oauth2Client = null;
    this.initialized = false;
    this.refreshPromise = null; // Track ongoing refresh operations
    this.lastTokenRefresh = 0; // Track when we last refreshed
  }

  async initialize() {
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('Missing required OAuth credentials: clientId, clientSecret, or refreshToken');
    }

    try {
      this.oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        'http://localhost:3000/oauth/callback' // Not used for refresh flow
      );

      // Set the refresh token
      this.oauth2Client.setCredentials({
        refresh_token: this.refreshToken
      });

      // Test the credentials by getting an access token
      const { token } = await this.oauth2Client.getAccessToken();
      if (!token) {
        throw new Error('Failed to obtain access token during initialization');
      }
      
      this.initialized = true;
      this.lastTokenRefresh = Date.now();
      return true;
    } catch (error) {
      const errorMessage = `OAuth initialization failed: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  getAuth() {
    if (!this.initialized) {
      throw new Error('OAuth client not initialized. Call initialize() first.');
    }
    return this.oauth2Client;
  }

  async refreshAccessToken() {
    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      try {
        await this.refreshPromise;
        return true;
      } catch (error) {
        console.error('Failed to wait for ongoing token refresh:', error.message);
        // Don't throw here - let the caller retry with a new refresh attempt
        this.refreshPromise = null; // Clear failed promise
      }
    }

    // Start a new refresh operation
    this.refreshPromise = this._performTokenRefresh();
    
    try {
      await this.refreshPromise;
      return true;
    } catch (error) {
      throw error;
    } finally {
      // Clear the promise so future calls can start a new refresh
      this.refreshPromise = null;
    }
  }

  async _performTokenRefresh() {
    try {
      if (!this.oauth2Client) {
        throw new Error('OAuth client not initialized');
      }

      console.log('Refreshing OAuth access token...');
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials || !credentials.access_token) {
        throw new Error('Failed to obtain new access token during refresh');
      }

      this.oauth2Client.setCredentials(credentials);
      this.lastTokenRefresh = Date.now();
      console.log('OAuth access token refreshed successfully');
      
    } catch (error) {
      const errorMessage = `Failed to refresh access token: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async ensureValidToken() {
    if (!this.initialized) {
      throw new Error('OAuth client not initialized. Call initialize() first.');
    }

    try {
      const credentials = this.oauth2Client.credentials;
      const accessToken = credentials.access_token;
      const expiry = credentials.expiry_date;
      
      // Check if we need to refresh (with 5-minute buffer before expiry)
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      const needsRefresh = !accessToken || 
                          (expiry && Date.now() >= (expiry - bufferTime)) ||
                          (Date.now() - this.lastTokenRefresh > 55 * 60 * 1000); // Refresh every 55 minutes max
      
      if (needsRefresh) {
        await this.refreshAccessToken();
      }
      
      return true;
    } catch (error) {
      const errorMessage = `Failed to ensure valid token: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  isInitialized() {
    return this.initialized;
  }

  hasValidCredentials() {
    return !!(this.clientId && this.clientSecret && this.refreshToken);
  }
}

module.exports = OAuthClient;