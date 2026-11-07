import { describe, expect, it } from 'vitest';

describe('Shift-Select Range Selection Logic', () => {
    const visibleIds = ['track-1', 'track-2', 'track-3', 'track-4', 'track-5', 'track-6', 'track-7'];

    const computeRangeSelection = (
        targetId: string,
        isShift: boolean,
        selectedIds: Set<string>,
        lastSelectedId: string | null,
        visibleList: string[]
    ) => {
        const next = new Set(selectedIds);

        if (isShift && lastSelectedId && visibleList.length > 0) {
            const fromIndex = visibleList.indexOf(lastSelectedId);
            const toIndex = visibleList.indexOf(targetId);

            if (fromIndex !== -1 && toIndex !== -1) {
                const start = Math.min(fromIndex, toIndex);
                const end = Math.max(fromIndex, toIndex);
                const rangeIds = visibleList.slice(start, end + 1);

                const shouldSelect = selectedIds.has(lastSelectedId) || !selectedIds.has(targetId);
                for (const id of rangeIds) {
                    if (shouldSelect) {
                        next.add(id);
                    } else {
                        next.delete(id);
                    }
                }

                return { selectedIds: next, lastSelectedId: targetId };
            }
        }

        if (next.has(targetId)) {
            next.delete(targetId);
        } else {
            next.add(targetId);
        }

        return { selectedIds: next, lastSelectedId: targetId };
    };

    it('selects a contiguous range downwards when Shift is pressed', () => {
        // User clicks track-2 without shift
        let state = computeRangeSelection('track-2', false, new Set(), null, visibleIds);
        expect(Array.from(state.selectedIds)).toEqual(['track-2']);
        expect(state.lastSelectedId).toBe('track-2');

        // User clicks track-5 WITH shift
        state = computeRangeSelection('track-5', true, state.selectedIds, state.lastSelectedId, visibleIds);
        expect(Array.from(state.selectedIds).sort()).toEqual(['track-2', 'track-3', 'track-4', 'track-5']);
        expect(state.lastSelectedId).toBe('track-5');
    });

    it('selects a contiguous range upwards when Shift is pressed', () => {
        // User clicks track-5 without shift
        let state = computeRangeSelection('track-5', false, new Set(), null, visibleIds);
        expect(Array.from(state.selectedIds)).toEqual(['track-5']);

        // User clicks track-2 WITH shift
        state = computeRangeSelection('track-2', true, state.selectedIds, state.lastSelectedId, visibleIds);
        expect(Array.from(state.selectedIds).sort()).toEqual(['track-2', 'track-3', 'track-4', 'track-5']);
    });

    it('preserves existing selections outside the shift-clicked range', () => {
        const initialSelected = new Set(['track-7']);
        // Click track-2
        let state = computeRangeSelection('track-2', false, initialSelected, null, visibleIds);
        expect(state.selectedIds.has('track-7')).toBe(true);
        expect(state.selectedIds.has('track-2')).toBe(true);

        // Shift click track-4
        state = computeRangeSelection('track-4', true, state.selectedIds, state.lastSelectedId, visibleIds);
        expect(Array.from(state.selectedIds).sort()).toEqual(['track-2', 'track-3', 'track-4', 'track-7']);
    });

    it('deselects a range when anchor was unselected', () => {
        const allSelected = new Set(visibleIds);
        // Uncheck track-2
        let state = computeRangeSelection('track-2', false, allSelected, null, visibleIds);
        expect(state.selectedIds.has('track-2')).toBe(false);

        // Shift click track-5 (which is currently selected)
        state = computeRangeSelection('track-5', true, state.selectedIds, state.lastSelectedId, visibleIds);
        // Range 2..5 should be unselected
        expect(state.selectedIds.has('track-2')).toBe(false);
        expect(state.selectedIds.has('track-3')).toBe(false);
        expect(state.selectedIds.has('track-4')).toBe(false);
        expect(state.selectedIds.has('track-5')).toBe(false);
        // Items 1, 6, 7 should still be selected
        expect(state.selectedIds.has('track-1')).toBe(true);
        expect(state.selectedIds.has('track-6')).toBe(true);
        expect(state.selectedIds.has('track-7')).toBe(true);
    });

    it('handles Shift click when no previous anchor was set as a single select', () => {
        const state = computeRangeSelection('track-4', true, new Set(), null, visibleIds);
        expect(Array.from(state.selectedIds)).toEqual(['track-4']);
        expect(state.lastSelectedId).toBe('track-4');
    });
});
