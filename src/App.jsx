import React, { useState } from 'react';
import HomeScreen     from './screens/HomeScreen.jsx';
import MemoryScreen   from './screens/MemoryScreen.jsx';
import MediaScreen    from './screens/MediaScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import NavBar         from './components/NavBar.jsx';
import { EventBus, EVENTS } from './core/eventBus.js';

const SCREENS = {
  home:     HomeScreen,
  memory:   MemoryScreen,
  media:    MediaScreen,
  settings: SettingsScreen,
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
