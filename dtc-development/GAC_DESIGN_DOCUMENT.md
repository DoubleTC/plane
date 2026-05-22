# Custom Roles — Metadata Labels for Members

> Status: implemented
> Replaces the original "Granular Access Control" (GAC) design — the
> permission-scheme / engine layer was removed because no enforcement was
> wired into the existing views. See git history (commit `5c38b02382` + the
> subsequent strip) for the historical attempt.

---

## 1. Scope of this feature

Custom Roles are **labels** that workspace admins can attach to workspace and
project members. They exist purely so that members can be classified and
grouped — they do **not** override or augment the built-in RBAC permissions on
`WorkspaceMember.role` / `ProjectMember.role` (Admin=20 / Member=15 / Guest=5).

What users get:

- Create / rename / delete custom role labels per workspace
- Scope a label to `workspace` or `project`
- Tag any member with one custom role from the matching scope
- List, filter, and visually group members by the label they carry
- Pre-seeded system labels mirroring the built-in roles (read-only)

What this feature does **not** do:

- It does not check or grant any permission at runtime
- There are no permission schemes, permission identifiers, or unions
- There is no `PermissionEngine`, no scheme attach/detach, no effective
  permissions endpoint

If the project later needs real enforcement, build it as a separate layer on
top of these labels — do not re-introduce schemes inside this model.

---

## 2. Data model (`apps/api/plane/db/models/roles.py`)

```python
class CustomRole(BaseModel):
    workspace = FK(Workspace, on_delete=CASCADE, related_name="custom_roles")
    name = CharField(max_length=255)
    description = TextField(blank=True)
    scope = CharField(choices=[("workspace", ...), ("project", ...)])
    is_system = BooleanField(default=False)        # seeded labels: undeletable
    authority_level = PositiveIntegerField(0)      # 20/15/5 mirror of ROLE_CHOICES
```

Soft-delete aware unique constraint:

```python
UniqueConstraint(
    fields=["workspace", "name", "scope"],
    condition=Q(deleted_at__isnull=True),
    name="custom_role_unique_ws_name_scope_active",
)
```

Both `WorkspaceMember` and `ProjectMember` carry an optional FK:

```python
custom_role = FK("db.CustomRole", null=True, blank=True,
                 on_delete=SET_NULL, related_name="(workspace|project)_members")
```

---

## 3. Migration history

- `0122_add_gac_models.py` — created `CustomRole`, `WorkspaceMember.custom_role`,
  `ProjectMember.custom_role`. (Also created the now-removed `PermissionScheme`
  - `CustomRoleScheme` tables; the field-level `schemes` M2M is gone.)
- `0123_drop_permission_schemes.py` — drops the scheme tables + their
  constraints; the `CustomRole` table is preserved.

When pulling this branch fresh:

```bash
python manage.py migrate
python manage.py seed_system_roles    # idempotent — seeds the six labels
```

---

## 4. API surface (`/api/workspaces/<slug>/...`)

| Method | Path                                         | Notes                                                                                |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `custom-roles/?scope=workspace\|project`     | Read access: any workspace member                                                    |
| POST   | `custom-roles/`                              | Admin only                                                                           |
| GET    | `custom-roles/<id>/`                         | Read access: any workspace member                                                    |
| PATCH  | `custom-roles/<id>/`                         | Admin only. System roles reject mutation.                                            |
| DELETE | `custom-roles/<id>/`                         | Admin only. Body `{"replacement_role_id": "<uuid>"}` reassigns members before delete |
| PATCH  | `members/<member_id>/`                       | Existing endpoint — body `{"custom_role": "<uuid>"\|null}`                           |
| PATCH  | `projects/<project_id>/members/<member_id>/` | Existing endpoint — body `{"custom_role": "<uuid>"\|null}`                           |

The DELETE endpoint preserves referential safety: omitting `replacement_role_id`
nulls out the FK on every affected member; supplying one points them to the
replacement role atomically inside a transaction.

`CustomRoleSerializer` exposes one computed field — `member_count` (sum of
active workspace + project members tagged with this role).

---

## 5. Permission boundaries

The only enforcement is _who can manage roles_:

| Action                              | Required role                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| List/get roles                      | Any workspace member                                                                   |
| Create / update / delete role       | Workspace Admin (built-in `role=20`)                                                   |
| Assign / unassign a role to member  | Workspace Admin (workspace member endpoint) or Project Admin (project member endpoint) |
| Edit / delete `is_system=True` role | Blocked at the view layer                                                              |

There is no authority-level comparison or guest-ceiling logic — those were
part of the abandoned enforcement story and would only confuse a metadata
feature. If a future feature needs them, layer them on top.

---

## 6. Seed labels (`seed_system_roles` management command)

Idempotent. Per workspace, creates six `CustomRole(is_system=True)` rows:

```
("Workspace Admin",  "workspace", authority_level=20)
("Workspace Member", "workspace", authority_level=15)
("Workspace Guest",  "workspace", authority_level=5)
("Project Admin",    "project",   authority_level=20)
("Project Member",   "project",   authority_level=15)
("Project Guest",    "project",   authority_level=5)
```

