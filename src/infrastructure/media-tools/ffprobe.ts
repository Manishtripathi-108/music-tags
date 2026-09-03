import { spawn } from 'child_process';
import { toCanonicalPath } from '../filesystem/paths';

export interface FFprobeAudioResult {
    format?: {
        filename?: string;
        nb_streams?: number;
        format_name?: string;
        format_long_name?: string;
        duration?: string;
        size?: string;
        bit_rate?: string;
        tags?: Record<string, string>;
    };
    streams?: Array<{
        index?: number;
        codec_name?: string;
        codec_long_name?: string;
        codec_type?: string;
        sample_rate?: string;
        channels?: number;
        channel_layout?: string;
        bits_per_sample?: number;
        bits_per_raw_sample?: string;
        bit_rate?: string;
        duration?: string;
        disposition?: Record<string, number>;
        tags?: Record<string, string>;
    }>;
}

export async function probeAudioFile(filePath: string, timeoutMs = 10000): Promise<FFprobeAudioResult | null> {
    return new Promise((resolve) => {
        const canonical = toCanonicalPath(filePath);
        const args = ['-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', canonical];

        const child = spawn('ffprobe', args, {
            shell: false,
            windowsHide: true,
        });

        let stdout = '';

        const timer = setTimeout(() => {
            child.kill();
            resolve(null);
        }, timeoutMs);

        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });

        child.stderr.on('data', () => {
            // Error stream captured if needed
        });

        child.on('close', (code) => {
            clearTimeout(timer);
            if (code !== 0 || !stdout.trim()) {
                resolve(null);
                return;
            }

            try {
                const parsed = JSON.parse(stdout) as FFprobeAudioResult;
                resolve(parsed);
            } catch {
                resolve(null);
            }
        });

        child.on('error', () => {
            clearTimeout(timer);
            resolve(null);
        });
    });
}
