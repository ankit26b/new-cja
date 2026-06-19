# Demo Bookstore Tracker Validation (Manual)

This checklist validates tracker portability and tenant isolation using `site_id = demo_bookstore_002`.

## 1) Start services

1. Start backend API on `http://localhost:5000` (or adjust config to actual port).
2. Ensure PostgreSQL is running.
3. Serve `demo-bookstore` with any static server so routes resolve cleanly.

Example (Node http-server):

```bash
cd demo-bookstore
npx http-server -p 8088 -c-1 --proxy http://localhost:8088?
```

Open `http://localhost:8088`.

## 2) Verify tracker loads and config is applied

1. Open DevTools Console.
2. Confirm `[CJA] tracker started` appears.
3. Confirm logged config includes:
   - `site_id: demo_bookstore_002`
   - `funnel: ["/book/", "/cart", "/checkout", "/order-confirmed"]`

Expected: no JavaScript errors from tracker.

## 3) Perform full funnel interaction

In one browser tab, follow this exact path:

1. `/` (home)
2. `/book/101`
3. `/cart`
4. `/checkout`
5. `/order-confirmed`

On each page:

- Click at least once
- Scroll at least once
- Move mouse for ~1 second

Expected debug logs:

- `page_view` events on each page
- `funnel_stage` event on `/book/101` as stage `0`
- `funnel_stage` event on `/cart` as stage `1`
- `funnel_stage` event on `/checkout` as stage `2`
- `funnel_stage` event on `/order-confirmed` as stage `3`

## 4) Verify batch and unload behavior

1. Stay on a page and create >10 interactions quickly.
   - Expected: immediate flush due to batch-size trigger.
2. Interact lightly and wait ~3 seconds.
   - Expected: interval-based flush.
3. Interact once, then close tab quickly.
   - Expected: final batch sent via `sendBeacon`.

## 5) Verify database isolation

Run SQL (table is `events` in this codebase):

```sql
SELECT site_id, event_type, COUNT(*)::int AS count
FROM events
WHERE site_id IN ('demo_bookstore_002', 'default_site')
GROUP BY site_id, event_type
ORDER BY site_id, event_type;
```

```sql
SELECT page_url, event_type, COUNT(*)::int AS count
FROM events
WHERE site_id = 'demo_bookstore_002'
GROUP BY page_url, event_type
ORDER BY page_url, event_type;
```

Expected:

- `demo_bookstore_002` events exist for all tested event types.
- No bookstore page URLs (like `/book/101`) appear under `default_site`.
- Funnel stage progression appears as 0 â†’ 1 â†’ 2 â†’ 3 in bookstore session data.

