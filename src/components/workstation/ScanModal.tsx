'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Field, FieldError, FieldInput, FieldLabel, FieldRequiredIndicator } from '@/components/ui/Field';
import { Fieldset, FieldsetContent, FieldsetLegend } from '@/components/ui/Fieldset';
import { Checkbox } from '@/components/ui/Checkbox';
import axios from 'axios';
import { useAudioStore } from '@/store/audioStore';
import { type ScanFolderRequest, ScanFolderRequestSchema } from '@/domain/media/schemas';
import { type ScanApiResponse } from '@/domain/media/dto';

export function ScanModal() {
    const { isScanModalOpen, setIsScanModalOpen, setActiveScanJob, fetchTracks } = useAudioStore();

    const {
        register,
        handleSubmit,
        reset,
        control,
        setError,
        clearErrors,
        formState: { errors, isSubmitting },
    } = useForm<ScanFolderRequest>({
        resolver: zodResolver(ScanFolderRequestSchema),
        defaultValues: {
            folderPath: '',
            recursive: true,
            forceReindex: false,
        },
    });

    const onSubmit = async (values: ScanFolderRequest) => {
        clearErrors('root.serverError');

        try {
            setIsScanModalOpen(false);
            reset();

            setActiveScanJob({
                status: 'SCANNING',
                scannedFiles: 0,
                extractedFiles: 0,
                totalEstimated: 0,
                filesPerSecond: 0,
                currentDirectory: values.folderPath,
            });

            const { data } = await axios.post<ScanApiResponse>('/api/scan', values);
            if (data.jobId) {
                const eventSource = new EventSource(`/api/scan?jobId=${data.jobId}`);
                eventSource.onmessage = (event) => {
                    try {
                        const progress = JSON.parse(event.data);
                        setActiveScanJob(progress);
                        if (progress.status === 'COMPLETED' || progress.status === 'FAILED' || progress.status === 'CANCELLED') {
                            eventSource.close();
                            fetchTracks();
                        }
                    } catch {}
                };
                eventSource.onerror = () => {
                    eventSource.close();
                    fetchTracks();
                };
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError('root.serverError', {
                type: 'server',
                message: msg,
            });
        }
    };

    return (
        <Dialog open={isScanModalOpen} onOpenChange={(details) => setIsScanModalOpen(details.open)}>
            <DialogContent className="border-border bg-card text-card-foreground max-w-md shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                        <Icon icon="folderWithFiles" className="text-primary h-4 w-4" />
                        <span>Scan Music Directory</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                        Select a local folder on your PC to scan and index audio files with ExifTool & FFprobe.
                    </DialogDescription>
                </DialogHeader>

                <DialogBody>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <Fieldset className="border-border bg-muted/30 p-3">
                            <FieldsetLegend className="text-foreground text-[10px]">
                                <Icon icon="folderOpen" className="text-primary size-3" />
                                Directory Target
                            </FieldsetLegend>
                            <FieldsetContent>
                                <Field invalid={!!errors.folderPath}>
                                    <FieldLabel className="text-foreground text-[11px] font-semibold">
                                        Absolute Folder Path <FieldRequiredIndicator />
                                    </FieldLabel>
                                    <FieldInput
                                        type="text"
                                        placeholder="e.g. C:\Music or E:\AudioLibrary"
                                        className="mt-1 font-mono text-xs"
                                        {...register('folderPath')}
                                    />
                                    <FieldError className="mt-1">{errors.folderPath?.message || errors.root?.serverError.message}</FieldError>
                                </Field>
                            </FieldsetContent>
                        </Fieldset>

                        <Fieldset className="border-border bg-muted/30 p-3">
                            <FieldsetLegend className="text-foreground text-[10px]">
                                <Icon icon="scanner" className="text-primary size-3" />
                                Scan Options
                            </FieldsetLegend>
                            <FieldsetContent className="space-y-3 pt-1">
                                <Controller
                                    control={control}
                                    name="recursive"
                                    render={({ field }) => (
                                        <Field>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(details) => field.onChange(!!details.checked)}
                                                name={field.name}
                                                inputRef={field.ref}
                                                label="Scan subfolders recursively"
                                                description="Traverse nested directories to discover all audio tracks"
                                            />
                                        </Field>
                                    )}
                                />

                                <Controller
                                    control={control}
                                    name="forceReindex"
                                    render={({ field }) => (
                                        <Field>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(details) => field.onChange(!!details.checked)}
                                                name={field.name}
                                                inputRef={field.ref}
                                                label="Force re-extract metadata on all files"
                                                description="Bypass cached analysis and re-read tags with ExifTool & FFprobe"
                                            />
                                        </Field>
                                    )}
                                />
                            </FieldsetContent>
                        </Fieldset>

                        <div className="border-border flex items-center justify-end gap-2 border-t pt-3">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsScanModalOpen(false)} className="h-7 text-xs">
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting} className="h-7 gap-1.5 text-xs">
                                {isSubmitting ? <Icon icon="loading" className="h-3.5 w-3.5" /> : <Icon icon="play" className="h-3.5 w-3.5" />}
                                <span>Start Ingestion</span>
                            </Button>
                        </div>
                    </form>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}
