import { getExifTool, type ExifToolProcess } from './exiftool';
import { probeAudioFile, type FFprobeAudioResult } from './ffprobe';

export interface RawAudioExtractionResult {
    path: string;
    rawExif: Record<string, unknown>;
    probeResult: FFprobeAudioResult | null;
}

/**
 * Extracts raw metadata from audio files using ExifTool batch processing
 * and FFprobe audio stream probing.
 * Pure tool interface: does NOT touch database or UI state.
 */
export class AudioMetadataReader {
    private exiftool: ExifToolProcess;

    constructor(exiftoolInstance = getExifTool()) {
        this.exiftool = exiftoolInstance;
    }

    /**
     * Extracts raw metadata for a batch of file paths.
     */
    public async extractBatch(filePaths: string[]): Promise<RawAudioExtractionResult[]> {
        if (filePaths.length === 0) return [];

        const rawResults = await this.exiftool.readBatchMetadata(filePaths);
        const results: RawAudioExtractionResult[] = [];

        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const rawExif = rawResults[i] || (await this.exiftool.readMetadata(filePath));

            let probeResult: FFprobeAudioResult | null = null;
            try {
                probeResult = await probeAudioFile(filePath);
            } catch {
                probeResult = null;
            }

            results.push({
                path: filePath,
                rawExif,
                probeResult,
            });
        }

        return results;
    }
}

export const defaultAudioMetadataReader = new AudioMetadataReader();
