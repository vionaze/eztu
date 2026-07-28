UPDATE "Setting"
SET
  "value" = 'https://api.openai.com/v1',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'blog.ai.baseUrl'
  AND BTRIM("value") = '';

UPDATE "Setting"
SET
  "value" = 'gpt-5.6-terra',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'blog.ai.model'
  AND (
    BTRIM("value") = ''
    OR "value" = 'gpt-4o-mini'
  );
