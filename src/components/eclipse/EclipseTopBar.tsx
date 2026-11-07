'use client';

import React, { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import ThemeToggler from '@/components/ui/ThemeToggler';
import { useEclipseStore } from '@/store/eclipseStore';

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
    } = useEclipseStore();

    const [inputUrl, setInputUrl] = useState(addonUrl);
    const [inputDir, setInputDir] = useState(downloadDirectory);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const handleConnect = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputUrl) return;
        setAddonUrl(inputUrl);
        await connectAddon(inputUrl);
    };

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
                    <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                        className={`h-7 gap-1 text-xs ${isConfigOpen ? 'border-primary text-primary' : ''}`}
                    >
                        <Icon icon="settings" className="size-3" />
                        <span>Addon Config</span>
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

            {connectionError && (
                <div className="bg-rose-500/10 border-t border-rose-500/30 px-3 py-1.5 text-xs text-rose-400 flex items-center gap-2 font-mono">
                    <Icon icon="warning" className="size-3.5 text-rose-400 shrink-0" />
                    <span>Connection failed: {connectionError}</span>
                </div>
            )}
        </header>
    );
}
