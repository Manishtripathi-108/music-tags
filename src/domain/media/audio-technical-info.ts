/**
 * Technical audio specifications of an audio stream or file.
 */
export interface AudioTechnicalInfo {
    durationSeconds?: number;
    bitrateKbps?: number;
    sampleRateHz?: number;
    channels?: number;
    channelLayout?: string;
    bitDepth?: number;
    codec?: string;
    lossless?: boolean;
}
