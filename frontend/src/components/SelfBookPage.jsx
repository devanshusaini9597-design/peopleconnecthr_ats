import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, Loader2, AlertCircle, Mail, User } from 'lucide-react';
import API_URL from '../config';
import EmptyState from './ui/EmptyState';

const PublicHeader = () => (
  <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <Link to="/" className="flex items-center gap-2.5 text-stone-900 font-semibold">
        <img src="/logo.png" alt="People Connect HR" className="w-8 h-8 rounded-lg flex-shrink-0" />
        <span className="text-sm sm:text-base">People Connect HR</span>
      </Link>
    </div>
  </header>
);

const PublicFooter = () => (
  <footer className="border-t border-stone-200 bg-white py-6 mt-auto">
    <div className="max-w-lg mx-auto px-4 sm:px-6 text-center">
      <Link to="/" className="text-sm text-stone-500 hover:text-brand-700 font-medium transition-colors">
        ← Back to People Connect HR
      </Link>
    </div>
  </footer>
);

export default function SelfBookPage() {
  const { tokenOrSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/scheduling/public/${tokenOrSlug}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.message);
        if (d.data.booked) {
          setBooked(true);
          setData(d.data);
        } else {
          setData(d.data);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tokenOrSlug]);

  const handleBook = async () => {
    if (!selectedSlot || !email) return;
    setBooking(true);
    try {
      const res = await fetch(`${API_URL}/api/scheduling/public/${tokenOrSlug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotStart: selectedSlot, candidateEmail: email, candidateName: name })
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      setBooked(true);
      setMeetingLink(d.data.meetingLink || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm text-stone-500 font-medium">Loading available times…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-stone-50 overflow-x-hidden flex flex-col">
        <PublicHeader />
        <div className="flex items-center justify-center px-4 sm:px-6 py-16 flex-1">
          <div className="max-w-md w-full card-ats-bordered p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-stone-800 font-semibold">{error}</p>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-stone-50 overflow-x-hidden flex flex-col">
        <PublicHeader />
        <div className="flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16 animate-page-enter flex-1">
          <div className="max-w-md w-full card-ats-bordered p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">Interview scheduled!</h1>
            <p className="text-stone-500 mt-2 text-sm sm:text-base leading-relaxed">
              A calendar invite has been sent to {email || 'your email'}.
            </p>
            {meetingLink && (
              <a
                href={meetingLink}
                target="_blank"
                rel="noreferrer"
                className="btn-primary inline-flex mt-6 w-full sm:w-auto"
              >
                Join meeting
              </a>
            )}
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 overflow-x-hidden flex flex-col">
      <PublicHeader />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-page-enter flex-1 w-full">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">Schedule your interview</h1>
          {data?.organizationName && (
            <p className="text-stone-600 mt-1.5 font-medium">{data.organizationName}</p>
          )}
          <p className="text-sm text-stone-500 flex items-center justify-center gap-1.5 mt-2">
            <Clock className="w-4 h-4 text-brand-600" />
            {data?.durationMinutes} minutes
          </p>
        </div>

        <div className="card-ats-bordered p-5 sm:p-6 space-y-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

          <div>
            <label className="label-ats">Select a time</label>
            {(data?.slots || []).length === 0 ? (
              <EmptyState
                icon={Calendar}
                message="No available slots"
                subMessage="Check back later or contact the recruiter for other times."
                tone="brand"
                compact
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-0.5">
                {(data?.slots || []).map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => setSelectedSlot(slot.start)}
                    className={`p-3 text-sm rounded-xl border text-left transition-colors touch-target ${
                      selectedSlot === slot.start
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20 font-medium'
                        : 'border-stone-200 bg-white hover:border-brand-300 text-stone-700'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-brand-600" />
                    {new Date(slot.start).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label-ats">Your name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                className="input-ats !pl-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
          </div>
          <div>
            <label className="label-ats">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="email"
                required
                className="input-ats !pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          {error && (
            <p className="field-error flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleBook}
            disabled={!selectedSlot || !email || booking}
            className="btn-primary w-full touch-target"
          >
            {booking ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</>
            ) : (
              'Confirm booking'
            )}
          </button>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
