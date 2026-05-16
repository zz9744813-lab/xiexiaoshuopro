'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Trace {
  id: string;
  traceType: string;
  phase?: string | null;
  status: string;
  errorMessage?: string | null;
  promptVersionId?: string | null;
  apiProfileId?: string | null;
  inputContext?: unknown;
  promptMessages?: unknown;
  rawOutput?: unknown;
  parsedOutput?: unknown;
  filteredOutput?: unknown;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  costEstimate?: string | null;
  latencyMs?: number | null;
  createdAt: string;
}

function Block({ title, value, defaultOpen }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800"
    >
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
        {title}
      </summary>
      <pre className="px-3 py-2 text-xs whitespace-pre-wrap break-words border-t border-zinc-200 dark:border-zinc-800 max-h-96 overflow-auto">
        {value === null || value === undefined
          ? '(empty)'
          : typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default function TraceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [trace, setTrace] = useState<Trace | null>(null);
  const [replayResult, setReplayResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    const r = await fetch(`/api/traces/${id}`).then((x) => x.json());
    if (r.ok) setTrace(r.data);
  }
  useEffect(() => {
    void load();
  }, [id]);

  async function replay() {
    if (!id) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/traces/${id}/replay`, { method: 'POST' }).then((x) =>
        x.json(),
      );
      if (r.ok) setReplayResult(r.data);
      else alert(r.error?.message ?? 'Replay 失败');
    } finally {
      setBusy(false);
    }
  }

  if (!trace) {
    return (
      <main className="p-6">
        <p className="text-zinc-500">加载中...</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4 text-sm">
          <a href="/traces" className="text-zinc-500 hover:underline">
            ← Trace 列表
          </a>
          <span className="ml-auto font-mono text-xs text-zinc-500">{trace.id}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="类型" value={trace.traceType} />
          <Stat label="阶段" value={trace.phase ?? '-'} />
          <Stat label="状态" value={trace.status} highlight={trace.status} />
          <Stat label="耗时" value={trace.latencyMs ? `${trace.latencyMs}ms` : '-'} />
          <Stat label="输入 tokens" value={trace.tokenInput ?? 0} />
          <Stat label="输出 tokens" value={trace.tokenOutput ?? 0} />
          <Stat label="成本 (USD)" value={trace.costEstimate ?? '0'} />
          <Stat label="时间" value={new Date(trace.createdAt).toLocaleString()} />
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={replay}
            disabled={busy}
            className="px-3 py-1 text-sm bg-zinc-900 text-white rounded disabled:opacity-50"
          >
            {busy ? 'Replay 中...' : 'Replay'}
          </button>
          {trace.errorMessage && (
            <span className="text-sm text-red-600 self-center">{trace.errorMessage}</span>
          )}
        </div>

        <div className="space-y-3">
          <Block title="input_context" value={trace.inputContext} />
          <Block title="prompt_messages" value={trace.promptMessages} />
          <Block title="raw_output" value={trace.rawOutput} />
          <Block title="parsed_output (validated)" value={trace.parsedOutput} defaultOpen />
          <Block title="filtered_output" value={trace.filteredOutput} />
        </div>

        {replayResult && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 rounded">
            <h3 className="font-semibold mb-2">Replay 结果</h3>
            <pre className="text-xs whitespace-pre-wrap break-words max-h-96 overflow-auto">
              {JSON.stringify(replayResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: unknown; highlight?: string }) {
  let cls = 'text-zinc-900 dark:text-zinc-50';
  if (highlight === 'success') cls = 'text-green-600';
  else if (highlight === 'error' || highlight === 'aborted') cls = 'text-red-600';
  else if (highlight === 'schema_error') cls = 'text-yellow-600';
  return (
    <div className="p-3 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-sm font-mono mt-1 ${cls}`}>{String(value ?? '-')}</div>
    </div>
  );
}
