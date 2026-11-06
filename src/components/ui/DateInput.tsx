'use client';

import * as React from 'react';
import { useMemo } from 'react';

import { DateInput as ArkDateInput } from '@ark-ui/react/date-input';
import { LocaleProvider } from '@ark-ui/react/locale';
import { type DateValue } from '@internationalized/date';

import Icon from '@/components/ui/Icon';
import { calendarDateToDate, dateToCalendarDate } from '@/domain/media/date';

import { cn } from './cn';
import { FIELD_CONTROL_STYLES } from './tailwind.helpers';

export function DateInputRoot({ ref, className, ...props }: React.ComponentProps<typeof ArkDateInput.Root>) {
    return (
        <ArkDateInput.Root
            {...props}
            ref={ref}
            className={cn('group relative flex w-full flex-col gap-1 text-xs', 'data-disabled:opacity-60', className)}
        />
    );
}

export function DateInputLabel({ ref, className, ...props }: React.ComponentProps<typeof ArkDateInput.Label>) {
    return (
        <ArkDateInput.Label
            {...props}
            ref={ref}
            className={cn(
                'text-muted-foreground',
                'flex items-center gap-1',
                'font-mono text-[11px] font-semibold',
                'select-none',
                'group-data-disabled:cursor-not-allowed',
                'group-data-invalid:text-destructive',
                className
            )}
        />
    );
}

export function DateInputControl({ ref, className, ...props }: React.ComponentProps<typeof ArkDateInput.Control>) {
    return (
        <ArkDateInput.Control
            {...props}
            ref={ref}
            className={cn('relative isolate flex w-full items-center', 'group-data-invalid:text-destructive', className)}
        />
    );
}

export function DateInputSegmentGroup({ ref, className, ...props }: React.ComponentProps<typeof ArkDateInput.SegmentGroup>) {
    return (
        <ArkDateInput.SegmentGroup
            {...props}
            ref={ref}
            className={cn(
                FIELD_CONTROL_STYLES,
                'flex items-center gap-0.5 font-mono select-none',
                className
            )}
        />
    );
}

export function DateInputSegment({ ref, className, ...props }: React.ComponentProps<typeof ArkDateInput.Segment>) {
    return (
        <ArkDateInput.Segment
            {...props}
            ref={ref}
            className={cn(
                'inline-flex items-center justify-center',
                'rounded-xs px-0.5 text-center font-mono tabular-nums',
                'caret-transparent outline-hidden transition-colors duration-75',
                'focus:bg-primary focus:text-primary-foreground',
                'data-[type=literal]:px-0 data-[type=literal]:text-muted-foreground/70 data-[type=literal]:select-none',
                'data-placeholder-shown:text-muted-foreground/50',
                className
            )}
        />
    );
}

export interface DateInputFieldProps {
    label?: React.ReactNode;
    value?: Date | null;
    onChange?: (val: Date | null) => void;
    onBlur?: () => void;
    onYearDerive?: (year: number) => void;
    error?: string;
    disabled?: boolean;
    readOnly?: boolean;
    className?: string;
}

/**
 * Production-ready Date Input using Ark UI and @internationalized/date.
 * Strictly accepts a Date | null and calls onChange with a Date | null.
 * Uses `en-GB` locale to render segments strictly as `dd/mm/yyyy`.
 */
export function DateInputField({
    label,
    value,
    onChange,
    onBlur,
    onYearDerive,
    error,
    disabled,
    readOnly,
    className,
}: DateInputFieldProps) {
    const calendarDate = useMemo(() => {
        if (!value || !(value instanceof Date) || isNaN(value.getTime())) return null;
        return dateToCalendarDate(value);
    }, [value]);

    const arkValue = useMemo<DateValue[]>(() => {
        return calendarDate ? [calendarDate] : [];
    }, [calendarDate]);

    const handleValueChange = (details: { value: DateValue[]; valueAsString: string[] }) => {
        if (details.value.length > 0 && details.value[0]) {
            const cal = details.value[0];
            const date = calendarDateToDate(cal);
            onChange?.(date);
            if (date) {
                onYearDerive?.(cal.year);
            }
        } else {
            onChange?.(null);
        }
    };

    return (
        <LocaleProvider locale="en-GB">
            <DateInputRoot
                value={arkValue}
                onValueChange={handleValueChange}
                disabled={disabled}
                readOnly={readOnly}
                invalid={!!error}
                className={className}>
                {label && <DateInputLabel>{label}</DateInputLabel>}

                <DateInputControl onBlur={onBlur}>
                    <DateInputSegmentGroup>
                        <ArkDateInput.SegmentContext>
                            {(segment) => <DateInputSegment segment={segment} key={segment.type} />}
                        </ArkDateInput.SegmentContext>
                    </DateInputSegmentGroup>
                </DateInputControl>

                <ArkDateInput.HiddenInput />

                {error && (
                    <div
                        role="alert"
                        title={error}
                        className={cn(
                            'text-destructive',
                            'flex items-center gap-1',
                            'font-mono text-[10px] leading-tight font-medium'
                        )}>
                        <Icon icon="warning" aria-hidden="true" className="size-2.5 shrink-0" />
                        <span className="min-w-0 truncate">{error}</span>
                    </div>
                )}
            </DateInputRoot>
        </LocaleProvider>
    );
}
