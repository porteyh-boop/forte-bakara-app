/**
 * FORTE V2 Design System — shared Tailwind class tokens.
 * Visual only; use across all master-v2 components.
 */

export const FORTE_V2_ROOT_CLASS = "forte-v2";

export const fv2 = {
  /* Layout */
  pageBg: "bg-forte-background",
  surface: "bg-forte-surface",
  pageContent: "flex-1 min-w-0 bg-forte-background",

  /* Typography */
  pageTitle: "text-2xl font-semibold text-forte-text",
  pageTitleSm: "text-lg font-bold text-forte-text leading-tight",
  sectionTitle: "text-sm font-semibold text-forte-text",
  subtitle: "text-xs text-forte-text-secondary",
  body: "text-sm text-forte-text",
  bodyXs: "text-xs text-forte-text",
  label: "text-xs text-forte-text-secondary",
  link: "text-forte-text-secondary hover:text-forte-text transition-colors",
  linkSm: "text-[11px] font-medium text-forte-text/60 hover:text-forte-text",

  /* Borders & dividers */
  border: "border-forte-border",
  borderB: "border-b border-forte-border",
  borderT: "border-t border-forte-border",
  divider: "border-forte-border/60",

  /* Cards & panels */
  card: "rounded-xl border border-forte-border bg-forte-surface shadow-sm",
  cardMd: "rounded-lg border border-forte-border bg-forte-surface shadow-sm",
  panel: "rounded-lg border border-forte-border bg-forte-surface p-4",
  sectionHeader: "px-8 py-6 border-b border-forte-border bg-forte-surface",

  /* Buttons */
  btnPrimary:
    "rounded-lg bg-forte-primary px-4 py-2 text-sm font-semibold text-white hover:bg-forte-primary-hover focus:outline-none focus:ring-2 focus:ring-forte-primary/20 disabled:opacity-50 transition-colors",
  btnPrimarySm:
    "rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-forte-primary-hover focus:outline-none focus:ring-2 focus:ring-forte-primary/20 disabled:opacity-40 transition-colors",
  btnSecondary:
    "rounded-lg border border-forte-border bg-forte-surface px-4 py-2 text-sm font-semibold text-forte-text hover:bg-forte-blue-light/50 focus:outline-none focus:ring-2 focus:ring-forte-primary/10 disabled:opacity-50 transition-colors",
  btnSecondarySm:
    "rounded-md border border-forte-border bg-forte-surface px-3 py-1.5 text-xs font-semibold text-forte-text hover:bg-forte-blue-light/50 focus:outline-none focus:ring-2 focus:ring-forte-primary/10 disabled:opacity-40 transition-colors",
  btnDangerSm:
    "rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors",
  btnDangerOutlineSm:
    "rounded-md border border-red-200 bg-forte-surface px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40 transition-colors",

  /* Forms */
  input:
    "w-full rounded-lg border border-forte-border bg-forte-surface px-3 py-2 text-sm text-forte-text placeholder:text-forte-text-secondary focus:outline-none focus:ring-2 focus:ring-forte-primary/15 focus:border-forte-primary transition-colors",
  inputLg:
    "w-full rounded-xl border border-forte-border bg-forte-surface px-4 py-3 text-sm text-forte-text placeholder:text-forte-text-secondary focus:outline-none focus:ring-2 focus:ring-forte-primary/15 focus:border-forte-primary transition-colors",
  inputSm:
    "rounded-md border border-forte-border bg-forte-surface px-3 py-1.5 text-xs text-forte-text placeholder:text-forte-text-secondary focus:outline-none focus:ring-2 focus:ring-forte-primary/15 focus:border-forte-primary transition-colors",
  select:
    "rounded-lg border border-forte-border bg-forte-surface px-3 py-2 text-sm text-forte-text focus:outline-none focus:ring-2 focus:ring-forte-primary/15 focus:border-forte-primary",
  selectInline: "bg-transparent text-forte-text focus:outline-none",
  filterChip:
    "inline-flex items-center gap-2 rounded-lg border border-forte-border bg-forte-surface px-3 py-2 text-sm text-forte-text",

  /* Tables */
  tableShell: "rounded-xl border border-forte-border bg-forte-surface overflow-hidden",
  tableHead: "border-b border-forte-border bg-forte-table-header text-xs text-forte-text-secondary",
  tableHeadCell: "py-3 px-3 font-medium text-forte-text text-right",
  tableRow: "border-b border-forte-border/60 hover:bg-forte-blue-light/40 transition-colors",
  tableRowClickable: "border-b border-forte-border/60 cursor-pointer hover:bg-forte-blue-light/40 transition-colors",
  tableCell: "py-3 px-3 text-forte-text",
  tableCellSecondary: "py-3 px-3 text-forte-text/90",

  /* Sidebar */
  sidebar: "w-[220px] shrink-0 border-r border-forte-border bg-forte-surface flex flex-col min-h-screen",
  sidebarBrand: "text-sm font-semibold text-forte-text",
  sidebarSubtitle: "text-xs text-forte-text-secondary mt-0.5",
  sidebarItem:
    "block w-full text-right rounded-lg px-3 py-2 text-sm transition-colors text-forte-text/80 hover:bg-forte-blue-light/60 hover:text-forte-text",
  sidebarItemActive:
    "block w-full text-right rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-forte-blue-light text-forte-text",
  sidebarItemDisabled: "text-forte-text-secondary/50 cursor-not-allowed",

  /* Tabs */
  tab: "relative shrink-0 h-9 px-3 text-xs font-medium transition-colors whitespace-nowrap text-forte-text-secondary hover:text-forte-text hover:bg-forte-blue-light/40",
  tabActive: "relative shrink-0 h-9 px-3 text-xs font-semibold transition-colors whitespace-nowrap text-forte-text",
  tabIndicator: "absolute inset-x-2 bottom-0 h-0.5 bg-forte-primary rounded-full",

  /* Dialogs */
  dialogOverlay: "fixed inset-0 z-[100] flex items-center justify-center bg-forte-text/30 p-4",
  dialogPanel:
    "w-full bg-forte-surface rounded-xl border border-forte-border shadow-lg",
  dialogPanelMd: "max-w-md",
  dialogPanelLg: "max-w-lg",
  dialogPanelXl: "max-w-2xl",
  dialogHeader: "text-sm font-semibold text-forte-text",
  dialogClose: "text-sm text-forte-text-secondary hover:text-forte-text",

  /* Badges */
  badge: "inline-flex rounded-md px-2 py-0.5 text-xs font-medium text-forte-text bg-forte-blue-light/70",
  badgeNeutral: "inline-flex rounded-md px-2 py-0.5 text-xs font-medium text-forte-text-secondary bg-forte-blue-light/50",

  /* Empty & loading */
  emptyState: "text-sm text-forte-text-secondary text-center",
  loadingText: "text-xs text-forte-text-secondary",

  /* Toolbar */
  toolbar: "flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-forte-border/60 shrink-0",

  /* Legacy embed wrapper */
  legacyEmbed:
    "flex-1 min-h-0 overflow-auto fv2-legacy-embed [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-xs [&_.space-y-4]:space-y-3 [&_.rounded-2xl]:rounded-lg [&_.rounded-2xl]:border-forte-border",
} as const;
