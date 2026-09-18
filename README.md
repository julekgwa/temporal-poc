# Onboarding Workflow — Twenty + Temporal

## Overview

This POC uses **Twenty** as the CRM and application state store, while **Temporal** owns the long-running onboarding orchestration.

The onboarding process is:

```text
Your Details → BAV → KYC → Approval → Closed Won / Closed Lost
```

External systems such as banking and KYC providers are called from **Temporal Activities**.

The core principle is:

```text
Twenty       = CRM / application state
Temporal     = workflow orchestration
External APIs = verification / execution
```

---

## Architecture

```text
                         ┌──────────────────────┐
                         │        Twenty        │
                         │     Opportunity      │
                         └──────────┬───────────┘
                                    │
                           Stage changes
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Twenty Workflow      │
                         │ HTTP Request         │
                         └──────────┬───────────┘
                                    │
                                  HTTP
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    Temporal API      │
                         │                      │
                         │ signalWorkflow()     │
                         └──────────┬───────────┘
                                    │
                                  Signal
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │      Temporal Workflow      │
                    │                             │
                    │    OnboardingWorkflow       │
                    └─────────────┬───────────────┘
                                  │
                   ┌──────────────┼──────────────┐
                   │              │              │
                   ▼              ▼              ▼
             BAV Activity    KYC Activity    BIND Activity
                   │              │              │
                   ▼              ▼              ▼
               Bank API        KYC API        Bind API
                   │              │              │
                   └──────────────┼──────────────┘
                                  │
                                  ▼
                             Update Twenty
```

---

# 1. Twenty

Twenty represents the CRM and application state.

An **Opportunity represents one onboarding application**.

Recommended Opportunity fields:

```text
Opportunity
├── Name
├── Company
├── Person
├── Stage
│   ├── Your Details
│   ├── BAV
│   ├── KYC
│   ├── Approval
│   ├── Closed Won
│   └── Closed Lost
│
├── BAV Status
├── BAV Reference
├── BAV Failure Reason
│
├── KYC Status
├── KYC Reference
├── KYC Failure Reason
│
├── Bank Name
├── Bank Account Number
├── Bank Branch Code
└── Bank Account Holder
```

For a production implementation, sensitive banking and identity information should preferably be stored outside Twenty in a secure data store. Twenty should contain the relevant status and provider references.

---

# 2. Starting the Temporal Workflow

When the onboarding application is created:

```text
Your Details
    │
    ├── Create Company
    ├── Create Person
    └── Create Opportunity
              │
              ▼
       Start Temporal Workflow
```

Use one Temporal Workflow per Opportunity.

The Workflow ID should be deterministic:

```text
onboarding:{opportunityId}
```

Example:

```text
onboarding:e0f261c8-f4ff-4e57-93eb-1e38d4d43faa
```

Example:

```ts
await temporalClient.workflow.start(onboardingWorkflow, {
  workflowId: `onboarding:${opportunityId}`,
  taskQueue: "onboarding",
  args: [
    {
      opportunityId,
      companyId,
      personId,
    },
  ],
});
```

This makes the Twenty Opportunity and Temporal Workflow easy to correlate.

---

# 3. Temporal Workflow

There should be **one long-running onboarding Workflow**, rather than separate workflows for BAV, KYC, and BIND.

Conceptually:

```text
OnboardingWorkflow
│
├── wait for BAV signal
│       │
│       └── verifyBav Activity
│
├── wait for KYC signal
│       │
│       └── verifyKyc Activity
│
├── wait for outcome signal
│       │
│       ├── Closed Won
│       │       │
│       │       └── bind Activity
│       │
│       └── Closed Lost
│
└── complete
```

This allows the Workflow to remain alive for hours or days while waiting for the next stage.

---

# 4. Temporal Signals

Signals are used to tell the running Workflow that something happened externally.

Recommended signals:

```ts
const bavRequested = defineSignal<[BavSignal]>("bavRequested");

const kycRequested = defineSignal<[KycSignal]>("kycRequested");

const outcomeChanged =
  defineSignal<[OutcomeSignal]>("outcomeChanged");
```

Example payloads:

