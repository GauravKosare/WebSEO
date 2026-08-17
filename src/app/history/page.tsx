import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Scan } from "@/lib/models/Scan";
import { getOrCreateVisitorId } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  await connectToDatabase();
  const { id: visitorId } = await getOrCreateVisitorId();

  const scans = await Scan.find({ visitorId })
    .sort({ createdAt: -1 })
    .limit(50)
    .select({ url: 1, finalUrl: 1, score: 1, createdAt: 1, monitoringEnabled: 1 })
    .lean();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">My scans</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tied to this browser only — no account needed. Clearing cookies will clear this history.
      </p>

      {scans.length === 0 ? (
        <p className="mt-10 text-neutral-500">
          No scans yet. <Link href="/" className="text-blue-600 hover:underline">Run your first audit</Link>.
        </p>
      ) : (
        <div className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
          {scans.map((scan) => (
            <Link
              key={String(scan._id)}
              href={`/results/${scan._id}`}
              className="flex items-center justify-between gap-4 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{scan.finalUrl ?? scan.url}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(scan.createdAt as Date).toLocaleString()}
                  {scan.monitoringEnabled ? " · monitoring on" : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                  scan.score >= 80
                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                    : scan.score >= 50
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {scan.score}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
