# ADR 0003: Repository encapsulation

Status: accepted.

Repositories remain internal to the composed SDK. Public operations omit `projectId`, and the SDK injects its resolved value. This prevents hosts and future transports from accidentally selecting the wrong project or bypassing application authorization.
