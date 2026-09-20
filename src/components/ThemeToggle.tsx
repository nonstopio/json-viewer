import React, {useState, useRef, useEffect} from "react";
import {Sun, Moon, Monitor, ChevronDown} from "lucide-react";
import {useTheme, Theme} from "../hooks/useTheme";

export const ThemeToggle: React.FC = () => {
  const {theme, effectiveTheme, setTheme} = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getThemeIcon = (themeMode: Theme, isEffective = false) => {
    const iconClass = "w-4 h-4";

    if (themeMode === "system") {
      return <Monitor className={iconClass} />;
    }

    const displayTheme = isEffective ? effectiveTheme : themeMode;
    return displayTheme === "dark" ? (
      <Moon className={iconClass} />
    ) : (
      <Sun className={iconClass} />
    );
  };

  // The stored values stay "light"/"dark" so existing preferences keep
  // working; only the labels name the grounds the design system defines.
  const getThemeLabel = (themeMode: Theme) => {
    switch (themeMode) {
      case "light":
        return "Paper";
      case "dark":
        return "Ink";
      case "system":
        return "System";
    }
  };

  const themes: Theme[] = ["light", "dark", "system"];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn--ghost btn--sm min-w-[7.5rem]"
        data-tooltip="Change theme"
      >
        {getThemeIcon(theme, true)}
        <span className="hidden text-sm font-medium sm:inline">
          {getThemeLabel(theme)}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-36 border border-line-2 bg-panel shadow-lg">
          <div className="py-1">
            {themes.map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => {
                  setTheme(themeOption);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center space-x-2 px-3 py-2 text-left text-sm transition-colors hover:bg-hover ${
                  theme === themeOption ? "bg-spot-soft text-spot" : "text-ink"
                }`}
              >
                {getThemeIcon(themeOption)}
                <span className="text-sm">
                  {getThemeLabel(themeOption)}
                  {themeOption === "system" && (
                    <span className="ml-1 font-mono text-[10px] uppercase tracking-caps text-faint">
                      {getThemeLabel(effectiveTheme)}
                    </span>
                  )}
                </span>
                {theme === themeOption && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-spot" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
