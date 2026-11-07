'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useEclipseStore } from '@/store/eclipseStore';

export function EclipseErrorNoticeBanner() {
    const {
        lastError,
        clearErrors,
        notices,
        dismissNotice,
        setIsHeadersModalOpen,
    } = useEclipseStore();

    if (!lastError && notices.length === 0) return null;

    const isAuthError = lastError?.status === 401 || lastError?.status === 403 || /unauthorized|forbidden|token|auth/i.test(lastError?.message || '');

    return (
        <div className="flex flex-col gap-1.5 p-3 border-b bg-card/20 select-none">
            {/* Last Error Banner */}
            {lastError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 flex flex-wrap items-start justify-between gap-3 text-xs font-mono animate-in fade-in-0">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Icon icon="warning" className="size-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-rose-200">
                                    {lastError.status ? `Addon Error (${lastError.status})` : 'Addon Operation Error'}:
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 bg-rose-500/20 text-rose-200 rounded border border-rose-500/30">
                                    Action: {lastError.action}
                                </span>
                            </div>
                            <div className="text-foreground/90 whitespace-pre-wrap break-words">
                                {lastError.message}
                            </div>
                            {isAuthError && (
                                <p className="text-[11px] text-amber-300/90 pt-1">
                                    Tip: This addon might require an API token or custom header. Click &quot;Configure Headers&quot; to set your Authorization Bearer token.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {isAuthError && (
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setIsHeadersModalOpen(true)}
                                className="h-6 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                            >
                                <Icon icon="settings" className="size-3" />
                                <span>Configure Headers</span>
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={clearErrors}
                            className="h-6 text-[11px] text-rose-300 hover:text-rose-100 hover:bg-rose-500/20"
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}

            {/* Eclipse Addon Notices */}
            {notices.map((n, idx) => {
                const isWarning = n.level === 'warning';
                const isErr = n.level === 'error';
                const isSuccess = n.level === 'success';

                const borderCls = isErr
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : isWarning
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : isSuccess
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-300';

                return (
                    <div
                        key={n.id || `notice-${idx}`}
                        className={`border rounded-lg px-3 py-2 text-xs font-mono flex items-center justify-between gap-3 ${borderCls}`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon
                                icon={isErr || isWarning ? 'warning' : 'check'}
                                className="size-3.5 shrink-0"
                            />
                            <div className="truncate">
                                {n.title && <span className="font-bold mr-2">[{n.title}]</span>}
                                <span>{n.message}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => dismissNotice(n.id)}
                            className="p-1 hover:opacity-80 rounded cursor-pointer shrink-0"
                            title="Dismiss notice"
                        >
                            <Icon icon="close" className="size-3" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
