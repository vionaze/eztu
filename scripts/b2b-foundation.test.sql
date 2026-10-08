BEGIN;
DO $$ BEGIN
  ASSERT current_database() LIKE 'reseller_phase4_test_%', 'Run only in an isolated Phase 4 test database';
END $$;

INSERT INTO "Category" (id,name,slug,"updatedAt") VALUES ('p4-cat','Vouchers','p4-vouchers',now());
INSERT INTO "Product" (id,name,slug,description,image,"categoryId",published,"updatedAt") VALUES ('p4-product','P4 Product','p4-product','test','','p4-cat',true,now());
INSERT INTO "ProductVariant" (id,name,published,"priceIDR","priceUSD","supplierSku","countryCode","productId","updatedAt") VALUES ('p4-variant','P4 SKU',true,100,1,'P4-SKU','id','p4-product',now());
INSERT INTO "User" (id,"clerkId",email,"updatedAt") VALUES ('p4-user','p4-clerk','p4@example.invalid',now());
INSERT INTO "ResellerOrganization" (id,name,slug,status,tier,"updatedAt") VALUES ('p4-org','P4 Org','p4-org','ACTIVE','TIER_1',now()),('p4-other','Other Org','p4-other','ACTIVE','TIER_2',now());
INSERT INTO "B2BOrder" (id,"orderNumber","organizationId","createdByUserId","paymentMethod",status,"idempotencyKey","requestFingerprint","quotedAt","subtotalIDR","totalIDR","updatedAt") VALUES ('p4-order','P4-1','p4-org','p4-user','CRYPTO','PAYMENT_PENDING','p4-key','test-fingerprint',now(),1000,1000,now());
INSERT INTO "B2BPaymentIntent" (id,"orderId",provider,"amountIDR",currency,"updatedAt") VALUES ('p4-intent','p4-order','cryptomus',1000,'USD',now());
INSERT INTO "B2BPaymentEvent" (id,provider,"eventId","paymentIntentId","normalizedStatus") VALUES ('p4-event','cryptomus','test-event','p4-intent','PAID');
INSERT INTO "B2BWalletAccount" (id,"organizationId",currency,status,"updatedAt") VALUES ('p4-wallet','p4-org','IDR','DISABLED',now());
INSERT INTO "B2BWalletLedger" (id,"accountId","organizationId",type,"amountIDR","idempotencyKey") VALUES ('p4-ledger','p4-wallet','p4-org','ADJUSTMENT',1000,'p4-ledger-key');

DO $$ BEGIN
  BEGIN
    INSERT INTO "B2BOrder" (id,"orderNumber","organizationId","createdByUserId","paymentMethod","idempotencyKey","requestFingerprint","quotedAt","subtotalIDR","totalIDR","updatedAt") VALUES ('p4-dup','P4-2','p4-org','p4-user','CRYPTO','p4-key','same',now(),1000,1000,now());
    RAISE EXCEPTION 'Order idempotency uniqueness failed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO "B2BPaymentEvent" (id,provider,"eventId","paymentIntentId","normalizedStatus") VALUES ('p4-event-dup','cryptomus','test-event','p4-intent','PAID');
    RAISE EXCEPTION 'Payment event uniqueness failed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO "B2BWalletLedger" (id,"accountId","organizationId",type,"amountIDR","idempotencyKey") VALUES ('p4-ledger-dup','p4-wallet','p4-org','ADJUSTMENT',1000,'p4-ledger-key');
    RAISE EXCEPTION 'Ledger idempotency failed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO "B2BWalletLedger" (id,"accountId","organizationId",type,"amountIDR","idempotencyKey") VALUES ('p4-wrong-org','p4-wallet','p4-other','ADJUSTMENT',1000,'other-key');
    RAISE EXCEPTION 'Ledger account organization mismatch accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO "B2BWalletAccount" (id,"organizationId",currency,"updatedAt") VALUES ('p4-usd','p4-other','USD',now());
    RAISE EXCEPTION 'Non-IDR wallet accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "B2BWalletAccount" SET "availableIDR"=-1 WHERE id='p4-wallet';
    RAISE EXCEPTION 'Wallet overdraft accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "B2BWalletLedger" SET "amountIDR"=2000 WHERE id='p4-ledger';
    RAISE SQLSTATE '23514' USING MESSAGE='Ledger update accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    DELETE FROM "B2BWalletLedger" WHERE id='p4-ledger';
    RAISE SQLSTATE '23514' USING MESSAGE='Ledger deletion accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    DELETE FROM "ResellerOrganization" WHERE id='p4-org';
    RAISE EXCEPTION 'Financial organization deletion accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  ASSERT EXISTS (SELECT 1 FROM "B2BWalletLedger" WHERE id='p4-ledger' AND "amountIDR"=1000), 'Ledger changed';
  ASSERT NOT EXISTS (SELECT 1 FROM "Order" WHERE "userId"='p4-user'), 'Consumer order was created';
END $$;
ROLLBACK;
