'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useEclipseStore } from '@/store/eclipseStore';
import {
    formatEclipseTrackQuality,
    filterEclipseTracks,
    sortEclipseTracks,
    isTrackDolbyAtmos,
    type EclipseQualityFilter,
    type EclipseSortOption,
} from '@/domain/remote-audio/eclipse-quality';

function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function EclipseSearchView() {
    const {
        searchQuery,
        setSearchQuery,
        searchAddon,
        isSearching,
        searchError,
        searchResults,
        searchFilter,
        setSearchFilter,
        qualityFilter,
        setQualityFilter,
        sortBy,
        setSortBy,
        sortOrder,
        toggleSort,
        playTrack,
        downloadTrack,
        downloadingTrackIds,
        downloadedTrackPaths,
        trackQualityStatus,
        currentTrack,
        isPlaying,
        openAlbum,
        openArtist,
        openPlaylist,
        manifest,
        setIsHeadersModalOpen,
    } = useEclipseStore();

    const [input, setInput] = useState(searchQuery);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(input);
        searchAddon(input);
    };

    const tracks = searchResults.tracks || [];
    const albums = searchResults.albums || [];
    const artists = searchResults.artists || [];
    const playlists = searchResults.playlists || [];

    // Compute quality metrics and counts
    const dolbyCount = tracks.filter(isTrackDolbyAtmos).length;
    const hiresCount = tracks.filter((t) => {
        const q = formatEclipseTrackQuality(t);
        return q.isHiRes && !q.isDolbyAtmos;
    }).length;
    const losslessCount = tracks.filter((t) => {
        const q = formatEclipseTrackQuality(t);
        return q.isLossless && !q.isHiRes && !q.isDolbyAtmos;
    }).length;
    const lossyCount = tracks.filter((t) => {
        const q = formatEclipseTrackQuality(t);
        return !q.isLossless && !q.isDolbyAtmos;
    }).length;

    // Filter and sort tracks
    const filteredTracks = filterEclipseTracks(tracks, qualityFilter);
    const displayedTracks = sortEclipseTracks(filteredTracks, sortBy, sortOrder);

    const totalCount = tracks.length + albums.length + artists.length + playlists.length;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Search Input Bar */}
            <div className="p-3 border-b bg-card/10 flex flex-wrap items-center justify-between gap-2">
                <form onSubmit={handleSearch} className="flex-1 max-w-lg flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Icon icon="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Search songs, albums, artists, or ISRC in addon..."
                            className="bg-background text-foreground placeholder:text-muted-foreground/60 w-full rounded border px-3 py-1.5 pl-8 text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <Button type="submit" variant="primary" size="xs" disabled={isSearching} className="h-8 px-3 font-semibold">
                        <Icon icon={isSearching ? 'loading' : 'search'} className={`size-3 ${isSearching ? 'animate-spin' : ''}`} />
                        <span>Search</span>
                    </Button>
                </form>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 text-xs">
                    <button
                        onClick={() => setSearchFilter('all')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            searchFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        All ({totalCount})
                    </button>
                    <button
                        onClick={() => setSearchFilter('tracks')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            searchFilter === 'tracks' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Tracks ({tracks.length})
                    </button>
                    <button
                        onClick={() => setSearchFilter('albums')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            searchFilter === 'albums' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Albums ({albums.length})
                    </button>
                    <button
                        onClick={() => setSearchFilter('artists')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            searchFilter === 'artists' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Artists ({artists.length})
                    </button>
                    {playlists.length > 0 && (
                        <button
                            onClick={() => setSearchFilter('playlists')}
                            className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                                searchFilter === 'playlists' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Playlists ({playlists.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Results Content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
                {searchError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3.5 flex flex-wrap items-start justify-between gap-3 text-xs font-mono">
                        <div className="flex items-start gap-2.5">
                            <Icon icon="warning" className="size-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <span className="font-bold text-rose-200">Search Error Returned by Addon:</span>
                                <div className="text-foreground/90">{searchError}</div>
                                {(searchError.includes('401') || searchError.includes('403') || searchError.toLowerCase().includes('token') || searchError.toLowerCase().includes('auth')) && (
                                    <p className="text-[11px] text-amber-300 pt-0.5">
                                        This addon may require authorization headers. Click &quot;Configure Headers&quot; to provide your Bearer token or API key.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setIsHeadersModalOpen(true)}
                                className="h-6 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                            >
                                <Icon icon="settings" className="size-3" />
                                <span>Configure Headers</span>
                            </Button>
                            <Button
                                variant="primary"
                                size="xs"
                                onClick={() => searchAddon()}
                                className="h-6 text-[11px]"
                            >
                                Retry
                            </Button>
                        </div>
                    </div>
                )}

                {isSearching ? (
                    <div className="p-12 text-center text-muted-foreground font-mono text-xs flex flex-col items-center justify-center">
                        <Icon icon="loading" className="size-6 animate-spin text-primary mb-2" />
                        <span>Searching Eclipse Addon...</span>
                    </div>
                ) : totalCount === 0 ? (
                    <div className="p-12 text-center text-muted-foreground font-mono text-xs">
                        {manifest ? 'Enter a search query to browse tracks, albums, and artists from this addon.' : 'Connect to an Eclipse Addon to start searching.'}
                    </div>
                ) : (
                    <>
                        {/* 1. TRACKS */}
                        {(searchFilter === 'all' || searchFilter === 'tracks') && tracks.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2.5">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Icon icon="audioFile" className="size-3.5 text-primary" />
                                        <span>
                                            Tracks ({displayedTracks.length}
                                            {displayedTracks.length !== tracks.length ? ` of ${tracks.length}` : ''})
                                        </span>
                                    </h3>

                                    {/* Quality Filter Pills & Sort Controls */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Filter Pills */}
                                        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border text-[11px] font-mono">
                                            <button
                                                onClick={() => setQualityFilter('all')}
                                                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                                    qualityFilter === 'all'
                                                        ? 'bg-background text-foreground shadow-xs font-semibold'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                All ({tracks.length})
                                            </button>
                                            <button
                                                onClick={() => setQualityFilter('dolby')}
                                                className={`px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 ${
                                                    qualityFilter === 'dolby'
                                                        ? 'bg-purple-600 text-white shadow-xs font-semibold'
                                                        : 'text-purple-400 hover:text-purple-300'
                                                }`}
                                                title="Dolby Atmos spatial audio tracks"
                                            >
                                                <span className="size-1.5 rounded-full bg-purple-400" />
                                                Dolby ({dolbyCount})
                                            </button>
                                            <button
                                                onClick={() => setQualityFilter('hires')}
                                                className={`px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 ${
                                                    qualityFilter === 'hires'
                                                        ? 'bg-amber-500 text-black shadow-xs font-semibold'
                                                        : 'text-amber-400 hover:text-amber-300'
                                                }`}
                                                title="24-bit Hi-Res Lossless tracks"
                                            >
                                                <span className="size-1.5 rounded-full bg-amber-400" />
                                                Hi-Res ({hiresCount})
                                            </button>
                                            <button
                                                onClick={() => setQualityFilter('lossless')}
                                                className={`px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 ${
                                                    qualityFilter === 'lossless'
                                                        ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                                                        : 'text-cyan-400 hover:text-cyan-300'
                                                }`}
                                                title="16-bit / 44.1kHz CD Lossless tracks"
                                            >
                                                CD ({losslessCount})
                                            </button>
                                            {lossyCount > 0 && (
                                                <button
                                                    onClick={() => setQualityFilter('lossy')}
                                                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                                        qualityFilter === 'lossy'
                                                            ? 'bg-background text-foreground shadow-xs font-semibold'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                >
                                                    Lossy ({lossyCount})
                                                </button>
                                            )}
                                        </div>

                                        {/* Sort Control */}
                                        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border text-[11px] font-mono">
                                            <span className="text-muted-foreground px-1 flex items-center gap-1">
                                                <Icon icon="sort" className="size-3" />
                                                Sort:
                                            </span>
                                            <select
                                                value={sortBy}
                                                aria-label="Sort tracks by"
                                                onChange={(e) => setSortBy(e.target.value as EclipseSortOption)}
                                                className="bg-transparent text-foreground text-[11px] font-mono outline-hidden cursor-pointer pr-1"
                                            >
                                                <option value="default" className="bg-popover text-popover-foreground">Default</option>
                                                <option value="dolby" className="bg-popover text-popover-foreground">Dolby Atmos First</option>
                                                <option value="quality" className="bg-popover text-popover-foreground">Highest Quality</option>
                                                <option value="title" className="bg-popover text-popover-foreground">Title</option>
                                                <option value="artist" className="bg-popover text-popover-foreground">Artist</option>
                                                <option value="duration" className="bg-popover text-popover-foreground">Duration</option>
                                            </select>
                                            {sortBy !== 'default' && (
                                                <button
                                                    onClick={() => toggleSort()}
                                                    className="px-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                    title={`Order: ${sortOrder.toUpperCase()} (Click to toggle)`}
                                                >
                                                    <Icon icon={sortOrder === 'asc' ? 'up' : 'down'} className="size-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {displayedTracks.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-8 text-center bg-card/20 space-y-2">
                                        <div className="text-muted-foreground font-mono text-xs">
                                            No tracks match the &quot;{qualityFilter.toUpperCase()}&quot; filter.
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            onClick={() => setQualityFilter('all')}
                                            className="text-xs"
                                        >
                                            Show All {tracks.length} Tracks
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border overflow-hidden bg-card/30">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-muted/50 border-b text-muted-foreground font-mono text-[11px]">
                                                <tr>
                                                    <th className="p-2.5 w-12 text-center">#</th>
                                                    <th
                                                        className="p-2.5 cursor-pointer hover:text-foreground transition-colors"
                                                        onClick={() => {
                                                            if (sortBy === 'title') toggleSort();
                                                            else setSortBy('title');
                                                        }}
                                                        title="Click to sort by Title"
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <span>Track / Artist</span>
                                                            {sortBy === 'title' && (
                                                                <Icon icon={sortOrder === 'asc' ? 'up' : 'down'} className="size-3 text-primary" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th className="p-2.5 hidden md:table-cell">Album</th>
                                                    <th
                                                        className="p-2.5 hidden sm:table-cell cursor-pointer hover:text-foreground transition-colors"
                                                        onClick={() => {
                                                            if (sortBy === 'quality') toggleSort();
                                                            else setSortBy('quality');
                                                        }}
                                                        title="Click to sort by Quality"
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <span>Quality & Codec</span>
                                                            {(sortBy === 'quality' || sortBy === 'dolby') && (
                                                                <Icon icon={sortOrder === 'asc' ? 'up' : 'down'} className="size-3 text-primary" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th
                                                        className="p-2.5 w-20 text-center cursor-pointer hover:text-foreground transition-colors"
                                                        onClick={() => {
                                                            if (sortBy === 'duration') toggleSort();
                                                            else setSortBy('duration');
                                                        }}
                                                        title="Click to sort by Duration"
                                                    >
                                                        <div className="flex items-center justify-center gap-1">
                                                            <span>Duration</span>
                                                            {sortBy === 'duration' && (
                                                                <Icon icon={sortOrder === 'asc' ? 'up' : 'down'} className="size-3 text-primary" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th className="p-2.5 w-28 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40">
                                                {displayedTracks.map((track, idx) => {
                                                    const isCurrent = currentTrack?.id === track.id;
                                                    const isDownloading = downloadingTrackIds.has(track.id);
                                                    const downloadedPath = downloadedTrackPaths[track.id];
                                                    const qStatus = trackQualityStatus[track.id];
                                                    const isSkipped = qStatus?.status === 'skipped';
                                                    const isUpgrade = qStatus?.status === 'upgrade';
                                                    const q = formatEclipseTrackQuality(track);

                                                    return (
                                                        <tr key={track.id} className={`hover:bg-muted/40 transition-colors ${isCurrent ? 'bg-primary/5' : ''}`}>
                                                            <td className="p-2.5 text-center text-muted-foreground font-mono text-xs">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="p-2.5">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    {track.artworkURL ? (
                                                                        <img
                                                                            src={track.artworkURL}
                                                                            alt=""
                                                                            className="size-8 rounded object-cover border shrink-0 bg-muted"
                                                                        />
                                                                    ) : (
                                                                        <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                                                            <Icon icon="audio" className="size-4" />
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <div className="font-semibold text-foreground truncate max-w-xs">{track.title}</div>
                                                                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                                                                            {track.artist}
                                                                            {track.isrc && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/80">ISRC: {track.isrc}</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-2.5 hidden md:table-cell text-muted-foreground truncate max-w-xs">
                                                                {track.album || '-'}
                                                            </td>
                                                            <td className="p-2.5 hidden sm:table-cell">
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    {q.isDolbyAtmos && (
                                                                        <Badge
                                                                            className="bg-purple-950/70 border border-purple-500/60 text-purple-200 text-[10px] font-bold tracking-wide shadow-xs flex items-center gap-1"
                                                                            title="Dolby Atmos Spatial Audio"
                                                                        >
                                                                            <span className="size-1.5 rounded-full bg-purple-400 animate-pulse" />
                                                                            DOLBY ATMOS
                                                                        </Badge>
                                                                    )}
                                                                    {q.isHiRes && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[9px] font-bold"
                                                                            title="24-bit Hi-Res Lossless Audio"
                                                                        >
                                                                            HI-RES
                                                                        </Badge>
                                                                    )}
                                                                    {q.isLossless && !q.isHiRes && !q.isDolbyAtmos && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="bg-cyan-500/10 border-cyan-500/30 text-cyan-300 font-mono text-[9px]"
                                                                        >
                                                                            CD LOSSLESS
                                                                        </Badge>
                                                                    )}

                                                                    <span className="font-mono text-[11px] font-medium text-foreground/90">
                                                                        {q.displayQuality}
                                                                    </span>

                                                                    {isSkipped && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            size="xs"
                                                                            className="bg-amber-500/15 border-amber-500/30 text-amber-300 font-mono text-[9px] cursor-help"
                                                                            title={qStatus?.message}
                                                                        >
                                                                            In Library
                                                                        </Badge>
                                                                    )}
                                                                    {isUpgrade && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            size="xs"
                                                                            className="bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-mono text-[9px]"
                                                                        >
                                                                            Upgraded
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-2.5 text-center font-mono text-[11px] text-muted-foreground">
                                                                {formatDuration(track.duration)}
                                                            </td>
                                                            <td className="p-2.5 text-right font-mono">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <Button
                                                                        variant={isCurrent && isPlaying ? 'primary' : 'outline'}
                                                                        size="xs"
                                                                        onClick={() => playTrack(track)}
                                                                        className="h-7 px-2 text-xs gap-1"
                                                                        title={isCurrent && isPlaying ? 'Playing' : 'Play audio'}
                                                                    >
                                                                        <Icon icon={isCurrent && isPlaying ? 'pause' : 'play'} className="size-3" />
                                                                        <span>{isCurrent && isPlaying ? 'Playing' : 'Play'}</span>
                                                                    </Button>

                                                                    {isSkipped ? (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="xs"
                                                                            disabled={isDownloading}
                                                                            onClick={() => downloadTrack(track, true)}
                                                                            className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                                                                            title={`${qStatus.message}\nClick to force re-download`}
                                                                        >
                                                                            <Icon icon={isDownloading ? 'loading' : 'download'} className={`size-3 ${isDownloading ? 'animate-spin' : ''}`} />
                                                                            <span>{isDownloading ? '...' : 'Force'}</span>
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            variant={downloadedPath ? 'secondary' : 'outline'}
                                                                            size="xs"
                                                                            disabled={isDownloading}
                                                                            onClick={() => downloadTrack(track)}
                                                                            className={`h-7 px-2 text-xs gap-1 ${downloadedPath ? 'text-emerald-400 border-emerald-500/40' : ''}`}
                                                                            title={downloadedPath ? `Saved to: ${downloadedPath}` : 'Check library quality and download'}
                                                                        >
                                                                            <Icon icon={isDownloading ? 'loading' : downloadedPath ? 'check' : 'download'} className={`size-3 ${isDownloading ? 'animate-spin' : ''}`} />
                                                                            <span>{isDownloading ? '...' : downloadedPath ? 'Saved' : 'Get'}</span>
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. ALBUMS */}
                        {(searchFilter === 'all' || searchFilter === 'albums') && albums.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Icon icon="card" className="size-3.5 text-primary" />
                                    <span>Albums ({albums.length})</span>
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                    {albums.map((album) => (
                                        <div
                                            key={album.id}
                                            onClick={() => openAlbum(album.id)}
                                            className="bg-card/40 border rounded-lg p-2.5 hover:bg-muted/40 transition-all cursor-pointer group flex flex-col"
                                        >
                                            <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2 relative">
                                                {album.artworkURL ? (
                                                    <img src={album.artworkURL} alt="" className="size-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <div className="size-full flex items-center justify-center text-muted-foreground">
                                                        <Icon icon="card" className="size-8" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="font-semibold text-xs text-foreground truncate" title={album.title}>{album.title}</div>
                                            <div className="text-[11px] text-muted-foreground truncate">{album.artist || 'Unknown Artist'}</div>
                                            <div className="text-[10px] text-muted-foreground/80 mt-1 flex items-center justify-between font-mono">
                                                <span>{album.trackCount ? `${album.trackCount} tracks` : ''}</span>
                                                <span>{album.year || ''}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. ARTISTS */}
                        {(searchFilter === 'all' || searchFilter === 'artists') && artists.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Icon icon="editProfile" className="size-3.5 text-primary" />
                                    <span>Artists ({artists.length})</span>
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {artists.map((artist) => (
                                        <div
                                            key={artist.id}
                                            onClick={() => openArtist(artist.id)}
                                            className="bg-card/40 border rounded-lg p-3 hover:bg-muted/40 transition-all cursor-pointer group flex flex-col items-center text-center"
                                        >
                                            <div className="size-20 rounded-full overflow-hidden bg-muted mb-2 relative border border-border">
                                                {artist.artworkURL ? (
                                                    <img src={artist.artworkURL} alt="" className="size-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <div className="size-full flex items-center justify-center text-muted-foreground">
                                                        <Icon icon="editProfile" className="size-8" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="font-semibold text-xs text-foreground truncate w-full" title={artist.name}>{artist.name}</div>
                                            {artist.genres && artist.genres.length > 0 && (
                                                <div className="text-[10px] text-muted-foreground truncate w-full">{artist.genres.join(', ')}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. PLAYLISTS */}
                        {(searchFilter === 'all' || searchFilter === 'playlists') && playlists.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Icon icon="documentMusic" className="size-3.5 text-primary" />
                                    <span>Playlists ({playlists.length})</span>
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {playlists.map((pl) => (
                                        <div
                                            key={pl.id}
                                            onClick={() => openPlaylist(pl.id)}
                                            className="bg-card/40 border rounded-lg p-2.5 hover:bg-muted/40 transition-all cursor-pointer group flex flex-col"
                                        >
                                            <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2 relative">
                                                {pl.artworkURL ? (
                                                    <img src={pl.artworkURL} alt="" className="size-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <div className="size-full flex items-center justify-center text-muted-foreground">
                                                        <Icon icon="documentMusic" className="size-8" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="font-semibold text-xs text-foreground truncate" title={pl.title}>{pl.title}</div>
                                            <div className="text-[11px] text-muted-foreground truncate">{pl.creator || 'Curated'}</div>
                                            {pl.trackCount && (
                                                <div className="text-[10px] text-muted-foreground font-mono mt-1">{pl.trackCount} tracks</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
