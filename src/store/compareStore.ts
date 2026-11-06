import axios from 'axios';
import { create } from 'zustand';
import { type AudioComparisonItem, type AudioComparisonStatus } from '@/domain/remote-audio/types';

export type CompareFilter = 'all' | 'upgrade' | 'dolby' | 'downloaded' | 'same' | 'nomatch';

export interface CompareState {
    items: AudioComparisonItem[];
    isLoading: boolean;
    error: string | null;
    activeFilter: CompareFilter;
    searchQuery: string;
    selectedIds: Set<string>;

    // Config
    apiUrl: string;
    downloadDirectory: string;
    qualityPreference: 'max' | 'hires' | 'lossless' | 'high' | 'low';
    atmosPreference: 'auto' | 'none';
    customParams: Record<string, string>;
    downloadMode: 'highest_lossless' | 'dolby_atmos';
    forceRefetch: boolean;

    // Connection validation
    isTestingConnection: boolean;
    connectionStatus: {
        apiOk: boolean;
        apiMessage: string;
        directoryOk: boolean;
        directoryMessage: string;
    } | null;

    // Sequential search state
    isSearching: boolean;
    searchProgress: {
        current: number;
        total: number;
        currentTitle: string;
        errorCount: number;
    };

    // Sequential download state
    isDownloading: boolean;
    downloadProgress: {
        current: number;
        total: number;
        currentTitle: string;
        currentFileName: string;
        errorCount: number;
    };

    // Actions
    fetchComparisonItems: () => Promise<void>;
    setApiUrl: (url: string) => void;
    setDownloadDirectory: (dir: string) => void;
    setQualityPreference: (quality: 'max' | 'hires' | 'lossless' | 'high' | 'low') => void;
    setAtmosPreference: (atmos: 'auto' | 'none') => void;
    setDownloadMode: (mode: 'highest_lossless' | 'dolby_atmos') => void;
    setForceRefetch: (force: boolean) => void;
    setCustomParams: (params: Record<string, string>) => void;
    setActiveFilter: (filter: CompareFilter) => void;
    setSearchQuery: (query: string) => void;
    toggleSelect: (id: string) => void;
    selectAll: (ids?: string[]) => void;
    clearSelection: () => void;

    testConnection: () => Promise<void>;
    startSequentialSearch: (itemsToSearch?: AudioComparisonItem[]) => Promise<void>;
    stopSequentialSearch: () => void;
    startSequentialDownload: (itemsToDownload?: AudioComparisonItem[]) => Promise<void>;
    stopSequentialDownload: () => void;
}

