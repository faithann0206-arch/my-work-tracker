import { useState } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WtProvider } from '@/store/wt';
import WtLayout from '@/components/WtLayout';
import Login from '@/pages/Login';
import WtDashboard from '@/pages/WtDashboard';
import WtPendingItems from '@/pages/WtPendingItems';
import WtOfficialLetters from '@/pages/WtOfficialLetters';
import WtEmailLog from '@/pages/WtEmailLog';
import WtAttendance from '@/pages/WtAttendance';
import WtPolicyReader from '@/pages/WtPolicyReader';

const queryClient = new QueryClient();

function Router() {
  return (
    <WtLayout>
      <Switch>
        <Route path="/" component={WtDashboard} />
        <Route path="/pending" component={WtPendingItems} />
        <Route path="/letters" component={WtOfficialLetters} />
        <Route path="/emails" component={WtEmailLog} />
        <Route path="/attendance" component={WtAttendance} />
        <Route path="/policy" component={WtPolicyReader} />
      </Switch>
    </WtLayout>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('hr_auth') === 'true'
  );

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WtProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </WtProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
 
