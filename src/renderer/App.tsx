import Layout from './components/Layout';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AssistantProvider } from './contexts/AssistantContext';
import Assistant from './components/assistant/Assistant';
import './i18n';

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AssistantProvider>
          <Layout />
          <Assistant />
        </AssistantProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
