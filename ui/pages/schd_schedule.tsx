import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import CronBuilder from "./schd_cron_builder";
import { SchdClockToggle, useSchdClock } from "./schd_clock_mode";

interface PageProps {
  portfolio: string;
  org: string;
  tool: string;
}

type Heartbeat = {
  _id?: string;
  handle?: string;
  name?: string;
  status?: string;
  schedule_expression?: string;
  subscriber_count?: string;
  last_fired_at?: string;
  interval_seconds?: string;
};

type Job = {
  _id?: string;
  name?: string;
  handler?: string;
  enabled?: string;
  schedule_kind?: string;
  heartbeat_id?: string;
  schedule_expression?: string;
  run_at?: string;
  last_run_at?: string;
  last_run_status?: string;
  run_lease_until?: string;
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.accessToken}`,
  };
}

function formatTs(value?: string) {
  if (!value) return "—";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return value;
  try {
    return new Date(n * 1000).toLocaleString();
  } catch {
    return value;
  }
}

function isEnabled(value?: string) {
  return String(value || "true").toLowerCase() !== "false";
}

type ScheduleKind = "heartbeat" | "custom" | "once";

type CreateForm = {
  schedule_kind: ScheduleKind;
  name: string;
  handler: string;
  heartbeat_id: string;
  schedule_expression: string;
  run_at_local: string;
  handler_payload: string;
  description: string;
};

const EMPTY_FORM: CreateForm = {
  schedule_kind: "heartbeat",
  name: "",
  handler: "",
  heartbeat_id: "every_5_minutes",
  schedule_expression: "cron(0 9 ? * MON-FRI *)",
  run_at_local: "",
  handler_payload: "",
  description: "",
};

function localToUnix(value: string) {
  if (!value) return "";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "";
  return String(Math.floor(ms / 1000));
}

export default function SchdSchedule({ portfolio, org }: PageProps) {
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [cronKey, setCronKey] = useState(0);
  const [origin, setOrigin] = useSchdClock();
  const [machineId, setMachineId] = useState("");
  const apiBase = import.meta.env.VITE_API_URL;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hbRes, jobRes, clockRes] = await Promise.all([
        fetch(`${apiBase}/_schd/${portfolio}/${org}/heartbeats`, { headers: authHeaders() }),
        fetch(`${apiBase}/_schd/${portfolio}/${org}/jobs?origin=${origin}`, { headers: authHeaders() }),
        fetch(`${apiBase}/_schd/clock`, { headers: authHeaders() }),
      ]);
      const hbData = await hbRes.json().catch(() => ({}));
      const jobData = await jobRes.json().catch(() => ({}));
      if (!hbRes.ok || hbData.success === false) {
        setError("Could not load heartbeats — run Install to seed the catalog");
        setHeartbeats([]);
      } else {
        setHeartbeats(Array.isArray(hbData.items) ? hbData.items : []);
      }
      setJobs(Array.isArray(jobData.items) ? jobData.items : []);
      const clockData = await clockRes.json().catch(() => ({}));
      const mid = String(jobData.schd_machine_id || clockData.schd_machine_id || "");
      if (mid) setMachineId(mid);
    } catch {
      setError("Could not load schedule");
    } finally {
      setLoading(false);
    }
  }, [apiBase, portfolio, org, origin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchEnabled(jobId: string, enabled: boolean) {
    await fetch(`${apiBase}/_schd/${portfolio}/${org}/jobs/${jobId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ enabled: enabled ? "true" : "false" }),
    });
    void load();
  }

  async function runNow(jobId: string) {
    await fetch(`${apiBase}/_schd/${portfolio}/${org}/jobs/${jobId}/run`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ trigger: "manual", author: sessionStorage.cu_handle || "ui" }),
    });
    void load();
  }

  async function unsubscribe(jobId: string) {
    await fetch(`${apiBase}/_schd/${portfolio}/${org}/jobs/${jobId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    void load();
  }

  async function seedCatalog() {
    setSeeding(true);
    setFormError(null);
    setFormNotice(null);
    try {
      const res = await fetch(`${apiBase}/_schd/${portfolio}/${org}/heartbeats/ensure`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setFormError(data.message || "Could not seed the heartbeat catalog");
        return;
      }
      setFormNotice("Heartbeat catalog is ready.");
      await load();
    } catch {
      setFormError("Could not seed the heartbeat catalog");
    } finally {
      setSeeding(false);
    }
  }

  function startJobForHeartbeat(handle: string) {
    setForm((prev) => ({
      ...prev,
      schedule_kind: "heartbeat",
      heartbeat_id: handle,
    }));
    setFormError(null);
    setFormNotice(null);
    document.getElementById("schd-create-job")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createJob() {
    const handler = form.handler.trim();
    if (!handler || !handler.includes("/")) {
      setFormError("Handler is required in the form extension/handler, e.g. pes/wakeup");
      return;
    }
    if (form.handler_payload.trim()) {
      try {
        JSON.parse(form.handler_payload);
      } catch {
        setFormError("Handler payload must be valid JSON");
        return;
      }
    }
    const payload: Record<string, string> = {
      schedule_kind: form.schedule_kind,
      schedule_origin: origin,
      handler,
      name: form.name.trim() || handler,
      description: form.description.trim(),
      handler_payload: form.handler_payload.trim() || "{}",
    };
    if (form.schedule_kind === "heartbeat") {
      if (!form.heartbeat_id) {
        setFormError("Pick a heartbeat");
        return;
      }
      payload.heartbeat_id = form.heartbeat_id;
    } else if (form.schedule_kind === "custom") {
      if (!form.schedule_expression.trim()) {
        setFormError("Schedule expression is required, e.g. rate(5 minutes) or cron(0 9 ? * MON *)");
        return;
      }
      payload.schedule_expression = form.schedule_expression.trim();
    } else {
      const runAt = localToUnix(form.run_at_local);
      if (!runAt) {
        setFormError("Pick a run-at time");
        return;
      }
      payload.run_at = runAt;
    }

    setSaving(true);
    setFormError(null);
    setFormNotice(null);
    try {
      const res = await fetch(`${apiBase}/_schd/${portfolio}/${org}/jobs`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setFormError(data.message || "Could not create the job");
        return;
      }
      setForm((prev) => ({
        ...EMPTY_FORM,
        schedule_kind: prev.schedule_kind,
        heartbeat_id: prev.heartbeat_id,
      }));
      setCronKey((key) => key + 1);
      setFormNotice(`Created ${data.job?.name || handler}`);
      await load();
    } catch {
      setFormError("Could not create the job");
    } finally {
      setSaving(false);
    }
  }

  const customJobs = useMemo(
    () => jobs.filter((j) => j.schedule_kind === "custom"),
    [jobs],
  );
  const onceJobs = useMemo(
    () => jobs.filter((j) => j.schedule_kind === "once"),
    [jobs],
  );

  function jobsForHeartbeat(handle: string) {
    return jobs.filter((j) => j.schedule_kind === "heartbeat" && j.heartbeat_id === handle);
  }

  function jobRow(job: Job) {
    const id = String(job._id || "");
    return (
      <tr key={id} className="border-b last:border-0">
        <td className="px-3 py-2">{job.name || "—"}</td>
        <td className="px-3 py-2 font-mono text-xs">{job.handler || "—"}</td>
        <td className="px-3 py-2 text-xs">{isEnabled(job.enabled) ? "enabled" : "paused"}</td>
        <td className="px-3 py-2 text-xs">{job.last_run_status || "—"}</td>
        <td className="px-3 py-2 text-xs">{formatTs(job.last_run_at)}</td>
        <td className="px-3 py-2 text-xs">{job.schedule_expression || formatTs(job.run_at)}</td>
        <td className="px-3 py-2 text-right space-x-1">
          <Button variant="ghost" size="sm" onClick={() => void runNow(id)}>
            Run
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void patchEnabled(id, !isEnabled(job.enabled))}
          >
            {isEnabled(job.enabled) ? "Pause" : "Resume"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void unsubscribe(id)}>
            Remove
          </Button>
        </td>
      </tr>
    );
  }

  function jobTable(rows: Job[]) {
    if (!rows.length) {
      return <p className="text-sm text-muted-foreground">No jobs in this group.</p>;
    }
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Job</th>
              <th className="px-3 py-2 font-medium">Handler</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
              <th className="px-3 py-2 font-medium">Last status</th>
              <th className="px-3 py-2 font-medium">Last run</th>
              <th className="px-3 py-2 font-medium">Cadence</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>{rows.map(jobRow)}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>
            {origin === "local"
              ? "Local scheduler on this laptop (ebe). Cloud EventBridge keeps running production jobs."
              : "Cloud EventBridge schedules for this org."}{" "}
            Jobs hanging from shared heartbeats, custom schedules, and one-time runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SchdClockToggle origin={origin} onChange={setOrigin} machineId={machineId} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
            <Button variant="secondary" onClick={() => void seedCatalog()} disabled={seeding}>
              {seeding ? "Seeding…" : heartbeats.length ? "Reseed catalog" : "Seed heartbeat catalog"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && heartbeats.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No heartbeats in this org yet. Seed the catalog, then add a job that hangs from
              every_5_minutes (or another cadence).
            </p>
          )}
        </CardContent>
      </Card>

      <Card id="schd-create-job">
        <CardHeader>
          <CardTitle className="text-base">New job</CardTitle>
          <CardDescription>
            Subscribe a handler to a shared heartbeat, or create a custom schedule / one-time
            run. Example: handler <span className="font-mono">pes/wakeup</span> on{" "}
            <span className="font-mono">every_5_minutes</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Schedule</Label>
              <Select
                value={form.schedule_kind}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, schedule_kind: value as ScheduleKind }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="heartbeat">Heartbeat (shared cadence)</SelectItem>
                  <SelectItem value="custom">Custom schedule</SelectItem>
                  <SelectItem value="once">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.schedule_kind === "heartbeat" && (
              <div className="space-y-1.5">
                <Label>Heartbeat</Label>
                <Select
                  value={form.heartbeat_id}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, heartbeat_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a cadence" />
                  </SelectTrigger>
                  <SelectContent>
                    {(heartbeats.length
                      ? heartbeats
                      : [
                          { handle: "every_1_minute", name: "Every 1 minute" },
                          { handle: "every_5_minutes", name: "Every 5 minutes" },
                          { handle: "every_15_minutes", name: "Every 15 minutes" },
                          { handle: "every_1_hour", name: "Every 1 hour" },
                          { handle: "every_1_day", name: "Every 1 day" },
                        ]
                    ).map((hb) => {
                      const handle = String(hb.handle || hb._id || "");
                      return (
                        <SelectItem key={handle} value={handle}>
                          {hb.name || handle}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.schedule_kind === "custom" && (
              <CronBuilder
                key={cronKey}
                value={form.schedule_expression}
                onChange={(expression) =>
                  setForm((prev) => ({ ...prev, schedule_expression: expression }))
                }
              />
            )}
            {form.schedule_kind === "once" && (
              <div className="space-y-1.5">
                <Label htmlFor="schd-run-at">Run at</Label>
                <Input
                  id="schd-run-at"
                  type="datetime-local"
                  value={form.run_at_local}
                  onChange={(e) => setForm((prev) => ({ ...prev, run_at_local: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="schd-handler">Handler</Label>
              <Input
                id="schd-handler"
                className="font-mono"
                placeholder="extension/handler"
                value={form.handler}
                onChange={(e) => setForm((prev) => ({ ...prev, handler: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schd-name">Name</Label>
              <Input
                id="schd-name"
                placeholder="defaults to the handler"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="schd-description">Description</Label>
              <Input
                id="schd-description"
                placeholder="optional"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="schd-payload">Handler payload (JSON)</Label>
              <Textarea
                id="schd-payload"
                className="font-mono min-h-[88px]"
                placeholder='{"cycle":"ops"}'
                value={form.handler_payload}
                onChange={(e) => setForm((prev) => ({ ...prev, handler_payload: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void createJob()} disabled={saving}>
              {saving ? "Creating…" : "Create job"}
            </Button>
            {formNotice && <p className="text-sm text-muted-foreground">{formNotice}</p>}
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </CardContent>
      </Card>

      {heartbeats.map((hb) => {
        const handle = String(hb.handle || hb._id || "");
        return (
          <Card key={handle}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">{hb.name || handle}</CardTitle>
                <CardDescription>
                  {hb.schedule_expression} · {hb.status || "disabled"} ·{" "}
                  {origin === "local"
                    ? `${jobsForHeartbeat(handle).length} local job(s)`
                    : `${hb.subscriber_count || "0"} subscribers`}{" "}
                  · last fired {formatTs(hb.last_fired_at)}
                </CardDescription>
              </div>
              <Button variant="secondary" size="sm" onClick={() => startJobForHeartbeat(handle)}>
                Add job
              </Button>
            </CardHeader>
            <CardContent>{jobTable(jobsForHeartbeat(handle))}</CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom schedule</CardTitle>
          <CardDescription>Jobs with their own cron expression.</CardDescription>
        </CardHeader>
        <CardContent>{jobTable(customJobs)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">One-time</CardTitle>
          <CardDescription>Due-checked on the 1-minute heartbeat.</CardDescription>
        </CardHeader>
        <CardContent>{jobTable(onceJobs)}</CardContent>
      </Card>
    </div>
  );
}
