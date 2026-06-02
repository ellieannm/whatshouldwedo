import Link from "next/link"

export default function SubmitSuccessPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-8">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-start justify-center border border-foreground p-6 md:p-10">
        <h1 className="font-[var(--font-display)] text-5xl uppercase tracking-tight text-foreground md:text-7xl">
          THANKS FOR THE TIP.
        </h1>
        <p className="mt-6 max-w-2xl text-sm uppercase tracking-[0.1em] text-muted-foreground">
          We&apos;ll review your submission and add it to the site if it&apos;s a good fit.
        </p>
        <Link
          href="/"
          className="mt-8 border border-primary bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground"
        >
          Back to What&apos;s On
        </Link>
      </section>
    </main>
  )
}
