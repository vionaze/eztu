-- WinPay is offered alongside Pakasir for reseller orders while the migration
-- runs. ADD VALUE (not a rename) keeps every existing Pakasir row valid.
ALTER TYPE "B2BPaymentMethod" ADD VALUE 'WINPAY';
