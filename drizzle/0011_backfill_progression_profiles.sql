insert into "user_progression" ("workspace_id", "user_id")
select "workspace_members"."workspace_id", "workspace_members"."user_id"
from "workspace_members"
inner join "workspaces"
  on "workspaces"."id" = "workspace_members"."workspace_id"
  and "workspaces"."deleted_at" is null
inner join "users"
  on "users"."id" = "workspace_members"."user_id"
where "workspace_members"."deleted_at" is null
on conflict ("workspace_id", "user_id") do nothing;
