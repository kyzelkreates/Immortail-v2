import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initializeApp } from './core/boot.js';
import './index.css';

const root = createRoot(document.getElementById('root'));

// Boot first, then mount
initializeApp().then((result) => {
  if (!result.ok) {
    root.render(
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        height:'100vh', color:'#ff6b6b', fontFamily:'monospace', fontSize:14,
        background:'#0f0f13', padding:24, textAlign:'center',
      }}>
        Boot failed: {result.error}
      </div>
    );
    return;
  }
  root.render(<App bootResult={result} />);
});
