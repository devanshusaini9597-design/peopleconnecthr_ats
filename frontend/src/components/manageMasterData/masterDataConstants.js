import { Briefcase, Building2, Megaphone, IndianRupee, Clock3 } from 'lucide-react';

export const CATALOG = {
  Positions: {
    icon: Briefcase,
    singular: 'position',
    headline: 'Positions',
    subtitle: 'Roles your recruiters pick when adding candidates',
    tip: 'Maintain one company list of job roles. Changes appear immediately in Add Candidate.',
    tourKey: 'skillnix_tour_lists_positions_v1',
  },
  Clients: {
    icon: Building2,
    singular: 'client',
    headline: 'Clients',
    subtitle: 'Companies you hire for',
    tip: 'Client names are shared across your organization and used on candidate records.',
    tourKey: 'skillnix_tour_lists_clients_v1',
  },
  Sources: {
    icon: Megaphone,
    singular: 'source',
    headline: 'CV Sources',
    subtitle: 'Where resumes come from — LinkedIn, Naukri, referral, and more',
    tip: 'Keep sources consistent so reporting on CV origin stays accurate.',
    tourKey: 'skillnix_tour_lists_sources_v1',
  },
  'CTC Bands': {
    icon: IndianRupee,
    singular: 'CTC band',
    headline: 'CTC Bands',
    subtitle: 'Salary bands shown in Current / Expected CTC dropdowns',
    tip: 'Add, edit, or remove bands your team uses. Load a starter set if the list is empty.',
    tourKey: 'skillnix_tour_lists_ctc_v1',
    seedable: true,
  },
  'Notice Periods': {
    icon: Clock3,
    singular: 'notice period',
    headline: 'Notice Periods',
    subtitle: 'Notice options for candidate forms',
    tip: 'Keep notice periods consistent across the team. Load a starter set if empty.',
    tourKey: 'skillnix_tour_lists_notice_v1',
    seedable: true,
  },
};

export const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];
