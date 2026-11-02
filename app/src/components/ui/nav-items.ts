import { Home, CalendarCheck, Wallet, Boxes, ClipboardList, Users, BarChart3, History, Settings, MoreHorizontal, HandCoins, ArrowDownToLine, ArrowUpFromLine, ClipboardPlus, UserPlus, Images, ImagePlus, type LucideIcon } from 'lucide-react';
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
  { to: '/catalogue', icon: Images, labelKey: 'nav.catalogue' },
  { to: '/wages', icon: Wallet, labelKey: 'nav.wages', action: 'wages.view' },
  { to: '/workers', icon: Users, labelKey: 'nav.workers', action: 'worker.manage' },
  { to: '/month', icon: BarChart3, labelKey: 'nav.month', action: 'wages.view' },
  { to: '/log', icon: History, labelKey: 'nav.log', action: 'log.view' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

/** SPEC-M12: "New entry" menu in the desktop side menu (filtered by can()). */
export const QUICK: NavItem[] = [
  { to: '/attendance', icon: CalendarCheck, labelKey: 'nav.attendance', action: 'attendance.mark' },
  { to: '/advances/new', icon: HandCoins, labelKey: 'adv.title', action: 'advance.give' },
  { to: '/stock/move/in', icon: ArrowDownToLine, labelKey: 'stock.in', action: 'stock.move' },
  { to: '/stock/move/out', icon: ArrowUpFromLine, labelKey: 'stock.out', action: 'stock.move' },
  { to: '/orders/new', icon: ClipboardPlus, labelKey: 'order.new', action: 'order.manage' },
  { to: '/catalogue/new', icon: ImagePlus, labelKey: 'cat.new', action: 'carpet.manage' },
  { to: '/workers/new', icon: UserPlus, labelKey: 'worker.new', action: 'worker.manage' },
];
