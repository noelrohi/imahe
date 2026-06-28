import { Link, useRouterState } from '@tanstack/react-router';
import { FolderIcon, GearIcon, HouseIcon } from '@phosphor-icons/react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

const navigationItems = [
  { title: 'Home', to: '/', icon: HouseIcon },
  { title: 'Settings', to: '/settings', icon: GearIcon },
  { title: 'Collections', to: '/collections', icon: FolderIcon },
] as const;

type NavigationItem = (typeof navigationItems)[number];

function AppSidebarNavItem({ item }: { item: NavigationItem }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const Icon = item.icon;
  const isActive = pathname === item.to;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to={item.to} activeOptions={{ exact: true }}>
          <Icon aria-hidden="true" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            i
          </div>
          <span className="font-heading text-base font-semibold text-sidebar-foreground">
            imahe
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <AppSidebarNavItem key={item.to} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
