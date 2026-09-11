import { Building2, Users, Briefcase, Check } from 'lucide-react';

export const STEPS = [
  { id: 1, name: 'Organization', icon: Building2 },
  { id: 2, name: 'Team', icon: Users },
  { id: 3, name: 'First Job', icon: Briefcase },
  { id: 4, name: 'All Set', icon: Check }
];

export const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'hr_recruiter', label: 'HR Recruiter' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'sales', label: 'Sales' },
  { value: 'other', label: 'Other' },
];
export const EMP_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
