# Reminders

Owns RFC recurrence and IANA timezone conversion, persisted user settings,
authorized reminder schedules, in-app notifications, authenticated Web Push
subscriptions, idempotent job processing, capped retries, and cancellation.

The reminder inbox is mounted as a bell only on Home and as an always-visible panel in Settings. It is a live urgency list containing only signed-in workspace tasks that are open, not deleted, due in the future, and have less than 30 minutes remaining. It refreshes server data every 30 seconds so tasks enter and leave the window without a page reload; deadline alerts are acknowledged in local browser storage. Persisted reminder deliveries remain available to delivery infrastructure but are not mixed into this urgency UI.

The scheduled Route Handler depends on a delivery-provider interface. Production may configure the Resend adapter; tests inject a fake and never send real email. Repository claiming rechecks current workspace membership and Quest state, uses bounded row locks plus a recovery lease, and records one delivery side effect per idempotency key.

When all three VAPID environment values are configured, the app requests device
permission from the sign-up gesture (or the next interaction for an existing
account) and registers the browser automatically. Delivered `in_app` reminders
fan out to those subscriptions, so push mirrors an existing notification rather
than introducing another alert stream. Expired endpoints are removed
automatically; push failure never removes the durable in-app reminder.
