'use client';

import * as React from 'react';
import { createContext, memo, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { type T_IconType } from '@/types/client.types';

const EFFECTS_KEY = 'sidebar-effects-enabled';

const EffectsContext = createContext<{ enabled: boolean; toggle: () => void }>({
    enabled: true,
    toggle: () => {},
});

function EffectsProvider({ children, defaultEnabled = true }: { children: React.ReactNode; defaultEnabled?: boolean }) {
    const [enabled, setEnabled] = useState(() => {
        if (typeof window === 'undefined') return defaultEnabled;
        const stored = localStorage.getItem(EFFECTS_KEY);
        return stored !== null ? stored === 'true' : defaultEnabled;
    });

    const toggle = useCallback(() => {
        setEnabled((prev) => {
            const next = !prev;
            localStorage.setItem(EFFECTS_KEY, String(next));
            return next;
        });
    }, []);

    const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle]);
    return <EffectsContext.Provider value={value}>{children}</EffectsContext.Provider>;
}

export function useSidebarEffects() {
    return useContext(EffectsContext);
}
export const useSidebar001Effects = useSidebarEffects;

// ─── Hover Context ────────────────────────────────────────────────────────────

interface HoverRect {
    top: number;
    height: number;
    left: number;
}

const HoverContext = createContext<{
    hovered: string | null;
    hoverRect: HoverRect | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    setHovered: (id: string | null, rect?: HoverRect | null) => void;
}>({
    hovered: null,
    hoverRect: null,
    containerRef: { current: null },
    setHovered: () => {},
});

function HoverProvider({ children, containerRef }: { children: React.ReactNode; containerRef: React.RefObject<HTMLDivElement | null> }) {
    const [hovered, setHoveredId] = useState<string | null>(null);
    const [hoverRect, setHoverRect] = useState<HoverRect | null>(null);

    const setHovered = useCallback((id: string | null, rect?: HoverRect | null) => {
        setHoveredId(id);
        setHoverRect(rect ?? null);
    }, []);

    const value = useMemo(() => ({ hovered, hoverRect, containerRef, setHovered }), [hovered, hoverRect, containerRef, setHovered]);

    return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
}

// ─── Scroll To Active ─────────────────────────────────────────────────────────

function useScrollToActive(active: boolean) {
    const ref = useRef<HTMLDivElement>(null);
    const scrolled = useRef(false);

    useEffect(() => {
        if (!active || scrolled.current || !ref.current) return;
        scrolled.current = true;
        const el = ref.current;
        const schedule =
            typeof requestIdleCallback !== 'undefined' ? (cb: () => void) => requestIdleCallback(cb) : (cb: () => void) => setTimeout(cb, 100);
        const cancel = typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : clearTimeout;
        const id = schedule(() => {
            const viewport = el.closest('[data-scroll-viewport]');
            if (!(viewport instanceof HTMLElement)) return;
            const vpRect = viewport.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const offset = elRect.top - vpRect.top - vpRect.height / 2 + elRect.height / 2;
            if (Math.abs(offset) > 40) viewport.scrollBy({ top: offset, behavior: 'smooth' });
        });
        return () => cancel(id as number);
    }, [active]);

    useEffect(() => {
        if (!active) scrolled.current = false;
    }, [active]);

    return ref;
}

// ─── Hover Highlight ──────────────────────────────────────────────────────────

