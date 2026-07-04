/**
 * App — thin shell that switches between the Hydration tracker and the
 * Expense tracker full-page experiences.
 *
 * The water tracker's logic, hooks, and components (useHydration and
 * everything it renders) are UNTOUCHED — they were only relocated
 * verbatim into src/pages/HydrationPage.tsx so this shell could introduce
 * app-level navigation without altering a single line of tracker behavior.
 */

import { useState } from 'react';
import { TopNav, type AppView } from './components/TopNav';
import HydrationPage from './pages/HydrationPage';
import ExpensesPage from './pages/ExpensesPage';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('hydration');

  return (
    <div className="min-h-screen">
      <TopNav activeView={activeView} onChange={setActiveView} />
      {activeView === 'hydration' ? <HydrationPage /> : <ExpensesPage />}
    </div>
  );
}
