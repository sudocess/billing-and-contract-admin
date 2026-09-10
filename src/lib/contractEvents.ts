/**
 * The contract trail.
 *
 * Every contract carries an append-only list of what happened to it and when. The
 * contract row itself only knows its current state, which answers "what is it now"
 * and never "how did it get here" — and when a signed agreement turned out to have
 * been overwritten, the only evidence left was that `updatedAt` was later than
 * `signedAt`. What changed, and how many times, was gone.
 *
 * Recording never blocks the action that caused it. A contract that was signed but
 * whose trail entry failed to write is a bookkeeping problem; a signature refused
 * because its trail entry failed is a client-facing one.
 */

import { prisma } from './prisma'

export type ContractEventType =
  | 'created'
  | 'edited'
  | 'sent'
  | 'signing_link'
  | 'signature_requested'
  | 'signed'
  | 'superseded'
  | 'replaced'
  | 'cancelled'
  | 'reactivated'

/** Human labels, so the timeline reads as a sentence rather than a field name. */
export const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  edited: 'Edited',
  sent: 'Sent to client',
  signing_link: 'Signing link created',
  signature_requested: 'Sent for signature',
  signed: 'Signed',
  superseded: 'Replaced by a new version',
  replaced: 'Replaces an earlier version',
  cancelled: 'Cancelled',
  reactivated: 'Reactivated',
}

/** Events that end a contract's life, shown differently from ordinary progress. */
export const TERMINAL_EVENTS = new Set(['superseded', 'cancelled'])

export async function recordEvent(
  contractId: string,
  type: ContractEventType,
  detail?: string | null,
  actor?: string | null,
): Promise<void> {
  try {
    await prisma.contractEvent.create({
      data: { contractId, type, detail: detail ?? null, actor: actor ?? null },
    })
  } catch (err) {
    // Deliberately swallowed: see the note at the top of this file.
    console.error('[events] could not record', type, 'for', contractId, err)
  }
}

/**
 * Describe what changed between two versions of a contract, in the terms someone
 * would actually care about later — money, dates, scope, who it is with.
 *
 * Field-level diffing of the whole row would produce noise; these are the fields
 * whose change would make a signature apply to something other than what was signed.
 */
export function describeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string | null {
  const watched: [string, string][] = [
    ['totalValue', 'total value'],
    ['initFee', 'initiation fee'],
    ['deliverables', 'deliverables'],
    ['phaseStart', 'start date'],
    ['phaseEnd', 'end date'],
    ['phaseLabel', 'phase'],
    ['projectName', 'project name'],
    ['clientName', 'client'],
    ['tier2Rate', 'hourly rate'],
  ]

  const changed: string[] = []
  for (const [key, label] of watched) {
    const a = before[key]
    const b = after[key]
    if (a === b) continue
    if (typeof a === 'number' && typeof b === 'number') {
      changed.push(`${label} ${a} → ${b}`)
    } else if (key === 'deliverables') {
      // The text itself is far too long for a timeline row.
      changed.push('deliverables rewritten')
    } else {
      changed.push(`${label} ${a ? `"${String(a).slice(0, 40)}"` : 'empty'} → ${b ? `"${String(b).slice(0, 40)}"` : 'empty'}`)
    }
  }

  // The schedule is compared as a whole: which rows moved matters less than the fact
  // that the payment terms are no longer the ones that were agreed.
  if (JSON.stringify(before.installments ?? null) !== JSON.stringify(after.installments ?? null)) {
    changed.push('payment schedule changed')
  }

  if (changed.length === 0) return null
  return changed.join(' · ')
}
