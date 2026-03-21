import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
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
  CreditCard,
  KeyRound,
  LogOut,
  Sun,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BillingBanner } from "@/components/BillingBanner";
import { useEmployeeOfflineQueue } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { getPreviewEmployeeToken } from "@/lib/preview-session";
import { useCurrentSession } from "@/features/session/useCurrentSession";
import { CookieSettingsButton } from "@/components/CookieConsent";

interface AppShellProps {
  children: ReactNode;
  role: "admin" | "employee";
  employee: any;
}

const adminItems = [
  { title: "Einsatzplan", url: "/", icon: Calendar },
  { title: "Aufträge", url: "/jobs", icon: Briefcase },
  { title: "Mitarbeiter", url: "/employees", icon: Users },
  { title: "Archiv", url: "/archive", icon: Archive },
];

const employeeItems = [
  { title: "Heute", url: "/", icon: Sun },
  { title: "Einsätze", url: "/assignments", icon: ClipboardList },
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
  const { data: meData } = useCurrentSession();
  const billingEnabled = meData?.billing?.stripeEnabled ?? false;
  const billingItems = billingEnabled && role === "admin"
    ? [{ title: "Abonnement", url: "/billing", icon: CreditCard }]
    : [];
  const items = role === "admin" ? [...adminItems, ...billingItems] : employeeItems;
  const previewToken = getPreviewEmployeeToken();
  const { isOnline, pendingCount, conflictCount } = useEmployeeOfflineQueue();
  const activeItem = items.find((item) => isItemActive(location, item.url, role)) ?? items[0];
  const isEmployeeAssignmentRoute = role === "employee" && location.startsWith("/assignment/");
  const isEmployeePasswordRoute = role === "employee" && location === "/account/password";
  const mobileTitle = isEmployeeAssignmentRoute
    ? "Einsatz"
    : isEmployeePasswordRoute
      ? "Passwort"
      : activeItem?.title;

  const style = {
    "--sidebar-width": "13rem",
    "--sidebar-width-icon": "3.25rem",
  };

  return (
    <SidebarProvider style={style as CSSProperties}>
      <div className="flex h-screen h-[100dvh] w-full overflow-hidden">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b p-0">
            <div className="flex items-center gap-2 px-3 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
              <BrandMark
                size={34}
                iconClassName="rounded-[14px] group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
              />
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-bold brand-ink">Meisterplaner</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {role === "admin" ? "Zentrale" : "Mitarbeiter"}
                  </p>
                  {previewToken && (
                    <span className="rounded-full border bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Vorschau
                    </span>
                  )}
                  {role === "employee" && (
                    <ConnectionStatusBadge
                      isOnline={isOnline}
                      compact
                      className="hidden lg:inline-flex"
                    />
                  )}
                </div>
              </div>
              <ThemeToggle compact className="group-data-[collapsible=icon]:hidden" />
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
            <CookieSettingsButton className="mb-2 flex items-center text-[10px] text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden" />
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                {employee?.firstName?.charAt(0)}
                {employee?.lastName?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-medium">
                  {employee?.firstName} {employee?.lastName}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-muted-foreground">
                    {role === "admin" ? "Admin" : "Mitarbeiter"}
                  </p>
                  {role === "employee" && conflictCount > 0 && (
                    <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-red-700">
                      {conflictCount} Konflikt
                    </span>
                  )}
                  {role === "employee" && conflictCount === 0 && pendingCount > 0 && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                      {pendingCount} Ausstehend
                    </span>
                  )}
                  {role === "employee" && (
                    <ConnectionStatusBadge
                      isOnline={isOnline}
                      compact
                      className="hidden md:inline-flex lg:hidden"
                    />
                  )}
                </div>
              </div>
              {role === "employee" && (
                <Button
                  asChild
                  variant={isEmployeePasswordRoute ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7 group-data-[collapsible=icon]:px-0"
                >
                  <Link href="/account/password" data-testid="button-open-change-password">
                    <KeyRound className="h-3.5 w-3.5 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">Passwort</span>
                  </Link>
                </Button>
              )}
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b px-3 py-2 md:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {role === "admin" ? "Zentrale" : "Mitarbeiteransicht"}
              </p>
              <p className="truncate text-sm font-semibold">{mobileTitle}</p>
            </div>
            <ThemeToggle compact />
            {role === "employee" && <ConnectionStatusBadge isOnline={isOnline} compact />}
          </header>

          {role === "admin" && <BillingBanner />}

          {role === "employee" && !isOnline && (
            <div className="border-b bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Keine Verbindung. Änderungen werden gespeichert und automatisch übermittelt,
              sobald wieder eine Verbindung besteht.
            </div>
          )}

          {role === "employee" && isOnline && conflictCount > 0 && (
            <div className="border-b bg-red-50 px-3 py-2 text-sm text-red-900">
              {conflictCount === 1
                ? "Eine gespeicherte Änderung muss geprüft werden."
                : `${conflictCount} gespeicherte Änderungen müssen geprüft werden.`}
            </div>
          )}

          <main className={cn(
            "app-shell-scroll min-h-0 flex-1 overflow-y-auto",
            role === "employee" && !isEmployeeAssignmentRoute && "pb-14 md:pb-0",
          )}>
            {children}
          </main>

          {role === "employee" && !isEmployeeAssignmentRoute && (
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
