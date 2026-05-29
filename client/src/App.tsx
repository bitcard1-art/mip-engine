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
import PackagesPage from "./pages/PackagesPage";
import PhysicalActionPage from "./pages/PhysicalActionPage";
import EmotionalRiskPage from "./pages/EmotionalRiskPage";
import DnaRollbackPage from "./pages/DnaRollbackPage";
import IsolationLayerPage from "./pages/IsolationLayerPage";
import LedgerAnchoringPage from "./pages/LedgerAnchoringPage";
import AccessGatePage from "./pages/AccessGatePage";
import SdkMonitorPage from "./pages/SdkMonitorPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/access-gate" component={AccessGatePage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/devices" component={DevicesPage} />
      <Route path="/implantations" component={ImplantationsPage} />
      <Route path="/sandbox" component={SandboxPage} />
      <Route path="/safety" component={SafetyPage} />
      <Route path="/redteam" component={RedteamPage} />
      <Route path="/policies" component={PoliciesPage} />
      <Route path="/audit" component={AuditPage} />
      <Route path="/packages" component={PackagesPage} />
      <Route path="/guide" component={GuidePage} />
      <Route path="/physical-actions" component={PhysicalActionPage} />
      <Route path="/emotional-risk" component={EmotionalRiskPage} />
      <Route path="/dna-rollback" component={DnaRollbackPage} />
      <Route path="/isolation-layer" component={IsolationLayerPage} />
      <Route path="/ledger-anchoring" component={LedgerAnchoringPage} />
      <Route path="/sdk-monitor" component={SdkMonitorPage} />
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
