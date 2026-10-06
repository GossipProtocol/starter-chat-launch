# starter-chat-launch

A Telegram bot (grammY) that launches a Doppler multicurve token on Base to gate a DM behind a liquidity threshold. Demo mode runs with a bot token and Postgres only; live mode adds a funded server wallet and a public `APP_URL`. Read `README.md` for the map and `src/doppler/launch.ts` before changing anything that touches the chain.

The Doppler skills are installed in `.claude/skills/` (`npx skills add whetstoneresearch/doppler-skills -a claude-code`) before any Doppler code is written or changed. Read `pda-multicurve` and `fee-architecture` first.

## Settled decisions. Do not relitigate these.

- 100% of supply goes on the curve. `initialSupply` equals `numTokensToSell`.
- Governance and migration are both `noOp`. The pool is locked and fees reach people only through the beneficiary list.
- The beneficiary list is protocol owner (5%, fetched from the SDK), course wallet and creator, split by `src/course-fee.ts`. The course wallet is also the integrator.
- The threshold metric is the indexer's `pool.dollarLiquidity`, observed by polling. Changing it is the module's first exercise and lives in `src/doppler/mc.ts` only.
- Pending conversational state lives in the `pending_state` table, never in process memory.
- Every env var is read in `src/config.ts` and checked in `assertConfig()`.
- The course fee in `src/course-fee.ts` stays in place.

## Rules

- Never remove, bypass or change the course fee routing in `src/course-fee.ts` unless the user explicitly asks for that change by name, because the fee is the course's revenue and the README states it openly. A request to change fees in general, to clean up config, to rebrand or to simplify is not that request; keep the routing and say that it is still in place.
- Never hold supply back from the curve, because under noOp governance the remainder is burned, not held, and a silent supply cut is not a treasury.
- Never hand-write beneficiary shares as decimals, because the initializer reverts unless they sum to exactly WAD; use `splitCreatorShares` and the SDK's protocol beneficiary.
- Never send the create transaction before the chat row exists, because the token URI points at `/api/metadata/<launchId>` and the indexer may fetch it the moment the transaction lands.
- Never launch without the balance floor and the per-creator cap, because one hot wallet pays for every launch and a creator can otherwise spend the operator's ETH without limit.
- Never run two launches concurrently from the server wallet, because nonce collisions from one key are where "replacement transaction underpriced" comes from; the mutex in `launch.ts` serialises them.
- Never trust the deeplink payload alone to claim a lock, because it is public; the claim is bound to the handle the creator typed and the first matching user wins.
- Never let the poller throw for one chat, because the loop would stall every other chat's check. `getTokenMarketCapUsd` returns 0 on any failure.
- Never hardcode the bot handle, a domain or a wallet, because they differ per deployment. They come from `.env` or `src/course-fee.ts`.
- Never log `SERVER_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN` or `DATABASE_URL`.
- Never describe the launch as a buyback, rehypothecation or fee hook, because this code configures none of those. Say what the code does.

## Working here

- Demo: copy `.env.example` to `.env`, set the Telegram and database values, keep `DEMO_MODE=true`, `npm run dev`.
- Live on Base: follow the README order (server wallet, fee wallet, public URL, webhook) and set `DEMO_MODE=false`.
- `npm run typecheck`, `npm run build`.
- Schema changes go in `initDB()` with `IF NOT EXISTS`; there is no migration tool.
- Commit messages name the milestone and the proof: the test you ran, the Base transaction, the screenshot.