function HoverHighlight() {
    const { hoverRect, hovered } = useContext(HoverContext);
    const { enabled } = useContext(EffectsContext);

    return (
        <AnimatePresence>
            {enabled && hovered && hoverRect && (
                <motion.div
                    key="sidebar-hover-bg"
                    className="bg-accent/60 pointer-events-none absolute z-0 rounded-md"
                    style={{ right: 4 }}
                    initial={false}
                    animate={{
                        top: hoverRect.top + 1,
                        height: hoverRect.height - 2,
                        left: hoverRect.left,
                        opacity: 1,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                />
            )}
        </AnimatePresence>
    );
}

// ─── Sidebar Item ─────────────────────────────────────────────────────────────

export interface SidebarItemProps {
    id?: string;
    label: React.ReactNode;
    icon?: T_IconType | React.ReactNode;
    isActive?: boolean;
    isNew?: boolean;
    badge?: React.ReactNode;
    count?: number;
    href?: string;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
}

export const SidebarItem = memo(function SidebarItem({
    id: explicitId,
    label,
    icon,
    isActive = false,
    isNew,
    badge,
    count,
    href,
    className,
    onClick,
}: SidebarItemProps) {
    const generatedId = useId();
    const itemId = explicitId || href || generatedId;
    const { hovered, setHovered, containerRef } = useContext(HoverContext);
    const isHovered = hovered === itemId;
    const itemRef = useScrollToActive(isActive);

    const opacity = isActive ? 1 : hovered !== null ? (isHovered ? 1 : 0.45) : 0.75;
    const x = isActive ? 4 : isHovered ? 2 : 0;

    const handleMouseEnter = () => {
        const el = itemRef.current;
        const container = containerRef.current;
        if (el && container) {
            const elRect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setHovered(itemId, {
                top: elRect.top - containerRect.top,
                height: elRect.height,
                left: 4,
            });
        } else {
            setHovered(itemId);
        }
    };

    const handleMouseLeave = () => setHovered(null);

    const content = (
        <div className="relative flex w-full items-center justify-between">
            <div className="flex min-w-0 items-center gap-2 truncate">
                {icon && (
                    <span className={cn('shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}>
                        {typeof icon === 'string' ? <Icon icon={icon as T_IconType} className="size-3.5" /> : icon}
                    </span>
                )}
                <span className={cn('truncate font-medium transition-colors', isActive ? 'text-primary font-semibold' : 'text-foreground')}>
                    {label}
                </span>
                {isNew && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-1.5">
                {count !== undefined && (
                    <span className={cn('font-mono text-[10px] tabular-nums', isActive ? 'text-primary/90' : 'text-muted-foreground')}>
                        {count.toLocaleString()}
                    </span>
                )}
                {badge && (
                    <Badge variant={isActive ? 'primary' : 'outline'} size="xs" className="px-1 py-0 text-[9px]">
                        {badge}
                    </Badge>
                )}
            </div>
        </div>
    );

    return (
        <div className="relative my-0.5">
            {isActive && (
                <motion.span
                    layoutId="sidebar-active-indicator"
                    className="bg-primary pointer-events-none absolute top-1/2 left-0 z-10 h-3.5 w-0.5 -translate-y-1/2 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
            )}

            <motion.div
                ref={itemRef}
                animate={{ opacity, x }}
                transition={{ type: 'spring', stiffness: 600, damping: 35 }}
                style={{ transformOrigin: 'left center' }}>
                {href ? (
                    <a
                        href={href}
                        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={cn(
                            'group relative z-1 flex w-full items-center rounded-md px-2.5 py-1.5 text-xs select-none transition-colors duration-150',
                            isActive ? 'bg-primary/10 text-primary' : 'hover:text-foreground text-muted-foreground',
                            className
                        )}>
                        {content}
                    </a>
                ) : (
                    <button
                        type="button"
                        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={cn(
                            'group relative z-1 flex w-full cursor-pointer items-center rounded-md px-2.5 py-1.5 text-xs select-none transition-colors duration-150',
                            isActive ? 'bg-primary/10 text-primary' : 'hover:text-foreground text-muted-foreground',
                            className
                        )}>
                        {content}
                    </button>
                )}
            </motion.div>
        </div>
    );
});

export const Sidebar001Item = SidebarItem;

// ─── Sidebar Separator ────────────────────────────────────────────────────────

export function SidebarSeparator({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <div className={cn('text-muted-foreground flex items-center gap-1.5 px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider uppercase', className)}>
            {children}
        </div>
    );
}
export const Sidebar001Separator = SidebarSeparator;

// ─── Sidebar Group ────────────────────────────────────────────────────────────

export interface SidebarGroupProps {
    label: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    icon?: T_IconType | React.ReactNode;
    className?: string;
}

export function SidebarGroup({ label, children, defaultOpen = true, icon, className }: SidebarGroupProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const id = useId();
    const { setHovered, containerRef } = useContext(HoverContext);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleMouseEnter = useCallback(() => {
        const el = buttonRef.current;
        const container = containerRef.current;
        if (el && container) {
            const elRect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setHovered(id, {
                top: elRect.top - containerRect.top,
                height: elRect.height,
                left: 0,
            });
        } else {
            setHovered(id);
        }
    }, [id, setHovered, containerRef]);

    const handleMouseLeave = useCallback(() => {
        setHovered(null);
    }, [setHovered]);

    return (
        <div className={cn('flex flex-col', className)}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="group relative z-1 flex w-full cursor-pointer items-center justify-between gap-1.5 px-2 py-1 text-left select-none">
                <div className="flex items-center gap-1.5 truncate">
                    {icon && (
                        <span className="text-muted-foreground size-3 shrink-0">
                            {typeof icon === 'string' ? <Icon icon={icon as T_IconType} className="size-3" /> : icon}
                        </span>
                    )}
                    <span className="text-muted-foreground group-hover:text-foreground text-[10px] font-bold tracking-wider uppercase transition-colors">
                        {label}
                    </span>
                </div>

                <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: 'spring', stiffness: 450, damping: 30 }}>
                    <Icon icon="right" className="text-muted-foreground/60 size-3 shrink-0" />
                </motion.div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        style={{ overflow: 'hidden' }}>
                        <div className="flex flex-col pt-0.5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
export const Sidebar001Group = SidebarGroup;

// ─── Sidebar Section ──────────────────────────────────────────────────────────

export function SidebarSection({ label, children, className }: { label?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col space-y-1', className)}>
            {label && <SidebarSeparator>{label}</SidebarSeparator>}
            {children}
        </div>
    );
}
export const Sidebar001Section = SidebarSection;

// ─── Sidebar Content ──────────────────────────────────────────────────────────

export function SidebarContent({ children, className }: { children: React.ReactNode; className?: string }) {
    const containerRef = useContext(HoverContext).containerRef;
    const setContainerRef = useCallback(
        (node: HTMLDivElement | null) => {
            containerRef.current = node;
        },
        [containerRef]
    );

    return (
        <div className={cn('flex-1 overflow-y-auto p-2', className)} data-scroll-viewport>
            <div ref={setContainerRef} className="relative flex flex-col gap-3">
                <HoverHighlight />
                {children}
            </div>
        </div>
    );
}
export const Sidebar001Content = SidebarContent;

// ─── Sidebar Root (with resize) ───────────────────────────────────────────────

export interface SidebarProps {
    children: React.ReactNode;
    className?: string;
    defaultEffectsEnabled?: boolean;
    /** Initial width in px. Default: 224 */
    defaultWidth?: number;
    /** Min resize width in px. Default: 160 */
    minWidth?: number;
    /** Max resize width in px. Default: 400 */
    maxWidth?: number;
    resizable?: boolean;
}

export function Sidebar({
    children,
    className,
    defaultEffectsEnabled = true,
    defaultWidth = 224,
    minWidth = 160,
    maxWidth = 380,
    resizable = true,
}: SidebarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(defaultWidth);
    const dragging = useRef(false);
    const startX = useRef(0);
    const startW = useRef(0);

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (!resizable) return;
            e.preventDefault();
            dragging.current = true;
            startX.current = e.clientX;
            startW.current = width;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [resizable, width]
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!dragging.current) return;
            const next = Math.min(maxWidth, Math.max(minWidth, startW.current + e.clientX - startX.current));
            setWidth(next);
        },
        [minWidth, maxWidth]
    );

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    return (
        <EffectsProvider defaultEnabled={defaultEffectsEnabled}>
            <HoverProvider containerRef={containerRef}>
                <aside
                    className={cn(
                        'bg-card/60 border-border relative flex h-full shrink-0 flex-col justify-between border-r text-xs select-none backdrop-blur-xs',
                        className
                    )}
                    style={{ width }}>
                    {children}

                    {/* Resize handle */}
                    {resizable && (
                        <div
                            className="group/handle absolute top-0 right-0 z-20 h-full w-1.5 cursor-col-resize"
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}>
                            <div className="bg-border/60 group-hover/handle:bg-primary absolute top-0 right-0 h-full w-px transition-colors duration-150" />
                        </div>
                    )}
                </aside>
            </HoverProvider>
        </EffectsProvider>
    );
}
export const Sidebar001 = Sidebar;

// ─── Sidebar Header ───────────────────────────────────────────────────────────

export function SidebarHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
    return <div className={cn('shrink-0 p-3 pb-1', className)}>{children}</div>;
}
export const Sidebar001Header = SidebarHeader;

// ─── Sidebar Footer ───────────────────────────────────────────────────────────

export function SidebarFooter({ children, className }: { children?: React.ReactNode; className?: string }) {
    return <div className={cn('border-border shrink-0 border-t bg-card/40 p-3', className)}>{children}</div>;
}
export const Sidebar001Footer = SidebarFooter;

export default Sidebar;
