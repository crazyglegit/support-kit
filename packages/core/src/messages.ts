import { DomainError } from "./errors.js";
import type { Message } from "./entities.js";
import type { MessageType } from "./values.js";

const CLIENT_MESSAGE_ID_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{6,126}[A-Za-z0-9])$/;

/** Returns whether a message type may be exposed through customer channels. */
export function isCustomerVisibleMessageType(type: MessageType): boolean {
  return type !== "internal_note";
}

/** Returns whether a message may be exposed through customer channels. */
export function isCustomerVisibleMessage(
  message: Pick<Message, "type">,
): boolean {
  return isCustomerVisibleMessageType(message.type);
}

/** Validates a client-generated idempotency key. */
export function isValidClientMessageId(value: string): boolean {
  return CLIENT_MESSAGE_ID_PATTERN.test(value);
}

/** Enforces a valid client-generated idempotency key. */
export function assertValidClientMessageId(value: string): void {
  if (!isValidClientMessageId(value)) {
    throw new DomainError(
      "INVALID_CLIENT_MESSAGE_ID",
      "Client message ID must be 8-128 safe ASCII characters.",
      { clientMessageId: value },
    );
  }
}

/** Returns duplicate client message IDs from a collection, once per duplicated value. */
export function findDuplicateClientMessageIds(
  values: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}
