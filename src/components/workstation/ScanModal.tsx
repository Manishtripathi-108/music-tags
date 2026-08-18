'use client';

import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import Icon from '@/components/common/Icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldInput, FieldLabel } from '@/components/ui/field';
import { useAudioStore } from '@/store/audioStore';
import { type ScanFolderRequest, ScanFolderRequestSchema } from '@/types/audio';

export function ScanModal() {
    const { isScanModalOpen, setIsScanModalOpen, setActiveScanJob, fetchTracks } = useAudioStore();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ScanFolderRequest>({
        resolver: zodResolver(ScanFolderRequestSchema) as any,
        defaultValues: {
            folderPath: '',
            recursive: true,
            forceReindex: false,
        },
    });

    const onSubmit = async (values: ScanFolderRequest) => {
        setServerError(null);

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to start library scan');
            }

            const jobId = data.jobId;
            setIsScanModalOpen(false);
            reset();

            // Connect to Server-Sent Events (SSE) stream for live progress
            const eventSource = new EventSource(`/api/scan?jobId=${jobId}`);

            eventSource.onmessage = (event) => {
                try {
                    const progress = JSON.parse(event.data);
                    setActiveScanJob(progress);

                    if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
                        eventSource.close();
                        fetchTracks();
                    }
                } catch {}
            };

            eventSource.onerror = () => {
                eventSource.close();
                fetchTracks();
            };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setServerError(msg);
        }
    };

    return (
        <Dialog open={isScanModalOpen} onOpenChange={setIsScanModalOpen}>
            <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                        <Icon icon="open" className="h-4 w-4 text-blue-500" />
                        <span>Scan Music Directory</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                        Select a local folder on your PC to scan and index audio files with ExifTool & FFprobe.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <Field invalid={!!errors.folderPath}>
                        <FieldLabel className="text-[11px] font-semibold text-zinc-300">Absolute Folder Path</FieldLabel>
                        <FieldInput
                            type="text"
                            placeholder="e.g. C:\Music or E:\AudioLibrary"
                            className="mt-1 font-mono text-xs"
                            {...register('folderPath')}
                        />
                        {errors.folderPath?.message && (
                            <FieldError className="mt-1 flex items-center gap-1">
                                <Icon icon="warning" className="h-3.5 w-3.5" />
                                <span>{errors.folderPath.message}</span>
                            </FieldError>
                        )}
                        {serverError && (
                            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
                                <Icon icon="warning" className="h-3.5 w-3.5" />
                                <span>{serverError}</span>
                            </div>
                        )}
                    </Field>

                    <div className="space-y-2 border-t border-zinc-900 pt-1">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                            <input
                                type="checkbox"
                                {...register('recursive')}
                                className="rounded border-zinc-800 bg-zinc-900 text-blue-600 focus:ring-0"
                            />
                            <span>Scan subfolders recursively</span>
                        </label>

                        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                            <input
                                type="checkbox"
                                {...register('forceReindex')}
                                className="rounded border-zinc-800 bg-zinc-900 text-blue-600 focus:ring-0"
                            />
                            <span>Force re-extract metadata on all files (ignore cache)</span>
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-zinc-900 pt-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsScanModalOpen(false)} className="h-7 text-xs">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="h-7 gap-1.5 bg-blue-600 text-xs text-white hover:bg-blue-500">
                            {isSubmitting ? <Icon icon="loading" className="h-3.5 w-3.5" /> : <Icon icon="play" className="h-3.5 w-3.5" />}
                            <span>Start Ingestion</span>
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
