'use client';

import React, { useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useEclipseStore } from '@/store/eclipseStore';

export function EclipseCatalogsView() {
    const {
        manifest,
        catalogsData,
        loadCatalog,
        playTrack,
        downloadTrack,
        downloadingTrackIds,
        downloadedTrackPaths,
        currentTrack,
        isPlaying,
        openAlbum,
        openArtist,
        openPlaylist,
    } = useEclipseStore();

    const catalogs = manifest?.catalogs || [];

    // Load initial catalogs if not yet loaded
    useEffect(() => {
        for (const cat of catalogs) {
            if (!catalogsData[cat.id]) {
                loadCatalog(cat.id, 0);
            }
        }
    }, [catalogs, catalogsData, loadCatalog]);

    if (catalogs.length === 0) {
        return (
            <div className="p-12 text-center text-muted-foreground font-mono text-xs">
                This Eclipse addon does not declare catalog shelves in its manifest. Use the Search tab to find music.
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-4 space-y-8">
            {catalogs.map((cat) => {
                const data = catalogsData[cat.id];
                const items = data?.items || [];
                const isLoading = Boolean(data?.isLoading);
                const hasMore = Boolean(data?.hasMore);

                return (
                    <div key={cat.id} className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-1.5">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-foreground">{cat.name}</h3>
                                <Badge variant="outline" size="xs" className="text-[10px] uppercase font-mono text-muted-foreground">
                                    {cat.type}
                                </Badge>
                            </div>

                            {hasMore && (
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    disabled={isLoading}
                                    onClick={() => loadCatalog(cat.id, data?.skip || 0)}
                                    className="h-6 text-xs text-primary gap-1"
                                >
                                    <Icon icon={isLoading ? 'loading' : 'down'} className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
                                    <span>Load More</span>
                                </Button>
                            )}
                        </div>

                        {isLoading && items.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground font-mono text-xs flex items-center justify-center gap-2">
                                <Icon icon="loading" className="size-4 animate-spin text-primary" />
                                <span>Loading shelf items...</span>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-4 text-xs text-muted-foreground font-mono">No items in this shelf.</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {items.map((item, idx) => {
                                    const isTrack = cat.type === 'track';
                                    const isAlbum = cat.type === 'album';
                                    const isArtist = cat.type === 'artist';
                                    const isPlaylist = cat.type === 'playlist';

                                    const isCurrent = currentTrack?.id === item.id;
                                    const isDownloading = downloadingTrackIds.has(item.id);
                                    const downloadedPath = downloadedTrackPaths[item.id];

                                    return (
                                        <div
                                            key={`${item.id}-${idx}`}
                                            className="bg-card/40 border rounded-lg p-2.5 hover:bg-muted/40 transition-all flex flex-col group relative"
                                        >
                                            <div
                                                onClick={() => {
                                                    if (isAlbum) openAlbum(item.id);
                                                    else if (isArtist) openArtist(item.id);
                                                    else if (isPlaylist) openPlaylist(item.id);
                                                    else if (isTrack) playTrack(item);
                                                }}
                                                className="aspect-square rounded-md overflow-hidden bg-muted mb-2 relative cursor-pointer"
                                            >
                                                {item.artworkURL ? (
                                                    <img
                                                        src={item.artworkURL}
                                                        alt=""
                                                        className="size-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                ) : (
                                                    <div className="size-full flex items-center justify-center text-muted-foreground">
                                                        <Icon icon={isTrack ? 'audio' : isArtist ? 'editProfile' : 'card'} className="size-8" />
                                                    </div>
                                                )}

                                                {/* Play overlay for tracks */}
                                                {isTrack && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playTrack(item);
                                                        }}
                                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                    >
                                                        <div className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                                                            <Icon icon={isCurrent && isPlaying ? 'pause' : 'play'} className="size-4" />
                                                        </div>
                                                    </button>
                                                )}
                                            </div>

                                            <div className="font-semibold text-xs text-foreground truncate" title={item.title || item.name}>
                                                {item.title || item.name}
                                            </div>

                                            {item.artist && (
                                                <div className="text-[11px] text-muted-foreground truncate">{item.artist}</div>
                                            )}

                                            {isTrack && (
                                                <div className="mt-2 pt-1 border-t flex items-center justify-between text-[10px] font-mono">
                                                    <div className="flex items-center gap-1">
                                                        {item.hiRes && (
                                                            <Badge variant="secondary" size="xs" className="text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/20">
                                                                Hi-Res
                                                            </Badge>
                                                        )}
                                                        {item.isrc && (
                                                            <span className="text-muted-foreground/70 truncate max-w-[80px]" title={item.isrc}>
                                                                {item.isrc}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => downloadTrack(item)}
                                                        disabled={isDownloading}
                                                        className={`p-1 rounded hover:bg-muted transition-colors ${downloadedPath ? 'text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
                                                        title={downloadedPath ? `Saved to: ${downloadedPath}` : 'Download to local directory'}
                                                    >
                                                        <Icon icon={isDownloading ? 'loading' : downloadedPath ? 'check' : 'download'} className={`size-3.5 ${isDownloading ? 'animate-spin' : ''}`} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
