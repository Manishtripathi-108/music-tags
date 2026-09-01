'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Field, FieldInput, FieldLabel, FieldTextarea, FieldError, FieldRequiredIndicator } from '@/components/ui/Field';
import { Fieldset, FieldsetContent, FieldsetLegend } from '@/components/ui/Fieldset';
import { NumberInputField } from '@/components/ui/NumberInput';
import { formatBitrate, formatDuration, formatSampleRate } from '@/lib/utils';
import { useAudioStore } from '@/store/audioStore';
import { TagFormSchema, type TagFormValues } from '@/types/audio';
import axios from 'axios';

export function AudioInspector() {
    const { activeTrackId, activeTrackDetail, fetchTracks, updateTrackInline } = useAudioStore();
    const { metadata, rawTags, isLoading } = activeTrackDetail;

    const [isSaved, setIsSaved] = useState(false);
    const [rawSearch, setRawSearch] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        watch,
        control,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<TagFormValues>({
        resolver: zodResolver(TagFormSchema),
        mode: 'onTouched',
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

    const [watchedTitle, watchedArtist] = watch(['title', 'artist']);

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
        }
    }, [metadata, reset]);

    const onSave = async (data: TagFormValues) => {
        if (!activeTrackId) return;

        setIsSaved(false);

        const payload = {
            title: data.title,
            artist: data.artist || '',
            albumArtist: data.albumArtist || '',
            album: data.album || '',
            trackNumber: data.trackNumber ? parseInt(data.trackNumber, 10) : null,
            year: data.year ? parseInt(data.year, 10) : null,
            genre: data.genre || '',
            bpm: data.bpm ? parseFloat(data.bpm) : null,
            initialKey: data.initialKey || '',
            comment: data.comment || '',
        };

        try {
            await axios.patch(`/api/files/${activeTrackId}/tags`, payload);

            updateTrackInline(activeTrackId, payload);

            // Form is now clean because server accepted the values
            reset(data);
            setIsSaved(true);

            // Refresh in background
            fetchTracks().catch(console.error);
        } catch (error) {
            console.error('Error updating track tags:', error);
        }
    };

    if (!activeTrackId || (!metadata && !isLoading)) {
        return (
            <aside className="bg-card text-muted-foreground flex w-80 flex-col items-center justify-center border border-l p-6 text-center select-none">
                <Icon icon="audio" className="mb-2 size-8 opacity-20" />
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
        <aside className="bg-background flex h-full w-80 flex-col overflow-hidden border border-l text-xs select-none">
            {/* Inspector Header & Cover Art Thumbnail */}
            <div className="bg-background flex items-center gap-3 border-b p-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border shadow-inner">
                    {metadata?.hasCoverArt ? (
                        <Image
                            src={`/api/media/art/${activeTrackId}.jpg`}
                            alt="Cover Art"
                            fill
                            sizes="56px"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : (
                        <Icon icon="audio" className="text-border size-6" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-muted-foreground truncate text-xs font-semibold">{watchedTitle || metadata?.title || 'Untitled'}</div>
                    <div className="text-muted-foreground truncate text-[11px]">{watchedArtist || metadata?.artist || 'Unknown Artist'}</div>
                    <div className="mt-1 flex items-center gap-1">
                        <Badge variant="outline" size="xs" className="text-muted-foreground font-mono">
                            {metadata?.codec ? metadata.codec.toUpperCase() : 'AUDIO'}
                        </Badge>
                        {metadata?.lossless && (
                            <Badge variant="success" size="xs" className="font-mono">
                                LOSSLESS
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs Container */}
            <Tabs defaultValue="tags" className="flex min-h-0 flex-1 flex-col">
                <div className="px-3 pt-2">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="tags" className="text-xs">
                            <Icon icon="document" className="size-3" />
                            Tags
                        </TabsTrigger>
                        <TabsTrigger value="specs" className="text-xs">
                            <Icon icon="settings" className="size-3" />
                            Specs
                        </TabsTrigger>
                        <TabsTrigger value="raw" className="text-xs">
                            <Icon icon="raw" className="size-3" />
                            Raw ({rawTags.length})
                        </TabsTrigger>
                        <TabsIndicator />
                    </TabsList>
                </div>

                <TabsContent value="tags" className="flex-1 space-y-3 overflow-auto p-3 font-mono">
                    <form onSubmit={handleSubmit(onSave)} className="space-y-3">
                        {/* Fieldset: Track Identification */}
                        <Fieldset className="border p-2.5">
                            <FieldsetLegend className="text-primary text-[10px]">
                                <Icon icon="audio" className="size-3" />
                                Track Information
                            </FieldsetLegend>
                            <FieldsetContent className="gap-2">
                                <Field invalid={!!errors.title} required>
                                    <FieldLabel>
                                        Title <FieldRequiredIndicator />
                                    </FieldLabel>
                                    <FieldInput placeholder="Track title..." {...register('title')} />
                                    <FieldError>{errors.title?.message}</FieldError>
                                </Field>

                                <div className="grid grid-cols-2 gap-2">
                                    <Field invalid={!!errors.artist}>
                                        <FieldLabel>Artist</FieldLabel>
                                        <FieldInput placeholder="Artist name..." {...register('artist')} />
                                        <FieldError>{errors.artist?.message}</FieldError>
                                    </Field>
                                    <Field invalid={!!errors.albumArtist}>
                                        <FieldLabel>Album Artist</FieldLabel>
                                        <FieldInput placeholder="Album artist..." {...register('albumArtist')} />
                                        <FieldError>{errors.albumArtist?.message}</FieldError>
                                    </Field>
                                </div>

                                <Field invalid={!!errors.album}>
                                    <FieldLabel>Album</FieldLabel>
                                    <FieldInput placeholder="Album name..." {...register('album')} />
                                    <FieldError>{errors.album?.message}</FieldError>
                                </Field>
                            </FieldsetContent>
                        </Fieldset>

                        {/* Fieldset: Track Numerical & Musical Specs with NumberInput */}
                        <Fieldset className="border not-first:p-2.5">
                            <FieldsetLegend className="text-primary text-[10px]">
                                <Icon icon="settings" className="size-3" />
                                Numerical & Musical
                            </FieldsetLegend>
                            <FieldsetContent className="gap-2">
                                <div className="grid grid-cols-3 gap-2">
                                    <Controller
                                        control={control}
                                        name="trackNumber"
                                        render={({ field: { value, onChange } }) => (
                                            <NumberInputField
                                                label="Track #"
                                                placeholder="1"
                                                value={value}
                                                min={1}
                                                max={999}
                                                invalid={!!errors.trackNumber}
                                                error={errors.trackNumber?.message}
                                                onValueChange={(details) => onChange(details.value)}
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={control}
                                        name="year"
                                        render={({ field: { value, onChange } }) => (
                                            <NumberInputField
                                                label="Year"
                                                placeholder="2024"
                                                value={value}
                                                min={1000}
                                                max={2099}
                                                invalid={!!errors.year}
                                                error={errors.year?.message}
                                                onValueChange={(details) => onChange(details.value)}
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={control}
                                        name="bpm"
                                        render={({ field: { value, onChange } }) => (
                                            <NumberInputField
                                                label="BPM"
                                                placeholder="128.0"
                                                value={value}
                                                min={20}
                                                max={400}
                                                step={0.5}
                                                invalid={!!errors.bpm}
                                                error={errors.bpm?.message}
                                                onValueChange={(details) => onChange(details.value)}
                                            />
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Field invalid={!!errors.genre}>
                                        <FieldLabel>Genre</FieldLabel>
                                        <FieldInput placeholder="e.g. Pop" {...register('genre')} />
                                        <FieldError>{errors.genre?.message}</FieldError>
                                    </Field>
                                    <Field invalid={!!errors.initialKey}>
                                        <FieldLabel>Key</FieldLabel>
                                        <FieldInput placeholder="8A / Am / C#m" {...register('initialKey')} />
                                        <FieldError>{errors.initialKey?.message}</FieldError>
                                    </Field>
                                </div>
                            </FieldsetContent>
                        </Fieldset>

                        {/* Fieldset: Notes & Extra Info */}
                        <Fieldset className="border p-2.5">
                            <FieldsetLegend className="text-foreground text-[10px]">
                                <Icon icon="document" className="size-3" />
                                Notes
                            </FieldsetLegend>
                            <FieldsetContent className="gap-2">
                                <Field invalid={!!errors.comment}>
                                    <FieldLabel>Comment</FieldLabel>
                                    <FieldTextarea rows={2} placeholder="Add comments or notes..." {...register('comment')} />
                                    <FieldError>{errors.comment?.message}</FieldError>
                                </Field>
                            </FieldsetContent>
                        </Fieldset>

                        <Button type="submit" disabled={!isDirty || isSubmitting} variant="info" className="mt-1 w-full">
                            <Icon icon={isSubmitting ? 'loading' : isSaved && !isDirty ? 'success' : 'save'} className="size-3.5" />

                            <span>{isSubmitting ? 'Writing Tags...' : isSaved && !isDirty ? 'Saved Successfully' : 'Write Tags'}</span>
                        </Button>
                    </form>
                </TabsContent>

                {/* Tab 2: Technical Stream Specs (FFprobe) */}
                <TabsContent value="specs" className="flex-1 space-y-2 overflow-auto p-3 font-mono text-[11px]">
                    <div className="space-y-1.5 rounded border p-2.5">
                        <div className="text-foreground flex justify-between border-b py-0.5">
                            <span>Duration</span>
                            <span className="text-muted-foreground">{formatDuration(metadata?.durationSeconds)}</span>
                        </div>
                        <div className="text-foreground flex justify-between border-b py-0.5">
                            <span>Bitrate</span>
                            <span className="text-muted-foreground">{formatBitrate(metadata?.bitrateKbps)}</span>
                        </div>
                        <div className="text-foreground flex justify-between border-b py-0.5">
                            <span>Sample Rate</span>
                            <span className="text-muted-foreground">{formatSampleRate(metadata?.sampleRateHz)}</span>
                        </div>
                        <div className="text-foreground flex justify-between border-b py-0.5">
                            <span>Channels</span>
                            <span className="text-muted-foreground">
                                {metadata?.channels ? `${metadata.channels}ch (${metadata.channelLayout || 'standard'})` : '-'}
                            </span>
                        </div>
                        <div className="text-foreground flex justify-between border-b py-0.5">
                            <span>Bit Depth</span>
                            <span className="text-muted-foreground">{metadata?.bitDepth ? `${metadata.bitDepth}-bit` : '-'}</span>
                        </div>
                        <div className="text-foreground flex justify-between py-0.5">
                            <span>Codec</span>
                            <span className="text-muted-foreground uppercase">{metadata?.codec || '-'}</span>
                        </div>
                    </div>
                </TabsContent>

                {/* Tab 3: Raw ExifTool Tag Tree */}
                <TabsContent value="raw" className="flex flex-1 flex-col space-y-2 overflow-hidden p-2 font-mono">
                    <div className="relative">
                        <Icon icon="search" className="text-muted-foreground absolute top-2.5 left-2 size-3" />
                        <FieldInput
                            placeholder="Filter tags..."
                            value={rawSearch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRawSearch(e.target.value)}
                            className="pl-6"
                        />
                    </div>

                    <div className="flex-1 space-y-1 overflow-auto rounded border p-1 text-[10px]">
                        {filteredRawTags.length === 0 && (
                            <div className="text-muted-foreground flex h-full items-center justify-center">No matching tags found</div>
                        )}
                        {filteredRawTags.map((t, idx) => (
                            <div key={idx} className="hover:bg-muted flex flex-col rounded border-b p-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-primary font-bold">{t.tag}</span>
                                    <span className="text-muted-foreground rounded px-1 text-[9px]">{t.group}</span>
                                </div>
                                <div className="text-foreground mt-0.5 break-all select-text">{String(t.value)}</div>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </aside>
    );
}
