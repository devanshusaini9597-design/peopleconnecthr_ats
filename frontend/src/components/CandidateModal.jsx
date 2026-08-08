import React, { useState, useEffect } from 'react';
import { Upload, X, User, Calendar } from 'lucide-react';
import BASE_API_URL from '../config';
import useCountries from '../utils/useCountries';
import { useToast } from './Toast';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../utils/ctcRanges';
import { dedupeByName } from '../utils/dedupeMasterData';
import {
  CANDIDATE_STATUS_OPTIONS,
} from './candidateModal/candidateModalHelpers';

const CandidateModal = ({ show, onClose, onSubmit, formData, setFormData, editId }) => {
    if (!show) return null;

    const toast = useToast();
    const [isAutoParsing, setIsAutoParsing] = useState(false);
    const [positions, setPositions] = useState([]);
    const [clients, setClients] = useState([]);
    const [sources, setSources] = useState([]);

    const [countryCode, setCountryCode] = useState(formData.countryCode || '+91');

    const countryCodes = useCountries();

    // Fetch master data on component mount
    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [positionsRes, clientsRes, sourcesRes] = await Promise.all([
                    fetch(`${BASE_API_URL}/api/positions/all`, { credentials: 'include' }),
                    fetch(`${BASE_API_URL}/api/clients/all`, { credentials: 'include' }),
                    fetch(`${BASE_API_URL}/api/sources/all`, { credentials: 'include' })
                ]);

                if (positionsRes.ok) {
                    const positionsData = await positionsRes.json();
                    setPositions(dedupeByName(positionsData));
                }

                if (clientsRes.ok) {
                    const clientsData = await clientsRes.json();
                    setClients(dedupeByName(clientsData));
                }

                if (sourcesRes.ok) {
                    const sourcesData = await sourcesRes.json();
                    setSources(dedupeByName(sourcesData));
                }
            } catch (error) {
                console.error('Error fetching master data:', error);
            }
        };

        fetchMasterData();
    }, []);

    // Sync countryCode when formData changes (especially during edit)
    useEffect(() => {
        if (editId && formData.countryCode) {
            setCountryCode(formData.countryCode);
        } else if (!editId) {
            setCountryCode('+91');
        }
    }, [editId, formData.countryCode]);

    const handleInputChange = async (e) => {
        const { name, value, files } = e.target;

        let finalValue = value;

        if (name === 'name' && value) {
            finalValue = value.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        if (name === 'email' && value) {
            finalValue = value.toLowerCase()
                .replace(/@gnail\.con$/, '@gmail.com')
                .replace(/@gnail\.com$/, '@gmail.com')
                .replace(/@gmail\.con$/, '@gmail.com')
                .replace(/@gmal\.com$/, '@gmail.com');
        }

        if (name === 'resume') {
            const file = files[0];
            setFormData(prev => ({ ...prev, resume: file }));

            if (file) {
                setIsAutoParsing(true);
                const data = new FormData();
                data.append('resume', file);

                try {
                    const response = await fetch(`${BASE_API_URL}/candidates/parse-logic`, {
                        method: 'POST',
                        body: data,
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log("Parsed Data Received:", result);

                        setFormData(prev => ({
                            ...prev,
                            name: result.name ? (result.name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')) : prev.name,
                            email: result.email ? (result.email.toLowerCase().replace(/@gnail\.con$/, '@gmail.com').replace(/@gmail\.con$/, '@gmail.com')) : prev.email,
                            contact: result.contact || prev.contact
                        }));
                    }
                } catch (error) {
                    console.error("Auto-parse error:", error);
                } finally {
                    setIsAutoParsing(false);
                }
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: finalValue }));
        }
    };

    // 2. SMART EMAIL CHECK
    const handleEmailCheck = async (email) => {
        if (!email || editId) return;

        try {
            const response = await fetch(`${BASE_API_URL}/api/candidates/check-email/${email}`);
            const result = await response.json();

            if (result.exists) {
                toast.warning(`Candidate already exists! Previous Status: ${result.candidate.status}`);
                setFormData({
                    ...result.candidate,
                    date: result.candidate.date ? result.candidate.date.split('T')[0] : ''
                });
            }
        } catch (error) {
            console.error("Email check error:", error);
        }
    };

    const statusOptions = CANDIDATE_STATUS_OPTIONS;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 font-sans">
            {/* Scroll Fix: max-h-[85vh] aur overflow-y-auto ensure karega ki scrollbar aaye */}
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-y-auto flex flex-col">
                
                {/* Header - Fixed at Top */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <User className="text-[#6366f1]" size={24} /> 
                        {editId ? 'Edit Candidate Details' : 'Add New Candidate'}
                    </h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Close">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-6 bg-[#f8f9fc]">
                    
                    {/* Resume Upload Section */}
                    <div className="bg-[#f0f4ff] border-2 border-dashed border-[#c7d2fe] rounded-lg p-6 text-center hover:bg-[#e0e7ff] transition-colors cursor-pointer relative group">
                        <div className="flex flex-col items-center justify-center space-y-2">
                            <Upload className="text-[#6366f1] group-hover:scale-110 transition-transform" size={32} />
                            <label className="block text-sm font-bold text-[#4338ca]">Resume Upload (PDF/DOC)</label>
                            <span className="text-xs text-slate-500">Click to browse or drag file here</span>
                        </div>
                        <input type="file" name="resume" onChange={handleInputChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                        {formData.resume && (
                            <p className="mt-2 text-xs text-green-600 font-bold">Selected: {formData.resume.name || "File Updated"}</p>
                        )}
                    </div>

                    {/* --- IMPORTANT SECTION: ANALYTICS FIELDS (TOP PE RAKHA HAI) --- */}
                    <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4">Required for Analytics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* 1. STATUS (Top Left) */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#4338ca] uppercase tracking-wider flex items-center gap-1">
                                    Current Status *
                                </label>
                                <select 
                                    name="status" 
                                    className="w-full p-2.5 border-2 border-indigo-100 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-indigo-50 text-[#4338ca] font-bold text-sm" 
                                    value={formData.status || 'Applied'} 
                                    onChange={handleInputChange}
                                >
                                    {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>

                            {/* 2. SOURCE (Top Middle) */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#4338ca] uppercase tracking-wider">Source *</label>
                                <select name="source" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.source || ''} onChange={handleInputChange} required>
                                    <option value="">Select Source</option>
                                    {sources.map(s => <option key={s._id || s} value={s.name || s}>{s.name || s}</option>)}
                                </select>
                            </div>

                            {/* 3. JOINING DATE (Only visible if Joined) */}
                            {formData.status === 'Joined' && (
                                <div className="space-y-1 animate-fadeIn">
                                    <label className="text-[11px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                                        <Calendar size={12}/> Joining Date *
                                    </label>
                                    <input 
                                        type="date" 
                                        name="hiredDate" 
                                        className="w-full p-2.5 border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none bg-green-50 text-sm" 
                                        value={formData.hiredDate ? formData.hiredDate.split('T')[0] : ''} 
                                        onChange={handleInputChange} 
                                        required={formData.status === 'Joined'}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- GENERAL DETAILS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Candidate Name</label>
                            <input type="text" name="name" required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.name || ''} onChange={handleInputChange} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</label>
                            <input type="email" name="email" required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" 
                                value={formData.email || ''} onChange={handleInputChange} onBlur={(e) => handleEmailCheck(e.target.value)} placeholder="name@example.com"/>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Country Code</label>
                            <select 
                                className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" 
                                value={countryCode} 
                                onChange={(e) => {
                                    setCountryCode(e.target.value);
                                    setFormData(prev => ({ ...prev, countryCode: e.target.value }));
                                }}
                            >
                                {countryCodes.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}: {c.code}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1 lg:col-span-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact Number</label>
                            <div className="flex w-full items-stretch border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-[#6366f1] outline-none bg-white overflow-hidden">
                                <select 
                                    className="px-3 py-2.5 bg-white text-sm font-semibold min-w-[92px] border-r border-gray-200 outline-none"
                                    value={countryCode}
                                    onChange={(e) => {
                                        setCountryCode(e.target.value);
                                        setFormData(prev => ({ ...prev, countryCode: e.target.value }));
                                    }}
                                >
                                    {countryCodes.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                </select>
                                <input 
                                    type="tel" 
                                    name="contact" 
                                    className="flex-1 p-2.5 outline-none bg-white text-sm" 
                                    placeholder="1234567890" 
                                    value={formData.contact || ''} 
                                    onChange={(e) => {
                                        // Only allow digits, no symbols or country code
                                        let digitsOnly = e.target.value.replace(/\D/g, '');
                                        // Limit to reasonable length
                                        if (digitsOnly.length > 15) {
                                            digitsOnly = digitsOnly.slice(0, 15);
                                        }
                                        setFormData(prev => ({ ...prev, contact: digitsOnly }));
                                    }}
                                    maxLength="15"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
                            <input type="date" name="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" 
                                value={formData.date || new Date().toISOString().split('T')[0]} onChange={handleInputChange} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Position</label>
                            <select name="position" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.position || ''} onChange={handleInputChange} required>
                                <option value="">Select Position</option>
                                {positions.map(pos => <option key={pos._id} value={pos.name}>{pos.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Company</label>
                            <input type="text" name="companyName" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" placeholder="Company Name" value={formData.companyName || ''} onChange={handleInputChange} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Location</label>
                            <input type="text" name="location" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.location || ''} onChange={handleInputChange} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Experience (Years)</label>
                            <select name="experience" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.experience || ''} onChange={handleInputChange}>
                                <option value="">Select</option>
                                <option value="Fresher">Fresher</option>
                                {[...Array(31).keys()].slice(1).map(num => <option key={num} value={num}>{num}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current CTC (LPA)</label>
                            <select name="ctc" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm max-h-52" value={formData.ctc || ''} onChange={handleInputChange}>
                                <option value="">Select CTC</option>
                                {ctcRanges.map(range => <option key={range} value={range}>{range}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expected CTC (LPA)</label>
                            <select name="expectedCtc" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm max-h-52" value={formData.expectedCtc || ''} onChange={handleInputChange}>
                                <option value="">Select Expected CTC</option>
                                {expectedCtcOptions.map(range => <option key={range} value={range}>{range}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Notice Period</label>
                            <select name="noticePeriod" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.noticePeriod || ''} onChange={handleInputChange}>
                                <option value="">Select Notice Period</option>
                                {noticePeriodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">FLS/Non FLS</label>
                            <select name="fls" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.fls || ''} onChange={handleInputChange}>
                                <option value="">Select</option>
                                <option value="FLS">FLS</option>
                                <option value="Non-FLS">Non-FLS</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                            <select name="status" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm font-bold text-indigo-600" value={formData.status || 'Applied'} onChange={handleInputChange}>
                                {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Client</label>
                            <select name="client" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.client || ''} onChange={handleInputChange}>
                                <option value="">Select Client</option>
                                {clients.map(client => <option key={client._id} value={client.name}>{client.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">SPOC</label>
                            <input type="text" name="spoc" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.spoc || ''} onChange={handleInputChange} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Source of CV</label>
                            <select name="source" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.source || ''} onChange={handleInputChange}>
                                <option value="">Select Source</option>
                                {sources.map(source => <option key={source._id} value={source.name}>{source.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Call Back Date</label>
                            <input type="date" name="callBackDate" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white text-sm" value={formData.callBackDate || ''} onChange={handleInputChange} />
                        </div>


                    </div>

                    {/* Footer Actions - Sticky Bottom */}
                    <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200 sticky bottom-0 bg-[#f8f9fc] z-10">
                        <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm uppercase tracking-wide">
                            Cancel
                        </button>
                        <button type="submit" className="px-8 py-3 bg-[#6366f1] text-white font-bold rounded-lg hover:bg-[#4f46e5] shadow-lg shadow-indigo-200 transition-all text-sm uppercase tracking-wide">
                            {editId ? 'Save Changes' : 'Save Candidate'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CandidateModal;
