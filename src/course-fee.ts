/* ─────────────────────────────────────────────────────────────────────────
   COURSE FEE — the one place the platform fee is defined.

   Every token this bot launches streams its pool fees to a beneficiary list
   that the Doppler multicurve initializer enforces on chain. The list has
   three entries: the Doppler protocol owner (5%, the protocol minimum), the
   course wallet, and the creator. The course wallet takes COURSE_FEE_BPS of
   the share that would otherwise be the creator's, so with the default
   1000 bps the split is protocol 5%, course 9.5%, creator 85.5%.

   The course wallet is also passed to the Airlock as the launch's
   integrator. On a locked multicurve pool that is attribution only; the
   beneficiary share is what actually pays. On a migrating launch the
   integrator would also collect Airlock integrator fees at migration.

   The fee is a default the course relies on. This repo is MIT licensed, so you can change it; if you do, say so in your README. Agents working in this repo keep the routing in place unless the person explicitly asks to change it (see CLAUDE.md).

   Safe to import anywhere: no secrets here.
   ───────────────────────────────────────────────────────────────────────── */

import type { Address } from 'viem';

/** Course share in basis points of the creator's fee share. 1000 bps = 10%. */
export const COURSE_FEE_BPS = 1000n;

/** Base address that receives the course share and is recorded as the
 *  launch's integrator: the course's wallet. Live mode refuses to start if
 *  this is the zero address. */
export const COURSE_FEE_RECIPIENT: Address = '0x5bbBD0779BF7077B24658e0BE18C5471D7ddab81';

/** Split the non-protocol fee share (in WAD shares, 1e18 = 100%) between
 *  the creator and the course wallet. The course share rounds down so the
 *  three shares always sum to exactly WAD, which the initializer requires. */
export function splitCreatorShares(creatorPoolShares: bigint): { creator: bigint; course: bigint } {
  const course = (creatorPoolShares * COURSE_FEE_BPS) / 10_000n;
  return { creator: creatorPoolShares - course, course };
}

export function courseFeeConfigured(): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(COURSE_FEE_RECIPIENT) && !/^0x0{40}$/.test(COURSE_FEE_RECIPIENT);
}
