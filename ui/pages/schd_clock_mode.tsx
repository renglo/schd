import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type SchdClockOrigin = "cloud" | "local";

const STORAGE_KEY = "schd-clock";

export function useSchdClock(): [SchdClockOrigin, (next: SchdClockOrigin) => void] {
  const [origin, setOrigin] = useState<SchdClockOrigin>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "local" ? "local" : "cloud";
    } catch {
      return "cloud";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, origin);
    } catch {
      /* ignore */
    }
  }, [origin]);

  return [origin, setOrigin];
}

export function SchdClockToggle({
  origin,
  onChange,
  machineId,
}: {
  origin: SchdClockOrigin;
  onChange: (next: SchdClockOrigin) => void;
  machineId?: string;
}) {
  const shortId = machineId ? machineId.replace(/-/g, "").slice(0, 8) : "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-border p-0.5">
        <Button
          type="button"
          size="sm"
          variant={origin === "cloud" ? "default" : "ghost"}
          onClick={() => onChange("cloud")}
        >
          Cloud
        </Button>
        <Button
          type="button"
          size="sm"
          variant={origin === "local" ? "default" : "ghost"}
          onClick={() => onChange("local")}
        >
          Local
        </Button>
      </div>
      {origin === "local" && (
        <p className="text-xs text-muted-foreground">
          This machine only{shortId ? ` · ${shortId}` : ""}. EventBridge is unchanged. No promote
          — duplicate a job in Cloud to run it there.
        </p>
      )}
    </div>
  );
}
