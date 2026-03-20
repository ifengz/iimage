# Design System: High-End Desktop Productivity

## 1. Overview & Creative North Star
This design system is built for high-performance batch image processing, where precision and efficiency are paramount. Moving away from the "generic SaaS" look, we embrace a Creative North Star titled **"The Precision Workbench."**

The aesthetic is inspired by professional design environments (Figma, Adobe) but elevated through editorial typography and sophisticated tonal layering. We avoid flashy marketing fluff in favor of a dense, workstation-focused UI. The interface relies on a strict three-column structural layout, using subtle background shifts rather than harsh lines to define the workspace. The result is a UI that feels like a singular, cohesive tool rather than a collection of cards.

---

## 2. Colors: Tonal Depth & Focus
Our palette is rooted in professional stability. We use a deep slate and cool blue foundation to reduce eye strain during long working sessions.

### Surface Hierarchy & Nesting
To create an "editorial" feel, we prohibit traditional 1px solid borders for sectioning. Boundaries are defined by background shifts:
*   **The Global Canvas:** `background` (#f8f9ff)
*   **Primary Sidebar/Panel Containers:** `surface-container-low` (#eff4ff)
*   **Nested Content/Action Cards:** `surface-container-lowest` (#ffffff) sitting on top of the panels to create a soft natural lift.

### Design Rules
*   **The "No-Line" Rule:** Do not use borders to separate the three main columns. Use the transition from `surface-container-low` to `surface` to indicate structural breaks.
*   **Glassmorphism:** For floating elements like Tooltips or Modal overlays, use `surface` with a 80% opacity and a `20px` backdrop-blur.
*   **Signature Textures:** For high-priority actions like "Start Batch Processing," use a subtle linear gradient from `primary` (#0053db) to `primary_dim` (#0048c1) to provide a premium, tactile feel.

---

## 3. Typography: Editorial Authority
We utilize a dual-font strategy to balance character with legibility.

*   **Display & Headlines (Manrope):** Used for large headers and status titles. The geometric nature of Manrope provides an authoritative, modern feel.
    *   *Example:* `headline-lg` for the tool's title in the top bar.
*   **UI & Data (Inter):** Used for all functional elements, form fields, and batch data. Inter's high x-height ensures clarity at small sizes (`label-sm` at 0.6875rem).
*   **Intentional Contrast:** We pair `display-sm` titles with `label-md` uppercase subheaders to create an asymmetrical, editorial hierarchy that guides the eye toward primary tasks.

---

## 4. Elevation & Depth: Tonal Layering
In a "Precision Workbench," shadows should be invisible but felt.

*   **Tonal Stacking:** Instead of shadows, achieve depth by stacking. A `surface-container-highest` card placed on a `surface-container` background creates a clear interactive focal point.
*   **Ambient Shadows:** If an element must float (e.g., a "Processing" toast), use an extra-diffused shadow:
    *   `box-shadow: 0 12px 32px -4px rgba(0, 52, 94, 0.08);`
    *   *Note:* The shadow color is a low-opacity version of `on_surface` (#00345e), not pure black.
*   **The Ghost Border:** If high-density data requires containment, use `outline_variant` at 15% opacity. This "Ghost Border" provides a hint of structure without cluttering the workstation.

---

## 5. Components

### Buttons & Actions
*   **Primary:** High-contrast `primary` (#0053db) with `on_primary` text. Use `xl` (0.75rem) roundedness for a modern feel.
*   **Secondary:** `secondary_container` background with `on_secondary_container` text. This is the workhorse for panel-level actions.
*   **Ghost/Tertiary:** No background. Use `on_surface_variant` for text. For "Danger" batch actions (e.g., Delete All), use the `error` token (#9f403d).

### High-Density Cards (Image Thumbnails & Task Items)
*   **Structure:** No borders. Use `surface-container-lowest` (#ffffff).
*   **Selection State:** When an image is selected for editing, apply a 2px stroke using the `primary` token and a subtle `primary_container` inner glow.
*   **Status Indicators:**
    *   *Success:* `tertiary` (#742fe5) — A sophisticated purple used for "Completed" states.
    *   *Pending/Processing:* `primary_fixed_dim` with a 1.5s pulse animation.
    *   *Error:* `error_container` with `on_error_container` text.

### Form Fields (The "Gemini" Input)
*   **Layout:** Labels use `label-md` in `on_surface_variant`. 
*   **Input Area:** Background should be `surface-container-high`. On focus, the background shifts to `surface-container-lowest` with a 1px `primary` ghost border.

### Status Bar (Bottom)
A fixed 40px bar using `surface-dim` to anchor the workspace. Text should be `label-sm` for a refined, technical look.

---

## 6. Do's and Don'ts

### Do's
*   **Do** use `Spacing 8` (1.75rem) between major columns to let the "workbench" breathe.
*   **Do** use `tertiary` (#742fe5) for AI-related status indicators to differentiate Gemini's "intelligence" from standard system primary actions.
*   **Do** utilize `surface-bright` for the main image preview area to ensure color accuracy.

### Don'ts
*   **Don't** use 100% black for text; use `on_surface` (#00345e) for better tonal integration.
*   **Don't** use card shadows in the sidebars. Let the background color shifts do the heavy lifting.
*   **Don't** use standard 400ms transitions. For a premium feel, use `cubic-bezier(0.4, 0, 0.2, 1)` with a 200ms duration for all hover states.
*   **Don't** use dividers between list items in the batch queue. Use `Spacing 1.5` or `2` of vertical white space instead.

---

## 7. Spacing & Roundedness Constants
*   **Standard Padding:** `Spacing 4` (0.9rem) for card internals.
*   **Panel Gap:** `Spacing 6` (1.3rem) between the three main structural columns.
*   **Corner Radius:**
    *   Small UI (Checkboxes/Chips): `sm` (0.125rem)
    *   Standard Cards/Inputs: `md` (0.375rem)
    *   Primary Buttons/Containers: `lg` (0.5rem) or `xl` (0.75rem)