import { useState, useRef } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';

export function useCandidateImport({ toast, fetchData, searchQuery, filterJob, onImportComplete } = {}) {
  const fileInputRef = useRef(null);
  const autoUploadInputRef = useRef(null);
  const BULK_UPLOAD_URL = `${BASE_API_URL}/candidates/bulk-upload`;

  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [importConfirmation, setImportConfirmation] = useState(null);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateRecords, setDuplicateRecords] = useState([]);
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);
  const [correctionRecords, setCorrectionRecords] = useState([]);

const handleBulkUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
    setIsHeaderLoading(true);
        // Send file to backend to extract headers
        const formData = new FormData();
        formData.append('file', file);

        const res = await authenticatedFetch(`${BASE_API_URL}/candidates/extract-headers`, {
            method: 'POST',
            body: formData
        });

        if (isUnauthorized(res)) {
          handleUnauthorized();
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
            toast.error('Error reading Excel: ' + (data.message || 'Unknown error'));
            event.target.value = null;
            return;
        }

        setExcelHeaders(data.headers);
        setPendingFile(file);
        setShowColumnMapper(true);
        event.target.value = null;
    } catch (error) {
        console.error("Error reading Excel:", error);
        toast.error('Error reading Excel file. Please try again.');
        event.target.value = null;
      } finally {
        setIsHeaderLoading(false);
    }
};

// 🔥 NEW: Auto-upload without column mapping (reads Excel headers automatically)
const handleAutoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        setIsUploading(true);
        
        const uploadData = new FormData();
        uploadData.append('file', file);
        // NO columnMapping - backend will auto-detect!
        
        console.log('📤 Uploading file:', file.name);
        const response = await authenticatedFetch(`${BASE_API_URL}/candidates/bulk-upload-auto`, {
            method: 'POST',
            body: uploadData
        });

        console.log('📦 Response status:', response.status, 'ok:', response.ok);

        if (isUnauthorized(response)) {
          handleUnauthorized();
          setIsUploading(false);
          return;
        }
        
        if (!response.ok) {
          let errorMessage = 'Upload failed';
          try {
            const errorText = await response.text();
            console.error('❌ Error response text:', errorText);
            if (errorText) {
              try {
                const parsed = JSON.parse(errorText);
                if (parsed?.message) errorMessage = parsed.message;
              } catch {
                errorMessage = errorText.substring(0, 100);
              }
            }
          } catch (e) {
            console.error('Error reading response:', e);
          }
          throw new Error(`${errorMessage} (HTTP ${response.status})`);
        }

        // ✅ Parse response with error handling
        let data;
        try {
          // Read as text first to handle NDJSON format
          const responseText = await response.text();
          console.log('📝 Raw response (first 500 chars):', responseText.substring(0, 500));
          
          if (!responseText || responseText === '') {
            throw new Error('Empty response from server');
          }
          
          // Split by newlines to handle NDJSON format
          const lines = responseText.trim().split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            throw new Error('No JSON lines in response');
          }
          
          // Find the "complete" message (last object in NDJSON stream)
          let completeMessage = null;
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'complete' || parsed.success) {
                completeMessage = parsed;
                break; // Found it, stop looking
              }
            } catch (e) {
              // Skip invalid lines
              continue;
            }
          }
          
          // If no complete message found, use the last valid JSON
          if (!completeMessage) {
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                completeMessage = JSON.parse(lines[i]);
                break;
              } catch (e) {
                continue;
              }
            }
          }
          
          if (!completeMessage) {
            throw new Error('Could not parse any valid JSON from response');
          }
          
          data = completeMessage;
          console.log('✅ Parsed complete message:', data);
        } catch (parseError) {
          console.error('❌ Parse error:', parseError);
          console.error('Response status:', response.status, response.statusText);
          throw new Error('Invalid response format: ' + parseError.message);
        }
        
        console.log('✅ Parsed data:', data);

        if (data.success && data.results) {
            // ✅ Show review modal with categorized results
            setReviewData(data.results);
            setReviewFilter('ready'); // Default to Ready tab
            setEditingRow(null);
            setShowReviewModal(true);
            
            console.log(`📊 Validation Complete: ${data.stats.ready} ready, ${data.stats.review} review, ${data.stats.blocked} blocked`);
            toast.success(`Validation complete! Ready: ${data.stats.ready}, Review: ${data.stats.review}, Blocked: ${data.stats.blocked}`);
        } else if (data.success && data.imported) {
            // ❌ Older backend version still running - it auto-imported instead of returning results
            toast.warning(`Backend version mismatch! Restart backend and try again. Imported ${data.imported} records.`);
            setIsUploading(false);
            return;
        } else {
            throw new Error(data.message || 'Failed to process file - check if backend was restarted');
        }

        setIsUploading(false);
    } catch (error) {
        console.error("❌ Auto Upload Error:", error);
        toast.error('Error: ' + error.message);
        setIsUploading(false);
    } finally {
        event.target.value = null;
    }
};

