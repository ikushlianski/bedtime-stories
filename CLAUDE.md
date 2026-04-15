# bedtime-agent

## Database

### Neon 
The production Neon database lives in org **org-red-darkness-12395804** ("Ilya").

When using Neon MCP tools, always pass `org_id: "org-red-darkness-12395804"`.

Console: https://console.neon.tech/app/org-red-darkness-12395804/projects

### Migrations

Never apply migrations by hand. Always use dedicated commands in package.json files in one of the packages to execute migrations.

Run migrations with: `npm run db:migrate` from the project root.

Never use `drizzle-kit migrate` directly — it uses the `pg` driver which hangs on Neon. The `db:migrate` script uses the neon-http driver instead.