/**
 * /deploy — Token deployment page.
 *
 * TODO (issue #7): Build the full 4-step form here:
 *   (1) token metadata, (2) supply config, (3) admin address, (4) review + deploy.
 * Use react-hook-form + zod for validation and show a progress bar.
 */

export default function DeployPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">🚀</span>
      <h1 className="mt-4 text-3xl font-bold text-white">Deploy a Token</h1>
      <p className="mt-3 max-w-md text-gray-400">
        The multi-step deployment form will be built here — configure your
        token&apos;s name, symbol, supply, and admin address, then deploy to
        Soroban with one click.
      </p>
      <div className="mt-6 glass-card inline-block px-5 py-3 text-sm text-gray-500">
        🔧 Coming soon —{" "}
        <a
          href="https://github.com/your-org/soroban-token-launchpad/issues/7"
          className="text-stellar-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          issue #7
        </a>
      </div>
    </div>
  );
}
