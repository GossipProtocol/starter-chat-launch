import { Context } from 'grammy';
import { getChatByTicker } from '../../db/chats';
import { getCreator } from '../../db/creators';
import { normalizeTicker } from '../../utils/ticker';

export async function verifyCommand(ctx: Context) {
  const text = ctx.message?.text ?? '';
  const arg = text.replace(/^\/verify(?:@\w+)?\s*/i, '').trim();
  if (!arg) {
    await ctx.reply('usage: /verify $TICKER');
    return;
  }

  const ticker = normalizeTicker(arg);
  const chat = await getChatByTicker(ticker);

  if (!chat) {
    await ctx.reply(`$${ticker} is not a token this bot launched.`);
    return;
  }

  const creator = await getCreator(chat.creator_telegram_id);
  const status = chat.unlocked
    ? '🔓 unlocked (closed to new buyers)'
    : chat.token_address
    ? '🔒 active'
    : '⏳ deploying';

  const lines = [
    `$${chat.ticker}: verified, launched by this bot`,
    ``,
    `creator: @${creator?.telegram_username ?? creator?.twitter_username ?? 'unknown'}`,
    `fan: @${chat.fan_username ?? 'anonymous'}`,
    `status: ${status}`,
  ];
  if (chat.token_address) lines.push(`CA: \`${chat.token_address}\``);
  if (chat.threshold_usd) lines.push(`threshold: $${(chat.threshold_usd / 1000).toFixed(0)}k mc`);

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}
