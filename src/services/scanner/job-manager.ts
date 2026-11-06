import crypto from 'crypto';

import { type ScanProgressEvent } from '@/domain/scanner/types';

export interface ScanJobState {
    controller: AbortController;
    listeners: Set<(evt: ScanProgressEvent) => void>;
    lastEvent?: ScanProgressEvent;
}

/**
 * Manages background scan jobs, AbortController lifecycle, and progress event listeners.
 */
export class ScanJobManager {
    private activeJobs = new Map<string, ScanJobState>();

    public createJob(): string {
        const jobId = crypto.randomUUID();
        this.activeJobs.set(jobId, {
            controller: new AbortController(),
            listeners: new Set(),
        });
        return jobId;
    }

    public subscribe(jobId: string, listener: (evt: ScanProgressEvent) => void): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners.add(listener);
            // Replay the latest progress event immediately to avoid race conditions
            if (job.lastEvent) {
                try {
                    listener(job.lastEvent);
                } catch (err) {
                    console.error(`[ScanJobManager] Error in initial event replay for job ${jobId}:`, err);
                }
            }
        }
    }

    public hasJob(jobId: string): boolean {
        return this.activeJobs.has(jobId);
    }

    public unsubscribe(jobId: string, listener: (evt: ScanProgressEvent) => void): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners.delete(listener);
        }
    }

    public cancelJob(jobId: string): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.controller.abort();
        }
    }

    public isAborted(jobId: string): boolean {
        const job = this.activeJobs.get(jobId);
        return Boolean(job?.controller.signal.aborted);
    }

    public getSignal(jobId: string): AbortSignal | undefined {
        return this.activeJobs.get(jobId)?.controller.signal;
    }

    public emit(jobId: string, event: ScanProgressEvent): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.lastEvent = event;
            job.listeners.forEach((fn) => {
                try {
                    fn(event);
                } catch (err) {
                    console.error(`[ScanJobManager] Error in event listener for job ${jobId}:`, err);
                }
            });
        }
    }

    public cleanup(jobId: string): void {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners.clear();
            this.activeJobs.delete(jobId);
        }
    }
}
