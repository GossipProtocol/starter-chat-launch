import { Bot } from 'grammy';
import { BOT_TOKEN } from '../config';
import { setupCommand, handleSetupInput } from './commands/setup';
import { lockCommand, handleLockCallback } from './commands/lock';
import { statusCommand } from './commands/status';
import { verifyCommand } from './commands/verify';
import { startCommand } from './commands/start';

export const bot = new Bot(BOT_TOKEN);

bot.command('start', startCommand);
bot.command('setup', setupCommand);
bot.command('lock', lockCommand);
bot.command('status', statusCommand);
bot.command('verify', verifyCommand);

bot.on('callback_query:data', async (ctx) => {
  const handled = await handleLockCallback(ctx);
  if (!handled) {
    await ctx.answerCallbackQuery();
  }
});

bot.on('message:text', async (ctx) => {
  if (await handleSetupInput(ctx)) return;
});

export async function startBot() {
  console.log('Bot starting (long polling)...');
  bot.start();
}
