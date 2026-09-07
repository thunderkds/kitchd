declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
    ingredient: any;

    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $transaction<R>(fn: (prisma: Prisma.TransactionClient) => Promise<R>): Promise<R>;
    $transaction<T extends any[]>(arg: [...T]): Promise<T>;
  }

  export enum Role {
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    CHEF = 'CHEF',
    STAFF = 'STAFF',
    VIEWER = 'VIEWER',
  }

  export enum Theme {
    simple = 'simple',
    dark_neon = 'dark_neon',
  }

  export enum TaskStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
  }

  export enum GuidelineType {
    SOP = 'SOP',
    CHECKLIST = 'CHECKLIST',
  }

  export enum InviteStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    REVOKED = 'REVOKED',
  }

  export enum StockMovementType {
    RECEIVE = 'RECEIVE',
    CONSUME = 'CONSUME',
    WASTE = 'WASTE',
    ADJUST = 'ADJUST',
  }

  export enum NotificationType {
    INFO = 'INFO',
    WARNING = 'WARNING',
    SUCCESS = 'SUCCESS',
    MENTION = 'MENTION',
    LOW_STOCK = 'LOW_STOCK',
  }

  export enum Shift {
    MORNING = 'MORNING',
    AFTERNOON = 'AFTERNOON',
    EVENING = 'EVENING',
    NIGHT = 'NIGHT',
  }

  export type Organization = any;
  export type Kitchen = any;
  export type User = any;
  export type Invite = any;
  export type Ingredient = any;
  export type Recipe = any;
  export type RecipeIngredient = any;
  export type RecipeVersion = any;
  export type StockBatch = any;
  export type StockMovement = any;
  export type Task = any;
  export type Guideline = any;
  export type Note = any;
  export type Announcement = any;
  export type ShiftLog = any;
  export type Comment = any;
  export type Notification = any;

  export namespace Prisma {
    export type TransactionClient = PrismaClient;
    export type PrismaPromise<T> = Promise<T>;
    export type InputJsonValue = any;
    export type JsonValue = any;
    export type TaskGetPayload<T = any> = any;
    export type RecipeGetPayload<T = any> = any;
    export type GuidelineGetPayload<T = any> = any;
    export type IngredientGetPayload<T = any> = any;
    export type UserGetPayload<T = any> = any;
    export type InviteGetPayload<T = any> = any;
    export type RecipeVersionGetPayload<T = any> = any;
  }
}
