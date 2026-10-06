/* Every environment variable the app reads, in one place, so a missing
   value fails at startup with a name rather than deep inside a handler. */

export const DEMO_MODE = process.env.DEMO_MODE === 'true';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
/** The bot's @username without the @. Used in deeplinks and in the message
 *  the creator pastes to the fan, so a wrong value breaks the fan flow. */
export const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? '';

export const DATABASE_URL = process.env.DATABASE_URL ?? '';

export const BASE_RPC_URL = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
export const SERVER_PRIVATE_KEY = (process.env.SERVER_PRIVATE_KEY ?? '') as `0x${string}`;

/** Public origin of this server. Doppler reads `${APP_URL}/api/metadata/:id`
 *  as the token URI, so it must be reachable from the open internet. */
export const APP_URL = (process.env.APP_URL ?? '').replace(/\/$/, '');

export const DOPPLER_INDEXER_URL = process.env.DOPPLER_INDEXER_URL ?? 'https://indexer.doppler.lol';
/** Doppler's public token page, used in bot messages. Override for a fork. */
export const TOKEN_PAGE_BASE = process.env.TOKEN_PAGE_BASE ?? 'https://app.doppler.lol/tokens';

export const WEBHOOK_URL = process.env.WEBHOOK_URL ?? '';
export const PORT = parseInt(process.env.PORT ?? '3000', 10);

/** Launch budget for the single server wallet. See src/doppler/launch.ts. */
export const MIN_SERVER_BALANCE_WEI = BigInt(process.env.MIN_SERVER_BALANCE_WEI ?? '2000000000000000'); // 0.002 ETH
export const MAX_LAUNCHES_PER_CREATOR_PER_HOUR = parseInt(process.env.MAX_LAUNCHES_PER_CREATOR_PER_HOUR ?? '3', 10);

export function tokenPageUrl(tokenAddress: string): string {
  return `${TOKEN_PAGE_BASE}/${tokenAddress}`;
}

/** Called once from main(). Throws with the variable name when something
 *  required for the chosen mode is missing. */
export function assertConfig() {
  const missing: string[] = [];
  if (!BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  if (!BOT_USERNAME) missing.push('TELEGRAM_BOT_USERNAME');
  if (!DATABASE_URL) missing.push('DATABASE_URL');
  if (!DEMO_MODE) {
    if (!SERVER_PRIVATE_KEY) missing.push('SERVER_PRIVATE_KEY');
    if (!APP_URL) missing.push('APP_URL');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  }
}
