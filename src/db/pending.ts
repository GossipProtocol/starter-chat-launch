import { pool } from './index';

/* Pending conversational state.

   /setup and /lock are two-step conversations: the bot asks a question or
   shows buttons, and the answer arrives as a separate Telegram update. The
   original product kept the half-finished step in an in-memory Map, which
   meant every deploy or crash silently forgot everyone mid-flow and the
   button they were looking at stopped working with no explanation.

   This table is the fix. One row per (telegram user, flow), a JSON payload
   for the step data, and an expiry so stale rows never trap a user. It is
   a few lines more than a Map and it survives restarts and horizontal
   scaling, which a Map never will. */

export type PendingKind = 'setup' | 'lock';

export async function setPending<T extends object>(
  userId: number,
  kind: PendingKind,
  payload: T,
  ttlMs: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO pending_state (telegram_user_id, kind, payload, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 || ' milliseconds')::interval)
     ON CONFLICT (telegram_user_id, kind)
     DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
    [userId, kind, JSON.stringify(payload), String(ttlMs)],
  );
}

/** Returns the payload, or null when there is none or it has expired.
 *  Expired rows are deleted on read so the table stays small. */
export async function getPending<T extends object>(userId: number, kind: PendingKind): Promise<T | null> {
  const { rows } = await pool.query(
    `SELECT payload, expires_at < NOW() AS expired
       FROM pending_state
      WHERE telegram_user_id = $1 AND kind = $2`,
    [userId, kind],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.expired) {
    await clearPending(userId, kind);
    return null;
  }
  return row.payload as T;
}

export async function clearPending(userId: number, kind: PendingKind): Promise<void> {
  await pool.query(
    'DELETE FROM pending_state WHERE telegram_user_id = $1 AND kind = $2',
    [userId, kind],
  );
}
