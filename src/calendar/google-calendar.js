const { google } = require('googleapis');
const { format, startOfDay, endOfDay, addDays } = require('date-fns');
const OAuthClient = require('../auth/oauth-client');

class GoogleCalendarClient {
  constructor(oauthConfig) {
    this.oauthConfig = oauthConfig;
    this.oauthClient = null;
    this.calendar = null;
  }

  async initialize() {
    try {
      if (!this.oauthConfig.clientId || !this.oauthConfig.clientSecret || !this.oauthConfig.refreshToken) {
        throw new Error('Missing OAuth configuration (clientId, clientSecret, or refreshToken)');
      }

      this.oauthClient = new OAuthClient(
        this.oauthConfig.clientId,
        this.oauthConfig.clientSecret,
        this.oauthConfig.refreshToken
      );

      const initialized = await this.oauthClient.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize OAuth client');
      }

      this.calendar = google.calendar({ 
        version: 'v3', 
        auth: this.oauthClient.getAuth() 
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Calendar client:', error.message);
      return false;
    }
  }

  async getTodaysEvents(calendarId = 'primary') {
    if (!this.calendar) {
      throw new Error('Calendar client not initialized');
    }

    const today = new Date();
    const timeMin = startOfDay(today).toISOString();
    const timeMax = endOfDay(today).toISOString();

    try {
      // Ensure we have a valid access token before making the request
      await this.oauthClient.ensureValidToken();

      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50
      });

      return this.formatEvents(response.data.items || []);
    } catch (error) {
      console.error(`Error fetching today's events from ${calendarId}:`, error.message);
      return [];
    }
  }

  async getUpcomingEvents(calendarId = 'primary', days = 7) {
    if (!this.calendar) {
      throw new Error('Calendar client not initialized');
    }

    const today = new Date();
    const timeMin = startOfDay(today).toISOString();
    const timeMax = endOfDay(addDays(today, days)).toISOString();

    try {
      // Ensure we have a valid access token before making the request
      await this.oauthClient.ensureValidToken();

      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100
      });

      return this.formatEvents(response.data.items || []);
    } catch (error) {
      console.error(`Error fetching upcoming events from ${calendarId}:`, error.message);
      return [];
    }
  }

  formatEvents(events) {
    return events.map(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      
      return {
        id: event.id,
        title: event.summary || 'No title',
        description: event.description || '',
        start: new Date(start),
        end: new Date(end),
        isAllDay: !event.start.dateTime,
        location: event.location || '',
        attendees: event.attendees ? event.attendees.map(a => a.email) : [],
        status: event.status,
        htmlLink: event.htmlLink
      };
    });
  }

  async getCalendarList() {
    if (!this.calendar) {
      throw new Error('Calendar client not initialized');
    }

    try {
      // Ensure we have a valid access token before making the request
      await this.oauthClient.ensureValidToken();

      const response = await this.calendar.calendarList.list();
      return response.data.items.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary || false,
        accessRole: cal.accessRole
      }));
    } catch (error) {
      console.error('Error fetching calendar list:', error.message);
      return [];
    }
  }
}

module.exports = GoogleCalendarClient;