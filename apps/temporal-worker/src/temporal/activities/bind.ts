export type BindResult = { status: 'BOUND'; reference: string }

// No real BIND provider for this POC; mocked so the workflow can complete
// the CLOSED_WON path end-to-end. The reference is derived purely from the
// idempotency key (rather than e.g. crypto.randomUUID()) so repeated calls
// with the same key — a Temporal activity retry, or a re-run against the
// same opportunity — return the same binding instead of creating a new one.
export async function bind(
  opportunityId: string,
  idempotencyKey: string,
): Promise<BindResult> {
  console.log('[Bind] mocked bind', { opportunityId, idempotencyKey })
  return { status: 'BOUND', reference: `BIND-${idempotencyKey}` }
}
