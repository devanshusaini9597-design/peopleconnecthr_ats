import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail, Calendar, MessageSquare, Bot, Briefcase,
  Settings, CheckCircle2, AlertCircle, Loader2, Unlink, Lock, ShieldCheck, FileSignature, Plug, Save,
  Video, Database, KeyRound, Users, Building2, Activity, BarChart3
} from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';

const card = (id, name, desc, category, icon, color, bg, feature, fields) =>
  ({ id, name, desc, category, icon, color, bg, feature, fields });

const EMAIL_PROVIDERS = [
  card('smtp', 'Custom SMTP', 'Connect your own email server', 'email', Mail, 'text-brand-600', 'bg-brand-50', null, ['host', 'port', 'username', 'password', 'fromEmail']),
  card('zeptomail', 'Zoho ZeptoMail', 'High deliverability transactional email', 'email', Mail, 'text-amber-500', 'bg-amber-50', 'integrations.byoEmail', ['apiKey', 'fromEmail']),
  card('sendgrid', 'SendGrid', 'Cloud-based email delivery', 'email', Mail, 'text-teal-600', 'bg-teal-50', 'integrations.byoEmail', ['apiKey', 'fromEmail']),
  card('ses', 'AWS SES', 'Amazon Simple Email Service', 'email', Mail, 'text-orange-600', 'bg-orange-50', 'integrations.byoEmail', ['accessKeyId', 'secretAccessKey', 'region', 'fromEmail']),
  card('mailgun', 'Mailgun', 'Developer-friendly email API', 'email', Mail, 'text-red-600', 'bg-red-50', 'integrations.byoEmail', ['apiKey', 'domain', 'fromEmail']),
  card('postmark', 'Postmark', 'Fast transactional email', 'email', Mail, 'text-blue-600', 'bg-blue-50', 'integrations.byoEmail', ['serverToken', 'fromEmail'])
];

const CALENDAR_PROVIDERS = [
  card('google', 'Google Calendar', 'Sync interviews with Google Calendar', 'calendar', Calendar, 'text-blue-600', 'bg-blue-50', 'integrations.calendar', ['clientId', 'clientSecret', 'refreshToken', 'calendarId']),
  card('outlook', 'Outlook Calendar', 'Sync interviews with Microsoft Outlook', 'calendar', Calendar, 'text-sky-600', 'bg-sky-50', 'integrations.calendar', ['clientId', 'clientSecret', 'refreshToken', 'tenantId'])
];

const AI_PROVIDERS = [
  card('openai', 'OpenAI', 'GPT models for scoring and generation', 'ai', Bot, 'text-emerald-600', 'bg-emerald-50', 'integrations.aiScoring', ['apiKey', 'model']),
  card('anthropic', 'Anthropic', 'Claude models for ATS intelligence', 'ai', Bot, 'text-amber-600', 'bg-amber-50', 'integrations.aiScoring', ['apiKey', 'model']),
  card('azure_openai', 'Azure OpenAI', 'Enterprise OpenAI on Azure', 'ai', Bot, 'text-blue-600', 'bg-blue-50', 'integrations.aiScoring', ['endpoint', 'apiKey', 'deploymentName', 'embeddingDeployment']),
  card('gemini', 'Google Gemini', 'Gemini models for matching and scoring', 'ai', Bot, 'text-violet-600', 'bg-violet-50', 'integrations.aiScoring', ['apiKey', 'model']),
  card('bedrock', 'AWS Bedrock', 'Foundation models via AWS Bedrock', 'ai', Bot, 'text-orange-600', 'bg-orange-50', 'integrations.aiScoring', ['accessKeyId', 'secretAccessKey', 'region', 'model'])
];

