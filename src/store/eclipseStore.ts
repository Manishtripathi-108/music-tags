import { create } from 'zustand';
import axios from 'axios';
import {
    type EclipseManifest,
    type EclipseTrack,
    type EclipseAlbum,
    type EclipseArtist,
    type EclipsePlaylist,
    type EclipseNotice,
    type EclipseStreamResponse,
} from '@/app/api/eclipse/route';

export interface EclipseState {
    addonUrl: string;
    downloadDirectory: string;
    isConnecting: boolean;
    connectionError: string | null;
    manifest: EclipseManifest | null;
    settingsValues: Record<string, string | number | boolean>;

    activeTab: 'search' | 'catalogs' | 'library';
    searchQuery: string;
    isSearching: boolean;
    searchFilter: 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';
    searchResults: {
        tracks: EclipseTrack[];
        albums: EclipseAlbum[];
        artists: EclipseArtist[];
        playlists: EclipsePlaylist[];
    };

    catalogsData: Record<string, { items: any[]; hasMore: boolean; skip: number; isLoading: boolean }>;
    activeModal: { type: 'album' | 'artist' | 'playlist'; data: any } | null;

    currentTrack: EclipseTrack | null;
    currentStream: EclipseStreamResponse | null;
    isPlaying: boolean;
    isLoadingStream: boolean;

    downloadingTrackIds: Set<string>;
    downloadedTrackPaths: Record<string, string>;
    notices: EclipseNotice[];

    // Actions
    setAddonUrl: (url: string) => void;
    setDownloadDirectory: (dir: string) => void;
    setActiveTab: (tab: 'search' | 'catalogs' | 'library') => void;
    setSearchQuery: (query: string) => void;
    setSearchFilter: (filter: 'all' | 'tracks' | 'albums' | 'artists' | 'playlists') => void;
    updateSetting: (key: string, value: string | number | boolean) => void;
    closeModal: () => void;
    dismissNotice: (id?: string) => void;

    connectAddon: (customUrl?: string) => Promise<boolean>;
    searchAddon: (customQuery?: string) => Promise<void>;
    loadCatalog: (catalogId: string, skip?: number) => Promise<void>;
    openAlbum: (albumId: string) => Promise<void>;
    openArtist: (artistId: string) => Promise<void>;
    openPlaylist: (playlistId: string) => Promise<void>;
    playTrack: (track: EclipseTrack) => Promise<void>;
    downloadTrack: (track: EclipseTrack) => Promise<void>;
}

