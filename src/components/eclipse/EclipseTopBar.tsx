'use client';

import React, { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import ThemeToggler from '@/components/ui/ThemeToggler';
import { useEclipseStore } from '@/store/eclipseStore';
import { useApiLogStore } from '@/store/apiLogStore';

export function EclipseTopBar() {
    const {
        addonUrl,
        setAddonUrl,
        downloadDirectory,
        setDownloadDirectory,
        isConnecting,
        connectAddon,
        manifest,
        connectionError,
        headerEntries,
        setIsHeadersModalOpen,
        addonAccessToken,
        addonTokenExpiresAt,
    } = useEclipseStore();

    const { toggleOpen: toggleApiLogs, logs, isOpen: isApiLogOpen } = useApiLogStore();
    const apiErrorCount = logs.filter((l) => l.status >= 400 || Boolean(l.error)).length;

    const [inputUrl, setInputUrl] = useState(addonUrl);
    const [inputDir, setInputDir] = useState(downloadDirectory);

    const handleConnect = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputUrl) return;
        setAddonUrl(inputUrl);
        await connectAddon(inputUrl);
    };

    const isTokenActive = Boolean(addonAccessToken && (!addonTokenExpiresAt || addonTokenExpiresAt > Math.floor(Date.now() / 1000)));
    const activeHeadersCount = headerEntries.filter((h) => h.enabled && h.key.trim()).length;

    return (
        <header className="bg-background text-foreground flex flex-col border-b select-none">
            {/* Top Navigation Row */}
            <div className="flex h-11 items-center justify-between px-3">
                <div className="flex items-center gap-3">
                    <Link href="/">
                        <Button variant="ghost" size="xs" className="gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground">
                            <Icon icon="arrowOpenLeft" className="size-3.5" />
                            <span>Library</span>
                        </Button>
                    </Link>

                    <div className="bg-border h-4 w-px" />

                    <Link href="/compare">
                        <Button variant="ghost" size="xs" className="gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground">
                            <Icon icon="audio" className="size-3.5 text-primary" />
                            <span>Compare</span>
                        </Button>
                    </Link>

                    <div className="bg-border h-4 w-px" />

                    <div className="flex items-center gap-2">
                        <div className="text-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                            <Icon icon="musicConvert" className="text-primary size-4" />
                            <span>Eclipse Music Addon Client</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* API Request Logs Button */}
                    <Button
                        variant="outline"
                        size="xs"
                        onClick={toggleApiLogs}
                        className={`h-7 gap-1.5 text-xs font-mono transition-colors ${
                            isApiLogOpen
                                ? 'border-primary text-primary bg-primary/10'
                                : apiErrorCount > 0
                                ? 'border-rose-500/40 text-rose-300 bg-rose-500/10'
                                : ''
                        }`}
                        title="Live Addon API Request/Response Logs"
                    >
                        <Icon icon="link" className="size-3 text-primary" />
                        <span>API Logs</span>
                        {logs.length > 0 && (
                            <span
                                className={`px-1 py-0.2 rounded-full text-[10px] font-bold ${
                                    apiErrorCount > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-primary/20 text-primary'
                                }`}
                            >
                                {logs.length}
                            </span>
                        )}
                    </Button>

                    {/* Headers & Authentication Button */}
                    <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setIsHeadersModalOpen(true)}
                        className={`h-7 gap-1.5 text-xs font-mono transition-colors ${
                            isTokenActive ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' : ''
                        }`}
                        title="Configure Eclipse Access Token & custom HTTP headers"
                    >
                        <span className={`size-1.5 rounded-full ${isTokenActive ? 'bg-emerald-400 animate-pulse' : 'bg-primary'}`} />
                        <span>Headers & Auth</span>
                        {isTokenActive ? (
                            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-1 rounded">
                                Token Active
                            </span>
                        ) : activeHeadersCount > 0 ? (
                            <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                                {activeHeadersCount}
                            </span>
                        ) : null}
                    </Button>

                    <ThemeToggler />
                </div>
            </div>

            {/* Connection and URL Config Bar */}
            <div className="bg-muted/30 border-t px-3 py-2 flex flex-wrap items-center gap-2">
                <form onSubmit={handleConnect} className="flex-1 min-w-[280px] flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Icon icon="link" className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="Enter Eclipse Addon URL (e.g. https://addon.example.com or http://localhost:8000)..."
                            className="bg-background text-foreground placeholder:text-muted-foreground/60 w-full rounded border px-3 py-1 pl-8 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="xs"
                        disabled={isConnecting || !inputUrl}
                        className="h-7 px-3 gap-1.5 text-xs font-semibold shrink-0"
                    >
                        <Icon icon={isConnecting ? 'loading' : 'check'} className={`size-3 ${isConnecting ? 'animate-spin' : ''}`} />
                        <span>{isConnecting ? 'Connecting...' : manifest ? 'Reconnect' : 'Connect Addon'}</span>
                    </Button>
                </form>

                {/* Download Directory quick setting */}
                <div className="flex items-center gap-1.5 min-w-[220px]">
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">Download Dir:</span>
                    <input
                        type="text"
                        value={inputDir}
                        onChange={(e) => {
                            setInputDir(e.target.value);
                            setDownloadDirectory(e.target.value);
                        }}
                        placeholder="Path (e.g. E:\Music)..."
                        className="bg-background text-foreground placeholder:text-muted-foreground/60 rounded border px-2 py-1 text-xs font-mono flex-1 focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Detailed Connection Error Notification */}
            {connectionError && (
                <div className="bg-rose-500/10 border-t border-rose-500/30 px-3 py-2 text-xs text-rose-300 flex items-start justify-between gap-3 font-mono">
                    <div className="flex items-start gap-2">
                        <Icon icon="warning" className="size-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <span className="font-bold text-rose-200">Connection Failed:</span>
                            <p className="text-foreground/90">{connectionError}</p>
                            {(connectionError.includes('401') || connectionError.includes('403') || connectionError.toLowerCase().includes('token')) && (
                                <p className="text-[11px] text-amber-300">
                                    Tip: This addon may require authorization. Click &quot;Headers & Auth&quot; to configure your Bearer token or API key.
                                </p>
                            )}
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setIsHeadersModalOpen(true)}
                        className="h-6 text-[11px] border-rose-500/40 text-rose-200 hover:bg-rose-500/20 shrink-0"
                    >
                        Headers & Auth
                    </Button>
                </div>
            )}
        </header>
    );
}
