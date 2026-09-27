import {
  ArrowLeft,
  Braces,
  CircleHelp,
  Copy,
  Check,
  Pencil,
} from "lucide-react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';


import { Button } from "@/components/ui/button"
import {
Card,
CardContent,
CardFooter,
CardHeader,
CardTitle,
} from "@/components/ui/card"


import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import DialogPutWide from '@/components/console/dialog-put-wide'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"


import { formatBlueprintFieldValue } from "@/lib/blueprint-field-display"
import { fieldLayer, overloadBlueprint, parseStructuredFieldJson } from "@/lib/console_utils"


interface Blueprint {
  label: string;
  // Add other properties as needed
  [key: string]: any; // This allows for additional dynamic properties if necessary
}


interface DataType {
name?: string;
_id?: string;
[key: string]: any; // Additional properties
}

interface FieldDictionary {
[key: string]: {
  label?: string;
  hint?: string;
  widget?: string;
  order?: number | string;
  layer?: number | string;
};
}

interface BlueprintField {
name: string;
label?: string;
hint?: string;
widget?: string;
}

interface ToolDataCRUDProps {
  portfolio: string;
  org: string;
  tool: string;
  ring: string;
  query?: Record<string, string>;
}

type ToolInputField = {
  name: string;
  label: string;
  help: string;
  widget: "text" | "textarea" | "select";
  required: boolean;
  options: string[];
  defaultValue: string;
};

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function fieldsFromToolInput(parsed: unknown): ToolInputField[] {
  if (parsed == null || parsed === "_" || parsed === "") return [];

  if (Array.isArray(parsed)) {
    return parsed.flatMap((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) return [];
      const row = field as Record<string, unknown>;
      const name = textOf(row.name);
      if (!name) return [];
      const widget = row.type === "array" || row.type === "object" ? "textarea" : "text";
      return [{
        name,
        label: textOf(row.hint) || textOf(row.label) || name,
        help: textOf(row.hint),
        widget,
        required: Boolean(row.required),
        options: [],
        defaultValue: textOf(row.default),
      }];
    });
  }

  if (typeof parsed !== "object") return [];
  const schema = parsed as Record<string, unknown>;
  const properties = schema.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    const required = new Set(
      Array.isArray(schema.required) ? schema.required.map((name) => String(name)) : [],
    );
    return Object.entries(properties as Record<string, unknown>).flatMap(([name, prop]) => {
      const row = prop && typeof prop === "object" && !Array.isArray(prop)
        ? prop as Record<string, unknown>
        : {};
      const options = Array.isArray(row.enum) ? row.enum.map((item) => String(item)) : [];
      const kind = textOf(row.type);
      const widget = options.length
        ? "select"
        : kind === "array" || kind === "object"
          ? "textarea"
          : "text";
      const title = textOf(row.title);
      const description = textOf(row.description);
      return [{
        name,
        label: title || description || name,
        help: description && description !== title ? description : "",
        widget,
        required: required.has(name),
        options,
        defaultValue: textOf(row.default),
      }];
    });
  }

  return Object.entries(schema).flatMap(([name, field]) => {
    if (["type", "required", "additionalProperties", "$schema"].includes(name)) return [];
    if (typeof field === "string") {
      return [{
        name,
        label: field || name,
        help: field,
        widget: "text" as const,
        required: false,
        options: [],
        defaultValue: "",
      }];
    }
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      return [{
        name,
        label: name,
        help: "",
        widget: "text" as const,
        required: false,
        options: [],
        defaultValue: "",
      }];
    }
    const row = field as Record<string, unknown>;
    const kind = textOf(row.type);
    return [{
      name: textOf(row.name) || name,
      label: textOf(row.hint) || textOf(row.title) || textOf(row.label) || name,
      help: textOf(row.hint) || textOf(row.description),
      widget: kind === "array" || kind === "object" ? "textarea" as const : "text" as const,
      required: Boolean(row.required),
      options: [],
      defaultValue: textOf(row.default),
    }];
  });
}

const syntaxStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'transparent',
    margin: 0,
    padding: '1rem',
    minWidth: 0,
    overflowX: 'auto',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
  },
  'pre[class*="language-"] > code[class*="language-"]': {
    ...oneDark['pre[class*="language-"] > code[class*="language-"]'],
    background: 'transparent',
  },
  'pre[class*="language-"] > code[class*="language-"]::before': { display: 'none' },
  'pre[class*="language-"] > code[class*="language-"]::after': { display: 'none' },
};

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-1 min-w-0 w-full" style={{ contain: 'inline-size' }}>
      <div className="text-xs text-gray-400 bg-neutral-800/70 font-mono px-2 py-2 rounded-t flex flex-row items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
        <span className="flex items-center gap-1 min-w-0 truncate">{label} <Braces className="h-4 w-4 shrink-0" /></span>
      </div>
      <div className="text-sm bg-neutral-700 text-white rounded-b font-mono overflow-x-auto min-w-0 w-full">
        <SyntaxHighlighter language="json" style={syntaxStyle}>
          {text}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

const CONFIG_ID = "00000000-0000-0000-0000-000000000000";

type SyncRecord = {
  synced_at?: string;
  extensions?: number;
  found?: number;
  mapped?: number;
  created?: number;
  updated?: number;
  deleted?: number;
  unchanged?: number;
  skipped?: number;
};

type CatalogHandler = {
  id: string;
  name: string;
  route: string;
  extension: string;
  handler: string;
};

function storageKey(portfolio: string, org: string) {
  return `schd-handler-sync:${portfolio}:${org}`;
}

function newerRecord(a: SyncRecord | null, b: SyncRecord | null) {
  if (!a) return b;
  if (!b) return a;
  return String(a.synced_at || "") >= String(b.synced_at || "") ? a : b;
}

function formatWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function numberOrUndefined(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseSync(raw: unknown): SyncRecord | null {
  if (!raw || raw === "_") return null;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    try {
      return parseSync(JSON.parse(text));
    } catch {
      return null;
    }
  }
  const record = asRecord(raw);
  if (!record || !record.synced_at) return null;
  return {
    synced_at: String(record.synced_at),
    extensions: numberOrUndefined(record.extensions),
    found: numberOrUndefined(record.found),
    mapped: numberOrUndefined(record.mapped),
    created: numberOrUndefined(record.created),
    updated: numberOrUndefined(record.updated),
    deleted: numberOrUndefined(record.deleted),
    unchanged: numberOrUndefined(record.unchanged),
    skipped: numberOrUndefined(record.skipped),
  };
}

function unwrapSyncRun(data: unknown): SyncRecord | null {
  const root = asRecord(data);
  if (!root) return null;
  const output = asRecord(root.output) || root;
  const inner = asRecord(output.output) || output;
  const found = numberOrUndefined(inner.handlers ?? inner.found);
  const created = Array.isArray(inner.created) ? inner.created.length : numberOrUndefined(inner.created);
  const updated = Array.isArray(inner.updated) ? inner.updated.length : numberOrUndefined(inner.updated);
  const deleted = Array.isArray(inner.deleted) ? inner.deleted.length : numberOrUndefined(inner.deleted);
  const unchanged = numberOrUndefined(inner.unchanged) ?? 0;
  const mapped = numberOrUndefined(inner.mapped) ?? (created ?? 0) + (updated ?? 0) + unchanged;
  if (found === undefined && mapped === 0 && !inner.synced_at) return null;
  return {
    synced_at: typeof inner.synced_at === "string" ? inner.synced_at : new Date().toISOString(),
    extensions: numberOrUndefined(inner.extensions),
    found,
    mapped,
    created,
    updated,
    deleted,
    unchanged,
    skipped: numberOrUndefined(inner.skipped),
  };
}

function itemsFrom(data: unknown) {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  if (Array.isArray(record.items)) return record.items;
  return [];
}

