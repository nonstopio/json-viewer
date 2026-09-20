import React from "react";
import {useTheme, Theme} from "../hooks/useTheme";

/* The ground picker. A bordered strip of segments rather than a dropdown:
   there are only three choices and the current one should be readable
   without opening anything.

   The labels are the grounds the design system defines — see
   src/styles/tokens.css. "Auto" follows the OS; the stored values stay
   "light"/"dark"/"system" so preferences already in localStorage keep
   working. */
const OPTIONS: {value: Theme; label: string}[] = [
  {value: "dark", label: "Ink"},
  {value: "light", label: "Paper"},
  {value: "system", label: "Auto"},
];

export const ThemeToggle: React.FC = () => {
  const {theme, ground, setTheme} = useTheme();

  return (
    <div className="ground" role="group" aria-label="Colour ground">
      {OPTIONS.map(({value, label}) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          data-tooltip={
            value === "system"
              ? `Follow the system setting (now ${ground})`
              : `Use the ${label.toLowerCase()} ground`
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
};
