export type GuidelineType = 'SOP' | 'CHECKLIST';

export const GUIDELINE_TYPES: GuidelineType[] = ['SOP', 'CHECKLIST'];

export interface Guideline {
  id: string;
  kitchenId: string;
  title: string;
  type: GuidelineType;
  steps: string[];
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GuidelineInput {
  title: string;
  type: GuidelineType;
  steps: string[];
  attachments?: string[];
}