function catalogHandlers(items: unknown[]): CatalogHandler[] {
  const handlers: CatalogHandler[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const id = String(row._id || "").trim();
    const route = String(row.handler || row.key || "").trim();
    if (!id || !route) continue;
    const slash = route.indexOf("/");
    const extension = slash > 0 ? route.slice(0, slash) : "other";
    const handler = slash > 0 ? route.slice(slash + 1) : route;
    handlers.push({
      id,
      name: String(row.name || handler),
      route,
      extension,
      handler,
    });
  }
  handlers.sort((a, b) => a.route.localeCompare(b.route));
  return handlers;
}

function groupByExtension(handlers: CatalogHandler[]) {
  const groups = new Map<string, CatalogHandler[]>();
  for (const handler of handlers) {
    const list = groups.get(handler.extension) || [];
    list.push(handler);
    groups.set(handler.extension, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function presetToolId(query?: Record<string, string>) {
  const id = query?.id?.trim() || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export default function SchdToolProbe({ portfolio, org, tool, query }: ToolDataCRUDProps) {


  //const [data, setData] = useState({}); // State to hold table data
  const [data, setData] = useState<DataType>({});

  //const [loading, setLoading] = useState(true); // State to manage loading status
  const [error, setError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [fieldsDictionary, setFieldsDictionary] = useState<FieldDictionary>({});
  const [blueprint, setBlueprint] = useState<Blueprint>({ label: '' });
  const presetId = presetToolId(query);
  const [toolId, setToolId] = useState<string | null>(presetId);
  const [catalog, setCatalog] = useState<CatalogHandler[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncRecord, setSyncRecord] = useState<SyncRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [inputs, setInputs] = useState<ToolInputField[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [pane, setPane] = useState<"in" | "out">("in");

  const [response, setResponse] = useState<any>(null);
  const [errorResponse, setErrorResponse] = useState<any>(null);


  console.log('TGC>Portfolio:',portfolio)
  console.log('TGC>Org:',org)
  console.log('TGC>Tool:',tool)

  const ring = 'schd_tools';
  const apiBase = import.meta.env.VITE_API_URL;

  const refreshCatalog = useCallback(async () => {
      const items: unknown[] = [];
      let lastkey: string | null = null;
      const seen = new Set<string>();
      while (seen.size < 20) {
          const params = new URLSearchParams({ paged: "1", limit: "500" });
          if (lastkey) params.set("lastkey", lastkey);
          const toolsRes = await fetch(`${apiBase}/_data/${portfolio}/${org}/schd_tools?${params}`, {
              headers: {
                  Authorization: `Bearer ${sessionStorage.accessToken}`,
              },
          });
          const tools = await toolsRes.json().catch(() => ({}));
          items.push(...itemsFrom(tools));
          const next = tools?.last_id ? String(tools.last_id) : "";
          if (!next || seen.has(next)) break;
          seen.add(next);
          lastkey = next;
      }
      setCatalog(catalogHandlers(items));
  }, [apiBase, portfolio, org]);

  const loadCatalog = useCallback(async () => {
      setCatalogLoading(true);
      setSyncError(null);
      try {
          const configRes = await fetch(`${apiBase}/_data/${portfolio}/${org}/schd_config/${CONFIG_ID}`, {
              headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
          });
          const config = await configRes.json().catch(() => ({}));
          const saved = configRes.ok && config?.success !== false ? parseSync(config.handler_sync) : null;
          let local: SyncRecord | null = null;
          try {
              local = parseSync(sessionStorage.getItem(storageKey(portfolio, org)));
          } catch {
              local = null;
          }
          const chosen = newerRecord(saved, local);
          if (chosen) setSyncRecord(chosen);
          await refreshCatalog();
      } catch {
          setSyncError("Could not load the catalog");
      } finally {
          setCatalogLoading(false);
      }
  }, [apiBase, portfolio, org, refreshCatalog]);

  useEffect(() => {
      void loadCatalog();
  }, [loadCatalog]);



  // 1
  useEffect(() => {
      const fetchBlueprint = async () => {
        try {
          const blueprintResponse = await fetch(`${import.meta.env.VITE_API_URL}/_blueprint/irma/${ring}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionStorage.accessToken}`,
            },
          });
          const blueprintData = await blueprintResponse.json();
          setBlueprint(blueprintData);
          const updated = await overloadBlueprint(blueprintData, portfolio, org);
          if (updated) {
            setBlueprint(updated);
          }
        } catch (err) {
          if (err instanceof Error) {
            setError(err);
          } else {
            setError(new Error("An unknown error occurred"));
          }
          console.log(error)
        }
      };

      void fetchBlueprint();
  }, [ring, portfolio, org]);


  // 2
  useEffect(() => {
      // Function to fetch the input documents
      const fetchData = async () => {
          if (!toolId) return
          try {
          // Fetch Data
          
          const dataResponse = await fetch(`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${toolId}`, {
              method: 'GET',
              headers: {
              'Authorization': `Bearer ${sessionStorage.accessToken}`,
              },
          });
          const response = await dataResponse.json();
          setData(response);

          
      
          } catch (err) {
            if (err instanceof Error) {
              setError(err);  // Now TypeScript knows `err` is of type `Error`.
            } else {
              setError(new Error("An unknown error occurred"));  // Handle other types
            }
            console.log(error)
          } finally {
          //setLoading(false);
          }
      };
      
      fetchData();
  }, [org,refresh,toolId]);



  
  // 3
  useEffect(() => {
      const dictionary: FieldDictionary = {};
      if (blueprint && blueprint.fields) {
          blueprint.fields.forEach((field: BlueprintField) => {
              dictionary[field.name] = field;
          });
      }
      setFieldsDictionary(dictionary);
  }, [blueprint]);


  // Parse tool input schema when data changes (API may return object/array or JSON string)
  useEffect(() => {
      if (!data?.['input']) {
          setInputs([])
          setInputValues({})
          return
      }
      const fields = fieldsFromToolInput(parseStructuredFieldJson(data['input']))
      setInputs(fields)
      setInputValues(fields.reduce((acc, field) => {
          acc[field.name] = field.defaultValue
          return acc
      }, {} as Record<string, string>))
  }, [data, toolId]);

    
  // Function to update the state
  const refreshTool = () => {
      setRefresh(prev => !prev); // Toggle the `refresh` state to trigger useEffect
      //refreshUp();
  };

  const rememberTool = (id: string | null) => {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("id", id);
      else url.searchParams.delete("id");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const openHandler = (id: string) => {
      setToolId(id);
      setResponse(null);
      setErrorResponse(null);
      setPane("in");
      setDetailsOpen(false);
      rememberTool(id);
  };

  const backToMenu = () => {
      setToolId(null);
      setDetailsOpen(false);
      rememberTool(null);
  };

  const runSync = async () => {
      if (syncing) return;
      setSyncing(true);
      setSyncError(null);
      try {
          const res = await fetch(`${apiBase}/_schd/${portfolio}/${org}/call/schd/sync_handlers`, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${sessionStorage.accessToken}`,
              },
              body: JSON.stringify({}),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body?.success === false) {
              const message = body?.message || body?.output || "Sync failed";
              setSyncError(typeof message === "string" ? message : "Sync failed");
              return;
          }
          const next = unwrapSyncRun(body);
          if (next) {
              setSyncRecord(next);
              try {
                  sessionStorage.setItem(storageKey(portfolio, org), JSON.stringify(next));
              } catch {
                  // The org config still stores the same summary when the blueprint accepts it.
              }
          }
          await refreshCatalog();
      } catch {
          setSyncError("Sync failed");
      } finally {
          setSyncing(false);
      }
  };

  const handleInputChange = (key: string, value: string) => {
      // Only normalize tabs to spaces, but preserve all other whitespace
      const cleanedValue = value.replace(/\t/g, ' ');
      setInputValues(prev => ({
          ...prev,
          [key]: cleanedValue
      }));
      setPane("in");
  };

  const requestPayload = {
      ...inputValues,
      ...(data?.['init'] ? { _init: data['init'] } : {}),
      portfolio,
      org,
      ...(data?.['handler'] ? { tool: String(data['handler']).split('/')[0] } : {}),
  };

  const returnedOutput = errorResponse != null
      ? (errorResponse.output ?? errorResponse)
      : (response?.output ?? null);

  const runTool = async () => {
      if (runningRef.current || !data?.['handler']) return;
      runningRef.current = true;
      setRunning(true);
      try {
          const call = await fetch(`${import.meta.env.VITE_API_URL}/_schd/${portfolio}/${org}/call/${data['handler']}`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionStorage.accessToken}`,
              },
              body: JSON.stringify({
                  ...inputValues,
                  ...(data?.['init'] ? { _init: data['init'] } : {}),
              }),
          });
          const body = await call.json().catch(() => ({ error: 'Failed to parse response' }));
          if (call.ok) {
              setResponse(body);
              setErrorResponse(null);
          } else {
              setErrorResponse(body);
              setResponse(null);
          }
      } catch (err) {
          setErrorResponse({
              error: err instanceof Error ? err.message : 'Request failed',
          });
          setResponse(null);
      } finally {
          runningRef.current = false;
          setRunning(false);
          setPane("out");
      }
  };



  const groups = groupByExtension(catalog);
  const extensionCount = catalogLoading ? syncRecord?.extensions : groups.length;
  const handlerCount = catalogLoading ? syncRecord?.found : catalog.length;
  const syncedLabel = formatWhen(syncRecord?.synced_at);

  return (
    <div className="relative mx-auto w-full sm:w-3/4">
      {syncing ? <div className="absolute inset-0 z-20" /> : null}
      <div className={syncing ? "pointer-events-none select-none opacity-40 grayscale" : ""}>
      {!toolId ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <div className="min-w-0 text-sm">
              <span className="font-medium tabular-nums">{catalogLoading && extensionCount === undefined ? "…" : extensionCount ?? "—"}</span>
              {" "}extensions
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="font-medium tabular-nums">{catalogLoading && handlerCount === undefined ? "…" : handlerCount ?? "—"}</span>
              {" "}handlers
              {syncedLabel ? (
                <span className="ml-3 text-xs text-muted-foreground">Synced {syncedLabel}</span>
              ) : null}
              {syncRecord?.created !== undefined ? (
                <span className="ml-3 text-xs text-muted-foreground">
                  {syncRecord.created} created, {syncRecord.updated ?? 0} updated, {syncRecord.unchanged ?? 0} unchanged, {syncRecord.deleted ?? 0} removed
                </span>
              ) : null}
            </div>
            <Button size="sm" onClick={() => void runSync()} disabled={syncing || catalogLoading}>
              {syncing ? "Syncing…" : "Sync handlers"}
            </Button>
          </div>
          {syncError ? (
            <div className="border-b px-4 py-2 text-sm text-red-700">{syncError}</div>
          ) : null}
          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto">
            {groups.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                {catalogLoading ? "Loading handlers…" : "No handlers are in this org yet. Sync to map the ones that are installed."}
              </p>
            ) : groups.map(([extension, handlers]) => (
              <div key={extension}>
                <div className="flex items-center justify-between bg-muted/40 px-4 py-2 text-sm">
                  <span className="font-medium">{extension}</span>
                  <span className="text-xs text-muted-foreground">
                    {handlers.length} handler{handlers.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul>
                  {handlers.map((handler) => (
                    <li key={handler.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-muted/30"
                        onClick={() => openHandler(handler.id)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{handler.name}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">{handler.route}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Button variant="ghost" size="icon" onClick={backToMenu} aria-label="Back to handlers">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{data?.name || "Tool"}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">{data?.handler || data?.key}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(true)} aria-label="Edit tool">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4 text-sm">
              <Card className="flex h-[calc(100dvh-12rem)] min-h-[28rem] flex-col overflow-hidden">
                <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
                    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md border lg:h-full lg:w-96 lg:flex-none lg:shrink-0">
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                              {inputs.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">This tool takes no inputs.</p>
                              ) : null}
                              {inputs.map((field) => (
                                  <div key={field.name} className="flex flex-col space-y-2">
                                      <label className="text-sm font-medium text-gray-700">
                                          {field.label}
                                          {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </label>
                                      {field.help && field.help !== field.label ? (
                                          <p className="text-xs text-muted-foreground">{field.help}</p>
                                      ) : null}
                                      {field.widget === "textarea" ? (
                                          <Textarea
                                              value={inputValues[field.name] || ""}
                                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                                              placeholder={`Enter ${field.name}`}
                                              required={field.required}
                                          />
                                      ) : field.widget === "select" ? (
                                          <select
                                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                              value={inputValues[field.name] || ""}
                                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                                              required={field.required}
                                          >
                                              <option value="">Select {field.name}</option>
                                              {field.options.map((option) => (
                                                  <option key={option} value={option}>{option}</option>
                                              ))}
                                          </select>
                                      ) : (
                                          <Input
                                              value={inputValues[field.name] || ""}
                                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                                              placeholder={`Enter ${field.name}`}
                                              required={field.required}
                                          />
                                      )}
                                  </div>
                              ))}
                      </div>
                      <div className="shrink-0 border-t bg-background p-3">
                          <Button className="w-full" onClick={runTool} disabled={running || !data?.['handler']}>
                              {running ? "Running…" : "Run"}
                          </Button>
                      </div>
                    </div>

                    <Tabs
                        value={pane}
                        onValueChange={(value) => setPane(value as "in" | "out")}
                        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                    >
                        <TabsList className="shrink-0 self-start">
                            <TabsTrigger value="in">IN</TabsTrigger>
                            <TabsTrigger value="out">OUT</TabsTrigger>
                        </TabsList>
                        <TabsContent value="in" className="mt-2 min-h-0 flex-1 overflow-y-auto">
                            <JsonBlock label="IN" data={requestPayload} />
                        </TabsContent>
                        <TabsContent value="out" className="mt-2 min-h-0 flex-1 overflow-y-auto">
                            {returnedOutput == null ? (
                                <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed px-6 text-center text-sm text-muted-foreground">
                                    The handler output shows up here after you run the tool.
                                </div>
                            ) : (
                                <JsonBlock label="OUT" data={returnedOutput} />
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
              </Card>
          </CardContent>
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{data?.name || "Tool"}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {Object.entries(data)
                  .sort(([keyA], [keyB]) => {
                    const orderA = Number(fieldsDictionary[keyA]?.order ?? Number.MAX_SAFE_INTEGER);
                    const orderB = Number(fieldsDictionary[keyB]?.order ?? Number.MAX_SAFE_INTEGER);
                    return orderA - orderB;
                  })
                  .map(([key, value]) => (
                    fieldsDictionary[key]?.widget !== 'image' &&
                    !key.startsWith('_') &&
                    fieldLayer(fieldsDictionary[key] ?? {}) === 1 ? (
                      <div key={key} className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">{fieldsDictionary[key]?.label}</div>
                        <div className="mt-2 flex items-start gap-2">
                          <DialogPutWide
                            selectedKey={key}
                            selectedValue={value}
                            refreshUp={refreshTool}
                            blueprint={blueprint}
                            title="Edit attribute"
                            instructions={fieldsDictionary[key]?.hint ?? ""}
                            path={`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${toolId}`}
                            method="PUT"
                          />
                          <div className="min-w-0 flex-1 text-sm">
                            {formatBlueprintFieldValue(value, key, blueprint)}
                          </div>
                        </div>
                        {fieldsDictionary[key]?.hint ? (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <CircleHelp className="h-3 w-3" />
                            {fieldsDictionary[key]?.hint}
                          </div>
                        ) : null}
                      </div>
                    ) : null
                  ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Last updated {data?._modified || "—"}
              </div>
            </DialogContent>
          </Dialog>
        </Card>
      )}
      </div>
    </div>
  )
}