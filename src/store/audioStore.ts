import axios from 'axios';
import { create } from 'zustand';

import { type DuplicateCluster, type DuplicateFindApiResponse, type DuplicateMatchMode } from '@/domain/duplicates/types';
import {
    type NormalizeAllLyricsApiResponse,
    type NormalizeLrcApiResponse,
    type RemoveFolderApiResponse,
    type ResolveDuplicatesApiResponse,
    type StatusApiResponse,
    type TrackDetailApiResponse,
    type TracksApiResponse,
} from '@/domain/media/dto';
import { type ActiveTrackDetail, type Track } from '@/domain/media/track';
import { type ScanJob, type ScanProgressEvent } from '@/domain/scanner/types';

interface AudioStoreState {
    tracks: Track[];
    totalTracks: number;
    isLoadingTracks: boolean;
    selectedTrackIds: Set<string>;
    activeTrackId: string | null;
    activeTrackDetail: ActiveTrackDetail;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    searchQuery: string;
    activeFilter: string;
    isScanModalOpen: boolean;
    activeScanJob: ScanJob | null;
    systemStatus: StatusApiResponse | null;
    isLoadingStatus: boolean;
    isNormalizingLyrics: boolean;

    duplicateClusters: DuplicateCluster[];
    isDuplicateModalOpen: boolean;
    isLoadingDuplicates: boolean;

    setTracks: (tracks: Track[]) => void;
    selectTrack: (id: string, isMulti?: boolean, isRange?: boolean) => void;
    fetchTrackDetail: (id: string) => Promise<void>;
    setSorting: (column: string, order: 'asc' | 'desc') => void;
    setSearchQuery: (query: string) => void;
    setActiveFilter: (filter: string) => void;
    setIsScanModalOpen: (open: boolean) => void;
    setActiveScanJob: (job: ScanJob | null) => void;
    fetchTracks: () => Promise<void>;
    fetchSystemStatus: () => Promise<void>;
    removeFolder: (directory: string, syncBeforeDelete: boolean) => Promise<RemoveFolderApiResponse>;
    updateTrackInline: (id: string, fields: Partial<Track>) => void;
    normalizeTrackLrc: (trackId: string, lrcContent?: string) => Promise<NormalizeLrcApiResponse>;
    normalizeAllLyrics: (folderPath?: string) => Promise<void>;

    setIsDuplicateModalOpen: (open: boolean) => void;
    fetchDuplicates: (mode?: DuplicateMatchMode) => Promise<void>;
    resolveDuplicates: (removeTrackIds: string[], deleteFiles?: boolean) => Promise<ResolveDuplicatesApiResponse>;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
    tracks: [],
    totalTracks: 0,
    isLoadingTracks: false,
    selectedTrackIds: new Set<string>(),
    activeTrackId: null,
    activeTrackDetail: {
        metadata: null,
        rawTags: [],
        isLoading: false,
    },
    sortBy: 'trackNumber',
    sortOrder: 'asc',
    searchQuery: '',
    activeFilter: 'all',
    isScanModalOpen: false,
    activeScanJob: null,
    systemStatus: null,
    isLoadingStatus: false,
    isNormalizingLyrics: false,

    duplicateClusters: [],
    isDuplicateModalOpen: false,
    isLoadingDuplicates: false,

    setTracks: (tracks) => set({ tracks, totalTracks: tracks.length }),

