import { z } from 'zod';

export const ResolveDuplicatesRequestSchema = z.object({
    clusterId: z.string().optional(),
    removeTrackIds: z.array(z.string()).min(1, 'At least one track ID is required'),
    deleteFiles: z.boolean().default(false),
});

export type ResolveDuplicatesRequest = z.infer<typeof ResolveDuplicatesRequestSchema>;
