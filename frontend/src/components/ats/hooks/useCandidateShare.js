import { useState } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch } from '../../../utils/fetchUtils';

export function useCandidateShare({ toast, candidates, selectedIds, setSelectedIds, fetchData, searchQuery, filterJob, candidatesViewMode = 'all' } = {}) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareConfirmation, setShowShareConfirmation] = useState(false);
  const [shareCandidate, setShareCandidate] = useState(null);
  const [selectedShareMembers, setSelectedShareMembers] = useState([]);
  const [selectedCandidatesForShare, setSelectedCandidatesForShare] = useState([]);
  const [isSharingCandidate, setIsSharingCandidate] = useState(false);
  const [isImportingShared, setIsImportingShared] = useState(false);
  const [showImportSharedConfirm, setShowImportSharedConfirm] = useState(false);
  const [importSharedSuccess, setImportSharedSuccess] = useState(null);
  const [showImportAllConfirm, setShowImportAllConfirm] = useState(false);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importAllSuccess, setImportAllSuccess] = useState(null);

  const handleShareClick = (candidate) => {
    // Support both single and bulk share
    const selectedForBulk = candidates.filter(c => selectedIds.includes(c._id));
    if (!candidate && selectedForBulk.length > 0) {
      // Bulk mode from action bar - share selected candidates
      setSelectedCandidatesForShare(selectedForBulk.map(c => c._id));
      setShareCandidate(null);
    } else if (selectedForBulk.length > 0 && candidate) {
      // If items are selected but clicked on a specific one, still use selected
      setSelectedCandidatesForShare(selectedForBulk.map(c => c._id));
      setShareCandidate(null);
    } else if (candidate) {
      // Single mode - share one candidate
      setSelectedCandidatesForShare([candidate._id]);
      setShareCandidate(candidate);
    } else {
      toast.warning('Please select at least one candidate to share.');
      return;
    }
    setSelectedShareMembers([]);
    setShowShareModal(true);
  };

  const handleShareCandidate = async () => {
    // Validation
    if (selectedCandidatesForShare.length === 0 || selectedShareMembers.length === 0) {
      toast.warning('Please select team members to share with');
      return;
    }

    // Show confirmation modal first
    if (!showShareConfirmation) {
      setShowShareConfirmation(true);
      return;
    }

    // Perform the actual share
    setShowShareConfirmation(false);
    setIsSharingCandidate(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds: selectedCandidatesForShare,
          sharedWith: selectedShareMembers
        })
      });

      const data = await response.json();

      if (data.success) {
        const candidateWord = data.sharedCandidateCount > 1 ? 'candidates' : 'candidate';
        const memberWord = data.sharedMemberCount > 1 ? 'members' : 'member';
        toast.success(`${data.sharedCandidateCount} ${candidateWord} shared with ${data.sharedMemberCount} team ${memberWord}!`);
        setShowShareModal(false);
        setShareCandidate(null);
        setSelectedShareMembers([]);
        setSelectedCandidatesForShare([]);
      } else {
        toast.error(`Failed to share: ${data.message}`);
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share candidate. Please try again.');
    } finally {
      setIsSharingCandidate(false);
    }
  };

  const getIdsToImportShared = () => {
    const list = selectedIds.length > 0
      ? candidates.filter(c => selectedIds.includes(c._id) && c._isShared)
      : filteredCandidates.filter(c => c._isShared);
    return list.map(c => c._id).filter(id => id != null && String(id).trim() !== '');
  };

  const handleImportSharedToMineClick = () => {
    const idsToImport = getIdsToImportShared();
    if (idsToImport.length === 0) {
      toast.warning('No shared candidates selected.');
      return;
    }
    setShowImportSharedConfirm(true);
  };

  const handleImportSharedToMine = async () => {
    setShowImportSharedConfirm(false);
    const idsToImport = getIdsToImportShared();
    if (idsToImport.length === 0) return;
    setIsImportingShared(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/candidates/import-shared`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: idsToImport })
      });
      const data = await res.json();
      if (data.success) {
        const importedCount = Number(data.imported);
        setImportSharedSuccess({ imported: Number.isNaN(importedCount) ? 0 : importedCount });
        if (selectedIds.length > 0) setSelectedIds([]);
        fetchData(1, { search: searchQuery || '', position: filterJob || '' });
      } else {
        const msg = data.message != null ? String(data.message) : 'Import failed';
        console.error('[Import shared] API error:', data.message, data);
        toast.error(msg);
      }
    } catch (err) {
      const errMsg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Failed to import shared candidates';
      console.error('[Import shared] Error:', errMsg, err);
      toast.error(errMsg);
    } finally {
      setIsImportingShared(false);
    }
  };

  const handleImportAllToMineClick = () => {
    if (candidatesViewMode !== 'all') return;
    setShowImportAllConfirm(true);
  };

  const handleImportAllToMine = async () => {
    setShowImportAllConfirm(false);
    setIsImportingAll(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/candidates/import-all-to-mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        const importedCount = Number(data.imported);
        setImportAllSuccess({ imported: Number.isNaN(importedCount) ? 0 : importedCount });
        fetchData(1, { search: searchQuery || '', position: filterJob || '' });
      } else {
        const msg = data.message != null ? String(data.message) : 'Import failed';
        console.error('[Import all] API error:', data.message, data);
        toast.error(msg);
      }
    } catch (err) {
      const errMsg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Failed to import candidates';
      console.error('[Import all] Error:', errMsg, err);
      toast.error(errMsg);
    } finally {
      setIsImportingAll(false);
    }
  };

  return {
    showShareModal, setShowShareModal, showShareConfirmation, setShowShareConfirmation,
    shareCandidate, selectedShareMembers, setSelectedShareMembers, selectedCandidatesForShare,
    isSharingCandidate, isImportingShared, showImportSharedConfirm, setShowImportSharedConfirm,
    importSharedSuccess, setImportSharedSuccess, showImportAllConfirm, setShowImportAllConfirm,
    isImportingAll, importAllSuccess, setImportAllSuccess,
    handleShareClick, handleShareCandidate, getIdsToImportShared,
    handleImportSharedToMineClick, handleImportSharedToMine,
    handleImportAllToMineClick, handleImportAllToMine,
  };
}
