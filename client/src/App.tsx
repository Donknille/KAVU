import { lazy, Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import { applyPreviewIdentityFromUrl } from "@/lib/preview-session";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const SetupPage = lazy(() => import("@/pages/SetupPage"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const EmployeeDayView = lazy(() => import("@/pages/EmployeeDayView"));
const AssignmentDetail = lazy(() => import("@/pages/AssignmentDetail"));
const PlanView = lazy(() => import("@/pages/PlanView"));
const JobsList = lazy(() => import("@/pages/JobsList"));
const JobDetail = lazy(() => import("@/pages/JobDetail"));
const CreateJob = lazy(() => import("@/pages/CreateJob"));
const EmployeesList = lazy(() => import("@/pages/EmployeesList"));
const ArchiveSearch = lazy(() => import("@/pages/ArchiveSearch"));

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="space-y-3 w-56">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

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
        <Route path="/assignment/:id" component={AssignmentDetail} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function EmployeeRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={EmployeeDayView} />
        <Route path="/assignment/:id" component={AssignmentDetail} />
        <Route path="/assignments" component={EmployeeDayView} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AuthenticatedApp() {
  const { data: meData, isLoading: meLoading } = useQuery<any>({
    queryKey: ["/api/me"],
  });

  if (meLoading) {
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

  if (meData?.needsSetup) {
    return (
      <Suspense fallback={<PageFallback />}>
        <SetupPage />
      </Suspense>
    );
  }

  const employee = meData?.employee;
  const role = employee?.role || "employee";

  return (
    <AppShell role={role} employee={employee}>
      {role === "admin" ? <AdminRouter /> : <EmployeeRouter />}
    </AppShell>
  );
}

function App() {
  useEffect(() => {
    applyPreviewIdentityFromUrl();
  }, []);

  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-3 w-48">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageFallback />}>
        <LandingPage />
      </Suspense>
    );
  }

  return <AuthenticatedApp />;
}

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
