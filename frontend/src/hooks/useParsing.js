// src/hooks/useParsing.js
import { useState, useCallback } from 'react';
import BASE_API_URL from '../config';
export const useParsing = (fetchCandidates) => {
    const [selectedIds, setSelectedIds] = useState([]);
    const [isParsing, setIsParsing] = useState(false);

    const toggleSelection = useCallback((id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    }, []);

    /** Replace selection with exactly these ids, or clear if already exactly these. */
    const selectAll = useCallback((allIds) => {
        const ids = Array.isArray(allIds) ? allIds : [];
        setSelectedIds((prev) => {
            const same =
                prev.length === ids.length && ids.every((id) => prev.includes(id));
            return same ? [] : [...ids];
        });
    }, []);

    /** Toggle only the current page: select missing page rows, or deselect page rows. */
    const togglePageSelection = useCallback((pageIds) => {
        const ids = Array.isArray(pageIds) ? pageIds.filter(Boolean) : [];
        if (!ids.length) return;
        setSelectedIds((prev) => {
            const allOnPage = ids.every((id) => prev.includes(id));
            if (allOnPage) return prev.filter((id) => !ids.includes(id));
            return [...new Set([...prev, ...ids])];
        });
    }, []);

    const handleBulkParse = async () => {
        if (selectedIds.length === 0) return alert('Pehle candidates select karein!');

        setIsParsing(true);
        try {
            const res = await fetch(`${BASE_API_URL}/candidates/bulk-parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            });
            const data = await res.json();
            alert(data.message);

            setSelectedIds([]);
            if (fetchCandidates) fetchCandidates();
        } catch (err) {
            console.error('Parsing failed:', err);
            alert('Server connection failed!');
        } finally {
            setIsParsing(false);
        }
    };

    return {
        selectedIds,
        setSelectedIds,
        isParsing,
        toggleSelection,
        selectAll,
        togglePageSelection,
        handleBulkParse,
    };
};
