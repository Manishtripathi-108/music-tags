import { create } from 'zustand';
import axios from 'axios';
import { type ApiCallLogEntry } from '@/services/logger/apiLogger';

interface ApiLogStoreState {
    logs: ApiCallLogEntry[];
    isOpen: boolean;
    filter: 'all' | 'errors' | 'stream' | 'search' | 'download' | 'token';
    isAutoRefresh: boolean;
    isLoading: boolean;

    setIsOpen: (open: boolean) => void;
    toggleOpen: () => void;
    setFilter: (filter: 'all' | 'errors' | 'stream' | 'search' | 'download' | 'token') => void;
    setAutoRefresh: (auto: boolean) => void;
    fetchLogs: () => Promise<void>;
    clearLogs: () => Promise<void>;
}

export const useApiLogStore = create<ApiLogStoreState>((set, get) => ({
    logs: [],
    isOpen: false,
    filter: 'all',
    isAutoRefresh: true,
    isLoading: false,

    setIsOpen: (open) => {
        set({ isOpen: open });
        if (open) get().fetchLogs();
    },

    toggleOpen: () => {
        const next = !get().isOpen;
        set({ isOpen: next });
        if (next) get().fetchLogs();
    },

    setFilter: (filter) => set({ filter }),
    setAutoRefresh: (isAutoRefresh) => set({ isAutoRefresh }),

    fetchLogs: async () => {
        set({ isLoading: true });
        try {
            const res = await axios.get<{ logs: ApiCallLogEntry[]; total: number }>('/api/logs');
            set({ logs: res.data.logs || [], isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },

    clearLogs: async () => {
        try {
            await axios.delete('/api/logs');
            set({ logs: [] });
        } catch {}
    },
}));
