"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/* ── Layout ── */

export function ForteV2TabShell({
  title,
  description,
  actions,
  children,
  workspace,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  workspace?: string;
}) {
  return (
    <MasterProjectV2Workspace data-workspace={workspace}>
      <div className="fv2-tab-shell-header">
        <ForteV2SectionHeader title={title} description={description} actions={actions} />
      </div>
      <div className="fv2-tab-content">{children}</div>
    </MasterProjectV2Workspace>
  );
}

export function ForteV2DetailGrid({
  items,
}: {
  items: Array<{ label: string; value: string; dir?: "ltr" | "rtl"; wide?: boolean }>;
}) {
  return (
    <div className="fv2-detail-grid">
      {items.map((item) => (
        <div
          key={item.label}
          className={[
            "fv2-detail-item",
            item.wide ? "sm:col-span-2 xl:col-span-3" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <dt className="fv2-detail-label">{item.label}</dt>
          <dd className="fv2-detail-value whitespace-pre-wrap" dir={item.dir}>
            {item.value || "—"}
          </dd>
        </div>
      ))}
    </div>
  );
}

export function MasterProjectV2Workspace({
  children,
  "data-workspace": dataWorkspace,
}: {
  children: ReactNode;
  "data-workspace"?: string;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full" data-workspace={dataWorkspace}>
      {children}
    </div>
  );
}

/* ── Page header ── */

export function ForteV2PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="fv2-page-header">
      <div className="fv2-page-header-inner">
        <div>
          <h1 className="fv2-page-title">{title}</h1>
          {subtitle && <p className="fv2-page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/* ── Toolbar ── */

export function ForteV2ToolbarCard({ children }: { children: ReactNode }) {
  return <div className="fv2-toolbar-card">{children}</div>;
}

export function ForteV2ToolbarRow({ children }: { children: ReactNode }) {
  return <div className="fv2-toolbar-row">{children}</div>;
}

export function ForteV2SearchField({
  value,
  onChange,
  placeholder = "חיפוש...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`fv2-search-wrap ${className ?? ""}`}>
      <span className="fv2-search-icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fv2-search-input"
      />
    </div>
  );
}

export const ForteV2SearchInput = ForteV2SearchField;

export function ForteV2FilterPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const active = value !== "הכל";
  return (
    <label className={`fv2-filter-pill ${active ? "fv2-filter-pill-active" : ""}`}>
      <span className="fv2-filter-pill-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ForteV2ToolbarDivider() {
  return <div className="hidden sm:block w-px h-6 bg-forte-border mx-1" aria-hidden />;
}

/* ── Buttons ── */

export function ForteV2PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  size,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "sm";
  href?: string;
}) {
  const cls = `fv2-btn-primary ${size === "sm" ? "fv2-btn-sm" : ""}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function ForteV2SecondaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  size,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "sm";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`fv2-btn-secondary ${size === "sm" ? "fv2-btn-sm" : ""}`}
    >
      {children}
    </button>
  );
}

export function ForteV2GhostButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="fv2-btn-ghost">
      {children}
    </button>
  );
}

export function ForteV2DangerButton({
  children,
  onClick,
  disabled,
  type = "button",
  outline,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  outline?: boolean;
}) {
  if (outline) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className="fv2-btn-secondary fv2-btn-sm text-red-700 border-red-200 hover:bg-red-50"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="fv2-btn-primary fv2-btn-sm fv2-btn-danger"
    >
      {children}
    </button>
  );
}

/* ── Table ── */

export function ForteV2TableCard({
  title,
  count,
  children,
}: {
  title?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="fv2-table-card">
      {(title || count != null) && (
        <div className="fv2-table-card-header">
          {title && <span className="fv2-table-card-title">{title}</span>}
          {count != null && (
            <span className="fv2-table-card-count">{count} רשומות</span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function ForteV2DataTable({ children }: { children: ReactNode }) {
  return <table className="fv2-data-table">{children}</table>;
}

/* ── Panels & sections ── */

export function ForteV2Panel({
  children,
  className,
  large,
}: {
  children: ReactNode;
  className?: string;
  large?: boolean;
}) {
  return (
    <section className={`fv2-panel ${large ? "fv2-panel-lg" : ""} ${className ?? ""}`}>
      {children}
    </section>
  );
}

export function ForteV2SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="fv2-section-header">
      <div>
        <h2 className="fv2-section-title">{title}</h2>
        {description && <p className="fv2-section-desc">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ForteV2Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <article className={`fv2-card ${className ?? ""}`}>{children}</article>;
}

/* ── Project workspace header ── */

export function ForteV2ProjectHeader({
  backHref,
  backLabel,
  title,
  projectId,
  projectIdLabel,
  meta,
  tabs,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  projectId: string;
  projectIdLabel?: string;
  meta: Array<{ icon: string; label: string; value: string }>;
  tabs: ReactNode;
}) {
  return (
    <header className="fv2-project-header shrink-0">
      <div className="fv2-project-header-top">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-forte-text-secondary hover:text-forte-primary mb-2 transition-colors"
        >
          ← {backLabel}
        </Link>
        <h1 className="fv2-project-title">{title}</h1>
        {projectIdLabel ? (
          <p className="text-[11px] text-forte-text-secondary mt-1">{projectIdLabel}</p>
        ) : null}
        <p className="fv2-project-id" dir="ltr">
          {projectId}
        </p>
      </div>
      <div className="fv2-meta-chips">
        {meta.map((item) => (
          <span key={item.label} className="fv2-meta-chip">
            <span aria-hidden>{item.icon}</span>
            <span className="fv2-meta-chip-label">{item.label}</span>
            <span className="fv2-meta-chip-value">{item.value || "—"}</span>
          </span>
        ))}
      </div>
      <nav className="fv2-tab-bar" aria-label="ניווט תיק פרויקט">
        {tabs}
      </nav>
    </header>
  );
}

export function ForteV2TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "fv2-tab fv2-tab-active" : "fv2-tab"}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </button>
  );
}

/* ── Status & empty ── */

export function ForteV2StatusBanner({
  tone,
  children,
}: {
  tone: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "fv2-banner-success"
      : tone === "error"
        ? "fv2-banner-error"
        : tone === "warning"
          ? "fv2-banner-warning"
          : "fv2-banner-info";
  return <div className={`fv2-banner ${toneClass}`}>{children}</div>;
}

export function ForteV2EmptyState({
  icon = "📋",
  title,
  description,
  actions,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="fv2-empty">
      <div className="fv2-empty-icon" aria-hidden>
        {icon}
      </div>
      <p className="fv2-empty-title">{title}</p>
      {description && <p className="fv2-empty-desc">{description}</p>}
      {actions && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">{actions}</div>
      )}
    </div>
  );
}

export function ForteV2StatusBadge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "neutral" | "success" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : tone === "danger"
          ? "bg-red-50 text-red-700 border-red-200"
          : tone === "neutral"
            ? "fv2-badge-neutral"
            : "fv2-badge-blue";
  return <span className={`fv2-badge ${cls}`}>{children}</span>;
}

/* ── Forms & dialogs ── */

export function ForteV2FormLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="fv2-label">
      {children}
    </label>
  );
}

export function ForteV2FormInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`fv2-input w-full ${className ?? ""}`} />;
}

export function ForteV2DialogOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="fv2-dialog-overlay" onClick={onClose} role="presentation">
      <div onClick={(e) => e.stopPropagation()} role="dialog">
        {children}
      </div>
    </div>
  );
}

export function ForteV2Dialog({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const maxW =
    size === "xl" ? "max-w-2xl" : size === "lg" ? "max-w-lg" : "max-w-md";
  return (
    <div className={`fv2-dialog ${maxW}`}>
      <div className="fv2-dialog-header">
        <h3 className="fv2-dialog-title">{title}</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="fv2-btn-ghost fv2-btn-sm" aria-label="סגור">
            ✕
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Legacy toolbar/table wrappers (backward compat) ── */

export function MasterProjectV2Toolbar({
  actions,
  search,
  inner,
}: {
  actions?: ReactNode;
  search?: ReactNode;
  inner?: boolean;
}) {
  return (
    <div className={inner ? "fv2-toolbar-card-inner" : "fv2-toolbar-card"}>
      <ForteV2ToolbarRow>
        {search}
        {search && actions && <ForteV2ToolbarDivider />}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </ForteV2ToolbarRow>
    </div>
  );
}

export function MasterProjectV2SearchInput({
  value,
  onChange,
  placeholder = "חיפוש...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <ForteV2SearchField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="sm:max-w-xs"
    />
  );
}

export const MasterProjectV2PrimaryButton = ForteV2PrimaryButton;
export const MasterProjectV2SecondaryButton = ForteV2SecondaryButton;
export const MasterProjectV2DangerButton = ForteV2DangerButton;
export const MasterProjectV2EmptyState = ForteV2EmptyState;
export const MasterProjectV2StatusBanner = ForteV2StatusBanner;
export const MasterProjectV2Card = ForteV2Card;
export const MasterProjectV2DialogOverlay = ForteV2DialogOverlay;
export const MasterProjectV2FormLabel = ForteV2FormLabel;
export const MasterProjectV2SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="fv2-section-title">{children}</h2>
);

export function MasterProjectV2DialogPanel({
  children,
  size = "md",
  className,
}: {
  children: ReactNode;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const maxW =
    size === "xl" ? "max-w-2xl" : size === "lg" ? "max-w-lg" : "max-w-md";
  return <div className={`fv2-dialog ${maxW} ${className ?? ""}`}>{children}</div>;
}

export function MasterProjectV2TableShell({
  headers,
  children,
  empty,
  title,
  count,
}: {
  headers: string[];
  children?: ReactNode;
  empty?: ReactNode;
  title?: string;
  count?: number;
}) {
  return (
    <ForteV2TableCard title={title} count={count}>
      <ForteV2DataTable>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {!children && empty}
        </tbody>
      </ForteV2DataTable>
    </ForteV2TableCard>
  );
}

export const fv2 = {
  legacyEmbed: "flex-1 min-h-0 overflow-auto fv2-legacy-embed",
  pageBody: "fv2-page-body",
  workspaceContent: "fv2-workspace-content",
  workspaceCanvas: "fv2-workspace-canvas",
};
