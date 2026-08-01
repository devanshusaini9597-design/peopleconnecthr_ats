/**
 * Calendar Adapter — unified interface for interview scheduling regardless
 * of provider.
 * Supports: Google Calendar (OAuth2 refresh-token flow).
 *
 * IntegrationConfig.credentials shape for provider 'google':
 *   { clientId, clientSecret, refreshToken, calendarId? } // calendarId defaults to 'primary'
 *
 * Getting a refreshToken: an org admin authorizes via
 * GET /oauth/google-calendar/auth-url (see routes/calendarOAuthRoutes.js),
 * which stores the resulting refresh token directly onto the org's
 * IntegrationConfig for the 'calendar' category.
 */
const axios = require('axios');

class GoogleCalendarAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this._accessToken = null;
    this._accessTokenExpiresAt = 0;
  }

  async _getAccessToken() {
    const { clientId, clientSecret, refreshToken } = this.config;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google Calendar is not configured: missing clientId, clientSecret, or refreshToken');
    }
    if (this._accessToken && Date.now() < this._accessTokenExpiresAt - 30000) {
      return this._accessToken;
    }

    try {
      const response = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
      );
      this._accessToken = response.data.access_token;
      this._accessTokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
      return this._accessToken;
    } catch (err) {
      const msg = err.response?.data?.error_description || err.message;
      throw new Error(`Google token refresh failed: ${msg}`);
    }
  }

  /**
   * Creates a calendar event (e.g. an interview).
   * @param {Object} params
   * @param {string} params.summary
   * @param {string} [params.description]
   * @param {string} params.startTime ISO datetime
   * @param {string} params.endTime ISO datetime
   * @param {string} [params.timeZone] IANA timezone, default UTC
   * @param {string[]} [params.attendees] email addresses
   * @param {boolean} [params.addMeetLink] request a Google Meet link
   */
  async createEvent({ summary, description, startTime, endTime, timeZone = 'UTC', attendees = [], addMeetLink = false }) {
    if (!summary || !startTime || !endTime) {
      throw new Error('createEvent requires summary, startTime, and endTime');
    }
    const accessToken = await this._getAccessToken();
    const calendarId = this.config.calendarId || 'primary';

    const body = {
      summary,
      description,
      start: { dateTime: startTime, timeZone },
      end: { dateTime: endTime, timeZone },
      attendees: attendees.map((email) => ({ email }))
    };
    if (addMeetLink) {
      body.conferenceData = { createRequest: { requestId: `meet-${Date.now()}` } };
    }

    try {
      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        body,
        {
          params: { sendUpdates: 'all', conferenceDataVersion: addMeetLink ? 1 : 0 },
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 20000
        }
      );
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      throw new Error(`Google Calendar createEvent failed: ${msg}`);
    }
  }

  async listEvents({ timeMin, timeMax, maxResults = 50 } = {}) {
    const accessToken = await this._getAccessToken();
    const calendarId = this.config.calendarId || 'primary';

    try {
      const response = await axios.get(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          params: {
            timeMin: timeMin || new Date().toISOString(),
            timeMax,
            maxResults,
            singleEvents: true,
            orderBy: 'startTime'
          },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 20000
        }
      );
      return response.data.items || [];
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      throw new Error(`Google Calendar listEvents failed: ${msg}`);
    }
  }

  async deleteEvent(eventId) {
    const accessToken = await this._getAccessToken();
    const calendarId = this.config.calendarId || 'primary';
    try {
      await axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
      );
      return true;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      throw new Error(`Google Calendar deleteEvent failed: ${msg}`);
    }
  }

  async testConnection() {
    // A cheap read confirms the refresh token + calendar ID are valid.
    await this.listEvents({ maxResults: 1 });
    return true;
  }
}

/**
 * Factory to create a calendar adapter based on provider config.
 */
const createCalendarAdapter = (config) => {
  if (!config || !config.provider) {
    throw new Error('Invalid calendar configuration');
  }
  switch (config.provider.toLowerCase()) {
    case 'google':
      return new GoogleCalendarAdapter(config);
    default:
      throw new Error(`Unsupported calendar provider: ${config.provider}`);
  }
};

module.exports = {
  createCalendarAdapter,
  GoogleCalendarAdapter,
  createEvent: async () => {
    throw new Error('Calendar integration not configured — use createCalendarAdapter(config) via getAdapter(orgId, "calendar")');
  },
  listEvents: async () => {
    throw new Error('Calendar integration not configured — use createCalendarAdapter(config) via getAdapter(orgId, "calendar")');
  }
};
