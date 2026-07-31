# ADR 0001: Public SDK composition

Status: accepted.

The main package constructs application use cases behind typed operation groups. Hosts supply ports and never construct repositories, transactions, or use cases. This keeps the consumer API small while preserving framework-independent business logic.
