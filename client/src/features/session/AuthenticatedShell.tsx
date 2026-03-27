import { lazy, Suspense, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import OnboardingTour, { EmployeeOnboardingTour } from "@/components/OnboardingTour";
import { Route, Switch } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { PageFallback } from "@/components/PageFallback";
import { EmployeeOfflineQueueProvider } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { SessionStatePanel } from "@/features/session/SessionStatePanel";
import { useCurrentSession } from "@/features/session/useCurrentSession";
import NotFound from "@/pages/not-found";

const ChangePasswordPage = lazy(() => import("@/pages/ChangePasswordPage"));
const SetupPage = lazy(() => import("@/pages/SetupPage"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const EmployeeDayView = lazy(() => import("@/pages/EmployeeDayView"));
const EmployeeSchedulePage = lazy(() => import("@/pages/EmployeeSchedulePage"));
const AssignmentDetail = lazy(() => import("@/pages/AssignmentDetail"));
const PlanView = lazy(() => import("@/pages/PlanView"));
const JobsList = lazy(() => import("@/pages/JobsList"));
const JobDetail = lazy(() => import("@/pages/JobDetail"));
const CreateJob = lazy(() => import("@/pages/CreateJob"));
const EmployeesList = lazy(() => import("@/pages/EmployeesList"));
const ArchiveSearch = lazy(() => import("@/pages/ArchiveSearch"));
const BillingPage = lazy(() => import("@/pages/BillingPage"));

function AdminRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={PlanView} />
        <Route path="/plan" component={PlanView} />
        <Route path="/dashboard" component={AdminDashboard} />
        <Route path="/jobs" component={JobsList} />
        <Route path="/jobs/new" component={CreateJob} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/employees" component={EmployeesList} />
        <Route path="/archive" component={ArchiveSearch} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/assignment/:id" component={AssignmentDetail} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

type EmployeeRouterProps = {
  employee: any;
  company: any;
};

function EmployeeRouter({ employee, company }: EmployeeRouterProps) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={EmployeeDayView} />
        <Route path="/assignment/:id" component={AssignmentDetail} />
        <Route path="/assignments" component={EmployeeSchedulePage} />
        <Route path="/account/password">
          {() => <ChangePasswordPage employee={employee} company={company} required={false} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-3 w-48">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <Button
      variant="outline"
      className="h-11"
      onClick={() => {
        window.location.href = "/api/logout";
      }}
    >
      Neu anmelden
    </Button>
  );
}

function EmailVerificationBanner() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification");
      toast({ title: "Bestaetigungsmail gesendet", description: "Bitte pruefen Sie Ihren Posteingang." });
    } catch {
      toast({ title: "Senden fehlgeschlagen", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Mail className="h-4 w-4 shrink-0" />
      <span className="flex-1">Bitte bestaetigen Sie Ihre E-Mail-Adresse.</span>
      <button
        type="button"
        className="shrink-0 font-medium underline hover:no-underline"
        onClick={resend}
        disabled={sending}
      >
        {sending ? "Wird gesendet..." : "Erneut senden"}
      </button>
    </div>
  );
}

export function AuthenticatedShell() {
  const { data: meData, isLoading, error, refetch } = useCurrentSession();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !meData) {
    return (
      <SessionStatePanel
        title="Sitzung konnte nicht geladen werden"
        description="Der aktuelle Benutzerkontext konnte nicht sicher geladen werden. Wir zeigen deshalb bewusst keine Rolle oder Ansicht an, bis die Sitzung erneut geprüft wurde."
        actions={
          <>
            <Button
              className="h-11"
              onClick={() => {
                void refetch();
              }}
            >
              Erneut prüfen
            </Button>
            <LogoutButton />
          </>
        }
      />
    );
  }

  if (meData.needsSetup) {
    return (
      <Suspense fallback={<PageFallback />}>
        <SetupPage />
      </Suspense>
    );
  }

  const employee = meData.employee;
  if (!employee?.role) {
    if (meData.requiresPasswordChange) {
      return (
        <Suspense fallback={<PageFallback />}>
          <ChangePasswordPage employee={meData.employee} company={meData.company} required />
        </Suspense>
      );
    }
    return (
      <SessionStatePanel
        title="Rolle konnte nicht bestimmt werden"
        description="Die Sitzung ist zwar vorhanden, enthält aber keine gültige Rolleninformation. Bitte melden Sie sich erneut an."
        actions={<LogoutButton />}
      />
    );
  }

  const role = employee.role;

  return (
    <EmployeeOfflineQueueProvider employeeId={employee.id} enabled={role === "employee"}>
      <AppShell role={role} employee={employee}>
        {role === "admin" && <OnboardingTour />}
        {role === "employee" && <EmployeeOnboardingTour />}
        {role === "admin" && meData.emailVerified === false && (
          <EmailVerificationBanner />
        )}
        {meData.requiresPasswordChange ? (
          <Suspense fallback={<PageFallback />}>
            <ChangePasswordPage employee={meData.employee} company={meData.company} required />
          </Suspense>
        ) : role === "admin" ? (
          <AdminRouter />
        ) : (
          <EmployeeRouter employee={meData.employee} company={meData.company} />
        )}
      </AppShell>
    </EmployeeOfflineQueueProvider>
  );
}
