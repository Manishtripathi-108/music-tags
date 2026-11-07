'use client';

import React from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import ThemeToggler from '@/components/ui/ThemeToggler';
import { useCompareStore } from '@/store/compareStore';

export function CompareTopBar() {
    const { items, isLoading, fetchComparisonItems, operationErrors, setIsErrorDrawerOpen, isErrorDrawerOpen } = useCompareStore();

    const upgradeCount = items.filter((i) => i.status === 'upgrade_available').length;
    const dolbyCount = items.filter((i) => i.isDolbyAvailable).length;
    const downloadedCount = items.filter((i) => i.cachedMatch?.downloadStatus === 'completed').length;

    return (
        <header className="bg-background text-foreground flex h-11 items-center justify-between border-b px-3 select-none">
            <div className="flex items-center gap-3">
                <Link href="/" className="hover:opacity-80 transition-opacity">
                    <Button variant="ghost" size="xs" className="gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground">
                        <Icon icon="arrowOpenLeft" className="size-3.5" />
                        <span>Library</span>
                    </Button>
                </Link>

                <div className="bg-border h-4 w-px" />

                <Link href="/eclipse" className="hover:opacity-80 transition-opacity">
                    <Button variant="ghost" size="xs" className="gap-1.5 font-mono text-xs text-purple-400 hover:text-purple-300">
                        <Icon icon="musicConvert" className="size-3.5 text-purple-400" />
                        <span>Eclipse Addon</span>
                    </Button>
                </Link>

                <div className="bg-border h-4 w-px" />

                <div className="flex items-center gap-2">
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                        <Icon icon="audio" className="text-primary size-4" />
                        <span>Audio Quality Compare</span>
                    </div>

                    <Badge variant="outline" size="xs" className="text-primary border-primary/30">
                        BITCHORD ADDON API
                    </Badge>
                </div>

                <div className="bg-border h-4 w-px" />

                <div className="hidden sm:flex items-center gap-2 font-mono text-xs">
                    <Badge variant="outline" size="sm" className="gap-1">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-bold">{items.length}</span>
                    </Badge>

                    {upgradeCount > 0 && (
                        <Badge variant="success" size="sm" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                            <Icon icon="magic" className="size-3" />
                            <span>{upgradeCount} Upgrades</span>
                        </Badge>
                    )}

                    {dolbyCount > 0 && (
                        <Badge variant="outline" size="sm" className="gap-1 bg-purple-500/10 text-purple-400 border-purple-500/30">
                            <Icon icon="audio" className="size-3 text-purple-400" />
                            <span>{dolbyCount} Dolby Atmos</span>
                        </Badge>
                    )}

                    {downloadedCount > 0 && (
                        <Badge variant="outline" size="sm" className="gap-1 bg-blue-500/10 text-blue-400 border-blue-500/30">
                            <Icon icon="check" className="size-3 text-blue-400" />
                            <span>{downloadedCount} Downloaded</span>
                        </Badge>
                    )}

                    {operationErrors.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsErrorDrawerOpen(!isErrorDrawerOpen)}
                            className="cursor-pointer"
                        >
                            <Badge variant="outline" size="sm" className="gap-1 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 transition-colors">
                                <Icon icon="warning" className="size-3 text-rose-400" />
                                <span>{operationErrors.length} Errors</span>
                            </Badge>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchComparisonItems()}
                    disabled={isLoading}
                    className="h-7 gap-1.5 text-xs"
                >
                    <Icon icon={isLoading ? 'loading' : 'refresh'} className="size-3.5" />
                    <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
                </Button>

                <ThemeToggler />
            </div>
        </header>
    );
}
