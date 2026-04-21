

import React, { useState, useEffect } from 'react';
import { loadFaqData } from 'types/loadFaqData';
import '../css/FaqsPage.css';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MemoryIcon from '@mui/icons-material/Memory';
import SensorsIcon from '@mui/icons-material/Sensors';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import FlightIcon from '@mui/icons-material/Flight';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';

// Modules array will be loaded from external JSON files for multilingual support
const modules: Array<{ key: string; icon: JSX.Element }> = [
  { key: 'Electronics', icon: <MemoryIcon fontSize="medium" style={{ marginRight: 10 }} /> },
  { key: 'IoT', icon: <SensorsIcon fontSize="medium" style={{ marginRight: 10 }} /> },
  { key: 'Robotics', icon: <PrecisionManufacturingIcon fontSize="medium" style={{ marginRight: 10 }} /> },
  { key: 'Drone', icon: <FlightIcon fontSize="medium" style={{ marginRight: 10 }} /> },
  { key: 'AI', icon: <SmartToyIcon fontSize="medium" style={{ marginRight: 10 }} /> },
  { key: 'AR/VR', icon: <ThreeSixtyIcon fontSize="medium" style={{ marginRight: 10 }} /> },
];

const FaqsPage: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const [language, setLanguage] = useState<'en' | 'mr'>('en');

  const [faqData, setFaqData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadFaqData(language).then(data => {
      setFaqData(data);
      setLoading(false);
    });
  }, [language]);

  const handleAudio = () => {
    if (!faqData) return;
    const answer = faqData[modules[selected].key]?.answer;
    if (!answer) return;
    const speakWithVoice = () => {
      const utterance = new window.SpeechSynthesisUtterance(answer);
      let voices = window.speechSynthesis.getVoices();
      let selectedVoice = null;
      if (language === 'mr') {
        // Try Marathi first
        selectedVoice = voices.find(
          (voice) => voice.lang === 'mr-IN' || voice.lang === 'mr'
        );
        // Fallback to Indian English
        if (!selectedVoice) {
          selectedVoice = voices.find(
            (voice) => voice.lang === 'en-IN' || voice.name.toLowerCase().includes('india')
          );
        }
      } else {
        // English: Prefer Indian English
        selectedVoice = voices.find(
          (voice) => voice.lang === 'en-IN' || voice.name.toLowerCase().includes('india')
        );
      }
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      window.speechSynthesis.speak(utterance);
    };
    // If voices are not loaded yet, wait for them
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = speakWithVoice;
    } else {
      speakWithVoice();
    }
  };

  // const handleAudio = () => {
  //   if (!faqData) return;
  //   const utterance = new window.SpeechSynthesisUtterance(faqData[modules[selected].key]?.answer);
  //   window.speechSynthesis.speak(utterance);
  // };
  // Remove handleAudio and FAQ logic for now

  return (
    <div className="faqs-main-container" lang={language}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1.2rem 2.5rem 0.5rem 0', position: 'absolute', top: 0, right: 0, zIndex: 20 }}>
        <label htmlFor="faq-lang-select" style={{ fontWeight: 600, marginRight: 8 }}>Language:</label>
        <select
          id="faq-lang-select"
          value={language}
          onChange={e => setLanguage(e.target.value as 'en' | 'mr')}
          style={{ padding: '0.4rem 1.2rem', borderRadius: 6, border: '1px solid #ccc', fontWeight: 500 }}
        >
          <option value="en">English</option>
          <option value="mr">Marathi</option>
        </select>
      </div>
      <aside className="faqs-sidebar">
        <h2>Modules</h2>
        <ul>
          {modules.map((mod, idx) => (
            <li
              key={mod.key}
              className={selected === idx ? 'active' : ''}
              onClick={() => setSelected(idx)}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              {mod.icon}
              {mod.key}
            </li>
          ))}
        </ul>
      </aside>
      <section className="faqs-content">
        <h1>{modules[selected].key}</h1>
        <div className="faqs-qa-card">
          {loading ? (
            <p style={{ color: '#64748b', fontStyle: 'italic' }}>Loading FAQ...</p>
          ) : faqData && faqData[modules[selected].key] ? (
            <>
              <h3 style={{marginBottom: '1.2rem', color: '#1e293b', fontWeight: 600}}>
                Q: {faqData[modules[selected].key].question}
              </h3>
              <div className="faqs-answer-row">
                <p className="faqs-answer">{faqData[modules[selected].key].answer}</p>
                <VolumeUpIcon
                  className="faqs-audio-icon"
                  onClick={handleAudio}
                  style={{ cursor: 'pointer', width: 36, height: 36, marginLeft: 16 }}
                  fontSize="large"
                  color="primary"
                />
              </div>
            </>
          ) : (
            <p style={{ color: '#64748b', fontStyle: 'italic' }}>
              FAQ not available for this module.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default FaqsPage;
