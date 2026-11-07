import axios from 'axios';
import { create } from 'zustand';
import { type AudioComparisonItem, type AudioComparisonStatus } from '@/domain/remote-audio/types';

export type CompareFilter = 'all' | 'upgrade' | 'dolby' | 'downloaded' | 'same' | 'nomatch' | 'error';
export type CompareSortField = 'confidence' | 'title' | 'artist' | 'status' | 'quality' | 'local_quality' | 'none';

export interface CompareOperationError {
    id: string;
    trackId: string;
    fileTitle: string;
    fileName: string;
    action: 'search' | 'download' | 'match_update';
    errorMessage: string;
    timestamp: number;
}

export interface CompareState {
    items: AudioComparisonItem[];
    isLoading: boolean;
    error: string | null;
    activeFilter: CompareFilter;
    searchQuery: string;
    selectedIds: Set<string>;
    lastSelectedId: string | null;

    // Sorting
    sortBy: CompareSortField;
    sortOrder: 'asc' | 'desc';
    setSort: (by: CompareSortField, order?: 'asc' | 'desc') => void;
    toggleSort: (by: CompareSortField) => void;

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

    // Operation Errors
    operationErrors: CompareOperationError[];
    isErrorDrawerOpen: boolean;
    setIsErrorDrawerOpen: (open: boolean) => void;
    clearOperationErrors: () => void;
    dismissOperationError: (errorId: string) => void;
    retryOperation: (errorId: string) => Promise<void>;

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

    // Manual match editing
    editingMatchItem: AudioComparisonItem | null;
    setEditingMatchItem: (item: AudioComparisonItem | null) => void;
    clearTrackMatch: (localTrackId: string) => Promise<void>;
    setCustomRemoteId: (localTrackId: string, customId: string) => Promise<void>;
    selectCandidateMatch: (localTrackId: string, candidate: any) => Promise<void>;

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
    toggleSelect: (id: string, isShift?: boolean, visibleIds?: string[]) => void;
    selectAll: (ids?: string[]) => void;
    clearSelection: () => void;

    testConnection: () => Promise<void>;
    startSequentialSearch: (itemsToSearch?: AudioComparisonItem[]) => Promise<void>;
    stopSequentialSearch: () => void;
    startSequentialDownload: (itemsToDownload?: AudioComparisonItem[], options?: { forceRedownload?: boolean }) => Promise<void>;
    stopSequentialDownload: () => void;
}

let activeSearchAbort: AbortController | null = null;
let activeDownloadAbort: AbortController | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getStoredHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const headers: Record<string, string> = {};
    try {
        const raw = localStorage.getItem('eclipse_custom_headers');
        if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
                for (const h of list) {
                    if (h.enabled && h.key) headers[h.key.trim()] = h.value;
                }
            }
        }
        const token = localStorage.getItem('eclipse_access_token');
        if (token && !headers['x-eclipse-access']) {
            headers['x-eclipse-access'] = token;
        }
    } catch {}
    return headers;
};

