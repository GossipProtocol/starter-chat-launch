import { DEMO_MODE, DOPPLER_INDEXER_URL } from '../config';

/* Threshold metric.

   The bot talks about "market cap" because that is the word creators and
   fans use, but what this function returns is the indexer's
   `pool.dollarLiquidity`: the USD value of the numeraire and asset sitting
   in the pool. During the curve phase it tracks buying pressure closely and
   it is one field, one query, no price maths. It is not price times supply.
   On the open-ended tail curve the two diverge, and a thin pool with a high
   spot price would read low here. Swapping this for a true market cap
   (pool price times the 1B supply) is the first exercise in the module and
   a two line change once you have decided which number you want to gate on.

   Polling the indexer rather than watching chain events is a deliberate
   trade: the indexer already aggregates swaps across the pool's positions
   and prices them in USD, and a 30 second lag is invisible in a Telegram
   chat. The poller in src/poller/index.ts calls this once per locked chat
   per tick, so keep it cheap and keep it returning 0 on any failure; a
   thrown error there would stall every other chat's check. */

interface TokenData {
  address: string;
  volumeUsd: string;
  pool: { price: string; dollarLiquidity: string } | null;
}

export async function getTokenMarketCapUsd(tokenAddress: string): Promise<number> {
  if (DEMO_MODE) return demoLiquidity(tokenAddress);

  const query = `
    query TokenMC($id: String!) {
      token(id: $id) {
        address
        volumeUsd
        pool {
          price
          dollarLiquidity
        }
      }
    }
  `;

  try {
    const res = await fetch(`${DOPPLER_INDEXER_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: tokenAddress.toLowerCase() },
      }),
    });

    if (!res.ok) {
      console.error('[mc] Doppler indexer HTTP error:', res.status);
      return 0;
    }

    const json = await res.json() as { data?: { token?: TokenData } };
    const token = json.data?.token;

    if (!token?.pool?.dollarLiquidity) return 0;

    return parseFloat(token.pool.dollarLiquidity);
  } catch (err) {
    console.error('[mc] Doppler indexer error:', err);
    return 0;
  }
}

/* Demo mode: a figure that climbs about $1k every 30 seconds from the
   moment the process started, so a $5k lock unlocks in a few minutes and
   you can watch the whole flow without a chain. */
const demoStart = Date.now();
function demoLiquidity(tokenAddress: string): number {
  const seed = parseInt(tokenAddress.slice(2, 6), 16) % 500;
  const elapsedTicks = (Date.now() - demoStart) / 30_000;
  return Math.round(seed + elapsedTicks * 1000);
}
