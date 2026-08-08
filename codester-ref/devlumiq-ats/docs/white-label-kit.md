# White-Label Kit (SKU)

Turn a DevLumiq ATS deployment into a fully branded product for a client — without forking the codebase.

**Included with:** Extended / Enterprise entitlement, or the purchasable `whiteLabelKit` add-on (`Subscription.addOns.whiteLabelKit`).

**Grandfathered for all plans:** careers colors, logo, favicon, hero copy, and Company Builder basics. Existing buyers keep what they already use.

## What the kit unlocks

| Capability | Without kit | With kit |
|------------|-------------|----------|
| Primary / secondary / accent colors | Yes | Yes |
| Logo & favicon | Yes | Yes |
| Custom CSS (`Company.customCss`) | Blocked on write | Yes |
| Custom domain (`Company.customDomain`) | Blocked on write | Yes |
| Hide “Powered by DevLumiq” / product marks | No | Yes (`resolveBrand` → `hideProductMarks`) |
| Documented rebrand checklist | — | This file |

## Code toolkit

- [`src/lib/white-label.ts`](../src/lib/white-label.ts) — `resolveBrand(company)`, `shouldHideProductMarks(orgId)`, `brandFooterText(brand)`
- [`src/lib/plan-limits.ts`](../src/lib/plan-limits.ts) — `hasEntitlement(orgId, 'whiteLabel')`
- Company API gates kit extras on POST/PATCH; color/logo fields are never gated

## Rebrand checklist (repeatable upsell)

1. **Company record** — set `name`, `slug`, `logoUrl`, `faviconUrl`, brand colors in Company Builder.
2. **Kit extras** — set `customDomain`, optional `customCss` (requires entitlement).
3. **Env** — `NEXT_PUBLIC_APP_URL`, `FROM_NAME`, `SMTP_FROM` to client domain.
4. **Emails** — use `brandFooterText(await resolveBrand(company))` instead of hard-coded product marks.
5. **Careers** — publish careers site; verify colors + logo; confirm footer hides product mark when entitled.
6. **Stripe (optional)** — `STRIPE_PRICE_WHITELABEL_KIT` for add-on checkout; webhook sets `addOns.whiteLabelKit`.
7. **QA** — login, careers apply, offer PDF, and email footers show client brand only.

## CSS variables (careers / emails)

```css
:root {
  --brand-primary: /* Company.primaryColor */;
  --brand-secondary: /* Company.secondaryColor */;
  --brand-accent: /* Company.accentColor */;
}
```

`resolveBrand()` returns these as `cssVars` for inline `<style>` or email wrappers.

## Enabling the add-on without Stripe

```sql
UPDATE "Subscription"
SET "addOns" = jsonb_set(COALESCE("addOns", '{}'::jsonb), '{whiteLabelKit}', 'true')
WHERE "organizationId" = '<company-id>';
```

Or upgrade the org to `ENTERPRISE` (`PLAN_LIMITS.ENTERPRISE.whiteLabel = true`).

## Non-goals

- Does not remove careers branding from lower tiers.
- Does not force a Workflow.mk (or any client) theme into the default template.