export const useCompareStore = create<CompareState>((set, get) => ({
    items: [],
    isLoading: false,
    error: null,
    activeFilter: 'all',
    searchQuery: '',
    selectedIds: new Set<string>(),
    lastSelectedId: null,

    sortBy: 'none',
    sortOrder: 'desc',
    setSort: (by, order = 'desc') => set({ sortBy: by, sortOrder: order }),
    toggleSort: (by) => {
        const { sortBy, sortOrder } = get();
        if (sortBy === by) {
            if (sortOrder === 'desc') {
                set({ sortOrder: 'asc' });
            } else {
                set({ sortBy: 'none', sortOrder: 'desc' });
            }
        } else {
            set({ sortBy: by, sortOrder: 'desc' });
        }
    },

    apiUrl: typeof window !== 'undefined' ? localStorage.getItem('remote_api_url') || '' : '',
    downloadDirectory: typeof window !== 'undefined' ? localStorage.getItem('remote_download_dir') || '' : '',
    qualityPreference: 'max',
    atmosPreference: 'auto',
    customParams: {},
    downloadMode: 'highest_lossless',
    forceRefetch: false,

    isTestingConnection: false,
    connectionStatus: null,

    // Operation Errors
    operationErrors: [],
    isErrorDrawerOpen: false,
    setIsErrorDrawerOpen: (open) => set({ isErrorDrawerOpen: open }),
    clearOperationErrors: () => set({ operationErrors: [], isErrorDrawerOpen: false }),
    dismissOperationError: (errorId) =>
        set((s) => ({
            operationErrors: s.operationErrors.filter((e) => e.id !== errorId),
        })),
    retryOperation: async (errorId) => {
        const err = get().operationErrors.find((e) => e.id === errorId);
        if (!err) return;
        const targetItem = get().items.find((i) => i.localTrack.id === err.trackId);
        if (!targetItem) return;

        // Dismiss the error before retrying
        get().dismissOperationError(errorId);

        if (err.action === 'search') {
            await get().startSequentialSearch([targetItem]);
        } else if (err.action === 'download') {
            await get().startSequentialDownload([targetItem]);
        }
    },

    isSearching: false,
    searchProgress: { current: 0, total: 0, currentTitle: '', errorCount: 0 },

    isDownloading: false,
    downloadProgress: { current: 0, total: 0, currentTitle: '', currentFileName: '', errorCount: 0 },

    editingMatchItem: null,
    setEditingMatchItem: (item) => set({ editingMatchItem: item }),

    clearTrackMatch: async (localTrackId: string) => {
        const { apiUrl } = get();
        try {
            const res = await axios.post<{ success: boolean; item: AudioComparisonItem }>('/api/remote/match/update', {
                localTrackId,
                apiUrl,
                action: 'clear',
            });
            if (res.data.item) {
                const updated = res.data.item;
                set((s) => ({
                    items: s.items.map((it) => (it.localTrack.id === localTrackId ? updated : it)),
                    editingMatchItem: s.editingMatchItem?.localTrack.id === localTrackId ? updated : s.editingMatchItem,
                }));
            }
        } catch (err) {
            console.error('Failed clearing track match:', err);
            alert('Failed to clear match');
        }
    },

    setCustomRemoteId: async (localTrackId: string, customId: string) => {
        const { apiUrl } = get();
        try {
            const res = await axios.post<{ success: boolean; item: AudioComparisonItem }>('/api/remote/match/update', {
                localTrackId,
                apiUrl,
                action: 'set_id',
                customId,
            });
            if (res.data.item) {
                const updated = res.data.item;
                set((s) => ({
                    items: s.items.map((it) => (it.localTrack.id === localTrackId ? updated : it)),
                    editingMatchItem: s.editingMatchItem?.localTrack.id === localTrackId ? updated : s.editingMatchItem,
                }));
            }
        } catch (err: unknown) {
            const msg = axios.isAxiosError(err) && err.response?.data?.error ? err.response.data.error : 'Failed to set ID';
            console.error('Failed setting custom remote ID:', err);
            alert(msg);
        }
    },

    selectCandidateMatch: async (localTrackId: string, candidate: any) => {
        const { apiUrl } = get();
        try {
            const res = await axios.post<{ success: boolean; item: AudioComparisonItem }>('/api/remote/match/update', {
                localTrackId,
                apiUrl,
                action: 'select_candidate',
                candidate,
            });
            if (res.data.item) {
                const updated = res.data.item;
                set((s) => ({
                    items: s.items.map((it) => (it.localTrack.id === localTrackId ? updated : it)),
                    editingMatchItem: s.editingMatchItem?.localTrack.id === localTrackId ? updated : s.editingMatchItem,
                }));
            }
        } catch (err) {
            console.error('Failed selecting candidate match:', err);
            alert('Failed to update match');
        }
    },

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

    toggleSelect: (id: string, isShift = false, visibleIds: string[] = []) => {
        const { selectedIds, lastSelectedId } = get();
        const next = new Set(selectedIds);

        // Range selection with Shift held
        if (isShift && lastSelectedId && visibleIds.length > 0) {
            const fromIndex = visibleIds.indexOf(lastSelectedId);
            const toIndex = visibleIds.indexOf(id);

            if (fromIndex !== -1 && toIndex !== -1) {
                const start = Math.min(fromIndex, toIndex);
                const end = Math.max(fromIndex, toIndex);
                const rangeIds = visibleIds.slice(start, end + 1);

                // If anchor was selected, select all in range; otherwise deselect all in range
                const shouldSelect = selectedIds.has(lastSelectedId) || !selectedIds.has(id);
                for (const rangeId of rangeIds) {
                    if (shouldSelect) {
                        next.add(rangeId);
                    } else {
                        next.delete(rangeId);
                    }
                }

                set({ selectedIds: next, lastSelectedId: id });
                return;
            }
        }

        // Single toggle
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        set({ selectedIds: next, lastSelectedId: id });
    },

    selectAll: (ids?: string[]) => {
        if (ids) {
            set({ selectedIds: new Set(ids), lastSelectedId: null });
        } else {
            const allIds = get().items.map((i) => i.localTrack.id);
            set({ selectedIds: new Set(allIds), lastSelectedId: null });
        }
    },

    clearSelection: () => set({ selectedIds: new Set<string>(), lastSelectedId: null }),

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

            let wasCached = false;
            try {
                const res = await axios.post<{ item: AudioComparisonItem; cached?: boolean }>(
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

                wasCached = Boolean(res.data?.cached);

                if (res.data.item) {
                    const updatedItem = res.data.item;
                    set((s) => ({
                        items: s.items.map((it) => (it.localTrack.id === updatedItem.localTrack.id ? updatedItem : it)),
                        // Clear any previous search error for this track if successful
                        operationErrors: s.operationErrors.filter(
                            (e) => !(e.trackId === target.localTrack.id && e.action === 'search')
                        ),
                    }));
                }
            } catch (err: unknown) {
                if (axios.isCancel(err)) break;
                wasCached = false;
                const errorMsg =
                    axios.isAxiosError(err) && err.response?.data?.error
                        ? err.response.data.error
                        : err instanceof Error
                        ? err.message
                        : 'Search request failed';

                console.error(`[API:SEARCH:FAIL] Track "${titleDisplay}" (${target.localTrack.id}): ${errorMsg}`);

                const opError: CompareOperationError = {
                    id: `${target.localTrack.id}-search-${Date.now()}`,
                    trackId: target.localTrack.id,
                    fileTitle: titleDisplay,
                    fileName: target.localTrack.filename,
                    action: 'search',
                    errorMessage: errorMsg,
                    timestamp: Date.now(),
                };

                set((s) => ({
                    searchProgress: { ...s.searchProgress, errorCount: s.searchProgress.errorCount + 1 },
                    operationErrors: [
                        opError,
                        ...s.operationErrors.filter(
                            (e) => !(e.trackId === target.localTrack.id && e.action === 'search')
                        ),
                    ],
                }));
            }

            // Polite delay to avoid API throttling ("dont do batch request do sequence requests not to overwhelm the api")
            // When a song is already cached in the database, don't wait — process calls fast.
            // Only restrict calling / throttle when an actual external API call was made.
            if (!wasCached && i < list.length - 1) {
                await sleep(350);
            }
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

    startSequentialDownload: async (customList, options) => {
        if (get().isDownloading) {
            alert('A download is already in progress. Please wait for it to complete or stop it first.');
            return;
        }

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

        // Before download, check if file is already downloaded and prompt:
        // "before download check if file is already downloaded ask if to remove already downloaded file."
        const alreadyDownloaded = targets.filter(
            (it) => it.cachedMatch?.downloadStatus === 'completed' || Boolean(it.cachedMatch?.downloadPath)
        );

        let finalTargets = targets;

        if (alreadyDownloaded.length > 0 && !options?.forceRedownload) {
            if (targets.length === 1) {
                const single = targets[0];
                const trackName = single.localTrack.title || single.localTrack.filename;
                const pathNote = single.cachedMatch?.downloadPath ? `\n(Saved to: ${single.cachedMatch.downloadPath})` : '';
                const confirmRedownload = window.confirm(
                    `"${trackName}" is already downloaded${pathNote}.\n\nDo you want to remove the existing file and re-download?`
                );
                if (!confirmRedownload) {
                    return;
                }
            } else {
                const confirmAll = window.confirm(
                    `${alreadyDownloaded.length} of ${targets.length} selected tracks are already downloaded.\n\n` +
                    `• Click "OK" to remove existing files and re-download all ${targets.length} tracks.\n` +
                    `• Click "Cancel" to skip existing files and only download the ${targets.length - alreadyDownloaded.length} new tracks.`
                );

                if (!confirmAll) {
                    finalTargets = targets.filter(
                        (it) => it.cachedMatch?.downloadStatus !== 'completed' && !it.cachedMatch?.downloadPath
                    );
                    if (finalTargets.length === 0) {
                        alert('All selected tracks are already downloaded. Nothing new to download.');
                        return;
                    }
                }
            }
        }

        activeDownloadAbort = new AbortController();
        set({
            isDownloading: true,
            downloadProgress: { current: 0, total: finalTargets.length, currentTitle: '', currentFileName: '', errorCount: 0 },
        });

        for (let i = 0; i < finalTargets.length; i++) {
            if (activeDownloadAbort.signal.aborted) break;

            const target = finalTargets[i];
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
                        removeExisting: true,
                        headers: getStoredHeaders(),
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
                                        previousDownloadPath: null,
                                        downloadedAt: new Date(),
                                        downloadError: null,
                                    },
                                };
                            }
                            return it;
                        }),
                        // Clear any previous download error for this track if successful
                        operationErrors: s.operationErrors.filter(
                            (e) => !(e.trackId === target.localTrack.id && e.action === 'download')
                        ),
                    }));
                }
            } catch (err: unknown) {
                if (axios.isCancel(err)) break;
                const errorMsg =
                    axios.isAxiosError(err) && err.response?.data?.error
                        ? err.response.data.error
                        : err instanceof Error
                        ? err.message
                        : 'Download request failed';

                console.error(`[API:DOWNLOAD:FAIL] Track "${titleDisplay}" (${target.localTrack.id}): ${errorMsg}`);

                const opError: CompareOperationError = {
                    id: `${target.localTrack.id}-download-${Date.now()}`,
                    trackId: target.localTrack.id,
                    fileTitle: titleDisplay,
                    fileName: target.localTrack.filename,
                    action: 'download',
                    errorMessage: errorMsg,
                    timestamp: Date.now(),
                };

                set((s) => ({
                    downloadProgress: { ...s.downloadProgress, errorCount: s.downloadProgress.errorCount + 1 },
                    operationErrors: [
                        opError,
                        ...s.operationErrors.filter(
                            (e) => !(e.trackId === target.localTrack.id && e.action === 'download')
                        ),
                    ],
                    items: s.items.map((it) => {
                        if (it.localTrack.id === target.localTrack.id && it.cachedMatch) {
                            return {
                                ...it,
                                cachedMatch: {
                                    ...it.cachedMatch,
                                    downloadStatus: 'failed',
                                    downloadError: errorMsg,
                                },
                            };
                        }
                        return it;
                    }),
                }));
            }

            // Polite delay between sequential downloads (only when more downloads remain)
            // Allows bitchord addon sufficient time to release previous stream resources
            if (i < finalTargets.length - 1) {
                await sleep(1500);
            }
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