const SMS_PROVIDERS = [
  card('twilio', 'Twilio SMS', 'Send SMS via Twilio', 'sms', MessageSquare, 'text-red-500', 'bg-red-50', 'integrations.sms', ['accountSid', 'authToken', 'fromNumber']),
  card('messagebird', 'MessageBird', 'Global SMS delivery', 'sms', MessageSquare, 'text-blue-600', 'bg-blue-50', 'integrations.sms', ['apiKey', 'originator']),
  card('vonage', 'Vonage', 'Nexmo SMS API', 'sms', MessageSquare, 'text-stone-700', 'bg-stone-100', 'integrations.sms', ['apiKey', 'apiSecret', 'fromNumber']),
  card('aws_sns', 'AWS SNS', 'SMS via Amazon SNS', 'sms', MessageSquare, 'text-orange-600', 'bg-orange-50', 'integrations.sms', ['accessKeyId', 'secretAccessKey', 'region', 'fromNumber']),
  card('gupshup', 'Gupshup SMS', 'SMS for India and global markets', 'sms', MessageSquare, 'text-green-600', 'bg-green-50', 'integrations.sms', ['apiKey', 'appName', 'sourceNumber'])
];

const WHATSAPP_PROVIDERS = [
  card('twilio', 'Twilio WhatsApp', 'WhatsApp via Twilio (same credentials as SMS)', 'whatsapp', MessageSquare, 'text-emerald-500', 'bg-emerald-50', 'integrations.whatsapp', ['accountSid', 'authToken', 'fromNumber']),
  card('twilio_whatsapp', 'Twilio WhatsApp (legacy id)', 'Alias for Twilio WhatsApp integration', 'whatsapp', MessageSquare, 'text-emerald-500', 'bg-emerald-50', 'integrations.whatsapp', ['accountSid', 'authToken', 'fromNumber']),
  card('gupshup', 'Gupshup WhatsApp', 'WhatsApp Business via Gupshup', 'whatsapp', MessageSquare, 'text-green-600', 'bg-green-50', 'integrations.whatsapp', ['apiKey', 'appName', 'sourceNumber'])
];

const JOB_BOARD_PROVIDERS = [
  card('indeed_feed', 'Indeed Feed', 'Pull-based XML feed for Indeed', 'job_board', Briefcase, 'text-brand-600', 'bg-brand-50', 'integrations.jobBoard', ['feedUrl']),
  card('google_jobs_feed', 'Google Jobs Feed', 'Pull-based feed for Google Jobs', 'job_board', Briefcase, 'text-blue-600', 'bg-blue-50', 'integrations.jobBoard', ['feedUrl']),
  card('webhook', 'Custom Relay / Zapier', 'Push jobs to middleware or partner endpoint', 'job_board', Briefcase, 'text-teal-600', 'bg-teal-50', 'integrations.jobBoard', ['webhookUrl']),
  card('linkedin', 'LinkedIn', 'Direct job posting to LinkedIn', 'job_board', Briefcase, 'text-sky-700', 'bg-sky-50', 'integrations.jobBoard', ['accessToken', 'organizationUrn']),
  card('ziprecruiter', 'ZipRecruiter', 'Post jobs to ZipRecruiter', 'job_board', Briefcase, 'text-green-700', 'bg-green-50', 'integrations.jobBoard', ['apiKey', 'employerId']),
  card('naukri', 'Naukri', 'Post jobs to Naukri.com', 'job_board', Briefcase, 'text-indigo-600', 'bg-indigo-50', 'integrations.jobBoard', ['apiKey', 'recruiterId']),
  card('monster', 'Monster', 'Post jobs to Monster', 'job_board', Briefcase, 'text-purple-600', 'bg-purple-50', 'integrations.jobBoard', ['clientId', 'clientSecret', 'boardId'])
];

