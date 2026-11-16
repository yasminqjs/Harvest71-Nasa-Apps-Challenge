import React, { createContext, useContext, useEffect, useState } from 'react';
import { readInterfaceLanguage, writeInterfaceLanguage } from '../database/sqlite';
import { setVoiceInterfaceLanguage } from '../services/voiceAssistant';

export type Language = 'en' | 'pt';
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: 'en', setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>('en');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    readInterfaceLanguage().then((saved) => {
      if (active && saved) {
        setVoiceInterfaceLanguage(saved);
        updateLanguage(saved);
      }
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    setVoiceInterfaceLanguage(language);
    if (ready) void writeInterfaceLanguage(language).catch(() => {});
    if (typeof document !== 'undefined') document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  }, [language, ready]);
  if (!ready) return null;
  return <LanguageContext.Provider value={{ language, setLanguage: (next) => {
    setVoiceInterfaceLanguage(next);
    updateLanguage(next);
  } }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
