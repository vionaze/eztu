# Vouchers as the canonical storefront catalog

## Decision

`/vouchers` becomes the single canonical catalog route. It owns the complete
storefront experience previously implemented at `/products`: market-aware
availability, category filters, search, result counts, animated sorting, and
product cards. Navbar and footer links point directly to `/vouchers`.

`/products` remains available as a permanent HTTP 308 redirect to `/vouchers`.
This preserves existing bookmarks and inbound links while avoiding two catalog
implementations that can drift apart.

## Data flow

The `/vouchers` server page loads published products and storefront categories
in parallel. Its client component filters products using the selected pricing
country, then applies category and text-search filters before rendering the
grid. Country selection continues to control product availability and currency;
it does not control the interface language.

## Verification

- Typecheck the monorepo.
- Build the production web app.
- Confirm `/vouchers` renders the complete catalog client.
- Confirm `/products` calls `permanentRedirect("/vouchers")`.
- Confirm navbar and footer contain no direct `/products` link.
