import { Pool } from 'pg';
import { DATABASE_URL } from '../config';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

/* The schema is created on boot with IF NOT EXISTS so a fresh database
   needs no migration step. Three tables: creators (who may lock), chats
   (one row per launched token and the fan it gates), and pending_state
   (half-finished /setup and /lock conversations, see src/db/pending.ts). */
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS creators (
      id SERIAL PRIMARY KEY,
      telegram_user_id BIGINT UNIQUE NOT NULL,
      telegram_username TEXT,
      twitter_username TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      launch_id TEXT UNIQUE NOT NULL,
      chat_id BIGINT UNIQUE NOT NULL,
      creator_telegram_id BIGINT NOT NULL REFERENCES creators(telegram_user_id),
      fan_telegram_id BIGINT,
      fan_username TEXT,
      ticker TEXT NOT NULL,
      token_address TEXT,
      threshold_usd INTEGER NOT NULL,
      current_mc_usd NUMERIC(20, 2) DEFAULT 0,
      unlocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      launched_at TIMESTAMPTZ,
      unlocked_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_unlocked ON chats(unlocked) WHERE unlocked = FALSE;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_creator ON chats(creator_telegram_id);
  `);

  // Tickers are unique across the whole bot, case-insensitive. The /lock
  // handler checks before launching, and this index is the real guarantee.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_ticker_unique
    ON chats (UPPER(ticker));
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_state (
      telegram_user_id BIGINT NOT NULL,
      kind TEXT NOT NULL,
      payload JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (telegram_user_id, kind)
    );
  `);

  console.log('Database initialized');
}
