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

export interface EclipseHeaderEntry {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
}

export interface EclipseErrorState {
    action: string;
    message: string;
    status?: number;
    notice?: EclipseNotice | null;
}

export interface EclipseState {
    addonUrl: string;
    downloadDirectory: string;
    isConnecting: boolean;
    connectionError: string | null;
    searchError: string | null;
    lastError: EclipseErrorState | null;
    manifest: EclipseManifest | null;
    settingsValues: Record<string, string | number | boolean>;

    // Eclipse Auth & Token Management for Addon Access
    eclipseAuthToken: string;
    addonId: string;
    addonAccessToken: string | null;
    addonTokenExpiresAt: number | null;
    isFetchingToken: boolean;
    tokenError: string | null;

    // Custom HTTP Headers for Addon requests
    headerEntries: EclipseHeaderEntry[];
    isHeadersModalOpen: boolean;

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

    catalogsData: Record<string, { items: any[]; hasMore: boolean; skip: number; isLoading: boolean; error?: string | null }>;
    activeModal: { type: 'album' | 'artist' | 'playlist'; data: any } | null;

    currentTrack: EclipseTrack | null;
    currentStream: EclipseStreamResponse | null;
    isPlaying: boolean;
    isLoadingStream: boolean;

    downloadingTrackIds: Set<string>;
    downloadedTrackPaths: Record<string, string>;
    trackQualityStatus: Record<
        string,
        {
            status: 'skipped' | 'upgrade' | 'downloaded';
            message: string;
            localQuality?: string;
            remoteQuality?: string;
        }
    >;
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
    clearErrors: () => void;
    setIsHeadersModalOpen: (open: boolean) => void;

    // Eclipse Auth & Token actions
    setEclipseAuthToken: (token: string) => void;
    setAddonId: (id: string) => void;
    fetchAddonAccessToken: () => Promise<string | null>;
    ensureValidAddonToken: () => Promise<string | null>;

    // Header actions
    getHeadersRecord: () => Record<string, string>;
    addHeaderEntry: (key?: string, value?: string) => void;
    updateHeaderEntry: (id: string, partial: Partial<EclipseHeaderEntry>) => void;
    removeHeaderEntry: (id: string) => void;
    clearHeaderEntries: () => void;
    setOrUpdateHeader: (key: string, value: string) => void;
    setAuthBearerToken: (token: string) => void;

    connectAddon: (customUrl?: string) => Promise<boolean>;
    searchAddon: (customQuery?: string) => Promise<void>;
    loadCatalog: (catalogId: string, skip?: number) => Promise<void>;
    openAlbum: (albumId: string) => Promise<void>;
    openArtist: (artistId: string) => Promise<void>;
    openPlaylist: (playlistId: string) => Promise<void>;
    playTrack: (track: EclipseTrack) => Promise<void>;
    downloadTrack: (track: EclipseTrack, forceRedownload?: boolean) => Promise<void>;
}

const loadStoredHeaders = (): EclipseHeaderEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem('eclipse_custom_headers');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {}
    return [];
};

const saveStoredHeaders = (headers: EclipseHeaderEntry[]) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('eclipse_custom_headers', JSON.stringify(headers));
    }
};

const extractErrorInfo = (err: unknown, defaultMsg: string): { message: string; notice: EclipseNotice | null; status?: number } => {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        const message = data?.error || (err.response?.status ? `Addon Error (${err.response.status} ${err.response.statusText})` : err.message) || defaultMsg;
        const notice = data?.notice || null;
        return { message, notice, status: err.response?.status };
    }
    return {
        message: err instanceof Error ? err.message : defaultMsg,
        notice: null,
        status: undefined,
    };
};

