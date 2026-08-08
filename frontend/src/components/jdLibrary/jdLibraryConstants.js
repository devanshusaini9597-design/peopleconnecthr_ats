/** Built-in starters — always available; not stored in DB */
export const STARTER_TEMPLATES = [
  {
    id: 'starter-1',
    role: 'Full Stack Developer',
    experience: '3-5 Years',
    location: 'Hybrid',
    ctc: '12 - 18 LPA',
    skills: ['React', 'Node.js', 'MongoDB', 'Express'],
    description:
      'Build and maintain scalable web applications end-to-end. Own API design, frontend architecture, and deployment collaboration with DevOps.',
    isStarter: true,
  },
  {
    id: 'starter-2',
    role: 'Frontend Developer',
    experience: '2+ Years',
    location: 'Remote',
    ctc: '8 - 14 LPA',
    skills: ['React', 'Tailwind CSS', 'TypeScript'],
    description:
      'Craft responsive, accessible interfaces with a strong focus on performance, design systems, and polished interaction details.',
    isStarter: true,
  },
  {
    id: 'starter-3',
    role: 'Backend Engineer',
    experience: '3-6 Years',
    location: 'Bangalore / Hybrid',
    ctc: '15 - 22 LPA',
    skills: ['Node.js', 'PostgreSQL', 'Redis', 'AWS'],
    description:
      'Design reliable services, optimize data models, and improve system observability across production workloads.',
    isStarter: true,
  },
  {
    id: 'starter-4',
    role: 'HR Manager',
    experience: '5+ Years',
    location: 'On-site',
    ctc: '10 - 16 LPA',
    skills: ['Recruitment', 'Employee Relations', 'Payroll'],
    description:
      'Own end-to-end HR operations including hiring strategy, employee engagement, policy compliance, and people analytics.',
    isStarter: true,
  },
  {
    id: 'starter-5',
    role: 'Product Designer',
    experience: '2-4 Years',
    location: 'Remote / Hybrid',
    ctc: '10 - 18 LPA',
    skills: ['Figma', 'Prototyping', 'User Research', 'Design Systems'],
    description:
      'Lead discovery-to-delivery design for product surfaces. Partner with engineering to ship clear, usable experiences.',
    isStarter: true,
  },
];

export const emptyForm = {
  role: '',
  experience: '',
  location: '',
  ctc: '',
  skills: '',
  description: '',
};

export const mapJobToTemplate = (job) => ({
  id: job._id,
  _id: job._id,
  role: job.role || job.title || 'Untitled',
  experience: job.experience || '',
  location: job.location || '',
  ctc: job.ctc || '',
  skills: Array.isArray(job.skills) ? job.skills : [],
  description: job.description || '',
  isStarter: false,
});
