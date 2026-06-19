# Multi-Tenant Tracker Comparison Checklist

| Check | Demo Site 1 (e-commerce) | Demo Site 2 (bookstore) |
|---|---|---|
| Session ID format consistent | **PASS when** value is stable per tab/session and UUID-like (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`) | **PASS when** same format and lifecycle behavior observed in `sessionStorage` (`cja_session_id`) |
| `site_id` correctly tagged | **PASS when** all e-commerce events use site_id for site 1 (e.g., `default_site` or configured tenant id) | **PASS when** all events use `demo_bookstore_002` |
| Funnel stages detected correctly | **PASS when** static funnel pages map to expected increasing stages | **PASS when** `/book/:id` is detected via `/book/` prefix as stage 0, then `/cart`→1, `/checkout`→2, `/order-confirmed`→3 |
| No JS console errors | **PASS when** no uncaught exceptions while browsing and interacting | **PASS when** no uncaught exceptions with `debug: true` logs visible |
| `sendBeacon` fires on tab close | **PASS when** pending events flush on close/navigation away | **PASS when** pending events flush on close/navigation away |
| Events batch correctly (3s or 10 events) | **PASS when** flush occurs on interval or immediate on queue size >= 10 | **PASS when** same flush triggers observed in `[CJA]` debug logs |

## Expected evidence for Demo Site 2

- Console shows `[CJA] tracker started` with:
  - `site_id: demo_bookstore_002`
  - `funnel: ["/book/", "/cart", "/checkout", "/order-confirmed"]`
- Database `events` table contains rows where:
  - `site_id = 'demo_bookstore_002'`
  - `page_url` spans `/`, `/book/101`, `/cart`, `/checkout`, `/order-confirmed`
  - `event_type` includes `page_view`, `click`, `scroll`, `mouse_move`, `funnel_stage`
- No rows for bookstore URLs under `site_id = 'default_site'` (or other tenant ids).
