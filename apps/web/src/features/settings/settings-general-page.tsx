import {
  RiComputerLine as Monitor,
  RiMoonLine as Moon,
  RiSunLine as Sun,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useUserPreferences } from "@/lib/local-hooks";
import { localStore, type ThemeMode } from "@/lib/local-store";
import { getThemeModeLabel, useResolvedTheme } from "@/lib/use-theme";

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  icon: typeof Sun;
  description: string;
}> = [
  {
    value: "system",
    icon: Monitor,
    description: "Follows your operating system preference",
  },
  {
    value: "light",
    icon: Sun,
    description: "Always use light appearance",
  },
  {
    value: "dark",
    icon: Moon,
    description: "Always use dark appearance",
  },
];

export function SettingsGeneralPage() {
  const preferences = useUserPreferences();
  const resolvedTheme = useResolvedTheme();

  const handleThemeChange = (mode: ThemeMode) => {
    localStore.setUserPreferences({ themeMode: mode });
  };

  return (
    <div className="settings-sections">
      <section className="settings-section">
        <h2 className="settings-section-title">Appearance</h2>
        <p className="settings-section-desc">
          Customize how the app looks. Choose between light and dark modes, or let it follow your system settings.
        </p>

        <div className="settings-panel">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground/90">Theme</label>
              <p className="text-sm text-foreground/60 mt-0.5">
                {preferences.themeMode === "system"
                  ? `Currently using ${resolvedTheme} mode based on system preference`
                  : `Using ${preferences.themeMode} mode`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = preferences.themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeChange(option.value)}
                    className={cn(
                      "theme-option-card",
                      isSelected && "theme-option-card-selected",
                    )}
                  >
                    <div className="theme-option-icon-wrapper">
                      <Icon className="theme-option-icon" />
                    </div>
                    <div className="theme-option-label">{getThemeModeLabel(option.value)}</div>
                    <div className="theme-option-description">{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
