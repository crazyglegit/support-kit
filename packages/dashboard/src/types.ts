export type SupportDashboardTheme = "light" | "dark" | "system";
export type SupportDashboardLayout = "auto" | "desktop" | "compact";
export interface SupportDashboardFilters {
  readonly status?:
    | "open"
    | "waiting_for_agent"
    | "waiting_for_customer"
    | "resolved"
    | "closed"
    | "spam"
    | undefined;
  readonly assignment?: "all" | "mine" | undefined;
}
export interface SupportDashboardStrings {
  readonly inbox: string;
  readonly assignedToMe: string;
  readonly allConversations: string;
  readonly reply: string;
  readonly internalNote: string;
  readonly send: string;
  readonly retry: string;
  readonly assignToMe: string;
  readonly resolve: string;
  readonly reopen: string;
  readonly markSpam: string;
  readonly loading: string;
  readonly reconnecting: string;
  readonly offline: string;
  readonly noConversations: string;
  readonly unauthorized: string;
  readonly customerDetails: string;
  readonly selectConversation: string;
  readonly back: string;
  readonly refresh: string;
}
export interface SupportDashboardOptions {
  readonly target: HTMLElement;
  readonly apiBaseUrl?: string;
  readonly socketUrl?: string;
  readonly credentials?: RequestCredentials;
  readonly theme?: SupportDashboardTheme;
  readonly layout?: SupportDashboardLayout;
  readonly accentColor?: string;
  readonly strings?: Partial<SupportDashboardStrings>;
  readonly requestTimeoutMs?: number;
  readonly initialFilters?: SupportDashboardFilters;
}
export type SupportDashboardEventName =
  | "ready"
  | "conversation.opened"
  | "message.sent"
  | "message.received"
  | "connection.changed"
  | "error";
export interface SupportDashboardEvent<T = unknown> {
  readonly type: SupportDashboardEventName;
  readonly data?: T;
}
export type SupportDashboardListener = (event: SupportDashboardEvent) => void;
