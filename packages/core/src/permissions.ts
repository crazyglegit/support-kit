import type { SupportPermission } from "./values.js";

/** Returns whether a permission collection contains the requested permission. */
export function hasPermission(
  granted: readonly SupportPermission[],
  requested: SupportPermission,
): boolean {
  return granted.includes(requested);
}

/** Returns whether every requested permission is granted. */
export function hasEveryPermission(
  granted: readonly SupportPermission[],
  requested: readonly SupportPermission[],
): boolean {
  return requested.every((permission) => hasPermission(granted, permission));
}

/** Returns whether at least one requested permission is granted. */
export function hasAnyPermission(
  granted: readonly SupportPermission[],
  requested: readonly SupportPermission[],
): boolean {
  return requested.some((permission) => hasPermission(granted, permission));
}
