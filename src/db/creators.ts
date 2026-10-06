import { pool } from './index';

export interface Creator {
  id: number;
  telegram_user_id: number;
  telegram_username: string | null;
  twitter_username: string;
  wallet_address: string;
  created_at: Date;
}

export async function getCreator(telegramUserId: number): Promise<Creator | null> {
  const { rows } = await pool.query(
    'SELECT * FROM creators WHERE telegram_user_id = $1',
    [telegramUserId],
  );
  return rows[0] ?? null;
}

export async function getCreatorByUsername(username: string): Promise<Creator | null> {
  const { rows } = await pool.query(
    'SELECT * FROM creators WHERE LOWER(telegram_username) = LOWER($1)',
    [username],
  );
  return rows[0] ?? null;
}

export async function createCreator(
  telegramUserId: number,
  telegramUsername: string | null,
  twitterUsername: string,
  walletAddress: string,
): Promise<Creator> {
  const { rows } = await pool.query(
    `INSERT INTO creators (telegram_user_id, telegram_username, twitter_username, wallet_address)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [telegramUserId, telegramUsername, twitterUsername, walletAddress],
  );
  return rows[0];
}
