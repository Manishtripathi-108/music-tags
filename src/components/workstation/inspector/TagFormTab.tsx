'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import {
    Field,
    FieldError,
    FieldInput,
    FieldLabel,
    FieldRequiredIndicator,
    FieldTextarea,
} from '@/components/ui/Field';
import { Fieldset, FieldsetContent, FieldsetLegend } from '@/components/ui/Fieldset';
import { NumberInputField } from '@/components/ui/NumberInput';
import { type TagFormValues } from '@/domain/media/schemas';

export interface TagFormTabProps {
    onSubmit: (values: TagFormValues) => void;
    isSaved: boolean;
}

export function TagFormTab({ onSubmit, isSaved }: TagFormTabProps) {
    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isDirty, isSubmitting },
    } = useFormContext<TagFormValues>();

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-3 overflow-auto p-3 font-mono">
            <Fieldset className="border p-2.5">
                <FieldsetLegend className="text-primary text-[10px]">
                    <Icon icon="audio" className="size-3" />
                    Track Information
                </FieldsetLegend>
                <FieldsetContent className="gap-2">
                    <Field invalid={!!errors.title} required>
                        <FieldLabel>
                            Title <FieldRequiredIndicator />
                        </FieldLabel>
                        <FieldInput placeholder="Track title..." {...register('title')} />
                        <FieldError>{errors.title?.message}</FieldError>
                    </Field>

                    <div className="grid grid-cols-2 gap-2">
                        <Field invalid={!!errors.artist}>
                            <FieldLabel>Artist</FieldLabel>
                            <FieldInput placeholder="Artist name..." {...register('artist')} />
                            <FieldError>{errors.artist?.message}</FieldError>
                        </Field>
                        <Field invalid={!!errors.albumArtist}>
                            <FieldLabel>Album Artist</FieldLabel>
                            <FieldInput placeholder="Album artist..." {...register('albumArtist')} />
                            <FieldError>{errors.albumArtist?.message}</FieldError>
                        </Field>
                    </div>

                    <Field invalid={!!errors.album}>
                        <FieldLabel>Album</FieldLabel>
                        <FieldInput placeholder="Album title..." {...register('album')} />
                        <FieldError>{errors.album?.message}</FieldError>
                    </Field>

                    <div className="grid grid-cols-3 gap-2">
                        <Field invalid={!!errors.trackNumber}>
                            <FieldLabel>Track #</FieldLabel>
                            <FieldInput placeholder="1" {...register('trackNumber')} />
                            <FieldError>{errors.trackNumber?.message}</FieldError>
                        </Field>
                        <Field invalid={!!errors.year}>
                            <FieldLabel>Year</FieldLabel>
                            <FieldInput placeholder="2024" {...register('year')} />
                            <FieldError>{errors.year?.message}</FieldError>
                        </Field>
                        <Field invalid={!!errors.genre}>
                            <FieldLabel>Genre</FieldLabel>
                            <FieldInput placeholder="Genre..." {...register('genre')} />
                            <FieldError>{errors.genre?.message}</FieldError>
                        </Field>
                    </div>
                </FieldsetContent>
            </Fieldset>

            <Fieldset className="border p-2.5">
                <FieldsetLegend className="text-primary text-[10px]">
                    <Icon icon="tune" className="size-3" />
                    Musical Properties
                </FieldsetLegend>
                <FieldsetContent className="gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Controller
                            control={control}
                            name="bpm"
                            render={({ field }) => (
                                <NumberInputField
                                    label="BPM / Tempo"
                                    placeholder="128.0"
                                    min={20}
                                    max={400}
                                    step={0.5}
                                    value={field.value}
                                    onValueChange={(details) => field.onChange(details.value)}
                                    error={errors.bpm?.message}
                                />
                            )}
                        />

                        <Field invalid={!!errors.initialKey}>
                            <FieldLabel>Initial Key</FieldLabel>
                            <FieldInput placeholder="e.g. 8A, Am, C#m" {...register('initialKey')} />
                            <FieldError>{errors.initialKey?.message}</FieldError>
                        </Field>
                    </div>
                </FieldsetContent>
            </Fieldset>

            <Fieldset className="border p-2.5">
                <FieldsetLegend className="text-primary text-[10px]">
                    <Icon icon="star" className="size-3" />
                    Publishing & Rights
                </FieldsetLegend>
                <FieldsetContent className="gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Field invalid={!!errors.composer}>
                            <FieldLabel>Composer</FieldLabel>
                            <FieldInput placeholder="Composer..." {...register('composer')} />
                        </Field>
                        <Field invalid={!!errors.publisher}>
                            <FieldLabel>Publisher</FieldLabel>
                            <FieldInput placeholder="Publisher..." {...register('publisher')} />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Field invalid={!!errors.copyright}>
                            <FieldLabel>Copyright</FieldLabel>
                            <FieldInput placeholder="© 2024..." {...register('copyright')} />
                        </Field>
                        <Field invalid={!!errors.isrc}>
                            <FieldLabel>ISRC</FieldLabel>
                            <FieldInput placeholder="US-XXX-24-00001" {...register('isrc')} />
                        </Field>
                    </div>
                </FieldsetContent>
            </Fieldset>

            <Fieldset className="border p-2.5">
                <FieldsetLegend className="text-foreground text-[10px]">
                    <Icon icon="document" className="size-3" />
                    Notes
                </FieldsetLegend>
                <FieldsetContent className="gap-2">
                    <Field invalid={!!errors.comment}>
                        <FieldLabel>Comment</FieldLabel>
                        <FieldTextarea rows={2} placeholder="Add comments or notes..." {...register('comment')} />
                        <FieldError>{errors.comment?.message}</FieldError>
                    </Field>
                </FieldsetContent>
            </Fieldset>

            <Button type="submit" disabled={!isDirty || isSubmitting} variant="primary" className="mt-1 w-full">
                <Icon icon={isSubmitting ? 'loading' : isSaved && !isDirty ? 'success' : 'save'} className="size-3.5" />
                <span>{isSubmitting ? 'Writing Tags...' : isSaved && !isDirty ? 'Saved Successfully' : 'Write Tags'}</span>
            </Button>
        </form>
    );
}