Run after every migration that touches workspaces (CI / fresh install / new
workspace). The command optionally takes `--workspace <slug>` to seed just one.

---

## 7. Frontend wiring

### Types — `packages/types/src/roles.ts`

```ts
export interface ICustomRole {
  id: string;
  workspace: string;
  name: string;
  description: string;
  scope: "workspace" | "project";
  is_system: boolean;
  authority_level: number;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ICustomRoleCreate {
  name: string;
  description?: string;
  scope: "workspace" | "project";
}
```

Also:

- `IWorkspaceMember.custom_role?: string | null`
- `TProjectMembership.custom_role?: string | null`

### Service — `apps/web/core/services/roles.service.ts`

`RolesService extends APIService` with: `listRoles`, `getRole`, `createRole`,
`updateRole`, `deleteRole`. **Important:** must use the cataloged
`API_BASE_URL` from `@plane/constants` — using `window.location.origin` would
hit the React Router app instead of Django.

### Store — `apps/web/core/store/roles.store.ts`

MobX store keyed by role id. All public methods are arrow class properties
(safe to destructure in components):

```ts
class RolesStore implements IRolesStore {
  customRoles: Record<string, ICustomRole>;
  isLoadingRoles: boolean;

  getRoleById = (id) => this.customRoles[id];
  get getRolesByScope() {
    return (scope) => Object.values(this.customRoles).filter((r) => r.scope === scope);
  }

  fetchRoles(slug, scope?): Promise<void>;
  fetchRole(slug, roleId): Promise<ICustomRole>;
  createRole(slug, data): Promise<ICustomRole>;
  updateRole(slug, roleId, data): Promise<ICustomRole>;
  deleteRole(slug, roleId, replacementRoleId?): Promise<void>;
}
```

Registered on `CoreRootStore.roles` and reset in `resetOnSignOut()`.

### Member stores

- `WorkspaceMember.updateMember(slug, userId, { role?, custom_role? })` — accepts either or both fields
- `ProjectMember.updateMemberCustomRole(slug, projectId, userId, customRoleId | null)` — separate action so it doesn't entangle with the existing `updateMemberRole` flow

`fetchWorkspaceMembers` and `getWorkspaceMemberDetails` carry `custom_role`
through the store. `getProjectMemberDetails` does the same for projects.

### Routes — `apps/web/app/routes/core.ts`

```
/:workspaceSlug/settings/roles                  → list
/:workspaceSlug/settings/roles/:roleId          → detail (edit name + description)
```

### Pages & components — `apps/web/core/components/roles/`

- `RolesList` — scope-filtered grid, create-role modal
- `RoleCard` — name, description, `member_count`, system badge; navigates to detail
- `RoleDetail` — meta + inline edit (name, description) for non-system roles
- `RoleDeleteModal` — replacement-role picker before destroy

The settings page exposes one scope toggle (Workspace | Project) and renders
`RolesList`. No content-tabs, no schemes panel.

### Member tables — assignment UI

- `apps/web/core/components/workspace/settings/member-columns.tsx` → `CustomRoleColumn` (workspace-scoped roles)
- `apps/web/core/components/project/settings/member-columns.tsx` → `CustomRoleColumn` (project-scoped roles)
- Both columns are wired in their respective `useMemberColumns` / `useProjectColumns` hooks.

Picker behaviour:

- Admin sees a `CustomSelect` listing all roles of the matching scope plus "— (no custom role)".
- Non-admin / current user / suspended user sees the label as plain text.
- Changes go through the store actions → service → backend `PATCH .../members/<id>/`.

### Settings nav

- `packages/constants/src/settings/workspace.ts` exposes `roles` under
  `GROUPED_WORKSPACE_SETTINGS.ADMINISTRATION` with `access: [ADMIN]`.
- Icon: `ShieldCheck` from `lucide-react`.

### i18n

All keys live under `workspace_settings.settings.roles.*` in every locale's
`workspace-settings.json`. Non-English locales use the English copy as a
placeholder until translated (consistent with the project's convention).
`pnpm --filter=@plane/i18n exec tsx scripts/sync-check.ts --ci` must pass.

---

## 8. End-to-end flow

1. Admin opens `/{slug}/settings/roles`, picks scope, creates a role
   (e.g. _"QA Reviewer"_, scope `project`).
2. Admin opens `/{slug}/projects/{projectId}/settings/members`, picks
   _QA Reviewer_ in the **Custom role** column for the relevant members.
3. The PATCH stores the FK; subsequent member listings carry the label.
4. Deleting _QA Reviewer_ prompts for a replacement role (or "none") so the
   FK never dangles.

---

## 9. Out-of-scope follow-ups

- Filter the member table by `custom_role` (server-side query param + UI filter).
- Show the custom role label next to the user's name in cross-feature UI
  (e.g. mention popovers, work-item assignee rows).
- Surface a per-role member list in `/settings/roles/{id}` (currently shows a
  count only).
- If real permission enforcement is ever needed, design that as a new feature
  using these labels as the assignment surface — do not re-add a `schemes` /
  `permissions` JSON field to `CustomRole`.

---

_Last revised: 2026-05-21_
