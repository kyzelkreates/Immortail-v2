import React, { useState } from 'react';
import HomeScreen      from './screens/HomeScreen.jsx';
import CompanionScreen from './screens/CompanionScreen.jsx';
import MemoryScreen    from './screens/MemoryScreen.jsx';
import MediaScreen     from './screens/MediaScreen.jsx';
import SettingsScreen  from './screens/SettingsScreen.jsx';
import AISettingsPage  from './pages/AISettingsPage.jsx';
import AIDashboard     from './pages/AIDashboard.jsx';
import VoiceCompanionPage from './pages/VoiceCompanionPage.jsx';
import NavBar          from './components/NavBar.jsx';
import { EventBus, EVENTS } from './core/eventBus.js';

const SCREENS = {
  home:        HomeScreen,
  companion:   CompanionScreen,
  memory:      MemoryScreen,
  media:       MediaScreen,
  settings:    SettingsScreen,
  ai_settings:  AISettingsPage,
  ai_dashboard:  AIDashboard,
  voice:         VoiceCompanionPage,
};

export default function App({ bootResult }) {
  const [screen, setScreen] = useState('home');

  const navigate = (s) => {
    setScreen(s);
    EventBus.emit(EVENTS.SCREEN_CHANGED, { screen: s });
  };

  const Screen = SCREENS[screen] || HomeScreen;

  return (
    <div className="app-shell">
      <div className="screen-area">
        <Screen />
      </div>
      <NavBar current={screen} navigate={navigate} />
    </div>
  );
}
