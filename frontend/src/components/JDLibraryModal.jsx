import React, { useState, useMemo } from 'react';
import { Search, BookOpen, Sparkles, Briefcase } from 'lucide-react';
import Modal from './ui/Modal';

const TEMPLATES = [
  {
    id: 1,
    role: 'Full Stack Developer',
    experience: '3-5 Years',
    location: 'Hybrid',
    ctc: '12 - 18 LPA',
    skills: ['React', 'Node.js', 'MongoDB', 'Express'],
    description:
      'Build and maintain scalable web applications end-to-end. Own API design, frontend architecture, and deployment collaboration with DevOps.',
  },
  {
    id: 2,
    role: 'Frontend Developer',
    experience: '2+ Years',
    location: 'Remote',
    ctc: '8 - 14 LPA',
    skills: ['React', 'Tailwind CSS', 'TypeScript'],
    description:
      'Craft responsive, accessible interfaces with a strong focus on performance, design systems, and polished interaction details.',
  },
  {
    id: 3,
    role: 'Backend Engineer',
    experience: '3-6 Years',
    location: 'Bangalore / Hybrid',
    ctc: '15 - 22 LPA',
    skills: ['Node.js', 'PostgreSQL', 'Redis', 'AWS'],
    description:
      'Design reliable services, optimize data models, and improve system observability across production workloads.',
  },
  {
    id: 4,
    role: 'HR Manager',
    experience: '5+ Years',
    location: 'On-site',
    ctc: '10 - 16 LPA',
    skills: ['Recruitment', 'Employee Relations', 'Payroll'],
    description:
      'Own end-to-end HR operations including hiring strategy, employee engagement, policy compliance, and people analytics.',
  },
  {
    id: 5,
    role: 'Product Designer',
    experience: '2-4 Years',
    location: 'Remote / Hybrid',
    ctc: '10 - 18 LPA',
    skills: ['Figma', 'Prototyping', 'User Research', 'Design Systems'],
    description:
      'Lead discovery-to-delivery design for product surfaces. Partner with engineering to ship clear, usable experiences.',
  },
];

const JDLibraryModal = ({ isOpen, onClose, onSelectTemplate }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter(
      (t) =>
        t.role.toLowerCase().includes(q) ||
        t.skills.some((s) => s.toLowerCase().includes(q)) ||
        t.description.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        setSearchTerm('');
        onClose?.();
      }}
      title="JD Library"
      description="Pick a template to pre-fill your job requisition — then customize before posting."
      size="lg"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search roles, skills…"
            className="input-ats !pl-10"
            autoFocus
          />
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 -mr-1">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p className="font-semibold text-stone-700">No templates match</p>
              <p className="text-sm mt-1">Try a different role or skill keyword.</p>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelectTemplate(template)}
                className="w-full text-left group p-4 rounded-2xl border border-stone-200/80 bg-white hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-[var(--shadow-card)] transition-all duration-200 focus-ring"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/60 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Briefcase className="w-4.5 h-4.5 text-brand-600" size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-stone-900 tracking-tight group-hover:text-brand-700 transition-colors">
                        {template.role}
                      </h3>
                      <span className="badge-neutral">{template.experience}</span>
                    </div>
                    <p className="text-sm text-stone-500 leading-relaxed line-clamp-2">{template.description}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {template.skills.map((skill) => (
                        <span key={skill} className="badge-brand !py-0.5 !text-[10px]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                    <Sparkles size={12} /> Use
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};

export default JDLibraryModal;
