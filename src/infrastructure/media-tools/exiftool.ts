import { ChildProcess, spawn } from 'child_process';
import { toCanonicalPath } from '../filesystem/paths';

interface ExifToolTask {
    args: string[];
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
    timeoutTimer?: NodeJS.Timeout;
}

export class ExifToolProcess {
    private process: ChildProcess | null = null;
    private queue: ExifToolTask[] = [];
    private isProcessing = false;
    private currentTask: ExifToolTask | null = null;
    private stdoutBuffer = '';
    private isClosing = false;

    constructor() {
        this.start();
    }

    private start() {
        if (this.process) return;

        this.process = spawn(
            'exiftool',
            ['-stay_open', 'True', '-@', '-', '-common_args', '-charset', 'filename=utf8'],
            {
                shell: false,
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            }
        );

        this.process.stdout?.setEncoding('utf-8');
        this.process.stderr?.setEncoding('utf-8');

        this.process.stdout?.on('data', (chunk: string) => {
            this.stdoutBuffer += chunk;
            const readyIndex = this.stdoutBuffer.indexOf('{ready}');
            if (readyIndex !== -1) {
                const output = this.stdoutBuffer.slice(0, readyIndex).trim();
                this.stdoutBuffer = this.stdoutBuffer.slice(readyIndex + 7);

                if (this.currentTask) {
                    if (this.currentTask.timeoutTimer) clearTimeout(this.currentTask.timeoutTimer);
                    const task = this.currentTask;
                    this.currentTask = null;
                    task.resolve(output);
                }
                this.processNext();
            }
        });

        this.process.stderr?.on('data', (errChunk: string) => {
            console.error('ExifTool stderr:', errChunk);
        });

        this.process.on('exit', (code) => {
            this.process = null;
            if (this.currentTask) {
                if (this.currentTask.timeoutTimer) clearTimeout(this.currentTask.timeoutTimer);
                this.currentTask.reject(new Error(`ExifTool process exited unexpectedly with code ${code}`));
                this.currentTask = null;
            }
            if (!this.isClosing) {
                this.start();
                this.processNext();
            }
        });

        this.process.on('error', (err) => {
            if (this.currentTask) {
                if (this.currentTask.timeoutTimer) clearTimeout(this.currentTask.timeoutTimer);
                this.currentTask.reject(err);
                this.currentTask = null;
            }
        });
    }

    public execute(args: string[], timeoutMs = 15000): Promise<string> {
        return new Promise((resolve, reject) => {
            const task: ExifToolTask = {
                args,
                resolve,
                reject,
                timeoutTimer: undefined,
            };

            this.queue.push(task);
            this.processNext(timeoutMs);
        });
    }

    private processNext(timeoutMs = 15000) {
        if (this.isProcessing || this.queue.length === 0) return;
        if (!this.process || !this.process.stdin) {
            this.start();
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift()!;
        this.currentTask = task;

        task.timeoutTimer = setTimeout(() => {
            if (this.currentTask === task) {
                task.reject(new Error('ExifTool command execution timed out'));
                this.currentTask = null;
                this.process?.kill();
            }
        }, timeoutMs);

        const payload = [...task.args, '-execute\n'].join('\n');
        this.process.stdin.write(payload, 'utf-8');
        this.isProcessing = false;
    }

    public async readMetadata(filePath: string): Promise<Record<string, unknown>> {
        const canonical = toCanonicalPath(filePath);
        const rawOutput = await this.execute(['-json', '-G', canonical]);
        if (!rawOutput) return {};
        try {
            const parsed = JSON.parse(rawOutput);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed[0];
            }
            return parsed;
        } catch {
            return {};
        }
    }

    public async readBatchMetadata(filePaths: string[]): Promise<Record<string, unknown>[]> {
        if (filePaths.length === 0) return [];
        const canonicalPaths = filePaths.map(toCanonicalPath);
        const rawOutput = await this.execute(['-json', '-G', ...canonicalPaths]);
        if (!rawOutput) return [];
        try {
            const parsed = JSON.parse(rawOutput);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [];
        }
    }

    public async writeTags(
        filePath: string,
        tags: Record<string, string | number | null>,
        preserveOriginal = true
    ): Promise<boolean> {
        const canonical = toCanonicalPath(filePath);
        const args: string[] = [];

        if (!preserveOriginal) {
            args.push('-overwrite_original');
        }

        for (const [tag, value] of Object.entries(tags)) {
            if (value === null || value === undefined) {
                args.push(`-${tag}=`);
            } else {
                args.push(`-${tag}=${value}`);
            }
        }

        args.push(canonical);
        const output = await this.execute(args);
        return output.includes('1 image files updated') || output.includes('1 files updated');
    }

    public close(): void {
        this.isClosing = true;
        if (this.process && this.process.stdin) {
            try {
                this.process.stdin.write('-stay_open\nFalse\n');
            } catch {}
        }
    }
}

let globalExifTool: ExifToolProcess | null = null;

export function getExifTool(): ExifToolProcess {
    if (!globalExifTool) {
        globalExifTool = new ExifToolProcess();
    }
    return globalExifTool;
}
