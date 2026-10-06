import { Context } from 'grammy';
import { getCreator, createCreator } from '../../db/creators';
import { clearPending, getPending, setPending } from '../../db/pending';
import { BOT_USERNAME } from '../../config';

interface PendingSetup {
  step: 'twitter' | 'wallet';
  twitterUsername?: string;
}

const SETUP_TTL_MS = 30 * 60 * 1000;

export async function setupCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply(`DM me to set up: @${BOT_USERNAME}`);
    return;
  }

  const existing = await getCreator(userId);
  if (existing) {
    await ctx.reply(
      `already set up\n\n` +
      `Twitter: @${existing.twitter_username}\n` +
      `Wallet: \`${existing.wallet_address}\``,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  await setPending<PendingSetup>(userId, 'setup', { step: 'twitter' }, SETUP_TTL_MS);
  await ctx.reply("what's your Twitter/X username? (without the @)");
}

export async function handleSetupInput(ctx: Context) {
  const userId = ctx.from?.id;
  const telegramUsername = ctx.from?.username ?? null;
  if (!userId) return false;
  if (ctx.chat?.type !== 'private') return false;

  const pending = await getPending<PendingSetup>(userId, 'setup');
  if (!pending) return false;

  const text = ctx.message?.text?.trim();
  if (!text) return false;

  if (pending.step === 'twitter') {
    const twitterUsername = text.replace(/^@/, '');
    await setPending<PendingSetup>(userId, 'setup', { step: 'wallet', twitterUsername }, SETUP_TTL_MS);
    await ctx.reply(
      `got it, @${twitterUsername}\n\n` +
      'now enter your Base wallet address (0x...) where fees will go:',
    );
    return true;
  }

  if (pending.step === 'wallet') {
    const wallet = text.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      await ctx.reply("doesn't look like a valid address. enter a 0x... wallet:");
      return true;
    }

    const twitterUsername = pending.twitterUsername!;
    await clearPending(userId, 'setup');

    await createCreator(userId, telegramUsername, twitterUsername, wallet);

    await ctx.reply(
      `connected\n\n` +
      `Twitter: @${twitterUsername}\n` +
      `Wallet: \`${wallet}\`\n\n` +
      `when someone DMs you, come back here and run /lock @theirhandle ` +
      `to mint a gate token. i'll give you a message to paste in your chat with them.`,
      { parse_mode: 'Markdown' },
    );
    return true;
  }

  return false;
}
