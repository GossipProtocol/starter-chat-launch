import { Context, NextFunction } from 'grammy';
import { getCreator } from '../../db/creators';

export async function requireCreator(ctx: Context, next: NextFunction) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('Could not identify you.');
    return;
  }

  const creator = await getCreator(userId);
  if (!creator) {
    await ctx.reply('You need to /setup first.');
    return;
  }

  await next();
}
