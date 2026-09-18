# Workspace permissions

Permissions combine a workspace role with the most specific collection or whiteboard grant. The strongest valid role wins. Workspace admins are custodians and can recover all workspace content.

| Capability | Admin | Staff | External |
|---|---:|---:|---:|
| Manage workspace settings and members | Yes | No | No |
| Create workspace invitation links | Yes | No | No |
| Create collections and whiteboards | Yes | Yes | No by default |
| Manage a collection | Any collection | Owned collection | No |
| Discover workspace-visible collections | Yes | Yes | No |
| Access selected/private collections | Yes | If owner or shared | If shared |
| Access a whiteboard | Yes | If inherited or shared | If inherited or shared |

Resource roles:

| Capability | Owner | Editor | Commenter | Viewer |
|---|---:|---:|---:|---:|
| View board and comments | Yes | Yes | Yes | Yes |
| Edit the canvas | Yes | Yes | No | No |
| Create/reply/react to comments | Yes | Yes | Yes | No |
| Resolve own thread | Yes | Yes | Yes | No |
| Resolve any thread | Yes | Yes | No | No |
| Rename/move/share/delete resource | Yes | No | No | No |

Rules:

- Collection access is inherited by its whiteboards unless a stronger direct whiteboard grant exists.
- `private` means owner plus workspace admins; `workspace` means admins and staff; `selected` means owner, admins, and explicit collection members.
- A shared URL is not public access. It succeeds only after invitation redemption or for an already authorized user.
- Viewer/commenter clients cannot send canvas Realtime updates. UI hiding is convenience; RLS and Edge checks are the authority.
- Admin self-removal or self-demotion is rejected to avoid orphaning a workspace.
- Profiles always display avatar, display name, and email wherever identity is shown.
