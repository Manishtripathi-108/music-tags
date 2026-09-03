'use client';

import { WorkstationTopBar } from '@/components/workstation/WorkstationTopBar';
import { WorkstationSidebar } from '@/components/workstation/WorkstationSidebar';
import { VirtualizedTrackGrid } from '@/components/workstation/VirtualizedTrackGrid';
import { AudioInspector } from '@/components/workstation/AudioInspector';
import { ActivityDrawer } from '@/components/workstation/ActivityDrawer';
import { ScanModal } from '@/components/workstation/ScanModal';
import { DuplicateFinderModal } from '@/components/workstation/DuplicateFinderModal';

export default function Home() {
    return (
        <main className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden select-none">
            <WorkstationTopBar />

            <div className="flex min-h-0 flex-1 overflow-hidden">
                <WorkstationSidebar />
                <VirtualizedTrackGrid />
                <AudioInspector />
            </div>

            <ActivityDrawer />
            <ScanModal />
            <DuplicateFinderModal />
        </main>
    );
}
