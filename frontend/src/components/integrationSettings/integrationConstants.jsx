import {
  Mail, Calendar, MessageSquare, Bot, Briefcase,
  ShieldCheck, FileSignature, Plug, Video, Database, KeyRound, Users, Building2, Activity, BarChart3,
  Server, Globe, Link2,
} from 'lucide-react';
import { WhatsAppIcon } from '../icons/BrandIcons';

export const WaIcon = ({ className }) => <WhatsAppIcon size={20} className={className} />;

export const INTEGRATIONS_TOUR_KEY = 'skillnix_tour_integrations_v1';
export const INTEGRATIONS_TOUR_STEPS = [
  {
    title: 'Integrations',
    body: 'Connect email, AI, calendars, messaging, and more — credentials stay encrypted per organization.',
  },
  {
    target: '[data-tour="integrations-tip"]',
    title: 'Quick tip',
    body: 'AI Tools need an AI provider here. Press ? anytime to reopen this tour.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="integrations-filters"]',
    title: 'Find providers',
    body: 'Search by name, or filter by category and connection status.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="integrations-catalog"]',
    title: 'Provider catalog',
    body: 'Configure / Manage opens a modal with premium fields. Save, then Test — leave secrets blank to keep existing values.',
    placement: 'top',
  },
];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'connected', label: 'Connected' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'not_setup', label: 'Not set up' },
];

export const AWS_REGION_OPTIONS = [
  { value: 'us-east-1', label: 'us-east-1 — N. Virginia' },
  { value: 'us-east-2', label: 'us-east-2 — Ohio' },
  { value: 'us-west-1', label: 'us-west-1 — N. California' },
  { value: 'us-west-2', label: 'us-west-2 — Oregon' },
  { value: 'eu-west-1', label: 'eu-west-1 — Ireland' },
  { value: 'eu-central-1', label: 'eu-central-1 — Frankfurt' },
  { value: 'ap-south-1', label: 'ap-south-1 — Mumbai' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 — Singapore' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 — Tokyo' },
];

export const PORT_OPTIONS = [
  { value: '587', label: '587 — STARTTLS (recommended)' },
  { value: '465', label: '465 — SSL/TLS' },
  { value: '25', label: '25 — SMTP' },
  { value: '2525', label: '2525 — Alternate' },
];

