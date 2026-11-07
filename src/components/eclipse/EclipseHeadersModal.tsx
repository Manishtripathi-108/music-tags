'use client';

import React, { useState, useEffect } from 'react';
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
        eclipseAuthToken,
        setEclipseAuthToken,
        addonId,
        setAddonId,
        addonAccessToken,
        addonTokenExpiresAt,
        isFetchingToken,
        tokenError,
        fetchAddonAccessToken,
        manifest,
    } = useEclipseStore();

    const [userAuthInput, setUserAuthInput] = useState(eclipseAuthToken);
    const [addonIdInput, setAddonIdInput] = useState(addonId || manifest?.id || '');
    const [showUserToken, setShowUserToken] = useState(false);
    const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({});
    const [currentTimeSec, setCurrentTimeSec] = useState(() => Math.floor(Date.now() / 1000));

    // Update current time every second for live countdown
    useEffect(() => {
        if (!isHeadersModalOpen) return;
        const interval = setInterval(() => {
            setCurrentTimeSec(Math.floor(Date.now() / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isHeadersModalOpen]);

    // Keep local input in sync with store
    useEffect(() => {
        setUserAuthInput(eclipseAuthToken);
    }, [eclipseAuthToken]);

    useEffect(() => {
        if (addonId) {
            setAddonIdInput(addonId);
        } else if (manifest?.id) {
            setAddonIdInput(manifest.id);
        }
    }, [addonId, manifest?.id]);

    if (!isHeadersModalOpen) return null;

    const toggleValueVisibility = (id: string) => {
        setVisibleValues((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSaveAuthAndAcquire = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanToken = userAuthInput.trim();
        const cleanAddon = addonIdInput.trim() || manifest?.id || '';
        setEclipseAuthToken(cleanToken);
        setAddonId(cleanAddon);
        if (cleanToken && cleanAddon) {
            await fetchAddonAccessToken();
        }
    };

    const activeCount = headerEntries.filter((h) => h.enabled && h.key.trim()).length;

    // Remaining seconds calculation
    const remainingSeconds = addonTokenExpiresAt ? addonTokenExpiresAt - currentTimeSec : null;
    const isTokenValid = remainingSeconds !== null && remainingSeconds > 0;

    const formatRemaining = (seconds: number) => {
        if (seconds <= 0) return 'Expired';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
            <div className="bg-background border border-border w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-5 py-3.5 bg-card/60">
                    <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Icon icon="settings" className="size-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">Headers & Addon Authentication</h2>
                            <p className="text-xs text-muted-foreground">
                                Configure Eclipse Addon Access Tokens and custom request headers
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

                <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                    {/* SECTION 1: ECLIPSE ADDON ACCESS TOKEN (api.eclipsemusic.app) */}
                    <div className="p-5 bg-primary/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full bg-primary animate-pulse" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Eclipse Music Addon Access (x-eclipse-access)
                                </h3>
                            </div>

                            {/* Token Status Badge */}
                            {addonAccessToken ? (
                                isTokenValid ? (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
                                        <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                                        <span>Active: {formatRemaining(remainingSeconds!)}</span>
                                    </div>
                                ) : (
                                    <div className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono">
                                        Expired (auto-refreshes on request)
                                    </div>
                                )
                            ) : (
                                <div className="px-2 py-0.5 rounded-full bg-muted border text-muted-foreground text-[11px] font-mono">
                                    No Access Token Acquired
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Provide your Eclipse User Auth Token. The app will automatically call{' '}
                            <code className="text-primary font-mono text-[11px]">https://api.eclipsemusic.app/api/addon-access/token?addon=...</code>{' '}
                            to acquire the temporary token and inject <code className="text-primary font-mono text-[11px]">x-eclipse-access</code> into all addon calls, refreshing it automatically whenever it expires.
                        </p>

                        <form onSubmit={handleSaveAuthAndAcquire} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Eclipse User Auth Token */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-muted-foreground font-mono flex items-center justify-between">
                                        <span>Eclipse Auth Token (Bearer)</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowUserToken(!showUserToken)}
                                            className="text-[10px] text-primary hover:underline cursor-pointer"
                                        >
                                            {showUserToken ? 'Hide' : 'Show'}
                                        </button>
                                    </label>
                                    <input
                                        type={showUserToken ? 'text' : 'password'}
                                        value={userAuthInput}
                                        onChange={(e) => {
                                            setUserAuthInput(e.target.value);
                                            setEclipseAuthToken(e.target.value);
                                        }}
                                        placeholder="Paste JWT / Bearer Token..."
                                        className="w-full bg-background text-foreground text-xs font-mono border rounded px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                {/* Addon Identifier */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-muted-foreground font-mono flex items-center justify-between">
                                        <span>Addon ID</span>
                                        {manifest?.id && (
                                            <span className="text-[9px] text-muted-foreground">from manifest</span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        value={addonIdInput}
                                        onChange={(e) => {
                                            setAddonIdInput(e.target.value);
                                            setAddonId(e.target.value);
                                        }}
                                        placeholder="e.g. com.yourname.tidal.hifi"
                                        className="w-full bg-background text-foreground text-xs font-mono border rounded px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            {/* Token error message if any */}
                            {tokenError && (
                                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                                    <Icon icon="warning" className="size-3.5 text-rose-400 shrink-0" />
                                    <span>{tokenError}</span>
                                </div>
                            )}

                            {/* Active Token Preview */}
                            {addonAccessToken && (
                                <div className="bg-background/80 rounded border p-2 flex items-center justify-between gap-2 text-xs font-mono">
                                    <div className="truncate flex items-center gap-2">
                                        <span className="text-muted-foreground font-semibold shrink-0">x-eclipse-access:</span>
                                        <span className="text-primary truncate">{addonAccessToken}</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground shrink-0">
                                        {remainingSeconds !== null && remainingSeconds > 0
                                            ? `expires in ${formatRemaining(remainingSeconds)}`
                                            : 'expired'}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-1">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="xs"
                                    disabled={isFetchingToken || !userAuthInput.trim() || !addonIdInput.trim()}
                                    className="h-7 text-xs px-3 font-semibold gap-1.5"
                                >
                                    <Icon
                                        icon={isFetchingToken ? 'loading' : 'check'}
                                        className={`size-3 ${isFetchingToken ? 'animate-spin' : ''}`}
                                    />
                                    <span>{isFetchingToken ? 'Acquiring Token...' : addonAccessToken ? 'Refresh Access Token Now' : 'Acquire Access Token'}</span>
                                </Button>

                                <span className="text-[11px] font-mono text-muted-foreground">
                                    Auto-refreshes 20s before expiry
                                </span>
                            </div>
                        </form>
                    </div>

                    {/* SECTION 2: MANUAL HEADERS LIST */}
                    <div className="p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Additional HTTP Request Headers
                                </h3>
                                <p className="text-[11px] text-muted-foreground">
                                    Optional custom headers forwarded directly to the addon server
                                </p>
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
                                    {activeCount} active
                                </span>
                            </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">Presets:</span>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => addHeaderEntry('Authorization', 'Bearer ')}
                                className="h-6 text-[11px] gap-1 font-mono"
                            >
                                <Icon icon="plus" className="size-2.5" />
                                <span>Bearer Auth</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => addHeaderEntry('X-API-Key', '')}
                                className="h-6 text-[11px] gap-1 font-mono"
                            >
                                <Icon icon="plus" className="size-2.5" />
                                <span>X-API-Key</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => addHeaderEntry('Cookie', '')}
                                className="h-6 text-[11px] gap-1 font-mono"
                            >
                                <Icon icon="plus" className="size-2.5" />
                                <span>Cookie</span>
                            </Button>
                        </div>

                        {/* Headers List */}
                        <div className="space-y-2 pt-2">
                            {headerEntries.length === 0 ? (
                                <div className="text-center py-6 text-xs text-muted-foreground font-mono">
                                    No custom headers configured. (Eclipse access token is handled in the section above)
                                </div>
                            ) : (
                                headerEntries.map((entry) => {
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
                                            <input
                                                type="checkbox"
                                                checked={entry.enabled}
                                                onChange={(e) => updateHeaderEntry(entry.id, { enabled: e.target.checked })}
                                                className="size-4 rounded accent-primary cursor-pointer shrink-0"
                                                title="Enable/disable this header"
                                            />

                                            <input
                                                type="text"
                                                value={entry.key}
                                                onChange={(e) => updateHeaderEntry(entry.id, { key: e.target.value })}
                                                placeholder="Header Name (e.g. X-Custom)"
                                                className="w-1/3 min-w-[120px] bg-background text-foreground text-xs font-mono font-semibold border rounded px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
                                            />

                                            <div className="flex-1 relative flex items-center">
                                                <input
                                                    type={isSensitive && !isVisible ? 'password' : 'text'}
                                                    value={entry.value}
                                                    onChange={(e) => updateHeaderEntry(entry.id, { value: e.target.value })}
                                                    placeholder="Header Value"
                                                    className="w-full bg-background text-foreground text-xs font-mono border rounded px-2.5 py-1.5 pr-8 focus:outline-hidden focus:ring-1 focus:ring-primary"
                                                />
                                                {isSensitive && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleValueVisibility(entry.id)}
                                                        className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer text-[10px] font-mono px-1 py-0.5"
                                                    >
                                                        {isVisible ? 'HIDE' : 'SHOW'}
                                                    </button>
                                                )}
                                            </div>

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
                                })
                            )}
                        </div>
                    </div>
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
                        <span>Add Custom Header</span>
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
