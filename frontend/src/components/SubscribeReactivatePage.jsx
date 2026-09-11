/**
 * Skillnix shell + Zoho official web-optin embed (script).
 * Uses Zoho's optin.min.js so confirmation mail / DNM reactivation works.
 * Do not iframe Zoho Optin pages — they block embedding.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import PublicMarketingShell, { secondaryBtnClassName } from './PublicMarketingShell';
import { ZOHO_SIGNUP } from '../config/zohoSignupForm';

const FORM_ID = ZOHO_SIGNUP.formDomId;

function zohoEmbedHtml() {
  const { formIx, zx, listId, trackCode, actionUrl, zcHost } = ZOHO_SIGNUP;
  return `
<div id="${FORM_ID}" data-type="signupform" style="opacity:1;">
  <div id="customForm">
    <div name="SIGNUP_BODY" style="width:100%;max-width:360px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;padding:28px 24px 24px;">
      <form method="POST" id="zcampaignOptinForm" style="margin:0;width:100%;" action="${actionUrl}" target="_zcSignup">
        <div id="errorMsgDiv" style="display:none;background:#ffebe8;padding:10px;color:#d20000;font-size:12px;border:1px solid #ffd9d3;border-radius:6px;margin-bottom:12px;">Please correct the marked field(s) below.</div>
        <div style="text-align:center;margin-bottom:18px;">
          <div style="font-size:18px;font-weight:600;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#111827;line-height:1.35;">Job &amp; career updates</div>
          <div style="font-size:13px;color:#6b7280;line-height:1.55;margin-top:8px;font-family:system-ui,Segoe UI,Arial,sans-serif;">Open roles, hiring drives, and opportunities from Skillnix Recruitment</div>
        </div>
        <div style="margin-bottom:12px;">
          <input type="text" placeholder="Email address" name="CONTACT_EMAIL" id="EMBED_FORM_EMAIL_LABEL" required
            style="width:100%;height:44px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;background:#fff;padding:10px 12px;font-size:14px;color:#111827;font-family:system-ui,Segoe UI,Arial,sans-serif;outline:none;" />
        </div>
        <div>
          <input type="button" name="SIGNUP_SUBMIT_BUTTON" id="zcWebOptin" value="Subscribe"
            style="width:100%;height:44px;border:0;border-radius:8px;background:#0f766e;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:system-ui,Segoe UI,Arial,sans-serif;" />
        </div>
        <div id="Zc_SignupSuccess" style="display:none;margin-top:14px;padding:10px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;">
          <span id="signupSuccessMsg" style="color:#047857;font-size:13px;font-family:system-ui,Segoe UI,Arial,sans-serif;">Thank you for signing up</span>
        </div>
        <input type="hidden" id="fieldBorder" value="" />
        <input type="hidden" id="submitType" name="submitType" value="optinCustomView" />
        <input type="hidden" id="emailReportId" name="emailReportId" value="" />
        <input type="hidden" id="formType" name="formType" value="QuickForm" />
        <input type="hidden" name="zx" id="cmpZuid" value="${zx}" />
        <input type="hidden" name="zcvers" value="2.0" />
        <input type="hidden" name="oldListIds" id="allCheckedListIds" value="" />
        <input type="hidden" id="mode" name="mode" value="OptinCreateView" />
        <input type="hidden" id="zcld" name="zcld" value="${listId}" />
        <input type="hidden" id="zctd" name="zctd" value="" />
        <input type="hidden" id="document_domain" value="" />
        <input type="hidden" id="zc_Url" value="${zcHost}" />
        <input type="hidden" id="new_optin_response_in" value="0" />
        <input type="hidden" id="duplicate_optin_response_in" value="0" />
        <input type="hidden" name="zc_trackCode" id="zc_trackCode" value="${trackCode}" />
        <input type="hidden" id="zc_formIx" name="zc_formIx" value="${formIx}" />
        <input type="hidden" id="viewFrom" value="URL_ACTION" />
        <span style="display:none" id="dt_CONTACT_EMAIL">1,true,6,Contact Email,2</span>
        <span style="display:none" id="dt_FIRSTNAME">1,false,1,First Name,2</span>
        <span style="display:none" id="dt_LASTNAME">1,false,1,Last Name,2</span>
      </form>
    </div>
  </div>
  <img src="https://${zcHost}/images/spacer.gif" id="refImage" style="display:none;" alt="" />
</div>
<input type="hidden" id="signupFormType" value="QuickForm_Vertical" />
<div id="zcOptinOverLay" style="display:none;"></div>
<div id="zcOptinSuccessPopup" style="display:none;">
  <span id="closeSuccess"></span>
  <div id="zcOptinSuccessPanel"></div>
</div>`;
}

export default function SubscribeReactivatePage() {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return undefined;

    el.innerHTML = zohoEmbedHtml();

    // Zoho callback hook (required by their embed)
    window[`runOnFormSubmit_${FORM_ID}`] = function runOnFormSubmit() {};

    const img = el.querySelector('#refImage');
    if (img && typeof window.referenceSetter === 'function') {
      img.onload = () => window.referenceSetter(img);
    } else if (img) {
      img.onload = () => {
        if (typeof window.referenceSetter === 'function') window.referenceSetter(img);
      };
    }

    let cancelled = false;
    const existing = document.querySelector(`script[data-zoho-optin="${FORM_ID}"]`);

    const boot = () => {
      if (cancelled) return;
      try {
        if (typeof window.setupSF === 'function') {
          window.setupSF(FORM_ID, 'ZCFORMVIEW', false, 'light', false, '0');
        }
        setReady(true);
      } catch (_) {
        setFailed(true);
      }
    };

    if (existing && typeof window.setupSF === 'function') {
      boot();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement('script');
    script.src = ZOHO_SIGNUP.scriptUrl;
    script.async = true;
    script.dataset.zohoOptin = FORM_ID;
    script.onload = boot;
    script.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      delete window[`runOnFormSubmit_${FORM_ID}`];
    };
  }, []);

  return (
    <PublicMarketingShell
      eyebrow="Reactivate updates"
      title="Confirm marketing emails again"
      subtitle="Enter your email below. If confirmation is required, you will get a message from our mailing list — open it to finish."
      backTo="/subscribe"
      backLabel="Back to subscribe"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3.5 py-3 text-[12px] text-slate-600 leading-relaxed">
          Use the same address you unsubscribed with. Check spam if you do not see a confirmation
          within a few minutes.
        </div>

        {!ready && !failed ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-teal-800" />
            Loading form…
          </div>
        ) : null}

        {failed ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-3 text-sm text-slate-700">
            Form could not load here.{' '}
            <a
              href={ZOHO_SIGNUP.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-800 font-semibold underline underline-offset-2"
            >
              Open the confirmation form
            </a>{' '}
            instead.
          </div>
        ) : null}

        <div ref={mountRef} className={ready ? 'block' : 'min-h-[120px]'} />

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <a
            href={ZOHO_SIGNUP.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${secondaryBtnClassName} no-underline sm:flex-1`}
          >
            Open form in new tab
            <ExternalLink className="w-4 h-4 opacity-80" />
          </a>
          <Link to="/subscribe" className={`${secondaryBtnClassName} no-underline sm:flex-1`}>
            Back to subscribe
          </Link>
        </div>
      </div>
    </PublicMarketingShell>
  );
}