```ts
type BavSignal = {
  opportunityId: string;
};

type KycSignal = {
  opportunityId: string;
};

type OutcomeSignal = {
  opportunityId: string;
  outcome: "CLOSED_WON" | "CLOSED_LOST";
};
```

---

# 5. Twenty → Temporal

Twenty cannot directly execute a Temporal signal inside the Temporal Worker.

Instead, expose a small server/API endpoint.

For example:

```text
POST /temporal/onboarding/:opportunityId/bav
POST /temporal/onboarding/:opportunityId/kyc
POST /temporal/onboarding/:opportunityId/outcome
```

The API uses the Temporal SDK:

```ts
await temporalClient.workflow.signal(
  `onboarding:${opportunityId}`,
  "bavRequested",
  {
    opportunityId,
  },
);
```

The flow is:

```text
Twenty
   │
   │ HTTP
   ▼
Temporal API
   │
   │ workflow.signal()
   ▼
Temporal Workflow
```

---

# 6. BAV Flow

When the Opportunity reaches BAV:

```text
Twenty Opportunity
        │
        │ Stage = BAV
        ▼
Twenty Workflow
        │
        │ HTTP POST
        ▼
Temporal API
        │
        │ Signal
        ▼
OnboardingWorkflow
        │
        ▼
verifyBav Activity
        │
        ▼
Banking API
```

The Activity performs the actual external API call.

Example:

```ts
export async function verifyBav(opportunityId: string) {
  const opportunity =
    await twenty.getOpportunity(opportunityId);

  return bavProvider.verify({
    accountNumber: opportunity.bankAccountNumber,
    branchCode: opportunity.bankBranchCode,
    accountHolderName: opportunity.bankAccountHolder,
  });
}
```

The Workflow should **not** directly call the banking API.

Do this:

```ts
// Workflow

const result = await activities.verifyBav(opportunityId);
```

Not this:

```ts
// ❌ Do not call external APIs directly from Workflow

await fetch("https://bank.example.com/verify");
```

External I/O belongs in Activities.

---

# 7. BAV Result

The BAV provider should return a normalized result:

```json
{
  "status": "VERIFIED",
  "reference": "BAV-123456"
}
```

or:

```json
{
  "status": "FAILED",
  "reference": "BAV-123456",
  "reason": "Account details could not be verified"
}
```

or:

```json
{
  "status": "PENDING",
  "reference": "BAV-123456"
}
```

Temporal then updates Twenty:

```text
BAV Activity
    │
    ▼
Bank API
    │
    ▼
BAV result
    │
    ▼
Temporal
    │
    ▼
Update Twenty Opportunity
```

For example:

```text
BAV Status = VERIFIED
BAV Reference = BAV-123456
```

If the application should proceed:

```text
Stage = KYC
```

---

# 8. KYC Flow

Once Twenty moves the Opportunity to KYC:

```text
Twenty
  │
  │ Stage = KYC
  ▼
Twenty Workflow
  │
  │ HTTP
  ▼
Temporal API
  │
  │ Signal
  ▼
OnboardingWorkflow
  │
  ▼
verifyKyc Activity
  │
  ▼
KYC Provider
```

The KYC Activity follows the same pattern:

```ts
export async function verifyKyc(opportunityId: string) {
  const opportunity =
    await twenty.getOpportunity(opportunityId);

  return kycProvider.verify({
    opportunityId,
    personId: opportunity.personId,
  });
}
```

The result is then written back to Twenty:

```text
KYC Status
KYC Reference
KYC Failure Reason
```

---

# 9. Closed Won / Closed Lost

When the application reaches the final outcome:

```text
Twenty Opportunity
       │
       ├── Closed Lost
       │
       └── Closed Won
```

Twenty signals Temporal:

```http
POST /temporal/onboarding/:opportunityId/outcome
```

Payload:

```json
{
  "outcome": "CLOSED_WON"
}
```

Temporal receives:

```ts
await temporalClient.workflow.signal(
  `onboarding:${opportunityId}`,
  "outcomeChanged",
  {
    opportunityId,
    outcome: "CLOSED_WON",
  },
);
```

---

# 10. BIND

If the outcome is `CLOSED_WON`, Temporal executes the BIND Activity:

