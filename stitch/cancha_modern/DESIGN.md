# Design System Documentation

## 1. Overview & Creative North Star: "The Kinetic Guardian"

This design system is built to bridge the gap between high-energy sportsmanship and compassionate social impact. Our Creative North Star, **"The Kinetic Guardian,"** dictates a visual language that is both hyper-dynamic and deeply supportive. We move away from the static, boxy layouts of traditional non-profits toward an editorial, mobile-first experience that feels "in motion."

To achieve this, the system leverages **"Intentional Asymmetry"** and **"Organic Layering."** We avoid rigid, centered grids in favor of overlapping elements, oversized typography that bleeds off the container, and a radical commitment to softness through extreme corner radii. This is not just a website; it is a premium digital environment that feels as fast as a striker and as warm as a helping hand.

---

## 2. Colors: Vibrancy with Depth

The palette transitions from the energetic heat of competition to the grounded stability of a trustworthy foundation.

### Core Palette
*   **Primary (Energy):** `primary` (#9f4200) and `primary_container` (#ff6d00). Use these for high-action touchpoints and hero moments.
*   **Secondary (Warmth):** `secondary` (#705d00) and `secondary_container` (#fdd400). These tones provide the "Teletón" heart—sunshine yellows that feel optimistic.
*   **Tertiary (The Deep Blue):** `tertiary` (#4c56af). Inspired by the sporting heritage, use this sparingly for secondary actions or to ground a high-vibrancy section.
*   **Neutral (Foundation):** `surface` (#fcf9f8) and `on_surface` (#1b1c1c).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be established via:
1.  **Tonal Shifts:** Placing a `surface_container_low` card against a `surface` background.
2.  **Shadow Depth:** Using ambient lift to imply separation.

### The "Glass & Gradient" Rule
To elevate the brand from "flat" to "premium," use Glassmorphism for floating navigation and overlays. 
*   **Technique:** Apply `surface` at 70% opacity with a `20px` backdrop-blur.
*   **Signature Textures:** Main CTAs should utilize a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle to add "soul" and dimensionality.

---

## 3. Typography: The Editorial Voice

We use a high-contrast typography stack to balance athletic energy with institutional trust.

*   **Display & Headlines (Lexend):** A geometric sans-serif that feels expansive and modern. 
    *   *Usage:* `display-lg` (3.5rem) should be used for impact statements with tight letter-spacing (-0.02em).
*   **Body & Titles (Plus Jakarta Sans):** A sophisticated typeface with high legibility.
    *   *Usage:* `body-lg` (1rem) for all storytelling elements. The taller x-height ensures readability on mobile devices.

The hierarchy is intentional: headlines are "The Shout" (Athletic Energy), while body text is "The Handshake" (Trustworthy Impact).

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows are often a crutch for poor layout. In this system, hierarchy is achieved through **Physicality.**

*   **The Layering Principle:** 
    *   **Level 0:** `surface` (The Floor)
    *   **Level 1:** `surface_container_low` (Background sections)
    *   **Level 2:** `surface_container_lowest` (Individual Cards - creates a "white paper" lift)
*   **Ambient Shadows:** For floating elements (like a "Donate" FAB), use a custom shadow: `0px 12px 32px rgba(27, 28, 28, 0.06)`. Note the tint—the shadow color is a low-opacity version of `on_surface`, never pure black.
*   **The Ghost Border:** If a boundary is strictly required for accessibility, use `outline_variant` at **15% opacity**. High-contrast borders are strictly forbidden.

---

## 5. Components: Softness Meets Utility

Every component must adhere to the **Roundedness Scale**, prioritizing `xl` (3rem) and `lg` (2rem) to maintain a friendly, approachable feel.

### Buttons
*   **Primary:** High-pill shape (`full`), using the signature gradient. Bold `label-md` text.
*   **Secondary:** `surface_container_highest` background with `primary` text. No border.

### Cards & Lists
*   **Card Aesthetic:** Use `lg` (2rem) corner radius. Forbid the use of divider lines. 
*   **Separation:** Use 24px or 32px vertical white space to separate list items. If a container is needed, use a subtle background shift to `surface_container_low`.

### The "Impact Chip"
*   **Variant:** Use `secondary_container` for positive progress (e.g., "Goal Reached").
*   **Shape:** Extra rounded (`full`) to mimic the circular nature of a soccer ball and the logo's core shape.

### Input Fields
*   **Styling:** Large, rounded containers (`md` - 1.5rem). Use `surface_container_highest` as the fill color. On focus, transition to a `ghost border` of the `primary` color.

---

## 6. Do's and Don'ts

### Do
*   **Do** lean into oversized typography. Allow headlines to be the hero of the layout.
*   **Do** use asymmetrical image cropping—circular "cut-outs" that echo the logo's shape.
*   **Do** prioritize mobile-first gestures. Cards should feel like physical objects that can be swiped.

### Don't
*   **Don't** use 100% opaque borders. They create visual "noise" and break the friendly feel.
*   **Don't** use sharp corners. Any radius under `sm` (0.5rem) is a violation of the "Kinetic Guardian" ethos.
*   **Don't** clutter. If a screen feels busy, increase the background-color contrast between sections rather than adding lines.