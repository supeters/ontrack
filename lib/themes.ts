// Theme configurations for OnTrack
// Each theme provides color classes for different UI elements

export interface ThemeColors {
  // Background
  bg: string;
  cardBg: string;

  // Module header
  moduleHeader: string;
  moduleText: string;
  moduleIcon: string;
  moduleBorder: string;

  // Workgroup header
  workgroupHeader: string;
  workgroupText: string;
  workgroupIcon: string;
  workgroupBg: string;

  // Activity row
  activityHover: string;
  activityText: string;
  activityIcon: string;
  activityBorderHover: string;

  // Stats/metadata
  statText: string;
  mutedText: string;
  divider: string;

  // Checkbox
  checkboxBorder: string;
  checkboxChecked: string;
}

export interface Theme {
  name: string;
  description: string;
  colors: ThemeColors;
}

export const themes: Record<string, Theme> = {
  warm: {
    name: 'Warm',
    description: 'Soft and cozy',
    colors: {
      // Background
      bg: 'bg-stone-50',
      cardBg: 'bg-white',

      // Module header
      moduleHeader: 'bg-stone-50 hover:bg-stone-100',
      moduleText: 'text-stone-800',
      moduleIcon: 'text-stone-600',
      moduleBorder: 'border-stone-200',

      // Workgroup header
      workgroupHeader: 'bg-stone-50/50 hover:bg-stone-100/50',
      workgroupText: 'text-stone-700',
      workgroupIcon: 'text-stone-500',
      workgroupBg: 'bg-stone-50/30',

      // Activity row
      activityHover: 'hover:bg-stone-50 hover:border-stone-300',
      activityText: 'text-stone-700',
      activityIcon: 'text-stone-500',
      activityBorderHover: 'border-transparent hover:border-stone-300',

      // Stats/metadata
      statText: 'text-stone-600',
      mutedText: 'text-stone-500',
      divider: 'divide-stone-100 border-stone-100',

      // Checkbox
      checkboxBorder: 'border-stone-300 group-hover:border-stone-500',
      checkboxChecked: 'bg-stone-600 border-stone-600',
    }
  },

  ocean: {
    name: 'Ocean',
    description: 'Calm and focused',
    colors: {
      bg: 'bg-sky-50',
      cardBg: 'bg-white',

      moduleHeader: 'bg-sky-100/50 hover:bg-sky-100',
      moduleText: 'text-sky-900',
      moduleIcon: 'text-sky-600',
      moduleBorder: 'border-sky-200',

      workgroupHeader: 'bg-sky-50/50 hover:bg-sky-100/50',
      workgroupText: 'text-sky-800',
      workgroupIcon: 'text-sky-500',
      workgroupBg: 'bg-sky-50/30',

      activityHover: 'hover:bg-sky-50 hover:border-sky-300',
      activityText: 'text-sky-900',
      activityIcon: 'text-sky-600',
      activityBorderHover: 'border-transparent hover:border-sky-300',

      statText: 'text-sky-700',
      mutedText: 'text-sky-600',
      divider: 'divide-sky-100 border-sky-100',

      checkboxBorder: 'border-sky-300 group-hover:border-sky-500',
      checkboxChecked: 'bg-sky-600 border-sky-600',
    }
  },

  forest: {
    name: 'Forest',
    description: 'Natural and calm',
    colors: {
      bg: 'bg-emerald-50',
      cardBg: 'bg-white',

      moduleHeader: 'bg-emerald-100/50 hover:bg-emerald-100',
      moduleText: 'text-emerald-900',
      moduleIcon: 'text-emerald-600',
      moduleBorder: 'border-emerald-200',

      workgroupHeader: 'bg-emerald-50/50 hover:bg-emerald-100/50',
      workgroupText: 'text-emerald-800',
      workgroupIcon: 'text-emerald-500',
      workgroupBg: 'bg-emerald-50/30',

      activityHover: 'hover:bg-emerald-50 hover:border-emerald-300',
      activityText: 'text-emerald-900',
      activityIcon: 'text-emerald-600',
      activityBorderHover: 'border-transparent hover:border-emerald-300',

      statText: 'text-emerald-700',
      mutedText: 'text-emerald-600',
      divider: 'divide-emerald-100 border-emerald-100',

      checkboxBorder: 'border-emerald-300 group-hover:border-emerald-500',
      checkboxChecked: 'bg-emerald-600 border-emerald-600',
    }
  },

  lavender: {
    name: 'Lavender',
    description: 'Gentle and soothing',
    colors: {
      bg: 'bg-purple-50',
      cardBg: 'bg-white',

      moduleHeader: 'bg-purple-100/50 hover:bg-purple-100',
      moduleText: 'text-purple-900',
      moduleIcon: 'text-purple-600',
      moduleBorder: 'border-purple-200',

      workgroupHeader: 'bg-purple-50/50 hover:bg-purple-100/50',
      workgroupText: 'text-purple-800',
      workgroupIcon: 'text-purple-500',
      workgroupBg: 'bg-purple-50/30',

      activityHover: 'hover:bg-purple-50 hover:border-purple-300',
      activityText: 'text-purple-900',
      activityIcon: 'text-purple-600',
      activityBorderHover: 'border-transparent hover:border-purple-300',

      statText: 'text-purple-700',
      mutedText: 'text-purple-600',
      divider: 'divide-purple-100 border-purple-100',

      checkboxBorder: 'border-purple-300 group-hover:border-purple-500',
      checkboxChecked: 'bg-purple-600 border-purple-600',
    }
  },

  peach: {
    name: 'Peach',
    description: 'Warm and cheerful',
    colors: {
      bg: 'bg-orange-50',
      cardBg: 'bg-white',

      moduleHeader: 'bg-orange-100/50 hover:bg-orange-100',
      moduleText: 'text-orange-900',
      moduleIcon: 'text-orange-600',
      moduleBorder: 'border-orange-200',

      workgroupHeader: 'bg-orange-50/50 hover:bg-orange-100/50',
      workgroupText: 'text-orange-800',
      workgroupIcon: 'text-orange-500',
      workgroupBg: 'bg-orange-50/30',

      activityHover: 'hover:bg-orange-50 hover:border-orange-300',
      activityText: 'text-orange-900',
      activityIcon: 'text-orange-600',
      activityBorderHover: 'border-transparent hover:border-orange-300',

      statText: 'text-orange-700',
      mutedText: 'text-orange-600',
      divider: 'divide-orange-100 border-orange-100',

      checkboxBorder: 'border-orange-300 group-hover:border-orange-500',
      checkboxChecked: 'bg-orange-600 border-orange-600',
    }
  },

  slate: {
    name: 'Slate',
    description: 'Cool and minimal',
    colors: {
      bg: 'bg-slate-50',
      cardBg: 'bg-white',

      moduleHeader: 'bg-slate-100/50 hover:bg-slate-100',
      moduleText: 'text-slate-900',
      moduleIcon: 'text-slate-600',
      moduleBorder: 'border-slate-200',

      workgroupHeader: 'bg-slate-50/50 hover:bg-slate-100/50',
      workgroupText: 'text-slate-800',
      workgroupIcon: 'text-slate-500',
      workgroupBg: 'bg-slate-50/30',

      activityHover: 'hover:bg-slate-50 hover:border-slate-300',
      activityText: 'text-slate-900',
      activityIcon: 'text-slate-600',
      activityBorderHover: 'border-transparent hover:border-slate-300',

      statText: 'text-slate-700',
      mutedText: 'text-slate-600',
      divider: 'divide-slate-100 border-slate-100',

      checkboxBorder: 'border-slate-300 group-hover:border-slate-500',
      checkboxChecked: 'bg-slate-600 border-slate-600',
    }
  },
};

export const getTheme = (themeName: string): Theme => {
  return themes[themeName] || themes.warm;
};
