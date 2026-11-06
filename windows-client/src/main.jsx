import React from 'react';
import { createRoot } from 'react-dom/client';
import Gate from './components/Gate.jsx';
import Timer from './components/Timer.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(<React.StrictMode>{location.hash.includes('/timer') ? <Timer /> : <Gate />}</React.StrictMode>);
