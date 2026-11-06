'use client';

import React, { useEffect } from 'react';

import { CompareConfigPanel } from '@/components/compare/CompareConfigPanel';
import { CompareProgressBar } from '@/components/compare/CompareProgressBar';
import { CompareTopBar } from '@/components/compare/CompareTopBar';
import { CompareTrackTable } from '@/components/compare/CompareTrackTable';
import { useCompareStore } from '@/store/compareStore';

export default function ComparePage() {
    const { fetchComparisonItems } = useCompareStore();

    useEffect(() => {
        fetchComparisonItems().catch(console.error);
    }, [fetchComparisonItems]);

    return (
        <main className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden select-none">
            <CompareTopBar />
            <CompareConfigPanel />
            <CompareProgressBar />
            <CompareTrackTable />
        </main>
    );
}
