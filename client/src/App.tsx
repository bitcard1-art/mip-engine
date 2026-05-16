import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import DevicesPage from "./pages/DevicesPage";
import ImplantationsPage from "./pages/ImplantationsPage";
import SandboxPage from "./pages/SandboxPage";
import SafetyPage from "./pages/SafetyPage";
import RedteamPage from "./pages/RedteamPage";
import PoliciesPage from "./pages/PoliciesPage";
import AuditPage from "./pages/AuditPage";
import LandingPage from "./pages/LandingPage";
import GuidePage from "./pages/GuidePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/devices" component={DevicesPage} />
      <Route path="/implantations" component={ImplantationsPage} />
      <Route path="/sandbox" component={SandboxPage} />
      <Route path="/safety" component={SafetyPage} />
      <Route path="/redteam" component={RedteamPage} />
      <Route path="/policies" component={PoliciesPage} />
      <Route path="/audit" component={AuditPage} />
      <Route path="/guide" component={GuidePage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
