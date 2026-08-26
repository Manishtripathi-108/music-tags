'use client';

import { WorkstationTopBar } from '@/components/workstation/WorkstationTopBar';
import { WorkstationSidebar } from '@/components/workstation/WorkstationSidebar';
import { VirtualizedTrackGrid } from '@/components/workstation/VirtualizedTrackGrid';
import { AudioInspector } from '@/components/workstation/AudioInspector';
import { ActivityDrawer } from '@/components/workstation/ActivityDrawer';
import { ScanModal } from '@/components/workstation/ScanModal';

export default function Home() {
    return (
        <main className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden select-none">
            {/* Top Bar with Search & Engine Status */}
            <WorkstationTopBar />

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
