import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SchdClockToggle, useSchdClock } from "./schd_clock_mode";

interface PageProps {
  portfolio: string;
  org: string;
  tool: string;
}

type ActivityEntry = {
  event_id?: string;
  ts?: string;
  event_type?: string;
  summary?: string;
  trigger?: string;
  schd_jobs_id?: string;
  heartbeat_id?: string;
  refs?: Record<string, unknown>;
  detail_s3_path?: string;
  has_detail?: boolean;
};

const EVENT_TYPES = [
  { value: "all", label: "All events" },
  { value: "executed", label: "Executed" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

function formatTs(ts?: string) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function SchdActivity({ portfolio, org }: PageProps) {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState("7");
  const [eventType, setEventType] = useState("all");
  const [jobId, setJobId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [origin, setOrigin] = useSchdClock();
  const [machineId, setMachineId] = useState("");

  const apiBase = import.meta.env.VITE_API_URL;
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.accessToken}`,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        days: String(Number(days) || 7),
        limit: "150",
      });
      if (eventType !== "all") params.set("event_type", eventType);
      if (jobId.trim()) params.set("schd_jobs_id", jobId.trim());
      params.set("origin", origin);
      const [res, clockRes] = await Promise.all([
        fetch(`${apiBase}/_schd/${portfolio}/${org}/activity?${params.toString()}`, {
          headers: authHeaders,
        }),
        fetch(`${apiBase}/_schd/clock`, { headers: authHeaders }),
      ]);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setError("Could not load activity");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      const clockData = await clockRes.json().catch(() => ({}));
      const mid = String(data.schd_machine_id || clockData.schd_machine_id || "");
      if (mid) setMachineId(mid);
    } catch {
      setError("Could not load activity");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, portfolio, org, days, eventType, jobId, origin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadDetail(entry: ActivityEntry) {
    const id = String(entry.event_id || "");
    if (!id) return;
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    if (!entry.detail_s3_path && !entry.has_detail) return;
    setDetailLoading(true);
    try {
      const params = origin === "local" ? "?origin=local" : "";
      const res = await fetch(`${apiBase}/_schd/${portfolio}/${org}/activity/${id}${params}`, {
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      setDetail(data.detail ?? data.entry ?? null);
    } catch {
      setDetail({ error: "Failed to load detail" });
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            {origin === "local"
              ? "Local scheduler history for this laptop (ebe tmp log — not production S3)."
              : "Cloud EventBridge execution history for this org."}{" "}
            Compact rows live in a daily index; expand a row for handler input and output.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SchdClockToggle origin={origin} onChange={setOrigin} machineId={machineId} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="activity-days">Days</Label>
              <Input
                id="activity-days"
                type="number"
                min={1}
                max={31}
                className="w-24"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 min-w-[180px]">
              <Label>Event type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-job">Job id</Label>
              <Input
                id="activity-job"
                className="w-56"
                placeholder="optional"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Trigger</th>
                    <th className="px-3 py-2 font-medium">Job</th>
                    <th className="px-3 py-2 font-medium">Summary</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => {
                    const id = String(entry.event_id || entry.ts || Math.random());
                    const isOpen = expandedId === String(entry.event_id || "");
                    return (
                      <Fragment key={id}>
                        <tr className="border-b last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 align-top text-xs">
                            {formatTs(entry.ts)}
                          </td>
                          <td className="px-3 py-2 align-top font-mono text-xs">
                            {entry.event_type || "—"}
                          </td>
                          <td className="px-3 py-2 align-top text-xs">{entry.trigger || "—"}</td>
                          <td className="px-3 py-2 align-top font-mono text-xs">
                            {entry.schd_jobs_id || "—"}
                          </td>
                          <td className="px-3 py-2 align-top">{entry.summary || "—"}</td>
                          <td className="px-3 py-2 align-top">
                            {(entry.detail_s3_path || entry.has_detail || entry.refs) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void loadDetail(entry)}
                              >
                                {isOpen ? "Hide" : "Detail"}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b bg-muted/20">
                            <td colSpan={6} className="px-3 py-3">
                              {entry.refs && Object.keys(entry.refs).length > 0 && (
                                <pre className="mb-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs">
                                  {JSON.stringify(entry.refs, null, 2)}
                                </pre>
                              )}
                              {(entry.detail_s3_path || entry.has_detail) && (
                                <>
                                  {detailLoading && (
                                    <p className="text-xs text-muted-foreground">Loading detail…</p>
                                  )}
                                  {!detailLoading && detail != null && (
                                    <pre className="max-h-96 overflow-auto rounded bg-background p-2 text-xs">
                                      {JSON.stringify(detail, null, 2)}
                                    </pre>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
