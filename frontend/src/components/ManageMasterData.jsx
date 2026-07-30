import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Search, ArrowUpDown } from 'lucide-react';
import Layout from './Layout';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import { formatByFieldName, formatNameForInput } from '../utils/textFormatter';

const ManageMasterData = ({ title, apiEndpoint, navigateBack }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewAllMode, setViewAllMode] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    fetchData();
  }, [apiEndpoint, viewAllMode]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const url = viewAllMode ? `${BASE_API_URL}${apiEndpoint}/all` : `${BASE_API_URL}${apiEndpoint}`;
      const response = await authenticatedFetch(url);

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Format the name field before sending
    const formattedData = {
      name: formatByFieldName('name', formData.name),
      description: formatByFieldName('description', formData.description)
    };

    if (!formattedData.name.trim()) {
      toast.warning('Name is required');
      return;
    }

    try {
      const url = editingItem
        ? `${BASE_API_URL}${apiEndpoint}/${editingItem._id}`
        : `${BASE_API_URL}${apiEndpoint}`;

      const response = await authenticatedFetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData)
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      if (response.ok) {
        toast.success(`${title.slice(0, -1)} ${editingItem ? 'updated' : 'added'} successfully!`);
        setShowModal(false);
        setFormData({ name: '', description: '' });
        setEditingItem(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Error saving data');
    }
  };

  const handleAddToMyList = async (item) => {
    if (!item || addingId) return;
    const idOrKey = item._id ?? item.addKey;
    setAddingId(idOrKey);
    try {
      const payload = {
        name: formatByFieldName('name', item.name || ''),
        description: formatByFieldName('description', item.description || '')
      };
      const response = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }
      if (response.ok) {
        const createdItem = await response.json();
        setData(prev => [...prev, { ...createdItem, isMine: true }]);
        toast.success(`Added to your list`);
      } else {
        const err = await response.json().catch(() => ({}));
        if (response.status === 400 && (err.message || '').toLowerCase().includes('already exists')) {
          toast.warning('Already in your list');
        } else {
          toast.error(err.message || 'Could not add');
        }
      }
    } catch (error) {
      console.error('Error adding to list:', error);
      toast.error('Could not add to your list');
    } finally {
      setAddingId(null);
    }
  };

  const handleDeleteConfirm = (item) => {
    setDeleteConfirm(item);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/${deleteConfirm._id}`, {
        method: 'DELETE'
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      if (response.ok) {
        toast.success(`${title.slice(0, -1)} deleted successfully!`);
        fetchData();
      } else {
        toast.error('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Error deleting data');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // In "View all" mode, show all records so every row can be edited/deleted by any user
  const displayList = useMemo(() => {
    return data;
  }, [data]);

  const filteredData = useMemo(() => {
    const list = displayList.filter(item =>
      (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && String(item.description).toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const key = sortBy === 'description' ? 'description' : 'name';
    return [...list].sort((a, b) => {
      const va = (a[key] || '').toString().toLowerCase();
      const vb = (b[key] || '').toString().toLowerCase();
      const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [displayList, searchTerm, sortBy, sortOrder]);

  const openModal = (item = null) => {
    setEditingItem(item);
    setFormData(item ? { name: item.name, description: item.description || '' } : { name: '', description: '' });
    setShowModal(true);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(navigateBack)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center">
                <Plus size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Manage {title}</h1>
                <p className="text-sm text-slate-600 mt-1">Add, edit, and manage {title.toLowerCase()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs (left) + Search & Add New (right) - enterprise style */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewAllMode(false)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${!viewAllMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
            >
              Show only mine
            </button>
            <button
              type="button"
              onClick={() => setViewAllMode(true)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${viewAllMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
            >
              View all
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 whitespace-nowrap">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border-2 border-slate-200 bg-white py-2 pr-8 pl-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 cursor-pointer"
              >
                <option value="name">Name</option>
                <option value="description">Description</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1 px-2 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                title={sortOrder === 'asc' ? 'Ascending (click for descending)' : 'Descending (click for ascending)'}
              >
                <ArrowUpDown size={16} />
                {sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
              </button>
            </div>
            <div className="relative w-64 sm:w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border-2 border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-indigo-700"
            >
              <Plus size={18} />
              Add New
            </button>
          </div>
        </div>

        {viewAllMode && (
          <p className="mb-4 text-sm text-slate-600 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
            All users can edit or delete any entry. Use <strong>+ Copy to my list</strong> to copy others’ entries.
          </p>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">Loading {title.toLowerCase()}...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Name</th>
                    {viewAllMode && <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Added by</th>}
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Description</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={viewAllMode ? 5 : 4} className="px-6 py-8 text-center text-slate-500">
                        {searchTerm ? 'No matching items found' : `No ${title.toLowerCase()} found`}
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item, index) => {
                      const isMine = viewAllMode && item.isMine === true;
                      return (
                        <tr key={item._id || `row-${index}-${(item.name || '').slice(0, 20)}`} className={`hover:bg-slate-50 ${viewAllMode && !isMine ? 'bg-slate-50/50' : ''}`}>
                          <td className="px-6 py-4 text-sm text-slate-900 font-medium">{item.name}</td>
                          {viewAllMode && (
                            <td className="px-6 py-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${isMine ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                                {isMine ? 'You' : 'Others'}
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-4 text-sm text-slate-600">{item.description || '-'}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {item.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openModal(item)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteConfirm(item)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                              {viewAllMode && !isMine && (
                                <button
                                  onClick={() => handleAddToMyList(item)}
                                  disabled={addingId === item._id}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Copy to my list"
                                >
                                  {addingId === item._id ? (
                                    <span className="inline-block w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Plus size={16} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                {editingItem ? 'Edit' : 'Add New'} {title.slice(0, -1)}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: formatNameForInput(e.target.value) })}
                    placeholder={`Enter ${title.slice(0, -1).toLowerCase()} name`}
                    required
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: formatNameForInput(e.target.value) })}
                    placeholder={`Enter ${title.slice(0, -1).toLowerCase()} description (optional)`}
                    rows="3"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-800 rounded-lg font-semibold hover:bg-slate-300 transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all text-sm"
                  >
                    {editingItem ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
          title={`Delete ${title.slice(0, -1)}`}
          message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
          confirmText={`Delete ${title.slice(0, -1)}`}
          type="delete"
          isLoading={isDeleting}
        />
      </div>
    </Layout>
  );
};

export default ManageMasterData;
