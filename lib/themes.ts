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

  // Sidebar
  sidebarBg: string;
  sidebarBorder: string;
  sidebarItemBg: string;
  sidebarItemText: string;
  sidebarItemHover: string;
  sidebarItemBorder: string;
  sidebarSelectedBg: string;
  sidebarSelectedText: string;
  sidebarSelectedBorder: string;

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
  ancientParchment: {
    name: 'Ancient Parchment',
    description: 'Classic manuscript warmth',
    colors: {
      bg: 'bg-[#f4efe6]',
      cardBg: 'bg-[#fcfaf7]',

      moduleHeader: 'bg-[#e6ddcd] hover:bg-[#ded2bf]',
      moduleText: 'text-[#3d3122]',
      moduleIcon: 'text-[#8c5a2b]',
      moduleBorder: 'border-[#d4c5b0]',

      workgroupHeader: 'bg-[#eee7db] hover:bg-[#e4dacb]',
      workgroupText: 'text-[#2b2217]',
      workgroupIcon: 'text-[#73421d]',
      workgroupBg: 'bg-[#f7f3ec]',

      activityHover: 'hover:bg-[#efe8dc] hover:border-[#b8a383]',
      activityText: 'text-[#2c2318]',
      activityIcon: 'text-[#8c5a2b]',
      activityBorderHover: 'border-transparent hover:border-[#b8a383]',

      statText: 'text-[#615241]',
      mutedText: 'text-[#7d6c59]',
      divider: 'divide-[#e0d5c3] border-[#e0d5c3]',

      checkboxBorder: 'border-[#b8a383] group-hover:border-[#8c5a2b]',
      checkboxChecked: 'bg-[#8c5a2b] border-[#8c5a2b]',
      sidebarBg: 'bg-[#e8dfcf]',
      sidebarBorder: 'border-[#d1c2aa]',
      sidebarItemBg: 'bg-[#f5f0e6]',
      sidebarItemText: 'text-[#362b1e]',
      sidebarItemHover: 'hover:bg-[#dfd3bf] hover:border-[#b8a383]',
      sidebarItemBorder: 'border-[#d8caa5]',
      sidebarSelectedBg: 'bg-[#fcfaf7]',
      sidebarSelectedText: 'text-[#241c13]',
      sidebarSelectedBorder: 'border-[#8c5a2b]',
    }
  },

  terracottaRose: {
    name: 'Terracotta Rose',
    description: 'Warm dusty pink and clay parchment',
    colors: {
      bg: 'bg-[#f7ecea]',
      cardBg: 'bg-[#fdf9f8]',

      moduleHeader: 'bg-[#ebd8d4] hover:bg-[#dfc8c3]',
      moduleText: 'text-[#3b2321]',
      moduleIcon: 'text-[#a15349]',
      moduleBorder: 'border-[#d8beba]',

      workgroupHeader: 'bg-[#f2e1de] hover:bg-[#ebd2cd]',
      workgroupText: 'text-[#2e1917]',
      workgroupIcon: 'text-[#883e35]',
      workgroupBg: 'bg-[#f9f0ee]',

      activityHover: 'hover:bg-[#f2e1de] hover:border-[#c49a93]',
      activityText: 'text-[#3b2321]',
      activityIcon: 'text-[#a15349]',
      activityBorderHover: 'border-transparent hover:border-[#c49a93]',

      statText: 'text-[#61423e]',
      mutedText: 'text-[#805e59]',
      divider: 'divide-[#e3ceca] border-[#e3ceca]',

      checkboxBorder: 'border-[#c49a93] group-hover:border-[#a15349]',
      checkboxChecked: 'bg-[#a15349] border-[#a15349]',
      sidebarBg: 'bg-[#eede2d7]',
      sidebarBorder: 'border-[#d8beba]',
      sidebarItemBg: 'bg-[#f5e7e4]',
      sidebarItemText: 'text-[#3b2321]',
      sidebarItemHover: 'hover:bg-[#e6d0cb] hover:border-[#c49a93]',
      sidebarItemBorder: 'border-[#dec2bc]',
      sidebarSelectedBg: 'bg-[#fdf9f8]',
      sidebarSelectedText: 'text-[#2e1917]',
      sidebarSelectedBorder: 'border-[#a15349]',
    }
  },

  goldenAmber: {
    name: 'Golden Amber',
    description: 'Warm honey parchment and terracotta accents',
    colors: {
      bg: 'bg-[#f7f0e6]',
      cardBg: 'bg-[#fdfbf7]',

      moduleHeader: 'bg-[#ebdec9] hover:bg-[#dfceb3]',
      moduleText: 'text-[#3b2d18]',
      moduleIcon: 'text-[#a86c23]',
      moduleBorder: 'border-[#d8c3a5]',

      workgroupHeader: 'bg-[#f2e6d2] hover:bg-[#ebd8bc]',
      workgroupText: 'text-[#2c200e]',
      workgroupIcon: 'text-[#8a5312]',
      workgroupBg: 'bg-[#f9f3e9]',

      activityHover: 'hover:bg-[#f2e6d2] hover:border-[#c2a176]',
      activityText: 'text-[#3b2d18]',
      activityIcon: 'text-[#a86c23]',
      activityBorderHover: 'border-transparent hover:border-[#c2a176]',

      statText: 'text-[#614d2e]',
      mutedText: 'text-[#806a49]',
      divider: 'divide-[#e3d3ba] border-[#e3d3ba]',

      checkboxBorder: 'border-[#c2a176] group-hover:border-[#a86c23]',
      checkboxChecked: 'bg-[#a86c23] border-[#a86c23]',
      sidebarBg: 'bg-[#ebdcb9]',
      sidebarBorder: 'border-[#d8c3a5]',
      sidebarItemBg: 'bg-[#f5e9d5]',
      sidebarItemText: 'text-[#3b2d18]',
      sidebarItemHover: 'hover:bg-[#e6d4b8] hover:border-[#c2a176]',
      sidebarItemBorder: 'border-[#dec9ab]',
      sidebarSelectedBg: 'bg-[#fdfbf7]',
      sidebarSelectedText: 'text-[#2c200e]',
      sidebarSelectedBorder: 'border-[#a86c23]',
    }
  },

  softSkies: {
    name: 'Soft Skies',
    description: 'Muted parchment blue with dark accents',
    colors: {
      bg: 'bg-[#ebf3f7]',
      cardBg: 'bg-[#f7fafc]',

      moduleHeader: 'bg-[#d8e7f0] hover:bg-[#cbe0ed]',
      moduleText: 'text-[#1e293b]',
      moduleIcon: 'text-[#325a7a]',
      moduleBorder: 'border-[#c2d7e5]',

      workgroupHeader: 'bg-[#e3eff5] hover:bg-[#d8e7f0]',
      workgroupText: 'text-[#0f172a]',
      workgroupIcon: 'text-[#2b4c68]',
      workgroupBg: 'bg-[#f0f6fa]',

      activityHover: 'hover:bg-[#e3eff5] hover:border-[#9ec0d6]',
      activityText: 'text-[#1e293b]',
      activityIcon: 'text-[#325a7a]',
      activityBorderHover: 'border-transparent hover:border-[#9ec0d6]',

      statText: 'text-[#475569]',
      mutedText: 'text-[#64748b]',
      divider: 'divide-[#d4e3ed] border-[#d4e3ed]',

      checkboxBorder: 'border-[#9ec0d6] group-hover:border-[#325a7a]',
      checkboxChecked: 'bg-[#325a7a] border-[#325a7a]',
      sidebarBg: 'bg-[#dce9f0]',
      sidebarBorder: 'border-[#c2d7e5]',
      sidebarItemBg: 'bg-[#eaf2f7]',
      sidebarItemText: 'text-[#1e293b]',
      sidebarItemHover: 'hover:bg-[#d4e5f0] hover:border-[#9ec0d6]',
      sidebarItemBorder: 'border-[#cbdce7]',
      sidebarSelectedBg: 'bg-[#f7fafc]',
      sidebarSelectedText: 'text-[#0f172a]',
      sidebarSelectedBorder: 'border-[#325a7a]',
    }
  },

  pastelGarden: {
    name: 'Pastel Garden',
    description: 'Earthy warm sage and parchment tones',
    colors: {
      bg: 'bg-[#edebe1]',
      cardBg: 'bg-[#f8f7f2]',

      moduleHeader: 'bg-[#dcd8c8] hover:bg-[#d1cbba]',
      moduleText: 'text-[#2a3328]',
      moduleIcon: 'text-[#4d6148]',
      moduleBorder: 'border-[#c7c0ad]',

      workgroupHeader: 'bg-[#e5e1d3] hover:bg-[#dad5c5]',
      workgroupText: 'text-[#1d241c]',
      workgroupIcon: 'text-[#3e4f3a]',
      workgroupBg: 'bg-[#f1eee3]',

      activityHover: 'hover:bg-[#e5e1d3] hover:border-[#a89f88]',
      activityText: 'text-[#2a3328]',
      activityIcon: 'text-[#4d6148]',
      activityBorderHover: 'border-transparent hover:border-[#a89f88]',

      statText: 'text-[#52594e]',
      mutedText: 'text-[#6e756a]',
      divider: 'divide-[#dad4c3] border-[#dad4c3]',

      checkboxBorder: 'border-[#a89f88] group-hover:border-[#4d6148]',
      checkboxChecked: 'bg-[#4d6148] border-[#4d6148]',
      sidebarBg: 'bg-[#e0dbc9]',
      sidebarBorder: 'border-[#c7c0ad]',
      sidebarItemBg: 'bg-[#eae6d8]',
      sidebarItemText: 'text-[#2a3328]',
      sidebarItemHover: 'hover:bg-[#d8d2bf] hover:border-[#a89f88]',
      sidebarItemBorder: 'border-[#cecaa8]',
      sidebarSelectedBg: 'bg-[#f8f7f2]',
      sidebarSelectedText: 'text-[#1d241c]',
      sidebarSelectedBorder: 'border-[#4d6148]',
    }
  },

  softWisteria: {
    name: 'Soft Wisteria',
    description: 'Warm mauve and soft heather parchment',
    colors: {
      bg: 'bg-[#f2ecf3]',
      cardBg: 'bg-[#fcf9fc]',

      moduleHeader: 'bg-[#e3d7e5] hover:bg-[#d7c7d9]',
      moduleText: 'text-[#332235]',
      moduleIcon: 'text-[#6b4773]',
      moduleBorder: 'border-[#cebdce]',

      workgroupHeader: 'bg-[#eae0eb] hover:bg-[#dfd1e0]',
      workgroupText: 'text-[#241626]',
      workgroupIcon: 'text-[#58395f]',
      workgroupBg: 'bg-[#f6eff7]',

      activityHover: 'hover:bg-[#eae0eb] hover:border-[#b096b3]',
      activityText: 'text-[#332235]',
      activityIcon: 'text-[#6b4773]',
      activityBorderHover: 'border-transparent hover:border-[#b096b3]',

      statText: 'text-[#574659]',
      mutedText: 'text-[#756278]',
      divider: 'divide-[#ded0df] border-[#ded0df]',

      checkboxBorder: 'border-[#b096b3] group-hover:border-[#6b4773]',
      checkboxChecked: 'bg-[#6b4773] border-[#6b4773]',
      sidebarBg: 'bg-[#e6d9e8]',
      sidebarBorder: 'border-[#cebdce]',
      sidebarItemBg: 'bg-[#f0e6f2]',
      sidebarItemText: 'text-[#332235]',
      sidebarItemHover: 'hover:bg-[#dfd0e0] hover:border-[#b096b3]',
      sidebarItemBorder: 'border-[#d4c4d5]',
      sidebarSelectedBg: 'bg-[#fcf9fc]',
      sidebarSelectedText: 'text-[#241626]',
      sidebarSelectedBorder: 'border-[#6b4773]',
    }
  },

  midnightLibrary: {
    name: 'Midnight Library',
    description: 'Deep forest green manuscript dark mode',
    colors: {
      bg: 'bg-[#121a17]',
      cardBg: 'bg-[#182420]',

      moduleHeader: 'bg-[#21332d] hover:bg-[#2a423a]',
      moduleText: 'text-[#e2ece8]',
      moduleIcon: 'text-[#82b8a5]',
      moduleBorder: 'border-[#2d473e]',

      workgroupHeader: 'bg-[#1c2e28] hover:bg-[#253b34]',
      workgroupText: 'text-[#f0f7f4]',
      workgroupIcon: 'text-[#a2d4c3]',
      workgroupBg: 'bg-[#15211d]',

      activityHover: 'hover:bg-[#21332d] hover:border-[#3e6357]',
      activityText: 'text-[#d5e3de]',
      activityIcon: 'text-[#82b8a5]',
      activityBorderHover: 'border-transparent hover:border-[#3e6357]',

      statText: 'text-[#8ea8a0]',
      mutedText: 'text-[#6a857d]',
      divider: 'divide-[#253b34] border-[#253b34]',

      checkboxBorder: 'border-[#3e6357] group-hover:border-[#82b8a5]',
      checkboxChecked: 'bg-[#82b8a5] border-[#82b8a5]',
      sidebarBg: 'bg-[#0f1714]',
      sidebarBorder: 'border-[#233831]',
      sidebarItemBg: 'bg-[#16221e]',
      sidebarItemText: 'text-[#cbe0d8]',
      sidebarItemHover: 'hover:bg-[#21332d] hover:border-[#3e6357]',
      sidebarItemBorder: 'border-[#233831]',
      sidebarSelectedBg: 'bg-[#233831]',
      sidebarSelectedText: 'text-[#f0f7f4]',
      sidebarSelectedBorder: 'border-[#82b8a5]',
    }
  },

  deepSpace: {
    name: 'Deep Space',
    description: 'Rich dark obsidian and indigo tones',
    colors: {
      bg: 'bg-[#0f111a]',
      cardBg: 'bg-[#171926]',

      moduleHeader: 'bg-[#222638] hover:bg-[#2b3047]',
      moduleText: 'text-[#e1e5f2]',
      moduleIcon: 'text-[#7b93db]',
      moduleBorder: 'border-[#2f354f]',

      workgroupHeader: 'bg-[#1c2030] hover:bg-[#252a3f]',
      workgroupText: 'text-[#f0f3fc]',
      workgroupIcon: 'text-[#9cb1f2]',
      workgroupBg: 'bg-[#131521]',

      activityHover: 'hover:bg-[#222638] hover:border-[#414d73]',
      activityText: 'text-[#d1d7e8]',
      activityIcon: 'text-[#7b93db]',
      activityBorderHover: 'border-transparent hover:border-[#414d73]',

      statText: 'text-[#8692b8]',
      mutedText: 'text-[#636f94]',
      divider: 'divide-[#272c42] border-[#272c42]',

      checkboxBorder: 'border-[#414d73] group-hover:border-[#7b93db]',
      checkboxChecked: 'bg-[#7b93db] border-[#7b93db]',
      sidebarBg: 'bg-[#0b0c14]',
      sidebarBorder: 'border-[#23273b]',
      sidebarItemBg: 'bg-[#141624]',
      sidebarItemText: 'text-[#c6d0eb]',
      sidebarItemHover: 'hover:bg-[#222638] hover:border-[#414d73]',
      sidebarItemBorder: 'border-[#23273b]',
      sidebarSelectedBg: 'bg-[#252a3f]',
      sidebarSelectedText: 'text-[#f0f3fc]',
      sidebarSelectedBorder: 'border-[#7b93db]',
    }
  }
};

export const getTheme = (themeName: string): Theme => {
  return themes[themeName] || themes.ancientParchment;
};