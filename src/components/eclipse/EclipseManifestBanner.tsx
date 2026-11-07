'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useEclipseStore } from '@/store/eclipseStore';

export function EclipseManifestBanner() {
    const { manifest, settingsValues, updateSetting } = useEclipseStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (!manifest) return null;

    const hasSettings = Array.isArray(manifest.settings) && manifest.settings.length > 0;

    return (
        <div className="bg-card/40 border-b p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Addon Identity */}
                <div className="flex items-center gap-3 min-w-0">
                    {manifest.icon ? (
                        <img
                            src={manifest.icon}
                            alt=""
                            className="size-10 rounded-lg object-cover border border-border/80 bg-background shrink-0"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                            <Icon icon="audio" className="size-5" />
                        </div>
                    )}

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm font-bold text-foreground truncate">{manifest.name}</h2>
                            <Badge variant="outline" size="xs" className="font-mono text-[10px]">
                                v{manifest.version}
                            </Badge>
                            {manifest.contentType && (
                                <Badge
                                    variant="secondary"
                                    size="xs"
                                    className="font-mono text-[10px] capitalize bg-purple-500/10 text-purple-400 border-purple-500/20"
                                >
                                    {manifest.contentType}
                                </Badge>
                            )}
                        </div>

                        {manifest.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xl">{manifest.description}</p>
                        )}
                    </div>
                </div>

                {/* Resources & Settings Trigger */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="hidden sm:flex items-center gap-1">
                        {manifest.resources.map((res) => (
                            <Badge key={res} variant="outline" size="xs" className="text-[10px] uppercase font-mono text-muted-foreground">
                                {res}
                            </Badge>
                        ))}
                    </div>

                    {hasSettings && (
                        <Button
                            variant={isSettingsOpen ? 'secondary' : 'outline'}
                            size="xs"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="h-7 gap-1 text-xs font-semibold"
                        >
                            <Icon icon="settings" className="size-3" />
                            <span>Addon Settings ({manifest.settings!.length})</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Dynamic Addon Settings Panel */}
            {isSettingsOpen && hasSettings && (
                <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-lg">
                    {manifest.settings!.map((setting) => {
                        const currentValue = settingsValues[setting.key] ?? setting.default ?? '';

                        return (
                            <div key={setting.key} className="space-y-1">
                                <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                                    <span>{setting.label}</span>
                                    {setting.perNetwork && (
                                        <span className="text-[9px] text-muted-foreground font-mono">Per-Network</span>
                                    )}
                                </label>

                                {setting.type === 'select' && setting.options && (
                                    <select
                                        value={String(currentValue)}
                                        onChange={(e) => updateSetting(setting.key, e.target.value)}
                                        className="bg-background text-foreground text-xs rounded border px-2 py-1 w-full focus:outline-hidden focus:ring-1 focus:ring-primary"
                                    >
                                        {setting.options.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {setting.type === 'toggle' && (
                                    <div className="flex items-center gap-2 h-7">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(currentValue)}
                                            onChange={(e) => updateSetting(setting.key, e.target.checked)}
                                            className="cursor-pointer rounded"
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {currentValue ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                )}

                                {setting.type === 'text' && (
                                    <input
                                        type="text"
                                        value={String(currentValue)}
                                        maxLength={setting.maxLength}
                                        placeholder={setting.placeholder}
                                        onChange={(e) => updateSetting(setting.key, e.target.value)}
                                        className="bg-background text-foreground text-xs rounded border px-2 py-1 w-full focus:outline-hidden focus:ring-1 focus:ring-primary"
                                    />
                                )}

                                {setting.type === 'number' && (
                                    <input
                                        type="number"
                                        value={Number(currentValue)}
                                        min={setting.min}
                                        max={setting.max}
                                        step={setting.step}
                                        onChange={(e) => updateSetting(setting.key, parseFloat(e.target.value))}
                                        className="bg-background text-foreground text-xs rounded border px-2 py-1 w-full focus:outline-hidden focus:ring-1 focus:ring-primary"
                                    />
                                )}

                                {setting.help && (
                                    <p className="text-[10px] text-muted-foreground leading-tight">{setting.help}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
