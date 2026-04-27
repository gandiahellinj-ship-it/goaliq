import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthModal } from "@/components/ui/AuthModal";
import { LanguageProvider } from "@/lib/language";

import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Meals from "@/pages/Meals";
import ShoppingList from "@/pages/ShoppingList";
import Workouts from "@/pages/Workouts";
import CalendarPage from "@/pages/Calendar";
import Progress from "@/pages/Progress";
import Billing from "@/pages/Billing";
import UserProfile from "@/pages/UserProfile";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import AppLayout from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";
import { GenerationOverlay } from "@/components/GenerationOverlay";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/onboarding" component={Onboarding} />
      
      {/* Protected Routes wrapped in AppLayout */}
      <Route path="/dashboard"><AppLayout><Dashboard /></AppLayout></Route>
      <Route path="/meals"><AppLayout><Meals /></AppLayout></Route>
      <Route path="/shopping"><AppLayout><ShoppingList /></AppLayout></Route>
      <Route path="/workouts"><AppLayout><Workouts /></AppLayout></Route>
      <Route path="/calendar"><AppLayout><CalendarPage /></AppLayout></Route>
      <Route path="/progress"><AppLayout><Progress /></AppLayout></Route>
      <Route path="/billing"><AppLayout><Billing /></AppLayout></Route>
      <Route path="/profile"><AppLayout><Profile /></AppLayout></Route>
      <Route path="/profile/edit"><AppLayout><UserProfile /></AppLayout></Route>
      <Route path="/settings"><AppLayout><Settings /></AppLayout></Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <GenerationOverlay />
            <AuthModal />
            <Toaster />
            <SonnerToaster position="bottom-center" theme="dark" />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
