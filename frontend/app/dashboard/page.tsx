/**
 * /dashboard — Dashboard index (no contract selected yet).
 *
 * TODO (issue #9): add a contract ID search/input here so users can
 * navigate to /dashboard/[contractId].
 */

export default function DashboardIndex() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">📊</span>
      <h1 className="mt-4 text-3xl font-bold text-white">Token Dashboard</h1>
      <p className="mt-3 max-w-md text-gray-400">
        Enter a deployed token&apos;s contract ID to view supply metrics, holder
        distribution, and vesting progress.
      </p>
      <div className="mt-6 glass-card inline-block px-5 py-3 text-sm text-gray-500">
        🔧 Coming soon —{" "}
        <a
          href="https://github.com/your-org/soroban-token-launchpad/issues/9"
          className="text-stellar-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          issue #9
        </a>
      </div>
    </div>
  );
}
