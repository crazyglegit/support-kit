# ADR 0002: Project key and project ID

Status: accepted.

`projectKey` is used only for installation lookup and administration. Initialization resolves it once to an immutable UUID `projectId`. Every subsequent domain object, repository call, transaction, join, and foreign key uses only `projectId`.
