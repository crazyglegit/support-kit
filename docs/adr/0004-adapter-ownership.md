# ADR 0004: Adapter ownership and disposal

Status: accepted.

Adapters are host-owned by default because database clients and provider connections may be shared. When configuration explicitly selects SDK ownership, `dispose()` invokes available adapter disposal hooks once. Health checks never make calls unless the adapter explicitly supplies a probe.
