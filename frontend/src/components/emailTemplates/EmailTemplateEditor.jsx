import React from 'react';
import { Save, Loader2, Check } from 'lucide-react';
import { formatByFieldName } from '../../utils/textFormatter';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import EmailBodyEditor from '../ui/EmailBodyEditor';
import { CATEGORY_OPTIONS, VARIABLE_OPTIONS } from './emailTemplatesConstants';
import { FieldInsertPanel, UsedFieldChips } from './FieldPanels';

export default function EmailTemplateEditor({
  open,
  onClose,
  editingTemplate,
  form,
  setForm,
  saving,
  onSave,
  subjectRef,
  bodyEditorRef,
  insertTarget,
  setInsertTarget,
  removeVariable,
  insertVariable,
  detectedVars,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingTemplate ? 'Edit template' : 'Create template'}
      description="Compose on the left. Insert fields from the panel — no coding."
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> {editingTemplate ? 'Update template' : 'Save template'}</>}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 min-w-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-ats">Template name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: formatByFieldName('templateName', e.target.value) }))}
                placeholder="e.g. Hiring Drive Invitation"
                className="input-ats !rounded-lg !bg-white"
                autoFocus
              />
            </div>
            <div>
              <label className="label-ats">Category</label>
              <PremiumSelect
                value={form.category}
                onChange={(v) => setForm((prev) => ({ ...prev, category: v || 'custom' }))}
                options={CATEGORY_OPTIONS}
                placeholder="Category"
                compact
              />
            </div>
          </div>

          <div>
            <label className="label-ats">Email subject *</label>
            <input
              ref={subjectRef}
              type="text"
              value={form.subject}
              onFocus={() => setInsertTarget('subject')}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="e.g. Interview invitation — Position"
              className="input-ats !rounded-lg !bg-white font-medium"
            />
            <UsedFieldChips
              keys={VARIABLE_OPTIONS.filter((v) => form.subject.includes(`{{${v.key}}}`)).map((v) => v.key)}
              onRemove={removeVariable}
            />
          </div>

          <div>
            <label className="label-ats">Email body *</label>
            <EmailBodyEditor
              key={editingTemplate?._id || 'new-template'}
              ref={bodyEditorRef}
              value={form.body}
              onChange={(html) => setForm((prev) => ({ ...prev, body: html }))}
              onFocus={() => setInsertTarget('body')}
              placeholder="Write your email — use the toolbar for bold, lists, links…"
            />
            <UsedFieldChips
              keys={VARIABLE_OPTIONS.filter((v) => form.body.includes(`{{${v.key}}}`)).map((v) => v.key)}
              onRemove={removeVariable}
            />
          </div>

          {detectedVars.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1.5 flex items-center gap-1">
                <Check size={11} className="text-emerald-600" /> Fields in this template
                <span className="font-medium normal-case tracking-normal text-stone-400">— click × to remove</span>
              </p>
              <UsedFieldChips
                keys={detectedVars.map((v) => v.key)}
                onRemove={removeVariable}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-4 min-w-0 lg:sticky lg:top-0">
          <FieldInsertPanel
            onInsert={insertVariable}
            onRemove={removeVariable}
            target={insertTarget}
            setTarget={setInsertTarget}
            usedKeys={detectedVars.map((v) => v.key)}
          />
        </div>
      </div>
    </Modal>
  );
}
