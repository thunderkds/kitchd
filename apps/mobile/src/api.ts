import type { AuthResponseDto, UserRole } from '@kitchenos/shared';
import { API_BASE } from './apiBase';
import { redirectToSignIn } from './onUnauthorized';
import { session } from './session';
import { clearSession } from './storage';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  category: string | null;
  allergens: string[];
  supplierId: string | null;
  minThreshold: number | null;
}

export type StockMovementType = 'RECEIVE' | 'CONSUME' | 'WASTE' | 'ADJUST';

export interface StockMovement {
  id: string;
  ingredientId: string;
  batchId: string | null;
  type: StockMovementType;
  qty: number;
  reason: string | null;
  actorId: string;
  createdAt: string;
}

export interface CreateIngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  category?: string;
  minThreshold?: number;
}

export interface UpdateIngredientInput {
  name?: string;
  unit?: string;
  costPerUnit?: number;
  category?: string;
  minThreshold?: number;
}

export interface ReceiveStockInput {
  qty: number;
  expiryDate?: string;
  location?: string;
}

export interface RecipeIngredientResolved {
  ingredientId: string;
  name: string;
  unit: string;
  qty: number;
  costPerUnit: number;
  lineCost: number;
}

export interface Recipe {
  id: string;
  kitchenId: string;
  name: string;
  steps: string[];
  servings: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredientResolved[];
  costComputed: number;
}

export interface RecipeIngredientInput {
  ingredientId: string;
  qty: number;
}

export interface RecipeInput {
  name: string;
  steps: string[];
  servings?: number | null;
  ingredients: RecipeIngredientInput[];
}

export const LINKED_ENTITY_TYPES = ['recipe', 'task', 'ingredient'] as const;
export type LinkedEntityType = (typeof LINKED_ENTITY_TYPES)[number];

export interface Note {
  id: string;
  kitchenId: string;
  authorId: string;
  title: string | null;
  body: string;
  tags: string[];
  pinned: boolean;
  linkedEntityType: LinkedEntityType | null;
  linkedEntityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteScope = 'mine' | 'team';

export interface CreateNoteInput {
  title?: string;
  body: string;
  tags?: string[];
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  tags?: string[];
  pinned?: boolean;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string;
}

export type GuidelineType = 'SOP' | 'CHECKLIST';

export const GUIDELINE_TYPES = ['SOP', 'CHECKLIST'] as const;

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

export interface Announcement {
  id: string;
  kitchenId: string;
  authorId: string;
  title: string;
  body: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  kitchenId: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueAt: string | null;
  checklistItems: ChecklistItem[];
  sourceRecipeId: string | null;
  sourceGuidelineId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  assigneeId?: string;
  dueAt?: string;
}

export interface ChecklistItemInput {
  id?: string;
  text: string;
  done?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  assigneeId?: string | null;
  dueAt?: string;
  checklistItems?: ChecklistItemInput[];
}

export interface AssignableUser {
  id: string;
  email: string;
}

export interface StockDeduction {
  ingredientId: string;
  deductQty: number;
  currentStock: number;
  resultingStock: number;
  wouldGoNegative: boolean;
}

export interface CompletionPreview {
  requiresConfirmation: boolean;
  deductions: StockDeduction[];
  hasNegativeWarning: boolean;
}

export interface CompletionResult {
  task: Task;
  movements: { id: string; ingredientId: string; qty: number }[];
  hasNegativeWarning: boolean;
}

export interface TeamMember {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// Carries the HTTP status so callers (the query retry policy) can tell a 401/403/404 from a
// transient failure. The message is exactly what `request()` has always thrown.
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  const token = session.getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const data = await res.json().catch(() => null);
  if (res.status === 401 && session.getToken() === token) {
    try {
      await clearSession();
    } catch (error) {
      console.warn('Failed to clear session after 401', error instanceof Error ? error.message : 'unknown error');
    }
    redirectToSignIn();
  }

