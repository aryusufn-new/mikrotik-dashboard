import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved
      }
    } catch {}
    return 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (theme === 'system') return isDark ? 'dark' : 'light'
    return theme
  })

  useEffect(() => {
    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (currentTheme) => {
      let isDark = false
      if (currentTheme === 'system') {
        isDark = mediaQuery.matches
      } else {
        isDark = currentTheme === 'dark'
      }

      setResolvedTheme(isDark ? 'dark' : 'light')
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    applyTheme(theme)

    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleSystemChange)
    return () => mediaQuery.removeEventListener('change', handleSystemChange)
  }, [theme])

  const setTheme = (newTheme) => {
    try {
      localStorage.setItem('theme', newTheme)
    } catch {}
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
