import { lazy, Suspense, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageFallback } from "@/components/PageFallback";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthenticatedShell } from "@/features/session/AuthenticatedShell";
import { useAuth } from "@/hooks/use-auth";
import { applyPreviewIdentityFromUrl } from "@/lib/preview-session";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const AdminAuthPage = lazy(() => import("@/pages/AdminAuthPage"));
const EmployeeLoginPage = lazy(() => import("@/pages/EmployeeLoginPage"));
const PlatformAdminPage = lazy(() => import("@/pages/PlatformAdminPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));

function PublicRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login/admin">
          {() => <AdminAuthPage mode="login" />}
        </Route>
        <Route path="/register/admin">
          {() => <AdminAuthPage mode="register" />}
        </Route>
        <Route path="/login/employee" component={EmployeeLoginPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/platform-admin" component={PlatformAdminPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AuthBootstrapScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-3 w-48">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    applyPreviewIdentityFromUrl();
  }, []);

  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <AuthBootstrapScreen />;
  }

  // Platform admin is accessible regardless of auth state
  if (window.location.pathname === "/platform-admin") {
    return (
      <Suspense fallback={<PageFallback />}>
        <PlatformAdminPage />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return <PublicRouter />;
  }

  return <AuthenticatedShell />;
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <App />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