export const useEclipseStore = create<EclipseState>((set, get) => ({
    addonUrl: typeof window !== 'undefined' ? localStorage.getItem('eclipse_addon_url') || '' : '',
    downloadDirectory: typeof window !== 'undefined' ? localStorage.getItem('remote_download_dir') || '' : '',
    isConnecting: false,
    connectionError: null,
    searchError: null,
    lastError: null,
    manifest: null,
    settingsValues: {},

    // Eclipse Auth & Addon Access Token state
    eclipseAuthToken: typeof window !== 'undefined' ? localStorage.getItem('eclipse_auth_token') || '' : '',
    addonId: typeof window !== 'undefined' ? localStorage.getItem('eclipse_addon_id') || '' : '',
    addonAccessToken: typeof window !== 'undefined' ? localStorage.getItem('eclipse_access_token') || null : null,
    addonTokenExpiresAt: typeof window !== 'undefined' ? Number(localStorage.getItem('eclipse_access_expires_at')) || null : null,
    isFetchingToken: false,
    tokenError: null,

    headerEntries: loadStoredHeaders(),
    isHeadersModalOpen: false,

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
    trackQualityStatus: {},
    notices: [],

    setAddonUrl: (url) => {
        const clean = url.trim().replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
        if (typeof window !== 'undefined') localStorage.setItem('eclipse_addon_url', clean);
        set({ addonUrl: clean, connectionError: null, lastError: null });
    },

    setDownloadDirectory: (dir) => {
        if (typeof window !== 'undefined') localStorage.setItem('remote_download_dir', dir);
        set({ downloadDirectory: dir });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchFilter: (filter) => set({ searchFilter: filter }),
    setIsHeadersModalOpen: (open) => set({ isHeadersModalOpen: open }),

    clearErrors: () => set({ connectionError: null, searchError: null, lastError: null, tokenError: null }),

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

    // Eclipse Auth Token actions
    setEclipseAuthToken: (token) => {
        const clean = token.trim();
        if (typeof window !== 'undefined') localStorage.setItem('eclipse_auth_token', clean);
        set({ eclipseAuthToken: clean, tokenError: null });
    },

    setAddonId: (id) => {
        const clean = id.trim();
        if (typeof window !== 'undefined') localStorage.setItem('eclipse_addon_id', clean);
        set({ addonId: clean, tokenError: null });
    },

    fetchAddonAccessToken: async () => {
        const { eclipseAuthToken, addonId, manifest } = get();
        const targetAddonId = addonId || manifest?.id;

        if (!targetAddonId) {
            set({ tokenError: 'Addon identifier is required to acquire an access token (e.g. com.yourname.tidal.hifi)' });
            return null;
        }
        if (!eclipseAuthToken) {
            set({ tokenError: 'Eclipse user Auth Token is required to acquire addon access token' });
            return null;
        }

        set({ isFetchingToken: true, tokenError: null });

        try {
            const res = await axios.post('/api/eclipse', {
                action: 'get-addon-token',
                addonId: targetAddonId,
                eclipseAuthToken,
            });

            const { token, expiresIn, expiresAt } = res.data;
            if (!token) {
                throw new Error('No access token returned by api.eclipsemusic.app');
            }

            const computedExpiresAt = expiresAt || (expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : null);

            if (typeof window !== 'undefined') {
                localStorage.setItem('eclipse_access_token', token);
                if (computedExpiresAt) {
                    localStorage.setItem('eclipse_access_expires_at', String(computedExpiresAt));
                }
            }

            set({
                addonAccessToken: token,
                addonTokenExpiresAt: computedExpiresAt,
                isFetchingToken: false,
                tokenError: null,
            });

            // Automatically set/update the x-eclipse-access header
            get().setOrUpdateHeader('x-eclipse-access', token);

            return token;
        } catch (err: unknown) {
            const errInfo = extractErrorInfo(err, 'Failed to acquire Eclipse addon access token');
            set({
                isFetchingToken: false,
                tokenError: errInfo.message,
            });
            return null;
        }
    },

    ensureValidAddonToken: async () => {
        const { eclipseAuthToken, addonId, manifest, addonAccessToken, addonTokenExpiresAt } = get();
        const targetAddonId = addonId || manifest?.id;

        if (!eclipseAuthToken || !targetAddonId) {
            return addonAccessToken;
        }

        const nowSec = Math.floor(Date.now() / 1000);
        // If token exists and has more than 20 seconds left, it's valid
        if (addonAccessToken && addonTokenExpiresAt && addonTokenExpiresAt - nowSec > 20) {
            get().setOrUpdateHeader('x-eclipse-access', addonAccessToken);
            return addonAccessToken;
        }

        // Token is missing, expired, or expiring soon (< 20s) -> refresh automatically
        return await get().fetchAddonAccessToken();
    },

    getHeadersRecord: () => {
        const { headerEntries, addonAccessToken } = get();
        const headers: Record<string, string> = {};
        for (const entry of headerEntries) {
            if (entry.enabled && entry.key.trim()) {
                headers[entry.key.trim()] = entry.value;
            }
        }
        // Ensure x-eclipse-access is injected if we have an active access token
        if (addonAccessToken && !headers['x-eclipse-access']) {
            headers['x-eclipse-access'] = addonAccessToken;
        }
        return headers;
    },

    setOrUpdateHeader: (key, value) => {
        const { headerEntries } = get();
        const cleanKey = key.trim();
        const existing = headerEntries.find((e) => e.key.toLowerCase() === cleanKey.toLowerCase());
        let next: EclipseHeaderEntry[];
        if (existing) {
            next = headerEntries.map((e) =>
                e.id === existing.id ? { ...e, key: cleanKey, value, enabled: true } : e
            );
        } else {
            next = [
                ...headerEntries,
                { id: String(Date.now() + Math.random()), key: cleanKey, value, enabled: true },
            ];
        }
        saveStoredHeaders(next);
        set({ headerEntries: next });
    },

    addHeaderEntry: (key = '', value = '') => {
        const next: EclipseHeaderEntry[] = [
            ...get().headerEntries,
            { id: String(Date.now() + Math.random()), key, value, enabled: true },
        ];
        saveStoredHeaders(next);
        set({ headerEntries: next });
    },

    updateHeaderEntry: (id, partial) => {
        const next = get().headerEntries.map((e) => (e.id === id ? { ...e, ...partial } : e));
        saveStoredHeaders(next);
        set({ headerEntries: next });
    },

    removeHeaderEntry: (id) => {
        const next = get().headerEntries.filter((e) => e.id !== id);
        saveStoredHeaders(next);
        set({ headerEntries: next });
    },

    clearHeaderEntries: () => {
        saveStoredHeaders([]);
        set({ headerEntries: [] });
    },

    setAuthBearerToken: (token) => {
        const cleanToken = token.trim().startsWith('Bearer ') ? token.trim() : `Bearer ${token.trim()}`;
        get().setOrUpdateHeader('Authorization', cleanToken);
    },

    connectAddon: async (customUrl) => {
        const rawUrl = customUrl || get().addonUrl;
        const targetUrl = rawUrl.trim().replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
        if (!targetUrl) return false;

        // Ensure fresh token if eclipse auth is configured
        await get().ensureValidAddonToken();

        set({ isConnecting: true, connectionError: null, lastError: null });

        try {
            const res = await axios.post<{ manifest: EclipseManifest; notice?: EclipseNotice }>('/api/eclipse', {
                addonUrl: targetUrl,
                action: 'manifest',
                headers: get().getHeadersRecord(),
            });

            const manifest = res.data.manifest;

            // Auto-detect and save addonId if not set
            if (manifest.id && !get().addonId) {
                get().setAddonId(manifest.id);
            }

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
                lastError: null,
                notices,
            });

            // Automatically load first catalog if available
            if (manifest.catalogs && manifest.catalogs.length > 0) {
                get().loadCatalog(manifest.catalogs[0].id, 0);
            }

            return true;
        } catch (err: unknown) {
            // Check for 401 / 403 (token expired): if auth token exists, attempt refresh once
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403) && get().eclipseAuthToken) {
                const refreshed = await get().fetchAddonAccessToken();
                if (refreshed) {
                    try {
                        const retryRes = await axios.post<{ manifest: EclipseManifest; notice?: EclipseNotice }>('/api/eclipse', {
                            addonUrl: targetUrl,
                            action: 'manifest',
                            headers: get().getHeadersRecord(),
                        });
                        const manifest = retryRes.data.manifest;
                        if (manifest.id && !get().addonId) get().setAddonId(manifest.id);
                        set({
                            manifest,
                            isConnecting: false,
                            connectionError: null,
                            lastError: null,
                        });
                        return true;
                    } catch {}
                }
            }

            const errInfo = extractErrorInfo(err, 'Failed to connect to Eclipse addon');
            const nextNotices = errInfo.notice ? [errInfo.notice, ...get().notices] : get().notices;

            set({
                isConnecting: false,
                connectionError: errInfo.message,
                lastError: { action: 'manifest', ...errInfo },
                notices: nextNotices,
            });
            return false;
        }
    },

    searchAddon: async (customQuery) => {
        const { addonUrl, searchQuery, settingsValues } = get();
        if (!addonUrl) return;

        await get().ensureValidAddonToken();

        const query = customQuery !== undefined ? customQuery : searchQuery;
        set({ isSearching: true, searchError: null, lastError: null });

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'search',
                query,
                settings: settingsValues,
                headers: get().getHeadersRecord(),
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
                searchError: null,
                notices,
            });
        } catch (err: unknown) {
            // Auto refresh token and retry on 401 / 403
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403) && get().eclipseAuthToken) {
                const refreshed = await get().fetchAddonAccessToken();
                if (refreshed) {
                    try {
                        const retryRes = await axios.post('/api/eclipse', {
                            addonUrl,
                            action: 'search',
                            query,
                            settings: settingsValues,
                            headers: get().getHeadersRecord(),
                        });
                        set({
                            searchResults: {
                                tracks: retryRes.data.tracks || [],
                                albums: retryRes.data.albums || [],
                                artists: retryRes.data.artists || [],
                                playlists: retryRes.data.playlists || [],
                            },
                            isSearching: false,
                            searchError: null,
                        });
                        return;
                    } catch {}
                }
            }

            const errInfo = extractErrorInfo(err, 'Search request failed');
            const nextNotices = errInfo.notice ? [...get().notices, errInfo.notice] : get().notices;

            set({
                isSearching: false,
                searchError: errInfo.message,
                lastError: { action: 'search', ...errInfo },
                notices: nextNotices,
            });
        }
    },

    loadCatalog: async (catalogId, skip = 0) => {
        const { addonUrl, settingsValues, catalogsData } = get();
        if (!addonUrl) return;

        await get().ensureValidAddonToken();

        set((s) => ({
            catalogsData: {
                ...s.catalogsData,
                [catalogId]: {
                    items: skip === 0 ? [] : s.catalogsData[catalogId]?.items || [],
                    hasMore: true,
                    skip,
                    isLoading: true,
                    error: null,
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
                headers: get().getHeadersRecord(),
            });

            const newItems = res.data.items || [];
            const prevItems = skip === 0 ? [] : catalogsData[catalogId]?.items || [];
            const notices = res.data.notice ? [...get().notices, res.data.notice] : get().notices;

            set((s) => ({
                catalogsData: {
                    ...s.catalogsData,
                    [catalogId]: {
                        items: [...prevItems, ...newItems],
                        hasMore: newItems.length >= 100,
                        skip: skip + newItems.length,
                        isLoading: false,
                        error: null,
                    },
                },
                notices,
            }));
        } catch (err) {
            const errInfo = extractErrorInfo(err, `Failed to load catalog ${catalogId}`);
            const nextNotices = errInfo.notice ? [...get().notices, errInfo.notice] : get().notices;

            set((s) => ({
                catalogsData: {
                    ...s.catalogsData,
                    [catalogId]: {
                        ...s.catalogsData[catalogId],
                        isLoading: false,
                        error: errInfo.message,
                    },
                },
                lastError: { action: `catalog/${catalogId}`, ...errInfo },
                notices: nextNotices,
            }));
        }
    },

    openAlbum: async (albumId) => {
        const { addonUrl, settingsValues } = get();
        if (!addonUrl || !albumId) return;

        await get().ensureValidAddonToken();

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'album',
                id: albumId,
                settings: settingsValues,
                headers: get().getHeadersRecord(),
            });
            if (res.data.album) {
                set({ activeModal: { type: 'album', data: res.data.album } });
            }
            if (res.data.notice) {
                set((s) => ({ notices: [...s.notices, res.data.notice] }));
            }
        } catch (err) {
            const errInfo = extractErrorInfo(err, 'Failed to open album');
            set({ lastError: { action: `album/${albumId}`, ...errInfo } });
        }
    },

    openArtist: async (artistId) => {
        const { addonUrl, settingsValues } = get();
        if (!addonUrl || !artistId) return;

        await get().ensureValidAddonToken();

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'artist',
                id: artistId,
                settings: settingsValues,
                headers: get().getHeadersRecord(),
            });
            if (res.data.artist) {
                set({ activeModal: { type: 'artist', data: res.data.artist } });
            }
            if (res.data.notice) {
                set((s) => ({ notices: [...s.notices, res.data.notice] }));
            }
        } catch (err) {
            const errInfo = extractErrorInfo(err, 'Failed to open artist');
            set({ lastError: { action: `artist/${artistId}`, ...errInfo } });
        }
    },

    openPlaylist: async (playlistId) => {
        const { addonUrl, settingsValues } = get();
        if (!addonUrl || !playlistId) return;

        await get().ensureValidAddonToken();

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'playlist',
                id: playlistId,
                settings: settingsValues,
                headers: get().getHeadersRecord(),
            });
            if (res.data.playlist) {
                set({ activeModal: { type: 'playlist', data: res.data.playlist } });
            }
            if (res.data.notice) {
                set((s) => ({ notices: [...s.notices, res.data.notice] }));
            }
        } catch (err) {
            const errInfo = extractErrorInfo(err, 'Failed to open playlist');
            set({ lastError: { action: `playlist/${playlistId}`, ...errInfo } });
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

        await get().ensureValidAddonToken();
        set({ currentTrack: track, isLoadingStream: true, isPlaying: false });

        try {
            const res = await axios.post<{ stream: EclipseStreamResponse; notice?: EclipseNotice }>('/api/eclipse', {
                addonUrl,
                action: 'stream',
                id: track.id,
                settings: settingsValues,
                headers: get().getHeadersRecord(),
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
            // Check 401 / 403 retry
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403) && get().eclipseAuthToken) {
                const refreshed = await get().fetchAddonAccessToken();
                if (refreshed) {
                    try {
                        const retryRes = await axios.post<{ stream: EclipseStreamResponse; notice?: EclipseNotice }>('/api/eclipse', {
                            addonUrl,
                            action: 'stream',
                            id: track.id,
                            settings: settingsValues,
                            headers: get().getHeadersRecord(),
                        });
                        set({
                            currentStream: retryRes.data.stream,
                            isPlaying: true,
                            isLoadingStream: false,
                        });
                        return;
                    } catch {}
                }
            }

            const errInfo = extractErrorInfo(err, 'Failed to resolve audio stream from addon');
            const nextNotices = errInfo.notice ? [...get().notices, errInfo.notice] : get().notices;

            set({
                isLoadingStream: false,
                isPlaying: false,
                lastError: { action: `stream/${track.id}`, ...errInfo },
                notices: nextNotices,
            });
        }
    },

    downloadTrack: async (track, forceRedownload = false) => {
        const { addonUrl, downloadDirectory, settingsValues, downloadingTrackIds } = get();
        if (!addonUrl) {
            set({ lastError: { action: 'download', message: 'Please connect to an Eclipse addon first.' } });
            return;
        }
        if (!downloadDirectory) {
            set({ lastError: { action: 'download', message: 'Please configure the destination Download Directory.' } });
            return;
        }

        await get().ensureValidAddonToken();

        const nextDownloading = new Set(downloadingTrackIds);
        nextDownloading.add(track.id);
        set({ downloadingTrackIds: nextDownloading, lastError: null });

        try {
            const res = await axios.post('/api/eclipse', {
                addonUrl,
                action: 'download',
                id: track.id,
                // Do not pass stale streamUrl because download links expire; always resolve fresh just before downloading
                isrc: track.isrc,
                title: track.title,
                artist: track.artist,
                trackFilename: `${track.artist} - ${track.title}`,
                format: track.format,
                downloadDirectory,
                settings: settingsValues,
                headers: get().getHeadersRecord(),
                forceRedownload: Boolean(forceRedownload),
            });

            // Handle skipped download because library already has same or higher quality
            if (res.data.skipped) {
                const notice: EclipseNotice = {
                    level: 'warning',
                    title: 'Download Skipped (Quality Match)',
                    message: res.data.message || 'Already have same or higher quality in your library',
                };
                set((s) => ({
                    notices: [notice, ...s.notices],
                    trackQualityStatus: {
                        ...s.trackQualityStatus,
                        [track.id]: {
                            status: 'skipped',
                            message: res.data.message,
                            localQuality: res.data.localTrack?.qualityLabel,
                            remoteQuality: res.data.remoteQuality?.qualityLabel,
                        },
                    },
                }));
                return;
            }

            if (res.data.success) {
                const isUpgrade = Boolean(res.data.isUpgrade);
                const notice: EclipseNotice | null = isUpgrade
                    ? {
                          level: 'info',
                          title: 'Quality Upgrade Downloaded',
                          message: res.data.message || `Upgraded ${track.title} to ${res.data.quality}`,
                      }
                    : null;

                set((s) => ({
                    downloadedTrackPaths: {
                        ...s.downloadedTrackPaths,
                        [track.id]: res.data.filePath,
                    },
                    notices: notice ? [notice, ...s.notices] : s.notices,
                    trackQualityStatus: {
                        ...s.trackQualityStatus,
                        [track.id]: {
                            status: isUpgrade ? 'upgrade' : 'downloaded',
                            message: res.data.message,
                            remoteQuality: res.data.quality,
                        },
                    },
                }));
            }
        } catch (err: unknown) {
            // Check 401 / 403 retry
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403) && get().eclipseAuthToken) {
                const refreshed = await get().fetchAddonAccessToken();
                if (refreshed) {
                    try {
                        const retryRes = await axios.post('/api/eclipse', {
                            addonUrl,
                            action: 'download',
                            id: track.id,
                            isrc: track.isrc,
                            title: track.title,
                            artist: track.artist,
                            trackFilename: `${track.artist} - ${track.title}`,
                            format: track.format,
                            downloadDirectory,
                            settings: settingsValues,
                            headers: get().getHeadersRecord(),
                            forceRedownload: Boolean(forceRedownload),
                        });
                        if (retryRes.data.skipped) {
                            const notice: EclipseNotice = {
                                level: 'warning',
                                title: 'Download Skipped (Quality Match)',
                                message: retryRes.data.message,
                            };
                            set((s) => ({
                                notices: [notice, ...s.notices],
                                trackQualityStatus: {
                                    ...s.trackQualityStatus,
                                    [track.id]: {
                                        status: 'skipped',
                                        message: retryRes.data.message,
                                        localQuality: retryRes.data.localTrack?.qualityLabel,
                                        remoteQuality: retryRes.data.remoteQuality?.qualityLabel,
                                    },
                                },
                            }));
                            return;
                        }
                        if (retryRes.data.success) {
                            set((s) => ({
                                downloadedTrackPaths: {
                                    ...s.downloadedTrackPaths,
                                    [track.id]: retryRes.data.filePath,
                                },
                                trackQualityStatus: {
                                    ...s.trackQualityStatus,
                                    [track.id]: {
                                        status: retryRes.data.isUpgrade ? 'upgrade' : 'downloaded',
                                        message: retryRes.data.message,
                                        remoteQuality: retryRes.data.quality,
                                    },
                                },
                            }));
                            return;
                        }
                    } catch {}
                }
            }

            const errInfo = extractErrorInfo(err, 'Track download failed');
            const nextNotices = errInfo.notice ? [...get().notices, errInfo.notice] : get().notices;

            set({
                lastError: { action: `download/${track.id}`, ...errInfo },
                notices: nextNotices,
            });
        } finally {
            const current = new Set(get().downloadingTrackIds);
            current.delete(track.id);
            set({ downloadingTrackIds: current });
        }
    },
}));
