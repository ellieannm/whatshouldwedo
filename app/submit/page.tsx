"use client"

import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type FormValues = {
  title: string
  startDate: string
  endDate: string
  venueName: string
  suburb: string
  description: string
  sourceUrl: string
  imageUrl: string
  submitterName: string
  submitterEmail: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const MAX_DESCRIPTION_LENGTH = 300

const initialValues: FormValues = {
  title: "",
  startDate: "",
  endDate: "",
  venueName: "",
  suburb: "",
  description: "",
  sourceUrl: "",
  imageUrl: "",
  submitterName: "",
  submitterEmail: "",
}

function toStartDatetime(date: string): string {
  return `${date} 00:00:00`
}

function toEndDatetime(date: string): string {
  return `${date} 23:59:59`
}

function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}

  if (!values.title.trim()) errors.title = "Event name is required"
  if (!values.startDate) errors.startDate = "Start date is required"
  if (!values.venueName.trim()) errors.venueName = "Venue name is required"
  if (!values.suburb.trim()) errors.suburb = "Suburb is required"
  if (!values.description.trim()) {
    errors.description = "Description is required"
  } else if (values.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} chars or less`
  }
  if (!values.sourceUrl.trim()) errors.sourceUrl = "External link is required"
  if (values.endDate && values.startDate && values.endDate < values.startDate) {
    errors.endDate = "End date cannot be before start date"
  }

  return errors
}

export default function SubmitPage() {
  const router = useRouter()
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const descriptionRemaining = useMemo(
    () => MAX_DESCRIPTION_LENGTH - values.description.length,
    [values.description.length]
  )

  const onChange =
    (field: keyof FormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value
      setValues((current) => ({ ...current, [field]: nextValue }))
      setErrors((current) => ({ ...current, [field]: undefined }))
      setSubmitError(null)
    }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const nextErrors = validate(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)
    const normalizedSourceUrl = normalizeExternalUrl(values.sourceUrl)

    const response = await fetch("/api/submit-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: values.title.trim(),
        description: values.description.trim(),
        start_datetime: toStartDatetime(values.startDate),
        end_datetime: values.endDate
          ? toEndDatetime(values.endDate)
          : toEndDatetime(values.startDate),
        venue_name: values.venueName.trim(),
        venue_suburb: values.suburb.trim(),
        source_url: normalizedSourceUrl,
        image_url: values.imageUrl.trim(),
        submitter_name: values.submitterName.trim(),
        submitter_email: values.submitterEmail.trim(),
      }),
    })

    setIsSubmitting(false)

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      setSubmitError(payload.error || "Could not submit event")
      return
    }

    setValues(initialValues)
    setErrors({})
    router.push("/submit/success")
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-8">
      <section className="mx-auto w-full max-w-3xl border border-foreground p-6 md:p-10">
        <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-tight md:text-5xl">
          Submit Event
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Share something happening in Melbourne
        </p>

        {submitError ? (
          <p className="mt-6 border border-primary p-3 text-xs uppercase tracking-[0.12em] text-primary">
            {submitError}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.15em]">Event name *</label>
            <input
              type="text"
              value={values.title}
              onChange={onChange("title")}
              className="w-full border border-foreground bg-transparent px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-primary"
            />
            {errors.title ? (
              <p className="mt-2 text-xs uppercase tracking-wide text-primary">{errors.title}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.15em]">
                Start date *
              </label>
              <input
                type="date"
                value={values.startDate}
                onChange={onChange("startDate")}
                className="w-full border border-foreground bg-transparent px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-primary"
              />
              {errors.startDate ? (
                <p className="mt-2 text-xs uppercase tracking-wide text-primary">
                  {errors.startDate}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.15em]">End date</label>
              <input
                type="date"
                value={values.endDate}
                onChange={onChange("endDate")}
                className="w-full border border-foreground bg-transparent px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-primary"
              />
              {errors.endDate ? (
                <p className="mt-2 text-xs uppercase tracking-wide text-primary">{errors.endDate}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.15em]">Venue name *</label>
              <input
                type="text"
                value={values.venueName}
                onChange={onChange("venueName")}
                className="w-full border border-foreground bg-transparent px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-primary"
              />
              {errors.venueName ? (
                <p className="mt-2 text-xs uppercase tracking-wide text-primary">
                  {errors.venueName}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.15em]">Suburb *</label>
              <input
                type="text"
                value={values.suburb}
                onChange={onChange("suburb")}
                className="w-full border border-foreground bg-transparent px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-primary"
              />
              {errors.suburb ? (
                <p className="mt-2 text-xs uppercase tracking-wide text-primary">{errors.suburb}</p>
              ) : null}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.15em]">
              Description * (max 300)
            </label>
            <textarea
              value={values.description}
              onChange={onChange("description")}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={5}
              className="w-full border border-foreground bg-transparent px-3 py-2 text-sm tracking-wide outline-none focus:border-primary"
            />
            <div className="mt-2 flex items-center justify-between">
              {errors.description ? (
                <p className="text-xs uppercase tracking-wide text-primary">{errors.description}</p>
              ) : (
                <span />
              )}
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {descriptionRemaining} left
              </p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.15em]">
              External link / tickets URL *
            </label>
            <input
              type="text"
              value={values.sourceUrl}
              onChange={onChange("sourceUrl")}
              className="w-full border border-foreground bg-transparent px-3 py-2 text-sm tracking-wide outline-none focus:border-primary"
            />
            {errors.sourceUrl ? (
              <p className="mt-2 text-xs uppercase tracking-wide text-primary">{errors.sourceUrl}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.15em]">
              Image URL (optional)
            </label>
            <input
              type="url"
              value={values.imageUrl}
              onChange={onChange("imageUrl")}
              className="w-full border border-foreground bg-transparent px-3 py-2 text-sm tracking-wide outline-none focus:border-primary"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.15em]">
                Your name (optional)
              </label>
              <input
                type="text"
                value={values.submitterName}
                onChange={onChange("submitterName")}
                className="w-full border border-foreground bg-transparent px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.15em]">
                Your email (optional)
              </label>
              <input
                type="email"
                value={values.submitterEmail}
                onChange={onChange("submitterEmail")}
                className="w-full border border-foreground bg-transparent px-3 py-2 text-sm tracking-wide outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="border border-primary bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-70"
          >
            {isSubmitting ? "Submitting..." : "Submit Event"}
          </button>
        </form>
      </section>
    </main>
  )
}
