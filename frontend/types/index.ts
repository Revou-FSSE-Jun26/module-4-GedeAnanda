/**
 * Shapes returned by the RevoTask API. Defined once here and imported
 * everywhere (guideline FE-05). Field names match the API's JSON exactly.
 */

export type { ApiError } from "@/lib/errors";

export type Role = "admin" | "member";
export type Priority = "low" | "medium" | "high";
export type NotificationType = "card_assigned" | "comment_added" | "board_invite";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface LoginResult {
  access_token: string;
  user: User;
}

/** A board as seen by the current user; `role` is their role on it. */
export interface Board {
  id: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface BoardMember {
  user_id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  order: number;
  is_done: boolean;
}

export interface PersonRef {
  id: string;
  name: string;
}

/** One of the six marker colours; the same names the API accepts for a label's `color`. */
export type LabelColor = "cobalt" | "teal" | "plum" | "poppy" | "amber" | "moss";

/** A coloured tag that belongs to a board and can be put on its cards. */
export interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

/** One step of a card's checklist, as it comes inside a card. */
export interface ChecklistItem {
  id: string;
  text: string;
  is_done: boolean;
}

export interface Card {
  id: string;
  column_id: string;
  board_id: string;
  board_name: string;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
  order: number;
  completed_at: string | null;
  created_by: string;
  assignee: PersonRef | null;
  /** Sorted by name. */
  labels: Label[];
  /** In the order the items were added. */
  checklist: ChecklistItem[];
}

export interface ColumnWithCards extends Column {
  cards: Card[];
}

/** `GET /api/boards/<id>`: the board with its ordered columns and active cards. */
export interface BoardDetail extends Board {
  columns: ColumnWithCards[];
  /** Every label of the board, sorted by name. */
  labels: Label[];
}

export interface Comment {
  id: string;
  card_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: PersonRef;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  is_read: boolean;
  card_id: string | null;
  board_id: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface NotificationPage extends PaginatedResponse<Notification> {
  unread_count: number;
}

export interface OrderEntry {
  id: string;
  order: number;
}

/** `PATCH /api/cards/<id>/position`. `column_orders` is filled only when `rebalanced`. */
export interface CardMoveResult {
  card: Card;
  rebalanced: boolean;
  column_orders: OrderEntry[];
}

/** `PATCH /api/boards/<id>/columns/reorder`. */
export interface ColumnReorderResult {
  column: Column;
  rebalanced: boolean;
  column_orders: OrderEntry[];
}

export interface Analytics {
  cards_per_column: { column_id: string; column_name: string; count: number }[];
  completed_this_week: number;
  member_activity: {
    user_id: string;
    name: string;
    cards_created: number;
    cards_assigned: number;
    comments_last_7_days: number;
  }[];
}

/** Every delete endpoint answers with the ID that was removed. */
export interface Deleted {
  id: string;
}
