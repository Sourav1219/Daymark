# Components

Shared presentation components live here. `ui/` owns shadcn source, `shell/` composes the authenticated responsive frame, and `system/` contains reusable branded states and headings. Feature-specific components stay inside their feature and may depend on these layers; shared components never import a feature repository or the database.
