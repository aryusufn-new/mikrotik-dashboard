import React, { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeSelector({ showLanguage = true }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('language') || 'ID'
    } catch {
      return 'ID'
    }
  })
  const [langOpen, setLangOpen] = useState(false)

  const dropdownRef = useRef(null)
  const langRef = useRef(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectTheme = (mode) => {
    setTheme(mode)
    setIsOpen(false)
  }

  const handleSelectLang = (code) => {
    setLanguage(code)
    try {
      localStorage.setItem('language', code)
    } catch {}
    setLangOpen(false)
  }

  // Choose trigger icon based on active theme
  const renderTriggerIcon = () => {
    if (theme === 'dark') {
      return <Moon size={18} className="text-slate-700 dark:text-slate-200" />
    }
    if (theme === 'system') {
      return <Monitor size={18} className="text-slate-700 dark:text-slate-200" />
    }
    return <Sun size={18} className="text-slate-700 dark:text-slate-200" />
  }

  return (
    <div className="flex items-center gap-2">
      {/* Language Switcher Badge */}
      {showLanguage && (
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => {
              setLangOpen(!langOpen)
              setIsOpen(false)
            }}
            className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all text-xs font-semibold shadow-xs"
            title="Pilih Bahasa"
          >
            <span className="text-sm leading-none" role="img" aria-label="flag">
              {language === 'ID' ? '🇮🇩' : '🇬🇧'}
            </span>
            <span>{language}</span>
          </button>

          {/* Language Dropdown */}
          {langOpen && (
            <div className="absolute right-0 mt-1.5 w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1 z-50 text-xs">
              <button
                type="button"
                onClick={() => handleSelectLang('ID')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                  language === 'ID'
                    ? 'bg-slate-100 dark:bg-slate-700/70 font-semibold text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>🇮🇩</span>
                  <span>ID</span>
                </span>
                {language === 'ID' && <Check size={13} className="text-brand-purple" />}
              </button>
              <button
                type="button"
                onClick={() => handleSelectLang('EN')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                  language === 'EN'
                    ? 'bg-slate-100 dark:bg-slate-700/70 font-semibold text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>🇬🇧</span>
                  <span>EN</span>
                </span>
                {language === 'EN' && <Check size={13} className="text-brand-purple" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Theme Toggle Button */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen)
            setLangOpen(false)
          }}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-xs"
          aria-label="Toggle Theme"
          title={`Tema: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
        >
          {renderTriggerIcon()}
        </button>

        {/* Theme Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 z-50 text-sm">
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                theme === 'light'
                  ? 'bg-slate-100 dark:bg-slate-700/70 font-semibold text-slate-900 dark:text-white'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>Light</span>
              {theme === 'light' && <Check size={14} className="text-brand-purple" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                theme === 'dark'
                  ? 'bg-slate-100 dark:bg-slate-700/70 font-semibold text-slate-900 dark:text-white'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>Dark</span>
              {theme === 'dark' && <Check size={14} className="text-brand-purple" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('system')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                theme === 'system'
                  ? 'bg-slate-100 dark:bg-slate-700/70 font-semibold text-slate-900 dark:text-white'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>System</span>
              {theme === 'system' && <Check size={14} className="text-brand-purple" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
