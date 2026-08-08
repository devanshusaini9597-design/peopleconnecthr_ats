/**
 * Offer Letter Generator Component
 * ==================================
 * Inline offer-letter generator used inside the candidate detail page.
 * Generates a formatted offer letter and saves it via /api/offer-letters.
 */
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileCheck, DollarSign, Calendar, Gift, Eye, Save, X, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface OfferData {
  salary: string;
  currency: string;
  startDate: string;
  benefits: string;
}

interface OfferLetterGeneratorProps {
  candidate: {
    id: string;
    name: string;
    position?: string;
  };
  onSave?: () => void;
}

export function OfferLetterGenerator({ candidate, onSave }: OfferLetterGeneratorProps) {
  const [offer, setOffer] = useState<OfferData>({
    salary: '',
    currency: 'USD',
    startDate: '',
    benefits: '',
  });
  const [preview, setPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const generatePreview = () => {
    const letter = `
Dear ${candidate.name},

We are delighted to offer you the position of ${candidate.position || '[Position]'} at [Your Company Name]!

POSITION DETAILS
----------------
Position: ${candidate.position || '[Position]'}
Department: Engineering
Reporting To: Hiring Manager

COMPENSATION
------------
Base Salary: ${offer.salary || '[Salary]'} ${offer.currency} per year
Pay Schedule: Monthly

BENEFITS
--------
${offer.benefits || '[Benefits Package]'}

START DATE
----------
Expected Start: ${offer.startDate || '[Start Date]'}

NEXT STEPS
----------
Please review this offer and confirm your acceptance by replying to this email.

We look forward to having you join our team!

Best regards,
HR Team
[Your Company Name]
    `.trim();
    setPreview(letter);
    setShowPreview(true);
  };

  const saveOffer = async () => {
    setSaving(true);
    try {
      await fetch('/api/offer-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          salary: offer.salary,
          currency: offer.currency,
          startDate: offer.startDate,
          benefits: offer.benefits,
          content: preview,
          status: 'draft'
        })
      });
      toast.success('Offer letter saved');
      onSave?.();
    } catch {
      toast.error('Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Input Form */}
        <div className="space-y-3 sm:space-y-4">
          <h3 className="font-semibold text-stone-900 flex items-center gap-2 text-base sm:text-lg">
            <FileCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <span className="truncate">Offer Details</span>
          </h3>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-1 sm:mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Annual Salary</span>
            </label>
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                type="number"
                value={offer.salary}
                onChange={(e) => setOffer({ ...offer, salary: e.target.value })}
                placeholder="80000"
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <select
                value={offer.currency}
                onChange={(e) => setOffer({ ...offer, currency: e.target.value })}
                className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:border-brand-500 outline-none"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-1 sm:mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Start Date</span>
            </label>
            <input
              type="date"
              value={offer.startDate}
              onChange={(e) => setOffer({ ...offer, startDate: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-1 sm:mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 flex-shrink-0" />
              <span>Benefits</span>
            </label>
            <textarea
              value={offer.benefits}
              onChange={(e) => setOffer({ ...offer, benefits: e.target.value })}
              placeholder="Health insurance, 401k matching, remote work, PTO..."
              rows={4}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generatePreview}
            className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Generate Preview
          </motion.button>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Offer Letter Preview</label>
          {showPreview ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative"
            >
              <div className="w-full h-96 px-4 py-4 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-sm font-mono overflow-auto whitespace-pre-wrap leading-relaxed">
                {preview}
              </div>
              <div className="flex gap-2 mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={saveOffer}
                  disabled={saving}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Offer
                    </>
                  )}
                </motion.button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-3 border border-stone-200 text-stone-700 rounded-xl font-semibold hover:bg-stone-50 transition-colors"
                >
                  Edit
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-96 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 flex flex-col items-center justify-center text-center p-6">
              <FileCheck className="w-12 h-12 text-stone-300 mb-4" />
              <p className="text-stone-600 font-medium">Preview will appear here</p>
              <p className="text-sm text-stone-500 mt-1">Fill in the details and click Generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
