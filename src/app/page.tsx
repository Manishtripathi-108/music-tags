'use client';

import React from 'react';
import ThemeToggler from '@/components/ui/ThemeToggler';
import { WorkstationTopBar } from '@/components/workstation/WorkstationTopBar';
import { WorkstationSidebar } from '@/components/workstation/WorkstationSidebar';
import { VirtualizedTrackGrid } from '@/components/workstation/VirtualizedTrackGrid';
import { AudioInspector } from '@/components/workstation/AudioInspector';
import { ActivityDrawer } from '@/components/workstation/ActivityDrawer';
import { ScanModal } from '@/components/workstation/ScanModal';

export default function Home() {
    return (
        <main className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none">
            {/* Top Bar with Search & Engine Status */}
            <div className="relative flex items-center justify-between border-b border-border bg-card/60">
                <div className="flex-1">
                    <WorkstationTopBar />
                </div>
                <div className="border-l border-zinc-800 bg-zinc-950 px-3 py-1.5 flex items-center">
                    <ThemeToggler />
                </div>
            </div>

            {/* Main Center Workstation Area: Sidebar + Virtualized Track Grid + Inspector */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <WorkstationSidebar />
                <VirtualizedTrackGrid />
                <AudioInspector />
            </div>

            {/* Bottom Status / Ingestion Drawer */}
            <ActivityDrawer />

            {/* Scan Directory Modal with Ark UI Field & Fieldset */}
            <ScanModal />
        </main>
    );
}
