import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import API_URL from '../config';

/**
 * Floating careers chatbot — only mounts when org has careers.chatbot enabled.
 */
export default function CareersChatbotWidget({ orgSlug, defaultOpen = false }) {
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!orgSlug) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/chatbot/${orgSlug}/config`);
        const data = await res.json();
        if (data.success && data.data?.enabled) {
          setConfig(data.data);
          setMessages([{ role: 'bot', text: data.data.greeting || 'Hi! How can I help?' }]);
        }
      } catch { /* silent */ }
    })();
  }, [orgSlug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  if (!config?.enabled) return null;

  const brand = config.brandColor || '#0d9488';

  const ask = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/chatbot/${orgSlug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'bot', text: data.data?.reply || data.message || 'Sorry, try again.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 max-w-[calc(100vw-2rem)]">
      {open && (
        <div className="w-[min(100vw-2rem,22rem)] h-[min(70vh,28rem)] bg-white rounded-2xl shadow-xl border border-stone-200 flex flex-col overflow-hidden animate-slide-up">
          <div className="px-4 py-3 flex items-center justify-between text-white" style={{ background: brand }}>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{config.orgName || 'Careers'} assistant</p>
              <p className="text-[11px] text-white/80">Ask about roles & applying</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/15" aria-label="Close chat">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-stone-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'ml-auto text-white rounded-br-md'
                    : 'mr-auto bg-white border border-stone-200 text-stone-800 rounded-bl-md'
                }`}
                style={m.role === 'user' ? { background: brand } : undefined}
              >
                {m.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={ask} className="p-2 border-t border-stone-100 flex gap-2 bg-white">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder="Ask a question…"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-xl px-3 py-2 text-white disabled:opacity-50"
              style={{ background: brand }}
              aria-label="Send"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full shadow-lg text-white flex items-center justify-center hover:scale-105 transition-transform"
        style={{ background: brand }}
        aria-label="Open careers chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
