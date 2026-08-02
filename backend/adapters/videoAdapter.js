/**
 * Video Adapter — create interview meeting links.
 * Supports: Zoom, Microsoft Teams, Google Meet.
 */
const axios = require('axios');

class ZoomAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this._accessToken = null;
    this._tokenExpiresAt = 0;
  }

  async _getAccessToken() {
    const { accountId, clientId, clientSecret } = this.config;
    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Zoom is not configured: missing accountId, clientId, or clientSecret');
    }
    if (this._accessToken && Date.now() < this._tokenExpiresAt - 30000) return this._accessToken;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      null,
      { headers: { Authorization: `Basic ${credentials}` }, timeout: 15000 }
    );
    this._accessToken = response.data.access_token;
    this._tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
    return this._accessToken;
  }

  async createMeetingLink({ topic, startTime, duration = 60, attendees = [] }) {
    if (!topic || !startTime) throw new Error('createMeetingLink requires topic and startTime');
    const token = await this._getAccessToken();
    const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', {
      topic,
      type: 2,
      start_time: startTime,
      duration,
      settings: {
        join_before_host: true,
        waiting_room: false,
        meeting_invitees: attendees.map((email) => ({ email }))
      }
    }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 20000
    });
    return {
      meetingId: response.data.id,
      joinUrl: response.data.join_url,
      startUrl: response.data.start_url,
      password: response.data.password
    };
  }

  async testConnection() {
    const token = await this._getAccessToken();
    await axios.get('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

class TeamsAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this._accessToken = null;
    this._tokenExpiresAt = 0;
  }

  async _getAccessToken() {
    const { clientId, clientSecret, refreshToken, tenantId = 'common' } = this.config;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Teams is not configured: missing clientId, clientSecret, or refreshToken');
    }
    if (this._accessToken && Date.now() < this._tokenExpiresAt - 30000) return this._accessToken;

    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default offline_access'
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );
    this._accessToken = response.data.access_token;
    this._tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
    return this._accessToken;
  }

  async createMeetingLink({ topic, startTime, duration = 60, attendees = [] }) {
    if (!topic || !startTime) throw new Error('createMeetingLink requires topic and startTime');
    const token = await this._getAccessToken();
    const end = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();

    const response = await axios.post('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
      subject: topic,
      startDateTime: startTime,
      endDateTime: end,
      participants: {
        attendees: attendees.map((email) => ({
          upn: email,
          role: 'attendee'
        }))
      }
    }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 20000
    });
    return {
      meetingId: response.data.id,
      joinUrl: response.data.joinWebUrl,
      startUrl: response.data.joinWebUrl
    };
  }

  async testConnection() {
    const token = await this._getAccessToken();
    await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

class GoogleMeetAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this._accessToken = null;
    this._tokenExpiresAt = 0;
  }

  async _getAccessToken() {
    const { clientId, clientSecret, refreshToken } = this.config;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google Meet is not configured: missing clientId, clientSecret, or refreshToken');
    }
    if (this._accessToken && Date.now() < this._tokenExpiresAt - 30000) return this._accessToken;

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
    this._tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
    return this._accessToken;
  }

  async createMeetingLink({ topic, startTime, duration = 60, attendees = [] }) {
    if (!topic || !startTime) throw new Error('createMeetingLink requires topic and startTime');
    const token = await this._getAccessToken();
    const end = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();
    const calendarId = this.config.calendarId || 'primary';

    const response = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        summary: topic,
        start: { dateTime: startTime },
        end: { dateTime: end },
        attendees: attendees.map((email) => ({ email })),
        conferenceData: { createRequest: { requestId: `meet-${Date.now()}` } }
      },
      {
        params: { conferenceDataVersion: 1, sendUpdates: 'all' },
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 20000
      }
    );
    const meetLink = response.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
    return {
      meetingId: response.data.id,
      joinUrl: meetLink,
      startUrl: meetLink,
      eventId: response.data.id
    };
  }

  async testConnection() {
    const token = await this._getAccessToken();
    await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

const createVideoAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid video configuration');
  switch (config.provider.toLowerCase()) {
    case 'zoom':
      return new ZoomAdapter(config);
    case 'teams':
    case 'microsoft_teams':
      return new TeamsAdapter(config);
    case 'google_meet':
    case 'google':
      return new GoogleMeetAdapter(config);
    default:
      throw new Error(`Unsupported video provider: ${config.provider}`);
  }
};

module.exports = { createVideoAdapter, ZoomAdapter, TeamsAdapter, GoogleMeetAdapter };
