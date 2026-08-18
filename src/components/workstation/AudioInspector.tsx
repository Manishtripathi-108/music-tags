'use client';

import React, { useEffect, useState } from 'react';

import { useForm } from 'react-hook-form';

import Icon from '@/components/common/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldInput, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBitrate, formatDuration, formatFileSize, formatSampleRate } from '@/lib/utils';
import { useAudioStore } from '@/store/audioStore';

interface TagFormValues {
    title: string;
    artist: string;
    albumArtist: string;
    album: string;
    trackNumber: string;
    year: string;
    genre: string;
    bpm: string;
    initialKey: string;
    comment: string;
}

export function AudioInspector() {
    const { activeTrackId, activeTrackDetail, fetchTracks } = useAudioStore();
    const { metadata, rawTags, isLoading } = activeTrackDetail;

    const [rawSearch, setRawSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const { register, handleSubmit, reset, watch } = useForm<TagFormValues>({
        defaultValues: {
            title: '',
            artist: '',
            albumArtist: '',
            album: '',
            trackNumber: '',
            year: '',
            genre: '',
            bpm: '',
            initialKey: '',
            comment: '',
        },
    });

    const watchedTitle = watch('title');
    const watchedArtist = watch('artist');

    useEffect(() => {
        if (metadata) {
            reset({
                title: metadata.title || '',
                artist: metadata.artist || '',
                albumArtist: metadata.albumArtist || '',
                album: metadata.album || '',
                trackNumber: metadata.trackNumber != null ? String(metadata.trackNumber) : '',
                year: metadata.year != null ? String(metadata.year) : '',
                genre: metadata.genre || '',
                bpm: metadata.bpm != null ? String(metadata.bpm) : '',
                initialKey: metadata.initialKey || '',
                comment: metadata.comment || '',
            });
            setSaveSuccess(false);
        }
    }, [metadata, reset]);

    const onSave = async (data: TagFormValues) => {
        if (!activeTrackId) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/files/${activeTrackId}/tags`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: data.title,
                    artist: data.artist,
                    albumArtist: data.albumArtist,
                    album: data.album,
                    trackNumber: data.trackNumber ? parseInt(data.trackNumber, 10) : null,
                    year: data.year ? parseInt(data.year, 10) : null,
                    genre: data.genre,
                    bpm: data.bpm ? parseFloat(data.bpm) : null,
                    initialKey: data.initialKey,
                    comment: data.comment,
                }),
            });

            if (!res.ok) throw new Error('Failed to save tags');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
            fetchTracks();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!activeTrackId || (!metadata && !isLoading)) {
        return (
            <aside className="flex w-80 flex-col items-center justify-center border-l border-zinc-800 bg-zinc-950/90 p-6 text-center text-zinc-500 select-none">
                <Icon icon="audio" className="mb-2 h-8 w-8 opacity-20" />
                <span className="text-xs font-medium">Select a track to inspect tags</span>
            </aside>
        );
    }

    const filteredRawTags = rawTags.filter(
        (t) =>
            t.tag.toLowerCase().includes(rawSearch.toLowerCase()) ||
            t.group.toLowerCase().includes(rawSearch.toLowerCase()) ||
            String(t.value).toLowerCase().includes(rawSearch.toLowerCase())
    );

    return (
        <aside className="flex h-full w-80 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-950 text-xs select-none">
            {/* Inspector Header & Cover Art Thumbnail */}
            <div className="border-zinc-850 flex items-center gap-3 border-b bg-zinc-900/40 p-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-900 shadow-inner">
                    {metadata?.hasCoverArt ? (
                        <img
                            src={`/api/media/art/${activeTrackId}.jpg`}
                            alt="Cover Art"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <Icon icon="audio" className="h-6 w-6 text-zinc-700" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-zinc-100">{watchedTitle || metadata?.title || 'Untitled'}</div>
                    <div className="truncate text-[11px] text-zinc-400">{watchedArtist || metadata?.artist || 'Unknown Artist'}</div>
                    <div className="mt-1 flex items-center gap-1">
                        <Badge variant="outline" className="px-1 py-0 font-mono text-[9px] text-zinc-400">
                            {metadata?.codec ? metadata.codec.toUpperCase() : 'AUDIO'}
                        </Badge>
                        {metadata?.lossless && (
                            <Badge variant="success" className="px-1 py-0 font-mono text-[9px]">
                                LOSSLESS
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs Container */}
            <Tabs defaultValue="tags" className="flex min-h-0 flex-1 flex-col">
                <div className="px-3 pt-2">
                    <TabsList className="grid h-7 w-full grid-cols-3 border-zinc-800 bg-zinc-900">
                        <TabsTrigger value="tags" className="text-xs">
                            <Icon icon="document" className="mr-1 h-3 w-3" />
                            Tags
                        </TabsTrigger>
                        <TabsTrigger value="specs" className="text-xs">
                            <Icon icon="settings" className="mr-1 h-3 w-3" />
                            Specs
                        </TabsTrigger>
                        <TabsTrigger value="raw" className="text-xs">
                            <Icon icon="code" className="mr-1 h-3 w-3" />
                            Raw ({rawTags.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab 1: Canonical Audio Tags Editor */}
                <TabsContent value="tags" className="flex-1 space-y-3 overflow-auto p-3 font-mono">
                    <form onSubmit={handleSubmit(onSave)} className="space-y-2.5">
                        <Field>
                            <FieldLabel>Track Title</FieldLabel>
                            <FieldInput className="mt-0.5 h-7 text-xs" {...register('title')} />
                        </Field>

                        <div className="grid grid-cols-2 gap-2">
                            <Field>
                                <FieldLabel>Artist</FieldLabel>
                                <FieldInput className="mt-0.5 h-7 text-xs" {...register('artist')} />
                            </Field>
                            <Field>
                                <FieldLabel>Album Artist</FieldLabel>
                                <FieldInput className="mt-0.5 h-7 text-xs" {...register('albumArtist')} />
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel>Album</FieldLabel>
                            <FieldInput className="mt-0.5 h-7 text-xs" {...register('album')} />
                        </Field>

                        <div className="grid grid-cols-3 gap-2">
                            <Field>
                                <FieldLabel>Track #</FieldLabel>
                                <FieldInput type="number" className="mt-0.5 h-7 text-xs" {...register('trackNumber')} />
                            </Field>
                            <Field>
                                <FieldLabel>Year</FieldLabel>
                                <FieldInput type="number" className="mt-0.5 h-7 text-xs" {...register('year')} />
                            </Field>
                            <Field>
                                <FieldLabel>BPM</FieldLabel>
                                <FieldInput type="number" step="0.1" className="mt-0.5 h-7 text-xs" {...register('bpm')} />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Field>
                                <FieldLabel>Genre</FieldLabel>
                                <FieldInput className="mt-0.5 h-7 text-xs" {...register('genre')} />
                            </Field>
                            <Field>
                                <FieldLabel>Key</FieldLabel>
                                <FieldInput placeholder="e.g. 8A / Am" className="mt-0.5 h-7 text-xs" {...register('initialKey')} />
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel>Comment</FieldLabel>
                            <FieldInput className="mt-0.5 h-7 text-xs" {...register('comment')} />
                        </Field>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="h-8 w-full gap-1.5 bg-blue-600 text-xs font-medium text-white hover:bg-blue-500">
                                {isSaving ? (
                                    <Icon icon="loading" className="h-3.5 w-3.5" />
                                ) : saveSuccess ? (
                                    <Icon icon="success" className="h-3.5 w-3.5 text-emerald-300" />
                                ) : (
                                    <Icon icon="diskImage" className="h-3.5 w-3.5" />
                                )}
                                <span>{isSaving ? 'Writing Tags...' : saveSuccess ? 'Saved Successfully' : 'Write Tags'}</span>
                            </Button>
                        </div>
                    </form>
                </TabsContent>

                {/* Tab 2: Technical Stream Specs (FFprobe) */}
                <TabsContent value="specs" className="flex-1 space-y-2 overflow-auto p-3 font-mono text-[11px]">
                    <div className="border-zinc-850 space-y-1.5 rounded border bg-zinc-900/60 p-2.5">
                        <div className="border-zinc-850 flex justify-between border-b py-0.5 text-zinc-400">
                            <span>Duration</span>
                            <span className="text-zinc-100">{formatDuration(metadata?.durationSeconds)}</span>
                        </div>
                        <div className="border-zinc-850 flex justify-between border-b py-0.5 text-zinc-400">
                            <span>Bitrate</span>
                            <span className="text-zinc-100">{formatBitrate(metadata?.bitrateKbps)}</span>
                        </div>
                        <div className="border-zinc-850 flex justify-between border-b py-0.5 text-zinc-400">
                            <span>Sample Rate</span>
                            <span className="text-zinc-100">{formatSampleRate(metadata?.sampleRateHz)}</span>
                        </div>
                        <div className="border-zinc-850 flex justify-between border-b py-0.5 text-zinc-400">
                            <span>Channels</span>
                            <span className="text-zinc-100">
                                {metadata?.channels ? `${metadata.channels}ch (${metadata.channelLayout || 'standard'})` : '-'}
                            </span>
                        </div>
                        <div className="border-zinc-850 flex justify-between border-b py-0.5 text-zinc-400">
                            <span>Bit Depth</span>
                            <span className="text-zinc-100">{metadata?.bitDepth ? `${metadata.bitDepth}-bit` : '-'}</span>
                        </div>
                        <div className="flex justify-between py-0.5 text-zinc-400">
                            <span>Codec</span>
                            <span className="text-zinc-100 uppercase">{metadata?.codec || '-'}</span>
                        </div>
                    </div>
                </TabsContent>

                {/* Tab 3: Raw ExifTool Tag Tree */}
                <TabsContent value="raw" className="flex flex-1 flex-col space-y-2 overflow-hidden p-2 font-mono">
                    <div className="relative">
                        <Icon icon="search" className="absolute top-1.5 left-2 h-3 w-3 text-zinc-500" />
                        <Input
                            placeholder="Filter tags..."
                            value={rawSearch}
                            onChange={(e) => setRawSearch(e.target.value)}
                            className="h-6 border-zinc-800 bg-zinc-900 pl-6 text-[11px]"
                        />
                    </div>

                    <div className="border-zinc-850 flex-1 space-y-1 overflow-auto rounded border bg-zinc-950 p-1 text-[10px]">
                        {filteredRawTags.map((t, idx) => (
                            <div key={idx} className="flex flex-col rounded border-b border-zinc-900/50 p-1 hover:bg-zinc-900">
                                <div className="flex items-center justify-between text-zinc-400">
                                    <span className="font-bold text-blue-400">{t.tag}</span>
                                    <span className="bg-zinc-850 rounded px-1 text-[9px] text-zinc-500">{t.group}</span>
                                </div>
                                <div className="mt-0.5 break-all text-zinc-200 select-text">{String(t.value)}</div>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </aside>
    );
}
