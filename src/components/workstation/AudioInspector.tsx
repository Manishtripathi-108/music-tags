'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { FormProvider, useForm } from 'react-hook-form';

import Icon from '@/components/ui/Icon';
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { parseDateSafe } from '@/domain/media/date';
import { hasLrcTimestamps } from '@/domain/media/lyrics';
import { Track } from '@/domain/media/track';
import { type TrackPatchApiResponse } from '@/domain/media/dto';
import { DEFAULT_TAG_FORM_VALUES, TagFormSchema, type TagFormValues } from '@/schemas';
import { useAudioStore } from '@/store/audioStore';

import { AudioSpecsTab } from './inspector/AudioSpecsTab';
import { InspectorHeader } from './inspector/InspectorHeader';
import { LyricsTab } from './inspector/LyricsTab';
import { RawTagsTab } from './inspector/RawTagsTab';
import { TagFormTab } from './inspector/TagFormTab';
import { ZodError } from 'zod';

function toTagFormValues(metadata: Partial<Track>): TagFormValues {
    return {
        title: metadata.title || '',
        artist: metadata.artist || '',
        albumArtist: metadata.albumArtist || '',
        album: metadata.album || '',
        genre: metadata.genre || '',
        initialKey: metadata.initialKey || '',
        comment: metadata.comment || '',
        trackNumber: metadata.trackNumber != null ? String(metadata.trackNumber) : '',
        discNumber: metadata.discNumber != null ? String(metadata.discNumber) : '',
        releaseDate: parseDateSafe(metadata.releaseDate),
        year: metadata.year != null ? String(metadata.year) : '',
        bpm: metadata.bpm != null ? String(metadata.bpm) : '',
        composer: metadata.composer || '',
        publisher: metadata.publisher || '',
        copyright: metadata.copyright || '',
        isrc: metadata.isrc || '',
        lyrics: metadata.lyrics || '',
    };
}

export function AudioInspector() {
    const { activeTrackId, activeTrackDetail, fetchTracks, updateTrackInline, normalizeTrackLrc } = useAudioStore();
    const { metadata, rawTags, isLoading } = activeTrackDetail;

    const [isSaved, setIsSaved] = useState(false);

    const formValues = useMemo(() => (metadata ? toTagFormValues(metadata) : DEFAULT_TAG_FORM_VALUES), [metadata]);

    const formMethods = useForm({
        resolver: zodResolver(TagFormSchema),
        mode: 'onTouched',
        values: formValues,
        resetOptions: {
            keepDirtyValues: false,
        },
    });

    const { reset, watch, setValue, setError } = formMethods;
    const [watchedTitle, watchedArtist, watchedLyrics] = watch(['title', 'artist', 'lyrics']);

    useEffect(() => {
        setIsSaved(false);
    }, [activeTrackId]);

    const onSave = async (data: TagFormValues) => {
        if (!activeTrackId) return;

        setIsSaved(false);

        try {
            const { data: responseData } = await axios.patch<TrackPatchApiResponse>(`/api/files/${activeTrackId}/tags`, data);

            if (responseData.success && responseData.track) {
                updateTrackInline(activeTrackId, responseData.track);
                reset(toTagFormValues(responseData.track));
                setIsSaved(true);
                // fetchTracks().catch(console.error);
            }
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.data?.details) {
                const details = error.response.data.details as ZodError['issues'];
                details.forEach((issue) => {
                    const fieldName = issue.path[0] as keyof TagFormValues;
                    setError(fieldName, { type: 'manual', message: issue.message });
                });
            }
        }
    };

    const handleSaveLyrics = async (text: string): Promise<boolean> => {
        if (!activeTrackId) return false;

        const trimmed = text.trim();
        const lyricsType = trimmed ? (hasLrcTimestamps(text) ? 'synced' : 'unsynced') : null;
        const payload = {
            lyrics: text,
            lyricsType,
        };

        try {
            const { data: responseData } = await axios.patch<TrackPatchApiResponse>(`/api/files/${activeTrackId}/tags`, payload);

            if (responseData.success && responseData.track) {
                updateTrackInline(activeTrackId, responseData.track);
            }
            fetchTracks().catch(console.error);
            return true;
        } catch (err) {
            console.error('Failed to save lyrics:', err);

            return false;
        }
    };

    if (!activeTrackId || (!metadata && !isLoading)) {
        return (
            <aside className="bg-card text-muted-foreground flex w-90 flex-col items-center justify-center border border-l p-6 text-center select-none">
                <Icon icon="audio" className="mb-2 size-8 opacity-20" />
                <span className="text-xs font-medium">Select a track to inspect tags</span>
            </aside>
        );
    }

    const isLrc = hasLrcTimestamps(watchedLyrics);
    const hasLyrics = Boolean(watchedLyrics?.trim());

    return (
        <aside className="bg-background flex h-full w-90 flex-col overflow-hidden border border-l text-xs select-none">
            <InspectorHeader
                activeTrackId={activeTrackId}
                metadata={metadata}
                displayTitle={watchedTitle}
                displayArtist={watchedArtist}
                hasLyrics={hasLyrics}
                isLrc={isLrc}
            />

            <Tabs defaultValue="tags" className="flex min-h-0 flex-1 flex-col px-3 py-2">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="tags" className="text-xs">
                        <Icon icon="document" className="size-3" />
                        Tags
                    </TabsTrigger>
                    <TabsTrigger value="lyrics" className="text-xs">
                        <Icon icon="lyrics" className="size-3" />
                        Lyrics
                    </TabsTrigger>
                    <TabsTrigger value="specs" className="text-xs">
                        <Icon icon="settings" className="size-3" />
                        Specs
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="text-xs">
                        <Icon icon="raw" className="size-3" />
                        Raw
                    </TabsTrigger>
                    <TabsIndicator />
                </TabsList>

                <TabsContent value="tags" className="flex-1 overflow-auto">
                    <FormProvider {...formMethods}>
                        <TagFormTab key={activeTrackId || 'no-track'} onSubmit={onSave} isSaved={isSaved} />
                    </FormProvider>
                </TabsContent>

                <TabsContent value="lyrics" className="flex flex-1 flex-col overflow-hidden">
                    <LyricsTab
                        activeTrackId={activeTrackId}
                        metadata={metadata}
                        lyricsText={watchedLyrics || ''}
                        setLyricsText={(lrc) => setValue('lyrics', lrc)}
                        onSaveLyrics={handleSaveLyrics}
                        onNormalizeTrackLrc={normalizeTrackLrc}
                    />
                </TabsContent>

                <TabsContent value="specs" className="flex-1 overflow-auto">
                    <AudioSpecsTab metadata={metadata} />
                </TabsContent>

                <TabsContent value="raw" className="flex flex-1 flex-col overflow-hidden">
                    <RawTagsTab rawTags={rawTags} isLoading={isLoading} />
                </TabsContent>
            </Tabs>
        </aside>
    );
}

export default AudioInspector;
