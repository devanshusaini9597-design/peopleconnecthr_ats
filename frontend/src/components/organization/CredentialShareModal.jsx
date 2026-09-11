import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Mail, MessageCircle, KeyRound, Link2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../Toast';
import { resolveOrgLogoSrc } from '../../utils/orgLogo';
import { copyToClipboard, openWhatsAppShare } from '../../utils/shareChannels';

function orgInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ORG';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function formatPersonName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const shouting = raw === raw.toUpperCase() && /[A-Z]/.test(raw) && raw.length > 1;
  if (!shouting) return raw;
  return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPasswordMessage({ name, email, secret, loginUrl, orgName }) {
  const who = formatPersonName(name).split(/\s+/)[0];
  return [
    who ? `Hi ${who},` : 'Hello,',
    '',
    `A temporary password has been created for your ${orgName} account.`,
    '',
    `Sign in: ${loginUrl}`,
    `Email: ${email}`,
    `Temporary password: ${secret}`,
    '',
    'You will be asked to choose a new password after you sign in.',
  ].join('\n');
}

function buildInviteMessage({ name, email, secret, orgName }) {
  const who = formatPersonName(name).split(/\s+/)[0];
  return [
    who ? `Hi ${who},` : 'Hello,',
    '',
    `You have been invited to the ${orgName} workspace.`,
    '',
    `Use this email: ${email}`,
    `Accept invitation: ${secret}`,
    '',
    'This link expires in 7 days. Sign in with the invited email — do not create a new organization.',
  ].join('\n');
}

