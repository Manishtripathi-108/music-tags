'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useEclipseStore } from '@/store/eclipseStore';
import { formatEclipseTrackQuality, isTrackDolbyAtmos } from '@/domain/remote-audio/eclipse-quality';
import { isDashManifestUrl, getAudioProxyUrl } from '@/domain/remote-audio/eclipse-stream';

function formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function EclipseAudioPlayer() {
    const {
        currentTrack,
        currentStream,
        isPlaying,
        isLoadingStream,
        notices,
        dismissNotice,
        downloadTrack,
        downloadingTrackIds,
        getHeadersRecord,
    } = useEclipseStore();

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const dashPlayerRef = useRef<any>(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackError, setPlaybackError] = useState<string | null>(null);

    // Initialize playback when currentStream changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentStream?.url) return;

        let isCancelled = false;
        setPlaybackError(null);

        const initPlayer = async () => {
            const rawUrl = currentStream.url;
            const isDash = isDashManifestUrl(rawUrl, currentStream.format);
            const headers = getHeadersRecord();
            const proxyUrl = getAudioProxyUrl(rawUrl, headers);
            const streamProxyUrl = getAudioProxyUrl(rawUrl, headers, 'stream');

            // Clean up existing dashjs player instance if active
            if (dashPlayerRef.current) {
                try {
                    dashPlayerRef.current.destroy();
                } catch {}
                dashPlayerRef.current = null;
            }

            if (isDash) {
                // Check if browser MSE supports FLAC in MP4 container
                const canMsePlayFlac =
                    typeof window !== 'undefined' &&
                    typeof window.MediaSource !== 'undefined' &&
                    typeof window.MediaSource.isTypeSupported === 'function' &&
                    window.MediaSource.isTypeSupported('audio/mp4; codecs="flac"');

                // If browser MSE does not support FLAC in MP4 (Chrome, Brave, Firefox, Edge standard behavior),
                // route directly through lossless progressive FLAC streaming proxy mode to avoid "DASH error: No streams to play"
                if (!canMsePlayFlac) {
                    console.log(`[ECLIPSE:PLAYER] Browser MSE does not support FLAC inside MP4. Streaming progressive native FLAC: ${streamProxyUrl}`);
                    audio.src = streamProxyUrl;
                    if (isPlaying) {
                        audio.play().catch((playErr) => {
                            console.warn('[ECLIPSE:PLAYER] Progressive playback error:', playErr);
                        });
                    }
                    return;
                }

                // If MSE supports FLAC in MP4, initialize Dash.js with graceful fallback
                try {
                    console.log(`[ECLIPSE:PLAYER] Initializing Dash.js for stream: ${rawUrl}`);
                    const dashjs = await import('dashjs');
                    if (isCancelled || !audioRef.current) return;

                    const mediaPlayerFactory = dashjs.MediaPlayer || (dashjs as any).default?.MediaPlayer;
                    if (!mediaPlayerFactory) {
                        throw new Error('Dash.js MediaPlayer factory not found');
                    }
                    const player = mediaPlayerFactory().create();
                    player.updateSettings({
                        streaming: {
                            retryIntervals: {
                                MPD: 500,
                                InitializationSegment: 500,
                                MediaSegment: 1000,
                            },
                            retryAttempts: {
                                MPD: 3,
                                InitializationSegment: 3,
                                MediaSegment: 3,
                            },
                        },
                    });

                    player.initialize(audio, proxyUrl, isPlaying);

                    const errorEvent = (dashjs.MediaPlayer as any)?.events?.ERROR || 'error';
                    player.on(errorEvent, (e: any) => {
                        const msg = e?.error?.message || e?.event?.message || '';
                        console.warn('[ECLIPSE:DASH:ERROR]', msg, e);

                        // Seamless fallback if Dash.js encounters capability/stream errors
                        if (msg.includes('No streams to play') || msg.includes('capability') || msg.includes('codec')) {
                            console.log(`[ECLIPSE:PLAYER] Falling back to progressive FLAC stream: ${streamProxyUrl}`);
                            try {
                                player.destroy();
                            } catch {}
                            dashPlayerRef.current = null;
                            audio.src = streamProxyUrl;
                            if (isPlaying) {
                                audio.play().catch(() => {});
                            }
                            return;
                        }

                        setPlaybackError(`DASH error: ${msg || 'Playback stream error'}`);
                    });

                    dashPlayerRef.current = player;
                } catch (err: unknown) {
                    console.error('[ECLIPSE:PLAYER:DASH_FAILED]', err);
                    // Fallback to native progressive FLAC stream
                    audio.src = streamProxyUrl;
                    if (isPlaying) {
                        audio.play().catch((playErr) => {
                            console.warn('Native playback error:', playErr);
                        });
                    }
                }
            } else {
                console.log(`[ECLIPSE:PLAYER] Playing direct audio stream: ${rawUrl}`);
                audio.src = proxyUrl;
                if (isPlaying) {
                    audio.play().catch((err) => {
                        console.warn('Native audio play error:', err);
                    });
                }
            }
        };

        initPlayer();

        return () => {
            isCancelled = true;
            if (dashPlayerRef.current) {
                try {
                    dashPlayerRef.current.destroy();
                } catch {}
                dashPlayerRef.current = null;
            }
        };
    }, [currentStream?.url]);

    // Handle isPlaying toggle
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            if (dashPlayerRef.current) {
                dashPlayerRef.current.play();
            } else {
                audio.play().catch((err) => {
                    console.warn('Audio play failed:', err);
                });
            }
        } else {
            if (dashPlayerRef.current) {
                dashPlayerRef.current.pause();
            }
            audio.pause();
        }
    }, [isPlaying]);

    if (!currentTrack && notices.length === 0) return null;

    const isDownloading = currentTrack ? downloadingTrackIds.has(currentTrack.id) : false;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t shadow-2xl p-2.5 sm:px-4 select-none">
            {/* Native audio element driven by Dash.js or direct audio */}
            <audio
                ref={audioRef}
                preload="auto"
                onTimeUpdate={() => {
                    if (audioRef.current) {
                        setCurrentTime(audioRef.current.currentTime);
                        setDuration(audioRef.current.duration || 0);
                    }
                }}
                onLoadedMetadata={() => {
                    if (audioRef.current) {
                        setDuration(audioRef.current.duration || 0);
                    }
                }}
                onEnded={() => useEclipseStore.setState({ isPlaying: false })}
                onError={(e) => {
                    const err = (e.target as HTMLAudioElement).error;
                    if (err) {
                        console.error('[ECLIPSE:AUDIO:ERROR]', err);
                        setPlaybackError(`Audio playback error (code ${err.code})`);
                    }
                }}
            />

            {/* Playback Error Toast */}
            {playbackError && (
                <div className="mb-2 px-3 py-1.5 rounded-lg text-xs font-mono border bg-rose-500/15 border-rose-500/30 text-rose-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Icon icon="warning" className="size-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{playbackError}</span>
                    </div>
                    <button onClick={() => setPlaybackError(null)} className="p-0.5 hover:opacity-80">
                        <Icon icon="close" className="size-3" />
                    </button>
                </div>
            )}

            {/* Addon Notices Toast (if any) */}
            {notices.length > 0 && (
                <div className="mb-2">
                    {notices.slice(0, 1).map((n, idx) => (
                        <div
                            key={n.id || idx}
                            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border ${
                                n.level === 'error'
                                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                    : n.level === 'warning'
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                    : 'bg-primary/10 border-primary/20 text-primary'
                            }`}
                        >
                            <div className="flex items-center gap-1.5 min-w-0">
                                <Icon icon={n.level === 'error' ? 'errorCircle' : 'warning'} className="size-3.5 shrink-0" />
                                <span className="font-bold">{n.title || 'Addon Notice'}:</span>
                                <span className="truncate">{n.message}</span>
                            </div>

                            <button onClick={() => dismissNotice(n.id)} className="p-0.5 hover:opacity-80">
                                <Icon icon="close" className="size-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {currentTrack && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Track info */}
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-1/3">
                        {currentTrack.artworkURL ? (
                            <img src={currentTrack.artworkURL} alt="" className="size-11 rounded-md object-cover border shrink-0 bg-muted" />
                        ) : (
                            <div className="size-11 rounded-md bg-muted flex items-center justify-center shrink-0">
                                <Icon icon="audio" className="size-5 text-muted-foreground" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <div className="font-semibold text-xs text-foreground truncate">{currentTrack.title}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{currentTrack.artist}</div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {(isTrackDolbyAtmos(currentTrack) || currentStream?.tier === 'DOLBY_ATMOS' || currentStream?.codec === 'eac3-joc') && (
                                    <Badge size="xs" className="bg-purple-950/90 border border-purple-500/60 text-purple-200 font-bold text-[8px] px-1 py-0 shadow-xs">
                                        DOLBY ATMOS
                                    </Badge>
                                )}
                                <Badge variant="outline" size="xs" className="uppercase font-mono text-[9px]">
                                    {currentStream?.format || currentStream?.codec || currentTrack.format || 'AUDIO'}
                                </Badge>
                                {(currentStream?.quality || currentTrack) && (
                                    <span className="text-[9px] font-mono text-muted-foreground/90 truncate max-w-[150px]">
                                        {currentStream?.quality || formatEclipseTrackQuality(currentTrack).displayQuality}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Central Playback Controls */}
                    <div className="flex flex-col items-center gap-1.5 w-full sm:w-1/2 max-w-lg">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="primary"
                                size="xs"
                                disabled={isLoadingStream}
                                onClick={() => useEclipseStore.setState({ isPlaying: !isPlaying })}
                                className="size-8 rounded-full p-0 flex items-center justify-center shadow-sm"
                            >
                                <Icon icon={isLoadingStream ? 'loading' : isPlaying ? 'pause' : 'play'} className={`size-4 ${isLoadingStream ? 'animate-spin' : ''}`} />
                            </Button>

                            <Button
                                variant="ghost"
                                size="xs"
                                disabled={isDownloading}
                                onClick={() => downloadTrack(currentTrack)}
                                className="size-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Download current track"
                            >
                                <Icon icon={isDownloading ? 'loading' : 'download'} className={`size-3.5 ${isDownloading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>

                        {/* Scrubber slider */}
                        <div className="w-full flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                            <span>{formatDuration(currentTime)}</span>
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={(e) => {
                                    const next = parseFloat(e.target.value);
                                    setCurrentTime(next);
                                    if (dashPlayerRef.current) {
                                        dashPlayerRef.current.seek(next);
                                    }
                                    if (audioRef.current) {
                                        audioRef.current.currentTime = next;
                                    }
                                }}
                                className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <span>{formatDuration(duration)}</span>
                        </div>
                    </div>

                    {/* Volume and Right tools */}
                    <div className="hidden sm:flex items-center justify-end gap-2 w-1/4">
                        <button
                            onClick={() => {
                                const nextMute = !isMuted;
                                setIsMuted(nextMute);
                                if (audioRef.current) audioRef.current.muted = nextMute;
                            }}
                            className="text-muted-foreground hover:text-foreground p-1"
                        >
                            <Icon icon={isMuted ? 'closeCircle' : 'audio'} className="size-3.5" />
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setVolume(v);
                                setIsMuted(false);
                                if (audioRef.current) {
                                    audioRef.current.volume = v;
                                    audioRef.current.muted = false;
                                }
                            }}
                            className="w-20 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
