import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import { COLORS } from '../constants/theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState(systemScheme || 'dark');

  useEffect(() => {
    // Sync with system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setTheme(colorScheme);
      }
    });
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const isDark = theme === 'dark';

  const themeColors = {
    background: isDark ? COLORS.darkBackground : COLORS.lightBackground,
    card: isDark ? COLORS.darkCard : COLORS.lightCard,
    text: isDark ? COLORS.darkText : COLORS.lightText,
    textMuted: isDark ? COLORS.darkTextMuted : COLORS.lightTextMuted,
    border: isDark ? COLORS.darkBorder : COLORS.lightBorder,
    primary: COLORS.primary,
    teal: COLORS.teal,
    coral: COLORS.coral,
    amber: COLORS.amber,
    white: COLORS.white,
    black: COLORS.black,
    red: COLORS.red,
    green: COLORS.green,
    blue: COLORS.blue,
    gray: COLORS.gray,
  };

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme, colors: themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
