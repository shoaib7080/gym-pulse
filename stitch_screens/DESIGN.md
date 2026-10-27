# Design System: Kinetic Obsidian
**Project:** GymPulse Admin Dashboard Suite (`12961325546557867269`)

## Brand & Visual Philosophy
The design system projects athletic vitality disciplined by institutional precision. Created for fitness facility operators, studio founders, and operational executives, it balances high-cadence athletic kineticism with the structured rigor demanded by telemetry, recurring revenue models, and multi-location management.

The visual direction unites **Modern Dark SaaS** with **Electric High-Contrast Accents**. The dark environment evokes high-performance athletic apparel and premium architectural gym interiors, while electric accents deliver fast visual feedback across dense operational dashboards. The aesthetic remains professional: high-contrast accents serve strictly as directional indicators, operational alerts, and dynamic telemetry, avoiding frivolous neon clutter.

---

## Calibrated Color System

```yaml
colors:
  # Primary Accents (Electric Lime)
  primary: '#9ee939'
  primary-container: '#84cc16'
  on-primary: '#1f3700'
  on-primary-container: '#315200'
  primary-fixed: '#acf847'
  primary-fixed-dim: '#91db2a'

  # Secondary Accents (Cyan Kinetic / Telemetry)
  secondary: '#4cd7f6'
  secondary-container: '#03b5d3'
  on-secondary: '#003640'
  on-secondary-container: '#00424e'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'

  # Tertiary Accents (Neon Tangerine / Operational Alerts)
  tertiary: '#ffc9ae'
  tertiary-container: '#ffa270'
  on-tertiary: '#552100'
  on-tertiary-container: '#7c3300'
  tertiary-fixed: '#ffdbca'

  # Status / Errors
  error: '#ffb4ab'
  error-container: '#93000a'
  on-error: '#690005'
  on-error-container: '#ffdad6'

  # Obsidian Surface Tiering (Elevation & Tonal Depth)
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  surface-variant: '#2d3449'

  # Text & Outlines
  on-surface: '#dae2fd'
  on-surface-variant: '#c1cab0'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8b947d'
  outline-variant: '#424936'
  background: '#0b1326'
  on-background: '#dae2fd'
```

---

## Typography Scales (Plus Jakarta Sans)

| Role | Font Family | Size | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **display** | Plus Jakarta Sans | 40px | 800 (Boldest) | 48px | -0.02em |
| **stat-metric** | Plus Jakarta Sans | 36px | 800 | 40px | -0.03em |
| **headline-lg** | Plus Jakarta Sans | 30px | 700 | 38px | -0.015em |
| **headline-md** | Plus Jakarta Sans | 22px | 600 | 28px | -0.01em |
| **headline-sm** | Plus Jakarta Sans | 18px | 600 | 24px | 0em |
| **body-lg** | Plus Jakarta Sans | 16px | 400 | 24px | 0em |
| **body-md** | Plus Jakarta Sans | 14px | 400 | 20px | 0em |
| **body-sm** | Plus Jakarta Sans | 12px | 400 | 16px | 0.01em |
| **label-lg** | Plus Jakarta Sans | 14px | 600 | 18px | 0.01em |
| **label-md** | Plus Jakarta Sans | 12px | 600 | 16px | 0.02em |
| **label-sm** | Plus Jakarta Sans | 11px | 700 (Uppercase) | 14px | 0.04em |

---

## Elevation & Depth (Tonal Stacking)

1. **Surface Level 0 (Canvas Base `#0B1326` / `#0F172A`):** The persistent app container. No elevation.
2. **Surface Level 1 (Card & Module Layer `#131B2E` / `#1E293B`):** Standard resting state for cards, lists, table bodies, and data widgets. Defined by 1px solid border of `#334155` (60% opacity) or `outline-variant/30`.
3. **Surface Level 2 (Interactive Floating `#222A3D` / `#334155`):** Dropdowns, branch switcher overlays, active date pickers, popovers, and sticky sub-navigation. Soft ambient shadow.
4. **Surface Level 3 (Critical Modals & Dialogs):** Centered focus state overlaying `backdrop-filter: blur(12px); background-color: rgba(11, 19, 38, 0.85)`.
5. **Glow Accents (Active Kinetic Depth):** Key interactive components or peak occupancy metrics receive subtle ambient back-glows: `box-shadow: 0 0 20px -3px rgba(158, 233, 57, 0.25)`.
