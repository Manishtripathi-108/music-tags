import crypto from 'crypto';
import { type ScanProgressEvent } from '@/domain/scanner/types';

export interface ScanJobState {
    abort: boolean;
    listeners: ((evt: ScanProgressEvent) => void)[];
}

/**
 * Manages background scan jobs, cancellation tokens, and progress event listeners.
 */
export class ScanJobManager {
    private activeJobs = new Map<string, ScanJobState>();

    public createJob(): string {
        const jobId = crypto.randomUUID();
        this.activeJobs.set(jobId, { abort: false, listeners: [] });
        return jobId;
    }

    public subscribe(jobId: string, listener: (evt: ScanProgressEvent) => void): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners.push(listener);
        }
    }

    public unsubscribe(jobId: string, listener: (evt: ScanProgressEvent) => void): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners = job.listeners.filter((fn) => fn !== listener);
        }
    }

    public cancelJob(jobId: string): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.abort = true;
        }
    }

    public isAborted(jobId: string): boolean {
        return Boolean(this.activeJobs.get(jobId)?.abort);
    }

    public emit(jobId: string, event: ScanProgressEvent): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners.forEach((fn) => fn(event));
        }
    }

    public cleanup(jobId: string): void {
        this.activeJobs.delete(jobId);
    }
}
