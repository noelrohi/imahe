import { FolderIcon, HomeIcon, SettingsIcon } from 'lucide-react';
import { NavLink, useMatch } from 'react-router-dom';

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
  { title: 'Home', to: '/', icon: HomeIcon },
  { title: 'Settings', to: '/settings', icon: SettingsIcon },
  { title: 'Collections', to: '/collections', icon: FolderIcon },
] as const;

type NavigationItem = (typeof navigationItems)[number];

function AppSidebarNavItem({ item }: { item: NavigationItem }) {
  const match = useMatch({ path: item.to, end: true });
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={Boolean(match)}>
        <NavLink to={item.to} end>
          <Icon aria-hidden="true" />
          <span>{item.title}</span>
        </NavLink>
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
