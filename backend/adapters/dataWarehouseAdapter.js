/**
 * Data Warehouse Adapter — upsert analytics rows into warehouse tables.
 * Supports: Snowflake, BigQuery, Amazon Redshift.
 */
const axios = require('axios');
const crypto = require('crypto');

class SnowflakeAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  async _getToken() {
    const { account, username, password, warehouse, database, schema, role } = this.config;
    if (!account || !username || !password) {
      throw new Error('Snowflake is not configured: missing account, username, or password');
    }
    if (this._token && Date.now() < this._tokenExpiresAt - 30000) return this._token;

    const response = await axios.post(`https://${account}.snowflakecomputing.com/session/v1/login-request`, {
      data: {
        CLIENT_APP_ID: 'ats-adapter',
        CLIENT_APP_VERSION: '1.0.0',
        ACCOUNT_NAME: account,
        LOGIN_NAME: username,
        PASSWORD: password,
        WAREHOUSE: warehouse,
        DATABASE: database,
        SCHEMA: schema || 'PUBLIC',
        ROLE: role
      }
    }, { timeout: 20000 });
    this._token = response.data.data.token;
    this._tokenExpiresAt = Date.now() + 3600 * 1000;
    return this._token;
  }

  async upsertRows({ table, rows, keyColumns = [] }) {
    if (!table || !rows?.length) throw new Error('upsertRows requires table and non-empty rows');
    const token = await this._getToken();
    const { account, database, schema } = this.config;
    const columns = Object.keys(rows[0]);
    const values = rows.map((row) => `(${columns.map((c) => `'${String(row[c] ?? '').replace(/'/g, "''")}'`).join(',')})`).join(',');
    const mergeKeys = keyColumns.length ? keyColumns : [columns[0]];
    const sql = `MERGE INTO ${database}.${schema || 'PUBLIC'}.${table} AS t USING (SELECT ${columns.join(',')} FROM VALUES ${values}) AS s ON ${mergeKeys.map((k) => `t.${k}=s.${k}`).join(' AND ')} WHEN MATCHED THEN UPDATE SET ${columns.filter((c) => !mergeKeys.includes(c)).map((c) => `t.${c}=s.${c}`).join(',')} WHEN NOT MATCHED THEN INSERT (${columns.join(',')}) VALUES (${columns.map((c) => `s.${c}`).join(',')})`;

    const response = await axios.post(`https://${account}.snowflakecomputing.com/queries/v1/query-request`, {
      sqlText: sql,
      async: false
    }, {
      headers: { Authorization: `Snowflake Token="${token}"`, 'Content-Type': 'application/json' },
      timeout: 60000
    });
    return { rowsAffected: rows.length, queryId: response.data.data?.queryId };
  }

  async testConnection() {
    await this._getToken();
    return true;
  }
}

class BigQueryAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { projectId, dataset } = this.config;
    if (!projectId || !dataset) {
      throw new Error('BigQuery is not configured: missing projectId or dataset');
    }
    this.projectId = projectId;
    this.dataset = dataset;
  }

  async _getAccessToken() {
    const { clientEmail, privateKey } = this.config;
    if (!clientEmail || !privateKey) throw new Error('BigQuery is not configured: missing clientEmail or privateKey');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/bigquery.insertdata',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');
    const signInput = `${header}.${claim}`;
    const sign = crypto.createSign('RSA-SHA256').update(signInput).sign(privateKey.replace(/\\n/g, '\n'), 'base64url');
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signInput}.${sign}`
    }, { timeout: 15000 });
    return response.data.access_token;
  }

  async upsertRows({ table, rows }) {
    if (!table || !rows?.length) throw new Error('upsertRows requires table and non-empty rows');
    const token = await this._getAccessToken();
    const response = await axios.post(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/datasets/${this.dataset}/tables/${table}/insertAll`,
      { rows: rows.map((row, i) => ({ insertId: String(i), json: row })) },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    return { rowsAffected: rows.length, errors: response.data.insertErrors };
  }

  async testConnection() {
    const token = await this._getAccessToken();
    await axios.get(`https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/datasets/${this.dataset}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

class RedshiftAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { clusterId, database, dbUser, region, accessKeyId, secretAccessKey } = this.config;
    if (!clusterId || !database || !dbUser || !region || !accessKeyId || !secretAccessKey) {
      throw new Error('Redshift is not configured: missing clusterId, database, dbUser, region, accessKeyId, or secretAccessKey');
    }
  }

  async upsertRows({ table, rows }) {
    if (!table || !rows?.length) throw new Error('upsertRows requires table and non-empty rows');
    const { clusterId, database, dbUser, region, accessKeyId, secretAccessKey, sessionToken } = this.config;
    const sql = `INSERT INTO ${table} (${Object.keys(rows[0]).join(',')}) VALUES ${rows.map((row) => `(${Object.values(row).map((v) => `'${String(v ?? '').replace(/'/g, "''")}'`).join(',')})`).join(',')}`;
    const body = JSON.stringify({ Database: database, DbUser: dbUser, Sql: sql });
    const url = `https://redshift-data.${region}.amazonaws.com/`;
    const { signAwsRequest } = require('../utils/awsSigV4');
    const headers = signAwsRequest({
      method: 'POST',
      url: `${url}?Action=ExecuteStatement`,
      body,
      headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'RedshiftData.ExecuteStatement' },
      accessKeyId,
      secretAccessKey,
      region,
      service: 'redshift-data',
      sessionToken
    });
    const response = await axios.post(url, body, { headers, timeout: 60000 });
    return { statementId: response.data.Id, rowsAffected: rows.length };
  }

  async testConnection() {
    const { clusterId, database, dbUser, region, accessKeyId, secretAccessKey, sessionToken } = this.config;
    const body = JSON.stringify({ ClusterIdentifier: clusterId, Database: database, DbUser: dbUser, Sql: 'SELECT 1' });
    const url = `https://redshift-data.${region}.amazonaws.com/`;
    const { signAwsRequest } = require('../utils/awsSigV4');
    const headers = signAwsRequest({
      method: 'POST',
      url,
      body,
      headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'RedshiftData.ExecuteStatement' },
      accessKeyId,
      secretAccessKey,
      region,
      service: 'redshift-data',
      sessionToken
    });
    await axios.post(url, body, { headers, timeout: 15000 });
    return true;
  }
}

const createDataWarehouseAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid data warehouse configuration');
  switch (config.provider.toLowerCase()) {
    case 'snowflake':
      return new SnowflakeAdapter(config);
    case 'bigquery':
      return new BigQueryAdapter(config);
    case 'redshift':
      return new RedshiftAdapter(config);
    default:
      throw new Error(`Unsupported data warehouse provider: ${config.provider}`);
  }
};

module.exports = { createDataWarehouseAdapter, SnowflakeAdapter, BigQueryAdapter, RedshiftAdapter };
