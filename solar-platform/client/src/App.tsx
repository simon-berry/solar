import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";
import { SolarApp } from "./pages/workspace";
import {AccessGate} from "./components/access";
import {WorkspaceRecovery} from "./components/workspace-recovery";

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider>
    <WorkspaceRecovery><Router hook={useHashLocation}><AccessGate><SolarApp /></AccessGate></Router></WorkspaceRecovery>
  </TooltipProvider></QueryClientProvider>;
}
