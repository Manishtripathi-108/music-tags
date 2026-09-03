import { z } from 'zod';

export const ScanFolderRequestSchema = z.object({
    folderPath: z.string().min(1, 'Folder path is required'),
    recursive: z.boolean(),
    forceReindex: z.boolean(),
});

export type ScanFolderRequest = z.infer<typeof ScanFolderRequestSchema>;

export const RemoveFolderRequestSchema = z.object({
    directory: z.string().min(1, 'Directory path is required'),
    syncBeforeDelete: z.boolean().default(false),
});

export type RemoveFolderRequest = z.infer<typeof RemoveFolderRequestSchema>;
