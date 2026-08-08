import React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Save, Loader2, Info } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import ConfirmationModal from './ConfirmationModal';

import {
  ORG_TOUR_KEY, ORG_TOUR_STEPS, TABS,
} from './organization/constants';
import OrgGeneralTab from './organization/OrgGeneralTab';
import OrgPipelineTab from './organization/OrgPipelineTab';
import OrgTeamTab from './organization/OrgTeamTab';
import OrgCareersTab from './organization/OrgCareersTab';
import useOrganizationSettings from './organization/useOrganizationSettings';

export default function OrganizationSettingsPage() {
  const { t } = useTranslation();
  const {
    navigate,
    logoInputRef,
    tourOpen,
    setTourOpen,
    activeTab,
    setActiveTab,
    loading,
    saving,
    logoDragging,
    setLogoDragging,
    sidebarCollapsed,
    newStage,
    setNewStage,
    dragIndex,
    setDragIndex,
    inviting,
    removeTarget,
    setRemoveTarget,
    removing,
    roleUpdatingId,
    customRoles,
    customRolesLoading,
    detectedTz,
    org,
    setOrg,
    members,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteCustomRoleId,
    setInviteCustomRoleId,
    customRoleUpdatingId,
    addPipelineStage,
    removePipelineStage,
    movePipelineStage,
    fetchOrgData,
    processLogoFile,
    handleLogoDrop,
    handleSave,
    handleInvite,
    handleChangeMemberRole,
    handleChangeMemberCustomRole,
    handleRemoveMember,
    applyDetectedTimezone,
  } = useOrganizationSettings();

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter pb-24">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-56 skeleton-ats rounded-lg" />
            <div className="h-4 w-80 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="card-ats-bordered overflow-hidden mt-2">
          <div className="flex gap-2 p-3 border-b border-stone-100 bg-stone-50/80">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-9 w-24 skeleton-ats rounded-xl" />)}
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="h-3 w-24 skeleton-ats rounded" />
                <div className="h-11 w-full skeleton-ats rounded-xl" />
                <div className="h-3 w-24 skeleton-ats rounded" />
                <div className="h-11 w-full skeleton-ats rounded-xl" />
              </div>
              <div className="h-40 skeleton-ats rounded-2xl" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-20 skeleton-ats rounded" />
                  <div className="h-11 w-full skeleton-ats rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-shell-ats animate-page-enter ${activeTab !== 'team' ? 'has-sticky-footer' : ''}`}>
      <PageHeader
        icon={Building2}
        title={t('pages.organization.title')}
        subtitle="Company preferences, hiring pipeline, team access, and careers page."
        gradientTitle
      />

      <div
        data-tour="org-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Update identity, pipeline stages, and careers settings here. Use the sticky bar to save.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      <div className="card-ats-bordered relative">
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

        {/* Tab strip — segmented Jobs-style control */}
        <div data-tour="org-tabs" className="p-3 sm:p-4 border-b border-stone-100 bg-stone-50/80">
          <div className="flex gap-1 p-1 bg-stone-100/90 rounded-2xl overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 sm:flex-none justify-center ${
                    active
                      ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : ''}`} />
                  {tab.label}
                  {active && <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-brand-500" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-6 md:p-8">
          {activeTab === 'general' && (
            <OrgGeneralTab
              org={org}
              setOrg={setOrg}
              logoInputRef={logoInputRef}
              processLogoFile={processLogoFile}
              logoDragging={logoDragging}
              setLogoDragging={setLogoDragging}
              handleLogoDrop={handleLogoDrop}
              applyDetectedTimezone={applyDetectedTimezone}
              detectedTz={detectedTz}
            />
          )}

          {activeTab === 'pipeline' && (
            <OrgPipelineTab
              org={org}
              dragIndex={dragIndex}
              setDragIndex={setDragIndex}
              movePipelineStage={movePipelineStage}
              removePipelineStage={removePipelineStage}
              addPipelineStage={addPipelineStage}
              newStage={newStage}
              setNewStage={setNewStage}
              navigate={navigate}
            />
          )}

          {activeTab === 'team' && (
            <OrgTeamTab
              navigate={navigate}
              handleInvite={handleInvite}
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              inviting={inviting}
              inviteRole={inviteRole}
              setInviteRole={setInviteRole}
              customRoles={customRoles}
              inviteCustomRoleId={inviteCustomRoleId}
              setInviteCustomRoleId={setInviteCustomRoleId}
              customRolesLoading={customRolesLoading}
              members={members}
              handleChangeMemberRole={handleChangeMemberRole}
              handleChangeMemberCustomRole={handleChangeMemberCustomRole}
              roleUpdatingId={roleUpdatingId}
              customRoleUpdatingId={customRoleUpdatingId}
              setRemoveTarget={setRemoveTarget}
            />
          )}

          {activeTab === 'careers' && (
            <OrgCareersTab org={org} setOrg={setOrg} />
          )}
        </div>
      </div>

      {activeTab !== 'team' && (
        <>
        <div className="h-4" aria-hidden />
        <div
          className={`fixed bottom-0 right-0 z-40 left-0 ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-[280px]'}`}
        >
          <div className="border-t border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] sm:text-xs text-stone-400 font-medium text-center sm:text-left order-2 sm:order-1 leading-snug px-1">
                  Changes apply org-wide.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={fetchOrgData}
                    disabled={saving}
                    className="btn-secondary !px-3 !py-2.5 !text-sm min-w-0 w-full sm:w-auto"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary !px-3 !py-2.5 !text-sm min-w-0 w-full sm:w-auto"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> <span className="truncate">Saving…</span></>
                    ) : (
                      <><Save className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Save Changes</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      <ConfirmationModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        title="Remove team member?"
        message={`Remove “${removeTarget?.name || removeTarget?.email}” from this organization? They will lose access immediately.`}
        confirmText="Remove"
        type="delete"
        isLoading={removing}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Organization Settings" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={ORG_TOUR_STEPS}
        storageKey={ORG_TOUR_KEY}
      />
    </div>
  );
}
