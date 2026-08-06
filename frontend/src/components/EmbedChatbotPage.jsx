import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MessageCircle } from 'lucide-react';
import CareersChatbotWidget from './CareersChatbotWidget';
import API_URL from '../config';

/**
 * Standalone embeddable careers chatbot page — /embed/chatbot/:orgSlug
 * Can be iframed on external career sites.
 */
export default function EmbedChatbotPage() {
  const { orgSlug } = useParams();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/chatbot/${orgSlug}/config`);
        const data = await res.json();
        if (!res.ok || data.success === false) {
          setError(data.message || 'Unable to load chatbot');
          setEnabled(false);
        } else {
          setEnabled(!!data.data?.enabled);
        }
      } catch {
        setError('Unable to reach chatbot service');
        setEnabled(false);
      } finally {
        setReady(true);
      }
    })();
  }, [orgSlug]);

  if (!ready) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-2 bg-stone-50 text-stone-500 text-sm p-6">
        <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
        Loading assistant…
      </div>
    );
  }

  if (!enabled || error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-stone-50">
        <div className="max-w-sm w-full text-center rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-stone-900">Chatbot unavailable</p>
          <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
            {error || 'Chatbot is not enabled for this organization.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-transparent relative overflow-hidden">
      <CareersChatbotWidget orgSlug={orgSlug} defaultOpen />
    </div>
  );
}
