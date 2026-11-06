'use client';

import React, { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldInput, FieldLabel } from '@/components/ui/Field';
import Icon from '@/components/ui/Icon';
import { useCompareStore } from '@/store/compareStore';

export function CompareConfigPanel() {
    const {
        apiUrl,
        setApiUrl,
        downloadDirectory,
        setDownloadDirectory,
        qualityPreference,
        setQualityPreference,
        atmosPreference,
        setAtmosPreference,
        downloadMode,
        setDownloadMode,
        forceRefetch,
        setForceRefetch,
        customParams,
        setCustomParams,
        isTestingConnection,
        connectionStatus,
        testConnection,
        isSearching,
        startSequentialSearch,
        stopSequentialSearch,
        isDownloading,
        startSequentialDownload,
        stopSequentialDownload,
        selectedIds,
        items,
    } = useCompareStore();

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [customParamKey, setCustomParamKey] = useState('');
    const [customParamVal, setCustomParamVal] = useState('');

    const handleAddCustomParam = () => {
        if (!customParamKey.trim()) return;
        setCustomParams({
            ...customParams,
            [customParamKey.trim()]: customParamVal.trim(),
        });
        setCustomParamKey('');
        setCustomParamVal('');
    };

    const handleRemoveCustomParam = (key: string) => {
        const next = { ...customParams };
        delete next[key];
        setCustomParams(next);
    };

    const selectedCount = selectedIds.size;
    const upgradeCount = items.filter((i) => i.status === 'upgrade_available').length;
    const dolbyCount = items.filter((i) => i.isDolbyAvailable).length;

    return (
        <div className="border-b bg-card/40 p-3 space-y-3 select-none text-xs">
            {/* Top Row: Link and Directory inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                {/* API Link */}
                <div className="md:col-span-5 space-y-1">
                    <div className="flex items-center justify-between">
                        <FieldLabel className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Icon icon="link" className="size-3.5 text-primary" />
                            <span>API Base URL (BitChord Addon / Audio Source)</span>
                        </FieldLabel>
                        {connectionStatus && (
                            <span className={`text-[10px] font-mono ${connectionStatus.apiOk ? 'text-emerald-500' : 'text-rose-400'}`}>
                                {connectionStatus.apiOk ? '✓ Connected' : '✕ Connection error'}
                            </span>
                        )}
                    </div>
                    <FieldInput
                        type="url"
                        placeholder="e.g. https://myaddon.example.com or http://localhost:8080"
                        value={apiUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiUrl(e.target.value)}
                        className="h-8 font-mono text-xs bg-background/80"
                    />
                </div>

                {/* Destination Directory */}
                <div className="md:col-span-5 space-y-1">
                    <div className="flex items-center justify-between">
                        <FieldLabel className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Icon icon="folder" className="size-3.5 text-amber-500" />
                            <span>Download Folder (Files named by ISRC)</span>
                        </FieldLabel>
                        {connectionStatus && (
                            <span className={`text-[10px] font-mono ${connectionStatus.directoryOk ? 'text-emerald-500' : 'text-rose-400'}`}>
                                {connectionStatus.directoryOk ? '✓ Folder ready' : '✕ Check path'}
                            </span>
                        )}
                    </div>
                    <FieldInput
                        type="text"
                        placeholder="e.g. E:\Music\Upgrades or C:\Users\Downloads\HighRes"
                        value={downloadDirectory}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDownloadDirectory(e.target.value)}
                        className="h-8 font-mono text-xs bg-background/80"
                    />
                </div>

                {/* Connection Test Button */}
                <div className="md:col-span-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={testConnection}
                        disabled={isTestingConnection || !apiUrl}
                        className="w-full h-8 gap-1.5 text-xs font-mono"
                    >
                        <Icon icon={isTestingConnection ? 'loading' : 'check'} className="size-3.5" />
                        <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
                    </Button>
                </div>
            </div>

            {/* Middle Row: Query Params & Download Modes */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/50">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Quality preference */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-semibold text-[11px]">Quality:</span>
                        <select
                            value={qualityPreference}
                            onChange={(e) => setQualityPreference(e.target.value as 'max' | 'hires' | 'lossless' | 'high' | 'low')}
                            className="bg-background border border-input rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="max">Max (best available)</option>
                            <option value="hires">Hi-Res (up to 24-bit / 192 kHz)</option>
                            <option value="lossless">Lossless (16-bit / 44.1 kHz)</option>
                            <option value="high">High (AAC / 320 kbps)</option>
                            <option value="low">Low (128 kbps)</option>
                        </select>
                    </div>

                    {/* Atmos preference */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-semibold text-[11px]">Dolby Atmos:</span>
                        <select
                            value={atmosPreference}
                            onChange={(e) => setAtmosPreference(e.target.value as 'auto' | 'none')}
                            className="bg-background border border-input rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="auto">Auto (prefer Atmos when available)</option>
                            <option value="none">None (stereo only)</option>
                        </select>
                    </div>

                    {/* Download Mode Enforcement */}
                    <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded border border-border">
                        <span className="px-2 text-[10px] uppercase font-bold text-muted-foreground">Mode:</span>
                        <button
                            type="button"
                            onClick={() => setDownloadMode('highest_lossless')}
                            className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer font-medium ${
                                downloadMode === 'highest_lossless'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Downloads only highest lossless tracks. Never downloads Dolby."
                        >
                            Highest Lossless
                        </button>
                        <button
                            type="button"
                            onClick={() => setDownloadMode('dolby_atmos')}
                            className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer font-medium ${
                                downloadMode === 'dolby_atmos'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Downloads only tracks with Dolby Atmos mix. Never downloads non-Dolby."
                        >
                            Dolby Atmos
                        </button>
                    </div>

                    {/* Force Re-search Toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground text-[11px]" title="When unchecked, cached track IDs are never re-fetched">
                        <input
                            type="checkbox"
                            checked={forceRefetch}
                            onChange={(e) => setForceRefetch(e.target.checked)}
                            className="rounded border-border"
                        />
                        <span>Force re-search (bypass cache)</span>
                    </label>

                    {/* Advanced Params Button */}
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className="text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                    >
                        <Icon icon="settings" className="size-3" />
                        <span>Custom Params ({Object.keys(customParams).length})</span>
                    </Button>
                </div>

                {/* Action Buttons: Sequential Search & Download */}
                <div className="flex items-center gap-2">
                    {/* Search Actions */}
                    {isSearching ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={stopSequentialSearch}
                            className="h-8 gap-1.5 text-xs font-semibold"
                        >
                            <Icon icon="closeCircle" className="size-3.5" />
                            <span>Stop Searching</span>
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startSequentialSearch()}
                            disabled={!apiUrl || items.length === 0}
                            className="h-8 gap-1.5 text-xs font-medium"
                            title="Searches tracks one by one sequentially to avoid overwhelming the API"
                        >
                            <Icon icon="search" className="size-3.5 text-primary" />
                            <span>{selectedCount > 0 ? `Search Selected (${selectedCount})` : 'Search All Sequential'}</span>
                        </Button>
                    )}

                    {/* Download Actions */}
                    {isDownloading ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={stopSequentialDownload}
                            className="h-8 gap-1.5 text-xs font-semibold"
                        >
                            <Icon icon="closeCircle" className="size-3.5" />
                            <span>Stop Download</span>
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => startSequentialDownload()}
                            disabled={!apiUrl || !downloadDirectory || items.length === 0}
                            className={`h-8 gap-1.5 text-xs font-semibold ${
                                downloadMode === 'dolby_atmos' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
                            }`}
                            title={`Downloads ${downloadMode === 'highest_lossless' ? 'lossless' : 'Dolby'} files sequentially without adding metadata`}
                        >
                            <Icon icon="download" className="size-3.5" />
                            <span>
                                {selectedCount > 0
                                    ? `Download Selected (${selectedCount})`
                                    : downloadMode === 'highest_lossless'
                                    ? `Download Lossless (${upgradeCount})`
                                    : `Download Atmos (${dolbyCount})`}
                            </span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Collapsible Advanced Custom Parameters */}
            {isAdvancedOpen && (
                <div className="p-2.5 rounded bg-background/50 border border-border/60 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                        <span>Custom Query Parameters (Sent with every search request)</span>
                        <span className="text-[10px] font-mono">e.g. region=US, explicit=true</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <FieldInput
                            type="text"
                            placeholder="Key (e.g. region)"
                            value={customParamKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomParamKey(e.target.value)}
                            className="h-7 w-40 text-xs font-mono"
                        />
                        <FieldInput
                            type="text"
                            placeholder="Value (e.g. US)"
                            value={customParamVal}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomParamVal(e.target.value)}
                            className="h-7 w-40 text-xs font-mono"
                        />
                        <Button variant="outline" size="xs" onClick={handleAddCustomParam} className="h-7 px-2">
                            Add Param
                        </Button>
                    </div>

                    {Object.keys(customParams).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {Object.entries(customParams).map(([k, v]) => (
                                <Badge key={k} variant="secondary" size="sm" className="gap-1 font-mono text-[10px]">
                                    <span>{k}={v}</span>
                                    <button
                                        onClick={() => handleRemoveCustomParam(k)}
                                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        ×
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