```text
Closed Won
    │
    ▼
Temporal Signal
    │
    ▼
OnboardingWorkflow
    │
    ▼
BIND Activity
    │
    ▼
Binding API
```

Example:

```ts
if (outcome === "CLOSED_WON") {
  await activities.executeBind(opportunityId);
}
```

The BIND operation should be idempotent.

Use an idempotency key such as:

```text
onboarding:{opportunityId}:bind
```

This is important because Temporal Activities can be retried.

A retry must not accidentally create two bindings.

---

# 11. Why Activities?

Activities provide the boundary between deterministic workflow orchestration and external side effects.

Activities are responsible for:

- HTTP calls
- Database calls
- Twenty API calls
- Banking API calls
- KYC API calls
- BIND API calls
- Other external integrations

Temporal provides:

- Retries
- Timeouts
- Durable state
- Failure recovery
- Long-running execution
- Workflow history
- Signals
- Queries
- Observability

---

# 12. Recommended Service Structure

A simple implementation could look like:

```text
src/
├── temporal/
│   ├── client.ts
│   ├── worker.ts
│   │
│   ├── workflows/
│   │   └── onboarding.ts
│   │
│   ├── activities/
│   │   ├── bav.ts
│   │   ├── kyc.ts
│   │   ├── bind.ts
│   │   └── twenty.ts
│   │
│   └── signals/
│       └── onboarding.ts
│
├── routes/
│   └── temporal/
│       └── onboarding/
│           ├── bav.ts
│           ├── kyc.ts
│           └── outcome.ts
│
└── integrations/
    ├── bav/
    │   └── provider.ts
    ├── kyc/
    │   └── provider.ts
    └── bind/
        └── provider.ts
```

Keep the provider interfaces small:

```ts
interface BavProvider {
  verify(input: BavInput): Promise<BavResult>;
}

interface KycProvider {
  verify(input: KycInput): Promise<KycResult>;
}

interface BindProvider {
  bind(input: BindInput): Promise<BindResult>;
}
```

For the POC:

```text
BavProvider → in-memory mock
KycProvider → in-memory mock
BindProvider → mock implementation
```

Later:

```text
BavProvider → Real banking provider
KycProvider → Real KYC provider
BindProvider → Real BIND provider
```

The Temporal Workflow does not need to change.

---

# 13. Complete Flow

The complete onboarding lifecycle is:

```text
                    YOUR DETAILS
                         │
                         ▼
                Create Opportunity
                         │
                         ▼
              Start Temporal Workflow
                         │
                         ▼
                       BAV
                         │
              Twenty signals Temporal
                         │
                         ▼
                  BAV Activity
                         │
                         ▼
                    Bank API
                         │
                         ▼
                 BAV Result
                         │
                         ▼
                  Update Twenty
                         │
                         ▼
                       KYC
                         │
              Twenty signals Temporal
                         │
                         ▼
                  KYC Activity
                         │
                         ▼
                    KYC API
                         │
                         ▼
                 KYC Result
                         │
                         ▼
                  Update Twenty
                         │
                         ▼
                     APPROVAL
                         │
                         ▼
               Closed Won / Lost
                         │
                         │
              ┌──────────┴──────────┐
              │                     │
          Closed Lost           Closed Won
              │                     │
              ▼                     ▼
          Complete             BIND Activity
                                    │
                                    ▼
                                 BIND API
                                    │
                                    ▼
                                 Complete
```

---

# 14. Ownership

| Concern | Owner |
|---|---|
| Company | Twenty |
| Person | Twenty |
| Opportunity | Twenty |
| Current application stage | Twenty |
| BAV/KYC status | Twenty |
| Provider references | Twenty |
| Workflow state | Temporal |
| Waiting for external events | Temporal |
| Retries | Temporal |
| BAV API call | Temporal Activity |
| KYC API call | Temporal Activity |
| BIND API call | Temporal Activity |
| Sensitive provider credentials | Server/secret manager |
| Actual external verification | Provider |

---

# 15. Design Principle

The most important rule is:

```text
Twenty tells us WHAT stage the application is in.

Temporal determines WHAT WORK needs to happen.

Activities perform the actual external work.
```

This keeps the CRM, orchestration engine, and external providers loosely coupled while allowing the onboarding process to run reliably over long periods of time.
