type ApplicationStage = string;

/** Map stage string to UI display string */
export const STAGE_TO_DISPLAY: Record<string, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  JOINED: 'Joined',
  REJECTED: 'Rejected',
  DROPPED: 'Dropped',
};

export function stageToDisplay(stage: string): string {
  return STAGE_TO_DISPLAY[stage] ?? stage;
}

const DISPLAY_TO_STAGE: Record<string, string> = {
  Applied: 'APPLIED',
  Screening: 'SCREENING',
  Interview: 'INTERVIEW',
  Offer: 'OFFER',
  Hired: 'HIRED',
  Joined: 'JOINED',
  Rejected: 'REJECTED',
  Dropped: 'DROPPED',
};

export function displayToStage(display: string): string | null {
  return DISPLAY_TO_STAGE[display] ?? null;
}