export const useEclipseStore = create<EclipseState>((set, get) => ({
    addonUrl: typeof window !== 'undefined' ? localStorage.getItem('eclipse_addon_url') || '' : '',
    downloadDirectory: typeof window !== 'undefined' ? localStorage.getItem('remote_download_dir') || '' : '',
    isConnecting: false,
    connectionError: null,
    manifest: null,
    settingsValues: {},

    activeTab: 'search',
    searchQuery: '',
    isSearching: false,
    searchFilter: 'all',
    searchResults: { tracks: [], albums: [], artists: [], playlists: [] },

    catalogsData: {},
    activeModal: null,

    currentTrack: null,
    currentStream: null,
    isPlaying: false,
    isLoadingStream: false,

    downloadingTrackIds: new Set<string>(),
    downloadedTrackPaths: {},
    notices: [],

    setAddonUrl: (url) => {
        if (typeof window !== 'undefined') localStorage.setItem('eclipse_addon_url', url);
        set({ addonUrl: url, connectionError: null });
    },

    setDownloadDirectory: (dir) => {
        if (typeof window !== 'undefined') localStorage.setItem('remote_download_dir', dir);
        set({ downloadDirectory: dir });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchFilter: (filter) => set({ searchFilter: filter }),

    updateSetting: (key, value) => {
        set((s) => ({
            settingsValues: { ...s.settingsValues, [key]: value },
        }));
    },

    closeModal: () => set({ activeModal: null }),
    dismissNotice: (id) =>
        set((s) => ({
            notices: id ? s.notices.filter((n) => n.id !== id) : s.notices.slice(1),
        })),

    connectAddon: async (customUrl) => {
        const targetUrl = customUrl || get().addonUrl;
        if (!targetUrl) return false;

        set({ isConnecting: true, connectionError: null });
        try {
            const res = await axios.post<{ manifest: EclipseManifest; notice?: EclipseNotice }>('/api/eclipse', {
                addonUrl: targetUrl,
                action: 'manifest',
            });

            const manifest = res.data.manifest;

            // Initialize default settings from manifest
            const initialSettings: Record<string, string | number | boolean> = {};
            if (Array.isArray(manifest.settings)) {
                for (const setting of manifest.settings) {
                    if (setting.default !== undefined) {
                        initialSettings[setting.key] = setting.default;
                    }
                }
            }

            const notices = res.data.notice ? [res.data.notice] : [];

            set({
                manifest,
                settingsValues: initialSettings,
                isConnecting: false,
                connectionError: null,
                notices,
            });

            // Automatically load first catalog if available
            if (manifest.catalogs && manifest.catalogs.length > 0) {
                get().loadCatalog(manifest.catalogs[0].id, 0);
            }

            return true;
        } catch (err: unknown) {
            const msg = axios.isAxiosError(err) && err.response?.data?.error
                ? err.response.data.error
                : err instanceof Error
                ? err.message
                : 'Failed to connect to Eclipse addon';

            set({ isConnecting: false, connectionError: msg });
            return false;
        }
    },

    searchAddon: async (customQuery) => {
        const { addonUrl, searchQuery, settingsValues } = get();
        if (!addonUrl) return;

        const query = customQuery !== undefined ? customQuery : searchQuery;
        set({ isSearching: true });

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'search',
                query,
                settings: settingsValues,
            });

            const notices = res.data.notice ? [...get().notices, res.data.notice] : get().notices;

            set({
                searchResults: {
                    tracks: res.data.tracks || [],
                    albums: res.data.albums || [],
                    artists: res.data.artists || [],
                    playlists: res.data.playlists || [],
                },
                isSearching: false,
                notices,
            });
        } catch (err: unknown) {
            console.error('Eclipse search failed:', err);
            set({ isSearching: false });
        }
    },

    loadCatalog: async (catalogId, skip = 0) => {
        const { addonUrl, settingsValues, catalogsData } = get();
        if (!addonUrl) return;

        set((s) => ({
            catalogsData: {
                ...s.catalogsData,
                [catalogId]: {
                    items: skip === 0 ? [] : s.catalogsData[catalogId]?.items || [],
                    hasMore: true,
                    skip,
                    isLoading: true,
                },
            },
        }));

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'catalog',
                id: catalogId,
                skip,
                settings: settingsValues,
            });

            const newItems = res.data.items || [];
            const prevItems = skip === 0 ? [] : catalogsData[catalogId]?.items || [];

            set((s) => ({
                catalogsData: {
                    ...s.catalogsData,
                    [catalogId]: {
                        items: [...prevItems, ...newItems],
                        hasMore: newItems.length >= 100,
                        skip: skip + newItems.length,
                        isLoading: false,
                    },
                },
            }));
        } catch (err) {
            console.error('Catalog load failed:', err);
            set((s) => ({
                catalogsData: {
                    ...s.catalogsData,
                    [catalogId]: {
                        ...s.catalogsData[catalogId],
                        isLoading: false,
                    },
                },
            }));
        }
    },

    openAlbum: async (albumId) => {
        const { addonUrl, settingsValues } = get();
        if (!addonUrl || !albumId) return;

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'album',
                id: albumId,
                settings: settingsValues,
            });
            if (res.data.album) {
                set({ activeModal: { type: 'album', data: res.data.album } });
            }
        } catch (err) {
            console.error('Failed to open album:', err);
        }
    },

    openArtist: async (artistId) => {
        const { addonUrl, settingsValues } = get();
        if (!addonUrl || !artistId) return;

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'artist',
                id: artistId,
                settings: settingsValues,
            });
            if (res.data.artist) {
                set({ activeModal: { type: 'artist', data: res.data.artist } });
            }
        } catch (err) {
            console.error('Failed to open artist:', err);
        }
    },

    openPlaylist: async (playlistId) => {
        const { addonUrl, settingsValues } = get();
        if (!addonUrl || !playlistId) return;

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'playlist',
                id: playlistId,
                settings: settingsValues,
            });
            if (res.data.playlist) {
                set({ activeModal: { type: 'playlist', data: res.data.playlist } });
            }
        } catch (err) {
            console.error('Failed to open playlist:', err);
        }
    },

    playTrack: async (track) => {
        const { addonUrl, settingsValues } = get();
        if (!addonUrl) return;

        // If track already has direct streamURL, play directly without calling /stream
        if (track.streamURL) {
            set({
                currentTrack: track,
                currentStream: {
                    url: track.streamURL,
                    format: track.format,
                    quality: track.audioQuality,
                },
                isPlaying: true,
                isLoadingStream: false,
            });
            return;
        }

        set({ currentTrack: track, isLoadingStream: true, isPlaying: false });

        try {
            const res = await axios.post<{ stream: EclipseStreamResponse; notice?: EclipseNotice }>('/api/eclipse', {
                addonUrl,
                action: 'stream',
                id: track.id,
                settings: settingsValues,
            });

            const stream = res.data.stream;
            const notices = res.data.notice ? [...get().notices, res.data.notice] : get().notices;

            set({
                currentStream: stream,
                isPlaying: true,
                isLoadingStream: false,
                notices,
            });
        } catch (err: unknown) {
            console.error('Stream playback failed:', err);
            set({ isLoadingStream: false, isPlaying: false });
            alert('Failed to resolve audio stream from addon');
        }
    },

    downloadTrack: async (track) => {
        const { addonUrl, downloadDirectory, settingsValues, downloadingTrackIds } = get();
        if (!addonUrl) {
            alert('Please connect to an Eclipse addon first.');
            return;
        }
        if (!downloadDirectory) {
            alert('Please configure the destination Download Directory.');
            return;
        }

        const nextDownloading = new Set(downloadingTrackIds);
        nextDownloading.add(track.id);
        set({ downloadingTrackIds: nextDownloading });

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'download',
                id: track.id,
                streamUrl: track.streamURL,
                isrc: track.isrc,
                trackFilename: `${track.artist} - ${track.title}`,
                format: track.format,
                downloadDirectory,
                settings: settingsValues,
            });

            if (res.data.success) {
                set((s) => ({
                    downloadedTrackPaths: {
                        ...s.downloadedTrackPaths,
                        [track.id]: res.data.filePath,
                    },
                }));
            }
        } catch (err: unknown) {
            const msg = axios.isAxiosError(err) && err.response?.data?.error ? err.response.data.error : 'Download failed';
            alert(`Download failed: ${msg}`);
        } finally {
            const current = new Set(get().downloadingTrackIds);
            current.delete(track.id);
            set({ downloadingTrackIds: current });
        }
    },
}));
