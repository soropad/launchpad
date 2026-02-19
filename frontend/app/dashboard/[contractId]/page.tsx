/**
 * /dashboard/[contractId] — Per-token dashboard.
 *
 * TODO (issue #9): Fetch and display:
 *   - token name/symbol/decimals, total/circulating supply, admin address
 *   - top holders table (via Horizon API)
 *   - vesting panel with progress bars (issue #11)
 *   - admin panel with mint/burn/transfer admin forms (issue #13)
 */

export default async function TokenDashboard({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">📊</span>
      <h1 className="mt-4 text-3xl font-bold text-white">Token Dashboard</h1>
      <p className="mt-3 text-gray-400">
        Viewing contract{" "}
        <code className="rounded bg-void-700 px-2 py-0.5 font-mono text-sm text-stellar-300">
          {contractId}
        </code>
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
