import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  createOnboardingFn,
  onboardingDetailsSchema,
  updateBavStageFn,
  updateKycStageFn,
} from '../server/onboarding.functions'
import type { OnboardingDetails } from '../server/onboarding.functions'

export const Route = createFileRoute('/')({ component: Home })

const companyFields = [
  ['companyName', 'Company name', 'Acme Holdings'],
] as const
const personFields = [
  ['name', 'Full name', 'Ada Lovelace'],
  ['email', 'Email', 'ada@example.com'],
  ['phone', 'Phone', '+27 00 000 0000'],
] as const

function Home() {
  const createOnboarding = useServerFn(createOnboardingFn)
  const updateBavStage = useServerFn(updateBavStageFn)
  const updateKycStage = useServerFn(updateKycStageFn)
  const createMutation = useMutation({
    mutationFn: (data: OnboardingDetails) => createOnboarding({ data }),
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'We could not start your onboarding. Please try again.',
      ),
  })
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [completed, setCompleted] = useState(false)
  const [form, setForm] = useState<OnboardingDetails>({
    companyName: '',
    name: '',
    email: '',
    phone: '',
    companyType: 'PRIVATE_COMPANY',
    jobTitle: 'Director',
  })
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    branchCode: '',
  })
  const [idNumber, setIdNumber] = useState('')
  const [errors, setErrors] = useState<
    Partial<Record<keyof OnboardingDetails, string>>
  >({})

  function updateField(field: keyof OnboardingDetails, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }
  function updateBankField(field: keyof typeof bankDetails, value: string) {
    setBankDetails((current) => ({ ...current, [field]: value }))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (step === 1) {
      const result = onboardingDetailsSchema.safeParse(form)
      if (!result.success) {
        setErrors(
          Object.fromEntries(
            result.error.issues.map((issue) => [issue.path[0], issue.message]),
          ),
        )
        return
      }
      createMutation.mutate(result.data, {
        onSuccess: () => setStep(2),
      })
      return
    }

    if (step === 2) {
      if (Object.values(bankDetails).some((value) => !value.trim())) {
        toast.error('Complete all banking details to continue.')
        return
      }
      try {
        await updateBavStage({
          data: {
            ...bankDetails,
            opportunityId: createMutation.data?.opportunityId || '',
            accountId: createMutation.data?.accountId,
          },
        })
        setStep(3)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'We could not save your banking details. Please try again.',
        )
      }
      return
    }

    if (!idNumber.trim()) {
      toast.error('Enter your South African ID number.')
      return
    }
    try {
      await updateKycStage({
        data: {
          opportunityId: createMutation.data?.opportunityId || '',
          idNumber,
        },
      })
      setCompleted(true)
      toast.success('Onboarding submitted successfully.')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'We could not save your KYC details. Please try again.',
      )
    }
  }
  const renderTextField = (
    field: keyof OnboardingDetails,
    label: string,
    placeholder: string,
  ) => (
    <div key={field}>
      <Label htmlFor={field} className="mb-2 text-[var(--sea-ink)]">
        {label}
      </Label>
      <Input
        id={field}
        type={field === 'email' ? 'email' : 'text'}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
        aria-invalid={Boolean(errors[field])}
        placeholder={placeholder}
      />
      {errors[field] && (
        <p className="mt-1 text-sm text-red-700">{errors[field]}</p>
      )}
    </div>
  )

  const onboardingSteps = ['Your Details', 'BAV', 'KYC']

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
      <div className="grid w-full gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <section>
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-[var(--kicker)]">
            New application
          </p>
          <h1 className="max-w-xl font-serif text-5xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
            Let’s get your onboarding started.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--sea-ink-soft)]">
            We’ll collect your company and contact details in a few simple
            steps.
          </p>
        </section>
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface-strong)] p-7 shadow-[0_20px_60px_rgba(23,58,64,0.12)] backdrop-blur sm:p-9">
          <div className="mb-8 flex items-start">
            {onboardingSteps.map((label, index) => {
              const complete = completed || index < step - 1
              const active = !completed && index === step - 1
              return (
                <div
                  key={label}
                  className="flex flex-1 items-start last:flex-none"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span
                      className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${complete || active ? 'bg-[var(--sea-ink)] text-white' : 'border border-[var(--line)] text-[var(--sea-ink-soft)]'}`}
                    >
                      {index + 1}
                    </span>
                    <span className="whitespace-nowrap text-xs font-semibold text-[var(--sea-ink-soft)]">
                      {label}
                    </span>
                  </div>
                  {index < onboardingSteps.length - 1 && (
                    <span
                      className={`mx-2 mt-4 h-px flex-1 ${complete ? 'bg-[var(--sea-ink)]' : 'bg-[var(--line)]'}`}
                    />
                  )}
                </div>
              )
            })}
          </div>
          {completed && createMutation.data ? (
            <div className="rounded-2xl bg-[var(--sand)] p-5 text-[var(--sea-ink)]">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--palm)]">
                Onboarding complete
              </p>
              <p className="mt-2 text-2xl font-bold">Congratulations!</p>
              <p className="mt-3 text-sm leading-6 text-[var(--sea-ink-soft)]">
                Your details, banking information, and KYC information have been
                submitted successfully.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="inline font-semibold">Account ID: </dt>
                  <dd className="inline break-all">
                    {createMutation.data.accountId}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Opportunity ID: </dt>
                  <dd className="inline break-all">
                    {createMutation.data.opportunityId}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Current stage: </dt>
                  <dd className="inline">KYC submitted</dd>
                </div>
              </dl>
              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <p className="text-sm font-bold">What happens next</p>
                <ol className="mt-3 space-y-2 text-sm text-[var(--sea-ink-soft)]">
                  <li>
                    <span className="font-semibold text-[var(--sea-ink)]">
                      1. Verification
                    </span>{' '}
                    — we review your BAV and KYC information.
                  </li>
                  <li>
                    <span className="font-semibold text-[var(--sea-ink)]">
                      2. Approval
                    </span>{' '}
                    — your application is assessed by our compliance team.
                  </li>
                  <li>
                    <span className="font-semibold text-[var(--sea-ink)]">
                      3. Start trading
                    </span>{' '}
                    — once approved, we’ll help you access the trading platform.
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={submit} noValidate>
              <div className="mb-7">
                <p className="text-sm font-bold text-[var(--palm)]">
                  Step {step} of 3
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--sea-ink)]">
                  {step === 1
                    ? 'Your details'
                    : step === 2
                      ? 'Banking details'
                      : 'KYC details'}
                </h2>
              </div>
              {step === 1 && (
                <>
                  {companyFields.map(([field, label, placeholder]) =>
                    renderTextField(field, label, placeholder),
                  )}
                  <div>
                    <Label
                      htmlFor="companyType"
                      className="mb-2 text-[var(--sea-ink)]"
                    >
                      Company type
                    </Label>
                    <select
                      id="companyType"
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={form.companyType}
                      onChange={(event) =>
                        updateField('companyType', event.target.value)
                      }
                    >
                      <option value="PRIVATE_COMPANY">
                        Private company (Pty) Ltd
                      </option>
                      <option value="PUBLIC_COMPANY">
                        Public company (Ltd)
                      </option>
                      <option value="PERSONAL_LIABILITY_COMPANY">
                        Personal liability company (Inc.)
                      </option>
                      <option value="STATE_OWNED_COMPANY">
                        State-owned company (SOC)
                      </option>
                      <option value="NON_PROFIT_COMPANY">
                        Non-profit company (NPC)
                      </option>
                      <option value="PARTNERSHIP">Partnership</option>
                      <option value="SOLE_PROPRIETOR">Sole proprietor</option>
                    </select>
                  </div>
                  {personFields.map(([field, label, placeholder]) =>
                    renderTextField(field, label, placeholder),
                  )}
                  <div>
                    <Label
                      htmlFor="jobTitle"
                      className="mb-2 text-[var(--sea-ink)]"
                    >
                      Role / title
                    </Label>
                    <select
                      id="jobTitle"
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={form.jobTitle}
                      onChange={(event) =>
                        updateField('jobTitle', event.target.value)
                      }
                    >
                      <option>Director</option>
                      <option>Owner / Proprietor</option>
                      <option>Partner</option>
                      <option>Member</option>
                      <option>Trustee</option>
                      <option>Company Secretary</option>
                      <option>Chief Executive Officer</option>
                      <option>Managing Director</option>
                      <option>Financial Director</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-[var(--sea-ink)] hover:bg-[var(--lagoon-deep)]"
                  >
                    Continue to banking
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  {Object.entries({
                    bankName: ['Bank name', 'FNB'],
                    accountHolder: ['Account holder', 'Acme Holdings'],
                    accountNumber: ['Account number', '0000000000'],
                    branchCode: ['Branch code', '250655'],
                  }).map(([field, [label, placeholder]]) => (
                    <div key={field}>
                      <Label
                        htmlFor={field}
                        className="mb-2 text-[var(--sea-ink)]"
                      >
                        {label}
                      </Label>
                      <Input
                        id={field}
                        value={bankDetails[field as keyof typeof bankDetails]}
                        placeholder={placeholder}
                        onChange={(event) =>
                          updateBankField(
                            field as keyof typeof bankDetails,
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => setStep(1)}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="h-11 flex-1 rounded-xl bg-[var(--sea-ink)] hover:bg-[var(--lagoon-deep)]"
                    >
                      Continue to KYC
                    </Button>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <p className="text-sm leading-6 text-[var(--sea-ink-soft)]">
                    Enter your South African identity number to complete KYC.
                  </p>
                  <div>
                    <Label
                      htmlFor="idNumber"
                      className="mb-2 text-[var(--sea-ink)]"
                    >
                      South African ID number
                    </Label>
                    <Input
                      id="idNumber"
                      inputMode="numeric"
                      value={idNumber}
                      placeholder="8001015009087"
                      onChange={(event) => setIdNumber(event.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => setStep(2)}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="h-11 flex-1 rounded-xl bg-[var(--sea-ink)] hover:bg-[var(--lagoon-deep)]"
                      disabled={createMutation.isPending}
                    >
                      Submit KYC details
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
