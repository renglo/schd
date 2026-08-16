import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Recurrence = "daily" | "weekdays" | "weekly" | "monthly";

const WEEKDAYS = [
  { value: "SUN", label: "Sun" },
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" },
] as const;

const MINUTES = ["0", "5", "10", "15", "20", "30", "45", "*", "*/5", "*/10", "*/15", "*/30"];
const HOURS = ["*", "*/2", "*/3", "*/4", "*/6", "*/12", ...Array.from({ length: 24 }, (_, i) => String(i))];
const MONTHS = [
  { value: "*", label: "Every month" },
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function compactWeekdays(selected: string[]) {
  if (selected.length === 0) return "?";
  if (selected.length === 7) return "*";
  if (sameSet(selected, ["MON", "TUE", "WED", "THU", "FRI"])) return "MON-FRI";
  if (sameSet(selected, ["SAT", "SUN"])) return "SAT-SUN";
  const order = WEEKDAYS.map((d) => d.value);
  return [...selected].sort((x, y) => order.indexOf(x as (typeof order)[number]) - order.indexOf(y as (typeof order)[number])).join(",");
}

function buildCron(fields: {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  year: string;
}) {
  let dayOfMonth = fields.dayOfMonth;
  let dayOfWeek = fields.dayOfWeek;
  const weekSet = dayOfWeek !== "?" && dayOfWeek !== "";
  const monthDaySet = dayOfMonth !== "?" && dayOfMonth !== "";
  if (weekSet && monthDaySet) {
    if (dayOfWeek !== "*") dayOfMonth = "?";
    else dayOfWeek = "?";
  }
  if (dayOfMonth === "?" && dayOfWeek === "?") {
    dayOfMonth = "*";
  }
  return `cron(${fields.minute} ${fields.hour} ${dayOfMonth} ${fields.month} ${dayOfWeek} ${fields.year})`;
}

function describeCron(expression: string) {
  const match = /^cron\((\S+) (\S+) (\S+) (\S+) (\S+) (\S+)\)$/.exec(expression);
  if (!match) return "Cron (UTC)";
  const [, minute, hour, dom, month, dow] = match;
  const time =
    minute.startsWith("*/") || hour === "*" || hour.startsWith("*/")
      ? `minute ${minute}, hour ${hour}`
      : `${hour.padStart(2, "0")}:${minute.padStart(2, "0")} UTC`;
  if (dow === "MON-FRI") return `Weekdays at ${time}`;
  if (dow !== "?" && dow !== "*") return `${dow} at ${time}`;
  if (dom !== "?" && dom !== "*") return `Day ${dom} of ${month === "*" ? "every month" : `month ${month}`} at ${time}`;
  return `Daily at ${time}`;
}

export default function CronBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (expression: string) => void;
}) {
  const [recurrence, setRecurrence] = useState<Recurrence>("weekdays");
  const [minute, setMinute] = useState("0");
  const [hour, setHour] = useState("9");
  const [dayOfMonth, setDayOfMonth] = useState("?");
  const [month, setMonth] = useState("*");
  const [year] = useState("*");
  const [weekdays, setWeekdays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);

  const dayOfWeek = useMemo(() => {
    if (recurrence === "daily" || recurrence === "monthly") return "?";
    return compactWeekdays(weekdays);
  }, [recurrence, weekdays]);

  const expression = useMemo(
    () =>
      buildCron({
        minute,
        hour,
        dayOfMonth: recurrence === "monthly" ? dayOfMonth : recurrence === "daily" ? "*" : "?",
        month,
        dayOfWeek,
        year,
      }),
    [minute, hour, dayOfMonth, month, dayOfWeek, year, recurrence],
  );

  useEffect(() => {
    onChange(expression);
  }, [expression]);

  function applyRecurrence(next: Recurrence) {
    setRecurrence(next);
    if (next === "daily") {
      setDayOfMonth("*");
      setWeekdays([]);
    } else if (next === "weekdays") {
      setDayOfMonth("?");
      setWeekdays(["MON", "TUE", "WED", "THU", "FRI"]);
    } else if (next === "weekly") {
      setDayOfMonth("?");
      if (weekdays.length === 0) setWeekdays(["MON"]);
    } else {
      setDayOfMonth((prev) => (prev === "?" || prev === "*" ? "1" : prev));
      setWeekdays([]);
    }
  }

  function toggleWeekday(day: string) {
    setWeekdays((prev) => {
      const next = prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day];
      return next.length ? next : [day];
    });
  }

  return (
    <div className="space-y-3 sm:col-span-2 rounded-md border border-border p-3">
      <div className="space-y-1.5">
        <Label>Recurrence</Label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["daily", "Daily"],
              ["weekdays", "Weekdays"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyRecurrence(id)}
              className={
                recurrence === id
                  ? "rounded-md bg-gray-200 px-3 py-1.5 text-sm"
                  : "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Hour (UTC)</Label>
          <Select value={hour} onValueChange={setHour}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "*" ? "Every hour" : item.startsWith("*/") ? `Every ${item.slice(2)} hours` : `${item.padStart(2, "0")}:00`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Minute</Label>
          <Select value={minute} onValueChange={setMinute}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "*" ? "Every minute" : item.startsWith("*/") ? `Every ${item.slice(2)} minutes` : `:${item.padStart(2, "0")}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {recurrence === "weekly" && (
        <div className="space-y-1.5">
          <Label>Days of week</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const on = weekdays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekday(day.value)}
                  className={
                    on
                      ? "rounded-md bg-gray-200 px-2.5 py-1 text-xs"
                      : "rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground"
                  }
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {recurrence === "monthly" && (
        <div className="space-y-1.5 max-w-[160px]">
          <Label>Day of month</Label>
          <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((day) => (
                <SelectItem key={day} value={day}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="overflow-x-auto rounded-md bg-muted/40 px-3 py-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pr-3 font-medium">Minute</th>
              <th className="pr-3 font-medium">Hour</th>
              <th className="pr-3 font-medium">Day</th>
              <th className="pr-3 font-medium">Month</th>
              <th className="pr-3 font-medium">Weekday</th>
              <th className="font-medium">Year</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-mono">
              <td className="pr-3 py-1">{minute}</td>
              <td className="pr-3 py-1">{hour}</td>
              <td className="pr-3 py-1">{recurrence === "monthly" ? dayOfMonth : recurrence === "daily" ? "*" : "?"}</td>
              <td className="pr-3 py-1">{month}</td>
              <td className="pr-3 py-1">{dayOfWeek}</td>
              <td className="py-1">{year}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm">
        <span className="font-mono text-xs">{expression}</span>
        <span className="ml-2 text-muted-foreground">{describeCron(expression)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Cron times are UTC and use six fields. Day-of-month and weekday cannot both be set —
        the builder keeps one as <span className="font-mono">?</span>.
      </p>
    </div>
  );
}
