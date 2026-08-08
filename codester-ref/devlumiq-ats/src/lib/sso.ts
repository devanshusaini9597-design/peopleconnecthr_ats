/**
 * SAML SSO helpers — opt-in per org. Password login remains the default.
 */

import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';
import { prisma } from './prisma';
import { hasEntitlement } from './plan-limits';

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function getSpEntityId(): string {
  return process.env.SAML_SP_ENTITY_ID || `${getAppBaseUrl()}/api/auth/sso/metadata`;
}

export function getAcsUrl(): string {
  return `${getAppBaseUrl()}/api/auth/sso/acs`;
}

export async function loadOrgSso(orgId: string) {
  const entitlement = await hasEntitlement(orgId, 'sso');
  if (!entitlement.allowed) {
    return { error: 'SSO_NOT_ENTITLED' as const, plan: entitlement.plan };
  }
  const config = await prisma.orgSsoConfig.findUnique({ where: { organizationId: orgId } });
  if (!config || !config.enabled || !config.entryPoint || !config.issuer || !config.cert) {
    return { error: 'SSO_NOT_CONFIGURED' as const };
  }
  return { config, entitlement };
}

export function buildSaml(config: {
  entryPoint: string;
  issuer: string;
  cert: string;
  wantAssertionsSigned: boolean;
  emailAttribute: string;
}) {
  return new SAML({
    callbackUrl: getAcsUrl(),
    entryPoint: config.entryPoint,
    issuer: getSpEntityId(),
    idpIssuer: config.issuer,
    idpCert: config.cert,
    wantAssertionsSigned: config.wantAssertionsSigned,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    validateInResponseTo: ValidateInResponseTo.never,
    wantAuthnResponseSigned: false,
  });
}

export function extractEmailFromProfile(
  profile: Record<string, unknown> | null | undefined,
  emailAttribute: string
): string | null {
  if (!profile) return null;
  const candidates = [
    profile[emailAttribute],
    profile.email,
    profile.mail,
    profile.nameID,
    profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('@')) return c.toLowerCase().trim();
  }
  return null;
}

export function spMetadataXml(): string {
  const entityId = getSpEntityId();
  const acs = getAcsUrl();
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acs}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}
