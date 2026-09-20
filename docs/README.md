# MobileflowRN docs

Configure OAuth with `.env` (see `.env.example` and the README bootstrap section). The client secret never ships in the app.

## Feature slice

| Area | Entry points |
|------|----------------|
| Durable storage | `createAppKeyValueStore()` (AsyncStorage) for Activity, rate limits, agent instructions |
| Site Health | Home → Health score → `SiteHealthSheet` (SEO, CMS, assets) |
| Batch SEO | Health findings → `BatchMetadataReviewSheet` |
| CMS | Content → CMS → search, status filter, pagination, item publish |
| Forms | Content → Forms → `FormsInbox` |
| Comments | Content → Comments → `CommentsInbox` |
| Locales | Home locale list; Content page filter; Site Health locale finding |
| Analyze | Home Analyze card via MCP `data_analyze_tool` when the add-on is present |
| Agent instructions | Settings → per-site device-local text |
| Planner context | Command sheet + `buildBoundedPlannerContextJSON` |
| Revert | Activity rows with `changes` → Revert |
| Designer context | Advanced → headless MCP 2.x tools (variables / component props) plus optional live Designer session |

Also see: `design-system.md`, `on-device-planner.md`, `live-oauth-verify.md`.
