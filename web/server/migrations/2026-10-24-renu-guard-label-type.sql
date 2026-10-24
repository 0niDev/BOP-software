-- Renu Guard Bucket Label was created as FINISHED_GOOD; every other label is a
-- PACKING_MATERIAL, and labels always belong to the packing stage.
-- The local databases seed their own items; this file fixes the hosted data.
-- Safe to re-run.

UPDATE items
   SET item_type = 'PACKING_MATERIAL'
 WHERE item_code = 'ITEM-00619'
   AND item_name LIKE 'Renu Guard%Label%'
   AND item_type <> 'PACKING_MATERIAL';
