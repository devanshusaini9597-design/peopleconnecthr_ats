import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';

export default function ExportExcelModal({
  showDownloadModal,
  setShowDownloadModal,
  filteredCandidates,
  filteredCount = 0,
  selectedIds,
  toast,
  fetchMatchingIds,
  listQueryOptions,
}) {
  const [downloading, setDownloading] = useState(false);
  if (!showDownloadModal) return null;

  const selectedCount = selectedIds.length;
  const matchCount = typeof filteredCount === 'number' ? filteredCount : filteredCandidates.length;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let ids = [];
      if (selectedCount > 0) {
        ids = selectedIds.filter(Boolean);
      } else if (typeof fetchMatchingIds === 'function') {
        const result = await fetchMatchingIds(listQueryOptions || {});
        ids = Array.isArray(result) ? result : (result?.ids || []);
        if (result?.capped) {
          toast.info(`Exporting first ${ids.length.toLocaleString()} of ${Number(result.totalCount || 0).toLocaleString()} matches.`);
        }
      } else {
        ids = filteredCandidates.map((c) => c._id).filter(Boolean);
      }
      if (!ids.length) {
        toast.warning('No candidates to download.');
        return;
      }
      const res = await authenticatedFetch('/api/candidates/export', {
        method: 'POST',
        body: JSON.stringify({ ids, selected: selectedCount > 0 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Candidates_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${ids.length} candidate(s) to Excel`);
      setShowDownloadModal(false);
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm animate-fade-in" onClick={() => { if (!downloading) setShowDownloadModal(false); }}>
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/60 shadow-2xl w-full max-w-md p-6 modal-panel-ats" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Download size={20} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 tracking-tight">Download Excel</h3>
            </div>
            <p className="text-sm text-stone-600 mb-6">
              {selectedCount > 0
                ? `You have selected ${selectedCount} candidate(s). Do you want to download their data as Excel?`
                : `No candidates selected. This will download all ${matchCount.toLocaleString()} matching candidate(s) as Excel.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                className="btn-secondary"
                disabled={downloading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-60"
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading ? 'Exporting…' : `Download ${selectedCount > 0 ? `${selectedCount} Selected` : 'All'}`}
              </button>
            </div>
          </div>
        </div>
  );
}