    selectTrack: (id: string, isMulti = false, isRange = false) => {
        const { tracks, selectedTrackIds, activeTrackId } = get();
        const clickedTrack = tracks.find((t) => t.id === id);
        if (!clickedTrack) return;

        let newSelected = new Set(selectedTrackIds);

        if (isRange && activeTrackId) {
            const fromIndex = tracks.findIndex((t) => t.id === activeTrackId);
            const toIndex = tracks.findIndex((t) => t.id === id);
            if (fromIndex !== -1 && toIndex !== -1) {
                const start = Math.min(fromIndex, toIndex);
                const end = Math.max(fromIndex, toIndex);
                const rangeIds = tracks.slice(start, end + 1).map((t) => t.id);
                newSelected = isMulti ? new Set([...selectedTrackIds, ...rangeIds]) : new Set(rangeIds);
            }
        } else if (isMulti) {
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
        } else {
            newSelected = new Set([id]);
        }

        const rawTags: { tag: string; group: string; value: string | number }[] = [
            { tag: 'Title', group: 'Metadata', value: clickedTrack.title || '-' },
            { tag: 'Artist', group: 'Metadata', value: clickedTrack.artist || '-' },
            { tag: 'Album', group: 'Metadata', value: clickedTrack.album || '-' },
            { tag: 'TrackNumber', group: 'Metadata', value: clickedTrack.trackNumber ?? '-' },
            { tag: 'Year', group: 'Metadata', value: clickedTrack.year ?? '-' },
            { tag: 'Genre', group: 'Metadata', value: clickedTrack.genre || '-' },
            { tag: 'BPM', group: 'Audio', value: clickedTrack.bpm ?? '-' },
            { tag: 'InitialKey', group: 'Audio', value: clickedTrack.initialKey || '-' },
            { tag: 'Composer', group: 'Publishing', value: clickedTrack.composer || '-' },
            { tag: 'Publisher', group: 'Publishing', value: clickedTrack.publisher || '-' },
            { tag: 'ISRC', group: 'Identifiers', value: clickedTrack.isrc || '-' },
            { tag: 'LyricsType', group: 'Lyrics', value: clickedTrack.lyricsType || 'none' },
            { tag: 'DurationSeconds', group: 'Stream', value: clickedTrack.durationSeconds ?? '-' },
            { tag: 'BitrateKbps', group: 'Stream', value: clickedTrack.bitrateKbps ?? '-' },
            { tag: 'SampleRateHz', group: 'Stream', value: clickedTrack.sampleRateHz ?? '-' },
            { tag: 'Codec', group: 'Stream', value: clickedTrack.codec ?? '-' },
            { tag: 'Lossless', group: 'Stream', value: String(clickedTrack.lossless) },
        ];

        set({
            selectedTrackIds: newSelected,
            activeTrackId: id,
            activeTrackDetail: {
                metadata: clickedTrack,
                rawTags,
                isLoading: true,
            },
        });

        get().fetchTrackDetail(id);
    },

    fetchTrackDetail: async (id: string) => {
        try {
            const { data } = await axios.get<TrackDetailApiResponse>(`/api/files/${id}/tags`);
            if (get().activeTrackId === id) {
                set((state) => ({
                    activeTrackDetail: {
                        metadata: data.metadata || state.activeTrackDetail.metadata,
                        rawTags: data.rawTags && data.rawTags.length > 0 ? data.rawTags : state.activeTrackDetail.rawTags,
                        isLoading: false,
                    },
                }));
            }
        } catch (err) {
            console.error('Failed to fetch track detail:', err);
            if (get().activeTrackId === id) {
                set((state) => ({
                    activeTrackDetail: {
                        ...state.activeTrackDetail,
                        isLoading: false,
                    },
                }));
            }
        }
    },

    setSorting: (column: string, order: 'asc' | 'desc') => {
        set({ sortBy: column, sortOrder: order });
    },

    setSearchQuery: (query: string) => set({ searchQuery: query }),

    setActiveFilter: (filter: string) => set({ activeFilter: filter }),

    setIsScanModalOpen: (open: boolean) => set({ isScanModalOpen: open }),

    setActiveScanJob: (job: ScanJob | null) => set({ activeScanJob: job }),

    fetchTracks: async () => {
        set({ isLoadingTracks: true });
        try {
            const { data } = await axios.get<TracksApiResponse>('/api/tracks');
            const fetchedTracks = data?.tracks || [];
            const { activeTrackId, selectTrack } = get();

            set({ tracks: fetchedTracks, totalTracks: fetchedTracks.length });

            if (fetchedTracks.length > 0) {
                if (!activeTrackId || !fetchedTracks.some((t) => t.id === activeTrackId)) {
                    selectTrack(fetchedTracks[0].id);
                } else {
                    const currentActive = fetchedTracks.find((t) => t.id === activeTrackId);
                    if (currentActive) {
                        selectTrack(currentActive.id);
                    }
                }
            } else {
                set({
                    selectedTrackIds: new Set<string>(),
                    activeTrackId: null,
                    activeTrackDetail: { metadata: null, rawTags: [], isLoading: false },
                });
            }
        } catch (err) {
            console.error('Failed to fetch tracks:', err);
        } finally {
            set({ isLoadingTracks: false });
        }
    },

    fetchSystemStatus: async () => {
        set({ isLoadingStatus: true });
        try {
            const { data } = await axios.get<StatusApiResponse>('/api/status');
            set({ systemStatus: data });
        } catch (err) {
            console.error('Failed to fetch system status:', err);
            set({
                systemStatus: {
                    binaries: {
                        exiftool: { name: 'exiftool', found: false },
                        ffprobe: { name: 'ffprobe', found: false },
                        ffmpeg: { name: 'ffmpeg', found: false },
                        allReady: false,
                    },
                    allReady: false,
                },
            });
        } finally {
            set({ isLoadingStatus: false });
        }
    },

