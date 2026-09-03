import IconSet from '@/constants/icons.constants';
import { type BinaryStatus, type BinaryVerificationResult } from '@/infrastructure/media-tools/binary-status';

export type T_IconType = keyof typeof IconSet;
export type { BinaryStatus, BinaryVerificationResult };

export type MediaStatusResponse = {
    binaries: BinaryVerificationResult;
    stats?: {
        totalTracks: number;
    };
    allReady: boolean;
};
