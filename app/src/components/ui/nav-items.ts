import { Home, CalendarCheck, Wallet, Boxes, ClipboardList, Users, BarChart3, History, Settings, MoreHorizontal, type LucideIcon } from 'lucide-react';
import type { Role } from '../../db/types';
import type { Action } from '../../domain/permissions';

export interface NavItem { to: string; icon: LucideIcon; labelKey: string; action?: Action; }

/** Bottom bar (phone): five destinations. */
export const PRIMARY: Record<Role, NavItem[]> = {
  owner: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/attendance', icon: CalendarCheck, labelKey: 'nav.attendance' },
    { to: '/stock', icon: Boxes, labelKey: 'nav.stock' },
    { to: '/orders', icon: ClipboardList, labelKey: 'nav.orders' },
    { to: '/more', icon: MoreHorizontal, labelKey: 'nav.more' },
  ],
  staff: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/attendance', icon: CalendarCheck, labelKey: 'nav.attendance' },
    { to: '/stock', icon: Boxes, labelKey: 'nav.stock' },
    { to: '/orders', icon: ClipboardList, labelKey: 'nav.orders' },
    { to: '/more', icon: MoreHorizontal, labelKey: 'nav.more' },
  ],
};

/** Everything else (side nav at lg+, the "More" screen on phones). */
export const MORE: NavItem[] = [
  { to: '/wages', icon: Wallet, labelKey: 'nav.wages', action: 'wages.view' },
  { to: '/workers', icon: Users, labelKey: 'nav.workers', action: 'worker.manage' },
  { to: '/month', icon: BarChart3, labelKey: 'nav.month', action: 'wages.view' },
  { to: '/log', icon: History, labelKey: 'nav.log', action: 'log.view' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];