const BACKGROUND_CHECK_PROVIDERS = [
  card('checkr', 'Checkr', 'US background checks', 'background_check', ShieldCheck, 'text-emerald-500', 'bg-emerald-50', 'integrations.backgroundCheck', ['apiKey', 'packageSlug']),
  card('sterling', 'Sterling', 'Global background screening', 'background_check', ShieldCheck, 'text-blue-600', 'bg-blue-50', 'integrations.backgroundCheck', ['apiKey', 'packageId', 'baseUrl']),
  card('hireright', 'HireRight', 'Enterprise background checks', 'background_check', ShieldCheck, 'text-stone-700', 'bg-stone-100', 'integrations.backgroundCheck', ['clientId', 'clientSecret', 'packageCode', 'baseUrl']),
  card('goodhire', 'GoodHire', 'SMB-friendly background checks', 'background_check', ShieldCheck, 'text-teal-600', 'bg-teal-50', 'integrations.backgroundCheck', ['apiKey', 'packageId']),
  card('springverify', 'SpringVerify', 'India background verification', 'background_check', ShieldCheck, 'text-orange-600', 'bg-orange-50', 'integrations.backgroundCheck', ['apiKey', 'packageId', 'baseUrl']),
  card('authbridge', 'AuthBridge', 'India compliance screening', 'background_check', ShieldCheck, 'text-red-600', 'bg-red-50', 'integrations.backgroundCheck', ['apiKey', 'clientCode', 'packageCode', 'baseUrl']),
  card('idfy', 'IDfy', 'Identity and background verification', 'background_check', ShieldCheck, 'text-violet-600', 'bg-violet-50', 'integrations.backgroundCheck', ['apiKey', 'accountId', 'taskId', 'baseUrl'])
];

const ESIGN_PROVIDERS = [
  card('docusign', 'DocuSign', 'Send offer letters for e-signature', 'esign', FileSignature, 'text-rose-500', 'bg-rose-50', 'integrations.esign', ['accessToken', 'accountId', 'basePath']),
  card('dropbox_sign', 'Dropbox Sign', 'HelloSign / Dropbox Sign API', 'esign', FileSignature, 'text-blue-600', 'bg-blue-50', 'integrations.esign', ['apiKey', 'clientId']),
  card('adobe_sign', 'Adobe Sign', 'Adobe Acrobat Sign', 'esign', FileSignature, 'text-red-600', 'bg-red-50', 'integrations.esign', ['accessToken', 'baseUrl']),
  card('pandadoc', 'PandaDoc', 'Document workflow and e-sign', 'esign', FileSignature, 'text-emerald-600', 'bg-emerald-50', 'integrations.esign', ['apiKey'])
];

const VIDEO_PROVIDERS = [
  card('zoom', 'Zoom', 'Create Zoom meeting links for interviews', 'video', Video, 'text-blue-600', 'bg-blue-50', 'integrations.video', ['accountId', 'clientId', 'clientSecret']),
  card('teams', 'Microsoft Teams', 'Teams online meetings', 'video', Video, 'text-sky-600', 'bg-sky-50', 'integrations.video', ['clientId', 'clientSecret', 'refreshToken', 'tenantId']),
  card('google_meet', 'Google Meet', 'Meet links via Google Calendar', 'video', Video, 'text-green-600', 'bg-green-50', 'integrations.video', ['clientId', 'clientSecret', 'refreshToken', 'calendarId'])
];

const STORAGE_PROVIDERS = [
  card('s3', 'AWS S3', 'Object storage on Amazon S3', 'storage', Database, 'text-orange-600', 'bg-orange-50', 'integrations.storage', ['accessKeyId', 'secretAccessKey', 'region', 'bucket', 'prefix']),
  card('azure_blob', 'Azure Blob', 'Azure Blob Storage', 'storage', Database, 'text-sky-600', 'bg-sky-50', 'integrations.storage', ['connectionString', 'container']),
  card('gcs', 'Google Cloud Storage', 'GCS buckets for file storage', 'storage', Database, 'text-blue-600', 'bg-blue-50', 'integrations.storage', ['projectId', 'bucket', 'clientEmail', 'privateKey'])
];

