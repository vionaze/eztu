-- Pakasir stopped operating on 2026-11-25. The provider, routes, and env
-- variables are gone; these admin switches would otherwise be dead settings.
DELETE FROM "Setting"
WHERE "key" IN (
  'payments.pakasir.enabled',
  'payments.reseller.pakasir.enabled'
);

-- The B2BPaymentMethod enum keeps PAKASIR so historical B2B orders remain
-- readable; the application no longer offers or creates Pakasir payments.
