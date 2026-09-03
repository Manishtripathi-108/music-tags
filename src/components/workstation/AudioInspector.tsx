'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Icon from '@/components/ui/Icon';
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAudioStore } from '@/store/audioStore';
import { TagFormSchema, type TagFormValues } from '@/domain/media/schemas';
import { type TrackPatchApiResponse } from '@/domain/media/track';
import { isLrcContent } from '@/domain/media/lyrics';
import { InspectorHeader } from './inspector/InspectorHeader';
import { AudioSpecsTab } from './inspector/AudioSpecsTab';
import { RawTagsTab } from './inspector/RawTagsTab';
import { LyricsTab } from './inspector/LyricsTab';
import { TagFormTab } from './inspector/TagFormTab';

export function AudioInspector() {
    const { activeTrackId, activeTrackDetail, fetchTracks, updateTrackInline, normalizeTrackLrc } = useAudioStore();
    const { metadata, rawTags, isLoading } = activeTrackDetail;

    const [isSaved, setIsSaved] = useState(false);
    const [lyricsText, setLyricsText] = useState('');

    const formMethods = useForm<TagFormValues>({
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
            composer: '',
            publisher: '',
            copyright: '',
            isrc: '',
            lyrics: '',
        },
    });

    const { reset, watch } = formMethods;
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
                composer: metadata.composer || '',
                publisher: metadata.publisher || '',
                copyright: metadata.copyright || '',
                isrc: metadata.isrc || '',
                lyrics: metadata.lyrics || '',
            });
            setLyricsText(metadata.lyrics || '');
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
            composer: data.composer || '',
            publisher: data.publisher || '',
            copyright: data.copyright || '',
            isrc: data.isrc || '',
            lyrics: data.lyrics || '',
        };

        try {
            const { data: responseData } = await axios.patch<TrackPatchApiResponse>(
                `/api/files/${activeTrackId}/tags`,
                payload
            );

            const savedTrack = responseData.success && responseData.track ? responseData.track : { ...payload, id: activeTrackId };
            updateTrackInline(activeTrackId, savedTrack);

            reset({
                title: savedTrack.title || '',
                artist: savedTrack.artist || '',
                albumArtist: savedTrack.albumArtist || '',
                album: savedTrack.album || '',
                trackNumber: savedTrack.trackNumber != null ? String(savedTrack.trackNumber) : '',
                year: savedTrack.year != null ? String(savedTrack.year) : '',
                genre: savedTrack.genre || '',
                bpm: savedTrack.bpm != null ? String(savedTrack.bpm) : '',
                initialKey: savedTrack.initialKey || '',
                comment: savedTrack.comment || '',
                composer: savedTrack.composer || '',
                publisher: savedTrack.publisher || '',
                copyright: savedTrack.copyright || '',
                isrc: savedTrack.isrc || '',
                lyrics: savedTrack.lyrics || '',
            });

            setIsSaved(true);
            fetchTracks().catch(console.error);
        } catch (error) {
            console.error('Error saving track tags:', error);
        }
    };

    const handleSaveLyrics = async (text: string): Promise<boolean> => {
        if (!activeTrackId) return false;

        const isLrc = isLrcContent(text);
        const payload = {
            lyrics: text,
            lyricsSyncedJson: isLrc ? JSON.stringify(text) : null,
            lyricsUnsynced: isLrc ? null : text,
        };

        try {
            const { data: responseData } = await axios.patch<TrackPatchApiResponse>(
                `/api/files/${activeTrackId}/tags`,
                payload
            );

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

    const isLrc = isLrcContent(lyricsText);
    const hasLyrics = Boolean(lyricsText.trim());

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

            <Tabs defaultValue="tags" className="flex min-h-0 flex-1 flex-col">
                <div className="px-3 pt-2">
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
                </div>

                <TabsContent value="tags" className="flex-1 overflow-auto">
                    <FormProvider {...formMethods}>
                        <TagFormTab onSubmit={onSave} isSaved={isSaved} />
                    </FormProvider>
                </TabsContent>

                <TabsContent value="lyrics" className="flex flex-1 flex-col overflow-hidden">
                    <LyricsTab
                        activeTrackId={activeTrackId}
                        metadata={metadata}
                        lyricsText={lyricsText}
                        setLyricsText={setLyricsText}
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
