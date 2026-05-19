export function Hero() {
  return (
    <section className="min-h-screen pt-16">
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
        {/* Left - Image */}
        <div className="relative h-[45vh] lg:h-auto lg:w-[55%] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=2070&auto=format&fit=crop"
            alt="Vibrant Melbourne bar with disco balls and red lighting"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Right - Red Panel with Content */}
        <div className="relative flex flex-col lg:w-[45%] bg-primary min-h-[55vh] lg:min-h-full">
          {/* Tagline at top */}
          <div className="p-6 md:p-10 lg:p-12 pt-8 lg:pt-16">
            <p className="font-[var(--font-display)] text-[#e5e7d4] text-sm md:text-base lg:text-lg tracking-wide leading-tight uppercase font-extrabold">
              {"Melbourne's Guide To"}
              <br />
              {"Spontaneous Discovery"}
            </p>
          </div>
          
          {/* Giant text at bottom */}
          <div className="flex-1 flex items-end p-6 md:p-10 lg:p-12 pb-8 lg:pb-12 overflow-hidden">
            <h1 className="font-[var(--font-display)] text-[#e5e7d4] text-[4.5rem] md:text-[7rem] lg:text-[8rem] xl:text-[10rem] 2xl:text-[12rem] font-black leading-[0.85] tracking-tight uppercase">
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
