export type Shift = 'MORNING' | 'EVENING';

export interface ShiftLog {
  id: string;
  kitchenId: string;
  authorId: string;
  shift: Shift;
  body: string;
  createdAt: string;
}

export interface CreateShiftLogInput {
  shift: Shift;
  body: string;
}
