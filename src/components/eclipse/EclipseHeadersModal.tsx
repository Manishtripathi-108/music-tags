'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useEclipseStore } from '@/store/eclipseStore';

export function EclipseHeadersModal() {
    const {
        headerEntries,
        isHeadersModalOpen,
        setIsHeadersModalOpen,
        addHeaderEntry,
        updateHeaderEntry,
        removeHeaderEntry,
        clearHeaderEntries,
        setAuthBearerToken,
    } = useEclipseStore();

    const [bearerInput, setBearerInput] = useState('');
    const [showBearerInput, setShowBearerInput] = useState(false);
    const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({});

    if (!isHeadersModalOpen) return null;

    const toggleValueVisibility = (id: string) => {
        setVisibleValues((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleApplyBearer = (e: React.FormEvent) => {
        e.preventDefault();
        if (!bearerInput.trim()) return;
        setAuthBearerToken(bearerInput);
        setBearerInput('');
        setShowBearerInput(false);
    };

    const activeCount = headerEntries.filter((h) => h.enabled && h.key.trim()).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
            <div className="bg-background border border-border w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-5 py-3.5 bg-card/60">
                    <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Icon icon="settings" className="size-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">Custom HTTP Headers & Authentication</h2>
                            <p className="text-xs text-muted-foreground">
                                Set custom headers forwarded to the Eclipse Addon (e.g. Bearer token, API keys)
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsHeadersModalOpen(false)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                    >
                        <Icon icon="close" className="size-4" />
                    </button>
                </div>

                {/* Quick Presets Bar */}
                <div className="px-5 py-3 bg-muted/20 border-b flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Quick Presets:</span>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setShowBearerInput(!showBearerInput)}
                            className="h-6 text-xs gap-1 font-mono"
                        >
                            <Icon icon="check" className="size-2.5 text-primary" />
                            <span>Bearer Token</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={() => addHeaderEntry('X-API-Key', '')}
                            className="h-6 text-xs gap-1 font-mono"
                        >
                            <Icon icon="plus" className="size-2.5" />
                            <span>X-API-Key</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={() => addHeaderEntry('Cookie', '')}
                            className="h-6 text-xs gap-1 font-mono"
                        >
                            <Icon icon="plus" className="size-2.5" />
                            <span>Cookie</span>
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        {headerEntries.length > 0 && (
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={clearHeaderEntries}
                                className="h-6 text-[11px] text-destructive hover:bg-destructive/10"
                            >
                                Clear All
                            </Button>
                        )}
                        <span className="text-xs font-mono text-muted-foreground">
                            {activeCount} active / {headerEntries.length} total
                        </span>
                    </div>
                </div>

                {/* Quick Bearer Prompt Form */}
                {showBearerInput && (
                    <form onSubmit={handleApplyBearer} className="px-5 py-2.5 bg-primary/5 border-b flex items-center gap-2">
                        <input
                            type="password"
                            value={bearerInput}
                            onChange={(e) => setBearerInput(e.target.value)}
                            placeholder="Paste your auth token (e.g. eyJhbGciOi... or secret-token)"
                            className="flex-1 bg-background text-foreground text-xs font-mono border rounded px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
                            autoFocus
                        />
                        <Button type="submit" variant="primary" size="xs" className="h-7 text-xs px-3">
                            Set Authorization Header
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setShowBearerInput(false)}
                            className="h-7 text-xs"
                        >
                            Cancel
                        </Button>
                    </form>
                )}

                {/* Headers List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {headerEntries.length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                            <Icon icon="link" className="size-8 mx-auto text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground font-mono">No custom headers configured.</p>
                            <p className="text-[11px] text-muted-foreground/80 max-w-md mx-auto">
                                If your Eclipse addon requires authentication (like <code>Authorization: Bearer &lt;token&gt;</code> or an API key), add it below. Headers persist in your browser.
                            </p>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => addHeaderEntry('Authorization', 'Bearer ')}
                                className="mt-2 text-xs"
                            >
                                Add Authorization Header
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {headerEntries.map((entry) => {
                                const isSensitive = /auth|token|key|secret|cookie/i.test(entry.key);
                                const isVisible = visibleValues[entry.id];

                                return (
                                    <div
                                        key={entry.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                            entry.enabled
                                                ? 'bg-card/50 border-border'
                                                : 'bg-muted/10 border-border/40 opacity-60'
                                        }`}
                                    >
                                        {/* Toggle Checkbox */}
                                        <input
                                            type="checkbox"
                                            checked={entry.enabled}
                                            onChange={(e) => updateHeaderEntry(entry.id, { enabled: e.target.checked })}
                                            className="size-4 rounded accent-primary cursor-pointer shrink-0"
                                            title="Enable/disable this header"
                                        />

                                        {/* Header Key */}
                                        <input
                                            type="text"
                                            value={entry.key}
                                            onChange={(e) => updateHeaderEntry(entry.id, { key: e.target.value })}
                                            placeholder="Header Name (e.g. Authorization)"
                                            className="w-1/3 min-w-[120px] bg-background text-foreground text-xs font-mono font-semibold border rounded px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
                                        />

                                        {/* Header Value */}
                                        <div className="flex-1 relative flex items-center">
                                            <input
                                                type={isSensitive && !isVisible ? 'password' : 'text'}
                                                value={entry.value}
                                                onChange={(e) => updateHeaderEntry(entry.id, { value: e.target.value })}
                                                placeholder="Value (e.g. Bearer eyJhb...)"
                                                className="w-full bg-background text-foreground text-xs font-mono border rounded px-2.5 py-1.5 pr-8 focus:outline-hidden focus:ring-1 focus:ring-primary"
                                            />
                                            {isSensitive && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleValueVisibility(entry.id)}
                                                    className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer text-[10px] font-mono px-1 py-0.5"
                                                    title={isVisible ? 'Hide token' : 'Show token'}
                                                >
                                                    {isVisible ? 'HIDE' : 'SHOW'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Delete Button */}
                                        <button
                                            type="button"
                                            onClick={() => removeHeaderEntry(entry.id)}
                                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer shrink-0 transition-colors"
                                            title="Remove header"
                                        >
                                            <Icon icon="close" className="size-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t px-5 py-3 bg-card/60">
                    <Button
                        variant="outline"
                        size="xs"
                        onClick={() => addHeaderEntry()}
                        className="gap-1.5 text-xs font-semibold"
                    >
                        <Icon icon="plus" className="size-3" />
                        <span>Add Header</span>
                    </Button>

                    <Button
                        variant="primary"
                        size="xs"
                        onClick={() => setIsHeadersModalOpen(false)}
                        className="px-4 text-xs font-semibold"
                    >
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
