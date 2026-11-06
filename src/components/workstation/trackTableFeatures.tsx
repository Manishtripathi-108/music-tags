'use client';

import type { SortingState } from '@tanstack/react-table';
import {
    createColumnHelper,
    createSortedRowModel,
    flexRender,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_basic,
    sortFn_text,
    tableFeatures,
} from '@tanstack/react-table';

import Badge from '@/components/ui/Badge';
import { InlineTableCellEditable } from '@/components/ui/Editable';
import { Icon } from '@/components/ui/Icon';
import { formatDuration } from '@/domain/media/formatters';
import { type Track } from '@/domain/media/track';
import { InlineEditSchemas } from '@/schemas';

export type TrackTableMeta = {
    updateTrackInline: (id: string, fields: Partial<Track>) => void;
    activeTrackId: string | null;
    selectedTrackIds: Set<string>;
};

export const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: {
        alphanumeric: sortFn_alphanumeric,
        text: sortFn_text,
        basic: sortFn_basic,
    },
    tableMeta: {} as TrackTableMeta,
});

const col = createColumnHelper<typeof features, Track>();

function validateAndCommit(meta: TrackTableMeta, trackId: string, field: keyof typeof InlineEditSchemas, rawValue: string) {
    const result = InlineEditSchemas[field].safeParse(rawValue);

    if (!result.success) {
        return;
    }

    const value = result.data as string;

    if (field === 'year') {
        const year = parseInt(value, 10);
        meta.updateTrackInline(trackId, { year: isNaN(year) ? null : year });
        return;
    }

    if (field === 'bpm') {
        const bpm = parseFloat(value);
        meta.updateTrackInline(trackId, { bpm: isNaN(bpm) ? null : bpm });
        return;
    }

    meta.updateTrackInline(trackId, { [field]: value });
}

