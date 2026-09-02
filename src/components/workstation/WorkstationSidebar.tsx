'use client';

import React from 'react';

import Icon from '@/components/ui/Icon';
import { useAudioStore } from '@/store/audioStore';
import { type T_IconType } from '@/types/client.types';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarItem } from '@/components/ui/Sidebar';

export function WorkstationSidebar() {
    const { activeFilter, setActiveFilter, tracks, totalTracks } = useAudioStore();

    // Compute live filter counts from current in-memory cache
    const losslessCount = tracks.filter((t) => t.lossless).length;
    const missingArtCount = tracks.filter((t) => !t.hasCoverArt).length;
    const missingBpmCount = tracks.filter((t) => !t.bpm).length;

    const filters: { id: string; label: string; icon: T_IconType; count: number; badge?: string; warn?: boolean }[] = [
        { id: 'all', label: 'All Tracks', icon: 'audio', count: totalTracks },
        { id: 'lossless', label: 'Lossless Audio', icon: 'musicQueue', count: losslessCount, badge: 'FLAC/WAV' },
        { id: 'missing-art', label: 'Missing Cover Art', icon: 'gallery', count: missingArtCount, warn: true },
        { id: 'missing-bpm', label: 'Missing BPM / Key', icon: 'settings', count: missingBpmCount },
    ];

    return (
        <Sidebar defaultWidth={224} minWidth={180} maxWidth={320}>
            <SidebarContent>
                {/* Library Navigation */}
                <SidebarGroup label="Library Views" icon="playlist" defaultOpen>
                    {filters.map((f) => (
                        <SidebarItem
                            key={f.id}
                            id={f.id}
                            label={f.label}
                            icon={f.icon}
                            count={f.count}
                            badge={f.badge}
                            isActive={activeFilter === f.id}
                            onClick={() => setActiveFilter(f.id)}
                        />
                    ))}
                </SidebarGroup>

                {/* Workstation Engine Tasks */}
                <SidebarGroup label="Workstation Tasks" icon="presentation" defaultOpen>
                    <div className="border-border bg-muted/40 text-muted-foreground space-y-1.5 rounded-md border p-2.5 text-[11px]">
                        <div className="text-foreground flex items-center gap-1.5 font-medium">
                            <Icon icon="audio" className="text-primary size-3.5" />
                            <span>Audio Engine</span>
                        </div>
                        <p className="text-muted-foreground text-[10px] leading-relaxed">
                            ExifTool daemon is active for safe, transactional metadata read/writes.
                        </p>
                    </div>
                </SidebarGroup>
            </SidebarContent>

            {/* Footer Status */}
            <SidebarFooter>
                <div className="text-muted-foreground flex items-center justify-between font-mono text-[11px]">
                    <span>Target Host</span>
                    <span className="text-foreground">127.0.0.1:3000</span>
                </div>
                <div className="text-muted-foreground mt-1 flex items-center justify-between text-[10px]">
                    <span>Engine Status</span>
                    <span className="text-success flex items-center gap-1">● Local Only</span>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

export default WorkstationSidebar;
