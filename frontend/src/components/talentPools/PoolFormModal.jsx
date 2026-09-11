import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import {
  fetchPicklist, namesToSelectOptions, searchPicklistOptions, PICKLIST_DROPDOWN_LIMIT,
} from '../../utils/orgListFetch';
import { POOL_COLORS } from './talentPoolsConstants';

export const PoolFormModal = ({ open, onClose, onSave, saving, initial }) => {
  const isEdit = !!initial?._id;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(POOL_COLORS[0]);
  const [industry, setIndustry] = useState('');
  const [product, setProduct] = useState('');
  const [industryOptions, setIndustryOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setColor(initial?.color || POOL_COLORS[0]);
    setIndustry(initial?.industry || '');
    setProduct(initial?.product || '');
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [industries, products] = await Promise.all([
          fetchPicklist('/api/org-lists/industry', { limit: PICKLIST_DROPDOWN_LIMIT }),
          fetchPicklist('/api/org-lists/product', { limit: PICKLIST_DROPDOWN_LIMIT }),
        ]);
        if (cancelled) return;
        setIndustryOptions(namesToSelectOptions(industries));
        setProductOptions(namesToSelectOptions(products));
      } catch {
        if (!cancelled) {
          setIndustryOptions([]);
          setProductOptions([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const applyIndustry = (value) => {
    setIndustry(value);
    if (value && !name.trim()) setName(value);
  };
  const applyProduct = (value) => {
    setProduct(value);
    if (value && !name.trim()) setName(value);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Manage talent pool' : 'New talent pool'}
      description={isEdit ? 'Update name, industry, skill/product, or color.' : 'Group people by industry or skill/product so they reuse automatically on the next job.'}
      size="md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ name, description, color, industry, product })}
            disabled={saving || !name.trim()}
            className="btn-primary"
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : (isEdit ? 'Save changes' : 'Create pool')}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">Pool name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-ats"
            placeholder="e.g. Banking, Home Loan, Warm bench"
            autoFocus
          />
        </div>
        <div>
          <label className="label-ats">Industry</label>
          <PremiumSelect
            variant="list"
            value={industry}
            onChange={applyIndustry}
            options={industryOptions}
            placeholder="Auto-loaded from your industry list"
            searchable
            allowClear
            onSearch={(q) => searchPicklistOptions('/api/org-lists/industry', q)}
            minSearchChars={2}
          />
        </div>
        <div>
          <label className="label-ats">Skill / product</label>
          <PremiumSelect
            variant="list"
            value={product}
            onChange={applyProduct}
            options={productOptions}
            placeholder="Auto-loaded from your skill/product list"
            searchable
            allowClear
            onSearch={(q) => searchPicklistOptions('/api/org-lists/product', q)}
            minSearchChars={2}
          />
          <p className="text-xs text-stone-500 mt-1.5">
            Lists load from Manage catalogs. A Home Loan profile can land here even if they were rejected on a Banking job.
          </p>
        </div>
        <div>
          <label className="label-ats">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-ats"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="label-ats mb-2">Color</label>
          <div className="flex flex-wrap gap-2.5">
            {POOL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full border-2 transition-all duration-200 ${
                  color === c ? 'border-stone-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