export const columns = col.columns([
    col.accessor('trackNumber', {
        id: 'trackNumber',
        header: '#',
        enableSorting: false,
        cell: ({ getValue, table, row }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;
            const value = getValue();

            return value != null ? (
                <span className={isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'}>{value.toString().padStart(2, '0')}</span>
            ) : (
                <span className="text-[10px] opacity-40">-</span>
            );
        },
    }),

    col.accessor('title', {
        id: 'title',
        header: 'TITLE (DBL-CLICK TO EDIT)',
        sortFn: 'text',
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;
            const track = row.original;
            const isLrc = track.lyricsType === 'synced' || /\[\d{2}:\d{2}/.test(track.lyrics || '');
            const hasLyrics = Boolean(track.lyrics);

            return (
                <div className="flex min-w-37.5 flex-1 items-center gap-1.5 truncate px-2">
                    <Icon
                        icon={track.hasCoverArt ? 'gallery' : 'galleryRemove'}
                        className={`h-3 w-3 shrink-0 ${
                            isActive ? 'text-primary-foreground' : track.hasCoverArt ? 'text-success' : 'text-destructive'
                        }`}
                    />

                    {hasLyrics && (
                        <span
                            title={isLrc ? 'Synced Lyrics (LRC)' : 'Unsynced Lyrics'}
                            className={`shrink-0 rounded px-1 py-0.5 font-mono text-[9px] leading-none ${
                                isLrc
                                    ? isActive
                                        ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 border'
                                        : 'bg-primary/15 text-primary border-primary/20 border'
                                    : isActive
                                      ? 'bg-primary-foreground/10 text-primary-foreground/80'
                                      : 'bg-muted text-muted-foreground border-border border'
                            }`}>
                            {isLrc ? 'LRC' : 'TXT'}
                        </span>
                    )}

                    {track.scanError && (
                        <span
                            title={`Scan Error: ${track.scanError}`}
                            className="bg-destructive/15 text-destructive border-destructive/30 shrink-0 cursor-help rounded border px-1 py-0.5 font-mono text-[9px] font-semibold leading-none">
                            ERR
                        </span>
                    )}

                    {track.isCorrupt && (
                        <span
                            title="Corrupt or unreadable audio stream"
                            className="bg-destructive text-destructive-foreground shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-semibold leading-none">
                            CORRUPT
                        </span>
                    )}

                    {track.isMissing && (
                        <span
                            title="File missing from filesystem"
                            className="bg-destructive/20 text-destructive border-destructive/40 shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] leading-none">
                            MISSING
                        </span>
                    )}

                    {track.isLocked && (
                        <span
                            title="File is currently locked or in use"
                            className="bg-warning/20 text-warning border-warning/30 shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] leading-none">
                            LOCKED
                        </span>
                    )}

                    {track.isReadOnly && (
                        <span
                            title="Read-only file permissions"
                            className="bg-muted text-muted-foreground border-border shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] leading-none">
                            RO
                        </span>
                    )}

                    {track.isSymlink && (
                        <span
                            title="Symbolic link"
                            className="bg-primary/10 text-primary border-primary/20 shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] leading-none">
                            LINK
                        </span>
                    )}

                    {(track.scanStatus === 'PENDING' || track.scanStatus === 'INCOMPLETE') && (
                        <span
                            title={`Scan Status: ${track.scanStatus}`}
                            className="bg-secondary text-secondary-foreground border-border shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] leading-none">
                            SCAN
                        </span>
                    )}

                    <InlineTableCellEditable
                        required
                        defaultValue={getValue() || ''}
                        placeholder="Unknown Title"
                        onValueCommit={(v) => validateAndCommit(meta, track.id, 'title', v.value)}
                        isActiveRow={isActive}
                    />
                </div>
            );
        },
    }),

    col.accessor('artist', {
        id: 'artist',
        header: 'ARTIST',
        sortFn: 'text',
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;

            return (
                <InlineTableCellEditable
                    defaultValue={getValue() || ''}
                    placeholder="Unknown Artist"
                    onValueCommit={(v) => validateAndCommit(meta, row.original.id, 'artist', v.value)}
                    isActiveRow={isActive}
                />
            );
        },
    }),

    col.accessor('album', {
        id: 'album',
        header: 'ALBUM',
        sortFn: 'text',
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;

            return (
                <InlineTableCellEditable
                    defaultValue={getValue() || ''}
                    placeholder="Unknown Album"
                    onValueCommit={(v) => validateAndCommit(meta, row.original.id, 'album', v.value)}
                    isActiveRow={isActive}
                />
            );
        },
    }),

    col.accessor('year', {
        id: 'year',
        header: 'YEAR',
        sortFn: 'basic',
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;
            const value = getValue();

            return (
                <InlineTableCellEditable
                    defaultValue={value ? String(value) : ''}
                    placeholder="-"
                    onValueCommit={(v) => validateAndCommit(meta, row.original.id, 'year', v.value)}
                    isActiveRow={isActive}
                    previewClassName="text-center"
                    inputClassName="text-center"
                />
            );
        },
    }),

    col.accessor('bpm', {
        id: 'bpm',
        header: 'BPM',
        sortFn: 'basic',
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;
            const value = getValue();

            return (
                <InlineTableCellEditable
                    defaultValue={value ? String(Math.round(value)) : ''}
                    placeholder="-"
                    onValueCommit={(v) => validateAndCommit(meta, row.original.id, 'bpm', v.value)}
                    isActiveRow={isActive}
                    previewClassName="text-center"
                    inputClassName="text-center"
                />
            );
        },
    }),

    col.accessor('initialKey', {
        id: 'initialKey',
        header: 'KEY',
        enableSorting: false,
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;

            return <span className={isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'}>{getValue() || '-'}</span>;
        },
    }),

    col.display({
        id: 'format',
        header: 'FORMAT',
        cell: ({ row, table }) => {
            const track = row.original;
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === track.id;

            return (
                <Badge
                    variant={isActive ? 'outline' : track.lossless ? 'success' : 'muted'}
                    size="xs"
                    className={`px-1 py-0 text-[9px] ${isActive ? 'border-foreground' : ''}`}>
                    {track.codec ? track.codec.toUpperCase() : track.extension.replace('.', '').toUpperCase()}
                </Badge>
            );
        },
    }),

    col.accessor('bitDepth', {
        id: 'bitDepth',
        header: 'BIT',
        sortFn: 'basic',
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;
            const depth = getValue();

            return (
                <span
                    className={`font-mono text-[10px] ${
                        isActive ? 'text-primary-foreground/90' : depth && depth > 16 ? 'text-primary font-semibold' : 'text-muted-foreground'
                    }`}>
                    {depth ? `${depth}-bit` : '-'}
                </span>
            );
        },
    }),

    col.accessor('durationSeconds', {
        id: 'durationSeconds',
        header: 'TIME',
        sortFn: 'basic',
        cell: ({ getValue, row, table }) => {
            const meta = table.options.meta as TrackTableMeta;
            const isActive = meta.activeTrackId === row.original.id;

            return <span className={isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'}>{formatDuration(getValue())}</span>;
        },
    }),
]);

export { flexRender };
export type { SortingState };
