import { BOT_USERNAME } from '../config';

export function buildTweetUrl(
  ticker: string,
  thresholdK: number,
  tokenUrl: string,
  fanHandle?: string | null,
): string {
  const opener = fanHandle
    ? `@${fanHandle} wants in my dms`
    : 'someone wants in my dms';
  const text = [
    opener,
    `pump $${ticker} to $${thresholdK}k to find out if i reply`,
    `verified by @${BOT_USERNAME}`,
    tokenUrl,
  ].join('\n');
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
