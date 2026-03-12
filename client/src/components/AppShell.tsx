import type { CSSProperties, ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Archive,
  Briefcase,
  Calendar,
  ClipboardList,
  HardHat,
  LogOut,
  Sun,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { getPreviewEmployeeToken } from "@/lib/preview-session";

interface AppShellProps {
  children: ReactNode;
  role: "admin" | "employee";
  employee: any;
}

const adminItems = [
  { title: "Einsatzplan", url: "/", icon: Calendar },
  { title: "Auftraege", url: "/jobs", icon: Briefcase },
  { title: "Mitarbeiter", url: "/employees", icon: Users },
  { title: "Archiv", url: "/archive", icon: Archive },
];

const employeeItems = [
  { title: "Heute", url: "/", icon: Sun },
  { title: "Einsaetze", url: "/assignments", icon: ClipboardList },
];

function isItemActive(
  location: string,
  url: string,
  role: "admin" | "employee",
) {
  if (role === "admin" && url === "/") {
    return location === "/" || location === "/plan";
  }

  if (location === url) {
    return true;
  }

  return url !== "/" && location.startsWith(`${url}/`);
}

export function AppShell({ children, role, employee }: AppShellProps) {
  const [location] = useLocation();
  const items = role === "admin" ? adminItems : employeeItems;
  const previewToken = getPreviewEmployeeToken();

  const style = {
    "--sidebar-width": "13rem",
    "--sidebar-width-icon": "3.25rem",
  };

  return (
    <SidebarProvider style={style as CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b p-0">
            <div className="flex items-center gap-2 px-3 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
                <HardHat className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-bold">Digitaler Polier</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Zentrale
                  </p>
                  {previewToken && (
                    <span className="rounded-full border bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Preview
                    </span>
                  )}
                </div>
              </div>
              <SidebarTrigger
                className="hidden h-8 w-8 md:inline-flex group-data-[collapsible=icon]:ml-0"
                data-testid="button-sidebar-toggle-desktop"
              />
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(location, item.url, role)}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-3">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                {employee.firstName?.charAt(0)}
                {employee.lastName?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-medium">
                  {employee.firstName} {employee.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {role === "admin" ? "Admin" : "Mitarbeiter"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  window.location.href = "/api/logout";
                }}
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center border-b p-2 md:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>

          <main className="flex-1 overflow-auto">{children}</main>

          {role === "employee" && (
            <nav className="safe-area-bottom flex border-t bg-background md:hidden">
              {employeeItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.url}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                    isItemActive(location, item.url, role)
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                  data-testid={`nav-${item.url.replace("/", "") || "home"}`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
