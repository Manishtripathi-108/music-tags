'use client';

import React, { useEffect } from 'react';
import { EclipseTopBar } from '@/components/eclipse/EclipseTopBar';
import { EclipseManifestBanner } from '@/components/eclipse/EclipseManifestBanner';
import { EclipseSearchView } from '@/components/eclipse/EclipseSearchView';
import { EclipseCatalogsView } from '@/components/eclipse/EclipseCatalogsView';
import { EclipseDetailModals } from '@/components/eclipse/EclipseDetailModals';
import { EclipseAudioPlayer } from '@/components/eclipse/EclipseAudioPlayer';
import { useEclipseStore } from '@/store/eclipseStore';

export default function EclipsePage() {
    const { activeTab, setActiveTab, manifest, connectAddon, addonUrl } = useEclipseStore();

    // Auto-connect if addonUrl exists in localStorage
    useEffect(() => {
        if (addonUrl && !manifest) {
            connectAddon(addonUrl);
        }
    }, [addonUrl, manifest, connectAddon]);

    const hasCatalogs = Array.isArray(manifest?.catalogs) && manifest.catalogs.length > 0;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            <EclipseTopBar />
            <EclipseManifestBanner />

            {/* View Selector Tabs (when connected) */}
            {manifest && (
                <div className="border-b px-4 py-1.5 flex items-center gap-2 bg-muted/10 text-xs select-none">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-3 py-1 rounded cursor-pointer font-semibold transition-colors ${
                            activeTab === 'search' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Search & Browse
                    </button>

                    {hasCatalogs && (
                        <button
                            onClick={() => setActiveTab('catalogs')}
                            className={`px-3 py-1 rounded cursor-pointer font-semibold transition-colors ${
                                activeTab === 'catalogs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Catalogs & Shelves ({manifest.catalogs!.length})
                        </button>
                    )}
                </div>
            )}

            {/* Main Tab Views */}
            <main className="flex-1 flex flex-col min-h-0 pb-24 overflow-hidden">
                {activeTab === 'catalogs' && hasCatalogs ? <EclipseCatalogsView /> : <EclipseSearchView />}
            </main>

            {/* Modals & Bottom Audio Player */}
            <EclipseDetailModals />
            <EclipseAudioPlayer />
        </div>
    );
}