const handleUploadWithMapping = async (mapping) => {
    if (!pendingFile) return;
    const file = pendingFile;

    try {
        setIsUploading(true);
        console.log("📤 Sending mapping to backend:", mapping);
        console.log("📤 Mapping keys:", Object.keys(mapping || {}));
        console.log("📤 Mapping values:", Object.values(mapping || {}));
        console.log("📄 File selected:", {
          name: file?.name,
          type: file?.type,
          size: file?.size
        });
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('columnMapping', JSON.stringify(mapping));

        console.log("📦 FormData prepared with file and mapping");
        console.log("📦 columnMapping JSON:", JSON.stringify(mapping));
        console.log("📦 FormData entries:");
        for (const pair of uploadData.entries()) {
          console.log(`   - ${pair[0]}:`, pair[1]);
        }
        
        // Use fetch to handle streaming response
        const response = await fetch(`${BULK_UPLOAD_URL}`, {
            method: 'POST',
            body: uploadData,
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }

        // Read streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let isComplete = false;
        let buffer = ''; // Buffer for incomplete lines

        while (!isComplete) {
            const { done, value } = await reader.read();
            if (done) {
                // Process any remaining buffer
                if (buffer.trim()) {
                    try {
                        const msg = JSON.parse(buffer);
                        if (msg.type === 'complete') isComplete = true;
                    } catch (e) {
                        console.error('Final buffer parse error:', e.message, 'buffer:', buffer.substring(0, 100));
                    }
                }
                break;
            }

            // Append to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Split by newlines but keep incomplete lines in buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line

            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const msg = JSON.parse(line);

                    if (msg.type === 'progress') {
                      const percent = ((msg.processed / msg.total) * 100).toFixed(1);
                      console.log(`⏳ Progress: ${msg.processed}/${msg.total} (${percent}%) - ${new Date().toLocaleTimeString()}`);
                    } else if (msg.type === 'complete') {
                      // Just import silently - no duplicate modals
                      setTimeout(() => {
                        fetchData(1, { search: '', position: '' });
                      }, 500);
                      
                      const duplicateCount = (msg.duplicatesInFile || 0) + (msg.duplicatesInDB || 0);
                      
                      // Show simple success message
                      toast.success(`Upload complete! Imported: ${msg.totalProcessed} candidates. Duplicates removed: ${duplicateCount}`);
                    } else if (msg.type === 'error') {
                        toast.error(msg.message);
                        setIsUploading(false);
                    }
                } catch (e) {
                    console.error('Parse error for line:', e.message);
                    // Log the problematic line for debugging
                    if (line.length > 0 && line.length < 200) {
                        console.error('Problematic line:', line);
                    } else if (line.length > 0) {
                        console.error('Problematic line (truncated):', line.substring(0, 100), '...');
                    }
                }
            }
        }
    } catch (error) {
        console.error("Bulk Upload Error:", error);
        toast.error('Error: ' + error.message);
        setIsUploading(false);
    } finally {
        setShowColumnMapper(false);
        setPendingFile(null);
        setColumnMapping(null);
    }
};

  const handleRevalidateRecord = async (record) => {
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/revalidate-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: record.fixed || record })
      });
      
      if (!response.ok) throw new Error('Revalidation failed');
      
      const result = await response.json();
      
      // Update the edited row with new validation
      setEditingRow({
        ...record,
        fixed: result.fixed,
        autoFixChanges: result.autoFixChanges,
        validation: result.validation
      });
      
      toast.success(`Category: ${result.validation.category.toUpperCase()} — ${result.validation.confidence}% Confidence`);
    } catch (error) {
      toast.error(`Revalidation error: ${error.message}`);
    }
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRow) return;
    
    console.log('💾 Saving & Importing edited record:', editingRow);
    console.log('🔍 Row to remove - rowIndex:', editingRow.rowIndex, 'name:', editingRow.fixed?.name);
    
    try {
      const recordData = editingRow.fixed || editingRow.original || editingRow;
      const candidateName = recordData.name || 'Candidate';
      const rowIndexToRemove = editingRow.rowIndex;
      const nameToRemove = editingRow.fixed?.name?.toLowerCase();
      
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          readyRecords: [recordData],
          reviewRecords: []
        })
      });
      
      if (!response.ok) throw new Error('Failed to import');
      
      const result = await response.json();
      console.log('✅ Record imported:', result);
      
      // Close edit modal first
      setEditingRow(null);
      
      // Update reviewData - remove the imported record from ALL categories
      // Use both rowIndex AND name matching for reliability
      setReviewData(prev => {
        if (!prev) return prev;
        
        const filterRecord = (r) => {
          const recordName = r.fixed?.name?.toLowerCase();
          const recordRowIndex = r.rowIndex;
          
          // Match by rowIndex first, then by name as fallback
          if (rowIndexToRemove !== undefined && recordRowIndex === rowIndexToRemove) {
            console.log('🗑️ Removing by rowIndex match:', rowIndexToRemove);
            return false;
          }
          if (nameToRemove && recordName === nameToRemove) {
            console.log('🗑️ Removing by name match:', nameToRemove);
            return false;
          }
          return true;
        };
        
        const updated = {
          ...prev,
          ready: prev.ready.filter(filterRecord),
          review: prev.review.filter(filterRecord),
          blocked: prev.blocked.filter(filterRecord)
        };
        
        console.log('📊 Updated reviewData:', {
          ready: updated.ready?.length || 0,
          review: updated.review?.length || 0,
          blocked: updated.blocked?.length || 0
        });
        return updated;
      });
      
      // Show confirmation modal after a small delay to let state update
      setTimeout(() => {
        setImportConfirmation({ 
          candidateName,
          show: true 
        });
      }, 200);
      
    } catch (error) {
      console.error('❌ [Import single record] Error:', error?.message, error);
      toast.error('Import error: ' + (error?.message != null ? String(error.message) : 'Unknown error'));
    }
  };

  const handleImportReviewed = async () => {
    if (!reviewData) return;
    
    const readyRecords = reviewData.ready; 
    const reviewRecords = reviewData.review || [];
    
    try {
      console.log(`📤 [IMPORT] Sending ${readyRecords.length} ready + ${reviewRecords.length} review records`);
      
      // Mark review records with pending_review status
      const reviewRecordsWithStatus = reviewRecords.map(r => ({
        ...r.fixed || r.original,
        status: 'Pending Review',
        needsReview: true
      }));
      
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          readyRecords,
          reviewRecords: reviewRecordsWithStatus
        })
      });
      
      console.log(`📥 [IMPORT] Response status: ${response.status}, ok: ${response.ok}`);
      
      let result;
      const responseText = await response.text();
      console.log(`📥 [IMPORT] Response text (first 500 chars): ${responseText.substring(0, 500)}`);
      
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ [IMPORT] Failed to parse response as JSON:`, parseError);
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 200)}`);
      }
      
      if (!response.ok) {
        throw new Error(result.message || `Server error: ${response.status}`);
      }
      
      console.log(`✅ [IMPORT] Response:`, result);
      toast.success(`${result.imported} candidates imported successfully! ${reviewRecords.length} added for review`);
      
      // Get the review count from reviewData before closing modal
      const reviewCount = reviewRecords.length;
      
      // Refresh data and close modal
      setShowReviewModal(false);
      setReviewData(null);
      setEditingRow(null);
      fetchData(1, { search: '', position: '' });
      
      // Call completion callback if provided
      if (onImportComplete) {
        console.log('📢 Calling onImportComplete callback');
        onImportComplete({
          imported: result.imported,
          review: reviewCount,
          timestamp: new Date()
        });
      }
    } catch (error) {
      const msg = error?.message != null ? String(error.message) : 'Unknown error';
      console.error('[Import reviewed] Error:', msg, error);
      toast.error(`Import error: ${msg}`);
    }
  };

  const getFilteredReviewData = () => {
    if (!reviewData) return { ready: [], review: [], blocked: [] };
    
    if (reviewFilter === 'review') {
      return { ready: [], review: reviewData.review || [], blocked: [] };
    } else if (reviewFilter === 'blocked') {
      return { ready: [], review: [], blocked: reviewData.blocked || [] };
    }
    return reviewData;
  };

  return {
    fileInputRef, autoUploadInputRef, BULK_UPLOAD_URL,
    isHeaderLoading, isUploading, showColumnMapper, setShowColumnMapper, excelHeaders, columnMapping, pendingFile, setPendingFile,
    showReviewModal, setShowReviewModal, reviewData, setReviewData, editingRow, setEditingRow,
    reviewFilter, setReviewFilter, importConfirmation, setImportConfirmation,
    showDuplicatesModal, setShowDuplicatesModal, duplicateRecords,
    showCorrectionsModal, setShowCorrectionsModal, correctionRecords,
    handleBulkUpload, handleAutoUpload, handleUploadWithMapping,
    handleRevalidateRecord, handleSaveEditedRecord, handleImportReviewed, getFilteredReviewData,
  };
}
