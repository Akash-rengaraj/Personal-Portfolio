import { createContext, useContext } from 'react';

export const AppContext = createContext({
  theme: 'dark',
  viewCount: 0,
  triggerBotCommand: () => {},
});

export const useApp = () => useContext(AppContext);
