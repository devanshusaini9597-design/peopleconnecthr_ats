import React from 'react';
import {
  CheckCircle2, AlertCircle, Loader2, Unlink, Save, Globe, Server, Bot,
} from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import {
  AWS_REGION_OPTIONS, PORT_OPTIONS, MODEL_OPTIONS_BY_PROVIDER,
  TEXTAREA_FIELDS, HALF_WIDTH_FIELDS, FIELD_LABELS, FIELD_HINTS,
  SECRET_FIELDS, EMAIL_FIELDS, FIELD_ICONS,
} from './integrationConstants';

export default function ConfigureModal({
  activeProvider,
  activeConfig,
  formValues,
  setFormValues,
  feedback,
  saving,
  testing,
  onClose,
  onSave,
  onTest,
  onDisconnect,
  onOAuthConnect,
}) {
  return (
    <Modal
      open={!!activeProvider}
      onClose={onClose}
      title={activeProvider?.name || 'Configure'}
      description={activeProvider?.desc}
      size="lg"
      footer={
        <>
          {activeConfig && (
            <button
              type="button"
              onClick={() => onDisconnect(activeProvider)}
              className="btn-ghost !text-red-600 hover:!bg-red-50 sm:mr-auto"
              disabled={saving || testing}
            >
              <Unlink className="w-4 h-4" /> Disconnect
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving || testing}>
            Cancel
          </button>
          <button type="button" onClick={onTest} className="btn-secondary" disabled={testing || saving || !activeConfig}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
          </button>
          <button type="button" onClick={onSave} className="btn-primary" disabled={saving || testing}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {activeProvider && (
        <div className="space-y-5">
          {(activeProvider.id === 'google' || activeProvider.id === 'outlook') && (
            <button
              type="button"
              onClick={() => onOAuthConnect(activeProvider.id)}
              className="w-full btn-primary !justify-center"
            >
              Connect with {activeProvider.id === 'google' ? 'Google' : 'Microsoft'} OAuth
            </button>
          )}

          {activeConfig?.hasCredentials ? (
            <p className="text-[13px] text-stone-500 leading-relaxed rounded-xl border border-stone-100 bg-stone-50/80 px-3.5 py-2.5">
              Credentials on file — leave a field blank to keep the current value.
            </p>
          ) : (
            <p className="text-[13px] text-stone-500 leading-relaxed">
              Enter credentials from your provider dashboard.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeProvider.fields.map((field) => {
              const FieldIcon = FIELD_ICONS[field];
              const half = HALF_WIDTH_FIELDS.has(field);
              const keepPlaceholder = activeConfig?.hasCredentials
                ? '•••••••• (leave blank to keep)'
                : (FIELD_HINTS[field] || `Enter ${FIELD_LABELS[field] || field}`);
              const setField = (v) => setFormValues((prev) => ({ ...prev, [field]: v }));

              let control;
              if (field === 'region') {
                control = (
                  <PremiumSelect
                    variant="list"
                    searchable
                    value={formValues[field] || ''}
                    onChange={setField}
                    options={AWS_REGION_OPTIONS}
                    placeholder={activeConfig?.hasCredentials ? 'Keep current region' : 'Select AWS region'}
                    allowClear={!!activeConfig?.hasCredentials}
                    icon={Globe}
                  />
                );
              } else if (field === 'port') {
                control = (
                  <PremiumSelect
                    variant="list"
                    value={formValues[field] || ''}
                    onChange={setField}
                    options={PORT_OPTIONS}
                    placeholder={activeConfig?.hasCredentials ? 'Keep current port' : 'Select port'}
                    allowClear={!!activeConfig?.hasCredentials}
                    icon={Server}
                  />
                );
              } else if (field === 'model' && MODEL_OPTIONS_BY_PROVIDER[activeProvider.id]) {
                control = (
                  <PremiumSelect
                    variant="list"
                    searchable
                    value={formValues[field] || ''}
                    onChange={setField}
                    options={MODEL_OPTIONS_BY_PROVIDER[activeProvider.id]}
                    placeholder={activeConfig?.hasCredentials ? 'Keep current model' : 'Select model (optional)'}
                    allowClear
                    icon={Bot}
                  />
                );
              } else if (TEXTAREA_FIELDS.has(field)) {
                control = (
                  <div className="relative">
                    {FieldIcon && (
                      <FieldIcon className="absolute left-3.5 top-3 w-4 h-4 text-stone-400 pointer-events-none" />
                    )}
                    <textarea
                      value={formValues[field] || ''}
                      onChange={(e) => setField(e.target.value)}
                      placeholder={keepPlaceholder}
                      rows={4}
                      className={`textarea-ats${FieldIcon ? ' field-premium-icon !pt-2.5' : ''}`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                );
              } else {
                const inputType = SECRET_FIELDS.has(field)
                  ? 'password'
                  : EMAIL_FIELDS.has(field)
                    ? 'email'
                    : field === 'fromNumber' || field === 'sourceNumber'
                      ? 'tel'
                      : 'text';
                control = (
                  <div className="relative">
                    {FieldIcon && (
                      <FieldIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    )}
                    <input
                      type={inputType}
                      value={formValues[field] || ''}
                      onChange={(e) => setField(e.target.value)}
                      placeholder={keepPlaceholder}
                      className={`field-premium${FieldIcon ? ' field-premium-icon' : ''}`}
                      autoComplete="off"
                    />
                  </div>
                );
              }

              return (
                <div key={field} className={half ? '' : 'sm:col-span-2'}>
                  <label className="label-ats">{FIELD_LABELS[field] || field}</label>
                  {control}
                </div>
              );
            })}
          </div>

          {feedback && (
            <div className={`text-sm flex items-start gap-2 p-3 rounded-xl font-medium ${
              feedback.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                : 'text-red-600 bg-red-50 border border-red-100'
            }`}>
              {feedback.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
