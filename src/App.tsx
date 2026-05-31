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
import WtMonthlyReport from '@/pages/WtMonthlyReport';
import WtAttendance from '@/pages/WtAttendance';
import WtPolicyReader from '@/pages/WtPolicyReader';
import { AUTH_TOKEN_KEY } from '@/lib/secureApi';

const queryClient = new QueryClient();

function Router({ onLogout }: { onLogout: () => void }) {
  return (
    <WtLayout onLogout={onLogout}>
      <Switch>
        <Route path="/" component={WtDashboard} />
        <Route path="/pending" component={WtPendingItems} />
        <Route path="/letters" component={WtOfficialLetters} />
        <Route path="/emails" component={WtEmailLog} />
        <Route path="/monthly-report" component={WtMonthlyReport} />
        <Route path="/attendance" component={WtAttendance} />
        <Route path="/policy" component={WtPolicyReader} />
      </Switch>
    </WtLayout>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => Boolean(localStorage.getItem(AUTH_TOKEN_KEY))
  );

  if (!isLoggedIn) {
    return <Login onLogin={(token) => {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.removeItem('hr_auth');
      setIsLoggedIn(true);
    }} />;
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem('hr_auth');
    setIsLoggedIn(false);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WtProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router onLogout={handleLogout} />
          </WouterRouter>
        </WtProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
 
