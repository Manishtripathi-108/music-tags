import IconSet from '@/constants/icons.constants';
import { BinaryStatus } from '@/core/binaries/paths';

export type T_IconType = keyof typeof IconSet;
type BinaryVerificationResult = {
    exiftool: BinaryStatus;
    ffprobe: BinaryStatus;
    ffmpeg: BinaryStatus;
    allReady: boolean;
};

export type MediaStatusResponse = {
    binaries: BinaryVerificationResult;
    stats: {
        totalTracks: number;
    };
};
