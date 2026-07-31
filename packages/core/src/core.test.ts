import { describe, expect, it } from "vitest";
import {
  assertConversationTransition,
  assertValidClientMessageId,
  canTransitionConversation,
  CONVERSATION_STATUSES,
  DomainError,
  findDuplicateClientMessageIds,
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
  isActiveConversationStatus,
  isCustomerVisibleMessageType,
  isTerminalConversationStatus,
  isValidClientMessageId,
} from "./index.js";

describe("conversation lifecycle", () => {
  it.each([
    ["open", "waiting_for_agent"],
    ["waiting_for_agent", "waiting_for_customer"],
    ["waiting_for_customer", "resolved"],
    ["resolved", "open"],
    ["closed", "open"],
    ["spam", "open"],
  ] as const)("allows %s to transition to %s", (from, to) => {
    expect(canTransitionConversation(from, to)).toBe(true);
    expect(() => {
      assertConversationTransition(from, to);
    }).not.toThrow();
  });

  it.each([
    ["open", "open"],
    ["closed", "resolved"],
    ["spam", "closed"],
    ["resolved", "waiting_for_agent"],
  ] as const)("rejects %s to %s", (from, to) => {
    expect(canTransitionConversation(from, to)).toBe(false);
    expect(() => {
      assertConversationTransition(from, to);
    }).toThrowError(DomainError);
  });

  it("classifies every lifecycle state", () => {
    for (const status of CONVERSATION_STATUSES) {
      expect(
        isActiveConversationStatus(status) !==
          isTerminalConversationStatus(status),
      ).toBe(true);
    }
  });
});

describe("permission evaluation", () => {
  const granted = ["conversation.read", "conversation.reply"] as const;

  it("defaults to exact permission matching", () => {
    expect(hasPermission(granted, "conversation.read")).toBe(true);
    expect(hasPermission(granted, "audit.read")).toBe(false);
  });

  it("checks all and any permission sets", () => {
    expect(
      hasEveryPermission(granted, ["conversation.read", "conversation.reply"]),
    ).toBe(true);
    expect(
      hasEveryPermission(granted, ["conversation.read", "conversation.assign"]),
    ).toBe(false);
    expect(
      hasAnyPermission(granted, ["audit.read", "conversation.reply"]),
    ).toBe(true);
  });
});

describe("message rules", () => {
  it("keeps internal notes out of customer channels", () => {
    expect(isCustomerVisibleMessageType("internal_note")).toBe(false);
    expect(isCustomerVisibleMessageType("text")).toBe(true);
    expect(isCustomerVisibleMessageType("system")).toBe(true);
  });

  it.each(["message-01", "01HZ3KMVJRX8Q9E8PB7M6NTFQ4", "client:message_123"])(
    "accepts client message ID %s",
    (value) => {
      expect(isValidClientMessageId(value)).toBe(true);
    },
  );

  it.each([
    "",
    "short",
    " space-id",
    "message id",
    "x".repeat(129),
    "trailing-",
  ])("rejects malformed client message ID %s", (value) => {
    expect(isValidClientMessageId(value)).toBe(false);
    expect(() => {
      assertValidClientMessageId(value);
    }).toThrowError(DomainError);
  });

  it("detects duplicate idempotency keys", () => {
    expect(
      findDuplicateClientMessageIds(["message-01", "message-02", "message-01"]),
    ).toEqual(["message-01"]);
  });
});
