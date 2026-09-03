'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/Dialog';

export interface FolderItemInfo {
    directory: string;
    count: number;
    modifiedCount: number;
}

interface FolderRemoveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: FolderItemInfo | null;
    onConfirm: (directory: string, syncBeforeDelete: boolean) => Promise<void>;
}

/**
 * Confirmation dialog for removing a scanned folder and its tracks from the database.
 * Prompts user to sync or discard if metadata was modified after scan.
 */
export function FolderRemoveDialog({
    open,
    onOpenChange,
    folder,
    onConfirm,
}: FolderRemoveDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!folder) return null;

    const hasModifications = folder.modifiedCount > 0;

    const handleAction = async (syncBeforeDelete: boolean) => {
        setIsSubmitting(true);
        setError(null);
        try {
            await onConfirm(folder.directory, syncBeforeDelete);
            onOpenChange(false);
        } catch (err) {
            console.error('Error removing folder:', err);
            setError(err instanceof Error ? err.message : 'Failed to remove folder from database.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div
                            className={`flex size-8 items-center justify-center rounded-full border ${
                                hasModifications
                                    ? 'border-warning/30 bg-warning/10 text-warning'
                                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                            }`}>
                            <Icon icon={hasModifications ? 'warning' : 'trash'} className="size-4" />
                        </div>
                        <div>
                            <DialogTitle>
                                {hasModifications ? 'Unsynced Changes Detected' : 'Remove Folder from Database'}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {hasModifications
                                    ? 'Choose how to handle your modified metadata'
                                    : 'Clears tracks from the workstation database only'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <DialogClose disabled={isSubmitting} />

                <DialogBody className="space-y-3 pt-2 text-xs">
                    <div className="border-border bg-muted/30 rounded-md border p-2.5">
                        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                            <span className="font-semibold uppercase tracking-wider">Target Directory</span>
                            <Badge variant="outline" size="xs">
                                {folder.count} {folder.count === 1 ? 'track' : 'tracks'}
                            </Badge>
                        </div>
                        <div className="text-foreground mt-1 truncate font-mono text-xs font-medium" title={folder.directory}>
                            {folder.directory}
                        </div>
                    </div>

                    {hasModifications ? (
                        <div className="border-warning/30 bg-warning/10 text-warning-foreground space-y-2 rounded-md border p-3">
                            <div className="flex items-center gap-1.5 font-semibold text-warning">
                                <Icon icon="warning" className="size-4 shrink-0" />
                                <span>{folder.modifiedCount} modified track(s) in this folder</span>
                            </div>
                            <p className="text-muted-foreground text-[11px] leading-relaxed">
                                You modified tags or lyrics in the workstation after scanning. These changes currently only exist in the database and have not been written to the audio files.
                            </p>
                            <div className="text-muted-foreground border-warning/20 border-t pt-2 text-[11px] leading-relaxed">
                                <p className="mb-1">
                                    <strong>Sync to Local Files:</strong> Writes your modified tags into the physical audio files on disk via ExifTool before purging the database records.
                                </p>
                                <p>
                                    <strong>Remove Permanently:</strong> Discards your tag changes and permanently clears the database records. Your physical audio files remain untouched.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="border-border bg-card/60 text-muted-foreground space-y-1.5 rounded-md border p-3 leading-relaxed">
                            <p className="text-foreground font-medium">Safe Local Database Action</p>
                            <p className="text-[11px]">
                                This will remove all <strong>{folder.count}</strong> track entries from the MetaTagStudio database. Your local audio files on disk will <strong>NOT</strong> be deleted.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-2 text-xs">
                            {error}
                        </div>
                    )}
                </DialogBody>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>

                    {hasModifications ? (
                        <>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={isSubmitting}
                                onClick={() => handleAction(false)}
                                className="gap-1.5">
                                <Icon icon="trash" className="size-3.5" />
                                <span>Remove Permanently</span>
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={isSubmitting}
                                onClick={() => handleAction(true)}
                                className="gap-1.5">
                                <Icon icon={isSubmitting ? 'loading' : 'save'} className="size-3.5" />
                                <span>Sync to Local Files & Remove</span>
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => handleAction(false)}
                            className="gap-1.5">
                            <Icon icon={isSubmitting ? 'loading' : 'trash'} className="size-3.5" />
                            <span>Remove from Database</span>
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default FolderRemoveDialog;
