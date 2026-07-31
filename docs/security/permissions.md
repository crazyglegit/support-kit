# Permissions

Authorization uses exact permission names and defaults to denial. Roles are
host-mapping conveniences and never replace server-side permission checks.

The stable permissions cover conversation reading and actions, internal notes,
customer data, knowledge, saved replies, support settings, and audit access.
They are exported as `SUPPORT_PERMISSIONS` and validated by `permissionSchema`.

Use `hasPermission`, `hasEveryPermission`, and `hasAnyPermission` in domain
services. These helpers intentionally do not implement wildcard matching or role
inheritance. Host roles must be mapped to explicit permissions by the host auth
adapter.

Internal notes require both `internal_note.read` or `internal_note.create` and a
separate customer-visibility check. `isCustomerVisibleMessage` always excludes
the `internal_note` message type.
