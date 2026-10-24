-- BOM phase identifier.
-- Every BOM is either a formulation stage (raw materials) or a packing stage
-- (packing materials + the finished good being packed). The app now writes
-- `phase` on create/update; this file adds the column and backfills old rows.
-- The local database migrates automatically via bootstrap.ts ADDED_COLUMNS;
-- the hosted SQLite Cloud databases run this file by hand.
-- Safe to re-run: the ALTER is guarded by the column list and the backfill only
-- touches rows that are still NULL.

-- 1. Add the column (skip on re-run).
--    If SQLite reports "duplicate column name: phase", the column already exists.
ALTER TABLE bill_of_materials ADD COLUMN phase TEXT;

-- 2. Backfill: any raw material component makes it a formulation BOM,
--    otherwise it is a packing BOM.
UPDATE bill_of_materials
   SET phase = CASE
     WHEN EXISTS (
       SELECT 1
         FROM bom_components c
         JOIN items i ON i.id = c.component_item_id
        WHERE c.bom_id = bill_of_materials.id
          AND i.item_type = 'RAW_MATERIAL'
     ) THEN 'FORMULATION'
     ELSE 'PACKING'
   END
 WHERE phase IS NULL;

-- 3. Verify: should return zero rows.
SELECT id, bom_name FROM bill_of_materials WHERE phase IS NULL;