let activeSearchAbort: AbortController | null = null;
let activeDownloadAbort: AbortController | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useCompareStore = create<CompareState>((set, get) => ({
    items: [],
    isLoading: false,
    error: null,
    activeFilter: 'all',
    searchQuery: '',
    selectedIds: new Set<string>(),

    apiUrl: typeof window !== 'undefined' ? localStorage.getItem('remote_api_url') || '' : '',
    downloadDirectory: typeof window !== 'undefined' ? localStorage.getItem('remote_download_dir') || '' : '',
    qualityPreference: 'max',
    atmosPreference: 'auto',
    customParams: {},
    downloadMode: 'highest_lossless',
    forceRefetch: false,

    isTestingConnection: false,
    connectionStatus: null,

    isSearching: false,
    searchProgress: { current: 0, total: 0, currentTitle: '', errorCount: 0 },

    isDownloading: false,
    downloadProgress: { current: 0, total: 0, currentTitle: '', currentFileName: '', errorCount: 0 },

    fetchComparisonItems: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await axios.get<{ items: AudioComparisonItem[]; count: number }>('/api/remote/compare');
            set({ items: res.data.items, isLoading: false });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch comparison items';
            set({ error: msg, isLoading: false });
        }
    },

    setApiUrl: (url: string) => {
        if (typeof window !== 'undefined') localStorage.setItem('remote_api_url', url);
        set({ apiUrl: url, connectionStatus: null });
    },

    setDownloadDirectory: (dir: string) => {
        if (typeof window !== 'undefined') localStorage.setItem('remote_download_dir', dir);
        set({ downloadDirectory: dir, connectionStatus: null });
    },

    setQualityPreference: (quality) => set({ qualityPreference: quality }),
    setAtmosPreference: (atmos) => set({ atmosPreference: atmos }),
    setDownloadMode: (mode) => set({ downloadMode: mode }),
    setForceRefetch: (force) => set({ forceRefetch: force }),
    setCustomParams: (params) => set({ customParams: params }),
    setActiveFilter: (filter) => set({ activeFilter: filter }),
    setSearchQuery: (query) => set({ searchQuery: query }),

    toggleSelect: (id: string) => {
        const next = new Set(get().selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        set({ selectedIds: next });
    },

    selectAll: (ids?: string[]) => {
        if (ids) {
            set({ selectedIds: new Set(ids) });
        } else {
            const allIds = get().items.map((i) => i.localTrack.id);
            set({ selectedIds: new Set(allIds) });
        }
    },

    clearSelection: () => set({ selectedIds: new Set<string>() }),

    testConnection: async () => {
        const { apiUrl, downloadDirectory } = get();
        set({ isTestingConnection: true });
        try {
            const res = await axios.post('/api/remote/test-connection', { apiUrl, downloadDirectory });
            set({ connectionStatus: res.data, isTestingConnection: false });
        } catch (err: unknown) {
            set({
                connectionStatus: {
                    apiOk: false,
                    apiMessage: err instanceof Error ? err.message : 'Connection test failed',
                    directoryOk: false,
                    directoryMessage: 'Directory test failed',
                },
                isTestingConnection: false,
            });
        }
    },

    startSequentialSearch: async (customList) => {
        const { apiUrl, qualityPreference, atmosPreference, customParams, forceRefetch, items, selectedIds } = get();
        if (!apiUrl) {
            alert('Please provide the API Base URL first.');
            return;
        }

        const list = customList || (selectedIds.size > 0 ? items.filter((i) => selectedIds.has(i.localTrack.id)) : items);
        if (list.length === 0) return;

        activeSearchAbort = new AbortController();
        set({
            isSearching: true,
            searchProgress: { current: 0, total: list.length, currentTitle: '', errorCount: 0 },
        });

        for (let i = 0; i < list.length; i++) {
            if (activeSearchAbort.signal.aborted) break;

            const target = list[i];
            const titleDisplay = target.localTrack.title || target.localTrack.filename;
            set((s) => ({
                searchProgress: { ...s.searchProgress, current: i + 1, currentTitle: titleDisplay },
            }));

            try {
                const res = await axios.post<{ item: AudioComparisonItem }>(
                    '/api/remote/search-track',
                    {
                        trackId: target.localTrack.id,
                        apiUrl,
                        quality: qualityPreference,
                        atmos: atmosPreference,
                        customParams,
                        forceRefetch,
                        preferDolby: get().downloadMode === 'dolby_atmos',
                    },
                    { signal: activeSearchAbort.signal }
                );

                if (res.data.item) {
                    const updatedItem = res.data.item;
                    set((s) => ({
                        items: s.items.map((it) => (it.localTrack.id === updatedItem.localTrack.id ? updatedItem : it)),
                    }));
                }
            } catch (err: unknown) {
                if (axios.isCancel(err)) break;
                set((s) => ({
                    searchProgress: { ...s.searchProgress, errorCount: s.searchProgress.errorCount + 1 },
                }));
            }

            // Polite delay to avoid API throttling ("dont do batch request do sequence requests not to overwhelm the api")
            await sleep(350);
        }

        set({ isSearching: false });
        activeSearchAbort = null;
    },

    stopSequentialSearch: () => {
        if (activeSearchAbort) {
            activeSearchAbort.abort();
            activeSearchAbort = null;
        }
        set({ isSearching: false });
    },

    startSequentialDownload: async (customList) => {
        const { apiUrl, downloadDirectory, downloadMode, qualityPreference, atmosPreference, items, selectedIds } = get();
        if (!apiUrl) {
            alert('Please provide the API URL.');
            return;
        }
        if (!downloadDirectory) {
            alert('Please specify the destination Download Directory.');
            return;
        }

        const eligible = customList || (selectedIds.size > 0 ? items.filter((i) => selectedIds.has(i.localTrack.id)) : items);
        // Filter based on strict mode rules:
        // "give options to download highest lossless file and other as dolby supported. never download dolby if it not not selected and nevr download non dolby if dolby is selected"
        const targets = eligible.filter((it) => {
            if (!it.remoteTrack) return false;
            if (downloadMode === 'highest_lossless') {
                return it.canDownloadLossless && !it.remoteTrack.atmos;
            } else if (downloadMode === 'dolby_atmos') {
                return it.isDolbyAvailable || it.remoteTrack.atmos;
            }
            return false;
        });

        if (targets.length === 0) {
            alert(`No eligible tracks found for '${downloadMode === 'highest_lossless' ? 'Highest Lossless' : 'Dolby Atmos'}' mode.`);
            return;
        }

        activeDownloadAbort = new AbortController();
        set({
            isDownloading: true,
            downloadProgress: { current: 0, total: targets.length, currentTitle: '', currentFileName: '', errorCount: 0 },
        });

        for (let i = 0; i < targets.length; i++) {
            if (activeDownloadAbort.signal.aborted) break;

            const target = targets[i];
            const titleDisplay = target.localTrack.title || target.localTrack.filename;
            set((s) => ({
                downloadProgress: {
                    ...s.downloadProgress,
                    current: i + 1,
                    currentTitle: titleDisplay,
                    currentFileName: `${target.localTrack.isrc || target.localTrack.id}...`,
                },
            }));

            try {
                const res = await axios.post<{ success: boolean; filePath: string; fileName: string }>(
                    '/api/remote/download-track',
                    {
                        trackId: target.localTrack.id,
                        remoteTrackId: target.remoteTrack!.id,
                        apiUrl,
                        downloadDirectory,
                        mode: downloadMode,
                        quality: qualityPreference,
                        atmos: atmosPreference,
                    },
                    { signal: activeDownloadAbort.signal }
                );

                if (res.data.success) {
                    set((s) => ({
                        items: s.items.map((it) => {
                            if (it.localTrack.id === target.localTrack.id && it.cachedMatch) {
                                return {
                                    ...it,
                                    cachedMatch: {
                                        ...it.cachedMatch,
                                        downloadStatus: 'completed',
                                        downloadPath: res.data.filePath,
                                        downloadedAt: new Date(),
                                    },
                                };
                            }
                            return it;
                        }),
                    }));
                }
            } catch (err: unknown) {
                if (axios.isCancel(err)) break;
                set((s) => ({
                    downloadProgress: { ...s.downloadProgress, errorCount: s.downloadProgress.errorCount + 1 },
                }));
            }

            // Polite delay between sequential downloads
            await sleep(500);
        }

        set({ isDownloading: false });
        activeDownloadAbort = null;
    },

    stopSequentialDownload: () => {
        if (activeDownloadAbort) {
            activeDownloadAbort.abort();
            activeDownloadAbort = null;
        }
        set({ isDownloading: false });
    },
}));