const ENCRYPTION_PROVIDERS = [
  card('aws_kms', 'AWS KMS', 'Envelope encryption with AWS KMS', 'encryption', KeyRound, 'text-orange-600', 'bg-orange-50', 'security.byokEncryption', ['accessKeyId', 'secretAccessKey', 'region', 'keyId']),
  card('azure_keyvault', 'Azure Key Vault', 'Keys in Azure Key Vault', 'encryption', KeyRound, 'text-sky-600', 'bg-sky-50', 'security.byokEncryption', ['vaultUrl', 'clientId', 'clientSecret', 'tenantId', 'keyName']),
  card('gcp_kms', 'GCP Cloud KMS', 'Google Cloud KMS keys', 'encryption', KeyRound, 'text-blue-600', 'bg-blue-50', 'security.byokEncryption', ['projectId', 'location', 'keyRing', 'cryptoKey', 'clientEmail', 'privateKey'])
];

const CRM_PROVIDERS = [
  card('salesforce', 'Salesforce', 'Sync candidates with Salesforce CRM', 'crm', Users, 'text-sky-600', 'bg-sky-50', 'integrations.crm', ['clientId', 'clientSecret', 'refreshToken', 'instanceUrl']),
  card('hubspot', 'HubSpot', 'Sync candidates with HubSpot CRM', 'crm', Users, 'text-orange-600', 'bg-orange-50', 'integrations.crm', ['accessToken'])
];

const HRIS_PROVIDERS = [
  card('workday', 'Workday', 'Push hires to Workday HCM', 'hris', Building2, 'text-stone-700', 'bg-stone-100', 'integrations.hris', ['baseUrl', 'tenant', 'username', 'password']),
  card('bamboohr', 'BambooHR', 'Push hires to BambooHR', 'hris', Building2, 'text-green-600', 'bg-green-50', 'integrations.hris', ['apiKey', 'subdomain']),
  card('adp', 'ADP', 'Push hires to ADP Workforce', 'hris', Building2, 'text-red-600', 'bg-red-50', 'integrations.hris', ['clientId', 'clientSecret', 'baseUrl'])
];

const SIEM_PROVIDERS = [
  card('splunk', 'Splunk', 'Ship audit events to Splunk HEC', 'siem', Activity, 'text-green-700', 'bg-green-50', 'integrations.siem', ['hecUrl', 'hecToken', 'index', 'sourcetype']),
  card('datadog', 'Datadog', 'Ship logs to Datadog', 'siem', Activity, 'text-purple-600', 'bg-purple-50', 'integrations.siem', ['apiKey', 'site', 'service', 'source', 'env'])
];

const DATA_WAREHOUSE_PROVIDERS = [
  card('snowflake', 'Snowflake', 'Upsert analytics rows to Snowflake', 'data_warehouse', BarChart3, 'text-sky-600', 'bg-sky-50', 'integrations.dataWarehouse', ['account', 'username', 'password', 'warehouse', 'database', 'schema', 'role']),
  card('bigquery', 'BigQuery', 'Stream rows to Google BigQuery', 'data_warehouse', BarChart3, 'text-blue-600', 'bg-blue-50', 'integrations.dataWarehouse', ['projectId', 'dataset', 'clientEmail', 'privateKey']),
  card('redshift', 'Amazon Redshift', 'Load rows via Redshift Data API', 'data_warehouse', BarChart3, 'text-orange-600', 'bg-orange-50', 'integrations.dataWarehouse', ['clusterId', 'database', 'dbUser', 'region', 'accessKeyId', 'secretAccessKey'])
];

