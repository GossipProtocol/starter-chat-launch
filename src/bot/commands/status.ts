import { Context } from 'grammy';
import { getChatsByCreator } from '../../db/chats';
import { getTokenMarketCapUsd } from '../../doppler/mc';

function progressBar(pct: number): string {
  const filled = Math.min(Math.round(pct / 10), 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export async function statusCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const chats = await getChatsByCreator(userId);
  if (chats.length === 0) {
    await ctx.reply('no active gates yet. run /lock @fan to create one');
    return;
  }

  const lines: string[] = [];

  for (const chat of chats) {
    let mc = Number(chat.current_mc_usd);

    if (chat.token_address && !chat.unlocked) {
      try {
        mc = await getTokenMarketCapUsd(chat.token_address);
      } catch {}
    }

    const pct = Math.min(Math.round((mc / chat.threshold_usd) * 100), 100);
    const thresholdK = chat.threshold_usd / 1000;

    const fanLabel = chat.fan_username ? `@${chat.fan_username}` : 'fan';
    if (chat.unlocked) {
      lines.push(`🔓 $${chat.ticker} (${fanLabel}), unlocked, closed to new buyers\nMC: $${mc.toLocaleString()}`);
    } else if (!chat.token_address) {
      lines.push(`⏳ $${chat.ticker} (${fanLabel}), deploying`);
    } else {
      lines.push(
        `🔒 $${chat.ticker} for ${fanLabel}\n` +
        `${progressBar(pct)} ${pct}%\n` +
        `MC: $${mc.toLocaleString()} / $${thresholdK}k`,
      );
    }
  }

  await ctx.reply(lines.join('\n\n'));
}
