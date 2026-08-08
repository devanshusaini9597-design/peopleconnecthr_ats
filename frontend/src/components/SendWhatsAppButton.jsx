import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { WhatsAppIcon } from './icons/BrandIcons';

/**
 * Automated WhatsApp send (add-on, feature: integrations.whatsapp) — sends
 * through the org's own Twilio WhatsApp sender via the backend, distinct
 * from the always-free "wa.me" manual click-to-chat link next to it.
 * Renders nothing if the org isn't entitled, so it's safe to drop in
 * anywhere without an extra wrapper.
 */
const SendWhatsAppButton = ({ candidate, className, iconSize = 16 }) => {
  const { organization } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (!organization || !planHasFeature(organization.plan, 'integrations.whatsapp')) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await authenticatedFetch('/api/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ candidateId: candidate._id, message: message.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send');
      setFeedback({ type: 'success', message: 'Message sent!' });
      setTimeout(() => { setOpen(false); setMessage(''); setFeedback(null); }, 1200);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'h-8 w-8 inline-flex items-center justify-center rounded-lg border border-violet-100 bg-violet-50/80 text-[#128C7E] shadow-sm hover:bg-violet-100 hover:border-violet-200 transition-all'}
        title="Send via WhatsApp Business API"
      >
        <span className="relative inline-flex">
          <WhatsAppIcon size={iconSize} />
          <span className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full bg-violet-600 ring-1 ring-white" aria-hidden />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !sending && setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">WhatsApp {candidate.name}</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your message…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            {feedback && (
              <div className={`mt-2 text-xs flex items-center gap-1.5 ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {feedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5" />} {feedback.message}
              </div>
            )}
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send via WhatsApp'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SendWhatsAppButton;
