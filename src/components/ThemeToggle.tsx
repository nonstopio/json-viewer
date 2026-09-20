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

  /* Native radios rather than buttons with aria-pressed: three mutually
     exclusive choices are a radio group, and the platform then gives the
     arrow-key roving and the single tab stop for free. The inputs are hidden
     from sight but not from the accessibility tree, so the label is the whole
     segment and the focus ring lands on it. */
  return (
    <div className="ground" role="radiogroup" aria-label="Colour ground">
      {OPTIONS.map(({value, label}) => (
        <label
          key={value}
          data-tooltip={
            value === "system"
              ? `Follow the system setting (now ${ground})`
              : `Use the ${label.toLowerCase()} ground`
          }
        >
          <input
            type="radio"
            name="ground"
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
          />
          {label}
        </label>
      ))}
    </div>
  );
};
