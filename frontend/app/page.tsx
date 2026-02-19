export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-stellar-600/10 blur-[120px]" />
        <div className="absolute -right-40 top-40 h-[400px] w-[400px] rounded-full bg-stellar-400/5 blur-[100px]" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto flex min-h-[85vh] max-w-5xl flex-col items-center justify-center px-6 text-center">
        <div className="animate-fade-in-up">
          <span className="mb-4 inline-block rounded-full border border-stellar-500/20 bg-stellar-500/5 px-4 py-1.5 text-xs font-medium tracking-wide text-stellar-300">
            Built on Stellar Soroban
          </span>

          <h1 className="mt-4 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Launch Your Token
            <br />
            <span className="gradient-text">In Minutes</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
            SoroPad is an open-source launchpad for deploying SEP-41 compliant
            tokens on Soroban — with vesting schedules, admin controls, and a
            real-time dashboard. No smart-contract code required.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="/deploy" className="btn-primary px-8 py-3 text-base">
              Deploy a Token
            </a>
            <a
              href="https://github.com/your-org/soroban-token-launchpad"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary px-8 py-3 text-base"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: "🪙",
              title: "One-Click Deploy",
              desc: "Fill a form, sign with Freighter, and your SEP-41 token is live on Soroban.",
            },
            {
              icon: "🔒",
              title: "Vesting & Controls",
              desc: "Cliff + linear vesting per wallet. Mint, burn, and freeze with admin controls.",
            },
            {
              icon: "📊",
              title: "Live Dashboard",
              desc: "Supply metrics, holder table, vesting progress — all in real-time.",
            },
          ].map((f) => (
            <div key={f.title} className="glass-card p-6">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
