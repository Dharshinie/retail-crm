import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ThemeSettings = {
  backgroundId: string;
  customBackgroundUrl: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
};

type BackgroundPreset = {
  id: string;
  label: string;
  image: string;
};

type ThemeSettingsContextValue = {
  settings: ThemeSettings;
  backgrounds: BackgroundPreset[];
  activeBackground: string;
  updateSettings: (updates: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
};

const STORAGE_KEY = "shop-pulse-theme-settings";

const backgroundPresets: BackgroundPreset[] = [
  {
    id: "market",
    label: "Fresh Market",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "produce",
    label: "Produce Wall",
    image: "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "shelves",
    label: "Store Shelves",
    image: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "minimal",
    label: "Minimal Gradient",
    image: "",
  },
];

const defaultSettings: ThemeSettings = {
  backgroundId: "market",
  customBackgroundUrl: "",
  primaryColor: "#2fbf7c",
  accentColor: "#f5b946",
  surfaceColor: "#182433",
};

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(hex: string) {
  const value = hex.trim();
  if (!value) return "#000000";
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  return "#000000";
}

function hexToRgb(hex: string) {
  const value = normalizeHex(hex).slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case red:
        h = 60 * (((green - blue) / delta) % 6);
        break;
      case green:
        h = 60 * ((blue - red) / delta + 2);
        break;
      default:
        h = 60 * ((red - green) / delta + 4);
        break;
    }
  }

  return {
    h: Math.round(h < 0 ? h + 360 : h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslTriplet(hex: string, saturationFloor = 20) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return `${h} ${Math.max(s, saturationFloor)}% ${l}%`;
}

function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement;
  const primary = rgbToHsl(hexToRgb(settings.primaryColor));
  const accent = rgbToHsl(hexToRgb(settings.accentColor));
  const surface = rgbToHsl(hexToRgb(settings.surfaceColor));
  const surfaceSaturation = clamp(surface.s, 10, 32);

  root.style.setProperty("--background", `${surface.h} ${surfaceSaturation}% 8%`);
  root.style.setProperty("--foreground", "0 0% 95%");
  root.style.setProperty("--card", `${surface.h} ${surfaceSaturation}% 14%`);
  root.style.setProperty("--card-foreground", "0 0% 95%");
  root.style.setProperty("--popover", `${surface.h} ${surfaceSaturation}% 12%`);
  root.style.setProperty("--popover-foreground", "0 0% 95%");
  root.style.setProperty("--primary", `${primary.h} ${Math.max(primary.s, 35)}% ${clamp(primary.l, 38, 65)}%`);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--secondary", `${surface.h} ${surfaceSaturation}% 18%`);
  root.style.setProperty("--secondary-foreground", "0 0% 90%");
  root.style.setProperty("--muted", `${surface.h} ${surfaceSaturation}% 20%`);
  root.style.setProperty("--muted-foreground", `${surface.h} 10% 68%`);
  root.style.setProperty("--accent", `${accent.h} ${Math.max(accent.s, 45)}% ${clamp(accent.l, 42, 68)}%`);
  root.style.setProperty("--accent-foreground", "0 0% 100%");
  root.style.setProperty("--border", `${surface.h} ${surfaceSaturation}% 22%`);
  root.style.setProperty("--input", `${surface.h} ${surfaceSaturation}% 20%`);
  root.style.setProperty("--ring", `${primary.h} ${Math.max(primary.s, 35)}% ${clamp(primary.l, 38, 65)}%`);
  root.style.setProperty("--sidebar-background", `${surface.h} ${surfaceSaturation}% 6%`);
  root.style.setProperty("--sidebar-foreground", `${surface.h} 12% 76%`);
  root.style.setProperty("--sidebar-primary", `${primary.h} ${Math.max(primary.s, 35)}% ${clamp(primary.l, 42, 68)}%`);
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-accent", `${surface.h} ${surfaceSaturation}% 12%`);
  root.style.setProperty("--sidebar-accent-foreground", "0 0% 90%");
  root.style.setProperty("--sidebar-border", `${surface.h} ${surfaceSaturation}% 15%`);
  root.style.setProperty("--sidebar-ring", `${primary.h} ${Math.max(primary.s, 35)}% ${clamp(primary.l, 38, 65)}%`);
  root.style.setProperty("--success", `${primary.h} ${Math.max(primary.s, 35)}% ${clamp(primary.l, 38, 65)}%`);
  root.style.setProperty("--warning", `${accent.h} ${Math.max(accent.s, 45)}% ${clamp(accent.l, 42, 68)}%`);
  root.style.setProperty("--info", hslTriplet("#4fa6ff", 50));
  root.style.setProperty("--glass-bg", `${surface.h} ${surfaceSaturation}% 12% / 0.6`);
  root.style.setProperty("--glass-border", "0 0% 100% / 0.08");
  root.style.setProperty("--glass-highlight", "0 0% 100% / 0.05");
}

function getStoredSettings() {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    return {
      ...defaultSettings,
      ...parsed,
    };
  } catch {
    return defaultSettings;
  }
}

export function ThemeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);

  useEffect(() => {
    setSettings(getStoredSettings());
  }, []);

  useEffect(() => {
    applyTheme(settings);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<ThemeSettingsContextValue>(() => {
    const activeBackground =
      settings.backgroundId === "custom"
        ? settings.customBackgroundUrl.trim()
        : backgroundPresets.find((background) => background.id === settings.backgroundId)?.image ?? "";

    return {
      settings,
      backgrounds: backgroundPresets,
      activeBackground,
      updateSettings: (updates) => setSettings((current) => ({ ...current, ...updates })),
      resetSettings: () => setSettings(defaultSettings),
    };
  }, [settings]);

  return <ThemeSettingsContext.Provider value={value}>{children}</ThemeSettingsContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeSettingsContext);

  if (!context) {
    throw new Error("useThemeSettings must be used within ThemeSettingsProvider");
  }

  return context;
}
