'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useEclipseStore } from '@/store/eclipseStore';

function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function EclipseDetailModals() {
    const { activeModal, closeModal, playTrack, downloadTrack, downloadingTrackIds, downloadedTrackPaths, currentTrack, isPlaying } = useEclipseStore();

    if (!activeModal) return null;

    const { type, data } = activeModal;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none">
            <div className="bg-card text-card-foreground border rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex items-start justify-between gap-3 bg-muted/20">
                    <div className="flex items-center gap-3.5 min-w-0">
                        {data.artworkURL ? (
                            <img src={data.artworkURL} alt="" className="size-16 rounded-lg object-cover border shrink-0 bg-muted" />
                        ) : (
                            <div className="size-16 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                <Icon icon={type === 'artist' ? 'editProfile' : type === 'album' ? 'card' : 'documentMusic'} className="size-8" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground font-bold">
                                {type}
                            </div>
                            <h2 className="text-base font-bold text-foreground truncate">{data.title || data.name}</h2>
                            <p className="text-xs text-muted-foreground truncate">
                                {data.artist || (data.genres && data.genres.join(', ')) || data.creator || ''}
                                {data.year ? ` • ${data.year}` : ''}
                                {data.trackCount ? ` • ${data.trackCount} tracks` : ''}
                            </p>
                        </div>
                    </div>

                    <Button variant="ghost" size="xs" onClick={closeModal} className="size-7 p-0 text-muted-foreground hover:text-foreground">
                        <Icon icon="close" className="size-4" />
                    </Button>
                </div>

                {/* Description or Bio */}
                {(data.description || data.bio) && (
                    <div className="px-4 py-2 bg-muted/10 border-b text-xs text-muted-foreground leading-relaxed">
                        {data.description || data.bio}
                    </div>
                )}

                {/* Body Content */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* Track List */}
                    {Array.isArray(data.tracks || data.topTracks) && (
                        <div className="space-y-1.5">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                {type === 'artist' ? 'Top Tracks' : 'Tracklist'}
                            </div>

                            <div className="rounded-lg border overflow-hidden bg-background">
                                <table className="w-full text-left text-xs">
                                    <tbody className="divide-y divide-border/40">
                                        {(data.tracks || data.topTracks).map((t: any, idx: number) => {
                                            const isCurrent = currentTrack?.id === t.id;
                                            const isDownloading = downloadingTrackIds.has(t.id);
                                            const downloadedPath = downloadedTrackPaths[t.id];

                                            return (
                                                <tr key={t.id || idx} className={`hover:bg-muted/30 transition-colors ${isCurrent ? 'bg-primary/5' : ''}`}>
                                                    <td className="p-2 text-center text-muted-foreground font-mono w-8 text-xs">{idx + 1}</td>
                                                    <td className="p-2">
                                                        <div className="font-semibold text-foreground truncate">{t.title}</div>
                                                        <div className="text-[11px] text-muted-foreground truncate">{t.artist || data.artist || data.name}</div>
                                                    </td>
                                                    <td className="p-2 text-center font-mono text-[11px] text-muted-foreground w-16">
                                                        {formatDuration(t.duration)}
                                                    </td>
                                                    <td className="p-2 text-right w-24">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant={isCurrent && isPlaying ? 'primary' : 'ghost'}
                                                                size="xs"
                                                                onClick={() => playTrack(t)}
                                                                className="size-7 p-0"
                                                            >
                                                                <Icon icon={isCurrent && isPlaying ? 'pause' : 'play'} className="size-3" />
                                                            </Button>

                                                            <Button
                                                                variant="ghost"
                                                                size="xs"
                                                                disabled={isDownloading}
                                                                onClick={() => downloadTrack(t)}
                                                                className={`size-7 p-0 ${downloadedPath ? 'text-emerald-400' : 'text-muted-foreground'}`}
                                                            >
                                                                <Icon icon={isDownloading ? 'loading' : downloadedPath ? 'check' : 'download'} className={`size-3 ${isDownloading ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Artist Discography Albums */}
                    {type === 'artist' && Array.isArray(data.albums) && data.albums.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Discography / Albums</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                {data.albums.map((alb: any) => (
                                    <div key={alb.id} className="p-2 border rounded-lg bg-background flex items-center gap-2">
                                        {alb.artworkURL ? (
                                            <img src={alb.artworkURL} alt="" className="size-10 rounded object-cover shrink-0" />
                                        ) : (
                                            <div className="size-10 rounded bg-muted flex items-center justify-center shrink-0">
                                                <Icon icon="card" className="size-4 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="font-semibold text-xs text-foreground truncate">{alb.title}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">{alb.year || ''}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
