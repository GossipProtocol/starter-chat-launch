const MIN_LEN = 3;
const MAX_LEN = 10;

export interface TickerValidation {
  ok: boolean;
  reason?: string;
}

export function normalizeTicker(input: string): string {
  return input.replace(/^\$/, '').toUpperCase().trim();
}

export function validateTickerShape(ticker: string): TickerValidation {
  if (ticker.length < MIN_LEN || ticker.length > MAX_LEN) {
    return { ok: false, reason: `must be ${MIN_LEN}-${MAX_LEN} chars` };
  }
  if (!/^[A-Z0-9]+$/.test(ticker)) {
    return { ok: false, reason: 'letters and numbers only' };
  }
  return { ok: true };
}

// Default fallback ticker: CREATOR + FAN truncated to 10 chars
export function defaultTicker(creatorHandle: string, fanHandle: string): string {
  const c = creatorHandle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const f = fanHandle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (c.length === 0 && f.length === 0) return 'GATE';
  let cBudget = Math.min(c.length, 5);
  let fBudget = Math.min(f.length, MAX_LEN - cBudget);
  if (cBudget + fBudget < MAX_LEN) {
    cBudget = Math.min(c.length, MAX_LEN - fBudget);
  }
  return (c.slice(0, cBudget) + f.slice(0, fBudget)).slice(0, MAX_LEN) || 'GATE';
}
