export const SSO_TOUR_KEY = 'skillnix_tour_sso_v1';

export const SSO_TOUR_STEPS = [
  {
    title: 'Single Sign-On',
    body: 'Connect your company identity provider so recruiters sign in with Okta, Azure AD, or Google Workspace — one login for the whole stack.',
  },
  {
    target: '[data-tour="sso-tip"]',
    title: 'How it works',
    body: 'Give the Service Provider URLs to your IT admin, paste IdP details here, then enable SSO.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sso-sp"]',
    title: 'Service provider',
    body: 'Copy Entity ID, ACS URL, and Metadata into your IdP app configuration.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sso-idp"]',
    title: 'Identity provider',
    body: 'Choose SAML or OIDC, paste credentials from your IdP, set default role and provisioning.',
    placement: 'top',
  },
];

export const ROLE_OPTIONS = [
  { value: 'recruiter', label: 'Recruiter', description: 'Hiring workflows' },
  { value: 'interviewer', label: 'Interviewer', description: 'Interview access' },
  { value: 'readonly', label: 'Read-only', description: 'View only' },
  { value: 'admin', label: 'Admin', description: 'Full org access' },
];

export const PROTOCOL_OPTIONS = [
  { value: 'saml', label: 'SAML 2.0', description: 'Okta, Azure AD, OneLogin' },
  { value: 'oidc', label: 'OpenID Connect (OIDC)', description: 'Google, Auth0, OAuth 2.0' },
];

export const emptySsoForm = () => ({
  protocol: 'saml',
  enabled: false,
  entryPoint: '',
  idpIssuer: '',
  idpCert: '',
  wantAssertionsSigned: true,
  defaultRole: 'recruiter',
  jitProvisioning: true,
  attributeMap: { email: 'email', name: 'name' },
  oidc: {
    clientId: '',
    clientSecret: '',
    issuer: '',
    authorizationURL: '',
    tokenURL: '',
    userInfoURL: '',
    redirectUri: '',
  },
});