const FIELD_LABELS = {
  host: 'Host', port: 'Port', username: 'Username / Email', password: 'Password',
  fromEmail: 'From Email', apiKey: 'API Key', feedUrl: 'Public Feed URL', webhookUrl: 'Relay Webhook URL',
  packageSlug: 'Package Slug', packageId: 'Package ID', packageCode: 'Package Code',
  accessToken: 'Access Token', accountId: 'Account ID', basePath: 'API Base Path',
  accountSid: 'Account SID', authToken: 'Auth Token', fromNumber: 'From Number',
  serverToken: 'Server Token', domain: 'Mailgun Domain',
  accessKeyId: 'AWS Access Key ID', secretAccessKey: 'AWS Secret Access Key', region: 'AWS Region',
  clientId: 'Client ID', clientSecret: 'Client Secret', refreshToken: 'Refresh Token',
  calendarId: 'Calendar ID (optional)', tenantId: 'Tenant ID',
  model: 'Model (optional)', endpoint: 'Azure Endpoint', deploymentName: 'Chat Deployment Name',
  embeddingDeployment: 'Embedding Deployment (optional)',
  organizationUrn: 'LinkedIn Organization URN', employerId: 'Employer ID', recruiterId: 'Recruiter ID',
  boardId: 'Board ID', baseUrl: 'API Base URL', clientCode: 'Client Code', taskId: 'IDfy Task ID',
  originator: 'Sender ID / Originator', apiSecret: 'API Secret', appName: 'App Name / User ID',
  sourceNumber: 'Source / Sender Number', connectionString: 'Connection String', container: 'Container Name',
  bucket: 'Bucket Name', prefix: 'Key Prefix (optional)', projectId: 'Project ID',
  clientEmail: 'Service Account Email', privateKey: 'Service Account Private Key',
  keyId: 'KMS Key ID', vaultUrl: 'Key Vault URL', keyName: 'Key Name',
  location: 'GCP Location', keyRing: 'Key Ring', cryptoKey: 'Crypto Key Name',
  instanceUrl: 'Instance URL (optional)', subdomain: 'BambooHR Subdomain',
  hecUrl: 'Splunk HEC URL', hecToken: 'Splunk HEC Token', index: 'Splunk Index', sourcetype: 'Sourcetype',
  site: 'Datadog Site URL', service: 'Service Name', source: 'Log Source', env: 'Environment Tag',
  account: 'Snowflake Account', warehouse: 'Warehouse', database: 'Database', schema: 'Schema', role: 'Role (optional)',
  teamId: 'Slack Team ID (for workspace mapping)',
  signingSecret: 'Signing Secret', botToken: 'Bot Token'
};

const FIELD_HINTS = {
  host: 'e.g. smtp.gmail.com', port: 'e.g. 587', fromEmail: 'Appears as the sender',
  apiKey: 'From your provider dashboard', feedUrl: 'Public XML feed URL',
  webhookUrl: 'HTTPS endpoint for job posts', fromNumber: 'E.164 format, e.g. +14155551234',
  organizationUrn: 'urn:li:organization:12345', refreshToken: 'OAuth refresh token from connect flow',
  privateKey: 'PEM key with \\n line breaks', prefix: 'Optional folder prefix in bucket'
};

const SECRET_FIELDS = new Set([
  'password', 'apiKey', 'authToken', 'accessToken', 'secretAccessKey', 'serverToken',
  'apiSecret', 'privateKey', 'hecToken', 'clientSecret'
]);

const SLACK_PROVIDERS = [
  card('slack', 'Slack App', 'Slash commands: /skillnix help, /skillnix candidates search', 'slack_app', Plug, 'text-purple-600', 'bg-purple-50', 'integrations.slackApp', ['botToken', 'signingSecret', 'teamId']),
  card('teams', 'Microsoft Teams', 'Outgoing webhook for candidate search stub', 'slack_app', Plug, 'text-sky-600', 'bg-sky-50', 'integrations.slackApp', ['botToken', 'signingSecret'])
];

const SECTIONS = [
  { title: 'Email Providers', icon: Mail, providers: EMAIL_PROVIDERS },
  { title: 'Calendar', icon: Calendar, providers: CALENDAR_PROVIDERS },
  { title: 'AI / Scoring', icon: Bot, providers: AI_PROVIDERS },
  { title: 'SMS', icon: MessageSquare, providers: SMS_PROVIDERS },
  { title: 'WhatsApp Messaging', icon: MessageSquare, providers: WHATSAPP_PROVIDERS },
  { title: 'Job Boards', icon: Briefcase, providers: JOB_BOARD_PROVIDERS },
  { title: 'Background Checks', icon: ShieldCheck, providers: BACKGROUND_CHECK_PROVIDERS },
  { title: 'E-Signature', icon: FileSignature, providers: ESIGN_PROVIDERS },
  { title: 'Video Conferencing', icon: Video, providers: VIDEO_PROVIDERS },
  { title: 'File Storage', icon: Database, providers: STORAGE_PROVIDERS },
  { title: 'BYOK Encryption', icon: KeyRound, providers: ENCRYPTION_PROVIDERS },
  { title: 'CRM', icon: Users, providers: CRM_PROVIDERS },
  { title: 'HRIS', icon: Building2, providers: HRIS_PROVIDERS },
  { title: 'SIEM / Observability', icon: Activity, providers: SIEM_PROVIDERS },
  { title: 'Data Warehouse', icon: BarChart3, providers: DATA_WAREHOUSE_PROVIDERS },
  { title: 'Slack / Teams App', icon: Plug, providers: SLACK_PROVIDERS }
];

