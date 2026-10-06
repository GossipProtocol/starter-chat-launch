import { DopplerSDK, WAD } from '@whetstone-research/doppler-sdk/evm';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import {
  APP_URL,
  BASE_RPC_URL,
  DEMO_MODE,
  MIN_SERVER_BALANCE_WEI,
  SERVER_PRIVATE_KEY,
} from '../config';
import { COURSE_FEE_RECIPIENT, courseFeeConfigured, splitCreatorShares } from '../course-fee';

const WETH_BASE = '0x4200000000000000000000000000000000000006' as Address;

/* The server wallet.

   One hot wallet signs and pays gas for every launch the bot makes. That is
   the cheapest way to let a creator who holds no ETH launch from a chat
   message, and it is also the part of this app that can quietly drain. Two
   guards live here, and a third lives in the /lock handler:

   1. Balance floor. Before a launch we read the wallet's ETH balance and
      refuse when it is under MIN_SERVER_BALANCE_WEI, so a run of launches
      cannot leave the wallet unable to pay for the next one halfway through.
   2. One launch at a time. Nonce management across concurrent sends from a
      single key is where "replacement transaction underpriced" errors come
      from; the mutex below serialises launches instead.
   3. Per-creator rate limit (in lock.ts). A creator who can trigger an
      unbounded number of launches is spending your gas; the cap is a
      product decision, the default is three an hour.

   A multicurve create on Base costs on the order of a few million gas. Fund
   the wallet for the number of launches you expect in a day, and alert on
   the balance, because the bot cannot. */

function getServerAccount() {
  if (!SERVER_PRIVATE_KEY) throw new Error('SERVER_PRIVATE_KEY not set');
  return privateKeyToAccount(SERVER_PRIVATE_KEY);
}

async function getEthPrice(): Promise<number> {
  /* The SDK converts market cap targets into ticks, and that conversion
     needs the numeraire price in USD. A stale price shifts every curve, so
     the fallback below is a last resort that gets logged, not a default. */
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    );
    const data = (await res.json()) as { ethereum: { usd: number } };
    if (!data?.ethereum?.usd) throw new Error('bad response');
    return data.ethereum.usd;
  } catch (err) {
    console.warn('[launch] ETH price lookup failed, using fallback 3000:', err);
    return 3000;
  }
}

let launchChain: Promise<unknown> = Promise.resolve();

function serialised<T>(fn: () => Promise<T>): Promise<T> {
  const run = launchChain.then(fn, fn);
  launchChain = run.catch(() => undefined);
  return run;
}

export async function launchToken(
  launchId: string,
  ticker: string,
  creatorWallet: string,
): Promise<string> {
  if (DEMO_MODE) return demoLaunch(launchId);
  if (!courseFeeConfigured()) {
    throw new Error('COURSE_FEE_RECIPIENT is unset in src/course-fee.ts. Live launches refuse to run without it.');
  }
  return serialised(() => liveLaunch(launchId, ticker, creatorWallet));
}

async function liveLaunch(launchId: string, ticker: string, creatorWallet: string): Promise<string> {
  const account = getServerAccount();

  const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });
  const walletClient = createWalletClient({ chain: base, transport: http(BASE_RPC_URL), account });

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance < MIN_SERVER_BALANCE_WEI) {
    throw new Error(`server wallet ${account.address} is under the balance floor (${balance} wei)`);
  }

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id });
  const ethPrice = await getEthPrice();

  /* Fee beneficiaries. The multicurve pool is created locked (noOp
     migration), so swap fees never leave the pool except through this list.
     The initializer requires the shares to sum to exactly WAD and the
     protocol owner to hold at least 5%. The SDK fetches the owner and the
     5% share; the remaining 95% is split between the creator and the course
     wallet by src/course-fee.ts. Anyone can call collectFees on the pool
     later and each beneficiary receives its share. */
  const protocolOwner = await sdk.getAirlockBeneficiary();
  const { creator, course } = splitCreatorShares(WAD - protocolOwner.shares);

  const beneficiaries = [
    protocolOwner,
    { beneficiary: COURSE_FEE_RECIPIENT, shares: course },
    { beneficiary: creatorWallet as Address, shares: creator },
  ];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: `${ticker} Pass`,
      symbol: ticker.toUpperCase(),
      /* The token URI is a URL on this server, resolved by the metadata
         endpoint in src/web/index.ts. Doppler's indexer and front end fetch
         it when they first see the token, which means the chat row must be
         in the database before the create transaction is sent. The /lock
         handler inserts the row first for that reason. */
      tokenURI: `${APP_URL}/api/metadata/${launchId}`,
    })
    .saleConfig({
      /* The whole supply goes on the curve. Anything held back here would
         go to the governance recipient, which under noOp governance is a
         burn, so holding back is a silent supply cut and not a treasury. */
      initialSupply: parseEther('1000000000'),
      numTokensToSell: parseEther('1000000000'),
      numeraire: WETH_BASE,
    })
    .withCurves({
      numerairePrice: ethPrice,
      /* Three contiguous curves by market cap, plus the open-ended tail the
         SDK requires. Half the supply sits between $5k and $50k so the
         thresholds this bot offers are reachable with modest buying. */
      curves: [
        { marketCap: { start: 5_000, end: 50_000 }, numPositions: 10, shares: parseEther('0.5') },
        { marketCap: { start: 50_000, end: 500_000 }, numPositions: 10, shares: parseEther('0.4') },
        { marketCap: { start: 500_000, end: 'max' }, numPositions: 1, shares: parseEther('0.1') },
      ],
      beneficiaries,
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .withIntegrator(COURSE_FEE_RECIPIENT)
    .build();

  const result = await sdk.factory.createMulticurve(params);
  return result.tokenAddress;
}

/* Demo mode returns a deterministic pseudo address derived from the launch
   id so the rest of the flow (deeplink, metadata endpoint, poller, unlock
   messages) can be exercised with no wallet and no gas. */
function demoLaunch(launchId: string): string {
  const hex = launchId.replace(/-/g, '').padEnd(40, '0').slice(0, 40);
  return `0x${hex}`;
}
