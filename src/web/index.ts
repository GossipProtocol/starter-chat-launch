import express from 'express';
import path from 'path';
import { bot } from '../bot';
import { webhookCallback } from 'grammy';
import { getChatByLaunchId } from '../db/chats';
import { APP_URL, PORT, WEBHOOK_URL } from '../config';

export function startWebServer() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../public')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
  });

  /* Token metadata. The token's tokenURI points here, so this is what the
     Doppler front end, the indexer and wallets show for the token. It is
     served from the database rather than pinned to IPFS because the ticker
     and threshold are known only at /lock time and the row exists before
     the create transaction is sent. Keep the shape (name, symbol,
     description, external_url, image) because that is what the indexer
     reads. Serve a real image from APP_URL; the placeholder path below is
     yours to fill. */
  app.get('/api/metadata/:id', async (req, res) => {
    const chat = await getChatByLaunchId(req.params.id);
    if (!chat) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    res.json({
      name: `${chat.ticker} Pass`,
      symbol: chat.ticker.toUpperCase(),
      description: `Unlock DMs. Pump $${chat.ticker.toUpperCase()} to reach the threshold.`,
      external_url: APP_URL,
      image: `${APP_URL}/token-image.png`,
    });
  });

  if (WEBHOOK_URL) {
    app.use('/webhook', webhookCallback(bot, 'express'));
  }

  app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
  });
}
