export type SupportWidgetPosition = "bottom-left" | "bottom-right";
export type SupportWidgetTheme = "light" | "dark" | "system";

export interface SupportWidgetThemeVariables {
  readonly background?: string;
  readonly foreground?: string;
  readonly border?: string;
  readonly muted?: string;
  readonly customerBubble?: string;
  readonly agentBubble?: string;
  readonly radius?: number;
  readonly fontFamily?: string;
  readonly panelWidth?: number;
  readonly panelHeight?: number;
}

export interface SupportWidgetStrings {
  readonly launcherLabel: string;
  readonly greeting: string;
  readonly newConversation: string;
  readonly conversations: string;
  readonly send: string;
  readonly retry: string;
  readonly reconnecting: string;
  readonly offline: string;
  readonly loading: string;
  readonly noConversations: string;
  readonly messageFailed: string;
  readonly back: string;
  readonly close: string;
  readonly writeMessage: string;
  readonly newMessages: string;
  readonly resolved: string;
}

export interface SupportWidgetOptions {
  readonly apiBaseUrl?: string;
  readonly socketUrl?: string;
  readonly position?: SupportWidgetPosition;
  readonly theme?: SupportWidgetTheme;
  readonly title?: string;
  readonly greeting?: string;
  readonly launcherLabel?: string;
  readonly accentColor?: string;
  readonly locale?: string;
  readonly strings?: Partial<SupportWidgetStrings>;
  readonly credentials?: RequestCredentials;
  readonly zIndex?: number;
  readonly maxMessageLength?: number;
  readonly requestTimeoutMs?: number;
  readonly themeVariables?: SupportWidgetThemeVariables;
  readonly container?: HTMLElement;
}

export type SupportWidgetEventName =
  | "ready"
  | "opened"
  | "closed"
  | "conversation.created"
  | "message.sent"
  | "message.received"
  | "unread.changed"
  | "connection.changed"
  | "error";

export interface SupportWidgetEvent<TData = unknown> {
  readonly type: SupportWidgetEventName;
  readonly data: TData;
}

export type SupportWidgetListener = (event: SupportWidgetEvent) => void;