export const MODEL_OPTIONS_BY_PROVIDER = {
  openai: [
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  ],
  bedrock: [
    { value: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet (Bedrock)' },
    { value: 'amazon.titan-text-express-v1', label: 'Titan Text Express' },
  ],
};

export const TEXTAREA_FIELDS = new Set(['privateKey']);
export const HALF_WIDTH_FIELDS = new Set([
  'port', 'region', 'model', 'bucket', 'container', 'subdomain',
  'packageId', 'packageSlug', 'packageCode', 'index', 'sourcetype',
  'env', 'role', 'schema', 'location', 'keyRing', 'tenant',
]);

export const card = (id, name, desc, category, icon, color, bg, feature, fields) =>
  ({ id, name, desc, category, icon, color, bg, feature, fields });

export const EMAIL_PROVIDERS = [
  card('smtp', 'Custom SMTP', 'Connect your own email server', 'email', Mail, 'text-brand-600', 'bg-brand-50', null, ['host', 'port', 'username', 'password', 'fromEmail']),
  card('zeptomail', 'Zoho ZeptoMail', 'High deliverability transactional email', 'email', Mail, 'text-amber-500', 'bg-amber-50', 'integrations.byoEmail', ['apiKey', 'fromEmail']),
  card('sendgrid', 'SendGrid', 'Cloud-based email delivery', 'email', Mail, 'text-teal-600', 'bg-teal-50', 'integrations.byoEmail', ['apiKey', 'fromEmail']),
  card('ses', 'AWS SES', 'Amazon Simple Email Service', 'email', Mail, 'text-orange-600', 'bg-orange-50', 'integrations.byoEmail', ['accessKeyId', 'secretAccessKey', 'region', 'fromEmail']),
  card('mailgun', 'Mailgun', 'Developer-friendly email API', 'email', Mail, 'text-red-600', 'bg-red-50', 'integrations.byoEmail', ['apiKey', 'domain', 'fromEmail']),
  card('postmark', 'Postmark', 'Fast transactional email', 'email', Mail, 'text-blue-600', 'bg-blue-50', 'integrations.byoEmail', ['serverToken', 'fromEmail'])
];

export const CALENDAR_PROVIDERS = [
  card('google', 'Google Calendar', 'Sync interviews with Google Calendar', 'calendar', Calendar, 'text-blue-600', 'bg-blue-50', 'integrations.calendar', ['clientId', 'clientSecret', 'refreshToken', 'calendarId']),
  card('outlook', 'Outlook Calendar', 'Sync interviews with Microsoft Outlook', 'calendar', Calendar, 'text-sky-600', 'bg-sky-50', 'integrations.calendar', ['clientId', 'clientSecret', 'refreshToken', 'tenantId'])
];

export const AI_PROVIDERS = [
  card('openai', 'OpenAI', 'GPT models for scoring and generation', 'ai', Bot, 'text-emerald-600', 'bg-emerald-50', 'integrations.aiScoring', ['apiKey', 'model']),
  card('anthropic', 'Anthropic', 'Claude models for ATS intelligence', 'ai', Bot, 'text-amber-600', 'bg-amber-50', 'integrations.aiScoring', ['apiKey', 'model']),
  card('azure_openai', 'Azure OpenAI', 'Enterprise OpenAI on Azure', 'ai', Bot, 'text-blue-600', 'bg-blue-50', 'integrations.aiScoring', ['endpoint', 'apiKey', 'deploymentName', 'embeddingDeployment']),
  card('gemini', 'Google Gemini', 'Gemini models for matching and scoring', 'ai', Bot, 'text-teal-600', 'bg-teal-50', 'integrations.aiScoring', ['apiKey', 'model']),
  card('bedrock', 'AWS Bedrock', 'Foundation models via AWS Bedrock', 'ai', Bot, 'text-orange-600', 'bg-orange-50', 'integrations.aiScoring', ['accessKeyId', 'secretAccessKey', 'region', 'model'])
];

export const SMS_PROVIDERS = [
  card('twilio', 'Twilio SMS', 'Send SMS via Twilio', 'sms', MessageSquare, 'text-red-500', 'bg-red-50', 'integrations.sms', ['accountSid', 'authToken', 'fromNumber']),
  card('messagebird', 'MessageBird', 'Global SMS delivery', 'sms', MessageSquare, 'text-blue-600', 'bg-blue-50', 'integrations.sms', ['apiKey', 'originator']),
  card('vonage', 'Vonage', 'Nexmo SMS API', 'sms', MessageSquare, 'text-stone-700', 'bg-stone-100', 'integrations.sms', ['apiKey', 'apiSecret', 'fromNumber']),
  card('aws_sns', 'AWS SNS', 'SMS via Amazon SNS', 'sms', MessageSquare, 'text-orange-600', 'bg-orange-50', 'integrations.sms', ['accessKeyId', 'secretAccessKey', 'region', 'fromNumber']),
  card('gupshup', 'Gupshup SMS', 'SMS for India and global markets', 'sms', MessageSquare, 'text-green-600', 'bg-green-50', 'integrations.sms', ['apiKey', 'appName', 'sourceNumber'])
];

export const WHATSAPP_PROVIDERS = [
  card('twilio', 'Twilio WhatsApp', 'WhatsApp via Twilio (same credentials as SMS)', 'whatsapp', WaIcon, 'text-emerald-600', 'bg-emerald-50', 'integrations.whatsapp', ['accountSid', 'authToken', 'fromNumber']),
  card('gupshup', 'Gupshup WhatsApp', 'WhatsApp Business via Gupshup', 'whatsapp', WaIcon, 'text-emerald-600', 'bg-emerald-50', 'integrations.whatsapp', ['apiKey', 'appName', 'sourceNumber']),
];

export const JOB_BOARD_PROVIDERS = [
  card('indeed_feed', 'Indeed Feed', 'Pull-based XML feed for Indeed', 'job_board', Briefcase, 'text-brand-600', 'bg-brand-50', 'integrations.jobBoard', ['feedUrl']),
  card('google_jobs_feed', 'Google Jobs Feed', 'Pull-based feed for Google Jobs', 'job_board', Briefcase, 'text-blue-600', 'bg-blue-50', 'integrations.jobBoard', ['feedUrl']),
  card('webhook', 'Custom Relay / Zapier', 'Push jobs to middleware or partner endpoint', 'job_board', Briefcase, 'text-teal-600', 'bg-teal-50', 'integrations.jobBoard', ['webhookUrl']),
  card('linkedin', 'LinkedIn', 'Direct job posting to LinkedIn', 'job_board', Briefcase, 'text-sky-700', 'bg-sky-50', 'integrations.jobBoard', ['accessToken', 'organizationUrn']),
  card('ziprecruiter', 'ZipRecruiter', 'Post jobs to ZipRecruiter', 'job_board', Briefcase, 'text-green-700', 'bg-green-50', 'integrations.jobBoard', ['apiKey', 'employerId']),
  card('naukri', 'Naukri', 'Post jobs to Naukri.com', 'job_board', Briefcase, 'text-brand-600', 'bg-brand-50', 'integrations.jobBoard', ['apiKey', 'recruiterId']),
  card('monster', 'Monster', 'Post jobs to Monster', 'job_board', Briefcase, 'text-stone-700', 'bg-stone-100', 'integrations.jobBoard', ['clientId', 'clientSecret', 'boardId'])
];

export const BACKGROUND_CHECK_PROVIDERS = [
  card('checkr', 'Checkr', 'US background checks', 'background_check', ShieldCheck, 'text-emerald-500', 'bg-emerald-50', 'integrations.backgroundCheck', ['apiKey', 'packageSlug']),
  card('sterling', 'Sterling', 'Global background screening', 'background_check', ShieldCheck, 'text-blue-600', 'bg-blue-50', 'integrations.backgroundCheck', ['apiKey', 'packageId', 'baseUrl']),
  card('hireright', 'HireRight', 'Enterprise background checks', 'background_check', ShieldCheck, 'text-stone-700', 'bg-stone-100', 'integrations.backgroundCheck', ['clientId', 'clientSecret', 'packageCode', 'baseUrl']),
  card('goodhire', 'GoodHire', 'SMB-friendly background checks', 'background_check', ShieldCheck, 'text-teal-600', 'bg-teal-50', 'integrations.backgroundCheck', ['apiKey', 'packageId']),
  card('springverify', 'SpringVerify', 'India background verification', 'background_check', ShieldCheck, 'text-orange-600', 'bg-orange-50', 'integrations.backgroundCheck', ['apiKey', 'packageId', 'baseUrl']),
  card('authbridge', 'AuthBridge', 'India compliance screening', 'background_check', ShieldCheck, 'text-red-600', 'bg-red-50', 'integrations.backgroundCheck', ['apiKey', 'clientCode', 'packageCode', 'baseUrl']),
  card('idfy', 'IDfy', 'Identity and background verification', 'background_check', ShieldCheck, 'text-brand-600', 'bg-brand-50', 'integrations.backgroundCheck', ['apiKey', 'accountId', 'taskId', 'baseUrl'])
];

export const ESIGN_PROVIDERS = [
  card('docusign', 'DocuSign', 'Send offer letters for e-signature', 'esign', FileSignature, 'text-rose-500', 'bg-rose-50', 'integrations.esign', ['accessToken', 'accountId', 'basePath']),
  card('dropbox_sign', 'Dropbox Sign', 'HelloSign / Dropbox Sign API', 'esign', FileSignature, 'text-blue-600', 'bg-blue-50', 'integrations.esign', ['apiKey', 'clientId']),
  card('adobe_sign', 'Adobe Sign', 'Adobe Acrobat Sign', 'esign', FileSignature, 'text-red-600', 'bg-red-50', 'integrations.esign', ['accessToken', 'baseUrl']),
  card('pandadoc', 'PandaDoc', 'Document workflow and e-sign', 'esign', FileSignature, 'text-emerald-600', 'bg-emerald-50', 'integrations.esign', ['apiKey'])
];

export const VIDEO_PROVIDERS = [
  card('zoom', 'Zoom', 'Create Zoom meeting links for interviews', 'video', Video, 'text-blue-600', 'bg-blue-50', 'integrations.video', ['accountId', 'clientId', 'clientSecret']),
  card('teams', 'Microsoft Teams', 'Teams online meetings', 'video', Video, 'text-sky-600', 'bg-sky-50', 'integrations.video', ['clientId', 'clientSecret', 'refreshToken', 'tenantId']),
  card('google_meet', 'Google Meet', 'Meet links via Google Calendar', 'video', Video, 'text-green-600', 'bg-green-50', 'integrations.video', ['clientId', 'clientSecret', 'refreshToken', 'calendarId'])
];

export const STORAGE_PROVIDERS = [
  card('s3', 'AWS S3', 'Object storage on Amazon S3', 'storage', Database, 'text-orange-600', 'bg-orange-50', 'integrations.storage', ['accessKeyId', 'secretAccessKey', 'region', 'bucket', 'prefix']),
  card('azure_blob', 'Azure Blob', 'Azure Blob Storage', 'storage', Database, 'text-sky-600', 'bg-sky-50', 'integrations.storage', ['connectionString', 'container']),
  card('gcs', 'Google Cloud Storage', 'GCS buckets for file storage', 'storage', Database, 'text-blue-600', 'bg-blue-50', 'integrations.storage', ['projectId', 'bucket', 'clientEmail', 'privateKey'])
];

export const ENCRYPTION_PROVIDERS = [
  card('aws_kms', 'AWS KMS', 'Envelope encryption with AWS KMS', 'encryption', KeyRound, 'text-orange-600', 'bg-orange-50', 'security.byokEncryption', ['accessKeyId', 'secretAccessKey', 'region', 'keyId']),
  card('azure_keyvault', 'Azure Key Vault', 'Keys in Azure Key Vault', 'encryption', KeyRound, 'text-sky-600', 'bg-sky-50', 'security.byokEncryption', ['vaultUrl', 'clientId', 'clientSecret', 'tenantId', 'keyName']),
  card('gcp_kms', 'GCP Cloud KMS', 'Google Cloud KMS keys', 'encryption', KeyRound, 'text-blue-600', 'bg-blue-50', 'security.byokEncryption', ['projectId', 'location', 'keyRing', 'cryptoKey', 'clientEmail', 'privateKey'])
];

export const CRM_PROVIDERS = [
  card('salesforce', 'Salesforce', 'Sync candidates with Salesforce CRM', 'crm', Users, 'text-sky-600', 'bg-sky-50', 'integrations.crm', ['clientId', 'clientSecret', 'refreshToken', 'instanceUrl']),
  card('hubspot', 'HubSpot', 'Sync candidates with HubSpot CRM', 'crm', Users, 'text-orange-600', 'bg-orange-50', 'integrations.crm', ['accessToken'])
];

export const HRIS_PROVIDERS = [
  card('workday', 'Workday', 'Push hires to Workday HCM', 'hris', Building2, 'text-stone-700', 'bg-stone-100', 'integrations.hris', ['baseUrl', 'tenant', 'username', 'password']),
  card('bamboohr', 'BambooHR', 'Push hires to BambooHR', 'hris', Building2, 'text-green-600', 'bg-green-50', 'integrations.hris', ['apiKey', 'subdomain']),
  card('adp', 'ADP', 'Push hires to ADP Workforce', 'hris', Building2, 'text-red-600', 'bg-red-50', 'integrations.hris', ['clientId', 'clientSecret', 'baseUrl'])
];

export const SIEM_PROVIDERS = [
  card('splunk', 'Splunk', 'Ship audit events to Splunk HEC', 'siem', Activity, 'text-green-700', 'bg-green-50', 'integrations.siem', ['hecUrl', 'hecToken', 'index', 'sourcetype']),
  card('datadog', 'Datadog', 'Ship logs to Datadog', 'siem', Activity, 'text-stone-700', 'bg-stone-100', 'integrations.siem', ['apiKey', 'site', 'service', 'source', 'env'])
];

export const DATA_WAREHOUSE_PROVIDERS = [
  card('snowflake', 'Snowflake', 'Upsert analytics rows to Snowflake', 'data_warehouse', BarChart3, 'text-sky-600', 'bg-sky-50', 'integrations.dataWarehouse', ['account', 'username', 'password', 'warehouse', 'database', 'schema', 'role']),
  card('bigquery', 'BigQuery', 'Stream rows to Google BigQuery', 'data_warehouse', BarChart3, 'text-blue-600', 'bg-blue-50', 'integrations.dataWarehouse', ['projectId', 'dataset', 'clientEmail', 'privateKey']),
  card('redshift', 'Amazon Redshift', 'Load rows via Redshift Data API', 'data_warehouse', BarChart3, 'text-orange-600', 'bg-orange-50', 'integrations.dataWarehouse', ['clusterId', 'database', 'dbUser', 'region', 'accessKeyId', 'secretAccessKey'])
];

export const FIELD_LABELS = {
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

export const FIELD_HINTS = {
  host: 'e.g. smtp.gmail.com', port: 'e.g. 587', fromEmail: 'Appears as the sender',
  apiKey: 'From your provider dashboard', feedUrl: 'Public XML feed URL',
  webhookUrl: 'HTTPS endpoint for job posts', fromNumber: 'E.164 format, e.g. +14155551234',
  organizationUrn: 'urn:li:organization:12345', refreshToken: 'OAuth refresh token from connect flow',
  privateKey: 'PEM key with \\n line breaks', prefix: 'Optional folder prefix in bucket'
};

export const SECRET_FIELDS = new Set([
  'password', 'apiKey', 'authToken', 'accessToken', 'secretAccessKey', 'serverToken',
  'apiSecret', 'privateKey', 'hecToken', 'clientSecret', 'botToken', 'signingSecret'
]);

export const EMAIL_FIELDS = new Set(['fromEmail', 'clientEmail', 'username']);

export const FIELD_ICONS = {
  host: Server,
  port: Server,
  username: Mail,
  password: KeyRound,
  fromEmail: Mail,
  apiKey: KeyRound,
  feedUrl: Link2,
  webhookUrl: Link2,
  accessKeyId: KeyRound,
  secretAccessKey: KeyRound,
  clientId: KeyRound,
  clientSecret: KeyRound,
  refreshToken: KeyRound,
  accessToken: KeyRound,
  serverToken: KeyRound,
  authToken: KeyRound,
  apiSecret: KeyRound,
  accountSid: KeyRound,
  domain: Globe,
  region: Globe,
  endpoint: Server,
  baseUrl: Server,
  basePath: Server,
  calendarId: Calendar,
  tenantId: Building2,
  model: Bot,
  deploymentName: Bot,
  bucket: Database,
  container: Database,
  connectionString: Database,
  clientEmail: Mail,
  vaultUrl: Server,
  instanceUrl: Globe,
  subdomain: Globe,
  hecUrl: Server,
  hecToken: KeyRound,
  account: Server,
  warehouse: Database,
  database: Database,
  botToken: KeyRound,
  signingSecret: KeyRound,
};

export const SLACK_PROVIDERS = [
  card('slack', 'Slack App', 'Slash commands: /skillnix help, /skillnix candidates search', 'slack_app', Plug, 'text-brand-600', 'bg-brand-50', 'integrations.slackApp', ['botToken', 'signingSecret', 'teamId']),
  card('teams', 'Microsoft Teams', 'Outgoing webhook for candidate search stub', 'slack_app', Plug, 'text-sky-600', 'bg-sky-50', 'integrations.slackApp', ['botToken', 'signingSecret'])
];

export const SECTIONS = [
  { title: 'Email Providers', icon: Mail, providers: EMAIL_PROVIDERS },
  { title: 'Calendar', icon: Calendar, providers: CALENDAR_PROVIDERS },
  { title: 'AI / Scoring', icon: Bot, providers: AI_PROVIDERS },
  { title: 'SMS', icon: MessageSquare, providers: SMS_PROVIDERS },
  { title: 'WhatsApp Messaging', icon: WaIcon, providers: WHATSAPP_PROVIDERS },
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

