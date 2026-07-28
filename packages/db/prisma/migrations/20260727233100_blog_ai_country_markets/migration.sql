INSERT INTO "Setting" AS current_setting ("key", "value", "updatedAt")
VALUES (
  'blog.ai.countries',
  'SA,AE,RU,KZ,TR,IQ,EG,PH,BR,ID,US,JO,KW,QA,BH,OM,BY,AM,UZ,GE,MY,TH,SG,VN,IN,JP,KR,GLOBAL',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE
SET
  "value" = (
    SELECT STRING_AGG(country_code, ',' ORDER BY first_position)
    FROM (
      SELECT
        UPPER(BTRIM(country_value)) AS country_code,
        MIN(country_position) AS first_position
      FROM UNNEST(
        STRING_TO_ARRAY(
          current_setting."value" || ',' || EXCLUDED."value",
          ','
        )
      ) WITH ORDINALITY AS countries(country_value, country_position)
      WHERE BTRIM(country_value) <> ''
      GROUP BY UPPER(BTRIM(country_value))
    ) AS unique_countries
  ),
  "updatedAt" = CURRENT_TIMESTAMP;