const Section = ({ title, icon: Icon, children }) => (
  <section className="animate-fade-in">
    <h2 className="section-title-ats">
      {Icon ? <Icon className="w-4 h-4 text-brand-600" /> : null}
      {title}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {children}
    </div>
  </section>
);

const LoadingSkeleton = () => (
  <div className="space-y-8 animate-fade-in">
    {[1, 2].map((section) => (
      <div key={section}>
        <div className="h-4 w-40 skeleton-ats mb-4 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {[1, 2, 3].map((card) => (
            <div key={card} className="card-ats-bordered p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-11 h-11 skeleton-ats rounded-xl" />
                <div className="h-6 w-24 skeleton-ats rounded-full" />
              </div>
              <div className="h-4 w-2/3 skeleton-ats rounded-lg" />
              <div className="h-3 w-full skeleton-ats rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default function IntegrationSettingsPage() {
  const { organization, token } = useAuth();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token]
  );

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok && data.success) setConfigs(data.data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const getConfigFor = (providerId) => configs.find((c) => c.provider === providerId);

  const openConfigure = (provider) => {
    setFeedback(null);
    setFormValues({});
    setActiveProvider(provider);
  };

  const closeConfigure = () => {
    if (saving || testing) return;
    setActiveProvider(null);
    setFormValues({});
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!activeProvider) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/integrations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          category: activeProvider.category || 'email',
          provider: activeProvider.id,
          displayName: activeProvider.name,
          credentials: formValues
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save');
      setFeedback({ type: 'success', message: 'Saved. Click Test Connection to verify.' });
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!activeProvider) return;
    const config = getConfigFor(activeProvider.id);
    if (!config) {
      setFeedback({ type: 'error', message: 'Save the configuration before testing.' });
      return;
    }
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${config._id}/test`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Connection test failed');
      setFeedback({ type: 'success', message: data.message || 'Connection successful!' });
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleOAuthConnect = async (providerId) => {
    const path =
      providerId === 'google' ? '/api/integrations/oauth/google-calendar/auth-url'
        : providerId === 'outlook' ? '/api/integrations/oauth/outlook-calendar/auth-url'
          : null;
    if (!path) return;
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}${path}`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.success || !data.authUrl) {
        throw new Error(data.message || 'Could not start OAuth');
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDisconnect = async () => {
    const provider = disconnectTarget;
    if (!provider) return;
    const config = getConfigFor(provider.id);
    if (!config) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${config._id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to disconnect');
      if (activeProvider?.id === provider.id) closeConfigure();
      setDisconnectTarget(null);
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const activeConfig = activeProvider ? getConfigFor(activeProvider.id) : null;
  const ActiveIcon = activeProvider?.icon;

  const renderCard = (provider) => {
    const Icon = provider.icon;
    const config = getConfigFor(provider.id);
    const connected = !!(config && config.isActive !== false && config.hasCredentials);
    const validated = !!config?.isValidated;
    const entitled = !provider.feature || planHasFeature(organization?.plan, provider.feature);

    return (
      <article
        key={provider.id}
        className="card-ats-bordered overflow-hidden flex flex-col relative group h-full"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="p-5 flex flex-col flex-1">
          <div className="flex justify-between items-start gap-3 mb-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${provider.bg || 'bg-stone-100'} ${provider.color || 'text-stone-500'} ring-1 ring-black/5`}>
              <Icon className="w-5 h-5" />
            </div>
            {!entitled ? (
              <span className="badge-warning inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Upgrade
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                connected
                  ? (validated
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200')
                  : 'bg-stone-100 text-stone-500 border-stone-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? (validated ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-stone-400'}`} />
                {connected ? (validated ? 'Connected' : 'Unverified') : 'Not set up'}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-stone-900 tracking-tight">{provider.name}</h3>
          <p className="text-sm text-stone-500 mt-1.5 leading-relaxed flex-1">{provider.desc}</p>
          <button
            type="button"
            onClick={() => entitled && openConfigure(provider)}
            disabled={!entitled}
            className="mt-4 w-full btn-secondary !justify-center disabled:opacity-50"
          >
            {entitled ? (
              <><Settings className="w-4 h-4" /> {connected ? 'Manage' : 'Configure'}</>
            ) : (
              <><Lock className="w-4 h-4" /> Upgrade to unlock</>
            )}
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Plug}
        title="Integrations"
        subtitle="Connect email, calendars, AI, messaging, storage, HRIS, and more."
        gradientTitle
      />

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-8">
          {SECTIONS.map(({ title, icon, providers }) => (
            <Section key={title} title={title} icon={icon}>
              {providers.map(renderCard)}
            </Section>
          ))}
        </div>
      )}

      <Modal
        open={!!activeProvider}
        onClose={closeConfigure}
        title={activeProvider?.name || 'Configure'}
        description={activeProvider?.desc}
        size="md"
        footer={
          <>
            {activeConfig && (
              <button
                type="button"
                onClick={() => setDisconnectTarget(activeProvider)}
                className="btn-ghost !text-red-600 hover:!bg-red-50 mr-auto"
                disabled={saving || testing}
              >
                <Unlink className="w-4 h-4" /> Disconnect
              </button>
            )}
            <button type="button" onClick={closeConfigure} className="btn-secondary" disabled={saving || testing}>
              Cancel
            </button>
            <button type="button" onClick={handleTest} className="btn-secondary" disabled={testing || saving || !activeConfig}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
            </button>
            <button type="button" onClick={handleSave} className="btn-primary" disabled={saving || testing}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {activeProvider && (
          <div className="space-y-4">
            {(activeProvider.id === 'google' || activeProvider.id === 'outlook') && (
              <button
                type="button"
                onClick={() => handleOAuthConnect(activeProvider.id)}
                className="w-full btn-primary !justify-center"
              >
                Connect with {activeProvider.id === 'google' ? 'Google' : 'Microsoft'} OAuth
              </button>
            )}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
              {ActiveIcon && (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activeProvider.bg} ${activeProvider.color}`}>
                  <ActiveIcon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 truncate">{activeProvider.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {activeConfig?.hasCredentials
                    ? 'Credentials on file — leave a field blank to keep the current value.'
                    : 'Enter credentials from your provider dashboard.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {activeProvider.fields.map((field) => (
                <div key={field}>
                  <label className="label-ats">{FIELD_LABELS[field] || field}</label>
                  <input
                    type={SECRET_FIELDS.has(field) ? 'password' : 'text'}
                    value={formValues[field] || ''}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder={
                      activeConfig?.hasCredentials
                        ? '•••••••• (leave blank to keep)'
                        : (FIELD_HINTS[field] || `Enter ${FIELD_LABELS[field] || field}`)
                    }
                    className="input-ats"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>

            {feedback && (
              <div className={`text-xs flex items-start gap-2 p-3 rounded-xl font-medium ${
                feedback.type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                  : 'text-red-600 bg-red-50 border border-red-100'
              }`}>
                {feedback.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        title="Disconnect integration?"
        message={`Disconnect ${disconnectTarget?.name}? Saved credentials will be removed.`}
        confirmText="Disconnect"
        type="delete"
        isLoading={disconnecting}
      />
    </div>
  );
}