  if (!res.ok) {
    throw new ApiError(data?.message ?? `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

export function listTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generateTaskFromRecipe(recipeId: string): Promise<Task> {
  return request<Task>(`/tasks/generate-from-recipe/recipe/${recipeId}`, {
    method: 'POST',
  });
}

export function generateTaskFromGuideline(guidelineId: string): Promise<Task> {
  return request<Task>(`/tasks/generate-from-recipe/guideline/${guidelineId}`, {
    method: 'POST',
  });
}

export function getTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateTaskChecklist(id: string, checklistItems: ChecklistItem[]): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ checklistItems }),
  });
}


export function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listRecipes(): Promise<Recipe[]> {
  return request<Recipe[]>('/recipes');
}

export function getRecipe(id: string): Promise<Recipe> {
  return request<Recipe>(`/recipes/${id}`);
}

export function createRecipe(input: RecipeInput): Promise<Recipe> {
  return request<Recipe>('/recipes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRecipe(id: string, input: Partial<RecipeInput>): Promise<Recipe> {
  return request<Recipe>(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listGuidelines(): Promise<Guideline[]> {
  return request<Guideline[]>('/guidelines');
}

export function getGuideline(id: string): Promise<Guideline> {
  return request<Guideline>(`/guidelines/${id}`);
}

export function createGuideline(input: GuidelineInput): Promise<Guideline> {
  return request<Guideline>('/guidelines', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateGuideline(id: string, input: Partial<GuidelineInput>): Promise<Guideline> {
  return request<Guideline>(`/guidelines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listAnnouncements(): Promise<Announcement[]> {
  return request<Announcement[]>('/announcements');
}

export function createAnnouncement(input: { title: string; body: string }): Promise<Announcement> {
  return request<Announcement>('/announcements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listNotes(options: {
  scope: NoteScope;
  tag?: string;
  q?: string;
}): Promise<Note[]> {
  const params = new URLSearchParams({ scope: options.scope });
  if (options.tag) params.set('tag', options.tag);
  if (options.q) params.set('q', options.q);
  return request<Note[]>(`/notes?${params.toString()}`);
}

export function createNote(input: CreateNoteInput): Promise<Note> {
  return request<Note>('/notes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  return request<Note>(`/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteNote(id: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/notes/${id}`, { method: 'DELETE' });
}

export function listIngredients(): Promise<Ingredient[]> {
  return request<Ingredient[]>('/ingredients');
}

export function createIngredient(input: CreateIngredientInput): Promise<Ingredient> {
  return request<Ingredient>('/ingredients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateIngredient(id: string, input: UpdateIngredientInput): Promise<Ingredient> {
  return request<Ingredient>(`/ingredients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function receiveStock(id: string, input: ReceiveStockInput): Promise<{ batch: unknown; movement: StockMovement }> {
  return request<{ batch: unknown; movement: StockMovement }>(`/ingredients/${id}/stock/receive`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listMovements(id: string): Promise<StockMovement[]> {
  return request<StockMovement[]>(`/ingredients/${id}/stock/movements`);
}

export function currentStockFromMovements(movements: StockMovement[]): number {
  return movements.reduce((sum, movement) => {
    if (movement.type === 'RECEIVE' || movement.type === 'ADJUST') {
      return sum + movement.qty;
    }
    return sum - movement.qty;
  }, 0);
}

export function listMembers(): Promise<TeamMember[]> {
  return request<TeamMember[]>('/users');
}


export function fetchAssignableUsers(): Promise<AssignableUser[]> {
  return request<AssignableUser[]>('/users/assignable');
}

export function listPendingInvites(): Promise<PendingInvite[]> {
  return request<PendingInvite[]>('/users/invites');
}

export function inviteMember(email: string, role: UserRole): Promise<PendingInvite> {
  return request<PendingInvite>('/users/invite', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export function revokeInvite(id: string): Promise<PendingInvite> {
  return request<PendingInvite>(`/users/invites/${id}`, {
    method: 'DELETE',
  });
}

export type AcceptInviteResult = AuthResponseDto;

export function acceptInvite(token: string, password: string): Promise<AcceptInviteResult> {
  return request<AcceptInviteResult>('/users/invite/accept', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}


export function previewTaskCompletion(id: string): Promise<CompletionPreview> {
  return request<CompletionPreview>(`/tasks/${id}/complete/preview`, {
    method: 'POST',
  });
}

export function confirmTaskCompletion(id: string): Promise<CompletionResult> {
  return request<CompletionResult>(`/tasks/${id}/complete/confirm`, {
    method: 'POST',
  });
}

// M016
export interface RecipeVersion {
  id: string;
  recipeId: string;
  version: number;
  name: string;
  steps: string[];
  servings: number | null;
  ingredientsSnapshot: RecipeIngredientResolved[];
  costComputedAtSnapshot: number;
  createdAt: string;
}

export function listRecipeVersions(id: string): Promise<RecipeVersion[]> {
  return request<RecipeVersion[]>(`/recipes/${id}/versions`);
}

// M015 — inventory alerts. Response shapes mirror AlertsService: low-stock returns Ingredient rows
// with the ledger-derived `currentStock` appended; expiring returns StockBatch rows with `ingredient`.
export interface LowStockIngredient {
  id: string;
  name: string;
  unit: string;
  minThreshold: number | null;
  currentStock: number;
}

export interface ExpiringSoonBatch {
  id: string;
  ingredientId: string;
  qty: number;
  expiryDate: string | null;
  location: string | null;
  createdAt: string;
  ingredient: {
    id: string;
    name: string;
    unit: string;
  };
}

export function listLowStock(): Promise<LowStockIngredient[]> {
  return request<LowStockIngredient[]>('/inventory/alerts/low-stock');
}

// No `days` by default: the server's window (DEFAULT_EXPIRING_SOON_DAYS = 3) is what web uses too.
export function listExpiringSoon(days?: number): Promise<ExpiringSoonBatch[]> {
  const query = days ? `?days=${days}` : '';
  return request<ExpiringSoonBatch[]>(`/inventory/alerts/expiring${query}`);
}

// M014
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

export function listShiftLogs(): Promise<ShiftLog[]> {
  return request<ShiftLog[]>('/shift-logs');
}

export function createShiftLog(input: CreateShiftLogInput): Promise<ShiftLog> {
  return request<ShiftLog>('/shift-logs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