    updateTrackInline: (id: string, fields: Partial<Track>) => {
        const { tracks, activeTrackId, activeTrackDetail } = get();
        const updatedTracks = tracks.map((track) => {
            if (track.id === id) {
                return { ...track, ...fields };
            }
            return track;
        });

        const activeTrack = activeTrackId === id ? ({ ...(activeTrackDetail.metadata || {}), ...fields } as Track) : activeTrackDetail.metadata;

        set({
            tracks: updatedTracks,
            activeTrackDetail: {
                ...activeTrackDetail,
                metadata: activeTrack,
            },
        });
    },

    removeFolder: async (directory: string, syncBeforeDelete: boolean) => {
        const { data } = await axios.post<RemoveFolderApiResponse>('/api/folders/remove', {
            directory,
            syncBeforeDelete,
        });

        const { activeFilter, setActiveFilter, fetchTracks } = get();
        if (activeFilter === `folder:${directory}`) {
            setActiveFilter('all');
        }

        await fetchTracks();
        return data;
    },

    normalizeTrackLrc: async (trackId: string, lrcContent?: string) => {
        const { data } = await axios.post<NormalizeLrcApiResponse>('/api/lyrics/normalize', {
            trackId,
            lrcContent,
        });

        const { updateTrackInline, fetchTracks } = get();
        if (data.success && data.normalizedLrc) {
            updateTrackInline(trackId, {
                lyrics: data.normalizedLrc,
                lyricsType: 'synced',
                lyricsSyncedJson: JSON.stringify(data.normalizedLrc),
            });
            await fetchTracks();
        }

        return data;
    },

    normalizeAllLyrics: async (folderPath?: string) => {
        const { isNormalizingLyrics, fetchTracks } = get();
        if (isNormalizingLyrics) return;

        set({ isNormalizingLyrics: true });

        try {
            const { data } = await axios.post<NormalizeAllLyricsApiResponse>('/api/lyrics/normalize-all', { folderPath });

            if (!data.success || !data.jobId) {
                set({ isNormalizingLyrics: false });
                return;
            }

            const jobId = data.jobId;
            const eventSource = new EventSource(`/api/lyrics/normalize-all?jobId=${jobId}`);

            eventSource.onmessage = (event) => {
                try {
                    const progress: ScanProgressEvent = JSON.parse(event.data);
                    set({
                        activeScanJob: {
                            jobId: progress.jobId,
                            status: progress.status,
                            scannedFiles: progress.scannedFiles,
                            extractedFiles: progress.extractedFiles,
                            totalEstimated: progress.totalEstimated,
                            currentFile: progress.currentFile,
                            currentDirectory: progress.currentDirectory,
                            filesPerSecond: progress.filesPerSecond,
                            errorMessage: progress.errorMessage,
                        },
                    });

                    if (progress.status === 'COMPLETED' || progress.status === 'FAILED' || progress.status === 'CANCELLED') {
                        eventSource.close();
                        set({ isNormalizingLyrics: false });
                        fetchTracks().catch(console.error);
                    }
                } catch (err) {
                    console.error('Error parsing lyrics progress event:', err);
                }
            };

            eventSource.onerror = () => {
                eventSource.close();
                set({ isNormalizingLyrics: false });
                fetchTracks().catch(console.error);
            };
        } catch (error) {
            console.error('Failed to start batch LRC normalization:', error);
            set({ isNormalizingLyrics: false });
        }
    },

    setIsDuplicateModalOpen: (open: boolean) => set({ isDuplicateModalOpen: open }),

    fetchDuplicates: async (mode = 'all') => {
        set({ isLoadingDuplicates: true });
        try {
            const { data } = await axios.get<DuplicateFindApiResponse>(`/api/duplicates?mode=${mode}`);
            set({ duplicateClusters: data.clusters || [] });
        } catch (err) {
            console.error('Failed to fetch duplicates:', err);
            set({ duplicateClusters: [] });
        } finally {
            set({ isLoadingDuplicates: false });
        }
    },

    resolveDuplicates: async (removeTrackIds: string[], deleteFiles = false) => {
        try {
            const { data } = await axios.post<ResolveDuplicatesApiResponse>('/api/duplicates', {
                removeTrackIds,
                deleteFiles,
            });

            // Refresh tracks and duplicates
            await get().fetchTracks();
            await get().fetchDuplicates();

            return data;
        } catch (err) {
            console.error('Failed to resolve duplicates:', err);
            throw err;
        }
    },
}));

export default useAudioStore;
