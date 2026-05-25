export function Hero() {
  return (
    <section className="min-h-screen pt-16">
      <div className="flex min-w-0 flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
        {/* Left - Image */}
        <div className="relative h-[45vh] lg:h-auto lg:w-[55%] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=2070&auto=format&fit=crop"
            alt="Vibrant Melbourne bar with disco balls and red lighting"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right - Red Panel with Content */}
        <div className="relative flex min-w-0 flex-col bg-primary min-h-[55vh] lg:min-h-full lg:w-[45%]">
          {/* Tagline at top */}
          <div className="p-6 md:p-10 lg:p-12 pt-8 lg:pt-12">
            <p className="font-[var(--font-display)] text-[#e5e7d4] text-sm md:text-base lg:text-lg tracking-wide leading-tight uppercase font-extrabold">
              {"Melbourne's Guide To"}
              <br />
              {"Spontaneous Discovery"}
            </p>
          </div>

          {/* Giant display headline */}
          <div className="mt-auto w-full min-w-0 p-6 pb-8 md:p-10 md:pb-10 lg:p-12 lg:pb-12">
            <h1 className="font-[var(--font-display)] text-[#e5e7d4] font-black leading-[0.85] tracking-tight uppercase w-full max-w-full text-[clamp(2.75rem,11vw,5.5rem)] md:text-[clamp(3.5rem,10vw,6.5rem)] lg:text-[clamp(3.75rem,5.2vw,7.25rem)] xl:text-[clamp(4.25rem,5.8vw,8.25rem)] 2xl:text-[clamp(4.75rem,6.2vw,9rem)]">
              WHAT
              <br />
              SHOULD
              <br />
              WE DO?
            </h1>
          </div>
        </div>
      </div>
    </section>
  )
}
