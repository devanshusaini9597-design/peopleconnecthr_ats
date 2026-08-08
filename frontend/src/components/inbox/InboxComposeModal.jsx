import React from 'react';
import { Mail, Loader2, Send, Phone, MessageSquare } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { REPLY_CHANNELS, EMPTY_COMPOSE } from './inboxConstants';

export default function InboxComposeModal({
  open,
  sending,
  compose,
  setCompose,
  composeDial,
  composeRecipientReady,
  countryOptions,
  onClose,
  onSubmit,
}) {
  const handleClose = () => {
    if (!sending) {
      onClose();
      setCompose(EMPTY_COMPOSE);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New message"
      description="Send via email, SMS, or WhatsApp."
      size="md"
      closeOnBackdrop={!sending}
      footer={(
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onClose();
              setCompose(EMPTY_COMPOSE);
            }}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="inbox-compose-form"
            disabled={sending || !compose.body.trim() || !composeRecipientReady}
            className="btn-primary"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </>
      )}
    >
      <form id="inbox-compose-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label-ats">Channel</label>
          <PremiumSelect
            icon={Mail}
            value={compose.channel}
            onChange={(v) => setCompose({
              ...compose,
              channel: v || 'email',
              toAddress: '',
              phone: '',
              subject: v === 'email' ? compose.subject : '',
            })}
            options={REPLY_CHANNELS}
            placeholder="Choose channel"
          />
        </div>

        <div>
          <label className="label-ats" htmlFor="inbox-compose-to">To</label>
          {compose.channel === 'email' ? (
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                id="inbox-compose-to"
                type="email"
                value={compose.toAddress}
                onChange={(e) => setCompose({ ...compose, toAddress: e.target.value })}
                className="input-ats !pl-10"
                placeholder="candidate@email.com"
                required
                autoComplete="email"
              />
            </div>
          ) : (
            <div className="flex items-stretch gap-2">
              <div className="w-[8.25rem] flex-shrink-0">
                <PremiumSelect
                  compact
                  value={compose.countryIso}
                  onChange={(iso) => setCompose({ ...compose, countryIso: iso || 'IN' })}
                  options={countryOptions}
                  placeholder="Code"
                  searchable
                  searchPlaceholder="Search India, +91…"
                />
              </div>
              <div className="relative flex-1 min-w-0">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  id="inbox-compose-to"
                  type="tel"
                  inputMode="numeric"
                  value={compose.phone}
                  onChange={(e) => {
                    let digits = e.target.value.replace(/\D/g, '');
                    if (digits.length > 15) digits = digits.slice(0, 15);
                    setCompose({ ...compose, phone: digits });
                  }}
                  className="input-ats !pl-10"
                  placeholder="Phone number"
                  required
                  autoComplete="tel-national"
                />
              </div>
            </div>
          )}
          {compose.channel !== 'email' && (
            <p className="text-[11px] text-stone-400 mt-1.5 font-medium">
              Sends to <span className="text-stone-600">{composeDial}{compose.phone || '…'}</span>
            </p>
          )}
        </div>

        {compose.channel === 'email' && (
          <div>
            <label className="label-ats" htmlFor="inbox-compose-subject">Subject</label>
            <div className="relative">
              <MessageSquare className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                id="inbox-compose-subject"
                value={compose.subject}
                onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                className="input-ats !pl-10"
                placeholder="Subject line"
              />
            </div>
          </div>
        )}

        <div>
          <label className="label-ats" htmlFor="inbox-compose-body">Message</label>
          <textarea
            id="inbox-compose-body"
            value={compose.body}
            onChange={(e) => setCompose({ ...compose, body: e.target.value })}
            className="input-ats resize-none min-h-[7.5rem]"
            rows={5}
            required
            placeholder="Write your message…"
          />
          <p className="text-[11px] text-stone-400 mt-1.5 leading-snug">
            Respect messaging consent for SMS and WhatsApp.
          </p>
        </div>
      </form>
    </Modal>
  );
}
