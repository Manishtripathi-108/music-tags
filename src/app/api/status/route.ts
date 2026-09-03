import { NextResponse } from 'next/server';
import { verifyMediaBinaries } from '@/core/binaries/paths';
import { type StatusApiResponse } from '@/types/audio';

export async function GET(): Promise<NextResponse<StatusApiResponse>> {
    try {
        const status = verifyMediaBinaries();
        return NextResponse.json({
            binaries: {
                exiftool: status.exiftool,
                ffprobe: status.ffprobe,
                ffmpeg: status.ffmpeg,
            },
            allReady: status.allReady,
        });
    } catch {
        return NextResponse.json({
            binaries: {
                exiftool: { found: false },
                ffprobe: { found: false },
                ffmpeg: { found: false },
            },
            allReady: false,
        });
    }
}
