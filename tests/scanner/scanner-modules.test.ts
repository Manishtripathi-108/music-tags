import { describe, it, expect, vi } from 'vitest';
import { ScanJobManager } from '@/services/scanner/job-manager';
import { DirectoryCrawler } from '@/infrastructure/filesystem/directory-crawler';
import path from 'path';

describe('ScanJobManager', () => {
    it('creates unique jobs with AbortController and signals', () => {
        const manager = new ScanJobManager();
        const jobId = manager.createJob();

        expect(typeof jobId).toBe('string');
        expect(manager.isAborted(jobId)).toBe(false);

        const signal = manager.getSignal(jobId);
        expect(signal).toBeDefined();
        expect(signal?.aborted).toBe(false);

        manager.cancelJob(jobId);
        expect(manager.isAborted(jobId)).toBe(true);
        expect(signal?.aborted).toBe(true);
    });

    it('subscribes and emits events using Set-based listener storage', () => {
        const manager = new ScanJobManager();
        const jobId = manager.createJob();

        const listenerA = vi.fn();
        const listenerB = vi.fn();

        manager.subscribe(jobId, listenerA);
        manager.subscribe(jobId, listenerB);

        // Subscribing same listener twice should be deduplicated by Set
        manager.subscribe(jobId, listenerA);

        manager.emit(jobId, {
            jobId,
            status: 'SCANNING',
            scannedFiles: 10,
            indexedFiles: 10,
            extractedFiles: 0,
            totalEstimated: 10,
            filesPerSecond: 5,
        });

        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(listenerB).toHaveBeenCalledTimes(1);

        manager.unsubscribe(jobId, listenerA);
        manager.emit(jobId, {
            jobId,
            status: 'COMPLETED',
            scannedFiles: 10,
            indexedFiles: 10,
            extractedFiles: 10,
            totalEstimated: 10,
            filesPerSecond: 0,
        });

        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(listenerB).toHaveBeenCalledTimes(2);

        manager.cleanup(jobId);
        expect(manager.getSignal(jobId)).toBeUndefined();
    });
});

describe('DirectoryCrawler', () => {
    it('traverses existing directories and ignores non-audio extensions', async () => {
        const crawler = new DirectoryCrawler();
        const discovered = await crawler.crawl({
            rootPath: path.resolve(process.cwd(), 'tests'),
            recursive: true,
        });

        // The tests/ directory contains only .ts and .json test files, so discovered audio should be 0
        expect(discovered.length).toBe(0);
    });

    it('aborts crawling immediately when signal is aborted', async () => {
        const crawler = new DirectoryCrawler();
        const controller = new AbortController();
        controller.abort();

        const discovered = await crawler.crawl({
            rootPath: path.resolve(process.cwd()),
            recursive: true,
            signal: controller.signal,
        });

        expect(discovered.length).toBe(0);
    });
});
