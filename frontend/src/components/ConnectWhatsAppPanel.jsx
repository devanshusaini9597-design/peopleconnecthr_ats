import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { WhatsAppIcon } from './icons/BrandIcons';

function loadFacebookSdk(appId, graphVersion) {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: graphVersion || 'v21.0',
      });
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: graphVersion || 'v21.0',
      });
      resolve(window.FB);
    };

    if (document.getElementById('facebook-jssdk')) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Could not load Facebook SDK'));
    document.body.appendChild(script);
  });
}

function isFacebookOrigin(origin) {
  return origin === 'https://www.facebook.com' || origin === 'https://web.facebook.com';
}

export default function ConnectWhatsAppPanel({
  activeConfig,
  onConnected,
  onFeedback,
}) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [platform, setPlatform] = useState(null);
  const sessionRef = useRef({});

  const meta = activeConfig?.metadata || {};
  const connected = !!(activeConfig?.hasCredentials && activeConfig?.isActive !== false);

  const loadPlatform = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/whatsapp/connect-config');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not load WhatsApp setup');
      setPlatform(data.data);
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [onFeedback]);

  useEffect(() => {
    loadPlatform();
  }, [loadPlatform]);

  const finishSignup = useCallback(async (payload) => {
    const res = await authenticatedFetch('/api/whatsapp/embedded-signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'Could not connect WhatsApp');
    onFeedback?.({ type: 'success', message: 'WhatsApp connected' });
    await onConnected?.();
  }, [onConnected, onFeedback]);

  const handleConnect = async () => {
    const canLaunchSignup = !!(platform?.appId && (platform?.configId || platform?.saasReady || platform?.ready));
    if (!canLaunchSignup) {
      onFeedback?.({
        type: 'error',
        message: 'Paste Access Token, Phone Number ID, and WABA ID below, then click Save. Meta signup will be available after Tech Provider setup.',
      });
      document.getElementById('whatsapp-access-token-field')?.focus();
      return;
    }

    setConnecting(true);
    onFeedback?.(null);
    sessionRef.current = {};

    const onMessage = (event) => {
      if (!isFacebookOrigin(event.origin)) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
          sessionRef.current = {
            wabaId: data.data?.waba_id || data.data?.wabaId,
            phoneNumberId: data.data?.phone_number_id || data.data?.phoneNumberId,
            businessId: data.data?.business_id || data.data?.businessId,
          };
        }
        if (data.event === 'CANCEL') {
          onFeedback?.({ type: 'error', message: 'WhatsApp signup was cancelled.' });
        }
      } catch {
        /* ignore non-JSON messages */
      }
    };

    window.addEventListener('message', onMessage);
    try {
      const FB = await loadFacebookSdk(platform.appId, platform.graphVersion);
      const code = await new Promise((resolve, reject) => {
        FB.login((response) => {
          if (response?.authResponse?.code) {
            resolve(response.authResponse.code);
          } else if (response?.status === 'unknown' || !response?.authResponse) {
            reject(new Error('WhatsApp signup did not complete. Try again.'));
          } else {
            reject(new Error('WhatsApp signup did not return an authorization code.'));
          }
        }, {
          config_id: platform.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: '3',
          },
        });
      });
      const started = Date.now();
      while (
        (!sessionRef.current.wabaId || !sessionRef.current.phoneNumberId)
        && Date.now() - started < 2500
      ) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const session = sessionRef.current;
      if (!session.wabaId || !session.phoneNumberId) {
        throw new Error('Signup finished but WhatsApp account details were missing. Try Connect WhatsApp again.');
      }
      await finishSignup({
        code,
        wabaId: session.wabaId,
        phoneNumberId: session.phoneNumberId,
        businessId: session.businessId,
      });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      window.removeEventListener('message', onMessage);
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-500 rounded-2xl border border-stone-100 bg-stone-50/80 px-4 py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading WhatsApp…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-[#ecfdf5] via-white to-stone-50 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#128C7E] to-[#075E54] text-white flex items-center justify-center shadow-lg shadow-emerald-800/20">
          <WhatsAppIcon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800/70">
            Meta Cloud API
          </p>
          <h4 className="mt-0.5 text-lg font-bold text-stone-900 tracking-tight">
            {connected ? 'WhatsApp is connected' : 'Connect WhatsApp'}
          </h4>
          <p className="mt-1 text-[13px] text-stone-600 leading-relaxed">
            {connected
              ? `${meta.verifiedName || 'Your business'} can send and receive in Skillnix Inbox.`
              : 'Messages send from your company WhatsApp Business number — not a third-party tool.'}
          </p>
          {meta.displayPhoneNumber ? (
            <p className="mt-1 text-sm font-semibold text-emerald-800">{meta.displayPhoneNumber}</p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="mt-5 w-full inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-[15px] font-semibold text-white bg-gradient-to-r from-[#128C7E] via-[#0f9f75] to-[#075E54] shadow-lg shadow-emerald-800/25 hover:brightness-110 disabled:opacity-60"
      >
        {connecting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <WhatsAppIcon size={18} />
        )}
        {connecting ? 'Connecting…' : connected ? 'Reconnect WhatsApp' : 'Connect WhatsApp'}
      </button>

      <div className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
        Direct Meta API · credentials encrypted · webhook {platform?.webhookUrl || '/api/whatsapp/webhook'}
      </div>
    </div>
  );
}
