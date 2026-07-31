# Conversation lifecycle

The supported states are `open`, `waiting_for_agent`, `waiting_for_customer`,
`resolved`, `closed`, and `spam`.

Active states are the three open/waiting states. Terminal states are `resolved`,
`closed`, and `spam`. Terminal means ordinary processing has stopped; it does
not imply that the record may be deleted.

Allowed transitions:

| From                 | To                                                 |
| -------------------- | -------------------------------------------------- |
| open                 | waiting states, resolved, closed, spam             |
| waiting_for_agent    | open, waiting_for_customer, resolved, closed, spam |
| waiting_for_customer | open, waiting_for_agent, resolved, closed, spam    |
| resolved             | open, closed, spam                                 |
| closed               | open                                               |
| spam                 | open                                               |

A transition to the current state is not a transition and is rejected.
`canTransitionConversation` performs a pure check;
`assertConversationTransition` raises `DomainError` with
`INVALID_STATE_TRANSITION` when the transition is invalid.
