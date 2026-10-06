import 'dotenv/config';
import { assertConfig, DEMO_MODE, WEBHOOK_URL } from './config';
import { courseFeeConfigured } from './course-fee';
import { initDB } from './db';
import { startBot, bot } from './bot';
import { startPoller } from './poller';
import { startWebServer } from './web';

async function main() {
  console.log(`Starting in ${DEMO_MODE ? 'DEMO' : 'LIVE'} mode...`);

  assertConfig();
  if (!DEMO_MODE && !courseFeeConfigured()) {
    throw new Error(
      'COURSE_FEE_RECIPIENT in src/course-fee.ts is still the zero address. ' +
      'Live mode refuses to start without it. Set DEMO_MODE=true to run without a chain.',
    );
  }

  await initDB();
  startPoller();
  startWebServer();

  if (WEBHOOK_URL) {
    /* Webhook mode: Telegram pushes updates to `${WEBHOOK_URL}/webhook`,
       served by src/web/index.ts. Register the URL once with
       `bot.api.setWebhook`; long polling and webhooks cannot both be on. */
    await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log(`Webhook mode: ${WEBHOOK_URL}/webhook`);
  } else {
    await startBot();
  }

  console.log('Bot is live');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
