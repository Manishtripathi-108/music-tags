import { NextResponse } from 'next/server';

import { type StatusApiResponse } from '@/domain/media/dto';
import { type BinaryVerificationResult, verifyMediaBinaries } from '@/infrastructure/media-tools/binary-status';

export async function GET(): Promise<NextResponse<StatusApiResponse>> {
    try {
        const binaries = verifyMediaBinaries();
        return NextResponse.json({
            binaries,
            allReady: binaries.allReady,
        });
    } catch {
        const fallback: BinaryVerificationResult = {
            exiftool: { name: 'exiftool', found: false },
            ffprobe: { name: 'ffprobe', found: false },
            ffmpeg: { name: 'ffmpeg', found: false },
            allReady: false,
        };
        return NextResponse.json({
            binaries: fallback,
            allReady: false,
        });
    }
}
