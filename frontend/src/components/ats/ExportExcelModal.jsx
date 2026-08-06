import React from 'react';
import * as XLSX from 'xlsx';
import { X, Download } from 'lucide-react';

export default function ExportExcelModal({
  showDownloadModal, setShowDownloadModal, filteredCandidates, selectedIds, toast,
}) {
  if (!showDownloadModal) return null;
  return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm animate-fade-in" onClick={() => setShowDownloadModal(false)}>
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/60 shadow-2xl w-full max-w-md p-6 modal-panel-ats" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Download size={20} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 tracking-tight">Download Excel</h3>
            </div>
            <p className="text-sm text-stone-600 mb-6">
              {selectedIds.length > 0 
                ? `You have selected ${selectedIds.length} candidate(s). Do you want to download their data as Excel?`
                : `No candidates selected. This will download all ${filteredCandidates.length} displayed candidate(s) as Excel.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const toDownload = selectedIds.length > 0 
                    ? filteredCandidates.filter(c => selectedIds.includes(c._id))
                    : filteredCandidates;
                  const data = toDownload.map(c => ({
                    'Name': c.name || '',
                    'Email': c.email || '',
                    'Contact': c.contact || '',
                    'Company': c.companyName || '',
                    'Position': c.position || '',
                    'Location': c.location || '',
                    'Experience': c.experience || '',
                    'Current CTC': c.ctc || '',
                    'Expected CTC': c.expectedCtc || '',
                    'Notice Period': c.noticePeriod || '',
                    'Status': c.status || '',
                    'Client': c.client || '',
                    'SPOC': c.spoc || '',
                    'Source': c.source || '',
                    'FLS': c.fls || '',
                    'Date': c.date ? new Date(c.date).toLocaleDateString('en-IN') : '',
                    'Remark': c.remark || ''
                  }));
                  const ws = XLSX.utils.json_to_sheet(data);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
                  ws['!cols'] = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, ...data.map(r => String(r[key]).length)) + 2 }));
                  XLSX.writeFile(wb, `Candidates_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
                  toast.success(`Downloaded ${toDownload.length} candidate(s) to Excel`);
                  setShowDownloadModal(false);
                }}
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
              >
                <Download size={16} /> Download {selectedIds.length > 0 ? `${selectedIds.length} Selected` : 'All'}
              </button>
            </div>
          </div>
        </div>
  );
}
