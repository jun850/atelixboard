# Product requirements

Status: proposed. Priority labels are release requirements, not current functionality.

## Core job

“When our team reaches a useful idea, help me give the next person enough context to take ownership, then develop the details with them.”

## Primary journey

1. A member explores on a Boardy canvas.
2. They select a useful region or set of elements and choose **Hand off**.
3. A side panel asks for a title, one internal owner, one next action, and one sentence describing success. Due date and context are optional.
4. The sender previews exactly what will be shared. Publishing makes that selected snapshot readable by project members and the workflow service; it does not publish the full encrypted canvas or room key.
5. The recipient opens their inbox, reads the snapshot and action, then **Accepts** or **Requests changes**.
6. After acceptance, the primary next action becomes **Add detail**. A document can be drafted from approved context, written manually, or linked. The handoff remains usable if no document is created.
7. The owner marks the next action done, or records why it is blocked. Completion does not prove the wider project is complete.

## P0 requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| P0-01 | Project home groups canvases, handoffs, files, and linked documents | A member can locate the context for a handoff without searching a global folder tree |
| P0-02 | Handoff from a canvas selection | Preview excludes unselected elements; referenced images are included only if readable and approved |
| P0-03 | Small required form | Title, owner, next action, and success criterion are sufficient; document creation is never required |
| P0-04 | Explicit publish boundary | User sees the selected content and its audience before send; room key never reaches workflow APIs |
| P0-05 | Durable recipient inbox | Reload and reconnect preserve state; realtime loss cannot lose a handoff |
| P0-06 | Recipient decision | Only assigned owner can accept/request changes; sender can revise/resend or cancel |
| P0-07 | Immutable sent version | Later canvas edits cannot change the context someone accepted |
| P0-08 | Project authorization | Cross-project reads, writes, files, and role changes fail even with guessed IDs |
| P0-09 | Detail after acceptance | Accepted view offers Markdown export/manual writing/linking; unconfigured Docmost cannot block acceptance |
| P0-10 | Private file organization | Files have project ownership, immutable versions, scan/readiness state, and authorized downloads |
| P0-11 | Execution outcome | Owner can set accepted handoff to blocked, in progress, or done without changing acceptance history |
| P0-12 | Accessible full state coverage | Keyboard and narrow-screen flows support empty, loading, error, conflict, and permission-denied states |

## State model

Handoff lifecycle: `draft → sent → accepted`. `sent → changes_requested → sent` supports revision. `draft`, `sent`, or `changes_requested` may become `cancelled`. `accepted` is terminal for the acceptance record. Its independent execution status is `not_started`, `in_progress`, `blocked`, or `done`.

A sent version cannot be edited in place. A requested revision creates a new immutable version on resend. A material amendment after acceptance creates a successor handoff linked to the accepted one; it does not rewrite the accepted record. Recipient reassignment requires returning to a revisable state or creating a successor. The UI must show the old recipient's response accurately.

## Roles

Workspace owner manages membership and project access. Project owner manages that project's members and archive state. Editor creates and sends handoffs and uploads files. Viewer reads permitted content. An assignee must be an active project editor or owner. Only the assignee can accept or report execution progress; a sender/project owner can cancel eligible states. Administrative actions remain auditable and do not impersonate acceptance.

Initial access is project-wide; no per-document private exceptions within the workflow. Existing legacy room membership is not equivalent to project membership. External guests are deferred.

## P1: open-source Docmost integration

Create one draft document from an accepted handoff using a Boardy-owned Markdown recipe and published context. Reuse community page/editor services through our custom bridge; do not depend on Docmost paid Templates or AI. Show source version, generation status, and a link back. User edits in native Docmost. Link existing documents only when instance, space, and access alignment can be verified. User explicitly chooses generation; no automatic document on every acceptance.

Boardy-owned document recipes: implementation brief, decision note, client proposal outline. They should create the next useful artifact, not a generic essay. AI is optional; deterministic Markdown export is the baseline. Review generated claims before treating them as decisions.

## P2 and non-goals

Later: client guests, verified cross-tool search, richer templates, controlled execution-tool integrations, commercial billing. Out of initial scope: full Drive replacement, autonomous assignment/approval, new canvas format, bidirectional document synchronization, all-office suite parity.

## Measures and research gates

North star: weekly accepted handoffs whose owner takes a next step within seven days. Track this with explicit status events, not inferred document opens.

Measure time from send to acceptance, clarification rate, weekly repeat senders/recipients, project reuse, and paid conversion. Baseline these before setting business targets. Proposed pilot exit criteria: at least 5 of 10 design partners use the workflow in 3 of 4 consecutive weeks, at least 3 agree to pay, and observed recipients can explain their next action without facilitator help. These are internal decision thresholds, not industry benchmarks.

Events may contain IDs, timestamps, state, and latency. Do not capture canvas contents, document text, signed URLs, or room keys in analytics.

## Product edge cases

- Recipient loses access: deny access immediately at Boardy authorization checks, mark assignment unavailable, and require authorized reassignment. Realtime disconnection and upstream Docmost revocation have separate operational handling.
- Canvas selection includes a deleted or unavailable image: block send until removed or recovered; do not silently omit context.
- Concurrent edit: preserve user's draft and show the conflict; never silently overwrite a decision.
- Repeated click/network retry: return the same result through idempotency.
- Document provider fails: show retryable detail status; accepted handoff stays accepted.
- Source board changes: label snapshot time/version; offer a successor handoff rather than silently replacing the snapshot.
