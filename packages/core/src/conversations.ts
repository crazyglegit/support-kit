import { DomainError } from "./errors.js";
import type { ConversationStatus } from "./values.js";

const TRANSITIONS: Readonly<
  Record<ConversationStatus, readonly ConversationStatus[]>
> = {
  open: [
    "waiting_for_agent",
    "waiting_for_customer",
    "resolved",
    "closed",
    "spam",
  ],
  waiting_for_agent: [
    "open",
    "waiting_for_customer",
    "resolved",
    "closed",
    "spam",
  ],
  waiting_for_customer: [
    "open",
    "waiting_for_agent",
    "resolved",
    "closed",
    "spam",
  ],
  resolved: ["open", "closed", "spam"],
  closed: ["open"],
  spam: ["open"],
};

/** Returns whether a conversation may move between two different states. */
export function canTransitionConversation(
  from: ConversationStatus,
  to: ConversationStatus,
): boolean {
  return from !== to && TRANSITIONS[from].includes(to);
}

/** Enforces a valid conversation transition or raises a structured domain error. */
export function assertConversationTransition(
  from: ConversationStatus,
  to: ConversationStatus,
): void {
  if (!canTransitionConversation(from, to)) {
    throw new DomainError(
      "INVALID_STATE_TRANSITION",
      `Conversation cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}

/** Returns whether a state represents an ongoing support conversation. */
export function isActiveConversationStatus(
  status: ConversationStatus,
): boolean {
  return (
    status === "open" ||
    status === "waiting_for_agent" ||
    status === "waiting_for_customer"
  );
}

/** Returns whether a state ends ordinary conversation processing. */
export function isTerminalConversationStatus(
  status: ConversationStatus,
): boolean {
  return status === "resolved" || status === "closed" || status === "spam";
}
