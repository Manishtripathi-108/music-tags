'use client';

import React from 'react';

import { Badge } from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import { useAudioStore } from '@/store/audioStore';
import { type T_IconType } from '@/types/client.types';

export function WorkstationSidebar() {
    const { activeFilter, setActiveFilter, tracks, totalTracks } = useAudioStore();

    // Compute live filter counts from current in-memory cache
    const losslessCount = tracks.filter((t) => t.lossless).length;
    const missingArtCount = tracks.filter((t) => !t.hasCoverArt).length;
    const missingBpmCount = tracks.filter((t) => !t.bpm).length;

    const filters: { id: string; label: string; icon: T_IconType; count: number; badge?: string; warn?: boolean }[] = [
        { id: 'all', label: 'All Tracks', icon: 'audio', count: totalTracks },
        { id: 'lossless', label: 'Lossless Audio', icon: 'musicQueue', count: losslessCount, badge: 'FLAC/WAV' },
        { id: 'missing-art', label: 'Missing Cover Art', icon: 'image', count: missingArtCount, warn: true },
        { id: 'missing-bpm', label: 'Missing BPM / Key', icon: 'settings', count: missingBpmCount },
    ];

    return (
        <aside className="flex h-full w-56 flex-col justify-between border-r border-zinc-800 bg-zinc-950/80 text-xs select-none">
            <div className="space-y-4 p-3">
                {/* Navigation Categories */}
                <div>
                    <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                        <Icon icon="playlist" className="h-3 w-3 text-zinc-400" />
                        <span>Library Views</span>
                    </div>
                    <nav className="space-y-0.5">
                        {filters.map((f) => {
                            const isActive = activeFilter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFilter(f.id)}
                                    className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                        isActive
                                            ? 'border border-blue-500/30 bg-blue-600/20 text-blue-400'
                                            : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100'
                                    }`}>
                                    <div className="flex items-center gap-2 truncate">
                                        <Icon icon={f.icon} className={`h-3.5 w-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                                        <span className="truncate">{f.label}</span>
                                    </div>
                                    {f.badge && (
                                        <Badge variant="outline" className="border-blue-900/50 px-1 py-0 text-[9px] text-blue-400">
                                            {f.badge}
                                        </Badge>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Audio Workflow Shortcuts */}
                <div>
                    <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                        <Icon icon="presentation" className="h-3 w-3 text-zinc-400" />
                        <span>Workstation Tasks</span>
                    </div>
                    <div className="space-y-1 px-1">
                        <div className="border-zinc-850 space-y-1 rounded border bg-zinc-900/40 p-2 text-[11px] text-zinc-400">
                            <div className="flex items-center gap-1 font-medium text-zinc-200">
                                <Icon icon="audio" className="h-3 w-3 text-blue-400" />
                                <span>Audio Engine</span>
                            </div>
                            <p className="text-[10px] leading-tight text-zinc-500">
                                ExifTool daemon is active for safe, transactional metadata read/writes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="border-zinc-850/80 border-t bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
                    <span>Target Host</span>
                    <span className="text-zinc-400">127.0.0.1:3000</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-600">
                    <span>Engine Status</span>
                    <span className="flex items-center gap-1 text-emerald-500">● Local Only</span>
                </div>
            </div>
        </aside>
    );
}
