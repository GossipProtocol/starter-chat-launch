# starter-chat-launch

A Telegram bot that launches a Doppler token on Base to put a price on a conversation. A creator runs `/lock @fan`, the bot launches a token through Doppler's multicurve auction with the creator as a fee beneficiary, and the fan has to buy the token up to a threshold before the bot tells both sides the chat is open. This is the chat launch starter from the course, cut down from a bot that ran with real launches.

It runs in two modes:

- **Demo mode** (`DEMO_MODE=true`): a Telegram bot token and a Postgres database, nothing else. Launches return a pseudo address and the threshold metric climbs on a timer, so `/setup`, `/lock`, the deeplink, the metadata endpoint and the unlock messages all work end to end with no wallet and no gas.
- **Live mode**: a funded server wallet on Base, a public `APP_URL` for token metadata, and real launches through the Doppler SDK with the poller reading the Doppler indexer.

## The fee, stated plainly

Every token this bot launches streams its pool fees to a beneficiary list that Doppler enforces on chain. The split is **protocol owner 5%, course wallet 9.5%, creator 85.5%**. The course share is 10% of what would otherwise be the creator's 95%, and the rate (`COURSE_FEE_BPS`) and recipient (`COURSE_FEE_RECIPIENT`) live in one file, `src/course-fee.ts`. The course wallet is also recorded as the launch's Doppler integrator, which on a locked pool is attribution only; the beneficiary share is what pays. Live mode refuses to start while the recipient is the zero address.

The fee is a default, not a license condition. This code is MIT licensed, so you can change it. If you change the recipient or the rate, say so in your README.

## What the token actually does

The honest version, because the original pitch said more than the code did:

- The launch is a plain Doppler multicurve with **100% of supply on the curve**, no governance and no migration. The pool is created locked, so its liquidity never leaves and nobody holds an LP position to pull.
- Swap fees in the locked pool accrue to the beneficiary list above. Anyone can call `collectFees` on the pool and each beneficiary receives its share. There is no buyback, no rehypothecation and no fee hook; adding the Rehype hook is a capstone option, not something this code does.
- The "market cap" the bot gates on is the indexer's `pool.dollarLiquidity`, the USD value sitting in the pool. It tracks buying closely during the curve phase and it is one field in one query, but it is not price times supply. `src/doppler/mc.ts` says so in the comment, and switching it is the module's first exercise.
- Unlocking is a message. The bot tells the creator and the fan that the threshold was crossed; it does not and cannot open a Telegram chat. The creator still has to reply.

## What is in the box

| Area | Where | What it teaches |
|------|-------|-----------------|
| Launch | `src/doppler/launch.ts` | The multicurve builder: token config with a metadata URI, 100% of supply on three curves plus the max tail, beneficiaries that sum to WAD, noOp governance and migration, the integrator field. |
| Course fee | `src/course-fee.ts` | The beneficiary split in one place, with exact bigint maths so the shares always sum to WAD. |
| Server wallet | `src/doppler/launch.ts`, `src/bot/commands/lock.ts` | One hot wallet pays for every launch. A balance floor, a launch mutex and a per-creator hourly cap keep it from draining. |
| Threshold events | `src/poller/index.ts`, `src/doppler/mc.ts` | Nothing on chain fires when a pool crosses $10k, so the poller asks the indexer every 30 seconds and unlocks exactly once. |
| Metadata | `src/web/index.ts` | The token URI is a route on this server backed by the database, which is why the chat row is written before the create transaction is sent. |
| Deeplinks | `src/bot/commands/lock.ts`, `src/bot/commands/start.ts` | `t.me/<bot>?start=lock_<id>` is how a bot learns who the fan is. The claim is bound to the handle the creator typed and the first match wins. |
| Pending state | `src/db/pending.ts` | Two-step conversations survive a restart because the half-finished step is a row, not a Map entry. |
| Config | `src/config.ts`, `.env.example` | Every variable the app reads, checked at boot so a missing one fails with its name. |
| Schema | `src/db/index.ts` | Three tables created on boot. The unique index on `UPPER(ticker)` is the real guard against duplicate tickers. |
| Landing page | `public/index.html` | A static page with the bot link as a placeholder. |

## Run it in demo mode

1. Create a bot with [@BotFather](https://t.me/BotFather) and note the token and the username.
2. Start a Postgres database (local is fine).
3. Copy `.env.example` to `.env`, fill in `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `DATABASE_URL`, and leave `DEMO_MODE=true`.

```bash
npm install
npm run dev
```

DM the bot `/setup`, then `/lock @somefriend`, pick `$5k`, and paste the message it gives you to your friend. When they open the deeplink they are attached to the lock, and within a few minutes the demo metric crosses the threshold and both of you get the unlock message.

## Install the Doppler skills

Before touching any Doppler code, install the skills into `.claude/skills/`:

```bash
npx skills add whetstoneresearch/doppler-skills -a claude-code
```

`pda-multicurve`, `fee-architecture` and `verification` are the ones this starter uses.

## Go live on Base

1. **Server wallet.** Generate a fresh key, fund it with ETH on Base (a multicurve create is a few million gas, so budget for the number of launches you expect in a day), and set `SERVER_PRIVATE_KEY`. Keep it out of git and out of chat.
2. **Fee wallet.** `src/course-fee.ts` already carries the course fee recipient. Leave it as it is.
3. **Public URL.** Deploy the web server somewhere with a public origin and set `APP_URL`. Doppler fetches `${APP_URL}/api/metadata/<launchId>` as the token URI, so it must resolve from the open internet. Put a token image at `${APP_URL}/token-image.png`.
4. **Webhook (optional).** Set `WEBHOOK_URL` to the same origin and the bot registers `${WEBHOOK_URL}/webhook` on boot instead of long polling.
5. Set `DEMO_MODE=false` and start.

## How a live lock works

```
creator                       bot                                   chain / indexer
  /setup ->                   store twitter + fee wallet
  /lock @fan $TICK ->         validate ticker, check uniqueness
                              save pending lock (db row, 5 min ttl)
  tap $10k ->                 rate limit, insert chat row
                              build multicurve params
                              100% supply, beneficiaries, integrator
                              createMulticurve ----------------------> Airlock.create
  <- CA, deeplink, tweet      store token address
  paste to fan
fan
  open deeplink ->            /start lock_<id>: handle must match
                              attach fan id to chat (first wins)
                              every 30s: dollarLiquidity? ---------> indexer
                              >= threshold: mark unlocked once
  <- "you're in"              message creator and fan
```

## What is left for you

The persistent pending store, the gas guards and the fee split are complete. The first milestone of the module is replacing the threshold metric in `src/doppler/mc.ts` with a true market cap (pool price from the indexer times the 1B supply) and deciding, in writing, which number your product should gate on. The capstone is a bot of your own on a theme that is not DMs: a group chat that unlocks, a drop that ships, a reply that gets written, with real launches on Base, the Rehype hook routing a share of fees to a buyback, and a one-page note on how the creator actually gets paid.

## Legal note

A token whose stated purpose is access to a person reads as a security or a consumer-protection problem in some jurisdictions, and a creator who never replies has sold nothing. Say in the metadata and in the bot what the token does and does not promise, and talk to counsel before mainnet. The course covers this in Module 1.

## Course

Consumer Layer, the course this starter is taught in, covers it in Module 1, with the Doppler skills installed from Module 0 onward. The course plugin's `chat-launch` skill coaches each milestone and the `review` skill checks your fork against the module checklist.
