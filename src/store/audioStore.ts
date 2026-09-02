import { create } from 'zustand';
import { type ActiveTrackDetail, type ScanJob, type Track } from '@/types/audio';

const INITIAL_TRACKS: Track[] = [
    {
        id: 'track-1',
        filename: '01 - Solar Flare.flac',
        filePath: 'E:/Music/Electronic/Solar Flare.flac',
        title: 'Solar Flare',
        artist: 'Cyberwave',
        albumArtist: 'Cyberwave',
        album: 'Neon Horizon',
        trackNumber: 1,
        discNumber: 1,
        year: 2024,
        genre: 'Synthwave',
        bpm: 128.0,
        initialKey: '8A',
        comment: 'Mastered for 24-bit studio release',
        durationSeconds: 245,
        bitrateKbps: 1042,
        sampleRateHz: 48000,
        channels: 2,
        channelLayout: 'stereo',
        bitDepth: 24,
        codec: 'flac',
        extension: '.flac',
        lossless: true,
        hasCoverArt: true,
    },
    {
        id: 'track-2',
        filename: '02 - Midnight Transit.flac',
        filePath: 'E:/Music/Electronic/Midnight Transit.flac',
        title: 'Midnight Transit',
        artist: 'Cyberwave',
        albumArtist: 'Cyberwave',
        album: 'Neon Horizon',
        trackNumber: 2,
        discNumber: 1,
        year: 2024,
        genre: 'Synthwave',
        bpm: 122.5,
        initialKey: '11B',
        comment: 'Features analog Juno-106 synthesis',
        durationSeconds: 310,
        bitrateKbps: 980,
        sampleRateHz: 44100,
        channels: 2,
        channelLayout: 'stereo',
        bitDepth: 16,
        codec: 'flac',
        extension: '.flac',
        lossless: true,
        hasCoverArt: true,
    },
    {
        id: 'track-3',
        filename: '03 - Quantum Horizon.mp3',
        filePath: 'E:/Music/Electronic/Quantum Horizon.mp3',
        title: 'Quantum Horizon',
        artist: 'Aura Vector',
        albumArtist: 'Aura Vector',
        album: 'Dimension 9',
        trackNumber: 3,
        discNumber: 1,
        year: 2023,
        genre: 'Ambient Techno',
        bpm: 134.0,
        initialKey: '4A',
        comment: 'Live club recording',
        durationSeconds: 378,
        bitrateKbps: 320,
        sampleRateHz: 44100,
        channels: 2,
        channelLayout: 'stereo',
        bitDepth: 16,
        codec: 'mp3',
        extension: '.mp3',
        lossless: false,
        hasCoverArt: true,
    },
    {
        id: 'track-4',
        filename: '04 - Obsidian Groove.flac',
        filePath: 'E:/Music/Jazz/Obsidian Groove.flac',
        title: 'Obsidian Groove',
        artist: 'The Velvet Trio',
        albumArtist: 'The Velvet Trio',
        album: 'Blue Notes & Amber',
        trackNumber: 4,
        discNumber: 1,
        year: 2022,
        genre: 'Modern Jazz',
        bpm: 96.0,
        initialKey: '6B',
        comment: 'Direct DSD to FLAC conversion',
        durationSeconds: 290,
        bitrateKbps: 1250,
        sampleRateHz: 96000,
        channels: 2,
        channelLayout: 'stereo',
        bitDepth: 24,
        codec: 'flac',
        extension: '.flac',
        lossless: true,
        hasCoverArt: false,
    },
    {
        id: 'track-5',
        filename: '05 - Starlight Echoes.mp3',
        filePath: 'E:/Music/Ambient/Starlight Echoes.mp3',
        title: 'Starlight Echoes',
        artist: 'Nova Drift',
        albumArtist: 'Nova Drift',
        album: 'Deep Space Reverie',
        trackNumber: 5,
        discNumber: 1,
        year: 2025,
        genre: 'Ambient',
        bpm: 85.0,
        initialKey: '2A',
        comment: 'Binaural panning mix',
        durationSeconds: 412,
        bitrateKbps: 320,
        sampleRateHz: 48000,
        channels: 2,
        channelLayout: 'stereo',
        bitDepth: 16,
        codec: 'mp3',
        extension: '.mp3',
        lossless: false,
        hasCoverArt: true,
    },
    {
        id: 'track-6',
        filename: '06 - Velvet Skyline.wav',
        filePath: 'E:/Music/Electronic/Velvet Skyline.wav',
        title: 'Velvet Skyline',
        artist: 'Lofi Horizons',
        albumArtist: 'Lofi Horizons',
        album: 'Late Night Chill',
        trackNumber: 6,
        discNumber: 1,
        year: 2024,
        genre: 'Lo-Fi Chill',
        bpm: 78.0,
        initialKey: '5B',
        comment: 'Broadcast WAV with BWF chunk',
        durationSeconds: 198,
        bitrateKbps: 1411,
        sampleRateHz: 44100,
        channels: 2,
        channelLayout: 'stereo',
        bitDepth: 16,
        codec: 'wav',
        extension: '.wav',
        lossless: true,
        hasCoverArt: false,
    },
];

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

    // Actions
    setTracks: (tracks: Track[]) => void;
    selectTrack: (id: string, isMulti?: boolean, isRange?: boolean) => void;
    setSorting: (column: string, order: 'asc' | 'desc') => void;
    setSearchQuery: (query: string) => void;
    setActiveFilter: (filter: string) => void;
    setIsScanModalOpen: (open: boolean) => void;
    setActiveScanJob: (job: ScanJob | null) => void;
    fetchTracks: () => Promise<void>;
    updateTrackInline: (id: string, fields: Partial<Track>) => void;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
    tracks: INITIAL_TRACKS,
    totalTracks: INITIAL_TRACKS.length,
    isLoadingTracks: false,
    selectedTrackIds: new Set([INITIAL_TRACKS[0].id]),
    activeTrackId: INITIAL_TRACKS[0].id,
    activeTrackDetail: {
        metadata: INITIAL_TRACKS[0],
        rawTags: [
            { tag: 'Title', group: 'ID3v2.4', value: 'Solar Flare' },
            { tag: 'Artist', group: 'ID3v2.4', value: 'Cyberwave' },
            { tag: 'Album', group: 'ID3v2.4', value: 'Neon Horizon' },
            { tag: 'TrackNumber', group: 'ID3v2.4', value: '1' },
            { tag: 'Year', group: 'ID3v2.4', value: '2024' },
            { tag: 'Genre', group: 'ID3v2.4', value: 'Synthwave' },
            { tag: 'BPM', group: 'ID3v2.4', value: '128.0' },
            { tag: 'InitialKey', group: 'ID3v2.4', value: '8A' },
            { tag: 'AudioBitrate', group: 'Composite', value: '1042 kbps' },
            { tag: 'SampleRate', group: 'Composite', value: '48000 Hz' },
            { tag: 'BitsPerSample', group: 'Composite', value: '24' },
            { tag: 'Channels', group: 'Composite', value: '2' },
            { tag: 'Duration', group: 'Composite', value: '04:05' },
        ],
        isLoading: false,
    },
    sortBy: 'trackNumber',
    sortOrder: 'asc',
    searchQuery: '',
    activeFilter: 'all',
    isScanModalOpen: false,
    activeScanJob: null,

    setTracks: (tracks) => set({ tracks, totalTracks: tracks.length }),

    selectTrack: (id: string, isMulti = false, _isRange = false) => {
        const { tracks, selectedTrackIds } = get();
        const clickedTrack = tracks.find((t) => t.id === id);
        if (!clickedTrack) return;

        let newSelected = new Set(selectedTrackIds);
        if (isMulti) {
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
        } else {
            newSelected = new Set([id]);
        }

        // Generate raw tags for inspector view
        const rawTags: { tag: string; group: string; value: string | number }[] = [
            { tag: 'Title', group: 'Metadata', value: clickedTrack.title || '-' },
            { tag: 'Artist', group: 'Metadata', value: clickedTrack.artist || '-' },
            { tag: 'Album', group: 'Metadata', value: clickedTrack.album || '-' },
            { tag: 'TrackNumber', group: 'Metadata', value: clickedTrack.trackNumber ?? '-' },
            { tag: 'Year', group: 'Metadata', value: clickedTrack.year ?? '-' },
            { tag: 'Genre', group: 'Metadata', value: clickedTrack.genre || '-' },
            { tag: 'BPM', group: 'Audio', value: clickedTrack.bpm ?? '-' },
            { tag: 'InitialKey', group: 'Audio', value: clickedTrack.initialKey || '-' },
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
                isLoading: false,
            },
        });
    },

    setSorting: (column: string, order: 'asc' | 'desc') => {
        // TanStack Table's sortedRowModel handles the actual sorting.
        // The store just persists the sort configuration.
        set({ sortBy: column, sortOrder: order });
    },

    setSearchQuery: (query: string) => set({ searchQuery: query }),

    setActiveFilter: (filter: string) => set({ activeFilter: filter }),

    setIsScanModalOpen: (open: boolean) => set({ isScanModalOpen: open }),

    setActiveScanJob: (job: ScanJob | null) => set({ activeScanJob: job }),

    fetchTracks: async () => {
        set({ isLoadingTracks: true });
        try {
            const res = await fetch('/api/tracks');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.tracks)) {
                    set({ tracks: data.tracks, totalTracks: data.tracks.length });
                }
            }
        } catch {
            // Keep existing in-memory tracks if endpoint not present
        } finally {
            set({ isLoadingTracks: false });
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

        const activeTrack = activeTrackId === id ? { ...(activeTrackDetail.metadata || {}), ...fields } as Track : activeTrackDetail.metadata;

        set({
            tracks: updatedTracks,
            activeTrackDetail: {
                ...activeTrackDetail,
                metadata: activeTrack,
            },
        });
    },
}));