export default function CredentialShareModal({
  kind,
  org,
  name,
  email,
  secret,
  userId,
  emailSent: emailSentProp = false,
  emailError: emailErrorProp = null,
  onResendEmail,
  onClose,
}) {
  const toast = useToast();
  const [copied, setCopied] = useState('');
  const [logoBroken, setLogoBroken] = useState(false);
  const [emailSent, setEmailSent] = useState(Boolean(emailSentProp));
  const [emailError, setEmailError] = useState(emailErrorProp || null);
  const [resending, setResending] = useState(false);
  const orgName = org?.name || 'your workspace';
  const logoSrc = resolveOrgLogoSrc(org?.logo);
  const showLogo = Boolean(logoSrc) && !logoBroken;
  const loginUrl = `${window.location.origin}/login`;
  const displayName = formatPersonName(name) || email || 'this person';
  const isInvite = kind === 'invite';

  const shareText = useMemo(
    () => (isInvite
      ? buildInviteMessage({ name, email, secret, orgName })
      : buildPasswordMessage({ name, email, secret, loginUrl, orgName })),
    [isInvite, name, email, secret, loginUrl, orgName]
  );

  useEffect(() => {
    setEmailSent(Boolean(emailSentProp));
    setEmailError(emailErrorProp || null);
  }, [emailSentProp, emailErrorProp]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = window.setTimeout(() => setCopied(''), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!secret) return null;

  const markCopied = (key) => setCopied(key);

  const copyWithFeedback = (text, key, successMsg, failMsg) => {
    copyToClipboard(text).then((ok) => {
      if (ok) {
        markCopied(key);
        toast.success(successMsg);
      } else {
        toast.error(failMsg);
      }
    });
  };

  const onCopySecret = () => {
    copyWithFeedback(
      secret,
      'secret',
      isInvite ? 'Invitation link copied' : 'Temporary password copied',
      'Could not copy. Select the value and copy it manually.'
    );
  };

  const onCopyMessage = () => {
    copyWithFeedback(
      shareText,
      'message',
      'Message copied — paste it into a private channel',
      'Could not copy. Select the text and copy it manually.'
    );
  };

  const onEmail = async () => {
    if (isInvite || !onResendEmail || !userId) {
      toast.error('Use Copy message, then paste into an email.');
      return;
    }
    setResending(true);
    try {
      await onResendEmail({ userId, temporaryPassword: secret });
      setEmailSent(true);
      setEmailError(null);
      toast.success(`Temporary password emailed to ${email}`);
    } catch (err) {
      setEmailSent(false);
      setEmailError(err.message || 'Email could not be sent');
      toast.error(err.message || 'Email could not be sent');
    } finally {
      setResending(false);
    }
  };

  const onWhatsApp = () => {
    const opened = openWhatsAppShare(shareText);
    copyToClipboard(shareText).then((copiedOk) => {
      if (opened) {
        toast.success(copiedOk
          ? 'WhatsApp opened. The message was also copied.'
          : 'WhatsApp opened.');
      } else if (copiedOk) {
        toast.success('Message copied. Paste it into WhatsApp to send.');
      } else {
        toast.error('Could not open WhatsApp. Copy the message and send it privately.');
      }
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={isInvite ? Link2 : KeyRound}
      title={isInvite ? 'Invitation link' : 'Temporary password'}
      description={
        isInvite
          ? `Share this with ${displayName} on a private channel. It is shown only once.`
          : emailSent
            ? `We emailed ${displayName}. The password is also shown once below as a backup.`
            : `We could not email ${displayName}. Share the password below on a private channel.`
      }
      footer={
        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="space-y-5">
        {!isInvite && (
          <div
            className={`rounded-xl border px-3.5 py-3 flex items-start gap-2.5 ${
              emailSent
                ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/40'
                : 'border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-white to-orange-50/40'
            }`}
          >
            {emailSent ? (
              <CheckCircle2 size={16} className="text-emerald-700 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-[12px] leading-relaxed ${emailSent ? 'text-emerald-950/90' : 'text-amber-950/90'}`}>
              {emailSent
                ? `Email delivered to ${email}. They can sign in and will be asked to set a new password.`
                : (emailError || 'Email was not sent. Use the buttons below to share securely, or tap Email to retry.')}
            </p>
          </div>
        )}

        {isInvite && (
          <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-white to-orange-50/40 px-3.5 py-3 flex items-start gap-2.5">
            <Link2 size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] leading-relaxed text-amber-950/90">
              This link is shown once. Share it on a private channel — not in group chats or public threads.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-white px-3.5 py-3 shadow-sm shadow-stone-900/[0.03]">
          {showLogo ? (
            <img
              src={logoSrc}
              alt=""
              onError={() => setLogoBroken(true)}
              className="h-11 w-11 rounded-xl object-contain bg-white border border-stone-200 flex-shrink-0"
            />
          ) : (
            <span className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 text-white border border-brand-400/30 flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm">
              {orgInitials(orgName)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Workspace</p>
            <p className="text-sm font-semibold text-stone-900 truncate">{orgName}</p>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Recipient</p>
          {displayName && displayName !== email ? (
            <p className="text-sm font-semibold text-stone-900 truncate">{displayName}</p>
          ) : null}
          <p className="text-[13px] text-stone-600 truncate">{email || '—'}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            {isInvite ? 'Invitation link' : 'Temporary password'}
          </p>
          <div className="flex items-stretch gap-2 rounded-xl border border-stone-200 bg-white p-1.5 pl-3.5 shadow-inner shadow-stone-900/[0.02]">
            <code className="flex-1 min-w-0 self-center text-[13px] font-mono font-semibold text-stone-900 break-all tracking-wide select-all">
              {secret}
            </code>
            <button
              type="button"
              className="h-9 px-3.5 flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-teal-600 text-white text-[12px] font-semibold shadow-md shadow-brand-500/25 hover:shadow-lg hover:brightness-105 transition-all"
              onClick={onCopySecret}
            >
              {copied === 'secret' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'secret' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2.5">
            {isInvite ? 'Share securely' : 'Also share'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopyMessage}
              title="Copy message"
              aria-label="Copy message"
              className={`h-11 w-11 inline-flex items-center justify-center rounded-xl border shadow-sm transition-all ${
                copied === 'message'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-emerald-100'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-800 hover:bg-brand-50/60 hover:shadow-md'
              }`}
            >
              {copied === 'message' ? <Check size={18} strokeWidth={2.25} /> : <Copy size={18} strokeWidth={2.25} />}
            </button>
            {!isInvite && (
              <button
                type="button"
                onClick={onEmail}
                disabled={!email || resending}
                title={emailSent ? `Resend email to ${email}` : `Email ${email}`}
                aria-label={emailSent ? `Resend email to ${email}` : `Email ${email}`}
                className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-brand-300 hover:text-brand-800 hover:bg-brand-50/60 hover:shadow-md transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {resending ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} strokeWidth={2.25} />}
              </button>
            )}
            <button
              type="button"
              onClick={onWhatsApp}
              title="Share on WhatsApp"
              aria-label="Share on WhatsApp"
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/60 hover:shadow-md transition-all"
            >
              <MessageCircle size={18} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
