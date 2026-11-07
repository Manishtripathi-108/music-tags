'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useApiLogStore } from '@/store/apiLogStore';
import { type ApiCallLogEntry } from '@/services/logger/apiLogger';

export function ApiLogDrawer() {
    const {
        logs,
        isOpen,
        setIsOpen,
        filter,
        setFilter,
        isAutoRefresh,
        setAutoRefresh,
        fetchLogs,
        clearLogs,
        isLoading,
    } = useApiLogStore();

    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Auto-refresh poll every 2 seconds while drawer is open
    useEffect(() => {
        if (!isOpen || !isAutoRefresh) return;
        const interval = setInterval(() => {
            fetchLogs();
        }, 2000);
        return () => clearInterval(interval);
    }, [isOpen, isAutoRefresh, fetchLogs]);

    if (!isOpen) return null;

    const filteredLogs = logs.filter((log) => {
        if (filter === 'errors') return log.status >= 400 || Boolean(log.error);
        if (filter === 'stream') return log.action.includes('stream');
        if (filter === 'search') return log.action.includes('search');
        if (filter === 'download') return log.action.includes('download');
        if (filter === 'token') return log.action.includes('token');
        return true;
    });

    const errorCount = logs.filter((l) => l.status >= 400 || Boolean(l.error)).length;

    const copyAsCurl = (log: ApiCallLogEntry) => {
        let curl = `curl -X ${log.method} "${log.url}"`;
        if (log.requestHeaders) {
            for (const [k, v] of Object.entries(log.requestHeaders)) {
                curl += ` \\\n  -H "${k}: ${v}"`;
            }
        }
        navigator.clipboard.writeText(curl);
        setCopiedId(log.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[580px] md:w-[680px] bg-background border-l border-border shadow-2xl flex flex-col font-mono text-xs animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3 bg-card/70 select-none">
                <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-foreground text-sm">Addon API Request Logs</span>
                    <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-bold">
                        {logs.length}
                    </span>
                    {errorCount > 0 && (
                        <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                            {errorCount} errors
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchLogs()}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title="Refresh now"
                    >
                        <Icon icon="refresh" className={`size-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title="Close logs"
                    >
                        <Icon icon="close" className="size-4" />
                    </button>
                </div>
            </div>

            {/* Filter & Controls Bar */}
            <div className="px-3 py-2 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2 select-none text-[11px]">
                <div className="flex items-center gap-1 flex-wrap">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            filter === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        All ({logs.length})
                    </button>
                    <button
                        onClick={() => setFilter('errors')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            filter === 'errors' ? 'bg-rose-500 text-white font-semibold' : 'text-muted-foreground hover:text-rose-400'
                        }`}
                    >
                        Errors ({errorCount})
                    </button>
                    <button
                        onClick={() => setFilter('stream')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            filter === 'stream' ? 'bg-purple-600 text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Stream
                    </button>
                    <button
                        onClick={() => setFilter('download')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            filter === 'download' ? 'bg-blue-600 text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Download
                    </button>
                    <button
                        onClick={() => setFilter('search')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            filter === 'search' ? 'bg-amber-600 text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Search
                    </button>
                    <button
                        onClick={() => setFilter('token')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            filter === 'token' ? 'bg-teal-600 text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Token
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground text-[10px]">
                        <input
                            type="checkbox"
                            checked={isAutoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="size-3.5 accent-primary cursor-pointer"
                        />
                        <span>Auto (2s)</span>
                    </label>
                    <button
                        onClick={clearLogs}
                        className="text-[10px] text-destructive hover:underline cursor-pointer"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2 space-y-1.5">
                {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-xs space-y-1">
                        <Icon icon="link" className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p>No API requests logged yet.</p>
                        <p className="text-[10px] text-muted-foreground/70">
                            Search songs, resolve streams, or download tracks to see live HTTP logs here.
                        </p>
                    </div>
                ) : (
                    filteredLogs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        const isError = log.status >= 400 || Boolean(log.error);
                        const isRetry = log.status === 503;
                        const isCopied = copiedId === log.id;

                        const statusBadge = isRetry
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : isError
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

                        return (
                            <div
                                key={log.id}
                                className={`rounded-lg border transition-all ${
                                    isError
                                        ? 'bg-rose-500/5 border-rose-500/20'
                                        : 'bg-card/40 border-border/60 hover:bg-muted/30'
                                }`}
                            >
                                {/* Summary Row */}
                                <div
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="p-2.5 flex items-start justify-between gap-2 cursor-pointer select-none"
                                >
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                            <span className={`px-1.5 py-0.2 rounded border font-bold ${statusBadge}`}>
                                                {log.status > 0 ? log.status : 'ERR'} {log.statusText}
                                            </span>
                                            <span className="font-bold text-foreground">{log.method}</span>
                                            <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground uppercase">
                                                {log.action}
                                            </span>
                                            <span className="text-muted-foreground text-[10px] ml-auto">
                                                {log.durationMs}ms
                                            </span>
                                        </div>

                                        <div className="text-[11px] text-foreground/80 truncate font-mono" title={log.url}>
                                            {log.url}
                                        </div>

                                        {log.error && (
                                            <div className="text-[11px] text-rose-400 font-semibold truncate">
                                                {log.error}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-[10px] text-muted-foreground shrink-0 pt-0.5">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>

                                {/* Expanded Inspection Details */}
                                {isExpanded && (
                                    <div className="border-t border-border/40 p-3 bg-background/80 space-y-3 text-[11px]">
                                        {/* URL and cURL Copy */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                                                <span>Request URL</span>
                                                <button
                                                    type="button"
                                                    onClick={() => copyAsCurl(log)}
                                                    className="text-primary hover:underline cursor-pointer flex items-center gap-1"
                                                >
                                                    <Icon icon="check" className="size-2.5" />
                                                    <span>{isCopied ? 'Copied cURL!' : 'Copy cURL'}</span>
                                                </button>
                                            </div>
                                            <div className="p-2 rounded bg-muted/40 text-foreground break-all select-all font-mono">
                                                {log.url}
                                            </div>
                                        </div>

                                        {/* Request Headers */}
                                        {log.requestHeaders && Object.keys(log.requestHeaders).length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                                                    Request Headers ({Object.keys(log.requestHeaders).length})
                                                </span>
                                                <div className="p-2 rounded bg-muted/40 space-y-0.5 overflow-x-auto">
                                                    {Object.entries(log.requestHeaders).map(([k, v]) => (
                                                        <div key={k} className="flex gap-2">
                                                            <span className="text-primary font-semibold shrink-0">{k}:</span>
                                                            <span className="text-foreground/80 break-all select-all">{v}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Response Headers */}
                                        {log.responseHeaders && Object.keys(log.responseHeaders).length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                                                    Response Headers
                                                </span>
                                                <div className="p-2 rounded bg-muted/40 space-y-0.5 overflow-x-auto text-[10px]">
                                                    {Object.entries(log.responseHeaders).map(([k, v]) => (
                                                        <div key={k} className="flex gap-2">
                                                            <span className="text-purple-400 font-semibold shrink-0">{k}:</span>
                                                            <span className="text-foreground/80 break-all">{v}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Response Body / Payload Preview */}
                                        {log.responsePreview && (
                                            <div className="space-y-1">
                                                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                                                    Response Payload
                                                </span>
                                                <div className="p-2 rounded bg-muted/40 text-foreground whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono text-[10px]">
                                                    {log.responsePreview}
                                                </div>
                                            </div>
                                        )}

                                        {/* Addon Notice if any */}
                                        {log.notice && (
                                            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300">
                                                <span className="font-bold">Addon Notice: </span>
                                                {log.notice.title && <span className="font-semibold">[{log.notice.title}] </span>}
                                                <span>{log.notice.message}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
