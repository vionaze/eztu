# Responsive voucher grid reflow

## Problem

Market selection can make `ProductCard` return `null` for unavailable products.
The previous voucher grid wrapped every product in an animation element before
availability was known, so empty wrappers could continue occupying grid cells.
Framer Motion layout transforms also made positions less predictable across
responsive breakpoints.

## Decision

Filter market availability before mapping, then render every `ProductCard` as a
direct child of native CSS Grid. The grid uses two columns on mobile, three on
medium screens, and four on large screens. Native reflow immediately packs the
remaining cards after country, category, or search changes.

Position animation is intentionally removed from the product grid. Card hover
transitions remain, while layout correctness takes priority over movement
animation.

## Verification

- Typecheck and lint the changed client component.
- Run the production build.
- Confirm there is no animation wrapper per product.
- Confirm two, three, and four-column breakpoint classes remain present.
