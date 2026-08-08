'use client';

import { useState, useEffect } from 'react';
import { Star, Plus, Trash2, Save, ClipboardCheck } from 'lucide-react';

export default function ScorecardBuilder() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'general',
    criteria: [{ name: '', description: '', maxScore: 5, weight: 1 }],
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const res = await fetch('/api/scorecards/templates');
    if (res.ok) setTemplates(await res.json());
  };

  const saveTemplate = async () => {
    const res = await fetch('/api/scorecards/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTemplate),
    });
    if (res.ok) {
      fetchTemplates();
      setIsEditing(false);
      setNewTemplate({
        name: '',
        description: '',
        category: 'general',
        criteria: [{ name: '', description: '', maxScore: 5, weight: 1 }],
      });
    }
  };

  const addCriteria = () => {
    setNewTemplate({
      ...newTemplate,
      criteria: [...newTemplate.criteria, { name: '', description: '', maxScore: 5, weight: 1 }],
    });
  };

  const updateCriteria = (index: number, field: string, value: any) => {
    const updated = [...newTemplate.criteria];
    updated[index] = { ...updated[index], [field]: value };
    setNewTemplate({ ...newTemplate, criteria: updated });
  };

  const removeCriteria = (index: number) => {
    setNewTemplate({
      ...newTemplate,
      criteria: newTemplate.criteria.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Interview Scorecards</h1>
          <p className="text-stone-500">Create and manage structured interview templates</p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {isEditing ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Create Scorecard Template</h2>
          
          <div className="space-y-4 mb-6">
            <input
              type="text"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              placeholder="Template name..."
              className="w-full px-4 py-2 border border-stone-200 rounded-lg"
            />
            <textarea
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              placeholder="Description..."
              className="w-full px-4 py-2 border border-stone-200 rounded-lg"
            />
            <select
              value={newTemplate.category}
              onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg"
            >
              <option value="general">General</option>
              <option value="technical">Technical</option>
              <option value="cultural">Cultural Fit</option>
              <option value="behavioral">Behavioral</option>
              <option value="leadership">Leadership</option>
            </select>
          </div>

          <h3 className="font-medium text-stone-700 mb-3">Criteria</h3>
          <div className="space-y-3 mb-6">
            {newTemplate.criteria.map((c, index) => (
              <div key={index} className="flex gap-3 p-3 bg-stone-50 rounded-lg">
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => updateCriteria(index, 'name', e.target.value)}
                  placeholder="Criteria name"
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-lg"
                />
                <input
                  type="text"
                  value={c.description}
                  onChange={(e) => updateCriteria(index, 'description', e.target.value)}
                  placeholder="Description"
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-lg"
                />
                <input
                  type="number"
                  value={c.maxScore}
                  onChange={(e) => updateCriteria(index, 'maxScore', parseInt(e.target.value))}
                  placeholder="Max"
                  className="w-20 px-3 py-2 border border-stone-200 rounded-lg"
                />
                <button onClick={() => removeCriteria(index)} className="text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addCriteria}
            className="w-full py-2 border border-dashed border-stone-300 rounded-lg text-stone-500 hover:bg-stone-50 mb-4"
          >
            + Add Criteria
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-2 border border-stone-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={saveTemplate}
              className="flex-1 py-2 bg-brand-600 text-white rounded-lg"
            >
              <Save className="w-4 h-4 inline mr-2" />
              Save Template
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {templates.map((template: any) => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="bg-white rounded-xl border border-stone-200 p-5 cursor-pointer hover:border-brand-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-brand-50 rounded-lg">
                  <ClipboardCheck className="w-5 h-5 text-brand-600" />
                </div>
                <span className="text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded">
                  {template.category}
                </span>
              </div>
              <h3 className="font-semibold text-stone-900 mb-1">{template.name}</h3>
              <p className="text-sm text-stone-500 mb-3">{template.description}</p>
              <div className="text-xs text-stone-400">
                {template.criteria?.length || 0} criteria
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
