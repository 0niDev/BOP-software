# History — Audit Log (11,040 rows)

`History.csv` is the internal audit log of every stock batch mutation. Rows are duplicated (each mutation is re-logged on every re-save), so the raw table is much larger than the distinct records it represents. The complete raw data remains in `History.csv`; this document summarises it by process.

## Rows by process

| ProcessName | Rows |
|---|---|
| PRODUCTIONBATCH | 3245 |
| PACKINGBATCH | 1972 |
| OpeningBatch | 1738 |
| PACKING | 1269 |
| Productions | 1246 |
| PurchasesBatch | 775 |
| SALESBATCH | 749 |
| Production | 21 |
| SALERETURNSBATCH | 19 |
| ExpiriesBatch | 6 |

## Column description

`HistoryId, TimeKey, ProcessName, ProcessId, ProductId, BatchNoOld, QuantityOld, CostOld, BatchNoNew, QuantityNew, CostNew`

## Distinct source processes (a single representative row per ProcessId+ProductId)

| ProcessName | ProcessId | ProductId | Product | BatchNoNew | QuantityNew | CostNew |
|---|---|---|---|---|---|---|
| OpeningBatch | 1 | 01002 | Ammonium chloride | 0001 | 25 | 200 |
| OpeningBatch | 2 | 01195 | Ammonium Sulphate | 0001 | 35 | 380 |
| OpeningBatch | 3 | 01010 | Betaine | 0001 | 27 | 2,800 |
| OpeningBatch | 4 | 01005 | CMC Sodium | 0001 | 12 | 1,500 |
| OpeningBatch | 5 | 01009 | Copper Sulphate | 0001 | 65 | 1,650 |
| OpeningBatch | 6 | 01001 | Aerosil | 0001 | 4 | 1,850 |
| OpeningBatch | 7 | 01184 | ARQ | 0001 | 25 | 367 |
| OpeningBatch | 8 | 01003 | Bentonite | 0001 | 150 | 17 |
| OpeningBatch | 9 | 01011 | Choline Chloride | 0001 | 2 | 4,000 |
| OpeningBatch | 10 | 01012 | Chocolate Brown Colour | 0001 | 7 | 4,000 |
| OpeningBatch | 11 | 01115 | Calcium Propionate | 0001 | 19 | 1,200 |
| OpeningBatch | 12 | 01027 | Kaolin | 0001 | 14 | 350 |
| OpeningBatch | 13 | 01013 | Calcium Chloride | 0001 | 15 | 160 |
| OpeningBatch | 14 | 01015 | DCP (Calcium) | 0001 | 2,750 | 17 |
| OpeningBatch | 15 | 01016 | DCP (Dana) | 0001 | 20,000 | 10 |
| OpeningBatch | 16 | 01021 | Glacial Acetic Acid | 0001 | 7 | 380 |
| OpeningBatch | 17 | 01020 | Formic Acid | 0001 | 560 | 350 |
| OpeningBatch | 18 | 01023 | Garlic Oil | 0001 | 10 | 5,500 |
| OpeningBatch | 19 | 01025 | Ginger Oil | 000 | 8 | 4,500 |
| OpeningBatch | 20 | 01028 | Lactic Acid | 0001 | 3 | 1,650 |
| OpeningBatch | 21 | 01104 | Lysine | 0001 | 15 | 1,100 |
| OpeningBatch | 22 | 01031 | Menthol Crystal | 0001 | 42 | 6,500 |
| OpeningBatch | 23 | 01034 | Magnesium Sulphate | 0001 | 16 | 380 |
| OpeningBatch | 24 | 01117 | Magnesium Oxide | 0001 | 2 | 420 |
| OpeningBatch | 25 | 01175 | maganese Sulphate | 0001 | 35 | 320 |
| OpeningBatch | 26 | 01038 | Phosphoric Acid 85% | 0001 | 65 | 650 |
| OpeningBatch | 27 | 01039 | Pectin | 0001 | 20 | 4,000 |
| OpeningBatch | 28 | 01019 | Eucluptus Oil | 0001 | 2 | 5,000 |
| OpeningBatch | 29 | 01041 | Sodium Benzoate | 0001 | 32 | 620 |
| OpeningBatch | 30 | 01042 | Starch | 0001 | 40 | 180 |
| OpeningBatch | 31 | 01044 | Sodium Bicarbonate | 0001 | 48 | 132 |
| OpeningBatch | 32 | 01046 | Silmyrin | 0001 | 20 | 16,500 |
| OpeningBatch | 33 | 01187 | Sodium Metaby Sulphate | 0001 | 24 | 200 |
| OpeningBatch | 34 | 01105 | Sodium Citrate | 0001 | 9 | 290 |
| OpeningBatch | 35 | 01048 | Titanium Dioxide (T.T) | 0001 | 16 | 1,500 |
| OpeningBatch | 36 | 01050 | Tartrazine Yellow Color Indian | 0001 | 15 | 2,900 |
| OpeningBatch | 37 | 01133 | Tri Calcium Phosphate | 0001 | 25 | 1,300 |
| OpeningBatch | 38 | 01017 | Camphor | 0001 | 11 | 3,200 |
| OpeningBatch | 39 | 01052 | Vitamin A | 0001 | 8 | 14,500 |
| OpeningBatch | 40 | 01053 | Vitamin B1 | 0001 | 0 | 15,500 |
| OpeningBatch | 41 | 01054 | Vitamin B2 | 0001 | 1 | 16,000 |
| OpeningBatch | 42 | 01143 | Vitamin B3 | 0001 | 60 | 3,200 |
| OpeningBatch | 43 | 01057 | Vitamin B6 | 0001 | 5 | 14,000 |
| OpeningBatch | 44 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,300 |
| OpeningBatch | 45 | 01056 | Vitamin D3 | 0001 | 6 | 16,500 |
| OpeningBatch | 46 | 01072 | Vitamin E | 0001 | 5 | 9,500 |
| OpeningBatch | 47 | 01075 | Peppermint Oil | 0001 | 1 | 5,000 |
| OpeningBatch | 48 | 01060 | Zinc Sulphate | 0001 | 25 | 950 |
| OpeningBatch | 49 | 01058 | Xanthan Gum | 0001 | 23 | 1,600 |
| OpeningBatch | 50 | 01189 | Glycerine | 0001 | 50 | 590 |
| OpeningBatch | 51 | 01080 | Capsicum Oil | 0001 | 2 | 4,500 |
| OpeningBatch | 52 | 01036 | Propylene Glycol (PG) | 0001 | 265 | 750 |
| OpeningBatch | 53 | 01045 | Sorbitol Liquid 70% | 0001 | 120 | 680 |
| OpeningBatch | 54 | 01201 | I.P.A | 0001 | 100 | 600 |
| OpeningBatch | 54 | 01201 | I.P.A | 0001 | 80 | 600 |
| OpeningBatch | 55 | 02307 | Bag Bop Blue Colour | 0001 | 350 | 155 |
| OpeningBatch | 56 | 02213 | Bag Bop Red Colour | 0001 | 300 | 155 |
| OpeningBatch | 57 | 02277 | Bag Bop Yellow Colour | 0001 | 750 | 155 |
| OpeningBatch | 58 | 02032 | BAG Growth Promoter 25 KG | 0001 | 600 | 155 |
| OpeningBatch | 59 | 02033 | BAG Magnet 25 KG | 0001 | 450 | 155 |
| OpeningBatch | 60 | 02274 | Bag Calcium 72  25kg | 0001 | 500 | 80 |
| OpeningBatch | 61 | 02034 | BAG BOP DCP 25 KG | 0001 | 600 | 80 |
| OpeningBatch | 62 | 02053 | Bio Fat  Bag 25 KG | 0001 | 850 | 70 |
| OpeningBatch | 63 | 02173 | Bag UnPrint idyLic 25 Kg | 0001 | 100 | 145 |
| OpeningBatch | 64 | 02097 | Bottle Round liter | 0001 | 660 | 220 |
| OpeningBatch | 65 | 02014 | Plastic Can White 5 Liter | 0001 | 290 | 390 |
| OpeningBatch | 66 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 70 | 270 |
| OpeningBatch | 67 | 02128 | White Can 25 Liter | 0001 | 37 | 1,000 |
| OpeningBatch | 68 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 20 | 180 |
| OpeningBatch | 69 | 02003 | Shipper [C] 15 pcs Tin (1 KG) | 0001 | 15 | 216 |
| OpeningBatch | 70 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 120 | 216 |
| OpeningBatch | 71 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 36 | 180 |
| OpeningBatch | 72 | 02306 | Shipper [K] 1KG large | 0001 | 190 | 210 |
| OpeningBatch | 73 | 02317 | Shipper [M] 30ML Bottle | 0001 | 35 | 160 |
| OpeningBatch | 74 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 190 | 185 |
| OpeningBatch | 75 | 02324 | Shipper [L] Nilli Bar | 0001 | 60 | 170 |
| OpeningBatch | 71 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 3 | 180 |
| OpeningBatch | 76 | 02010 | Bottle Pet Amber 100ML | 0001 | 2,500 | 10 |
| OpeningBatch | 77 | 02013 | Plastic Can Blue 5 Liter | 0001 | 136 | 390 |
| OpeningBatch | 78 | 02086 | S+D Calco Best 100 ml | 0001 | 1,150 | 12.5 |
| OpeningBatch | 79 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 10 | 150 |
| OpeningBatch | 80 | 02258 | Label Rumicid 25kg | 0001 | 120 | 45 |
| OpeningBatch | 81 | 00019 | DCP BOP 25kg | 0001 | 56 | 1,440 |
| OpeningBatch | 54 | 01201 | I.P.A | 0001 | 60 | 600 |
| OpeningBatch | 55 | 02307 | Bag Bop Blue Colour | 0001 | 450 | 155 |
| OpeningBatch | 56 | 02213 | Bag Bop Red Colour | 0001 | 450 | 155 |
| OpeningBatch | 60 | 02274 | Bag Calcium 72  25kg | 0001 | 600 | 80 |
| OpeningBatch | 62 | 02053 | Bio Fat  Bag 25 KG | 0001 | 950 | 70 |
| OpeningBatch | 82 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 15,500 | 17 |
| OpeningBatch | 83 | 02361 | Packet Dairy Yeast 1 kg | 0001 | 1,050 | 30 |
| OpeningBatch | 84 | 02315 | Packet GrowMore 1KG | 0001 | 10,800 | 30 |
| OpeningBatch | 85 | 02359 | Packet SACHRO LIC 1 kg | 0001 | 800 | 30 |
| OpeningBatch | 86 | 02172 | Packet VitaMinro- Lic 1 kg | 0001 | 230 | 30 |
| OpeningBatch | 87 | 02299 | Packet Calcium-72 1KG | 0001 | 6,500 | 30 |
| OpeningBatch | 88 | 02035 | Packet Lysogar Lic 1 KG | 0001 | 850 | 30 |
| OpeningBatch | 89 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 12,500 | 30 |
| OpeningBatch | 90 | 02321 | Packet Udder Boost 500 gm | 0001 | 29,000 | 20 |
| OpeningBatch | 91 | 02320 | Packet GrowMore 100 gm | 0001 | 8,000 | 10 |
| OpeningBatch | 92 | 02319 | Packet Magnet 100 gm | 0001 | 2,000 | 9.5 |
| OpeningBatch | 93 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 5,200 | 12 |
| OpeningBatch | 94 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 5,300 | 12 |
| OpeningBatch | 95 | 02020 | S+D Scour Guard100 ML | 0001 | 11,000 | 12 |
| OpeningBatch | 96 | 02019 | S+D Kirzan 100 ML | 0001 | 15,000 | 11.5 |
| OpeningBatch | 97 | 02313 | S+D Heaatic-Optimizer 100ML | 0001 | 6,000 | 11.5 |
| OpeningBatch | 98 | 02224 | S+D Garlimint Plus Liquid 100 ML | 0001 | 5,500 | 11.5 |
| OpeningBatch | 59 | 02033 | BAG Magnet 25 KG | 0001 | 500 | 155 |
| OpeningBatch | 99 | 02316 | S+D Garliment Plus 30ML | 0001 | 6,000 | 6 |
| OpeningBatch | 92 | 02319 | Packet Magnet 100 gm | 0001 | 2,500 | 9.5 |
| OpeningBatch | 100 | 02341 | Packet Reno Gurd Flush Oral Powder 1 kg | 0001 | 600 | 30 |
| OpeningBatch | 101 | 00363 | PhytoFat Gold 25 Kg | 0001 | 934 | 14,000 |
| PurchasesBatch | 1 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 37 | 196 |
| PurchasesBatch | 2 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 60 | 80 |
| PurchasesBatch | 2 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 0001 | 36 | 40 |
| PurchasesBatch | 2 | 02425 | Label Leo Immunomax Oral Liquid 5 Lit | 0001 | 24 | 40 |
| PurchasesBatch | 2 | 02421 | Label Hepa Leo Oral Liquid 5 Lit | 0001 | 20 | 40 |
| PurchasesBatch | 2 | 02423 | Label Leo Adsorbo Oral Liquid 5 Lit | 0001 | 20 | 40 |
| PurchasesBatch | 2 | 02428 | Label Leo Cid Pro 25 Lit | 0001 | 10 | 90 |
| PurchasesBatch | 2 | 02429 | Label Leo Sorbex Oral Powder 25 kg | 0001 | 10 | 120 |
| PurchasesBatch | 2 | 02430 | Label Leo Abmrox Oral Liquid 5 Lit | 0001 | 36 | 40 |
| Productions | 1 | 03192 | Immunit Z Oral Liquid | 0001 | 200 | 146.25 |
| PRODUCTIONBATCH | 1 | 01023 | Garlic Oil | 0001 | 1 | 5,500 |
| PRODUCTIONBATCH | 1 | 01025 | Ginger Oil | 000 | 1 | 4,500 |
| PRODUCTIONBATCH | 1 | 01036 | Propylene Glycol (PG) | 0001 | 20 | 750 |
| PRODUCTIONBATCH | 1 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 2,900 |
| PRODUCTIONBATCH | 1 | 01184 | ARQ | 0001 | 10 | 367 |
| PACKING | 1 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 1,295.25 |
| PACKINGBATCH | 1 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 390 |
| PACKINGBATCH | 1 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 60 | 80 |
| PACKINGBATCH | 1 | 03192 | Immunit Z Oral Liquid | 0001 | 200 | 146.25 |
| PACKINGBATCH | 1 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 216 |
| Productions | 2 | 03174 | Calco-Best Liquid | 0001 | 110 | 13.86 |
| PRODUCTIONBATCH | 2 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 2 | 01021 | Glacial Acetic Acid | 0001 | 1 | 380 |
| PRODUCTIONBATCH | 2 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 2 | 01044 | Sodium Bicarbonate | 0001 | 1 | 132 |
| PRODUCTIONBATCH | 2 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 2 | 00244 | Calco-Best 100 ML | 0001 | 1,100 | 26.4 |
| PACKINGBATCH | 2 | 02086 | S+D Calco Best 100 ml | 0001 | 1,150 | 12.5 |
| PACKINGBATCH | 2 | 03174 | Calco-Best Liquid | 0001 | 110 | 13.86 |
| PACKINGBATCH | 2 | 02010 | Bottle Pet Amber 100ML | 0001 | 1,100 | 10 |
| PACKINGBATCH | 2 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 11 | 194.8 |
| PurchasesBatch | 3 | 02265 | Label Garliment Plus 1Liter | 0001 | 15 | 40 |
| PurchasesBatch | 4 | 02097 | Bottle Round liter | 0001 | 12 | 155 |
| PurchasesBatch | 5 | 01003 | Bentonite | 0001 | 500 | 15 |
| PurchasesBatch | 6 | 01044 | Sodium Bicarbonate | 0001 | 25 | 132 |
| Productions | 3 | 03260 | Leo Viton Oral Liquid | 0001 | 120 | 133.33 |
| PRODUCTIONBATCH | 3 | 01036 | Propylene Glycol (PG) | 0001 | 12 | 750 |
| PRODUCTIONBATCH | 3 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 3 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 680 |
| PRODUCTIONBATCH | 3 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 3 | 01053 | Vitamin B1 | 0001 | 0 | 15,500 |
| PRODUCTIONBATCH | 3 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 3 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 3 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 24 | 1,170.65 |
| PACKINGBATCH | 3 | 02014 | Plastic Can White 5 Liter | 0001 | 24 | 390 |
| PACKINGBATCH | 3 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 0001 | 36 | 40 |
| PACKINGBATCH | 3 | 03260 | Leo Viton Oral Liquid | 0001 | 120 | 133.33 |
| PACKINGBATCH | 3 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 216 |
| Productions | 4 | 03254 | Hepa Leo Oral Liquid | 0001 | 60 | 173.43 |
| PRODUCTIONBATCH | 4 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 4 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 4 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 4 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 4 | 01045 | Sorbitol Liquid 70% | 0001 | 3 | 680 |
| PRODUCTIONBATCH | 4 | 01046 | Silmyrin | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 4 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 4 | 01184 | ARQ | 0001 | 3 | 367 |
| PACKING | 4 | 00358 | Hepa Leo Oral Liquid 5 Lit | 0001 | 12 | 1,377.82 |
| PACKINGBATCH | 4 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 390 |
| PACKINGBATCH | 4 | 02421 | Label Hepa Leo Oral Liquid 5 Lit | 0001 | 20 | 40 |
| PACKINGBATCH | 4 | 03254 | Hepa Leo Oral Liquid | 0001 | 60 | 173.43 |
| PACKINGBATCH | 4 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 216 |
| Productions | 5 | 03263 | Leo Abmrox Oral Liquid | 0001 | 100 | 78.38 |
| PRODUCTIONBATCH | 5 | 01031 | Menthol Crystal | 0001 | 1 | 6,500 |
| PRODUCTIONBATCH | 5 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 5 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 5 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 5 | 00367 | Leo Abmrox Oral Liquid 5 Lit | 0001 | 20 | 907.9 |
| PACKINGBATCH | 5 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 390 |
| PACKINGBATCH | 5 | 02430 | Label Leo Abmrox Oral Liquid 5 Lit | 0001 | 36 | 40 |
| PACKINGBATCH | 5 | 03263 | Leo Abmrox Oral Liquid | 0001 | 100 | 78.38 |
| PACKINGBATCH | 5 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 216 |
| Productions | 6 | 03258 | Leo Immunomax Oral Liquid | 0001 | 60 | 66.03 |
| PRODUCTIONBATCH | 6 | 01023 | Garlic Oil | 0001 | 0 | 5,500 |
| PRODUCTIONBATCH | 6 | 01025 | Ginger Oil | 000 | 0 | 4,500 |
| PRODUCTIONBATCH | 6 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 6 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 6 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 680 |
| PRODUCTIONBATCH | 6 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 6 | 00362 | Leo Immunomax Oral Liquid 5 Lit | 0001 | 12 | 854.15 |
| PACKINGBATCH | 6 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 390 |
| PACKINGBATCH | 6 | 02425 | Label Leo Immunomax Oral Liquid 5 Lit | 0001 | 24 | 40 |
| PACKINGBATCH | 6 | 03258 | Leo Immunomax Oral Liquid | 0001 | 60 | 66.03 |
| PACKINGBATCH | 6 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 216 |
| Productions | 7 | 03256 | Leo Adsorbo Oral Liquid | 0001 | 60 | 78.28 |
| PRODUCTIONBATCH | 7 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 7 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 7 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 7 | 01021 | Glacial Acetic Acid | 0001 | 0 | 380 |
| PRODUCTIONBATCH | 7 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 7 | 01046 | Silmyrin | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 7 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 7 | 01184 | ARQ | 0001 | 3 | 367 |
| PACKING | 7 | 00360 | Leo Adsorbo Oral Liquid 5 Lit | 0001 | 12 | 902.07 |
| PACKINGBATCH | 7 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 390 |
| PACKINGBATCH | 7 | 02423 | Label Leo Adsorbo Oral Liquid 5 Lit | 0001 | 20 | 40 |
| PACKINGBATCH | 7 | 03256 | Leo Adsorbo Oral Liquid | 0001 | 60 | 78.28 |
| PACKINGBATCH | 7 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 216 |
| Productions | 8 | 03261 | Leo Cid Pro | 0001 | 250 | 109.49 |
| PRODUCTIONBATCH | 8 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 8 | 01020 | Formic Acid | 0001 | 60 | 350 |
| PRODUCTIONBATCH | 8 | 01021 | Glacial Acetic Acid | 0001 | 2 | 380 |
| PRODUCTIONBATCH | 8 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 8 | 01038 | Phosphoric Acid 85% | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 8 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 8 | 01187 | Sodium Metaby Sulphate | 0001 | 5 | 200 |
| PACKING | 8 | 00365 | Leo Cid Pro 25 Lit | 0001 | 10 | 3,827.25 |
| PACKINGBATCH | 8 | 02128 | White Can 25 Liter | 0001 | 10 | 1,000 |
| PACKINGBATCH | 8 | 02428 | Label Leo Cid Pro 25 Lit | 0001 | 10 | 90 |
| PACKINGBATCH | 8 | 03261 | Leo Cid Pro | 0001 | 250 | 109.49 |
| Productions | 9 | 03262 | Leo Sorbex Oral Powder | 0001 | 250 | 19.46 |
| PRODUCTIONBATCH | 9 | 01003 | Bentonite | 0001 | 250 | 15.46 |
| PRODUCTIONBATCH | 9 | 01187 | Sodium Metaby Sulphate | 0001 | 5 | 200 |
| Productions | 9 | 03262 | Leo Sorbex Oral Powder | 0001 | 250 | 19.46 |
| PACKING | 9 | 00366 | Leo Sorbex Oral Powder 25 kg | 0001 | 10 | 606.54 |
| PACKINGBATCH | 9 | 02429 | Label Leo Sorbex Oral Powder 25 kg | 0001 | 10 | 120 |
| PACKINGBATCH | 9 | 03262 | Leo Sorbex Oral Powder | 0001 | 250 | 19.46 |
| PACKING | 9 | 00366 | Leo Sorbex Oral Powder 25 kg | 0001 | 10 | 606.54 |
| Productions | 10 | 03010 | Garlimint Plus BOP | 0001 | 12 | 128.59 |
| PRODUCTIONBATCH | 10 | 01023 | Garlic Oil | 0001 | 0 | 5,500 |
| PRODUCTIONBATCH | 10 | 01025 | Ginger Oil | 000 | 0 | 4,500 |
| PRODUCTIONBATCH | 10 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 10 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 10 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 10 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 680 |
| PRODUCTIONBATCH | 10 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 2,900 |
| PRODUCTIONBATCH | 10 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 10 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 12 | 412.85 |
| PACKINGBATCH | 10 | 02097 | Bottle Round liter | 0001 | 12 | 218.84 |
| PACKINGBATCH | 10 | 02265 | Label Garliment Plus 1Liter | 0001 | 15 | 40 |
| PACKINGBATCH | 10 | 03010 | Garlimint Plus BOP | 0001 | 12 | 128.59 |
| PACKINGBATCH | 10 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 1 | 185 |
| PACKING | 10 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 12 | 412.85 |
| OpeningBatch | 102 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 2 | 10,000 |
| Productions | 11 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 15.46 |
| PRODUCTIONBATCH | 11 | 01003 | Bentonite | 0001 | 100 | 15.46 |
| Productions | 11 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 15.46 |
| PACKING | 11 | 00022 | Magnet BOP 25kg | 0001 | 4 | 541.54 |
| PACKINGBATCH | 11 | 02033 | BAG Magnet 25 KG | 0001 | 4 | 155 |
| PACKINGBATCH | 11 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 15.46 |
| PACKING | 11 | 00022 | Magnet BOP 25kg | 0001 | 4 | 541.54 |
| Productions | 12 | 03163 | Calcium 72 | 0001 | 3,750 | 15.13 |
| PRODUCTIONBATCH | 12 | 01015 | DCP (Calcium) | 0001 | 2,750 | 17 |
| PRODUCTIONBATCH | 12 | 01016 | DCP (Dana) | 0001 | 1,000 | 10 |
| PACKING | 12 | 00231 | Calcium 72 25kg | 0001 | 150 | 458.33 |
| PACKINGBATCH | 12 | 02274 | Bag Calcium 72  25kg | 0001 | 150 | 80 |
| PACKINGBATCH | 12 | 03163 | Calcium 72 | 0001 | 3,750 | 15.13 |
| PACKING | 12 | 00231 | Calcium 72 25kg | 0001 | 150 | 458.33 |
| Productions | 13 | 03001 | Growth Promoter BOP Oral | 0001 | 900 | 14.41 |
| PRODUCTIONBATCH | 13 | 01016 | DCP (Dana) | 0001 | 711 | 10 |
| PRODUCTIONBATCH | 13 | 01042 | Starch | 0001 | 10 | 180 |
| PRODUCTIONBATCH | 13 | 01050 | Tartrazine Yellow Color Indian | 0001 | 1 | 2,900 |
| PACKING | 13 | 00016 | Growth Promoter 25kg | 0001 | 36 | 515.25 |
| PACKINGBATCH | 13 | 02032 | BAG Growth Promoter 25 KG | 0001 | 36 | 155 |
| PACKINGBATCH | 13 | 03001 | Growth Promoter BOP Oral | 0001 | 900 | 14.41 |
| PurchasesBatch | 7 | 01075 | Peppermint Oil | 0001 | 1 | 6,000 |
| PurchasesBatch | 7 | 01019 | Eucluptus Oil | 0001 | 2 | 5,000 |
| PurchasesBatch | 7 | 01065 | Spt Amm. Aromatic | 0001 | 600 | 250 |
| PurchasesBatch | 8 | 01003 | Bentonite | 0001 | 6,250 | 17.4 |
| Productions | 14 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 16.77 |
| PRODUCTIONBATCH | 14 | 01003 | Bentonite | 0001 | 2 | 17.31 |
| PRODUCTIONBATCH | 14 | 01016 | DCP (Dana) | 0001 | 250 | 10 |
| PRODUCTIONBATCH | 14 | 01044 | Sodium Bicarbonate | 0001 | 12 | 132 |
| Productions | 14 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 16.77 |
| PACKING | 14 | 00220 | Rumicid powder 25kg | 0001 | 10 | 619.33 |
| PACKINGBATCH | 14 | 02258 | Label Rumicid 25kg | 0001 | 10 | 45 |
| PACKINGBATCH | 14 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 14 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 16.77 |
| PACKING | 14 | 00220 | Rumicid powder 25kg | 0001 | 10 | 619.33 |
| PurchasesBatch | 9 | 01022 | Genshat Voilt (Crystal) | 0001 | 1 | 4,000 |
| PurchasesBatch | 10 | 01075 | Peppermint Oil | 0001 | 1 | 6,000 |
| PurchasesBatch | 10 | 01019 | Eucluptus Oil | 0001 | 1 | 5,000 |
| PurchasesBatch | 11 | 02124 | Label Mento Care 5 Lit | 0001 | 12 | 40 |
| PurchasesBatch | 11 | 02025 | Label Fuzion Plus 5 Liter | 0001 | 12 | 40 |
| PurchasesBatch | 11 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PurchasesBatch | 11 | 02323 | Label Bop Copper Liquiq 5L | 0001 | 12 | 40 |
| PurchasesBatch | 11 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 26 | 90 |
| PurchasesBatch | 11 | 02065 | Bottle Mento Care 1 Liter | 0001 | 15 | 40 |
| PurchasesBatch | 11 | 02300 | Label Bop Adek Liquid 1Liter | 0001 | 15 | 40 |
| PurchasesBatch | 11 | 02048 | Label Micro Sel-E Oral Liquid 1 Liter | 0001 | 15 | 40 |
| PurchasesBatch | 11 | 02431 | Label Toxi Off Oral Liquid 1 Lit | 0001 | 15 | 40 |
| Productions | 15 | 03190 | CRD Mint Oral Liquid | 0001 | 260 | 475.32 |
| PRODUCTIONBATCH | 15 | 01019 | Eucluptus Oil | 0001 | 5 | 5,000 |
| PRODUCTIONBATCH | 15 | 01031 | Menthol Crystal | 0001 | 3 | 6,500 |
| PRODUCTIONBATCH | 15 | 01036 | Propylene Glycol (PG) | 0001 | 35 | 750 |
| PRODUCTIONBATCH | 15 | 01041 | Sodium Benzoate | 0001 | 1 | 620 |
| PRODUCTIONBATCH | 15 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 15 | 01075 | Peppermint Oil | 0001 | 3 | 5,714.29 |
| PRODUCTIONBATCH | 15 | 01189 | Glycerine | 0001 | 26 | 590 |
| PRODUCTIONBATCH | 15 | 01201 | I.P.A | 0001 | 26 | 600 |
| PACKING | 15 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 52 | 2,943.67 |
| PACKINGBATCH | 15 | 02014 | Plastic Can White 5 Liter | 0001 | 52 | 390 |
| PACKINGBATCH | 15 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PACKINGBATCH | 15 | 03190 | CRD Mint Oral Liquid | 0001 | 260 | 475.32 |
| PACKINGBATCH | 15 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 13 | 216 |
| PACKING | 15 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 52 | 2,943.67 |
| Productions | 16 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 105.17 |
| PRODUCTIONBATCH | 16 | 01009 | Copper Sulphate | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 16 | 01020 | Formic Acid | 0001 | 120 | 350 |
| PRODUCTIONBATCH | 16 | 01021 | Glacial Acetic Acid | 0001 | 1 | 380 |
| PRODUCTIONBATCH | 16 | 01038 | Phosphoric Acid 85% | 0001 | 10 | 650 |
| PRODUCTIONBATCH | 16 | 01041 | Sodium Benzoate | 0001 | 1 | 620 |
| PRODUCTIONBATCH | 16 | 01187 | Sodium Metaby Sulphate | 0001 | 1 | 200 |
| PACKING | 16 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 3,746.25 |
| PACKINGBATCH | 16 | 02128 | White Can 25 Liter | 0001 | 20 | 1,000 |
| PACKINGBATCH | 16 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 26 | 90 |
| PACKINGBATCH | 16 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 105.17 |
| Productions | 17 | 03135 | Toxi - Off Liquid | 0001 | 12 | 224.3 |
| PRODUCTIONBATCH | 17 | 01005 | CMC Sodium | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 17 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 17 | 01011 | Choline Chloride | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 17 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 17 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 17 | 01021 | Glacial Acetic Acid | 0001 | 0 | 380 |
| PRODUCTIONBATCH | 17 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 17 | 01046 | Silmyrin | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 17 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 17 | 01184 | ARQ | 0001 | 0 | 367 |
| PACKING | 17 | 00368 | Toxi Off Oral Liquid 1 Lit | 0001 | 12 | 508.56 |
| PACKINGBATCH | 17 | 02097 | Bottle Round liter | 0001 | 12 | 218.84 |
| PACKINGBATCH | 17 | 02431 | Label Toxi Off Oral Liquid 1 Lit | 0001 | 15 | 40 |
| PACKINGBATCH | 17 | 03135 | Toxi - Off Liquid | 0001 | 12 | 224.3 |
| PACKINGBATCH | 17 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 1 | 185 |
| PACKING | 17 | 00368 | Toxi Off Oral Liquid 1 Lit | 0001 | 12 | 508.56 |
| Productions | 18 | 03027 | Micro Sel-E Oral Liquid | 0001 | 12 | 231.13 |
| PRODUCTIONBATCH | 18 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 18 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 18 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 680 |
| PRODUCTIONBATCH | 18 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 18 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 18 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PACKING | 18 | 00055 | Micro Sel-E Oral Liquid 1 Lit | 0001 | 12 | 515.39 |
| PACKINGBATCH | 18 | 02048 | Label Micro Sel-E Oral Liquid 1 Liter | 0001 | 15 | 40 |
| PACKINGBATCH | 18 | 02097 | Bottle Round liter | 0001 | 12 | 218.84 |
| PACKINGBATCH | 18 | 03027 | Micro Sel-E Oral Liquid | 0001 | 12 | 231.13 |
| PACKINGBATCH | 18 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 1 | 185 |
| PACKING | 18 | 00055 | Micro Sel-E Oral Liquid 1 Lit | 0001 | 12 | 515.39 |
| Productions | 19 | 03034 | BOP ADEK Oral Liquid | 0001 | 12 | 95.53 |
| PRODUCTIONBATCH | 19 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 19 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 19 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 680 |
| PRODUCTIONBATCH | 19 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 19 | 01053 | Vitamin B1 | 0001 | 0 | 15,500 |
| PRODUCTIONBATCH | 19 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 19 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 19 | 00063 | BOP ADEK Oral Liquid 1 Lit | 0001 | 12 | 379.79 |
| PACKINGBATCH | 19 | 02097 | Bottle Round liter | 0001 | 12 | 218.84 |
| PACKINGBATCH | 19 | 02300 | Label Bop Adek Liquid 1Liter | 0001 | 15 | 40 |
| PACKINGBATCH | 19 | 03034 | BOP ADEK Oral Liquid | 0001 | 12 | 95.53 |
| PACKINGBATCH | 19 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 1 | 185 |
| PACKING | 19 | 00063 | BOP ADEK Oral Liquid 1 Lit | 0001 | 12 | 379.79 |
| Productions | 20 | 03026 | Mento Care Oral Liquid | 0001 | 32 | 111.86 |
| PRODUCTIONBATCH | 20 | 01031 | Menthol Crystal | 0001 | 0 | 6,500 |
| PRODUCTIONBATCH | 20 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 20 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 20 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 20 | 00119 | Mento Care Oral  Liquid 5 Lit | 0001 | 4 | 1,123.3 |
| PACKINGBATCH | 20 | 02014 | Plastic Can White 5 Liter | 0001 | 4 | 390 |
| PACKINGBATCH | 20 | 02124 | Label Mento Care 5 Lit | 0001 | 12 | 40 |
| PACKINGBATCH | 20 | 03026 | Mento Care Oral Liquid | 0001 | 20 | 111.86 |
| PACKINGBATCH | 20 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 1 | 216 |
| PurchasesBatch | 11 | 02065 | Bottle Mento Care 1 Liter |  | 0 | 0 |
| PurchasesBatch | 11 | 02047 | Label Mento Care 1 Liter | 0001 | 15 | 40 |
| PACKING | 21 | 00054 | Mento Care Oral Liquid | 0001 | 12 | 396.12 |
| PACKINGBATCH | 21 | 02047 | Label Mento Care 1 Liter | 0001 | 15 | 40 |
| PACKINGBATCH | 21 | 02097 | Bottle Round liter | 0001 | 12 | 218.84 |
| PACKINGBATCH | 21 | 03026 | Mento Care Oral Liquid | 0001 | 12 | 111.86 |
| PACKINGBATCH | 21 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 1 | 185 |
| PACKING | 21 | 00054 | Mento Care Oral Liquid | 0001 | 12 | 396.12 |
| Productions | 21 | 03009 | Fuzion Plus | 0001 | 40 | 126.03 |
| PRODUCTIONBATCH | 21 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 21 | 01011 | Choline Chloride | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 21 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 21 | 01021 | Glacial Acetic Acid | 0001 | 0 | 380 |
| PRODUCTIONBATCH | 21 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 21 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 21 | 01184 | ARQ | 0001 | 0 | 367 |
| PACKING | 22 | 00046 | Fuzion Plus 5 Lit | 0001 | 8 | 1,134.17 |
| PACKINGBATCH | 22 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 390 |
| PACKINGBATCH | 22 | 02025 | Label Fuzion Plus 5 Liter | 0001 | 12 | 40 |
| PACKINGBATCH | 22 | 03009 | Fuzion Plus | 0001 | 40 | 126.03 |
| PACKINGBATCH | 22 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 216 |
| Productions | 22 | 03107 | Bop Copper Liquid | 0001 | 40 | 122.18 |
| PRODUCTIONBATCH | 22 | 01009 | Copper Sulphate | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 22 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 22 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 22 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 22 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 680 |
| PRODUCTIONBATCH | 22 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 23 | 00261 | Bop Copper 5L | 0001 | 8 | 1,114.9 |
| PACKINGBATCH | 23 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 390 |
| PACKINGBATCH | 23 | 02323 | Label Bop Copper Liquiq 5L | 0001 | 12 | 40 |
| PACKINGBATCH | 23 | 03107 | Bop Copper Liquid | 0001 | 40 | 122.18 |
| PACKINGBATCH | 23 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 216 |
| Productions | 23 | 03163 | Calcium 72 | 0001 | 1,250 | 10 |
| PRODUCTIONBATCH | 23 | 01016 | DCP (Dana) | 0001 | 1,250 | 10 |
| PACKING | 24 | 00231 | Calcium 72 25kg | 0001 | 50 | 330 |
| PACKINGBATCH | 24 | 02274 | Bag Calcium 72  25kg | 0001 | 50 | 80 |
| PACKINGBATCH | 24 | 03163 | Calcium 72 | 0001 | 1,250 | 10 |
| Productions | 24 | 03011 | Hepatic-Optimizer Liquid | 0001 | 40 | 121.85 |
| PRODUCTIONBATCH | 24 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 24 | 01011 | Choline Chloride | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 24 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 24 | 01013 | Calcium Chloride | 0001 | 0 | 160 |
| PRODUCTIONBATCH | 24 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 24 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 24 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 24 | 01184 | ARQ | 0001 | 2 | 367 |
| PACKING | 25 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 8 | 1,053.25 |
| PACKINGBATCH | 25 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 390 |
| PACKINGBATCH | 25 | 03011 | Hepatic-Optimizer Liquid | 0001 | 40 | 121.85 |
| PACKINGBATCH | 25 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 216 |
| OpeningBatch | 103 | 00053 | Kimchi sal Oral Liquid 5 Lit | 0001 | 4 | 9,000 |
| Productions | 25 | 03055 | Ori Tox Oral Powder 25 kg | 0001 | 5,000 | 17.66 |
| PRODUCTIONBATCH | 25 | 01003 | Bentonite | 0001 | 5,100 | 17.31 |
| PACKING | 26 | 00078 | ORITOX Oral Powder  25 Kg | 0001 | 200 | 441.44 |
| PACKINGBATCH | 26 | 03055 | Ori Tox Oral Powder 25 kg | 0001 | 5,000 | 17.66 |
| Productions | 26 | 03021 | Vital Gold | 0001 | 1,000 | 50.03 |
| PRODUCTIONBATCH | 26 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 26 | 01013 | Calcium Chloride | 0001 | 0 | 160 |
| PRODUCTIONBATCH | 26 | 01016 | DCP (Dana) | 0001 | 800 | 10 |
| PRODUCTIONBATCH | 26 | 01034 | Magnesium Sulphate | 0001 | 1 | 380 |
| PRODUCTIONBATCH | 26 | 01042 | Starch | 0001 | 12 | 180 |
| PRODUCTIONBATCH | 26 | 01050 | Tartrazine Yellow Color Indian | 0001 | 1 | 2,900 |
| PRODUCTIONBATCH | 26 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 26 | 01054 | Vitamin B2 | 0001 | 0 | 16,000 |
| PRODUCTIONBATCH | 26 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 26 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 26 | 01060 | Zinc Sulphate | 0001 | 2 | 950 |
| PRODUCTIONBATCH | 26 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 26 | 01143 | Vitamin B3 | 0001 | 3 | 3,200 |
| PACKING | 27 | 00026 | Vital Gold 1kg | 0001 | 1,000 | 50.03 |
| PACKINGBATCH | 27 | 03021 | Vital Gold | 0001 | 1,000 | 50.03 |
| PurchasesBatch | 12 | 02268 | Label P.H Cure 25Liter | 0001 | 32 | 90 |
| PurchasesBatch | 13 | 01027 | Kaolin | 0001 | 25 | 400 |
| PurchasesBatch | 14 | 01043 | Sodium Chloride | 0001 | 2,000 | 13.75 |
| Productions | 27 | 03011 | Hepatic-Optimizer Liquid | 0001 | 140 | 83.1 |
| PRODUCTIONBATCH | 27 | 01010 | Betaine | 0001 | 2 | 2,800 |
| PRODUCTIONBATCH | 27 | 01011 | Choline Chloride | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 27 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 27 | 01013 | Calcium Chloride | 0001 | 2 | 160 |
| PRODUCTIONBATCH | 27 | 01038 | Phosphoric Acid 85% | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 27 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 27 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 27 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 27 | 01184 | ARQ | 0001 | 2 | 367 |
| Productions | 27 | 03011 | Hepatic-Optimizer Liquid | 0001 | 140 | 83.1 |
| PACKING | 28 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 28 | 867.2 |
| PACKINGBATCH | 28 | 02014 | Plastic Can White 5 Liter | 0001 | 28 | 390 |
| PACKINGBATCH | 28 | 03011 | Hepatic-Optimizer Liquid | 0001 | 140 | 83.1 |
| PACKINGBATCH | 28 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 216 |
| PACKING | 28 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 28 | 867.2 |
| Productions | 28 | 03104 | BOP PH 5 Liquid | 0001 | 250 | 142.54 |
| PRODUCTIONBATCH | 28 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 28 | 01020 | Formic Acid | 0001 | 75 | 350 |
| PRODUCTIONBATCH | 28 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 28 | 01036 | Propylene Glycol (PG) | 0001 | 10 | 750 |
| PRODUCTIONBATCH | 28 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 28 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| OpeningBatch | 67 | 02128 | White Can 25 Liter | 0001 | 51 | 1,000 |
| PACKING | 29 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 10 | 4,563.5 |
| PACKINGBATCH | 29 | 02128 | White Can 25 Liter | 0001 | 10 | 1,000 |
| PACKINGBATCH | 29 | 03104 | BOP PH 5 Liquid | 0001 | 250 | 142.54 |
| Productions | 29 | 03162 | P.H Cure Liquid | 0001 | 600 | 61.31 |
| PRODUCTIONBATCH | 29 | 01009 | Copper Sulphate | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 29 | 01020 | Formic Acid | 0001 | 80 | 350 |
| PRODUCTIONBATCH | 29 | 01036 | Propylene Glycol (PG) | 0001 | 6 | 750 |
| PRODUCTIONBATCH | 29 | 01041 | Sodium Benzoate | 0001 | 1 | 620 |
| PRODUCTIONBATCH | 29 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PACKING | 30 | 00228 | P.H Cure 25 Liter | 0001 | 24 | 2,111 |
| PACKINGBATCH | 30 | 02128 | White Can 25 Liter | 0001 | 11 | 1,000 |
| PACKINGBATCH | 30 | 02268 | Label P.H Cure 25Liter | 0001 | 32 | 90 |
| PACKINGBATCH | 30 | 03162 | P.H Cure Liquid | 0001 | 600 | 61.31 |
| PACKING | 30 | 00228 | P.H Cure 25 Liter | 0001 | 24 | 2,111 |
| SALESBATCH | 1 | 00244 | Calco-Best 100 ML | 0001 | 1,100 | 26.4 |
| SALESBATCH | 2 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 1,295.25 |
| SALESBATCH | 3 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 24 | 1,170.65 |
| SALESBATCH | 3 | 00358 | Hepa Leo Oral Liquid 5 Lit | 0001 | 12 | 1,377.82 |
| SALESBATCH | 3 | 00367 | Leo Abmrox Oral Liquid 5 Lit | 0001 | 20 | 907.9 |
| SALESBATCH | 3 | 00362 | Leo Immunomax Oral Liquid 5 Lit | 0001 | 12 | 854.15 |
| SALESBATCH | 3 | 00360 | Leo Adsorbo Oral Liquid 5 Lit | 0001 | 12 | 902.07 |
| SALESBATCH | 3 | 00365 | Leo Cid Pro 25 Lit | 0001 | 10 | 3,827.25 |
| SALESBATCH | 3 | 00366 | Leo Sorbex Oral Powder 25 kg | 0001 | 10 | 606.54 |
| SALESBATCH | 4 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 12 | 412.85 |
| SALESBATCH | 5 | 00231 | Calcium 72 25kg | 0001 | 150 | 426.25 |
| SALESBATCH | 5 | 00016 | Growth Promoter 25kg | 0001 | 36 | 515.25 |
| SALESBATCH | 6 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 2 | 10,000 |
| SALESBATCH | 6 | 00022 | Magnet BOP 25kg | 0001 | 4 | 541.54 |
| SALESBATCH | 7 | 00220 | Rumicid powder 25kg | 0001 | 10 | 619.33 |
| SALESBATCH | 8 | 00078 | ORITOX Oral Powder  25 Kg | 0001 | 200 | 441.44 |
| SALESBATCH | 8 | 00026 | Vital Gold 1kg | 0001 | 1,000 | 50.03 |
| SALESBATCH | 9 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 52 | 2,943.67 |
| SALESBATCH | 10 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 3,746.25 |
| SALESBATCH | 11 | 00368 | Toxi Off Oral Liquid 1 Lit | 0001 | 12 | 508.56 |
| SALESBATCH | 11 | 00055 | Micro Sel-E Oral Liquid 1 Lit | 0001 | 12 | 515.39 |
| SALESBATCH | 11 | 00054 | Mento Care Oral Liquid | 0001 | 12 | 396.12 |
| SALESBATCH | 11 | 00063 | BOP ADEK Oral Liquid 1 Lit | 0001 | 12 | 379.79 |
| SALESBATCH | 12 | 00046 | Fuzion Plus 5 Lit | 0001 | 8 | 1,134.17 |
| SALESBATCH | 12 | 00261 | Bop Copper 5L | 0001 | 8 | 1,114.9 |
| SALESBATCH | 12 | 00119 | Mento Care Oral  Liquid 5 Lit | 0001 | 4 | 1,123.3 |
| SALESBATCH | 12 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 8 | 908.55 |
| SALESBATCH | 12 | 00053 | Kimchi sal Oral Liquid 5 Lit | 0001 | 4 | 9,000 |
| SALESBATCH | 12 | 00231 | Calcium 72 25kg | 0001 | 50 | 426.25 |
| SALESBATCH | 12 | 00019 | DCP BOP 25kg | 0001 | 56 | 1,440 |
| SALESBATCH | 13 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 28 | 908.55 |
| SALESBATCH | 14 | 00228 | P.H Cure 25 Liter | 0001 | 24 | 2,111 |
| PurchasesBatch | 7 | 01019 | Eucluptus Oil | 0001 | 3 | 5,000 |
| PurchasesBatch | 7 | 01065 | Spt Amm. Aromatic | 0001 | 600 | 265 |
| PurchasesBatch | 7 | 01075 | Peppermint Oil | 0001 | 2 | 5,500 |
| PurchasesBatch | 15 | 01004 | Citric Acid | 0001 | 25 | 400 |
| PurchasesBatch | 15 | 01028 | Lactic Acid | 0001 | 25 | 1,650 |
| PurchasesBatch | 15 | 01021 | Glacial Acetic Acid | 0001 | 30 | 400 |
| PurchasesBatch | 16 | 02014 | Plastic Can White 5 Liter | 0001 | 544 | 390 |
| PurchasesBatch | 17 | 02365 | Label O-D Plus Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PurchasesBatch | 17 | 02364 | Label BOP E 50 Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PurchasesBatch | 17 | 02144 | Label Super Copper Liquid 5 Lit | 0001 | 475 | 20 |
| PurchasesBatch | 17 | 02432 | BROCHURE | 0001 | 950 | 20 |
| PurchasesBatch | 18 | 01042 | Starch | 0001 | 50 | 167 |
| PurchasesBatch | 18 | 01019 | Eucluptus Oil | 0001 | 2 | 5,000 |
| PurchasesBatch | 18 | 01075 | Peppermint Oil | 0001 | 2 | 6,000 |
| PurchasesBatch | 18 | 01193 | Castor Oil | 0001 | 2 | 700 |
| PurchasesBatch | 18 | 01070 | Anise Oil | 0001 | 2 | 4,500 |
| Productions | 30 | 03028 | O-D Plus Oral Liquid | 0001 | 240 | 364.3 |
| PRODUCTIONBATCH | 30 | 01017 | Camphor | 0001 | 1 | 3,200 |
| PRODUCTIONBATCH | 30 | 01019 | Eucluptus Oil | 0001 | 2 | 5,000 |
| PRODUCTIONBATCH | 30 | 01031 | Menthol Crystal | 0001 | 3 | 6,500 |
| PRODUCTIONBATCH | 30 | 01036 | Propylene Glycol (PG) | 0001 | 12 | 750 |
| PRODUCTIONBATCH | 30 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 30 | 01045 | Sorbitol Liquid 70% | 0001 | 12 | 680 |
| PRODUCTIONBATCH | 30 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 30 | 01070 | Anise Oil | 0001 | 2 | 4,500 |
| PRODUCTIONBATCH | 30 | 01075 | Peppermint Oil | 0001 | 2 | 5,833.33 |
| PRODUCTIONBATCH | 30 | 01189 | Glycerine | 0001 | 10 | 590 |
| PACKING | 31 | 00177 | O-D Plus Oral Liquid 5 Liter | 0001 | 48 | 2,318.82 |
| PACKINGBATCH | 31 | 02014 | Plastic Can White 5 Liter | 0001 | 48 | 390 |
| PACKINGBATCH | 31 | 02365 | Label O-D Plus Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PACKINGBATCH | 31 | 03028 | O-D Plus Oral Liquid | 0001 | 240 | 364.3 |
| PACKINGBATCH | 31 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 216 |
| PACKING | 31 | 00177 | O-D Plus Oral Liquid 5 Liter | 0001 | 48 | 2,318.82 |
| Productions | 31 | 03094 | Super Copper Liquid | 0001 | 200 | 333.48 |
| PRODUCTIONBATCH | 31 | 01004 | Citric Acid | 0001 | 10 | 400 |
| PRODUCTIONBATCH | 31 | 01009 | Copper Sulphate | 0001 | 15 | 1,650 |
| PRODUCTIONBATCH | 31 | 01028 | Lactic Acid | 0001 | 12 | 1,650 |
| PRODUCTIONBATCH | 31 | 01036 | Propylene Glycol (PG) | 0001 | 10 | 750 |
| PRODUCTIONBATCH | 31 | 01045 | Sorbitol Liquid 70% | 0001 | 10 | 680 |
| PRODUCTIONBATCH | 31 | 01058 | Xanthan Gum | 0001 | 1 | 1,600 |
| PRODUCTIONBATCH | 31 | 01041 | Sodium Benzoate | 0001 | 1 | 620 |
| PACKING | 32 | 00135 | Super Copper Liquid 5 Lit | 0001 | 40 | 2,138.88 |
| PACKINGBATCH | 32 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 390 |
| PACKINGBATCH | 32 | 02144 | Label Super Copper Liquid 5 Lit | 0001 | 55 | 20 |
| PACKINGBATCH | 32 | 03094 | Super Copper Liquid | 0001 | 200 | 333.48 |
| PACKINGBATCH | 32 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 216 |
| Productions | 32 | 03096 | Uri Flush Liquid | 0001 | 48 | 84.9 |
| PRODUCTIONBATCH | 32 | 01002 | Ammonium chloride | 0001 | 2 | 200 |
| PRODUCTIONBATCH | 32 | 01034 | Magnesium Sulphate | 0001 | 0 | 380 |
| PRODUCTIONBATCH | 32 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 32 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 32 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 680 |
| PRODUCTIONBATCH | 32 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,300 |
| PRODUCTIONBATCH | 32 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 32 | 01105 | Sodium Citrate | 0001 | 1 | 290 |
| PACKING | 33 | 00356 | Uri Flush Oral Liquid 1 Lit | 0001 | 48 | 319.16 |
| PACKINGBATCH | 33 | 02097 | Bottle Round liter | 0001 | 48 | 218.84 |
| PACKINGBATCH | 33 | 03096 | Uri Flush Liquid | 0001 | 48 | 84.9 |
| PACKINGBATCH | 33 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 4 | 185 |
| PACKING | 33 | 00356 | Uri Flush Oral Liquid 1 Lit | 0001 | 48 | 319.16 |
| PurchasesBatch | 19 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 0001 | 50 | 40 |
| PurchasesBatch | 19 | 02147 | Label Bio Ambrox 5 Lit | 0001 | 150 | 40 |
| PurchasesBatch | 20 | 01073 | Potassium Chloride | 0001 | 25 | 520 |
| PurchasesBatch | 20 | 01189 | Glycerine | 0001 | 250 | 820 |
| PurchasesBatch | 20 | 01045 | Sorbitol Liquid 70% | 0001 | 550 | 380 |
| PurchasesBatch | 20 | 01010 | Betaine | 0001 | 25 | 2,800 |
| PurchasesBatch | 20 | 01201 | I.P.A | 0001 | 30 | 750 |
| Productions | 33 | 03054 | Bio Ambrox  Liquid | 0001 | 520 | 96.58 |
| PRODUCTIONBATCH | 33 | 01031 | Menthol Crystal | 0001 | 5 | 6,500 |
| PRODUCTIONBATCH | 33 | 01041 | Sodium Benzoate | 0001 | 2 | 620 |
| PRODUCTIONBATCH | 33 | 01048 | Titanium Dioxide (T.T) | 0001 | 2 | 1,500 |
| PRODUCTIONBATCH | 33 | 01058 | Xanthan Gum | 0001 | 2 | 1,600 |
| PRODUCTIONBATCH | 33 | 01017 | Camphor | 0001 | 1 | 3,200 |
| PACKING | 34 | 00138 | Bio Ambrox 5Lit | 0001 | 104 | 1,009.17 |
| PACKINGBATCH | 34 | 02014 | Plastic Can White 5 Liter | 0001 | 110 | 390 |
| PACKINGBATCH | 34 | 02147 | Label Bio Ambrox 5 Lit | 0001 | 150 | 40 |
| PACKINGBATCH | 34 | 03054 | Bio Ambrox  Liquid | 0001 | 520 | 96.58 |
| PACKINGBATCH | 34 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 27 | 216 |
| Productions | 34 | 03215 | BOP E 50 Oral Liquid | 0001 | 220 | 627.55 |
| PRODUCTIONBATCH | 34 | 01036 | Propylene Glycol (PG) | 0001 | 55 | 750 |
| PRODUCTIONBATCH | 34 | 01041 | Sodium Benzoate | 0001 | 1 | 620 |
| PRODUCTIONBATCH | 34 | 01045 | Sorbitol Liquid 70% | 0001 | 55 | 421.7 |
| PRODUCTIONBATCH | 34 | 01058 | Xanthan Gum | 0001 | 1 | 1,600 |
| PRODUCTIONBATCH | 34 | 01072 | Vitamin E | 0001 | 1 | 9,500 |
| PRODUCTIONBATCH | 34 | 01189 | Glycerine | 0001 | 50 | 807.8 |
| PRODUCTIONBATCH | 34 | 01201 | I.P.A | 0001 | 25 | 670.31 |
| Productions | 34 | 03215 | BOP E 50 Oral Liquid | 0001 | 220 | 627.55 |
| PACKING | 35 | 00307 | BOP E 50 Oral Liquid 5 Lit | 0001 | 44 | 3,585.94 |
| PACKINGBATCH | 35 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 390 |
| PACKINGBATCH | 35 | 02364 | Label BOP E 50 Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PACKINGBATCH | 35 | 03215 | BOP E 50 Oral Liquid | 0001 | 220 | 627.55 |
| PACKING | 35 | 00307 | BOP E 50 Oral Liquid 5 Lit | 0001 | 44 | 3,585.94 |
| Productions | 35 | 03260 | Leo Viton Oral Liquid | 0001 | 140 | 132.06 |
| PRODUCTIONBATCH | 35 | 01036 | Propylene Glycol (PG) | 0001 | 14 | 750 |
| PRODUCTIONBATCH | 35 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 35 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 421.7 |
| PRODUCTIONBATCH | 35 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 35 | 01053 | Vitamin B1 | 0001 | 0 | 15,500 |
| PRODUCTIONBATCH | 35 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,300 |
| PRODUCTIONBATCH | 35 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 35 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| Productions | 35 | 03260 | Leo Viton Oral Liquid | 0001 | 140 | 132.06 |
| PACKING | 36 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 28 | 1,175.75 |
| PACKINGBATCH | 36 | 02014 | Plastic Can White 5 Liter | 0001 | 28 | 390 |
| PACKINGBATCH | 36 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 0001 | 50 | 40 |
| PACKINGBATCH | 36 | 03260 | Leo Viton Oral Liquid | 0001 | 140 | 132.06 |
| PACKINGBATCH | 36 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 7 | 216 |
| PACKING | 36 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 28 | 1,175.75 |
| Productions | 36 | 03001 | Growth Promoter BOP Oral | 0001 | 125 | 17.14 |
| PRODUCTIONBATCH | 36 | 01016 | DCP (Dana) | 0001 | 100 | 10 |
| PRODUCTIONBATCH | 36 | 01042 | Starch | 0001 | 1 | 170.33 |
| PRODUCTIONBATCH | 36 | 01043 | Sodium Chloride | 0001 | 25 | 13.75 |
| PRODUCTIONBATCH | 36 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 2,900 |
| Productions | 36 | 03001 | Growth Promoter BOP Oral | 0001 | 125 | 17.14 |
| PACKING | 37 | 00016 | Growth Promoter 25kg | 0001 | 5 | 583.6 |
| PACKINGBATCH | 37 | 02032 | BAG Growth Promoter 25 KG | 0001 | 5 | 155 |
| PACKINGBATCH | 37 | 03001 | Growth Promoter BOP Oral | 0001 | 125 | 17.14 |
| PACKING | 37 | 00016 | Growth Promoter 25kg | 0001 | 5 | 583.6 |
| PurchasesBatch | 21 | 02133 | Label HepaLive Liquid 5 Liter | 0001 | 475 | 20 |
| PurchasesBatch | 21 | 02212 | Label HepaLiv Liquid 1 Liter | 0001 | 475 | 20 |
| PurchasesBatch | 21 | 02131 | Label RespiGuard 5 Liter | 0001 | 475 | 20 |
| PurchasesBatch | 21 | 02397 | Label Respi Guard Oral Liquid 1 Lit | 0001 | 475 | 20 |
| PurchasesBatch | 21 | 02106 | Label Kimchi Sal 5 Lit | 0001 | 475 | 20 |
| PurchasesBatch | 21 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 475 | 20 |
| PurchasesBatch | 21 | 02403 | Label Super Copper 1Lit | 0001 | 475 | 20 |
| PurchasesBatch | 22 | 01206 | Lab Items For Testing | 0001 | 7 | 5,342.86 |
| Productions | 37 | 03025 | Kimchi Sal Oral Liquid | 0001 | 190 | 36.28 |
| PRODUCTIONBATCH | 37 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 37 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 37 | 01021 | Glacial Acetic Acid | 0001 | 0 | 398.84 |
| PRODUCTIONBATCH | 37 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 37 | 01036 | Propylene Glycol (PG) | 0001 | 1 | 750 |
| PRODUCTIONBATCH | 37 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 37 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 37 | 01045 | Sorbitol Liquid 70% | 0001 | 3 | 421.7 |
| PRODUCTIONBATCH | 37 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| Productions | 37 | 03025 | Kimchi Sal Oral Liquid | 0001 | 190 | 36.28 |
| OpeningBatch | 104 | 02399 | Label Kimchi Sal Oral Liquid 1 Lit | 0001 | 300 | 20 |
| PACKING | 38 | 00184 | Kimchi Sal Liquid 1 Liter | 0001 | 190 | 291.67 |
| PACKINGBATCH | 38 | 02097 | Bottle Round liter | 0001 | 190 | 218.84 |
| PACKINGBATCH | 38 | 02399 | Label Kimchi Sal Oral Liquid 1 Lit | 0001 | 190 | 20 |
| PACKINGBATCH | 38 | 03025 | Kimchi Sal Oral Liquid | 0001 | 190 | 36.28 |
| PACKINGBATCH | 38 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 17 | 185 |
| PACKING | 38 | 00184 | Kimchi Sal Liquid 1 Liter | 0001 | 190 | 291.67 |
| Productions | 38 | 03093 | Ferovit Plus Liquid | 0001 | 120 | 279.97 |
| PRODUCTIONBATCH | 38 | 01009 | Copper Sulphate | 0001 | 3 | 1,650 |
| PRODUCTIONBATCH | 38 | 01036 | Propylene Glycol (PG) | 0001 | 4 | 750 |
| PRODUCTIONBATCH | 38 | 01045 | Sorbitol Liquid 70% | 0001 | 16 | 421.7 |
| PRODUCTIONBATCH | 38 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 38 | 01053 | Vitamin B1 | 0001 | 0 | 15,500 |
| PRODUCTIONBATCH | 38 | 01054 | Vitamin B2 | 0001 | 0 | 16,000 |
| PRODUCTIONBATCH | 38 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,300 |
| PRODUCTIONBATCH | 38 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 38 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 38 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PRODUCTIONBATCH | 38 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 38 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| PRODUCTIONBATCH | 38 | 01034 | Magnesium Sulphate | 0001 | 2 | 380 |
| Productions | 38 | 03093 | Ferovit Plus Liquid | 0001 | 120 | 279.97 |
| OpeningBatch | 105 | 02398 | Label Ferovit Plus Oral Liquid 1 Lit | 0001 | 300 | 20 |
| PACKING | 39 | 00205 | Ferovit Plus Liquid 1Lit | 0001 | 120 | 541.93 |
| PACKINGBATCH | 39 | 02097 | Bottle Round liter | 0001 | 120 | 218.84 |
| PACKINGBATCH | 39 | 02398 | Label Ferovit Plus Oral Liquid 1 Lit | 0001 | 120 | 20 |
| PACKINGBATCH | 39 | 03093 | Ferovit Plus Liquid | 0001 | 120 | 279.97 |
| PACKINGBATCH | 39 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 15 | 185 |
| PACKING | 39 | 00205 | Ferovit Plus Liquid 1Lit | 0001 | 120 | 541.93 |
| Productions | 39 | 03019 | Super Yeast Powder | 0001 | 250 | 17.31 |
| PRODUCTIONBATCH | 39 | 01003 | Bentonite | 0001 | 250 | 17.31 |
| Productions | 39 | 03019 | Super Yeast Powder | 0001 | 250 | 17.31 |
| OpeningBatch | 106 | 02042 | Label Super Yeast 25 KG | 0001 | 200 | 40 |
| OpeningBatch | 107 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 230 | 40 |
| PACKING | 40 | 00040 | Super Yeast Powder 25kg | 0001 | 10 | 627.78 |
| PACKINGBATCH | 40 | 02042 | Label Super Yeast 25 KG | 0001 | 10 | 40 |
| PACKINGBATCH | 40 | 02213 | Bag Bop Red Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 40 | 03019 | Super Yeast Powder | 0001 | 250 | 17.31 |
| PACKING | 40 | 00040 | Super Yeast Powder 25kg | 0001 | 10 | 627.78 |
| OpeningBatch | 108 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 24 | 5,000 |
| PurchasesBatch | 23 | 02314 | Dropper  30ML | 0001 | 5,000 | 12.5 |
| PurchasesBatch | 23 | 02010 | Bottle Pet Amber 100ML | 0001 | 10,000 | 9 |
| SALESBATCH | 15 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 10 | 4,563.5 |
| SALESBATCH | 16 | 00177 | O-D Plus Oral Liquid 5 Liter | 0001 | 48 | 2,318.82 |
| SALESBATCH | 16 | 00135 | Super Copper Liquid 5 Lit | 0001 | 40 | 2,138.88 |
| SALESBATCH | 16 | 00356 | Uri Flush Oral Liquid 1 Lit | 0001 | 48 | 319.16 |
| SALESBATCH | 17 | 00138 | Bio Ambrox 5Lit | 0001 | 104 | 1,009.17 |
| SALESBATCH | 17 | 00307 | BOP E 50 Oral Liquid 5 Lit | 0001 | 44 | 3,585.94 |
| SALESBATCH | 18 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 28 | 1,175.75 |
| SALESBATCH | 19 | 00016 | Growth Promoter 25kg | 0001 | 5 | 583.6 |
| SALESBATCH | 20 | 00184 | Kimchi Sal Liquid 1 Liter | 0001 | 190 | 291.67 |
| SALESBATCH | 20 | 00205 | Ferovit Plus Liquid 1Lit | 0001 | 120 | 541.93 |
| SALESBATCH | 21 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 24 | 5,000 |
| SALESBATCH | 22 | 00040 | Super Yeast Powder 25kg | 0001 | 10 | 627.78 |
| PurchasesBatch | 2 | 02211 | Label RespiFit Liquid 5 Liter | 0001 | 64 | 40 |
| PurchasesBatch | 24 | 01003 | Bentonite | 0001 | 10,000 | 13 |
| PurchasesBatch | 25 | 01015 | DCP (Calcium) | 0001 | 5,000 | 17 |
| PurchasesBatch | 26 | 01033 | Molasses | 0001 | 1,500 | 50 |
| PurchasesBatch | 26 | 01007 | CSL | 0001 | 1,500 | 35 |
| PurchasesBatch | 27 | 02216 | Label E.C Gold Oral Liquid 5 Litter | 0001 | 72 | 40 |
| PurchasesBatch | 27 | 02332 | Label Task 1 Oral Liquid  5 Liter | 0001 | 60 | 80 |
| PurchasesBatch | 27 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 30 | 80 |
| PurchasesBatch | 27 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 50 | 80 |
| PurchasesBatch | 27 | 02336 | Label TopVit Oral Liquid  5 Liter | 0001 | 50 | 80 |
| PurchasesBatch | 27 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 140 | 80 |
| PurchasesBatch | 28 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 50 | 203 |
| PurchasesBatch | 29 | 01047 | Sodium Sulphate | 0001 | 100 | 80 |
| PurchasesBatch | 29 | 01044 | Sodium Bicarbonate | 0001 | 50 | 132 |
| Productions | 40 | 03075 | E.C Gold Oral  Liquid | 0001 | 240 | 44.17 |
| PRODUCTIONBATCH | 40 | 01023 | Garlic Oil | 0001 | 0 | 5,500 |
| PRODUCTIONBATCH | 40 | 01025 | Ginger Oil | 000 | 0 | 4,500 |
| PRODUCTIONBATCH | 40 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 40 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 2,900 |
| PRODUCTIONBATCH | 40 | 01058 | Xanthan Gum | 0001 | 0 | 1,600 |
| PACKING | 41 | 00194 | E.C Gold Oral Liquid  5 Liter | 0001 | 48 | 714.1 |
| PACKINGBATCH | 41 | 02014 | Plastic Can White 5 Liter | 0001 | 50 | 390 |
| PACKINGBATCH | 41 | 02216 | Label E.C Gold Oral Liquid 5 Litter | 0001 | 72 | 40 |
| PACKINGBATCH | 41 | 03075 | E.C Gold Oral  Liquid | 0001 | 240 | 44.17 |
| PACKINGBATCH | 41 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 216 |
| PurchasesBatch | 30 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 25 | 1,550 |
| PurchasesBatch | 30 | 01050 | Tartrazine Yellow Color Indian | 0001 | 25 | 3,100 |
| PurchasesBatch | 30 | 01201 | I.P.A | 0001 | 30 | 750 |
| PurchasesBatch | 30 | 01017 | Camphor | 0001 | 10 | 3,400 |
| PurchasesBatch | 30 | 01054 | Vitamin B2 | 0001 | 1 | 17,500 |
| PurchasesBatch | 30 | 01021 | Glacial Acetic Acid | 0001 | 30 | 400 |
| PurchasesBatch | 30 | 01038 | Phosphoric Acid 85% | 0001 | 35 | 650 |
| PurchasesBatch | 30 | 01058 | Xanthan Gum | 0001 | 25 | 1,450 |
| PurchasesBatch | 31 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 118 | 235 |
| PurchasesBatch | 32 | 02097 | Bottle Round liter | 0001 | 240 | 185 |
| PurchasesBatch | 33 | 01019 | Eucluptus Oil | 0001 | 5 | 5,000 |
| PurchasesBatch | 33 | 01075 | Peppermint Oil | 0001 | 5 | 6,200 |
| Productions | 41 | 03001 | Growth Promoter BOP Oral | 0001 | 5,000 | 17.35 |
| PRODUCTIONBATCH | 41 | 01016 | DCP (Dana) | 0001 | 4,000 | 10 |
| PRODUCTIONBATCH | 41 | 01042 | Starch | 0001 | 60 | 170.33 |
| PRODUCTIONBATCH | 41 | 01043 | Sodium Chloride | 0001 | 1,000 | 13.75 |
| PRODUCTIONBATCH | 41 | 01050 | Tartrazine Yellow Color Indian | 0001 | 7 | 3,036.1 |
| PACKING | 42 | 00016 | Growth Promoter 25kg | 0001 | 200 | 596.45 |
| PACKINGBATCH | 42 | 02032 | BAG Growth Promoter 25 KG | 0001 | 210 | 155 |
| PACKINGBATCH | 42 | 03001 | Growth Promoter BOP Oral | 0001 | 5,000 | 17.35 |
| Productions | 42 | 03163 | Calcium 72 | 0001 | 2,500 | 17.68 |
| PRODUCTIONBATCH | 42 | 01015 | DCP (Calcium) | 0001 | 2,600 | 17 |
| PACKING | 43 | 00231 | Calcium 72 25kg | 0001 | 100 | 522 |
| PACKINGBATCH | 43 | 02274 | Bag Calcium 72  25kg | 0001 | 100 | 80 |
| PACKINGBATCH | 43 | 03163 | Calcium 72 | 0001 | 2,500 | 17.68 |
| Productions | 43 | 03151 | Microgold-Bop | 0001 | 1,225 | 52.29 |
| PRODUCTIONBATCH | 43 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 43 | 01013 | Calcium Chloride | 0001 | 0 | 160 |
| PRODUCTIONBATCH | 43 | 01016 | DCP (Dana) | 0001 | 1,000 | 10 |
| PRODUCTIONBATCH | 43 | 01034 | Magnesium Sulphate | 0001 | 1 | 380 |
| PRODUCTIONBATCH | 43 | 01042 | Starch | 0001 | 2 | 170.33 |
| PRODUCTIONBATCH | 43 | 01043 | Sodium Chloride | 0001 | 245 | 13.75 |
| PRODUCTIONBATCH | 43 | 01050 | Tartrazine Yellow Color Indian | 0001 | 2 | 3,036.1 |
| PRODUCTIONBATCH | 43 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 43 | 01054 | Vitamin B2 | 0001 | 0 | 17,258.39 |
| PRODUCTIONBATCH | 43 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 43 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 43 | 01060 | Zinc Sulphate | 0001 | 2 | 950 |
| PRODUCTIONBATCH | 43 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 43 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| PRODUCTIONBATCH | 43 | 01143 | Vitamin B3 | 0001 | 3 | 3,200 |
| Productions | 43 | 03151 | Microgold-Bop | 0001 | 1,225 | 52.29 |
| PACKING | 44 | 00212 | Microgold-Bop 25 kg | 0001 | 49 | 1,462.34 |
| PACKINGBATCH | 44 | 02307 | Bag Bop Blue Colour | 0001 | 49 | 155 |
| PACKINGBATCH | 44 | 03151 | Microgold-Bop | 0001 | 1,225 | 52.29 |
| PACKING | 44 | 00212 | Microgold-Bop 25 kg | 0001 | 49 | 1,462.34 |
| Productions | 44 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,250 | 16.73 |
| PRODUCTIONBATCH | 44 | 01003 | Bentonite | 0001 | 12 | 13.46 |
| PRODUCTIONBATCH | 44 | 01016 | DCP (Dana) | 0001 | 1,250 | 10 |
| PRODUCTIONBATCH | 44 | 01044 | Sodium Bicarbonate | 0001 | 62 | 132 |
| PACKING | 45 | 00220 | Rumicid powder 25kg | 0001 | 50 | 618.37 |
| PACKINGBATCH | 45 | 02258 | Label Rumicid 25kg | 0001 | 50 | 45 |
| PACKINGBATCH | 45 | 02307 | Bag Bop Blue Colour | 0001 | 50 | 155 |
| PACKINGBATCH | 45 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,250 | 16.73 |
| PACKING | 45 | 00220 | Rumicid powder 25kg | 0001 | 50 | 618.37 |
| Productions | 45 | 03264 | Febro Meon Spray | 0001 | 161 | 439.76 |
| PRODUCTIONBATCH | 45 | 01019 | Eucluptus Oil | 0001 | 0 | 5,000 |
| PRODUCTIONBATCH | 45 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 45 | 01065 | Spt Amm. Aromatic | 0001 | 180 | 265 |
| PRODUCTIONBATCH | 45 | 01075 | Peppermint Oil | 0001 | 0 | 6,160.71 |
| PRODUCTIONBATCH | 45 | 01189 | Glycerine | 0001 | 15 | 807.8 |
| Productions | 45 | 03264 | Febro Meon Spray | 0001 | 161 | 439.76 |
| OpeningBatch | 109 | 02433 | Tin Febro Meon Spray | 0001 | 10,000 | 250 |
| PACKING | 46 | 00369 | Febro Meon Spray 120 ML | 0001 | 1,344 | 302.68 |
| PACKINGBATCH | 46 | 02433 | Tin Febro Meon Spray | 0001 | 1,344 | 250 |
| PACKINGBATCH | 46 | 03264 | Febro Meon Spray | 0001 | 161 | 439.76 |
| Productions | 46 | 03003 | Calci-Phos-D | 0001 | 380 | 33.29 |
| PRODUCTIONBATCH | 46 | 01013 | Calcium Chloride | 0001 | 5 | 160 |
| PRODUCTIONBATCH | 46 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 46 | 01038 | Phosphoric Acid 85% | 0001 | 5 | 650 |
| PRODUCTIONBATCH | 46 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 46 | 01048 | Titanium Dioxide (T.T) | 0001 | 1 | 1,500 |
| PRODUCTIONBATCH | 46 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 46 | 01058 | Xanthan Gum | 0001 | 1 | 1,491.51 |
| PRODUCTIONBATCH | 46 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 46 | 03003 | Calci-Phos-D | 0001 | 380 | 33.29 |
| PACKING | 47 | 00032 | Calci-Phos-D 1000ml | 0001 | 180 | 256.25 |
| PACKINGBATCH | 47 | 02097 | Bottle Round liter | 0001 | 180 | 202.4 |
| PACKINGBATCH | 47 | 03003 | Calci-Phos-D | 0001 | 180 | 33.29 |
| PACKINGBATCH | 47 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 20 | 185 |
| PACKING | 47 | 00032 | Calci-Phos-D 1000ml | 0001 | 180 | 256.24 |
| PACKING | 48 | 00010 | Calci-Phos-D100ML | 0001 | 2,000 | 27.31 |
| PACKINGBATCH | 48 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 2,050 | 12 |
| PACKINGBATCH | 48 | 03003 | Calci-Phos-D | 0001 | 200 | 33.29 |
| PACKINGBATCH | 48 | 02010 | Bottle Pet Amber 100ML | 0001 | 2,100 | 9.12 |
| PACKINGBATCH | 48 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 21 | 199.99 |
| PACKING | 48 | 00010 | Calci-Phos-D100ML | 0001 | 2,000 | 27.31 |
| Productions | 47 | 03010 | Garlimint Plus BOP | 0001 | 80 | 125.59 |
| PRODUCTIONBATCH | 47 | 01023 | Garlic Oil | 0001 | 0 | 5,500 |
| PRODUCTIONBATCH | 47 | 01025 | Ginger Oil | 000 | 0 | 4,500 |
| PRODUCTIONBATCH | 47 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 47 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 47 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 47 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 47 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 47 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| Productions | 47 | 03010 | Garlimint Plus BOP | 0001 | 80 | 125.59 |
| PACKING | 49 | 00259 | Garliment-Plus BOP  30ML | 0001 | 2,400 | 24.25 |
| PACKINGBATCH | 49 | 02314 | Dropper  30ML | 0001 | 2,420 | 12.5 |
| PACKINGBATCH | 49 | 02316 | S+D Garliment Plus 30ML | 0001 | 2,450 | 6 |
| PACKINGBATCH | 49 | 03010 | Garlimint Plus BOP | 0001 | 80 | 125.59 |
| PACKINGBATCH | 49 | 02317 | Shipper [M] 30ML Bottle | 0001 | 20 | 160 |
| OpeningBatch | 109 | 02433 | Tin Febro Meon Spray | 0001 | 1,344 | 150 |
| Productions | 48 | 03118 | BOP Coolper Powder | 0001 | 75 | 144.31 |
| PRODUCTIONBATCH | 48 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 48 | 01047 | Sodium Sulphate | 0001 | 75 | 80 |
| PRODUCTIONBATCH | 48 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,534.15 |
| PRODUCTIONBATCH | 48 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| PRODUCTIONBATCH | 48 | 01105 | Sodium Citrate | 0001 | 0 | 290 |
| Productions | 48 | 03118 | BOP Coolper Powder | 0001 | 75 | 144.31 |
| PACKING | 50 | 00030 | Coolper 100gm | 0001 | 750 | 33.4 |
| PACKINGBATCH | 50 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 750 | 17 |
| PACKINGBATCH | 50 | 03118 | BOP Coolper Powder | 0001 | 75 | 144.31 |
| PACKINGBATCH | 50 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 8 | 185 |
| PACKING | 50 | 00030 | Coolper 100gm | 0001 | 750 | 33.4 |
| Productions | 49 | 03179 | Heaatic Optimizer Liquid | 0001 | 100 | 49.31 |
| PRODUCTIONBATCH | 49 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 49 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 49 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 49 | 01038 | Phosphoric Acid 85% | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 49 | 01041 | Sodium Benzoate | 0001 | 4 | 620 |
| PRODUCTIONBATCH | 49 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 49 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 49 | 03179 | Heaatic Optimizer Liquid | 0001 | 100 | 49.31 |
| PACKING | 51 | 00257 | Heaatic-Optimizer 100ML | 0001 | 1,000 | 28.78 |
| PACKINGBATCH | 51 | 02010 | Bottle Pet Amber 100ML | 0001 | 1,050 | 9.12 |
| PACKINGBATCH | 51 | 02313 | S+D Heaatic-Optimizer 100ML | 0001 | 1,050 | 11.5 |
| PACKINGBATCH | 51 | 03179 | Heaatic Optimizer Liquid | 0001 | 100 | 49.31 |
| PACKINGBATCH | 51 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 11 | 199.99 |
| Productions | 50 | 03018 | Scour Guard | 0001 | 108 | 103.77 |
| PRODUCTIONBATCH | 50 | 01027 | Kaolin | 0001 | 20 | 382.05 |
| PRODUCTIONBATCH | 50 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 50 | 01043 | Sodium Chloride | 0001 | 9 | 13.75 |
| PRODUCTIONBATCH | 50 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 50 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 50 | 01073 | Potassium Chloride | 0001 | 4 | 520 |
| Productions | 50 | 03018 | Scour Guard | 0001 | 108 | 103.77 |
| PACKING | 52 | 00008 | Scour Guard100ML | 0001 | 1,077 | 34.21 |
| PACKINGBATCH | 52 | 02020 | S+D Scour Guard100 ML | 0001 | 1,100 | 12 |
| PACKINGBATCH | 52 | 03018 | Scour Guard | 0001 | 108 | 103.77 |
| PACKINGBATCH | 52 | 02010 | Bottle Pet Amber 100ML | 0001 | 1,100 | 9.12 |
| PACKINGBATCH | 52 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 12 | 199.99 |
| Productions | 51 | 03165 | Timp-Ex Oral Liquid | 0001 | 200 | 11.81 |
| PRODUCTIONBATCH | 51 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 51 | 01021 | Glacial Acetic Acid | 0001 | 2 | 399.41 |
| PRODUCTIONBATCH | 51 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 51 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 51 | 01044 | Sodium Bicarbonate | 0001 | 3 | 132 |
| PRODUCTIONBATCH | 51 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| Productions | 51 | 03165 | Timp-Ex Oral Liquid | 0001 | 200 | 11.81 |
| PACKING | 53 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 2,000 | 25.36 |
| PACKINGBATCH | 53 | 02010 | Bottle Pet Amber 100ML | 0001 | 2,100 | 9.12 |
| PACKINGBATCH | 53 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 2,100 | 12 |
| PACKINGBATCH | 53 | 03165 | Timp-Ex Oral Liquid | 0001 | 200 | 11.81 |
| PACKINGBATCH | 53 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 20 | 199.99 |
| Productions | 52 | 03012 | Kirzan BOP | 0001 | 38 | 116.77 |
| PRODUCTIONBATCH | 52 | 01027 | Kaolin | 0001 | 5 | 382.05 |
| PRODUCTIONBATCH | 52 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 52 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 52 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 52 | 01117 | Magnesium Oxide | 0001 | 1 | 420 |
| PRODUCTIONBATCH | 52 | 01193 | Castor Oil | 0001 | 2 | 700 |
| Productions | 52 | 03012 | Kirzan BOP | 0001 | 38 | 116.77 |
| PACKING | 54 | 00013 | Kirzan BOP 100ml | 0001 | 381 | 26.19 |
| PACKINGBATCH | 54 | 02019 | S+D Kirzan 100 ML | 0001 | 400 | 11.5 |
| PACKINGBATCH | 54 | 03012 | Kirzan BOP | 0001 | 38 | 116.77 |
| PACKINGBATCH | 54 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 235 |
| Productions | 53 | 03191 | Task 1 Oral Liquid | 0001 | 200 | 73 |
| PRODUCTIONBATCH | 53 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 53 | 01010 | Betaine | 0001 | 2 | 2,800 |
| PRODUCTIONBATCH | 53 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 53 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 53 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.41 |
| PRODUCTIONBATCH | 53 | 01028 | Lactic Acid | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 53 | 01041 | Sodium Benzoate | 0001 | 1 | 620 |
| PRODUCTIONBATCH | 53 | 01045 | Sorbitol Liquid 70% | 0001 | 4 | 421.7 |
| PRODUCTIONBATCH | 53 | 01058 | Xanthan Gum | 0001 | 1 | 1,491.51 |
| PRODUCTIONBATCH | 53 | 01105 | Sodium Citrate | 0001 | 0 | 290 |
| PRODUCTIONBATCH | 53 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| Productions | 53 | 03191 | Task 1 Oral Liquid | 0001 | 200 | 73 |
| PACKING | 55 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 40 | 933.77 |
| PACKINGBATCH | 55 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 390 |
| PACKINGBATCH | 55 | 02332 | Label Task 1 Oral Liquid  5 Liter | 0001 | 60 | 80 |
| PACKINGBATCH | 55 | 03191 | Task 1 Oral Liquid | 0001 | 200 | 73 |
| PACKINGBATCH | 55 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 235 |
| PACKING | 55 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 40 | 933.77 |
| Productions | 54 | 03192 | Immunit Z Oral Liquid | 0001 | 100 | 168.25 |
| PRODUCTIONBATCH | 54 | 01023 | Garlic Oil | 0001 | 1 | 5,500 |
| PRODUCTIONBATCH | 54 | 01025 | Ginger Oil | 000 | 1 | 4,500 |
| PRODUCTIONBATCH | 54 | 01036 | Propylene Glycol (PG) | 0001 | 5 | 750 |
| PRODUCTIONBATCH | 54 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 54 | 01045 | Sorbitol Liquid 70% | 0001 | 5 | 421.7 |
| PRODUCTIONBATCH | 54 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 54 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| Productions | 54 | 03192 | Immunit Z Oral Liquid | 0001 | 100 | 168.25 |
| PACKING | 56 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 20 | 1,409.98 |
| PACKINGBATCH | 56 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 390 |
| PACKINGBATCH | 56 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 30 | 80 |
| PACKINGBATCH | 56 | 03192 | Immunit Z Oral Liquid | 0001 | 100 | 168.25 |
| PACKINGBATCH | 56 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 235 |
| PACKING | 56 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 20 | 1,409.98 |
| OpeningBatch | 70 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 220 | 208 |
| Productions | 55 | 03194 | MLC 100  Oral Liquid | 0001 | 160 | 93.75 |
| PRODUCTIONBATCH | 55 | 01009 | Copper Sulphate | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 55 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 55 | 01020 | Formic Acid | 0001 | 5 | 350 |
| PRODUCTIONBATCH | 55 | 01021 | Glacial Acetic Acid | 0001 | 2 | 399.41 |
| PRODUCTIONBATCH | 55 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 55 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 55 | 01045 | Sorbitol Liquid 70% | 0001 | 3 | 421.7 |
| PRODUCTIONBATCH | 55 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 55 | 01105 | Sodium Citrate | 0001 | 0 | 290 |
| PRODUCTIONBATCH | 55 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| Productions | 55 | 03194 | MLC 100  Oral Liquid | 0001 | 160 | 93.75 |
| PACKING | 57 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 32 | 1,081.23 |
| PACKINGBATCH | 57 | 02014 | Plastic Can White 5 Liter | 0001 | 35 | 390 |
| PACKINGBATCH | 57 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 50 | 80 |
| PACKINGBATCH | 57 | 03194 | MLC 100  Oral Liquid | 0001 | 160 | 93.75 |
| PACKINGBATCH | 57 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 9 | 216.61 |
| PACKING | 57 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 32 | 1,081.23 |
| Productions | 56 | 03193 | TopVit Oral Liquid | 0001 | 160 | 247.91 |
| PRODUCTIONBATCH | 56 | 01007 | CSL | 0001 | 0 | 35 |
| PRODUCTIONBATCH | 56 | 01009 | Copper Sulphate | 0001 | 3 | 1,650 |
| PRODUCTIONBATCH | 56 | 01036 | Propylene Glycol (PG) | 0001 | 4 | 750 |
| PRODUCTIONBATCH | 56 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 56 | 01045 | Sorbitol Liquid 70% | 0001 | 22 | 421.7 |
| PRODUCTIONBATCH | 56 | 01054 | Vitamin B2 | 0001 | 0 | 17,258.39 |
| PRODUCTIONBATCH | 56 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,534.15 |
| PRODUCTIONBATCH | 56 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 56 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 56 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 56 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 56 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 56 | 03193 | TopVit Oral Liquid | 0001 | 160 | 247.92 |
| PACKING | 58 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 32 | 1,845.29 |
| PACKINGBATCH | 58 | 02014 | Plastic Can White 5 Liter | 0001 | 35 | 390 |
| PACKINGBATCH | 58 | 02336 | Label TopVit Oral Liquid  5 Liter | 0001 | 50 | 80 |
| PACKINGBATCH | 58 | 03193 | TopVit Oral Liquid | 0001 | 160 | 247.92 |
| PACKINGBATCH | 58 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 216.61 |
| PACKING | 58 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 32 | 1,845.29 |
| Productions | 57 | 03190 | CRD Mint Oral Liquid | 0001 | 500 | 410.24 |
| PRODUCTIONBATCH | 57 | 01019 | Eucluptus Oil | 0001 | 4 | 5,000 |
| PRODUCTIONBATCH | 57 | 01031 | Menthol Crystal | 0001 | 5 | 6,500 |
| PRODUCTIONBATCH | 57 | 01036 | Propylene Glycol (PG) | 0001 | 50 | 750 |
| PRODUCTIONBATCH | 57 | 01041 | Sodium Benzoate | 0001 | 2 | 620 |
| PRODUCTIONBATCH | 57 | 01058 | Xanthan Gum | 0001 | 1 | 1,491.51 |
| PRODUCTIONBATCH | 57 | 01075 | Peppermint Oil | 0001 | 4 | 6,160.71 |
| PRODUCTIONBATCH | 57 | 01189 | Glycerine | 0001 | 50 | 807.8 |
| PRODUCTIONBATCH | 57 | 01201 | I.P.A | 0001 | 60 | 704.96 |
| PACKING | 59 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 100 | 2,626.86 |
| PACKINGBATCH | 59 | 02014 | Plastic Can White 5 Liter | 0001 | 105 | 390 |
| PACKINGBATCH | 59 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 140 | 80 |
| PACKINGBATCH | 59 | 03190 | CRD Mint Oral Liquid | 0001 | 500 | 410.24 |
| PACKINGBATCH | 59 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 216.61 |
| PACKING | 59 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 100 | 2,626.86 |
| Productions | 58 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.46 |
| PRODUCTIONBATCH | 58 | 01003 | Bentonite | 0001 | 250 | 13.46 |
| Productions | 58 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.46 |
| PACKING | 60 | 00022 | Magnet BOP 25kg | 0001 | 10 | 491.53 |
| PACKINGBATCH | 60 | 02033 | BAG Magnet 25 KG | 0001 | 10 | 155 |
| PACKINGBATCH | 60 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.46 |
| PACKING | 60 | 00022 | Magnet BOP 25kg | 0001 | 10 | 491.53 |
| PurchasesBatch | 34 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 40 | 40 |
| PurchasesBatch | 34 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 40 | 40 |
| PurchasesBatch | 34 | 02384 | Label LivGuard Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PurchasesBatch | 35 | 01044 | Sodium Bicarbonate | 0001 | 25 | 128 |
| PurchasesBatch | 35 | 01184 | ARQ | 0001 | 90 | 366.67 |
| PurchasesBatch | 35 | 01070 | Anise Oil | 0001 | 1 | 2,270 |
| PurchasesBatch | 36 | 01028 | Lactic Acid | 0001 | 30 | 1,650 |
| PurchasesBatch | 36 | 01011 | Choline Chloride | 0001 | 1 | 4,850 |
| PurchasesBatch | 36 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 25 | 1,550 |
| PurchasesBatch | 37 | 02014 | Plastic Can White 5 Liter | 0001 | 731 | 390 |
| Productions | 59 | 03010 | Garlimint Plus BOP | 0001 | 120 | 125.59 |
| PRODUCTIONBATCH | 59 | 01023 | Garlic Oil | 0001 | 1 | 5,500 |
| PRODUCTIONBATCH | 59 | 01025 | Ginger Oil | 000 | 1 | 4,500 |
| PRODUCTIONBATCH | 59 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 59 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 59 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 59 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 59 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 59 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| Productions | 59 | 03010 | Garlimint Plus BOP | 0001 | 120 | 125.59 |
| PACKING | 61 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 24 | 1,138.75 |
| PACKINGBATCH | 61 | 02014 | Plastic Can White 5 Liter | 0001 | 24 | 390 |
| PACKINGBATCH | 61 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 40 | 40 |
| PACKINGBATCH | 61 | 03010 | Garlimint Plus BOP | 0001 | 120 | 125.59 |
| PACKINGBATCH | 61 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 216.61 |
| PACKING | 61 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 24 | 1,138.75 |
| Productions | 60 | 03028 | O-D Plus Oral Liquid | 0001 | 24 | 390.28 |
| PRODUCTIONBATCH | 60 | 01017 | Camphor | 0001 | 0 | 3,309.29 |
| PRODUCTIONBATCH | 60 | 01019 | Eucluptus Oil | 0001 | 0 | 5,000 |
| PRODUCTIONBATCH | 60 | 01031 | Menthol Crystal | 0001 | 0 | 6,500 |
| PRODUCTIONBATCH | 60 | 01036 | Propylene Glycol (PG) | 0001 | 1 | 750 |
| PRODUCTIONBATCH | 60 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 60 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 60 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 60 | 01070 | Anise Oil | 0001 | 1 | 2,270 |
| PRODUCTIONBATCH | 60 | 01189 | Glycerine | 0001 | 1 | 807.8 |
| Productions | 60 | 03028 | O-D Plus Oral Liquid | 0001 | 24 | 390.28 |
| PACKING | 62 | 00226 | O-D Plus Liquid 1lit | 0001 | 24 | 608.1 |
| PACKINGBATCH | 62 | 02097 | Bottle Round liter | 0001 | 24 | 202.4 |
| PACKINGBATCH | 62 | 03028 | O-D Plus Oral Liquid | 0001 | 24 | 390.28 |
| PACKINGBATCH | 62 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 185 |
| PACKING | 62 | 00226 | O-D Plus Liquid 1lit | 0001 | 24 | 608.1 |
| Productions | 61 | 03183 | Pro-Tox Liquid | 0001 | 80 | 67.27 |
| PRODUCTIONBATCH | 61 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 61 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 61 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.41 |
| PRODUCTIONBATCH | 61 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 61 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 61 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 61 | 01105 | Sodium Citrate | 0001 | 0 | 290 |
| PRODUCTIONBATCH | 61 | 01184 | ARQ | 0001 | 4 | 366.68 |
| Productions | 61 | 03183 | Pro-Tox Liquid | 0001 | 80 | 67.27 |
| PACKING | 63 | 00260 | Pro-Tox Liquid 5L | 0001 | 16 | 894.02 |
| PACKINGBATCH | 63 | 02014 | Plastic Can White 5 Liter | 0001 | 16 | 390 |
| PACKINGBATCH | 63 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 40 | 40 |
| PACKINGBATCH | 63 | 03183 | Pro-Tox Liquid | 0001 | 80 | 67.27 |
| PACKINGBATCH | 63 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 216.61 |
| PACKING | 63 | 00260 | Pro-Tox Liquid 5L | 0001 | 16 | 894.02 |
| Productions | 62 | 03236 | LivGuard Oral Liquid | 0001 | 160 | 93.78 |
| PRODUCTIONBATCH | 62 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 62 | 01011 | Choline Chloride | 0001 | 0 | 4,456.99 |
| PRODUCTIONBATCH | 62 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 62 | 01013 | Calcium Chloride | 0001 | 0 | 160 |
| PRODUCTIONBATCH | 62 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 62 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 62 | 01036 | Propylene Glycol (PG) | 0001 | 1 | 750 |
| PRODUCTIONBATCH | 62 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 62 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 62 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 62 | 01184 | ARQ | 0001 | 16 | 366.68 |
| Productions | 62 | 03236 | LivGuard Oral Liquid | 0001 | 160 | 93.78 |
| PACKING | 64 | 00330 | LivGuard Oral Liquid 5 Lit | 0001 | 32 | 993.03 |
| PACKINGBATCH | 64 | 02014 | Plastic Can White 5 Liter | 0001 | 32 | 390 |
| PACKINGBATCH | 64 | 02384 | Label LivGuard Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PACKINGBATCH | 64 | 03236 | LivGuard Oral Liquid | 0001 | 160 | 93.78 |
| PACKINGBATCH | 64 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 216.61 |
| PACKING | 64 | 00330 | LivGuard Oral Liquid 5 Lit | 0001 | 32 | 993.03 |
| Productions | 63 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,000 | 16.66 |
| PRODUCTIONBATCH | 63 | 01003 | Bentonite | 0001 | 10 | 13.46 |
| PRODUCTIONBATCH | 63 | 01016 | DCP (Dana) | 0001 | 1,000 | 10 |
| PRODUCTIONBATCH | 63 | 01044 | Sodium Bicarbonate | 0001 | 50 | 130.54 |
| PACKING | 65 | 00220 | Rumicid powder 25kg | 0001 | 40 | 616.54 |
| PACKINGBATCH | 65 | 02258 | Label Rumicid 25kg | 0001 | 40 | 45 |
| PACKINGBATCH | 65 | 02307 | Bag Bop Blue Colour | 0001 | 40 | 155 |
| PACKINGBATCH | 65 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,000 | 16.66 |
| Productions | 64 | 03014 | Magnet BOP Oral Powder | 0001 | 500 | 13.46 |
| PRODUCTIONBATCH | 64 | 01003 | Bentonite | 0001 | 500 | 13.46 |
| PACKING | 66 | 00022 | Magnet BOP 25kg | 0001 | 20 | 491.53 |
| PACKINGBATCH | 66 | 02033 | BAG Magnet 25 KG | 0001 | 20 | 155 |
| PACKINGBATCH | 66 | 03014 | Magnet BOP Oral Powder | 0001 | 500 | 13.46 |
| Productions | 65 | 03021 | Vital Gold | 0001 | 2,500 | 66.04 |
| PRODUCTIONBATCH | 65 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 65 | 01013 | Calcium Chloride | 0001 | 0 | 160 |
| PRODUCTIONBATCH | 65 | 01016 | DCP (Dana) | 0001 | 2,000 | 10 |
| PRODUCTIONBATCH | 65 | 01034 | Magnesium Sulphate | 0001 | 2 | 380 |
| PRODUCTIONBATCH | 65 | 01043 | Sodium Chloride | 0001 | 500 | 13.75 |
| PRODUCTIONBATCH | 65 | 01050 | Tartrazine Yellow Color Indian | 0001 | 3 | 3,036.1 |
| PRODUCTIONBATCH | 65 | 01052 | Vitamin A | 0001 | 1 | 14,500 |
| PRODUCTIONBATCH | 65 | 01056 | Vitamin D3 | 0001 | 1 | 16,500 |
| PRODUCTIONBATCH | 65 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 65 | 01060 | Zinc Sulphate | 0001 | 10 | 950 |
| PRODUCTIONBATCH | 65 | 01072 | Vitamin E | 0001 | 1 | 9,500 |
| PRODUCTIONBATCH | 65 | 01073 | Potassium Chloride | 0001 | 2 | 520 |
| PRODUCTIONBATCH | 65 | 01143 | Vitamin B3 | 0001 | 20 | 3,200 |
| PACKING | 67 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,651.02 |
| PACKINGBATCH | 67 | 03021 | Vital Gold | 0001 | 2,500 | 66.04 |
| PACKING | 67 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,651.02 |
| Productions | 66 | 03224 | IG Max Oral Liquid | 0001 | 240 | 64.3 |
| PRODUCTIONBATCH | 66 | 01023 | Garlic Oil | 0001 | 1 | 5,500 |
| PRODUCTIONBATCH | 66 | 01025 | Ginger Oil | 000 | 1 | 4,500 |
| PRODUCTIONBATCH | 66 | 01036 | Propylene Glycol (PG) | 0001 | 1 | 750 |
| PRODUCTIONBATCH | 66 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 66 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 66 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PACKING | 68 | 00318 | IG Max Oral Liquid 1 Liter | 0001 | 240 | 266.7 |
| PACKINGBATCH | 68 | 02097 | Bottle Round liter | 0001 | 240 | 202.4 |
| PACKINGBATCH | 68 | 03224 | IG Max Oral Liquid | 0001 | 240 | 64.3 |
| PACKING | 68 | 00318 | IG Max Oral Liquid 1 Liter | 0001 | 240 | 266.7 |
| Productions | 67 | 03182 | GrowMore Powder | 0001 | 960 | 17.76 |
| PRODUCTIONBATCH | 67 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 67 | 01013 | Calcium Chloride | 0001 | 0 | 160 |
| PRODUCTIONBATCH | 67 | 01016 | DCP (Dana) | 0001 | 768 | 10 |
| PRODUCTIONBATCH | 67 | 01043 | Sodium Chloride | 0001 | 192 | 13.75 |
| PRODUCTIONBATCH | 67 | 01050 | Tartrazine Yellow Color Indian | 0001 | 1 | 3,036.1 |
| PRODUCTIONBATCH | 67 | 01143 | Vitamin B3 | 0001 | 1 | 3,200 |
| PACKING | 69 | 00265 | GrowMore 1Kg | 0001 | 960 | 59.16 |
| PACKINGBATCH | 69 | 02315 | Packet GrowMore 1KG | 0001 | 1,000 | 30 |
| PACKINGBATCH | 69 | 03182 | GrowMore Powder | 0001 | 960 | 17.76 |
| PACKINGBATCH | 69 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 45 | 216.61 |
| Productions | 68 | 03018 | Scour Guard | 0001 | 40 | 90.33 |
| PRODUCTIONBATCH | 68 | 01027 | Kaolin | 0001 | 6 | 382.05 |
| PRODUCTIONBATCH | 68 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 68 | 01043 | Sodium Chloride | 0001 | 3 | 13.75 |
| PRODUCTIONBATCH | 68 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 68 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 68 | 01073 | Potassium Chloride | 0001 | 1 | 520 |
| Productions | 68 | 03018 | Scour Guard | 0001 | 40 | 90.33 |
| PACKING | 70 | 00008 | Scour Guard100ML | 0001 | 400 | 34.8 |
| PACKINGBATCH | 70 | 02020 | S+D Scour Guard100 ML | 0001 | 450 | 12 |
| PACKINGBATCH | 70 | 03018 | Scour Guard | 0001 | 40 | 90.33 |
| PACKINGBATCH | 70 | 02010 | Bottle Pet Amber 100ML | 0001 | 450 | 9.12 |
| PACKINGBATCH | 70 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 4 | 199.99 |
| PACKING | 70 | 00008 | Scour Guard100ML | 0001 | 400 | 34.8 |
| PurchasesBatch | 38 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 250 | 350 |
| PurchasesBatch | 39 | 02346 | Label VETLIV Oral Solution 5 Lit | 0001 | 112 | 40 |
| PurchasesBatch | 39 | 02265 | Label Garliment Plus 1Liter | 0001 | 32 | 40 |
| PurchasesBatch | 39 | 02434 | Label ElectroMune C Oral Liquid 1 Lit | 0001 | 135 | 40 |
| PurchasesBatch | 40 | 01042 | Starch | 0001 | 50 | 167 |
| Productions | 69 | 03202 | VETLIV Oral Solution | 0001 | 400 | 104.77 |
| PRODUCTIONBATCH | 69 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 69 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 69 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 69 | 01020 | Formic Acid | 0001 | 5 | 350 |
| PRODUCTIONBATCH | 69 | 01021 | Glacial Acetic Acid | 0001 | 1 | 399.41 |
| PRODUCTIONBATCH | 69 | 01028 | Lactic Acid | 0001 | 4 | 1,650 |
| PRODUCTIONBATCH | 69 | 01041 | Sodium Benzoate | 0001 | 2 | 620 |
| PRODUCTIONBATCH | 69 | 01045 | Sorbitol Liquid 70% | 0001 | 8 | 421.7 |
| PRODUCTIONBATCH | 69 | 01058 | Xanthan Gum | 0001 | 1 | 1,491.51 |
| PRODUCTIONBATCH | 69 | 01105 | Sodium Citrate | 0001 | 0 | 290 |
| PRODUCTIONBATCH | 69 | 01184 | ARQ | 0001 | 40 | 366.68 |
| PACKING | 71 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 80 | 1,029.42 |
| PACKINGBATCH | 71 | 02014 | Plastic Can White 5 Liter | 0001 | 80 | 390 |
| PACKINGBATCH | 71 | 02346 | Label VETLIV Oral Solution 5 Lit | 0001 | 112 | 40 |
| PACKINGBATCH | 71 | 03202 | VETLIV Oral Solution | 0001 | 400 | 104.77 |
| PACKINGBATCH | 71 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 22 | 216.61 |
| PACKING | 71 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 80 | 1,029.42 |
| Productions | 70 | 03247 | Electro Mune C Oral Liquid | 0001 | 120 | 104.04 |
| PRODUCTIONBATCH | 70 | 01004 | Citric Acid | 0001 | 1 | 400 |
| PRODUCTIONBATCH | 70 | 01036 | Propylene Glycol (PG) | 0001 | 1 | 750 |
| PRODUCTIONBATCH | 70 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 70 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 70 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 70 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 70 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 6 | 1,542.4 |
| PRODUCTIONBATCH | 70 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 70 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| Productions | 70 | 03247 | Electro Mune C Oral Liquid | 0001 | 120 | 104.04 |
| PACKING | 72 | 00370 | ElectroMune C Oral Liquid 1 Lit | 0001 | 120 | 164.04 |
| PACKINGBATCH | 72 | 02434 | Label ElectroMune C Oral Liquid 1 Lit | 0001 | 135 | 40 |
| PACKINGBATCH | 72 | 03247 | Electro Mune C Oral Liquid | 0001 | 120 | 104.04 |
| PACKINGBATCH | 72 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 10 | 180 |
| PACKING | 72 | 00370 | ElectroMune C Oral Liquid 1 Lit | 0001 | 120 | 164.04 |
| Productions | 71 | 03060 | Oripulmo Liquid | 0001 | 240 | 95.75 |
| PRODUCTIONBATCH | 71 | 01017 | Camphor | 0001 | 1 | 3,309.29 |
| PRODUCTIONBATCH | 71 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 71 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 71 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 71 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| Productions | 71 | 03060 | Oripulmo Liquid | 0001 | 240 | 95.75 |
| PACKING | 73 | 00086 | Oripulmo Liquid 1 Lit | 0001 | 240 | 428.25 |
| PACKINGBATCH | 73 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 240 | 332.5 |
| PACKINGBATCH | 73 | 03060 | Oripulmo Liquid | 0001 | 240 | 95.75 |
| PACKING | 73 | 00086 | Oripulmo Liquid 1 Lit | 0001 | 240 | 428.25 |
| OpeningBatch | 109 | 02433 | Tin Febro Meon Spray | 0001 | 2,016 | 150 |
| Productions | 72 | 03264 | Febro Meon Spray | 0001 | 80 | 470.41 |
| PRODUCTIONBATCH | 72 | 01019 | Eucluptus Oil | 0001 | 0 | 5,000 |
| PRODUCTIONBATCH | 72 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 72 | 01065 | Spt Amm. Aromatic | 0001 | 80 | 265 |
| PRODUCTIONBATCH | 72 | 01075 | Peppermint Oil | 0001 | 0 | 6,160.71 |
| PRODUCTIONBATCH | 72 | 01189 | Glycerine | 0001 | 16 | 807.8 |
| Productions | 72 | 03264 | Febro Meon Spray | 0001 | 80 | 470.41 |
| PACKING | 74 | 00369 | Febro Meon Spray 120 ML | 0001 | 672 | 206 |
| PACKINGBATCH | 74 | 02433 | Tin Febro Meon Spray | 0001 | 672 | 150 |
| PACKINGBATCH | 74 | 03264 | Febro Meon Spray | 0001 | 80 | 470.41 |
| PACKING | 74 | 00369 | Febro Meon Spray 120 ML | 0001 | 672 | 206 |
| Productions | 73 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 11.79 |
| PRODUCTIONBATCH | 73 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 73 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.41 |
| PRODUCTIONBATCH | 73 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 73 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 73 | 01044 | Sodium Bicarbonate | 0001 | 0 | 130.54 |
| PRODUCTIONBATCH | 73 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| Productions | 73 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 11.79 |
| PACKING | 75 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 24.3 |
| PACKINGBATCH | 75 | 02010 | Bottle Pet Amber 100ML | 0001 | 200 | 9.12 |
| PACKINGBATCH | 75 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 12 |
| PACKINGBATCH | 75 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 11.79 |
| PACKINGBATCH | 75 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 2 | 199.99 |
| Productions | 74 | 03010 | Garlimint Plus BOP | 0001 | 67 | 125.59 |
| PRODUCTIONBATCH | 74 | 01023 | Garlic Oil | 0001 | 0 | 5,500 |
| PRODUCTIONBATCH | 74 | 01025 | Ginger Oil | 000 | 0 | 4,500 |
| PRODUCTIONBATCH | 74 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 74 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 74 | 01041 | Sodium Benzoate | 0001 | 0 | 620 |
| PRODUCTIONBATCH | 74 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 74 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 74 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| Productions | 74 | 03010 | Garlimint Plus BOP | 0001 | 67 | 125.59 |
| PACKING | 76 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 396.74 |
| PACKINGBATCH | 76 | 02097 | Bottle Round liter | 0001 | 24 | 202.4 |
| PACKINGBATCH | 76 | 02265 | Label Garliment Plus 1Liter | 0001 | 32 | 40 |
| PACKINGBATCH | 76 | 03010 | Garlimint Plus BOP | 0001 | 24 | 125.59 |
| PACKINGBATCH | 76 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 185 |
| PACKING | 76 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 396.74 |
| PACKING | 77 | 00259 | Garliment-Plus BOP  30ML | 0001 | 1,440 | 23.96 |
| PACKINGBATCH | 77 | 02314 | Dropper  30ML | 0001 | 1,460 | 12.5 |
| PACKINGBATCH | 77 | 02316 | S+D Garliment Plus 30ML | 0001 | 1,500 | 6 |
| PACKINGBATCH | 77 | 03010 | Garlimint Plus BOP | 0001 | 43 | 125.59 |
| PACKINGBATCH | 77 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 10 | 185 |
| Productions | 75 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 13.46 |
| PRODUCTIONBATCH | 75 | 01003 | Bentonite | 0001 | 100 | 13.46 |
| Productions | 75 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 13.46 |
| PACKING | 78 | 00020 | Magnet BOP 1kg | 0001 | 100 | 54.26 |
| PACKINGBATCH | 78 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 100 | 30 |
| PACKINGBATCH | 78 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 13.46 |
| PACKINGBATCH | 78 | 02003 | Shipper [C] 15 pcs Tin (1 KG) | 0001 | 5 | 216 |
| PACKING | 78 | 00020 | Magnet BOP 1kg | 0001 | 100 | 54.26 |
| Productions | 76 | 03001 | Growth Promoter BOP Oral | 0001 | 1,250 | 14.56 |
| PRODUCTIONBATCH | 76 | 01016 | DCP (Dana) | 0001 | 1,000 | 10 |
| PRODUCTIONBATCH | 76 | 01042 | Starch | 0001 | 15 | 167.2 |
| PRODUCTIONBATCH | 76 | 01050 | Tartrazine Yellow Color Indian | 0001 | 1 | 3,036.1 |
| PACKING | 79 | 00016 | Growth Promoter 25kg | 0001 | 50 | 534.51 |
| PACKINGBATCH | 79 | 02032 | BAG Growth Promoter 25 KG | 0001 | 55 | 155 |
| PACKINGBATCH | 79 | 03001 | Growth Promoter BOP Oral | 0001 | 1,250 | 14.56 |
| PACKING | 79 | 00016 | Growth Promoter 25kg | 0001 | 50 | 534.51 |
| Productions | 77 | 03182 | GrowMore Powder | 0001 | 250 | 16.67 |
| PRODUCTIONBATCH | 77 | 01009 | Copper Sulphate | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 77 | 01013 | Calcium Chloride | 0001 | 0 | 160 |
| PRODUCTIONBATCH | 77 | 01016 | DCP (Dana) | 0001 | 200 | 10 |
| PRODUCTIONBATCH | 77 | 01042 | Starch | 0001 | 2 | 167.2 |
| PRODUCTIONBATCH | 77 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 77 | 01054 | Vitamin B2 | 0001 | 0 | 17,258.39 |
| PRODUCTIONBATCH | 77 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 77 | 03182 | GrowMore Powder | 0001 | 250 | 16.67 |
| PACKING | 80 | 00258 | GrowMore 25KG | 0001 | 10 | 416.84 |
| PACKINGBATCH | 80 | 03182 | GrowMore Powder | 0001 | 250 | 16.67 |
| PACKING | 80 | 00258 | GrowMore 25KG | 0001 | 10 | 416.84 |
| Productions | 78 | 03118 | BOP Coolper Powder | 0001 | 25 | 121.5 |
| PRODUCTIONBATCH | 78 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 78 | 01047 | Sodium Sulphate | 0001 | 25 | 80 |
| PRODUCTIONBATCH | 78 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,542.4 |
| PRODUCTIONBATCH | 78 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| PRODUCTIONBATCH | 78 | 01105 | Sodium Citrate | 0001 | 0 | 290 |
| Productions | 78 | 03118 | BOP Coolper Powder | 0001 | 25 | 121.5 |
| PACKING | 81 | 00030 | Coolper 100gm | 0001 | 250 | 31.37 |
| PACKINGBATCH | 81 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 250 | 17 |
| PACKINGBATCH | 81 | 03118 | BOP Coolper Powder | 0001 | 25 | 121.5 |
| PACKINGBATCH | 81 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 3 | 185 |
| PACKING | 81 | 00030 | Coolper 100gm | 0001 | 250 | 31.37 |
| Productions | 79 | 03003 | Calci-Phos-D | 0001 | 80 | 33.29 |
| PRODUCTIONBATCH | 79 | 01013 | Calcium Chloride | 0001 | 1 | 160 |
| PRODUCTIONBATCH | 79 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 79 | 01038 | Phosphoric Acid 85% | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 79 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 79 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 79 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 79 | 01058 | Xanthan Gum | 0001 | 0 | 1,491.51 |
| PRODUCTIONBATCH | 79 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 79 | 03003 | Calci-Phos-D | 0001 | 80 | 33.29 |
| PACKING | 82 | 00010 | Calci-Phos-D100ML | 0001 | 200 | 28.11 |
| PACKINGBATCH | 82 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 220 | 12 |
| PACKINGBATCH | 82 | 03003 | Calci-Phos-D | 0001 | 20 | 33.29 |
| PACKINGBATCH | 82 | 02010 | Bottle Pet Amber 100ML | 0001 | 210 | 9.12 |
| PACKINGBATCH | 82 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 2 | 199.99 |
| PACKING | 82 | 00010 | Calci-Phos-D100ML | 0001 | 200 | 28.11 |
| PACKING | 83 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 136.41 |
| PACKINGBATCH | 83 | 02097 | Bottle Round liter | 0001 | 26 | 202.4 |
| PACKINGBATCH | 83 | 03003 | Calci-Phos-D | 0001 | 60 | 33.29 |
| PACKINGBATCH | 83 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 5 | 185 |
| PACKING | 83 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 136.41 |
| PurchasesBatch | 41 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 313 | 235 |
| PurchasesBatch | 42 | 02014 | Plastic Can White 5 Liter | 0001 | 170 | 390 |
| Productions | 80 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 13.79 |
| PRODUCTIONBATCH | 80 | 01003 | Bentonite | 0001 | 2 | 13.46 |
| PRODUCTIONBATCH | 80 | 01016 | DCP (Dana) | 0001 | 250 | 10 |
| PRODUCTIONBATCH | 80 | 01044 | Sodium Bicarbonate | 0001 | 7 | 130.54 |
| Productions | 80 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 13.79 |
| PACKING | 84 | 00220 | Rumicid powder 25kg | 0001 | 10 | 544.74 |
| PACKINGBATCH | 84 | 02258 | Label Rumicid 25kg | 0001 | 10 | 45 |
| PACKINGBATCH | 84 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 84 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 13.79 |
| PACKING | 84 | 00220 | Rumicid powder 25kg | 0001 | 10 | 544.74 |
| Productions | 81 | 03173 | Bop Dairy Mineral | 0001 | 500 | 14.56 |
| PRODUCTIONBATCH | 81 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 81 | 01042 | Starch | 0001 | 6 | 167.2 |
| PRODUCTIONBATCH | 81 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| Productions | 81 | 03173 | Bop Dairy Mineral | 0001 | 500 | 14.56 |
| PACKING | 85 | 00243 | Bop dairy Mineral 25 KG | 0001 | 20 | 519.01 |
| PACKINGBATCH | 85 | 02277 | Bag Bop Yellow Colour | 0001 | 20 | 155 |
| PACKINGBATCH | 85 | 03173 | Bop Dairy Mineral | 0001 | 500 | 14.56 |
| PACKING | 85 | 00243 | Bop dairy Mineral 25 KG | 0001 | 20 | 519.01 |
| PurchasesBatch | 43 | 02404 | Label Bop D-Cal Oral Liquid 5 Lit | 0001 | 110 | 40 |
| PurchasesBatch | 43 | 02145 | Label Super Adek Liquid 5 Lit | 0001 | 64 | 40 |
| PurchasesBatch | 43 | 02142 | Label Ferovit Plus 5 Lit | 0001 | 110 | 40 |
| PurchasesBatch | 43 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 110 | 40 |
| PurchasesBatch | 43 | 02365 | Label O-D Plus Oral Liquid 5 Lit | 0001 | 110 | 40 |
| PurchasesBatch | 43 | 02132 | Label MicroTox 5 Liter | 0001 | 400 | 20 |
| PurchasesBatch | 43 | 02363 | Label L.G Mune Oral Liquid 5 Lit | 0001 | 400 | 20 |
| PurchasesBatch | 43 | 02141 | Label Immune Forte 5 Lit | 0001 | 400 | 20 |
| PurchasesBatch | 43 | 02211 | Label RespiFit Liquid 5 Liter | 0001 | 80 | 40 |
| PurchasesBatch | 43 | 02437 | Label MLC 360 Oral Liquid 25 Lit | 0001 | 6 | 90 |
| PurchasesBatch | 43 | 02435 | Label CS Guard 20 Oral Liquid 5 Lit | 0001 | 52 | 40 |
| PurchasesBatch | 43 | 02436 | Label Vital Frame Oral Liquid 5 Lit | 0001 | 52 | 40 |
| PurchasesBatch | 43 | 02147 | Label Bio Ambrox 5 Lit | 0001 | 110 | 40 |
| PurchasesBatch | 43 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 10 | 140 |
| PurchasesBatch | 43 | 00374 | Renu Guard Bucket Label | 0001 | 20 | 70 |
| PurchasesBatch | 43 | 02329 | Label Merlin Fix Oral Powder 25 kg | 0001 | 25 | 120 |
| PurchasesBatch | 43 | 02372 | Label Bop Buffer Plus 25 kg | 0001 | 200 | 40 |
| PurchasesBatch | 43 | 02438 | Label BOP TOX Oral Powder 25 kg | 0001 | 10 | 140 |
| PurchasesBatch | 44 | 02145 | Label Super Adek Liquid 5 Lit | 0001 | 400 | 20 |
| PurchasesBatch | 45 | 02014 | Plastic Can White 5 Liter | 0001 | 544 | 390 |
| PurchasesBatch | 46 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 450 |
| PurchasesBatch | 47 | 01047 | Sodium Sulphate | 0001 | 500 | 68 |
| PurchasesBatch | 47 | 01044 | Sodium Bicarbonate | 0001 | 100 | 128 |
| PurchasesBatch | 46 | 02054 | White Bag Unprint | 0001 | 20 | 185 |
| PurchasesBatch | 46 | 02140 | Bucket Large | 0001 | 50 | 1,100 |
| PurchasesBatch | 48 | 01041 | Sodium Benzoate | 0001 | 25 | 650 |
| PurchasesBatch | 48 | 01058 | Xanthan Gum | 0001 | 25 | 1,450 |
| PurchasesBatch | 48 | 01004 | Citric Acid | 0001 | 25 | 400 |
| PurchasesBatch | 48 | 01105 | Sodium Citrate | 0001 | 25 | 420 |
| PurchasesBatch | 48 | 01034 | Magnesium Sulphate | 0001 | 25 | 560 |
| PurchasesBatch | 48 | 01009 | Copper Sulphate | 0001 | 100 | 2,200 |
| PurchasesBatch | 48 | 01021 | Glacial Acetic Acid | 0001 | 30 | 400 |
| PurchasesBatch | 48 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 25 | 1,550 |
| PurchasesBatch | 47 | 01059 | Wheat Bran | 0001 | 30 | 80 |
| Productions | 82 | 03010 | Garlimint Plus BOP | 0001 | 34 | 125.64 |
| PRODUCTIONBATCH | 82 | 01023 | Garlic Oil | 0001 | 0 | 5,500 |
| PRODUCTIONBATCH | 82 | 01025 | Ginger Oil | 000 | 0 | 4,500 |
| PRODUCTIONBATCH | 82 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 82 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 82 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 82 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 82 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 82 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 82 | 03010 | Garlimint Plus BOP | 0001 | 34 | 125.64 |
| PACKING | 86 | 00259 | Garliment-Plus BOP  30ML | 0001 | 1,144 | 24.36 |
| PACKINGBATCH | 86 | 02314 | Dropper  30ML | 0001 | 1,120 | 12.5 |
| PACKINGBATCH | 86 | 02316 | S+D Garliment Plus 30ML | 0001 | 1,200 | 6 |
| PACKINGBATCH | 86 | 03010 | Garlimint Plus BOP | 0001 | 34 | 125.64 |
| PACKINGBATCH | 86 | 02317 | Shipper [M] 30ML Bottle | 0001 | 15 | 160 |
| Productions | 83 | 03222 | Bop Buffer Plus | 0001 | 2,500 | 20.78 |
| PRODUCTIONBATCH | 83 | 01003 | Bentonite | 0001 | 200 | 13.46 |
| PRODUCTIONBATCH | 83 | 01015 | DCP (Calcium) | 0001 | 2,000 | 17 |
| PRODUCTIONBATCH | 83 | 01016 | DCP (Dana) | 0001 | 500 | 10 |
| PRODUCTIONBATCH | 83 | 01044 | Sodium Bicarbonate | 0001 | 80 | 128.25 |
| PACKING | 87 | 00315 | Bop Buffer Plus 25 kg | 0001 | 100 | 734.02 |
| PACKINGBATCH | 87 | 02372 | Label Bop Buffer Plus 25 kg | 0001 | 110 | 40 |
| PACKINGBATCH | 87 | 03222 | Bop Buffer Plus | 0001 | 2,500 | 20.78 |
| PACKINGBATCH | 87 | 02277 | Bag Bop Yellow Colour | 0001 | 110 | 155 |
| Productions | 84 | 03054 | Bio Ambrox  Liquid | 0001 | 400 | 57.09 |
| PRODUCTIONBATCH | 84 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 84 | 01041 | Sodium Benzoate | 0001 | 2 | 649.76 |
| PRODUCTIONBATCH | 84 | 01048 | Titanium Dioxide (T.T) | 0001 | 2 | 1,500 |
| PRODUCTIONBATCH | 84 | 01058 | Xanthan Gum | 0001 | 2 | 1,468.44 |
| Productions | 84 | 03054 | Bio Ambrox  Liquid | 0001 | 400 | 57.09 |
| PACKING | 88 | 00138 | Bio Ambrox 5Lit | 0001 | 80 | 821.24 |
| PACKINGBATCH | 88 | 02014 | Plastic Can White 5 Liter | 0001 | 85 | 392.56 |
| PACKINGBATCH | 88 | 02147 | Label Bio Ambrox 5 Lit | 0001 | 110 | 40 |
| PACKINGBATCH | 88 | 03054 | Bio Ambrox  Liquid | 0001 | 400 | 57.09 |
| PACKINGBATCH | 88 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 22 | 231.6 |
| PACKING | 88 | 00138 | Bio Ambrox 5Lit | 0001 | 80 | 821.24 |
| Productions | 85 | 03074 | Respi Fit Oral Liquid | 0001 | 280 | 115.48 |
| PRODUCTIONBATCH | 85 | 01017 | Camphor | 0001 | 3 | 3,309.29 |
| PRODUCTIONBATCH | 85 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 85 | 01041 | Sodium Benzoate | 0001 | 1 | 649.76 |
| PRODUCTIONBATCH | 85 | 01048 | Titanium Dioxide (T.T) | 0001 | 1 | 1,500 |
| PRODUCTIONBATCH | 85 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| Productions | 85 | 03074 | Respi Fit Oral Liquid | 0001 | 280 | 115.48 |
| PACKING | 89 | 00189 | RESPIFIT Liquid 5 Liter | 0001 | 56 | 1,183.56 |
| PACKINGBATCH | 89 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 392.56 |
| PACKINGBATCH | 89 | 02211 | Label RespiFit Liquid 5 Liter | 0001 | 144 | 40 |
| PACKINGBATCH | 89 | 03074 | Respi Fit Oral Liquid | 0001 | 280 | 115.48 |
| PACKINGBATCH | 89 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 20 | 231.6 |
| PACKING | 89 | 00189 | RESPIFIT Liquid 5 Liter | 0001 | 56 | 1,183.56 |
| Productions | 86 | 03146 | Profen C+ Powder | 0001 | 360 | 152.73 |
| PRODUCTIONBATCH | 86 | 01041 | Sodium Benzoate | 0001 | 1 | 649.76 |
| PRODUCTIONBATCH | 86 | 01047 | Sodium Sulphate | 0001 | 360 | 68 |
| PRODUCTIONBATCH | 86 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 86 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 18 | 1,545.26 |
| PRODUCTIONBATCH | 86 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| PRODUCTIONBATCH | 86 | 01105 | Sodium Citrate | 0001 | 0 | 398.3 |
| Productions | 86 | 03146 | Profen C+ Powder | 0001 | 360 | 152.73 |
| OpeningBatch | 110 | 02232 | Packet Profen C+ 1kg | 0001 | 500 | 30 |
| PACKING | 90 | 00208 | Profen C+ Powder 1Kg | 0001 | 360 | 275.23 |
| PACKINGBATCH | 90 | 02232 | Packet Profen C+ 1kg | 0001 | 370 | 30 |
| PACKINGBATCH | 90 | 03146 | Profen C+ Powder | 0001 | 360 | 152.73 |
| PACKINGBATCH | 90 | 02140 | Bucket Large | 0001 | 30 | 1,100 |
| PurchasesBatch | 48 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| Productions | 87 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 132.57 |
| PRODUCTIONBATCH | 87 | 01002 | Ammonium chloride | 0001 | 30 | 242.02 |
| PRODUCTIONBATCH | 87 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 87 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 87 | 01047 | Sodium Sulphate | 0001 | 140 | 68 |
| PRODUCTIONBATCH | 87 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 1 | 1,545.26 |
| PRODUCTIONBATCH | 87 | 01105 | Sodium Citrate | 0001 | 0 | 398.3 |
| PACKING | 91 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 247.23 |
| PACKINGBATCH | 91 | 02341 | Packet Reno Gurd Flush Oral Powder 1 kg | 0001 | 160 | 30 |
| PACKINGBATCH | 91 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 132.57 |
| PACKINGBATCH | 91 | 02140 | Bucket Large | 0001 | 10 | 1,100 |
| PACKINGBATCH | 91 | 00374 | Renu Guard Bucket Label | 0001 | 20 | 70 |
| Productions | 88 | 03189 | Merlin Fix Oral Powder | 0001 | 500 | 27.46 |
| PRODUCTIONBATCH | 88 | 01003 | Bentonite | 0001 | 500 | 13.46 |
| PRODUCTIONBATCH | 88 | 01115 | Calcium Propionate | 0001 | 5 | 1,200 |
| PRODUCTIONBATCH | 88 | 01187 | Sodium Metaby Sulphate | 0001 | 5 | 200 |
| PACKING | 92 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 1,021.53 |
| PACKINGBATCH | 92 | 02054 | White Bag Unprint | 0001 | 20 | 185 |
| PACKINGBATCH | 92 | 02329 | Label Merlin Fix Oral Powder 25 kg | 0001 | 25 | 120 |
| PACKINGBATCH | 92 | 03189 | Merlin Fix Oral Powder | 0001 | 500 | 27.46 |
| Productions | 89 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 274.88 |
| PRODUCTIONBATCH | 89 | 01009 | Copper Sulphate | 0001 | 10 | 2,063.66 |
| PRODUCTIONBATCH | 89 | 01021 | Glacial Acetic Acid | 0001 | 1 | 399.62 |
| PRODUCTIONBATCH | 89 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 89 | 01036 | Propylene Glycol (PG) | 0001 | 2 | 750 |
| PRODUCTIONBATCH | 89 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 89 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 421.7 |
| PRODUCTIONBATCH | 89 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 89 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 274.88 |
| PACKING | 93 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 0001 | 20 | 1,928.84 |
| PACKINGBATCH | 93 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 392.56 |
| PACKINGBATCH | 93 | 02435 | Label CS Guard 20 Oral Liquid 5 Lit | 0001 | 52 | 40 |
| PACKINGBATCH | 93 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 274.88 |
| PACKINGBATCH | 93 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 231.6 |
| PACKING | 93 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 0001 | 20 | 1,928.84 |
| Productions | 90 | 03163 | Calcium 72 | 0001 | 50 | 17 |
| PRODUCTIONBATCH | 90 | 01015 | DCP (Calcium) | 0001 | 50 | 17 |
| PACKING | 94 | 00231 | Calcium 72 25kg | 0001 | 2 | 505 |
| PACKINGBATCH | 94 | 02274 | Bag Calcium 72  25kg | 0001 | 2 | 80 |
| PACKINGBATCH | 94 | 03163 | Calcium 72 | 0001 | 50 | 17 |
| Productions | 91 | 03019 | Super Yeast Powder | 0001 | 50 | 21.96 |
| PRODUCTIONBATCH | 91 | 01003 | Bentonite | 0001 | 50 | 13.46 |
| PRODUCTIONBATCH | 91 | 01033 | Molasses | 0001 | 5 | 50 |
| PRODUCTIONBATCH | 91 | 01007 | CSL | 0001 | 5 | 35 |
| Productions | 91 | 03019 | Super Yeast Powder | 0001 | 50 | 21.96 |
| PACKING | 95 | 00040 | Super Yeast Powder 25kg | 0001 | 2 | 744.02 |
| PACKINGBATCH | 95 | 02042 | Label Super Yeast 25 KG | 0001 | 2 | 40 |
| PACKINGBATCH | 95 | 02213 | Bag Bop Red Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 95 | 03019 | Super Yeast Powder | 0001 | 50 | 21.96 |
| PACKING | 95 | 00040 | Super Yeast Powder 25kg | 0001 | 2 | 744.03 |
| Productions | 92 | 03028 | O-D Plus Oral Liquid | 0001 | 460 | 59.63 |
| PRODUCTIONBATCH | 92 | 01017 | Camphor | 0001 | 0 | 3,309.29 |
| PRODUCTIONBATCH | 92 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 92 | 01036 | Propylene Glycol (PG) | 0001 | 10 | 750 |
| PRODUCTIONBATCH | 92 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 92 | 01045 | Sorbitol Liquid 70% | 0001 | 10 | 421.7 |
| PRODUCTIONBATCH | 92 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 92 | 03028 | O-D Plus Oral Liquid | 0001 | 460 | 59.63 |
| PACKING | 96 | 00177 | O-D Plus Oral Liquid 5 Liter | 0001 | 92 | 814.29 |
| PACKINGBATCH | 96 | 02014 | Plastic Can White 5 Liter | 0001 | 95 | 392.56 |
| PACKINGBATCH | 96 | 02365 | Label O-D Plus Oral Liquid 5 Lit | 0001 | 110 | 40 |
| PACKINGBATCH | 96 | 03028 | O-D Plus Oral Liquid | 0001 | 460 | 59.63 |
| PACKINGBATCH | 96 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 231.6 |
| PACKING | 96 | 00177 | O-D Plus Oral Liquid 5 Liter | 0001 | 92 | 814.29 |
| Productions | 93 | 03095 | Super Adek Liquid | 0001 | 220 | 60.06 |
| PRODUCTIONBATCH | 93 | 01028 | Lactic Acid | 0001 | 3 | 1,650 |
| PRODUCTIONBATCH | 93 | 01036 | Propylene Glycol (PG) | 0001 | 3 | 750 |
| PRODUCTIONBATCH | 93 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 93 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 93 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,545.26 |
| PRODUCTIONBATCH | 93 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 93 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 93 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| Productions | 93 | 03095 | Super Adek Liquid | 0001 | 220 | 60.06 |
| PACKING | 97 | 00136 | Super Adek Liquid 5 Lit | 0001 | 44 | 840.6 |
| PACKINGBATCH | 97 | 02014 | Plastic Can White 5 Liter | 0001 | 50 | 392.56 |
| PACKINGBATCH | 97 | 02145 | Label Super Adek Liquid 5 Lit | 0001 | 60 | 22.76 |
| PACKINGBATCH | 97 | 03095 | Super Adek Liquid | 0001 | 220 | 60.06 |
| PACKINGBATCH | 97 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 231.6 |
| PACKING | 97 | 00136 | Super Adek Liquid 5 Lit | 0001 | 44 | 840.59 |
| Productions | 94 | 03101 | BOP DCAL Liquid | 0001 | 420 | 94.41 |
| PRODUCTIONBATCH | 94 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 94 | 01013 | Calcium Chloride | 0001 | 4 | 160 |
| PRODUCTIONBATCH | 94 | 01034 | Magnesium Sulphate | 0001 | 8 | 513.16 |
| PRODUCTIONBATCH | 94 | 01038 | Phosphoric Acid 85% | 0001 | 25 | 650 |
| PRODUCTIONBATCH | 94 | 01045 | Sorbitol Liquid 70% | 0001 | 10 | 421.7 |
| PRODUCTIONBATCH | 94 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 94 | 01056 | Vitamin D3 | 0001 | 0 | 16,500 |
| PRODUCTIONBATCH | 94 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 94 | 01060 | Zinc Sulphate | 0001 | 2 | 950 |
| Productions | 94 | 03101 | BOP DCAL Liquid | 0001 | 420 | 94.41 |
| PACKING | 98 | 00144 | BOP DCAL Liquid 5 Lit | 0001 | 84 | 977.63 |
| PACKINGBATCH | 98 | 02014 | Plastic Can White 5 Liter | 0001 | 84 | 392.56 |
| PACKINGBATCH | 98 | 02404 | Label Bop D-Cal Oral Liquid 5 Lit | 0001 | 110 | 40 |
| PACKINGBATCH | 98 | 03101 | BOP DCAL Liquid | 0001 | 420 | 94.41 |
| PACKINGBATCH | 98 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 22 | 231.6 |
| PACKING | 98 | 00144 | BOP DCAL Liquid 5 Lit | 0001 | 84 | 977.63 |
| Productions | 95 | 03089 | RespiGuard Liquid | 0001 | 220 | 113.79 |
| PRODUCTIONBATCH | 95 | 01017 | Camphor | 0001 | 1 | 3,309.29 |
| PRODUCTIONBATCH | 95 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 95 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 95 | 01045 | Sorbitol Liquid 70% | 0001 | 6 | 421.7 |
| PRODUCTIONBATCH | 95 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 95 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 95 | 03089 | RespiGuard Liquid | 0001 | 220 | 113.79 |
| PACKING | 99 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 44 | 1,051.94 |
| PACKINGBATCH | 99 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 392.56 |
| PACKINGBATCH | 99 | 02131 | Label RespiGuard 5 Liter | 0001 | 60 | 20 |
| PACKINGBATCH | 99 | 03089 | RespiGuard Liquid | 0001 | 220 | 113.79 |
| PACKINGBATCH | 99 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 231.6 |
| PACKING | 99 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 44 | 1,051.94 |
| Productions | 96 | 03094 | Super Copper Liquid | 0001 | 640 | 315.46 |
| PRODUCTIONBATCH | 96 | 01004 | Citric Acid | 0001 | 30 | 400 |
| PRODUCTIONBATCH | 96 | 01009 | Copper Sulphate | 0001 | 64 | 2,063.66 |
| PRODUCTIONBATCH | 96 | 01028 | Lactic Acid | 0001 | 22 | 1,650 |
| PRODUCTIONBATCH | 96 | 01045 | Sorbitol Liquid 70% | 0001 | 32 | 421.7 |
| PRODUCTIONBATCH | 96 | 01058 | Xanthan Gum | 0001 | 4 | 1,468.44 |
| PRODUCTIONBATCH | 96 | 01041 | Sodium Benzoate | 0001 | 1 | 649.76 |
| PACKING | 100 | 00135 | Super Copper Liquid 5 Lit | 0001 | 128 | 2,080.89 |
| PACKINGBATCH | 100 | 02014 | Plastic Can White 5 Liter | 0001 | 135 | 392.56 |
| PACKINGBATCH | 100 | 02144 | Label Super Copper Liquid 5 Lit | 0001 | 168 | 20 |
| PACKINGBATCH | 100 | 03094 | Super Copper Liquid | 0001 | 640 | 315.46 |
| PACKINGBATCH | 100 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 35 | 231.6 |
| PACKING | 100 | 00135 | Super Copper Liquid 5 Lit | 0001 | 128 | 2,080.89 |
| Productions | 97 | 03090 | Microtox Liquid | 0001 | 20 | 137.52 |
| PRODUCTIONBATCH | 97 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 97 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 97 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 97 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.62 |
| PRODUCTIONBATCH | 97 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 97 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 97 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 97 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| PRODUCTIONBATCH | 97 | 01105 | Sodium Citrate | 0001 | 0 | 398.3 |
| PRODUCTIONBATCH | 97 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| PRODUCTIONBATCH | 97 | 01184 | ARQ | 0001 | 1 | 366.68 |
| Productions | 97 | 03090 | Microtox Liquid | 0001 | 20 | 137.52 |
| PACKING | 101 | 00130 | MicroTox Liquid 5 Liter | 0001 | 4 | 1,168.05 |
| PACKINGBATCH | 101 | 02014 | Plastic Can White 5 Liter | 0001 | 4 | 392.56 |
| PACKINGBATCH | 101 | 02132 | Label MicroTox 5 Liter | 0001 | 6 | 20 |
| PACKINGBATCH | 101 | 03090 | Microtox Liquid | 0001 | 20 | 137.52 |
| PACKINGBATCH | 101 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 1 | 231.6 |
| PACKING | 101 | 00130 | MicroTox Liquid 5 Liter | 0001 | 4 | 1,168.05 |
| PurchasesBatch | 49 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 20 | 210 |
| PurchasesBatch | 50 | 01184 | ARQ | 0001 | 120 | 366.67 |
| PurchasesBatch | 50 | 01186 | HCL | 0001 | 60 | 36.67 |
| PurchasesBatch | 51 | 01053 | Vitamin B1 | 0001 | 10 | 17,500 |
| PurchasesBatch | 51 | 01054 | Vitamin B2 | 0001 | 10 | 17,500 |
| PurchasesBatch | 51 | 01056 | Vitamin D3 | 0001 | 10 | 19,500 |
| PurchasesBatch | 51 | 01017 | Camphor | 0001 | 25 | 3,400 |
| PurchasesBatch | 51 | 01028 | Lactic Acid | 0001 | 30 | 1,650 |
| PurchasesBatch | 51 | 01025 | Ginger Oil | 0001 | 25 | 7,200 |
| PurchasesBatch | 51 | 01023 | Garlic Oil | 0001 | 25 | 7,200 |
| PurchasesBatch | 51 | 01046 | Silmyrin | 0001 | 25 | 10,500 |
| PurchasesBatch | 51 | 01011 | Choline Chloride | 0001 | 25 | 4,850 |
| PurchasesBatch | 51 | 01013 | Calcium Chloride | 0001 | 25 | 210 |
| PurchasesBatch | 51 | 01038 | Phosphoric Acid 85% | 0001 | 35 | 650 |
| PurchasesBatch | 52 | 02410 | Label Aspolite C Oral Liquid 5 Lit | 0001 | 110 | 80 |
| PurchasesBatch | 52 | 02371 | Label Phyto-Phos Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PurchasesBatch | 52 | 02364 | Label BOP E 50 Oral Liquid 5 Lit | 0001 | 64 | 40 |
| Productions | 98 | 03090 | Microtox Liquid | 0001 | 580 | 161.33 |
| PRODUCTIONBATCH | 98 | 01009 | Copper Sulphate | 0001 | 9 | 2,063.66 |
| PRODUCTIONBATCH | 98 | 01010 | Betaine | 0001 | 5 | 2,800 |
| PRODUCTIONBATCH | 98 | 01020 | Formic Acid | 0001 | 10 | 350 |
| PRODUCTIONBATCH | 98 | 01021 | Glacial Acetic Acid | 0001 | 8 | 399.62 |
| PRODUCTIONBATCH | 98 | 01028 | Lactic Acid | 0001 | 7 | 1,650 |
| PRODUCTIONBATCH | 98 | 01041 | Sodium Benzoate | 0001 | 1 | 649.76 |
| PRODUCTIONBATCH | 98 | 01045 | Sorbitol Liquid 70% | 0001 | 20 | 421.7 |
| PRODUCTIONBATCH | 98 | 01058 | Xanthan Gum | 0001 | 2 | 1,468.44 |
| PRODUCTIONBATCH | 98 | 01105 | Sodium Citrate | 0001 | 4 | 398.3 |
| PRODUCTIONBATCH | 98 | 01115 | Calcium Propionate | 0001 | 9 | 1,200 |
| PRODUCTIONBATCH | 98 | 01184 | ARQ | 0001 | 35 | 366.67 |
| Productions | 98 | 03090 | Microtox Liquid | 0001 | 580 | 161.33 |
| PACKING | 102 | 00130 | MicroTox Liquid 5 Liter | 0001 | 116 | 1,303.75 |
| PACKINGBATCH | 102 | 02014 | Plastic Can White 5 Liter | 0001 | 120 | 392.56 |
| PACKINGBATCH | 102 | 02132 | Label MicroTox 5 Liter | 0001 | 160 | 20 |
| PACKINGBATCH | 102 | 03090 | Microtox Liquid | 0001 | 580 | 161.33 |
| PACKINGBATCH | 102 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 32 | 229.87 |
| PACKING | 102 | 00130 | MicroTox Liquid 5 Liter | 0001 | 116 | 1,303.75 |
| Productions | 99 | 03092 | Immune Forte Oral liquid | 0001 | 295 | 82.57 |
| PRODUCTIONBATCH | 99 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 99 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,545.26 |
| PRODUCTIONBATCH | 99 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 99 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 99 | 01060 | Zinc Sulphate | 0001 | 1 | 950 |
| Productions | 99 | 03092 | Immune Forte Oral liquid | 0001 | 295 | 82.57 |
| PACKING | 103 | 00132 | Immune Forte Liquid 5 Lit | 0001 | 59 | 901.52 |
| PACKINGBATCH | 103 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 392.56 |
| PACKINGBATCH | 103 | 02141 | Label Immune Forte 5 Lit | 0001 | 80 | 20 |
| PACKINGBATCH | 103 | 03092 | Immune Forte Oral liquid | 0001 | 295 | 82.57 |
| PACKINGBATCH | 103 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 16 | 229.87 |
| PACKING | 103 | 00132 | Immune Forte Liquid 5 Lit | 0001 | 59 | 901.52 |
| Productions | 100 | 03102 | L.G Mune Liquid | 0001 | 820 | 134.9 |
| PRODUCTIONBATCH | 100 | 01023 | Garlic Oil | 0001 | 7 | 7,043.77 |
| PRODUCTIONBATCH | 100 | 01025 | Ginger Oil | 000 | 1 | 4,500 |
| PRODUCTIONBATCH | 100 | 01025 | Ginger Oil | 0001 | 5 | 7,200 |
| PRODUCTIONBATCH | 100 | 01041 | Sodium Benzoate | 0001 | 3 | 649.76 |
| PRODUCTIONBATCH | 100 | 01045 | Sorbitol Liquid 70% | 0001 | 10 | 421.7 |
| PRODUCTIONBATCH | 100 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 100 | 01058 | Xanthan Gum | 0001 | 3 | 1,468.44 |
| Productions | 100 | 03102 | L.G Mune Liquid | 0001 | 820 | 132.42 |
| PACKING | 104 | 00145 | L.G Mune Liquid 5 Liter | 0001 | 164 | 1,156.15 |
| PACKINGBATCH | 104 | 02014 | Plastic Can White 5 Liter | 0001 | 170 | 392.56 |
| PACKINGBATCH | 104 | 02363 | Label L.G Mune Oral Liquid 5 Lit | 0001 | 220 | 20 |
| PACKINGBATCH | 104 | 03102 | L.G Mune Liquid | 0001 | 820 | 132.42 |
| PACKINGBATCH | 104 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 43 | 229.87 |
| PACKING | 104 | 00145 | L.G Mune Liquid 5 Liter | 0001 | 164 | 1,156.15 |
| Productions | 101 | 03093 | Ferovit Plus Liquid | 0001 | 300 | 269.79 |
| PRODUCTIONBATCH | 101 | 01009 | Copper Sulphate | 0001 | 7 | 2,063.66 |
| PRODUCTIONBATCH | 101 | 01045 | Sorbitol Liquid 70% | 0001 | 42 | 421.7 |
| PRODUCTIONBATCH | 101 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 101 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 101 | 01054 | Vitamin B2 | 0001 | 1 | 17,499.11 |
| PRODUCTIONBATCH | 101 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 1 | 1,545.26 |
| PRODUCTIONBATCH | 101 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 101 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 101 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 101 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 101 | 01143 | Vitamin B3 | 0001 | 1 | 3,200 |
| Productions | 101 | 03093 | Ferovit Plus Liquid | 0001 | 300 | 269.79 |
| PACKING | 105 | 00133 | Ferovit Plus Liquid 5 Lit | 0001 | 60 | 1,869.74 |
| PACKINGBATCH | 105 | 02013 | Plastic Can Blue 5 Liter | 0001 | 60 | 390 |
| PACKINGBATCH | 105 | 02142 | Label Ferovit Plus 5 Lit | 0001 | 110 | 40 |
| PACKINGBATCH | 105 | 03093 | Ferovit Plus Liquid | 0001 | 300 | 269.79 |
| PACKINGBATCH | 105 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 15 | 229.87 |
| Productions | 102 | 03248 | Aspolite C Oral Liquid | 0001 | 400 | 106.94 |
| PRODUCTIONBATCH | 102 | 01004 | Citric Acid | 0001 | 4 | 400 |
| PRODUCTIONBATCH | 102 | 01041 | Sodium Benzoate | 0001 | 4 | 649.76 |
| PRODUCTIONBATCH | 102 | 01043 | Sodium Chloride | 0001 | 2 | 13.75 |
| PRODUCTIONBATCH | 102 | 01045 | Sorbitol Liquid 70% | 0001 | 10 | 421.7 |
| PRODUCTIONBATCH | 102 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 102 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 20 | 1,545.26 |
| PRODUCTIONBATCH | 102 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 102 | 01073 | Potassium Chloride | 0001 | 2 | 520 |
| Productions | 102 | 03248 | Aspolite C Oral Liquid | 0001 | 400 | 106.94 |
| PACKING | 106 | 00349 | Aspolite C Oral Liquid 5 Lit | 0001 | 80 | 1,094.71 |
| PACKINGBATCH | 106 | 02014 | Plastic Can White 5 Liter | 0001 | 80 | 392.56 |
| PACKINGBATCH | 106 | 02410 | Label Aspolite C Oral Liquid 5 Lit | 0001 | 110 | 80 |
| PACKINGBATCH | 106 | 03248 | Aspolite C Oral Liquid | 0001 | 400 | 106.94 |
| PACKINGBATCH | 106 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 20 | 229.87 |
| PACKING | 106 | 00349 | Aspolite C Oral Liquid 5 Lit | 0001 | 80 | 1,094.71 |
| Productions | 103 | 03091 | HepaLive liquid | 0001 | 800 | 115.4 |
| PRODUCTIONBATCH | 103 | 01009 | Copper Sulphate | 0001 | 1 | 2,063.66 |
| PRODUCTIONBATCH | 103 | 01010 | Betaine | 0001 | 6 | 2,800 |
| PRODUCTIONBATCH | 103 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 103 | 01020 | Formic Acid | 0001 | 4 | 350 |
| PRODUCTIONBATCH | 103 | 01021 | Glacial Acetic Acid | 0001 | 4 | 399.62 |
| PRODUCTIONBATCH | 103 | 01028 | Lactic Acid | 0001 | 8 | 1,650 |
| PRODUCTIONBATCH | 103 | 01041 | Sodium Benzoate | 0001 | 3 | 649.76 |
| PRODUCTIONBATCH | 103 | 01045 | Sorbitol Liquid 70% | 0001 | 40 | 421.7 |
| PRODUCTIONBATCH | 103 | 01058 | Xanthan Gum | 0001 | 3 | 1,468.44 |
| PRODUCTIONBATCH | 103 | 01105 | Sodium Citrate | 0001 | 1 | 398.3 |
| PRODUCTIONBATCH | 103 | 01184 | ARQ | 0001 | 80 | 366.67 |
| Productions | 103 | 03091 | HepaLive liquid | 0001 | 800 | 115.4 |
| PACKING | 107 | 00131 | HepaLiv Liquid 5 Liter | 0001 | 160 | 1,079.05 |
| PACKINGBATCH | 107 | 02014 | Plastic Can White 5 Liter | 0001 | 170 | 392.56 |
| PACKINGBATCH | 107 | 02133 | Label HepaLive Liquid 5 Liter | 0001 | 220 | 20 |
| PACKINGBATCH | 107 | 03091 | HepaLive liquid | 0001 | 800 | 115.4 |
| PACKINGBATCH | 107 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 40 | 229.87 |
| PACKING | 107 | 00131 | HepaLiv Liquid 5 Liter | 0001 | 160 | 1,079.05 |
| Productions | 104 | 03183 | Pro-Tox Liquid | 0001 | 460 | 57.81 |
| PRODUCTIONBATCH | 104 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 104 | 01020 | Formic Acid | 0001 | 3 | 350 |
| PRODUCTIONBATCH | 104 | 01021 | Glacial Acetic Acid | 0001 | 3 | 399.62 |
| PRODUCTIONBATCH | 104 | 01041 | Sodium Benzoate | 0001 | 1 | 649.76 |
| PRODUCTIONBATCH | 104 | 01045 | Sorbitol Liquid 70% | 0001 | 9 | 421.7 |
| PRODUCTIONBATCH | 104 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 104 | 01105 | Sodium Citrate | 0001 | 3 | 398.3 |
| PRODUCTIONBATCH | 104 | 01184 | ARQ | 0001 | 10 | 366.67 |
| Productions | 104 | 03183 | Pro-Tox Liquid | 0001 | 460 | 57.81 |
| PACKING | 108 | 00260 | Pro-Tox Liquid 5L | 0001 | 92 | 786.92 |
| PACKINGBATCH | 108 | 02014 | Plastic Can White 5 Liter | 0001 | 92 | 392.56 |
| PACKINGBATCH | 108 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 110 | 40 |
| PACKINGBATCH | 108 | 03183 | Pro-Tox Liquid | 0001 | 460 | 57.81 |
| PACKINGBATCH | 108 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 23 | 229.87 |
| PACKING | 108 | 00260 | Pro-Tox Liquid 5L | 0001 | 92 | 786.92 |
| Productions | 105 | 03221 | Phyto-Phos Oral Liquid | 0001 | 200 | 142.11 |
| PRODUCTIONBATCH | 105 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 105 | 01013 | Calcium Chloride | 0001 | 5 | 208.6 |
| PRODUCTIONBATCH | 105 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 105 | 01034 | Magnesium Sulphate | 0001 | 2 | 513.16 |
| PRODUCTIONBATCH | 105 | 01038 | Phosphoric Acid 85% | 0001 | 10 | 650 |
| PRODUCTIONBATCH | 105 | 01041 | Sodium Benzoate | 0001 | 1 | 649.76 |
| PRODUCTIONBATCH | 105 | 01045 | Sorbitol Liquid 70% | 0001 | 5 | 421.7 |
| PRODUCTIONBATCH | 105 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 105 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 105 | 01060 | Zinc Sulphate | 0001 | 2 | 950 |
| PRODUCTIONBATCH | 105 | 01189 | Glycerine | 0001 | 8 | 807.8 |
| Productions | 105 | 03221 | Phyto-Phos Oral Liquid | 0001 | 200 | 142.11 |
| PACKING | 109 | 00314 | Phyto-Phos Oral Liquid 5 Lit | 0001 | 40 | 1,224.58 |
| PACKINGBATCH | 109 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 392.56 |
| PACKINGBATCH | 109 | 02371 | Label Phyto-Phos Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PACKINGBATCH | 109 | 03221 | Phyto-Phos Oral Liquid | 0001 | 200 | 142.11 |
| PACKINGBATCH | 109 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 229.87 |
| PACKING | 109 | 00314 | Phyto-Phos Oral Liquid 5 Lit | 0001 | 40 | 1,224.58 |
| PurchasesBatch | 53 | 02267 | Label Ex.Tox Liquid  5Lit | 0001 | 24 | 40 |
| PurchasesBatch | 53 | 02271 | Label E.S 200 5Lit | 0001 | 24 | 40 |
| PurchasesBatch | 53 | 02272 | Label Stable C20  5Lit | 0001 | 64 | 40 |
| PurchasesBatch | 53 | 02350 | Label Hepa Gold Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PurchasesBatch | 53 | 02026 | Label Toxi Lic 5 Liter | 0001 | 144 | 60 |
| PurchasesBatch | 53 | 02148 | Label Bentox Powder 25kg | 0001 | 12 | 140 |
| PurchasesBatch | 53 | 02268 | Label P.H Cure 25Liter | 0001 | 26 | 90 |
| PurchasesBatch | 53 | 02351 | label Toxi Gold Forte Powder 25 kg | 0001 | 12 | 140 |
| PurchasesBatch | 54 | 01020 | Formic Acid | 0001 | 700 | 350 |
| PurchasesBatch | 55 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 313 | 235 |
| PurchasesBatch | 56 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 31 | 227 |
| PurchasesBatch | 57 | 02014 | Plastic Can White 5 Liter | 0001 | 255 | 390 |
| PurchasesBatch | 58 | 01072 | Vitamin E | 0001 | 10 | 9,500 |
| Productions | 106 | 03122 | Ex.Tox Liquid | 0001 | 80 | 75.31 |
| PRODUCTIONBATCH | 106 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 106 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 106 | 01020 | Formic Acid | 0001 | 8 | 350 |
| PRODUCTIONBATCH | 106 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 106 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 106 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 106 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| Productions | 106 | 03122 | Ex.Tox Liquid | 0001 | 80 | 75.31 |
| PACKING | 110 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 16 | 885.66 |
| PACKINGBATCH | 110 | 02014 | Plastic Can White 5 Liter | 0001 | 16 | 390.7 |
| PACKINGBATCH | 110 | 02267 | Label Ex.Tox Liquid  5Lit | 0001 | 24 | 40 |
| PACKINGBATCH | 110 | 03122 | Ex.Tox Liquid | 0001 | 80 | 75.31 |
| PACKINGBATCH | 110 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 233.71 |
| PACKING | 110 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 16 | 885.66 |
| Productions | 107 | 03120 | E.S 200 Liquid | 0001 | 60 | 55.59 |
| PRODUCTIONBATCH | 107 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 107 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 107 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 1 | 1,545.26 |
| PRODUCTIONBATCH | 107 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 107 | 03120 | E.S 200 Liquid | 0001 | 60 | 55.59 |
| PACKING | 111 | 00266 | E.S  200 liquid 5 Liter | 0001 | 12 | 807.09 |
| PACKINGBATCH | 111 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 390.7 |
| PACKINGBATCH | 111 | 02271 | Label E.S 200 5Lit | 0001 | 24 | 40 |
| PACKINGBATCH | 111 | 03120 | E.S 200 Liquid | 0001 | 60 | 55.59 |
| PACKINGBATCH | 111 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 233.71 |
| PACKING | 111 | 00266 | E.S  200 liquid 5 Liter | 0001 | 12 | 807.09 |
| Productions | 108 | 03003 | Calci-Phos-D | 0001 | 60 | 181.53 |
| PRODUCTIONBATCH | 108 | 01013 | Calcium Chloride | 0001 | 0 | 208.6 |
| PRODUCTIONBATCH | 108 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 108 | 01038 | Phosphoric Acid 85% | 0001 | 15 | 650 |
| PRODUCTIONBATCH | 108 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 108 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 108 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| PRODUCTIONBATCH | 108 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 108 | 03003 | Calci-Phos-D | 0001 | 60 | 181.53 |
| PACKING | 112 | 00049 | Calci-Phos-D 5 Lit | 0001 | 12 | 1,356.79 |
| PACKINGBATCH | 112 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 390.7 |
| PACKINGBATCH | 112 | 03003 | Calci-Phos-D | 0001 | 60 | 181.53 |
| PACKINGBATCH | 112 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 233.71 |
| PACKING | 112 | 00049 | Calci-Phos-D 5 Lit | 0001 | 12 | 1,356.79 |
| Productions | 109 | 03119 | Stable C 20 Liquid | 0001 | 160 | 98.91 |
| PRODUCTIONBATCH | 109 | 01004 | Citric Acid | 0001 | 2 | 400 |
| PRODUCTIONBATCH | 109 | 01044 | Sodium Bicarbonate | 0001 | 2 | 128.25 |
| PRODUCTIONBATCH | 109 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 421.7 |
| PRODUCTIONBATCH | 109 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 109 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 8 | 1,545.26 |
| PRODUCTIONBATCH | 109 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| Productions | 109 | 03119 | Stable C 20 Liquid | 0001 | 160 | 98.91 |
| PACKING | 113 | 00180 | Stable C 20 (5 Liter) | 0001 | 32 | 983.68 |
| PACKINGBATCH | 113 | 02014 | Plastic Can White 5 Liter | 0001 | 32 | 390.7 |
| PACKINGBATCH | 113 | 02272 | Label Stable C20  5Lit | 0001 | 32 | 40 |
| PACKINGBATCH | 113 | 03119 | Stable C 20 Liquid | 0001 | 160 | 98.91 |
| PACKINGBATCH | 113 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 233.71 |
| PACKING | 113 | 00180 | Stable C 20 (5 Liter) | 0001 | 32 | 983.68 |
| Productions | 110 | 03206 | Hepa Gold Oral Liquid | 0001 | 180 | 106.79 |
| PRODUCTIONBATCH | 110 | 01010 | Betaine | 0001 | 2 | 2,800 |
| PRODUCTIONBATCH | 110 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 110 | 01034 | Magnesium Sulphate | 0001 | 4 | 513.16 |
| PRODUCTIONBATCH | 110 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 110 | 01045 | Sorbitol Liquid 70% | 0001 | 9 | 421.7 |
| PRODUCTIONBATCH | 110 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| PRODUCTIONBATCH | 110 | 01184 | ARQ | 0001 | 10 | 366.67 |
| Productions | 110 | 03206 | Hepa Gold Oral Liquid | 0001 | 180 | 106.79 |
| PACKING | 114 | 00295 | Hepa Gold Oral Liquid 5 Lit | 0001 | 36 | 1,054.17 |
| PACKINGBATCH | 114 | 02014 | Plastic Can White 5 Liter | 0001 | 36 | 390.7 |
| PACKINGBATCH | 114 | 02350 | Label Hepa Gold Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PACKINGBATCH | 114 | 03206 | Hepa Gold Oral Liquid | 0001 | 180 | 106.79 |
| PACKINGBATCH | 114 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 9 | 233.71 |
| Productions | 111 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 343.81 |
| PRODUCTIONBATCH | 111 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 111 | 01010 | Betaine | 0001 | 5 | 2,800 |
| PRODUCTIONBATCH | 111 | 01011 | Choline Chloride | 0001 | 10 | 4,827.2 |
| PRODUCTIONBATCH | 111 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 111 | 01020 | Formic Acid | 0001 | 5 | 350 |
| PRODUCTIONBATCH | 111 | 01021 | Glacial Acetic Acid | 0001 | 5 | 399.62 |
| PRODUCTIONBATCH | 111 | 01046 | Silmyrin | 0001 | 7 | 13,130.73 |
| PRODUCTIONBATCH | 111 | 01058 | Xanthan Gum | 0001 | 2 | 1,468.44 |
| PRODUCTIONBATCH | 111 | 01184 | ARQ | 0001 | 10 | 366.67 |
| PACKING | 115 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 2,254.56 |
| PACKINGBATCH | 115 | 02014 | Plastic Can White 5 Liter | 0001 | 100 | 390.7 |
| PACKINGBATCH | 115 | 02026 | Label Toxi Lic 5 Liter | 0001 | 144 | 60 |
| PACKINGBATCH | 115 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 343.81 |
| PACKINGBATCH | 115 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 233.71 |
| PACKING | 115 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 2,254.56 |
| Productions | 112 | 03207 | Toxi Gold Forte Powder | 0001 | 275 | 13.46 |
| PRODUCTIONBATCH | 112 | 01003 | Bentonite | 0001 | 275 | 13.46 |
| Productions | 112 | 03207 | Toxi Gold Forte Powder | 0001 | 275 | 13.46 |
| PACKING | 116 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 11 | 644.25 |
| PACKINGBATCH | 116 | 02307 | Bag Bop Blue Colour | 0001 | 11 | 155 |
| PACKINGBATCH | 116 | 02351 | label Toxi Gold Forte Powder 25 kg | 0001 | 12 | 140 |
| PACKINGBATCH | 116 | 03207 | Toxi Gold Forte Powder | 0001 | 275 | 13.46 |
| PACKING | 116 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 11 | 644.25 |
| PurchasesBatch | 59 | 02014 | Plastic Can White 5 Liter | 0001 | 340 | 390 |
| PurchasesBatch | 60 | 01190 | PHOSPHORUS Powder 29% | 0001 | 18,400 | 11.5 |
| PurchasesBatch | 60 | 01015 | DCP (Calcium) | 0001 | 2,500 | 17 |
| PurchasesBatch | 61 | 02128 | White Can 25 Liter | 0001 | 150 | 1,066 |
| PurchasesBatch | 62 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 130 | 90 |
| Productions | 113 | 03002 | DCP Powder | 0001 | 5,000 | 11.73 |
| PRODUCTIONBATCH | 113 | 01190 | PHOSPHORUS Powder 29% | 0001 | 5,100 | 11.5 |
| PACKING | 117 | 00019 | DCP BOP 25kg | 0001 | 200 | 373.25 |
| PACKINGBATCH | 117 | 02034 | BAG BOP DCP 25 KG | 0001 | 200 | 80 |
| PACKINGBATCH | 117 | 03002 | DCP Powder | 0001 | 5,000 | 11.73 |
| Productions | 114 | 03113 | DCP-Lic Powder  (High) | 0001 | 5,000 | 11.62 |
| PRODUCTIONBATCH | 114 | 01190 | PHOSPHORUS Powder 29% | 0001 | 5,050 | 11.5 |
| PACKING | 118 | 00156 | DCP-Lic Powder 25 Kg (High) | 0001 | 200 | 290.38 |
| PACKINGBATCH | 118 | 03113 | DCP-Lic Powder  (High) | 0001 | 5,000 | 11.62 |
| Productions | 115 | 03163 | Calcium 72 | 0001 | 1,750 | 17.49 |
| PRODUCTIONBATCH | 115 | 01015 | DCP (Calcium) | 0001 | 1,800 | 17 |
| PACKING | 119 | 00231 | Calcium 72 25kg | 0001 | 70 | 517.14 |
| PACKINGBATCH | 119 | 02274 | Bag Calcium 72  25kg | 0001 | 70 | 80 |
| PACKINGBATCH | 119 | 03163 | Calcium 72 | 0001 | 1,750 | 17.49 |
| PACKING | 119 | 00231 | Calcium 72 25kg | 0001 | 70 | 517.14 |
| Productions | 116 | 03087 | Golden Premix Bop | 0001 | 550 | 19.91 |
| PRODUCTIONBATCH | 116 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 116 | 01013 | Calcium Chloride | 0001 | 0 | 208.6 |
| PRODUCTIONBATCH | 116 | 01016 | DCP (Dana) | 0001 | 440 | 10 |
| PRODUCTIONBATCH | 116 | 01042 | Starch | 0001 | 5 | 167.2 |
| PRODUCTIONBATCH | 116 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 116 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 116 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 116 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 116 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 116 | 03087 | Golden Premix Bop | 0001 | 550 | 19.91 |
| PACKING | 120 | 00125 | Golden Premix 25Kg | 0001 | 22 | 652.67 |
| PACKINGBATCH | 120 | 02307 | Bag Bop Blue Colour | 0001 | 22 | 155 |
| PACKINGBATCH | 120 | 03087 | Golden Premix Bop | 0001 | 550 | 19.91 |
| PACKING | 120 | 00125 | Golden Premix 25Kg | 0001 | 22 | 652.67 |
| Productions | 117 | 03182 | GrowMore Powder | 0001 | 125 | 20.33 |
| PRODUCTIONBATCH | 117 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 117 | 01013 | Calcium Chloride | 0001 | 0 | 208.6 |
| PRODUCTIONBATCH | 117 | 01016 | DCP (Dana) | 0001 | 100 | 10 |
| PRODUCTIONBATCH | 117 | 01042 | Starch | 0001 | 1 | 167.2 |
| PRODUCTIONBATCH | 117 | 01043 | Sodium Chloride | 0001 | 17 | 13.75 |
| PRODUCTIONBATCH | 117 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 117 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 117 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 117 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 117 | 03182 | GrowMore Powder | 0001 | 125 | 20.33 |
| PACKING | 121 | 00258 | GrowMore 25KG | 0001 | 5 | 508.17 |
| PACKINGBATCH | 121 | 03182 | GrowMore Powder | 0001 | 125 | 20.33 |
| PACKING | 121 | 00258 | GrowMore 25KG | 0001 | 5 | 508.17 |
| Productions | 118 | 03162 | P.H Cure Liquid | 0001 | 600 | 52.13 |
| PRODUCTIONBATCH | 118 | 01009 | Copper Sulphate | 0001 | 1 | 2,063.66 |
| PRODUCTIONBATCH | 118 | 01020 | Formic Acid | 0001 | 60 | 350 |
| PRODUCTIONBATCH | 118 | 01021 | Glacial Acetic Acid | 0001 | 15 | 399.62 |
| PRODUCTIONBATCH | 118 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PACKING | 122 | 00228 | P.H Cure 25 Liter | 0001 | 24 | 2,466.79 |
| PACKINGBATCH | 122 | 02128 | White Can 25 Liter | 0001 | 24 | 1,066 |
| PACKINGBATCH | 122 | 02268 | Label P.H Cure 25Liter | 0001 | 26 | 90 |
| PACKINGBATCH | 122 | 03162 | P.H Cure Liquid | 0001 | 600 | 52.13 |
| PACKING | 122 | 00228 | P.H Cure 25 Liter | 0001 | 24 | 2,466.79 |
| PurchasesBatch | 63 | 02128 | White Can 25 Liter | 0001 | 224 | 1,066 |
| PurchasesBatch | 64 | 02332 | Label Task 1 Oral Liquid  5 Liter | 0001 | 80 | 80 |
| PurchasesBatch | 64 | 02342 | Label Frost Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PurchasesBatch | 64 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PurchasesBatch | 64 | 00374 | Renu Guard Bucket Label | 0001 | 20 | 75 |
| PurchasesBatch | 65 | 02097 | Bottle Round liter | 0001 | 180 | 230 |
| Productions | 119 | 03025 | Kimchi Sal Oral Liquid | 0001 | 1,156 | 54.15 |
| PRODUCTIONBATCH | 119 | 01020 | Formic Acid | 0001 | 20 | 350 |
| PRODUCTIONBATCH | 119 | 01021 | Glacial Acetic Acid | 0001 | 10 | 399.62 |
| PRODUCTIONBATCH | 119 | 01028 | Lactic Acid | 0001 | 10 | 1,650 |
| PRODUCTIONBATCH | 119 | 01038 | Phosphoric Acid 85% | 0001 | 15 | 650 |
| PRODUCTIONBATCH | 119 | 01045 | Sorbitol Liquid 70% | 0001 | 40 | 421.7 |
| PRODUCTIONBATCH | 119 | 01058 | Xanthan Gum | 0001 | 5 | 1,468.44 |
| Productions | 119 | 03025 | Kimchi Sal Oral Liquid | 0001 | 1,156 | 54.15 |
| PACKING | 123 | 00184 | Kimchi Sal Liquid 1 Liter | 0001 | 156 | 316.04 |
| PACKINGBATCH | 123 | 02097 | Bottle Round liter | 0001 | 156 | 230 |
| PACKINGBATCH | 123 | 02399 | Label Kimchi Sal Oral Liquid 1 Lit | 0001 | 110 | 20 |
| PACKINGBATCH | 123 | 03025 | Kimchi Sal Oral Liquid | 0001 | 156 | 54.15 |
| PACKINGBATCH | 123 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 15 | 185 |
| PACKING | 123 | 00184 | Kimchi Sal Liquid 1 Liter | 0001 | 156 | 316.04 |
| PACKING | 124 | 00053 | Kimchi sal Oral Liquid 5 Lit | 0001 | 200 | 748.74 |
| PACKINGBATCH | 124 | 02014 | Plastic Can White 5 Liter | 0001 | 200 | 390.21 |
| PACKINGBATCH | 124 | 02106 | Label Kimchi Sal 5 Lit | 0001 | 270 | 20 |
| PACKINGBATCH | 124 | 03025 | Kimchi Sal Oral Liquid | 0001 | 1,000 | 54.15 |
| PACKINGBATCH | 124 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 52 | 233.71 |
| PACKING | 124 | 00053 | Kimchi sal Oral Liquid 5 Lit | 0001 | 200 | 748.74 |
| Productions | 120 | 03089 | RespiGuard Liquid | 0001 | 30 | 114.97 |
| PRODUCTIONBATCH | 120 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 120 | 01031 | Menthol Crystal | 0001 | 0 | 6,500 |
| PRODUCTIONBATCH | 120 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 120 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 120 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 120 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 120 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 120 | 03089 | RespiGuard Liquid | 0001 | 30 | 114.97 |
| PACKING | 125 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 6 | 1,062.95 |
| PACKINGBATCH | 125 | 02014 | Plastic Can White 5 Liter | 0001 | 6 | 390.21 |
| PACKINGBATCH | 125 | 02131 | Label RespiGuard 5 Liter | 0001 | 6 | 20 |
| PACKINGBATCH | 125 | 03089 | RespiGuard Liquid | 0001 | 30 | 114.97 |
| PACKINGBATCH | 125 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 233.71 |
| PACKING | 125 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 6 | 1,062.95 |
| OpeningBatch | 108 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 66 | 5,000 |
| Productions | 121 | 03215 | BOP E 50 Oral Liquid | 0001 | 220 | 563.95 |
| PRODUCTIONBATCH | 121 | 01045 | Sorbitol Liquid 70% | 0001 | 55 | 421.7 |
| PRODUCTIONBATCH | 121 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| PRODUCTIONBATCH | 121 | 01072 | Vitamin E | 0001 | 3 | 9,500 |
| PRODUCTIONBATCH | 121 | 01189 | Glycerine | 0001 | 80 | 807.8 |
| PRODUCTIONBATCH | 121 | 01201 | I.P.A | 0001 | 9 | 704.96 |
| Productions | 121 | 03215 | BOP E 50 Oral Liquid | 0001 | 220 | 563.95 |
| PACKING | 126 | 00307 | BOP E 50 Oral Liquid 5 Lit | 0001 | 44 | 3,331.86 |
| PACKINGBATCH | 126 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 390.21 |
| PACKINGBATCH | 126 | 02364 | Label BOP E 50 Oral Liquid 5 Lit | 0001 | 64 | 40 |
| PACKINGBATCH | 126 | 03215 | BOP E 50 Oral Liquid | 0001 | 220 | 563.95 |
| PACKINGBATCH | 126 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 233.71 |
| PACKING | 126 | 00307 | BOP E 50 Oral Liquid 5 Lit | 0001 | 44 | 3,331.86 |
| Productions | 122 | 03104 | BOP PH 5 Liquid | 0001 | 3,250 | 69.92 |
| PRODUCTIONBATCH | 122 | 01009 | Copper Sulphate | 0001 | 15 | 2,063.66 |
| PRODUCTIONBATCH | 122 | 01020 | Formic Acid | 0001 | 500 | 350 |
| PRODUCTIONBATCH | 122 | 01021 | Glacial Acetic Acid | 0001 | 25 | 399.62 |
| PRODUCTIONBATCH | 122 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 122 | 01028 | Lactic Acid | 0001 | 5 | 1,650 |
| PRODUCTIONBATCH | 122 | 01034 | Magnesium Sulphate | 0001 | 5 | 513.16 |
| PACKING | 127 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 130 | 2,903.97 |
| PACKINGBATCH | 127 | 02128 | White Can 25 Liter | 0001 | 130 | 1,066 |
| PACKINGBATCH | 127 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 130 | 90 |
| PACKINGBATCH | 127 | 03104 | BOP PH 5 Liquid | 0001 | 3,250 | 69.92 |
| PACKING | 127 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 130 | 2,903.97 |
| Productions | 123 | 03245 | JELITO Liquid | 0001 | 1,350 | 79.49 |
| PRODUCTIONBATCH | 123 | 01009 | Copper Sulphate | 0001 | 4 | 2,063.66 |
| PRODUCTIONBATCH | 123 | 01020 | Formic Acid | 0001 | 250 | 350 |
| PRODUCTIONBATCH | 123 | 01021 | Glacial Acetic Acid | 0001 | 4 | 399.62 |
| PRODUCTIONBATCH | 123 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 123 | 01038 | Phosphoric Acid 85% | 0001 | 8 | 650 |
| PRODUCTIONBATCH | 123 | 01186 | HCL | 0001 | 60 | 36.67 |
| PRODUCTIONBATCH | 123 | 01187 | Sodium Metaby Sulphate | 0001 | 4 | 200 |
| PACKING | 128 | 00344 | JELITO Liquid 25 Lit | 0001 | 54 | 3,053.34 |
| PACKINGBATCH | 128 | 02128 | White Can 25 Liter | 0001 | 54 | 1,066 |
| PACKINGBATCH | 128 | 03245 | JELITO Liquid | 0001 | 1,350 | 79.49 |
| PACKING | 128 | 00344 | JELITO Liquid 25 Lit | 0001 | 54 | 3,053.34 |
| Productions | 124 | 03098 | Bentox Powder | 0001 | 250 | 13.46 |
| PRODUCTIONBATCH | 124 | 01003 | Bentonite | 0001 | 250 | 13.46 |
| Productions | 124 | 03098 | Bentox Powder | 0001 | 250 | 13.46 |
| PACKING | 129 | 00139 | Bentox Powder 25 kg | 0001 | 10 | 659.53 |
| PACKINGBATCH | 129 | 02148 | Label Bentox Powder 25kg | 0001 | 12 | 140 |
| PACKINGBATCH | 129 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 129 | 03098 | Bentox Powder | 0001 | 250 | 13.46 |
| PACKING | 129 | 00139 | Bentox Powder 25 kg | 0001 | 10 | 659.53 |
| PurchasesBatch | 66 | 01047 | Sodium Sulphate | 0001 | 150 | 80 |
| PurchasesBatch | 66 | 01002 | Ammonium chloride | 0001 | 25 | 200 |
| Productions | 125 | 03194 | MLC 100  Oral Liquid | 0001 | 260 | 91.6 |
| PRODUCTIONBATCH | 125 | 01009 | Copper Sulphate | 0001 | 3 | 2,063.66 |
| PRODUCTIONBATCH | 125 | 01010 | Betaine | 0001 | 2 | 2,800 |
| PRODUCTIONBATCH | 125 | 01020 | Formic Acid | 0001 | 2 | 350 |
| PRODUCTIONBATCH | 125 | 01021 | Glacial Acetic Acid | 0001 | 1 | 399.62 |
| PRODUCTIONBATCH | 125 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 125 | 01045 | Sorbitol Liquid 70% | 0001 | 5 | 421.7 |
| PRODUCTIONBATCH | 125 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 125 | 01105 | Sodium Citrate | 0001 | 0 | 398.3 |
| PRODUCTIONBATCH | 125 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| PRODUCTIONBATCH | 125 | 01184 | ARQ | 0001 | 4 | 366.67 |
| Productions | 125 | 03194 | MLC 100  Oral Liquid | 0001 | 260 | 91.6 |
| PACKING | 130 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 52 | 1,034.19 |
| PACKINGBATCH | 130 | 02014 | Plastic Can White 5 Liter | 0001 | 52 | 390.21 |
| PACKINGBATCH | 130 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PACKINGBATCH | 130 | 03194 | MLC 100  Oral Liquid | 0001 | 260 | 91.6 |
| PACKINGBATCH | 130 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 14 | 233.71 |
| PACKING | 130 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 52 | 1,034.19 |
| Productions | 126 | 03191 | Task 1 Oral Liquid | 0001 | 260 | 47.08 |
| PRODUCTIONBATCH | 126 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 126 | 01010 | Betaine | 0001 | 2 | 2,800 |
| PRODUCTIONBATCH | 126 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 126 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 126 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.62 |
| PRODUCTIONBATCH | 126 | 01045 | Sorbitol Liquid 70% | 0001 | 5 | 421.7 |
| PRODUCTIONBATCH | 126 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 126 | 01105 | Sodium Citrate | 0001 | 0 | 398.3 |
| PRODUCTIONBATCH | 126 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| Productions | 126 | 03191 | Task 1 Oral Liquid | 0001 | 260 | 47.08 |
| PACKING | 131 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 52 | 811.62 |
| PACKINGBATCH | 131 | 02014 | Plastic Can White 5 Liter | 0001 | 52 | 390.21 |
| PACKINGBATCH | 131 | 02332 | Label Task 1 Oral Liquid  5 Liter | 0001 | 80 | 80 |
| PACKINGBATCH | 131 | 03191 | Task 1 Oral Liquid | 0001 | 260 | 47.08 |
| PACKINGBATCH | 131 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 14 | 233.71 |
| PACKING | 131 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 52 | 811.62 |
| Productions | 127 | 03266 | Vital Frame Oral Liquid | 0001 | 100 | 18.7 |
| PRODUCTIONBATCH | 127 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 127 | 01013 | Calcium Chloride | 0001 | 0 | 208.6 |
| PRODUCTIONBATCH | 127 | 01034 | Magnesium Sulphate | 0001 | 0 | 513.16 |
| PRODUCTIONBATCH | 127 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 127 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 127 | 03266 | Vital Frame Oral Liquid | 0001 | 100 | 18.7 |
| PACKING | 132 | 00372 | Vital Frame Oral Liquid 5 Lit | 0001 | 20 | 646.13 |
| PACKINGBATCH | 132 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 390.21 |
| PACKINGBATCH | 132 | 02436 | Label Vital Frame Oral Liquid 5 Lit | 0001 | 52 | 40 |
| PACKINGBATCH | 132 | 03266 | Vital Frame Oral Liquid | 0001 | 100 | 18.7 |
| PACKINGBATCH | 132 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 233.71 |
| PACKING | 132 | 00372 | Vital Frame Oral Liquid 5 Lit | 0001 | 20 | 646.13 |
| Productions | 128 | 03267 | MLC 360 Oral Liquid | 0001 | 125 | 126.72 |
| PRODUCTIONBATCH | 128 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 128 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 128 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 128 | 01038 | Phosphoric Acid 85% | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 128 | 01045 | Sorbitol Liquid 70% | 0001 | 12 | 421.7 |
| PRODUCTIONBATCH | 128 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 128 | 03267 | MLC 360 Oral Liquid | 0001 | 125 | 126.72 |
| PACKING | 133 | 00373 | MLC 360 Oral Liquid 25 Lit | 0001 | 5 | 4,341.96 |
| PACKINGBATCH | 133 | 02128 | White Can 25 Liter | 0001 | 5 | 1,066 |
| PACKINGBATCH | 133 | 02437 | Label MLC 360 Oral Liquid 25 Lit | 0001 | 6 | 90 |
| PACKINGBATCH | 133 | 03267 | MLC 360 Oral Liquid | 0001 | 125 | 126.72 |
| PACKING | 133 | 00373 | MLC 360 Oral Liquid 25 Lit | 0001 | 5 | 4,341.96 |
| SALESBATCH | 23 | 00194 | E.C Gold Oral Liquid  5 Liter | 0001 | 48 | 714.1 |
| SALESBATCH | 24 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 40 | 864.73 |
| SALESBATCH | 24 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 20 | 1,409.98 |
| SALESBATCH | 24 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 32 | 1,052.11 |
| SALESBATCH | 24 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 32 | 1,845.29 |
| SALESBATCH | 24 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 100 | 2,626.86 |
| SALESBATCH | 25 | 00022 | Magnet BOP 25kg | 0001 | 10 | 491.53 |
| SALESBATCH | 26 | 00016 | Growth Promoter 25kg | 0001 | 200 | 584.06 |
| SALESBATCH | 26 | 00231 | Calcium 72 25kg | 0001 | 100 | 519.83 |
| SALESBATCH | 26 | 00212 | Microgold-Bop 25 kg | 0001 | 49 | 1,462.34 |
| SALESBATCH | 26 | 00220 | Rumicid powder 25kg | 0001 | 50 | 610.27 |
| SALESBATCH | 26 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 270.45 |
| SALESBATCH | 26 | 00032 | Calci-Phos-D 1000ml | 0001 | 180 | 226.29 |
| SALESBATCH | 26 | 00010 | Calci-Phos-D100ML | 0001 | 2,000 | 27.38 |
| SALESBATCH | 26 | 00259 | Garliment-Plus BOP  30ML | 0001 | 2,400 | 24.19 |
| SALESBATCH | 26 | 00030 | Coolper 100gm | 0001 | 750 | 32.9 |
| SALESBATCH | 26 | 00257 | Heaatic-Optimizer 100ML | 0001 | 1,000 | 28.78 |
| SALESBATCH | 26 | 00008 | Scour Guard100ML | 0001 | 1,077 | 34.37 |
| SALESBATCH | 26 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 2,000 | 25.26 |
| SALESBATCH | 26 | 00013 | Kirzan BOP 100ml | 0001 | 381 | 26.19 |
| SALESBATCH | 27 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 270.45 |
| SALESBATCH | 28 | 00369 | Febro Meon Spray 120 ML | 0001 | 192 | 270.45 |
| SALESBATCH | 29 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 270.45 |
| SALESBATCH | 30 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 270.45 |
| SALESBATCH | 31 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 24 | 1,138.75 |
| SALESBATCH | 31 | 00226 | O-D Plus Liquid 1lit | 0001 | 24 | 608.1 |
| SALESBATCH | 31 | 00260 | Pro-Tox Liquid 5L | 0001 | 16 | 802.79 |
| SALESBATCH | 31 | 00330 | LivGuard Oral Liquid 5 Lit | 0001 | 32 | 993.03 |
| SALESBATCH | 32 | 00220 | Rumicid powder 25kg | 0001 | 40 | 610.27 |
| SALESBATCH | 32 | 00022 | Magnet BOP 25kg | 0001 | 20 | 491.53 |
| SALESBATCH | 33 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,651.02 |
| SALESBATCH | 34 | 00318 | IG Max Oral Liquid 1 Liter | 0001 | 240 | 266.7 |
| SALESBATCH | 35 | 00265 | GrowMore 1Kg | 0001 | 960 | 59.16 |
| SALESBATCH | 35 | 00008 | Scour Guard100ML | 0001 | 400 | 34.37 |
| SALESBATCH | 36 | 00369 | Febro Meon Spray 120 ML | 0001 | 384 | 270.45 |
| SALESBATCH | 37 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 80 | 1,029.42 |
| SALESBATCH | 37 | 00370 | ElectroMune C Oral Liquid 1 Lit | 0001 | 120 | 164.04 |
| SALESBATCH | 38 | 00086 | Oripulmo Liquid 1 Lit | 0001 | 240 | 428.25 |
| OpeningBatch | 111 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 300 |
| SALESBATCH | 39 | 00369 | Febro Meon Spray 120 ML | 0001 | 384 | 285.23 |
| SALESBATCH | 39 | 00363 | PhytoFat Gold 25 Kg | 0001 | 4 | 14,000 |
| SALESBATCH | 40 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 285.23 |
| SALESBATCH | 41 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 25.26 |
| SALESBATCH | 41 | 00259 | Garliment-Plus BOP  30ML | 0001 | 1,440 | 24.19 |
| SALESBATCH | 41 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 396.74 |
| SALESBATCH | 41 | 00020 | Magnet BOP 1kg | 0001 | 100 | 54.26 |
| SALESBATCH | 41 | 00016 | Growth Promoter 25kg | 0001 | 30 | 584.06 |
| SALESBATCH | 41 | 00258 | GrowMore 25KG | 0001 | 10 | 447.28 |
| SALESBATCH | 41 | 00030 | Coolper 100gm | 0001 | 250 | 32.9 |
| SALESBATCH | 41 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 226.29 |
| SALESBATCH | 41 | 00010 | Calci-Phos-D100ML | 0001 | 200 | 27.38 |
| SALESBATCH | 41 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 285.23 |
| SALESBATCH | 42 | 00243 | Bop dairy Mineral 25 KG | 0001 | 20 | 519.01 |
| SALESBATCH | 43 | 00016 | Growth Promoter 25kg | 0001 | 20 | 584.06 |
| SALESBATCH | 43 | 00220 | Rumicid powder 25kg | 0001 | 10 | 610.27 |
| SALESBATCH | 44 | 00259 | Garliment-Plus BOP  30ML | 0001 | 1,144 | 24.19 |
| SALESBATCH | 45 | 00315 | Bop Buffer Plus 25 kg | 0001 | 100 | 734.02 |
| SALESBATCH | 46 | 00138 | Bio Ambrox 5Lit | 0001 | 80 | 821.24 |
| SALESBATCH | 46 | 00189 | RESPIFIT Liquid 5 Liter | 0001 | 56 | 1,183.56 |
| SALESBATCH | 47 | 00208 | Profen C+ Powder 1Kg | 0001 | 360 | 275.23 |
| SALESBATCH | 48 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 1,021.53 |
| SALESBATCH | 48 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 247.23 |
| SALESBATCH | 48 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 0001 | 20 | 1,928.84 |
| SALESBATCH | 49 | 00231 | Calcium 72 25kg | 0001 | 2 | 519.83 |
| SALESBATCH | 49 | 00040 | Super Yeast Powder 25kg | 0001 | 2 | 744.03 |
| SALESBATCH | 50 | 00177 | O-D Plus Oral Liquid 5 Liter | 0001 | 92 | 814.29 |
| SALESBATCH | 50 | 00136 | Super Adek Liquid 5 Lit | 0001 | 44 | 840.59 |
| SALESBATCH | 50 | 00144 | BOP DCAL Liquid 5 Lit | 0001 | 84 | 977.63 |
| SALESBATCH | 50 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 44 | 1,053.26 |
| SALESBATCH | 50 | 00135 | Super Copper Liquid 5 Lit | 0001 | 128 | 2,080.89 |
| SALESBATCH | 50 | 00130 | MicroTox Liquid 5 Liter | 0001 | 4 | 1,299.23 |
| SALESBATCH | 51 | 00130 | MicroTox Liquid 5 Liter | 0001 | 116 | 1,299.23 |
| SALESBATCH | 51 | 00132 | Immune Forte Liquid 5 Lit | 0001 | 59 | 901.52 |
| SALESBATCH | 51 | 00145 | L.G Mune Liquid 5 Liter | 0001 | 164 | 1,156.15 |
| SALESBATCH | 51 | 00133 | Ferovit Plus Liquid 5 Lit | 0001 | 60 | 1,869.74 |
| SALESBATCH | 51 | 00349 | Aspolite C Oral Liquid 5 Lit | 0001 | 80 | 1,094.71 |
| SALESBATCH | 51 | 00131 | HepaLiv Liquid 5 Liter | 0001 | 160 | 1,079.05 |
| SALESBATCH | 51 | 00260 | Pro-Tox Liquid 5L | 0001 | 92 | 802.79 |
| SALESBATCH | 51 | 00314 | Phyto-Phos Oral Liquid 5 Lit | 0001 | 40 | 1,224.58 |
| SALESBATCH | 52 | 00363 | PhytoFat Gold 25 Kg | 0001 | 10 | 14,000 |
| SALESBATCH | 53 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 16 | 885.66 |
| SALESBATCH | 53 | 00266 | E.S  200 liquid 5 Liter | 0001 | 12 | 807.09 |
| SALESBATCH | 54 | 00049 | Calci-Phos-D 5 Lit | 0001 | 12 | 1,356.79 |
| SALESBATCH | 55 | 00295 | Hepa Gold Oral Liquid 5 Lit | 0001 | 36 | 1,054.17 |
| SALESBATCH | 55 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 11 | 644.25 |
| SALESBATCH | 56 | 00180 | Stable C 20 (5 Liter) | 0001 | 32 | 983.68 |
| SALESBATCH | 57 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 2,254.56 |
| SALESBATCH | 58 | 00363 | PhytoFat Gold 25 Kg | 0001 | 10 | 14,000 |
| SALESBATCH | 59 | 00019 | DCP BOP 25kg | 0001 | 200 | 373.25 |
| SALESBATCH | 60 | 00156 | DCP-Lic Powder 25 Kg (High) | 0001 | 200 | 290.38 |
| SALESBATCH | 61 | 00231 | Calcium 72 25kg | 0001 | 50 | 519.83 |
| SALESBATCH | 62 | 00125 | Golden Premix 25Kg | 0001 | 22 | 652.67 |
| SALESBATCH | 63 | 00231 | Calcium 72 25kg | 0001 | 20 | 519.83 |
| SALESBATCH | 63 | 00258 | GrowMore 25KG | 0001 | 5 | 447.28 |
| SALESBATCH | 64 | 00228 | P.H Cure 25 Liter | 0001 | 24 | 2,466.79 |
| SALESBATCH | 65 | 00053 | Kimchi sal Oral Liquid 5 Lit | 0001 | 200 | 748.74 |
| SALESBATCH | 65 | 00184 | Kimchi Sal Liquid 1 Liter | 0001 | 156 | 316.04 |
| SALESBATCH | 65 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 6 | 1,053.26 |
| SALESBATCH | 65 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 42 | 5,000 |
| SALESBATCH | 65 | 00307 | BOP E 50 Oral Liquid 5 Lit | 0001 | 44 | 3,331.86 |
| SALESBATCH | 65 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 130 | 2,903.97 |
| SALESBATCH | 65 | 00344 | JELITO Liquid 25 Lit | 0001 | 54 | 3,053.34 |
| SALESBATCH | 66 | 00139 | Bentox Powder 25 kg | 0001 | 10 | 659.53 |
| SALESBATCH | 67 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 52 | 1,052.11 |
| SALESBATCH | 67 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 52 | 864.73 |
| SALESBATCH | 67 | 00372 | Vital Frame Oral Liquid 5 Lit | 0001 | 20 | 646.13 |
| SALESBATCH | 67 | 00373 | MLC 360 Oral Liquid 25 Lit | 0001 | 5 | 4,341.96 |
| Productions | 129 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 140.16 |
| PRODUCTIONBATCH | 129 | 01002 | Ammonium chloride | 0001 | 35 | 217.36 |
| PRODUCTIONBATCH | 129 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 129 | 01047 | Sodium Sulphate | 0001 | 135 | 80 |
| PRODUCTIONBATCH | 129 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 1 | 1,545.26 |
| PRODUCTIONBATCH | 129 | 01105 | Sodium Citrate | 0001 | 0 | 398.3 |
| Productions | 129 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 140.16 |
| PACKING | 134 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 255.5 |
| PACKINGBATCH | 134 | 02341 | Packet Reno Gurd Flush Oral Powder 1 kg | 0001 | 160 | 30 |
| PACKINGBATCH | 134 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 140.16 |
| PACKINGBATCH | 134 | 00374 | Renu Guard Bucket Label | 0001 | 20 | 75 |
| PACKINGBATCH | 134 | 02140 | Bucket Large | 0001 | 10 | 1,100 |
| PACKING | 134 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 255.5 |
| Productions | 130 | 03198 | Frost Oral Liquid | 0001 | 300 | 14.07 |
| PRODUCTIONBATCH | 130 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 130 | 01034 | Magnesium Sulphate | 0001 | 0 | 513.16 |
| PRODUCTIONBATCH | 130 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,545.26 |
| PRODUCTIONBATCH | 130 | 01058 | Xanthan Gum | 0001 | 1 | 1,468.44 |
| PRODUCTIONBATCH | 130 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| PRODUCTIONBATCH | 130 | 01105 | Sodium Citrate | 0001 | 0 | 398.3 |
| Productions | 130 | 03198 | Frost Oral Liquid | 0001 | 300 | 14.07 |
| PACKING | 135 | 00286 | Frost Oral Liquid 5 liter | 0001 | 60 | 625.64 |
| PACKINGBATCH | 135 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 390.21 |
| PACKINGBATCH | 135 | 02342 | Label Frost Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PACKINGBATCH | 135 | 03198 | Frost Oral Liquid | 0001 | 300 | 14.07 |
| PACKINGBATCH | 135 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 15 | 233.71 |
| PACKING | 135 | 00286 | Frost Oral Liquid 5 liter | 0001 | 60 | 625.64 |
| SALESBATCH | 68 | 00363 | PhytoFat Gold 25 Kg | 0001 | 7 | 14,000 |
| SALESBATCH | 69 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 255.5 |
| SALESBATCH | 69 | 00286 | Frost Oral Liquid 5 liter | 0001 | 60 | 625.64 |
| PurchasesBatch | 51 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| PurchasesBatch | 13 | 01189 | Glycerine | 0001 | 30 | 586.67 |
| PurchasesBatch | 67 | 01003 | Bentonite | 0001 | 10,000 | 13 |
| PurchasesBatch | 68 | 01033 | Molasses | 0001 | 2,096 | 50 |
| PurchasesBatch | 68 | 01059 | Wheat Bran | 0001 | 990 | 72.33 |
| Productions | 131 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 11.65 |
| PRODUCTIONBATCH | 131 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 131 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.62 |
| PRODUCTIONBATCH | 131 | 01041 | Sodium Benzoate | 0001 | 0 | 649.76 |
| PRODUCTIONBATCH | 131 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128.25 |
| PRODUCTIONBATCH | 131 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| Productions | 131 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 11.65 |
| PACKING | 136 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 24.89 |
| PACKINGBATCH | 136 | 02010 | Bottle Pet Amber 100ML | 0001 | 200 | 9.12 |
| PACKINGBATCH | 136 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 210 | 12 |
| PACKINGBATCH | 136 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 11.65 |
| PACKINGBATCH | 136 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 2 | 199.99 |
| PACKING | 136 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 24.89 |
| Productions | 132 | 03003 | Calci-Phos-D | 0001 | 60 | 34.71 |
| PRODUCTIONBATCH | 132 | 01013 | Calcium Chloride | 0001 | 0 | 208.6 |
| PRODUCTIONBATCH | 132 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 132 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 132 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 132 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 132 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| PRODUCTIONBATCH | 132 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 132 | 03003 | Calci-Phos-D | 0001 | 60 | 34.71 |
| PACKING | 137 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 142.13 |
| PACKINGBATCH | 137 | 02097 | Bottle Round liter | 0001 | 24 | 230 |
| PACKINGBATCH | 137 | 03003 | Calci-Phos-D | 0001 | 60 | 34.71 |
| PACKINGBATCH | 137 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 5 | 185 |
| PACKING | 137 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 142.13 |
| Productions | 133 | 03014 | Magnet BOP Oral Powder | 0001 | 2,500 | 13.48 |
| PRODUCTIONBATCH | 133 | 01003 | Bentonite | 0001 | 2,550 | 13.22 |
| PACKING | 138 | 00022 | Magnet BOP 25kg | 0001 | 100 | 492.08 |
| PACKINGBATCH | 138 | 02033 | BAG Magnet 25 KG | 0001 | 100 | 155 |
| PACKINGBATCH | 138 | 03014 | Magnet BOP Oral Powder | 0001 | 2,500 | 13.48 |
| PurchasesBatch | 69 | 01190 | PHOSPHORUS Powder 29% | 0001 | 18,400 | 11.5 |
| PurchasesBatch | 70 | 01015 | DCP (Calcium) | 0001 | 1,600 | 17 |
| PurchasesBatch | 71 | 01059 | Wheat Bran | 0001 | 990 | 72.33 |
| PurchasesBatch | 71 | 01007 | CSL | 0001 | 1,500 | 35 |
| Productions | 134 | 03134 | DCP Powder 29 % | 0001 | 1,250 | 11.96 |
| PRODUCTIONBATCH | 134 | 01190 | PHOSPHORUS Powder 29% | 0001 | 1,300 | 11.5 |
| PACKING | 139 | 00019 | DCP BOP 25kg | 0001 | 50 | 379 |
| PACKINGBATCH | 139 | 02034 | BAG BOP DCP 25 KG | 0001 | 50 | 80 |
| PACKINGBATCH | 139 | 03134 | DCP Powder 29 % | 0001 | 1,250 | 11.96 |
| Productions | 135 | 03019 | Super Yeast Powder | 0001 | 50 | 23.12 |
| PRODUCTIONBATCH | 135 | 01003 | Bentonite | 0001 | 50 | 13.22 |
| PRODUCTIONBATCH | 135 | 01033 | Molasses | 0001 | 5 | 50 |
| PRODUCTIONBATCH | 135 | 01007 | CSL | 0001 | 7 | 35 |
| PACKING | 140 | 00040 | Super Yeast Powder 25kg | 0001 | 2 | 772.98 |
| PACKINGBATCH | 140 | 02042 | Label Super Yeast 25 KG | 0001 | 2 | 40 |
| PACKINGBATCH | 140 | 02213 | Bag Bop Red Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 140 | 03019 | Super Yeast Powder | 0001 | 50 | 23.12 |
| PurchasesBatch | 72 | 02351 | label Toxi Gold Forte Powder 25 kg | 0001 | 30 | 140 |
| PurchasesBatch | 72 | 02439 | Label Leo Flush Oral Liquid 5 Lit | 0001 | 32 | 40 |
| PurchasesBatch | 72 | 02268 | Label P.H Cure 25Liter | 0001 | 22 | 90 |
| PurchasesBatch | 72 | 02348 | Label COPPER Gold Oral Liquid 5 Lit | 0001 | 40 | 40 |
| PurchasesBatch | 72 | 02220 | Label Eggcelent Liquid 5 Litter | 0001 | 40 | 40 |
| PurchasesBatch | 72 | 02394 | Label Veto Respi Oral Liquid Oil.B 5 Lit | 0001 | 80 | 40 |
| PurchasesBatch | 72 | 02395 | Label Toxin Pro Oral Liquid 5 Lit | 0001 | 80 | 40 |
| PurchasesBatch | 72 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 64 | 40 |
| PurchasesBatch | 72 | 02271 | Label E.S 200 5Lit | 0001 | 32 | 40 |
| PurchasesBatch | 72 | 02237 | Label Bio Adeck Liquid 5Lit | 0001 | 64 | 40 |
| PurchasesBatch | 73 | 02014 | Plastic Can White 5 Liter | 0001 | 340 | 440 |
| PurchasesBatch | 73 | 02097 | Bottle Round liter | 0001 | 600 | 230 |
| Productions | 136 | 03269 | Leo Flush Oral Liquid | 0001 | 120 | 120.5 |
| PRODUCTIONBATCH | 136 | 01002 | Ammonium chloride | 0001 | 20 | 265.4 |
| PRODUCTIONBATCH | 136 | 01034 | Magnesium Sulphate | 0001 | 3 | 513.16 |
| PRODUCTIONBATCH | 136 | 01044 | Sodium Bicarbonate | 0001 | 3 | 128.25 |
| PRODUCTIONBATCH | 136 | 01045 | Sorbitol Liquid 70% | 0001 | 6 | 421.7 |
| PRODUCTIONBATCH | 136 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,545.26 |
| PRODUCTIONBATCH | 136 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| Productions | 136 | 03269 | Leo Flush Oral Liquid | 0001 | 120 | 120.5 |
| PACKING | 141 | 00376 | Leo Flush Oral Liquid 5 Lit | 0001 | 24 | 1,148.12 |
| PACKINGBATCH | 141 | 02014 | Plastic Can White 5 Liter | 0001 | 24 | 433.84 |
| PACKINGBATCH | 141 | 02439 | Label Leo Flush Oral Liquid 5 Lit | 0001 | 32 | 40 |
| PACKINGBATCH | 141 | 03269 | Leo Flush Oral Liquid | 0001 | 120 | 120.5 |
| PACKINGBATCH | 141 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 233.71 |
| PACKING | 141 | 00376 | Leo Flush Oral Liquid 5 Lit | 0001 | 24 | 1,148.12 |
| Productions | 137 | 03142 | Eggcelent liquid | 0001 | 100 | 123.21 |
| PRODUCTIONBATCH | 137 | 01009 | Copper Sulphate | 0001 | 0 | 2,063.66 |
| PRODUCTIONBATCH | 137 | 01013 | Calcium Chloride | 0001 | 2 | 208.6 |
| PRODUCTIONBATCH | 137 | 01038 | Phosphoric Acid 85% | 0001 | 15 | 650 |
| PRODUCTIONBATCH | 137 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 137 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 137 | 01104 | Lysine | 0001 | 0 | 1,100 |
| Productions | 137 | 03142 | Eggcelent liquid | 0001 | 100 | 123.21 |
| PACKING | 142 | 00197 | Eggcelent liquid 5 Liter | 0001 | 20 | 1,200 |
| PACKINGBATCH | 142 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 433.84 |
| PACKINGBATCH | 142 | 02220 | Label Eggcelent Liquid 5 Litter | 0001 | 40 | 40 |
| PACKINGBATCH | 142 | 03142 | Eggcelent liquid | 0001 | 100 | 123.21 |
| PACKINGBATCH | 142 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 233.71 |
| PACKING | 142 | 00197 | Eggcelent liquid 5 Liter | 0001 | 20 | 1,200 |
| Productions | 138 | 03205 | COPPER Gold Oral Liquid | 0001 | 140 | 109.7 |
| PRODUCTIONBATCH | 138 | 01009 | Copper Sulphate | 0001 | 5 | 2,063.66 |
| PRODUCTIONBATCH | 138 | 01058 | Xanthan Gum | 0001 | 0 | 1,468.44 |
| PRODUCTIONBATCH | 138 | 01045 | Sorbitol Liquid 70% | 0001 | 10 | 421.7 |
| Productions | 138 | 03205 | COPPER Gold Oral Liquid | 0001 | 140 | 109.7 |
| PACKING | 143 | 00291 | COPPER Gold Oral Liquid 5 Lit | 0001 | 28 | 1,128.88 |
| PACKINGBATCH | 143 | 02014 | Plastic Can White 5 Liter | 0001 | 30 | 433.84 |
| PACKINGBATCH | 143 | 02348 | Label COPPER Gold Oral Liquid 5 Lit | 0001 | 40 | 40 |
| PACKINGBATCH | 143 | 03205 | COPPER Gold Oral Liquid | 0001 | 140 | 109.7 |
| PACKINGBATCH | 143 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 7 | 233.71 |
| PACKING | 143 | 00291 | COPPER Gold Oral Liquid 5 Lit | 0001 | 28 | 1,128.88 |
| Productions | 139 | 03162 | P.H Cure Liquid | 0001 | 500 | 27.04 |
| PRODUCTIONBATCH | 139 | 01009 | Copper Sulphate | 0001 | 1 | 2,063.66 |
| PRODUCTIONBATCH | 139 | 01020 | Formic Acid | 0001 | 25 | 350 |
| PRODUCTIONBATCH | 139 | 01021 | Glacial Acetic Acid | 0001 | 3 | 399.62 |
| PRODUCTIONBATCH | 139 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PACKING | 144 | 00228 | P.H Cure 25 Liter | 0001 | 20 | 1,840.97 |
| PACKINGBATCH | 144 | 02128 | White Can 25 Liter | 0001 | 20 | 1,066 |
| PACKINGBATCH | 144 | 02268 | Label P.H Cure 25Liter | 0001 | 22 | 90 |
| PACKINGBATCH | 144 | 03162 | P.H Cure Liquid | 0001 | 500 | 27.04 |
| Productions | 140 | 03207 | Toxi Gold Forte Powder | 0001 | 625 | 13.75 |
| PRODUCTIONBATCH | 140 | 01003 | Bentonite | 0001 | 650 | 13.22 |
| PACKING | 145 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 25 | 666.69 |
| PACKINGBATCH | 145 | 02307 | Bag Bop Blue Colour | 0001 | 25 | 155 |
| PACKINGBATCH | 145 | 02351 | label Toxi Gold Forte Powder 25 kg | 0001 | 30 | 140 |
| PACKINGBATCH | 145 | 03207 | Toxi Gold Forte Powder | 0001 | 625 | 13.75 |
| PurchasesBatch | 74 | 02174 | Bag DCP-Lic 25 kg | 0001 | 508 | 100 |
| PurchasesBatch | 75 | 01015 | DCP (Calcium) | 0001 | 10,000 | 17 |
| Productions | 141 | 03113 | DCP-Lic Powder  (High) | 0001 | 10,000 | 11.62 |
| PRODUCTIONBATCH | 141 | 01190 | PHOSPHORUS Powder 29% | 0001 | 10,100 | 11.5 |
| PACKING | 146 | 00156 | DCP-Lic Powder 25 Kg (High) | 0001 | 400 | 390.38 |
| PACKINGBATCH | 146 | 02174 | Bag DCP-Lic 25 kg | 0001 | 400 | 100 |
| PACKINGBATCH | 146 | 03113 | DCP-Lic Powder  (High) | 0001 | 10,000 | 11.62 |
| PurchasesBatch | 76 | 01043 | Sodium Chloride | 0001 | 1,600 | 13.75 |
| PurchasesBatch | 76 | 01044 | Sodium Bicarbonate | 0001 | 200 | 128 |
| PurchasesBatch | 77 | 02258 | Label Rumicid 25kg | 0001 | 300 | 40 |
| Productions | 142 | 03163 | Calcium 72 | 0001 | 2,500 | 17.34 |
| PRODUCTIONBATCH | 142 | 01015 | DCP (Calcium) | 0001 | 2,550 | 17 |
| PACKING | 147 | 00231 | Calcium 72 25kg | 0001 | 100 | 513.5 |
| PACKINGBATCH | 147 | 02274 | Bag Calcium 72  25kg | 0001 | 100 | 80 |
| PACKINGBATCH | 147 | 03163 | Calcium 72 | 0001 | 2,500 | 17.34 |
| Productions | 143 | 03046 | Rumicid BOP Oral Powder | 0001 | 3,750 | 21.89 |
| PRODUCTIONBATCH | 143 | 01003 | Bentonite | 0001 | 100 | 13.22 |
| PRODUCTIONBATCH | 143 | 01016 | DCP (Dana) | 0001 | 1,000 | 10 |
| PRODUCTIONBATCH | 143 | 01044 | Sodium Bicarbonate | 0001 | 187 | 128.03 |
| PRODUCTIONBATCH | 143 | 01015 | DCP (Calcium) | 0001 | 2,750 | 17 |
| PACKING | 148 | 00220 | Rumicid powder 25kg | 0001 | 150 | 848.35 |
| PACKINGBATCH | 148 | 02258 | Label Rumicid 25kg | 0001 | 160 | 40.16 |
| PACKINGBATCH | 148 | 02307 | Bag Bop Blue Colour | 0001 | 100 | 155 |
| PACKINGBATCH | 148 | 03046 | Rumicid BOP Oral Powder | 0001 | 3,750 | 21.89 |
| PACKINGBATCH | 148 | 02277 | Bag Bop Yellow Colour | 0001 | 150 | 155 |
| PACKING | 148 | 00220 | Rumicid powder 25kg | 0001 | 150 | 848.35 |
| SALESBATCH | 70 | 00022 | Magnet BOP 25kg | 0001 | 100 | 492.08 |
| SALESBATCH | 71 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 142.13 |
| SALESBATCH | 71 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 24.89 |
| SALESBATCH | 72 | 00019 | DCP BOP 25kg | 0001 | 50 | 379 |
| SALESBATCH | 72 | 00040 | Super Yeast Powder 25kg | 0001 | 2 | 772.98 |
| SALESBATCH | 73 | 00376 | Leo Flush Oral Liquid 5 Lit | 0001 | 24 | 1,148.12 |
| SALESBATCH | 74 | 00197 | Eggcelent liquid 5 Liter | 0001 | 20 | 1,200 |
| SALESBATCH | 75 | 00291 | COPPER Gold Oral Liquid 5 Lit | 0001 | 28 | 1,128.88 |
| SALESBATCH | 75 | 00228 | P.H Cure 25 Liter | 0001 | 20 | 1,840.97 |
| SALESBATCH | 75 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 25 | 666.69 |
| SALESBATCH | 76 | 00156 | DCP-Lic Powder 25 Kg (High) | 0001 | 400 | 390.38 |
| SALESBATCH | 77 | 00231 | Calcium 72 25kg | 0001 | 100 | 513.5 |
| SALESBATCH | 78 | 00220 | Rumicid powder 25kg | 0001 | 150 | 848.35 |
| SALESBATCH | 79 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| PurchasesBatch | 78 | 01207 | General Items For Lab | 0001 | 1 | 9,500 |
| PurchasesBatch | 79 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 70 | 80 |
| PurchasesBatch | 79 | 02336 | Label TopVit Oral Liquid  5 Liter | 0001 | 70 | 80 |
| PurchasesBatch | 79 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 60 | 80 |
| PurchasesBatch | 79 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 30 | 80 |
| PurchasesBatch | 79 | 02435 | Label CS Guard 20 Oral Liquid 5 Lit | 0001 | 30 | 80 |
| PurchasesBatch | 79 | 02436 | Label Vital Frame Oral Liquid 5 Lit | 0001 | 32 | 80 |
| PurchasesBatch | 79 | 02345 | Label Acido Forte 25 Lit | 0001 | 12 | 90 |
| PurchasesBatch | 79 | 02437 | Label MLC 360 Oral Liquid 25 Lit | 0001 | 20 | 90 |
| PurchasesBatch | 79 | 02271 | Label E.S 200 5Lit | 0001 | 32 | 40 |
| PurchasesBatch | 79 | 00374 | Renu Guard Bucket Label | 0001 | 15 | 75 |
| PurchasesBatch | 79 | 02026 | Label Toxi Lic 5 Liter | 0001 | 160 | 50 |
| PurchasesBatch | 79 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 500 | 40 |
| PurchasesBatch | 80 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 100 | 235 |
| PurchasesBatch | 81 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 34 | 227 |
| PurchasesBatch | 82 | 01185 | ARQ Vasaka | 0001 | 30 | 283.33 |
| PurchasesBatch | 83 | 02140 | Bucket Large | 0001 | 50 | 1,100 |
| PurchasesBatch | 84 | 01041 | Sodium Benzoate | 0001 | 25 | 650 |
| PurchasesBatch | 84 | 01058 | Xanthan Gum | 0001 | 25 | 1,450 |
| PurchasesBatch | 84 | 01034 | Magnesium Sulphate | 0001 | 25 | 560 |
| PurchasesBatch | 84 | 01004 | Citric Acid | 0001 | 25 | 400 |
| PurchasesBatch | 84 | 01176 | Cobalt Chloride | 0001 | 1 | 9,500 |
| PurchasesBatch | 84 | 01187 | Sodium Metaby Sulphate | 0001 | 25 | 400 |
| PurchasesBatch | 84 | 01011 | Choline Chloride | 0001 | 25 | 4,850 |
| PurchasesBatch | 84 | 01009 | Copper Sulphate | 0001 | 25 | 2,200 |
| PurchasesBatch | 84 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| PurchasesBatch | 84 | 01105 | Sodium Citrate | 0001 | 25 | 425 |
| PurchasesBatch | 84 | 01010 | Betaine | 0001 | 25 | 2,800 |
| PurchasesBatch | 84 | 01201 | I.P.A | 0001 | 50 | 750 |
| PurchasesBatch | 84 | 01028 | Lactic Acid | 0001 | 5 | 1,650 |
| PurchasesBatch | 85 | 01019 | Eucluptus Oil | 0001 | 3 | 5,000 |
| PurchasesBatch | 85 | 01075 | Peppermint Oil | 0001 | 3 | 4,500 |
| PurchasesBatch | 85 | 01047 | Sodium Sulphate | 0001 | 200 | 68 |
| Productions | 144 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 225 | 134.39 |
| PRODUCTIONBATCH | 144 | 01002 | Ammonium chloride | 0001 | 22 | 275.11 |
| PRODUCTIONBATCH | 144 | 01004 | Citric Acid | 0001 | 10 | 400 |
| PRODUCTIONBATCH | 144 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 144 | 01047 | Sodium Sulphate | 0001 | 200 | 68.84 |
| PRODUCTIONBATCH | 144 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 2 | 1,545.26 |
| PRODUCTIONBATCH | 144 | 01105 | Sodium Citrate | 0001 | 5 | 414.59 |
| Productions | 144 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 225 | 134.39 |
| PACKING | 149 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 225 | 242.73 |
| PACKINGBATCH | 149 | 02341 | Packet Reno Gurd Flush Oral Powder 1 kg | 0001 | 225 | 30 |
| PACKINGBATCH | 149 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 225 | 134.39 |
| PACKINGBATCH | 149 | 02140 | Bucket Large | 0001 | 15 | 1,100 |
| PACKINGBATCH | 149 | 00374 | Renu Guard Bucket Label | 0001 | 15 | 75 |
| PACKING | 149 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 225 | 242.73 |
| Productions | 145 | 03190 | CRD Mint Oral Liquid | 0001 | 260 | 336.47 |
| PRODUCTIONBATCH | 145 | 01019 | Eucluptus Oil | 0001 | 2 | 5,000 |
| PRODUCTIONBATCH | 145 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 145 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 145 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| PRODUCTIONBATCH | 145 | 01075 | Peppermint Oil | 0001 | 2 | 4,524.54 |
| PRODUCTIONBATCH | 145 | 01189 | Glycerine | 0001 | 30 | 717.02 |
| PRODUCTIONBATCH | 145 | 01201 | I.P.A | 0001 | 30 | 750 |
| Productions | 145 | 03190 | CRD Mint Oral Liquid | 0001 | 260 | 336.47 |
| PACKING | 150 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 52 | 2,291.21 |
| PACKINGBATCH | 150 | 02014 | Plastic Can White 5 Liter | 0001 | 52 | 433.84 |
| PACKINGBATCH | 150 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 70 | 80 |
| PACKINGBATCH | 150 | 03190 | CRD Mint Oral Liquid | 0001 | 260 | 336.47 |
| PACKINGBATCH | 150 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 15 | 233.42 |
| PACKING | 150 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 52 | 2,291.21 |
| Productions | 146 | 03193 | TopVit Oral Liquid | 0001 | 240 | 264.91 |
| PRODUCTIONBATCH | 146 | 01007 | CSL | 0001 | 1 | 35 |
| PRODUCTIONBATCH | 146 | 01009 | Copper Sulphate | 0001 | 4 | 2,176.63 |
| PRODUCTIONBATCH | 146 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 146 | 01045 | Sorbitol Liquid 70% | 0001 | 33 | 421.7 |
| PRODUCTIONBATCH | 146 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 146 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 146 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,545.26 |
| PRODUCTIONBATCH | 146 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 146 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 146 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.22 |
| PRODUCTIONBATCH | 146 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 146 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 146 | 03193 | TopVit Oral Liquid | 0001 | 240 | 264.91 |
| PACKING | 151 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 48 | 2,041.85 |
| PACKINGBATCH | 151 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 433.84 |
| PACKINGBATCH | 151 | 02336 | Label TopVit Oral Liquid  5 Liter | 0001 | 70 | 80 |
| PACKINGBATCH | 151 | 03193 | TopVit Oral Liquid | 0001 | 240 | 264.91 |
| PACKINGBATCH | 151 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 233.42 |
| PACKING | 151 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 48 | 2,041.85 |
| Productions | 147 | 03194 | MLC 100  Oral Liquid | 0001 | 220 | 90.88 |
| PRODUCTIONBATCH | 147 | 01009 | Copper Sulphate | 0001 | 3 | 2,176.63 |
| PRODUCTIONBATCH | 147 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 147 | 01020 | Formic Acid | 0001 | 1 | 350 |
| PRODUCTIONBATCH | 147 | 01021 | Glacial Acetic Acid | 0001 | 1 | 399.62 |
| PRODUCTIONBATCH | 147 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 147 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 147 | 01045 | Sorbitol Liquid 70% | 0001 | 4 | 421.7 |
| PRODUCTIONBATCH | 147 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| PRODUCTIONBATCH | 147 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PRODUCTIONBATCH | 147 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| Productions | 147 | 03194 | MLC 100  Oral Liquid | 0001 | 220 | 90.88 |
| PACKING | 152 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 44 | 1,114.83 |
| PACKINGBATCH | 152 | 02014 | Plastic Can White 5 Liter | 0001 | 50 | 433.84 |
| PACKINGBATCH | 152 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 60 | 80 |
| PACKINGBATCH | 152 | 03194 | MLC 100  Oral Liquid | 0001 | 220 | 90.88 |
| PACKINGBATCH | 152 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 11 | 233.42 |
| PACKING | 152 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 44 | 1,114.83 |
| Productions | 148 | 03192 | Immunit Z Oral Liquid | 0001 | 100 | 173.14 |
| PRODUCTIONBATCH | 148 | 01023 | Garlic Oil | 0001 | 1 | 7,043.77 |
| PRODUCTIONBATCH | 148 | 01025 | Ginger Oil | 0001 | 1 | 7,200 |
| PRODUCTIONBATCH | 148 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 148 | 01045 | Sorbitol Liquid 70% | 0001 | 5 | 421.7 |
| PRODUCTIONBATCH | 148 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 148 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 148 | 03192 | Immunit Z Oral Liquid | 0001 | 100 | 173.14 |
| PACKING | 153 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 20 | 1,477.88 |
| PACKINGBATCH | 153 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 433.84 |
| PACKINGBATCH | 153 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 30 | 80 |
| PACKINGBATCH | 153 | 03192 | Immunit Z Oral Liquid | 0001 | 100 | 173.14 |
| PACKINGBATCH | 153 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 233.42 |
| PACKING | 153 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 20 | 1,477.88 |
| Productions | 149 | 03201 | Acido Forte | 0001 | 250 | 46.26 |
| PRODUCTIONBATCH | 149 | 01004 | Citric Acid | 0001 | 3 | 400 |
| PRODUCTIONBATCH | 149 | 01009 | Copper Sulphate | 0001 | 1 | 2,176.63 |
| PRODUCTIONBATCH | 149 | 01020 | Formic Acid | 0001 | 20 | 350 |
| PRODUCTIONBATCH | 149 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 149 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 149 | 03201 | Acido Forte | 0001 | 250 | 46.26 |
| PACKING | 154 | 00289 | ACIDO FORTE 25 Lit | 0001 | 10 | 2,330.41 |
| PACKINGBATCH | 154 | 02128 | White Can 25 Liter | 0001 | 10 | 1,066 |
| PACKINGBATCH | 154 | 02345 | Label Acido Forte 25 Lit | 0001 | 12 | 90 |
| PACKINGBATCH | 154 | 03201 | Acido Forte | 0001 | 250 | 46.26 |
| PACKING | 154 | 00289 | ACIDO FORTE 25 Lit | 0001 | 10 | 2,330.41 |
| Productions | 150 | 03267 | MLC 360 Oral Liquid | 0001 | 250 | 129.25 |
| PRODUCTIONBATCH | 150 | 01023 | Garlic Oil | 0001 | 1 | 7,043.77 |
| PRODUCTIONBATCH | 150 | 01025 | Ginger Oil | 0001 | 1 | 7,200 |
| PRODUCTIONBATCH | 150 | 01028 | Lactic Acid | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 150 | 01038 | Phosphoric Acid 85% | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 150 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 150 | 01045 | Sorbitol Liquid 70% | 0001 | 25 | 421.7 |
| PRODUCTIONBATCH | 150 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.22 |
| Productions | 150 | 03267 | MLC 360 Oral Liquid | 0001 | 250 | 129.25 |
| PACKING | 155 | 00373 | MLC 360 Oral Liquid 25 Lit | 0001 | 10 | 4,477.14 |
| PACKINGBATCH | 155 | 02128 | White Can 25 Liter | 0001 | 10 | 1,066 |
| PACKINGBATCH | 155 | 02437 | Label MLC 360 Oral Liquid 25 Lit | 0001 | 20 | 90 |
| PACKINGBATCH | 155 | 03267 | MLC 360 Oral Liquid | 0001 | 250 | 129.25 |
| PACKING | 155 | 00373 | MLC 360 Oral Liquid 25 Lit | 0001 | 10 | 4,477.14 |
| Productions | 151 | 03084 | BroncoKill Liquid | 0001 | 500 | 110.45 |
| PRODUCTIONBATCH | 151 | 01005 | CMC Sodium | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 151 | 01017 | Camphor | 0001 | 2 | 3,370.68 |
| PRODUCTIONBATCH | 151 | 01031 | Menthol Crystal | 0001 | 5 | 6,500 |
| PRODUCTIONBATCH | 151 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 151 | 01048 | Titanium Dioxide (T.T) | 0001 | 1 | 1,500 |
| PRODUCTIONBATCH | 151 | 01058 | Xanthan Gum | 0001 | 2 | 1,450.22 |
| PRODUCTIONBATCH | 151 | 01185 | ARQ Vasaka | 0001 | 30 | 283.33 |
| Productions | 151 | 03084 | BroncoKill Liquid | 0001 | 500 | 110.45 |
| PACKING | 156 | 00352 | BronoKill  Liquid  25 Lit | 0001 | 20 | 3,827.36 |
| PACKINGBATCH | 156 | 02128 | White Can 25 Liter | 0001 | 20 | 1,066 |
| PACKINGBATCH | 156 | 03084 | BroncoKill Liquid | 0001 | 500 | 110.45 |
| PACKING | 156 | 00352 | BronoKill  Liquid  25 Lit | 0001 | 20 | 3,827.36 |
| Productions | 152 | 03001 | Growth Promoter BOP Oral | 0001 | 850 | 17.55 |
| PRODUCTIONBATCH | 152 | 01016 | DCP (Dana) | 0001 | 700 | 10 |
| PRODUCTIONBATCH | 152 | 01042 | Starch | 0001 | 10 | 167.2 |
| PRODUCTIONBATCH | 152 | 01043 | Sodium Chloride | 0001 | 170 | 13.75 |
| PRODUCTIONBATCH | 152 | 01050 | Tartrazine Yellow Color Indian | 0001 | 1 | 3,036.1 |
| PACKING | 157 | 00016 | Growth Promoter 25kg | 0001 | 34 | 593.65 |
| PACKINGBATCH | 157 | 02032 | BAG Growth Promoter 25 KG | 0001 | 34 | 155 |
| PACKINGBATCH | 157 | 03001 | Growth Promoter BOP Oral | 0001 | 850 | 17.55 |
| PACKING | 157 | 00016 | Growth Promoter 25kg | 0001 | 34 | 593.65 |
| Productions | 153 | 03087 | Golden Premix Bop | 0001 | 475 | 22.66 |
| PRODUCTIONBATCH | 153 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 153 | 01013 | Calcium Chloride | 0001 | 0 | 208.6 |
| PRODUCTIONBATCH | 153 | 01016 | DCP (Dana) | 0001 | 380 | 10 |
| PRODUCTIONBATCH | 153 | 01042 | Starch | 0001 | 4 | 167.2 |
| PRODUCTIONBATCH | 153 | 01043 | Sodium Chloride | 0001 | 95 | 13.75 |
| PRODUCTIONBATCH | 153 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 153 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 153 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 153 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 153 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 153 | 03087 | Golden Premix Bop | 0001 | 475 | 22.66 |
| PACKING | 158 | 00125 | Golden Premix 25Kg | 0001 | 19 | 721.45 |
| PACKINGBATCH | 158 | 02307 | Bag Bop Blue Colour | 0001 | 19 | 155 |
| PACKINGBATCH | 158 | 03087 | Golden Premix Bop | 0001 | 475 | 22.66 |
| PACKING | 158 | 00125 | Golden Premix 25Kg | 0001 | 19 | 721.45 |
| Productions | 154 | 03019 | Super Yeast Powder | 0001 | 250 | 27.16 |
| PRODUCTIONBATCH | 154 | 01003 | Bentonite | 0001 | 230 | 13.22 |
| PRODUCTIONBATCH | 154 | 01033 | Molasses | 0001 | 25 | 50 |
| PRODUCTIONBATCH | 154 | 01059 | Wheat Bran | 0001 | 20 | 72.45 |
| PRODUCTIONBATCH | 154 | 01007 | CSL | 0001 | 30 | 35 |
| Productions | 154 | 03019 | Super Yeast Powder | 0001 | 250 | 27.16 |
| PACKING | 159 | 00040 | Super Yeast Powder 25kg | 001 | 10 | 873.93 |
| PACKINGBATCH | 159 | 02042 | Label Super Yeast 25 KG | 0001 | 10 | 40 |
| PACKINGBATCH | 159 | 02213 | Bag Bop Red Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 159 | 03019 | Super Yeast Powder | 0001 | 250 | 27.16 |
| PACKING | 159 | 00040 | Super Yeast Powder 25kg | 001 | 10 | 873.93 |
| Productions | 155 | 03163 | Calcium 72 | 0001 | 2,500 | 17 |
| PRODUCTIONBATCH | 155 | 01015 | DCP (Calcium) | 0001 | 2,500 | 17 |
| PACKING | 160 | 00231 | Calcium 72 25kg | 0001 | 100 | 505 |
| PACKINGBATCH | 160 | 02274 | Bag Calcium 72  25kg | 0001 | 100 | 80 |
| PACKINGBATCH | 160 | 03163 | Calcium 72 | 0001 | 2,500 | 17 |
| PurchasesBatch | 86 | 02291 | Label Super Yeast Liquid 5 Liter | 0001 | 64 | 40 |
| PurchasesBatch | 86 | 02027 | Label Calci Phos D 5 Liter | 0001 | 70 | 40 |
| PurchasesBatch | 87 | 02014 | Plastic Can White 5 Liter | 0001 | 425 | 440 |
| Productions | 156 | 03163 | Calcium 72 | 0001 | 375 | 17 |
| PRODUCTIONBATCH | 156 | 01015 | DCP (Calcium) | 0001 | 375 | 17 |
| PACKING | 161 | 00231 | Calcium 72 25kg | 0001 | 15 | 505 |
| PACKINGBATCH | 161 | 02274 | Bag Calcium 72  25kg | 0001 | 15 | 80 |
| PACKINGBATCH | 161 | 03163 | Calcium 72 | 0001 | 375 | 17 |
| Productions | 157 | 03094 | Super Copper Liquid | 0001 | 100 | 269.62 |
| PRODUCTIONBATCH | 157 | 01004 | Citric Acid | 0001 | 5 | 400 |
| PRODUCTIONBATCH | 157 | 01009 | Copper Sulphate | 0001 | 10 | 2,176.63 |
| PRODUCTIONBATCH | 157 | 01045 | Sorbitol Liquid 70% | 0001 | 5 | 421.7 |
| PRODUCTIONBATCH | 157 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 157 | 03094 | Super Copper Liquid | 0001 | 100 | 269.62 |
| PACKING | 162 | 00135 | Super Copper Liquid 5 Lit | 0001 | 20 | 1,875.02 |
| PACKINGBATCH | 162 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 438.54 |
| PACKINGBATCH | 162 | 02144 | Label Super Copper Liquid 5 Lit | 0001 | 30 | 20 |
| PACKINGBATCH | 162 | 03094 | Super Copper Liquid | 0001 | 100 | 269.62 |
| PACKINGBATCH | 162 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 233.42 |
| PACKING | 162 | 00135 | Super Copper Liquid 5 Lit | 0001 | 20 | 1,875.02 |
| OpeningBatch | 108 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 146 | 5,000 |
| Productions | 158 | 03010 | Garlimint Plus BOP | 0001 | 200 | 164.26 |
| PRODUCTIONBATCH | 158 | 01023 | Garlic Oil | 0001 | 2 | 7,043.77 |
| PRODUCTIONBATCH | 158 | 01025 | Ginger Oil | 0001 | 2 | 7,200 |
| PRODUCTIONBATCH | 158 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 158 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 158 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 421.7 |
| PRODUCTIONBATCH | 158 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 158 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 158 | 03010 | Garlimint Plus BOP | 0001 | 200 | 164.26 |
| PACKING | 163 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 40 | 1,393.86 |
| PACKINGBATCH | 163 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 438.54 |
| PACKINGBATCH | 163 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 64 | 40 |
| PACKINGBATCH | 163 | 03010 | Garlimint Plus BOP | 0001 | 200 | 164.26 |
| PACKINGBATCH | 163 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 233.42 |
| PACKING | 163 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 40 | 1,393.86 |
| Productions | 159 | 03121 | Bio Adek Liquid | 0001 | 240 | 88.19 |
| PRODUCTIONBATCH | 159 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 159 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 159 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 159 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| PRODUCTIONBATCH | 159 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 159 | 01045 | Sorbitol Liquid 70% | 0001 | 15 | 421.7 |
| Productions | 159 | 03121 | Bio Adek Liquid | 0001 | 240 | 88.19 |
| PACKING | 164 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 48 | 996.04 |
| PACKINGBATCH | 164 | 02014 | Plastic Can White 5 Liter | 0001 | 48 | 438.54 |
| PACKINGBATCH | 164 | 02237 | Label Bio Adeck Liquid 5Lit | 0001 | 64 | 40 |
| PACKINGBATCH | 164 | 03121 | Bio Adek Liquid | 0001 | 240 | 88.19 |
| PACKINGBATCH | 164 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 13 | 233.42 |
| PACKING | 164 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 48 | 996.04 |
| Productions | 160 | 03240 | Veto Respi Oral Liquid Oil Base | 0001 | 240 | 161.75 |
| PRODUCTIONBATCH | 160 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 160 | 01189 | Glycerine | 0001 | 10 | 717.02 |
| PRODUCTIONBATCH | 160 | 01201 | I.P.A | 0001 | 20 | 750 |
| PRODUCTIONBATCH | 160 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| PRODUCTIONBATCH | 160 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| Productions | 160 | 03240 | Veto Respi Oral Liquid Oil Base | 0001 | 240 | 161.75 |
| PACKING | 165 | 00339 | Veto Respi Oral Liquid Oil Base 5 Lit | 0001 | 48 | 1,481.95 |
| PACKINGBATCH | 165 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 438.54 |
| PACKINGBATCH | 165 | 02394 | Label Veto Respi Oral Liquid Oil.B 5 Lit | 0001 | 80 | 40 |
| PACKINGBATCH | 165 | 03240 | Veto Respi Oral Liquid Oil Base | 0001 | 240 | 161.75 |
| PACKINGBATCH | 165 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 233.42 |
| PACKING | 165 | 00339 | Veto Respi Oral Liquid Oil Base 5 Lit | 0001 | 48 | 1,481.95 |
| Productions | 161 | 03241 | Toxin Pro Oral Liquid | 0001 | 300 | 90.95 |
| PRODUCTIONBATCH | 161 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 161 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 161 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 161 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 161 | 01046 | Silmyrin | 0001 | 1 | 13,130.73 |
| PRODUCTIONBATCH | 161 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.22 |
| PACKING | 166 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 60 | 1,085.87 |
| PACKINGBATCH | 166 | 02014 | Plastic Can White 5 Liter | 0001 | 70 | 438.54 |
| PACKINGBATCH | 166 | 02395 | Label Toxin Pro Oral Liquid 5 Lit | 0001 | 80 | 40 |
| PACKINGBATCH | 166 | 03241 | Toxin Pro Oral Liquid | 0001 | 300 | 90.95 |
| PACKINGBATCH | 166 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 17 | 233.42 |
| PACKING | 166 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 60 | 1,085.87 |
| Productions | 162 | 03003 | Calci-Phos-D | 0001 | 220 | 34.69 |
| PRODUCTIONBATCH | 162 | 01013 | Calcium Chloride | 0001 | 3 | 208.6 |
| PRODUCTIONBATCH | 162 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 162 | 01038 | Phosphoric Acid 85% | 0001 | 3 | 650 |
| PRODUCTIONBATCH | 162 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 162 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 162 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 162 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.22 |
| PRODUCTIONBATCH | 162 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 162 | 03003 | Calci-Phos-D | 0001 | 220 | 34.69 |
| PACKING | 167 | 00049 | Calci-Phos-D 5 Lit | 0001 | 44 | 739.3 |
| PACKINGBATCH | 167 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 438.54 |
| PACKINGBATCH | 167 | 02027 | Label Calci Phos D 5 Liter | 0001 | 70 | 40 |
| PACKINGBATCH | 167 | 03003 | Calci-Phos-D | 0001 | 220 | 34.69 |
| PACKINGBATCH | 167 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 233.42 |
| PACKING | 167 | 00049 | Calci-Phos-D 5 Lit | 0001 | 44 | 739.3 |
| Productions | 163 | 03011 | Hepatic-Optimizer Liquid | 0001 | 740 | 97.28 |
| PRODUCTIONBATCH | 163 | 01010 | Betaine | 0001 | 8 | 2,800 |
| PRODUCTIONBATCH | 163 | 01011 | Choline Chloride | 0001 | 7 | 4,840.92 |
| PRODUCTIONBATCH | 163 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 163 | 01013 | Calcium Chloride | 0001 | 4 | 208.6 |
| PRODUCTIONBATCH | 163 | 01038 | Phosphoric Acid 85% | 0001 | 11 | 650 |
| PRODUCTIONBATCH | 163 | 01043 | Sodium Chloride | 0001 | 3 | 13.75 |
| PRODUCTIONBATCH | 163 | 01058 | Xanthan Gum | 0001 | 3 | 1,450.22 |
| Productions | 163 | 03011 | Hepatic-Optimizer Liquid | 0001 | 740 | 97.28 |
| PACKING | 168 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 148 | 1,050.6 |
| PACKINGBATCH | 168 | 02014 | Plastic Can White 5 Liter | 0001 | 160 | 438.54 |
| PACKINGBATCH | 168 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 200 | 20 |
| PACKINGBATCH | 168 | 03011 | Hepatic-Optimizer Liquid | 0001 | 740 | 97.28 |
| PACKINGBATCH | 168 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 40 | 233.42 |
| PACKING | 168 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 148 | 1,050.6 |
| PurchasesBatch | 88 | 01035 | Turpentine Oil | 0001 | 2 | 1,350 |
| PurchasesBatch | 88 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 10 | 1,550 |
| PurchasesBatch | 89 | 01184 | ARQ | 0001 | 30 | 366.67 |
| PurchasesBatch | 90 | 02047 | Label Mento Care 1 Liter | 0001 | 32 | 40 |
| PurchasesBatch | 90 | 02298 | Label Hepatic-Opt 1Liter | 0001 | 64 | 40 |
| PurchasesBatch | 90 | 02165 | Label Toni Plex Liquid 1 lit | 0001 | 72 | 40 |
| PurchasesBatch | 90 | 02164 | Label Bop Copper Liquid 1 Lit | 0001 | 72 | 40 |
| PurchasesBatch | 90 | 02093 | Label Toni Plex 5 Lit | 0001 | 24 | 40 |
| PurchasesBatch | 90 | 02209 | Label Toxi - Off Liquid 5 Liter | 0001 | 24 | 40 |
| PurchasesBatch | 91 | 02014 | Plastic Can White 5 Liter | 0001 | 425 | 440 |
| Productions | 164 | 03020 | Toxi-Lic Liquid | 0001 | 600 | 347.32 |
| PRODUCTIONBATCH | 164 | 01004 | Citric Acid | 0001 | 1 | 400 |
| PRODUCTIONBATCH | 164 | 01010 | Betaine | 0001 | 6 | 2,800 |
| PRODUCTIONBATCH | 164 | 01011 | Choline Chloride | 0001 | 12 | 4,840.92 |
| PRODUCTIONBATCH | 164 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 164 | 01041 | Sodium Benzoate | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 164 | 01046 | Silmyrin | 0001 | 9 | 13,130.73 |
| PRODUCTIONBATCH | 164 | 01058 | Xanthan Gum | 0001 | 2 | 1,450.22 |
| PRODUCTIONBATCH | 164 | 01184 | ARQ | 0001 | 25 | 366.67 |
| Productions | 164 | 03020 | Toxi-Lic Liquid | 0001 | 600 | 347.32 |
| PACKING | 169 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 120 | 2,305.22 |
| PACKINGBATCH | 169 | 02014 | Plastic Can White 5 Liter | 0001 | 120 | 439.69 |
| PACKINGBATCH | 169 | 02026 | Label Toxi Lic 5 Liter | 0001 | 160 | 50 |
| PACKINGBATCH | 169 | 03020 | Toxi-Lic Liquid | 0001 | 600 | 347.32 |
| PACKINGBATCH | 169 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 32 | 233.42 |
| PACKING | 169 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 120 | 2,305.22 |
| Productions | 165 | 03003 | Calci-Phos-D | 0001 | 130 | 34.69 |
| PRODUCTIONBATCH | 165 | 01013 | Calcium Chloride | 0001 | 1 | 208.6 |
| PRODUCTIONBATCH | 165 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 165 | 01038 | Phosphoric Acid 85% | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 165 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 165 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 165 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 165 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| PRODUCTIONBATCH | 165 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 165 | 03003 | Calci-Phos-D | 0001 | 130 | 34.69 |
| PACKING | 170 | 00010 | Calci-Phos-D100ML | 0001 | 700 | 29.48 |
| PACKINGBATCH | 170 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 750 | 12 |
| PACKINGBATCH | 170 | 03003 | Calci-Phos-D | 0001 | 70 | 34.69 |
| PACKINGBATCH | 170 | 02010 | Bottle Pet Amber 100ML | 0001 | 900 | 9.12 |
| PACKINGBATCH | 170 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 5 | 199.99 |
| PACKING | 171 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 280.11 |
| PACKINGBATCH | 171 | 02097 | Bottle Round liter | 0001 | 60 | 230 |
| PACKINGBATCH | 171 | 03003 | Calci-Phos-D | 0001 | 60 | 34.69 |
| PACKINGBATCH | 171 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 5 | 185 |
| PACKING | 171 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 280.11 |
| Productions | 166 | 03165 | Timp-Ex Oral Liquid | 0001 | 40 | 38.72 |
| PRODUCTIONBATCH | 166 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 166 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.62 |
| PRODUCTIONBATCH | 166 | 01035 | Turpentine Oil | 0001 | 0 | 1,350 |
| PRODUCTIONBATCH | 166 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 166 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 166 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128.03 |
| PRODUCTIONBATCH | 166 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 166 | 03165 | Timp-Ex Oral Liquid | 0001 | 40 | 38.72 |
| PACKING | 172 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 400 | 26.58 |
| PACKINGBATCH | 172 | 02010 | Bottle Pet Amber 100ML | 0001 | 430 | 9.12 |
| PACKINGBATCH | 172 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 430 | 12 |
| PACKINGBATCH | 172 | 03165 | Timp-Ex Oral Liquid | 0001 | 40 | 38.72 |
| Productions | 167 | 03163 | Calcium 72 | 0001 | 25 | 17 |
| PRODUCTIONBATCH | 167 | 01015 | DCP (Calcium) | 0001 | 25 | 17 |
| PACKING | 173 | 00248 | Calcium-72 1KG | 0001 | 25 | 47 |
| PACKINGBATCH | 173 | 02299 | Packet Calcium-72 1KG | 0001 | 25 | 30 |
| PACKINGBATCH | 173 | 03163 | Calcium 72 | 0001 | 25 | 17 |
| PurchasesBatch | 92 | 01182 | Fat Oil | 0001 | 190 | 466.84 |
| PurchasesBatch | 92 | 01047 | Sodium Sulphate | 0001 | 150 | 68 |
| PurchasesBatch | 92 | 01042 | Starch | 0001 | 200 | 170 |
| PurchasesBatch | 92 | 01008 | Calcium Carbonate | 0001 | 380 | 22.5 |
| PurchasesBatch | 93 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| PurchasesBatch | 94 | 02076 | Unprint Packet 1kg | 0001 | 80 | 28.75 |
| PurchasesBatch | 95 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 52 | 217 |
| PurchasesBatch | 96 | 02094 | Label Nephretic 1 Kg | 0001 | 100 | 40 |
| Productions | 168 | 03010 | Garlimint Plus BOP | 0001 | 20 | 164.26 |
| PRODUCTIONBATCH | 168 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 168 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 168 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 168 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 168 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 168 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 168 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 168 | 03010 | Garlimint Plus BOP | 0001 | 20 | 164.26 |
| PACKING | 174 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 39.22 |
| PACKINGBATCH | 174 | 02010 | Bottle Pet Amber 100ML | 0001 | 200 | 9.12 |
| PACKINGBATCH | 174 | 02224 | S+D Garlimint Plus Liquid 100 ML | 0001 | 200 | 11.5 |
| PACKINGBATCH | 174 | 03010 | Garlimint Plus BOP | 0001 | 20 | 164.26 |
| PACKINGBATCH | 174 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 2 | 217 |
| PACKING | 174 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 39.22 |
| Productions | 169 | 03014 | Magnet BOP Oral Powder | 0001 | 750 | 13.22 |
| PRODUCTIONBATCH | 169 | 01003 | Bentonite | 0001 | 750 | 13.22 |
| PACKING | 175 | 00022 | Magnet BOP 25kg | 0001 | 30 | 485.48 |
| PACKINGBATCH | 175 | 02033 | BAG Magnet 25 KG | 0001 | 30 | 155 |
| PACKINGBATCH | 175 | 03014 | Magnet BOP Oral Powder | 0001 | 750 | 13.22 |
| Productions | 170 | 03011 | Hepatic-Optimizer Liquid | 0001 | 108 | 111.96 |
| PRODUCTIONBATCH | 170 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 170 | 01011 | Choline Chloride | 0001 | 1 | 4,840.92 |
| PRODUCTIONBATCH | 170 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 170 | 01013 | Calcium Chloride | 0001 | 1 | 208.6 |
| PRODUCTIONBATCH | 170 | 01038 | Phosphoric Acid 85% | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 170 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 170 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| PRODUCTIONBATCH | 170 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 170 | 03011 | Hepatic-Optimizer Liquid | 0001 | 108 | 111.96 |
| PACKING | 176 | 00024 | Hepatic-Optimizer 1 Lit | 0001 | 48 | 410.29 |
| PACKINGBATCH | 176 | 02097 | Bottle Round liter | 0001 | 48 | 230 |
| PACKINGBATCH | 176 | 02298 | Label Hepatic-Opt 1Liter | 0001 | 64 | 40 |
| PACKINGBATCH | 176 | 03011 | Hepatic-Optimizer Liquid | 0001 | 48 | 111.96 |
| PACKINGBATCH | 176 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 4 | 180 |
| PACKING | 176 | 00024 | Hepatic-Optimizer 1 Lit | 0001 | 48 | 410.29 |
| PACKING | 177 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 12 | 1,077.84 |
| PACKINGBATCH | 177 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 439.69 |
| PACKINGBATCH | 177 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 12 | 20 |
| PACKINGBATCH | 177 | 03011 | Hepatic-Optimizer Liquid | 0001 | 60 | 111.96 |
| PACKINGBATCH | 177 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 233.42 |
| PACKING | 177 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 12 | 1,077.83 |
| Productions | 171 | 03026 | Mento Care Oral Liquid | 0001 | 24 | 111.2 |
| PRODUCTIONBATCH | 171 | 01031 | Menthol Crystal | 0001 | 0 | 6,500 |
| PRODUCTIONBATCH | 171 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 171 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 171 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 171 | 03026 | Mento Care Oral Liquid | 0001 | 24 | 111.2 |
| PACKING | 178 | 00054 | Mento Care Oral Liquid | 0001 | 24 | 409.95 |
| PACKINGBATCH | 178 | 02047 | Label Mento Care 1 Liter | 0001 | 32 | 40 |
| PACKINGBATCH | 178 | 02097 | Bottle Round liter | 0001 | 24 | 230 |
| PACKINGBATCH | 178 | 03026 | Mento Care Oral Liquid | 0001 | 24 | 111.2 |
| PACKINGBATCH | 178 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 185 |
| PACKING | 178 | 00054 | Mento Care Oral Liquid | 0001 | 24 | 409.95 |
| Productions | 172 | 03107 | Bop Copper Liquid | 0001 | 60 | 138.35 |
| PRODUCTIONBATCH | 172 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 172 | 01009 | Copper Sulphate | 0001 | 3 | 2,176.63 |
| PRODUCTIONBATCH | 172 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 172 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 172 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 172 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 172 | 03107 | Bop Copper Liquid | 0001 | 60 | 138.35 |
| PACKING | 179 | 00151 | BOP Copper Liquid 1 Lit | 0001 | 60 | 431.77 |
| PACKINGBATCH | 179 | 02097 | Bottle Round liter | 0001 | 60 | 230 |
| PACKINGBATCH | 179 | 02164 | Label Bop Copper Liquid 1 Lit | 0001 | 72 | 40 |
| PACKINGBATCH | 179 | 03107 | Bop Copper Liquid | 0001 | 60 | 138.35 |
| PACKINGBATCH | 179 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 5 | 185 |
| PACKING | 179 | 00151 | BOP Copper Liquid 1 Lit | 0001 | 60 | 431.77 |
| Productions | 173 | 03023 | Hepatic-Optimizer Powder | 0001 | 125 | 13.98 |
| PRODUCTIONBATCH | 173 | 01003 | Bentonite | 0001 | 100 | 13.22 |
| PRODUCTIONBATCH | 173 | 01015 | DCP (Calcium) | 0001 | 25 | 17 |
| PACKING | 180 | 00038 | Hepatic-Optimizer Powder 25kg | 0001 | 5 | 504.38 |
| PACKINGBATCH | 180 | 02307 | Bag Bop Blue Colour | 0001 | 5 | 155 |
| PACKINGBATCH | 180 | 03023 | Hepatic-Optimizer Powder | 0001 | 125 | 13.98 |
| Productions | 174 | 03035 | Toniplex Bop Oral Liquid | 0001 | 100 | 71.51 |
| PRODUCTIONBATCH | 174 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 174 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 174 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 174 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 174 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,548.85 |
| PRODUCTIONBATCH | 174 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 174 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 174 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| Productions | 174 | 03035 | Toniplex Bop Oral Liquid | 0001 | 100 | 71.51 |
| PACKING | 181 | 00064 | Toniplex Bop Oral Liquid 1 Lit | 0001 | 60 | 364.92 |
| PACKINGBATCH | 181 | 02097 | Bottle Round liter | 0001 | 60 | 230 |
| PACKINGBATCH | 181 | 02165 | Label Toni Plex Liquid 1 lit | 0001 | 72 | 40 |
| PACKINGBATCH | 181 | 03035 | Toniplex Bop Oral Liquid | 0001 | 60 | 71.51 |
| PACKINGBATCH | 181 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 5 | 185 |
| PACKING | 181 | 00064 | Toniplex Bop Oral Liquid 1 Lit | 0001 | 60 | 364.92 |
| PACKING | 182 | 00091 | Toniplex Oral Liquid 5 Lit | 0001 | 8 | 917.22 |
| PACKINGBATCH | 182 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 439.69 |
| PACKINGBATCH | 182 | 02093 | Label Toni Plex 5 Lit | 0001 | 24 | 40 |
| PACKINGBATCH | 182 | 03035 | Toniplex Bop Oral Liquid | 0001 | 40 | 71.51 |
| PACKING | 182 | 00091 | Toniplex Oral Liquid 5 Lit | 0001 | 8 | 917.22 |
| Productions | 175 | 03135 | Toxi - Off Liquid | 0001 | 60 | 224.3 |
| PRODUCTIONBATCH | 175 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 175 | 01005 | CMC Sodium | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 175 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 175 | 01011 | Choline Chloride | 0001 | 1 | 4,840.92 |
| PRODUCTIONBATCH | 175 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 175 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 175 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.62 |
| PRODUCTIONBATCH | 175 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 175 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 175 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.22 |
| PRODUCTIONBATCH | 175 | 01184 | ARQ | 0001 | 3 | 366.67 |
| Productions | 175 | 03135 | Toxi - Off Liquid | 0001 | 60 | 224.3 |
| PACKING | 183 | 00187 | TOXI-OFF Liquid 5 Liter | 0001 | 12 | 1,719.02 |
| PACKINGBATCH | 183 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 439.69 |
| PACKINGBATCH | 183 | 02209 | Label Toxi - Off Liquid 5 Liter | 0001 | 24 | 40 |
| PACKINGBATCH | 183 | 03135 | Toxi - Off Liquid | 0001 | 60 | 224.3 |
| PACKINGBATCH | 183 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 233.42 |
| PACKING | 183 | 00187 | TOXI-OFF Liquid 5 Liter | 0001 | 12 | 1,719.02 |
| Productions | 176 | 03118 | BOP Coolper Powder | 0001 | 120 | 109.99 |
| PRODUCTIONBATCH | 176 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 176 | 01047 | Sodium Sulphate | 0001 | 120 | 68.08 |
| PRODUCTIONBATCH | 176 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,548.85 |
| PRODUCTIONBATCH | 176 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| PRODUCTIONBATCH | 176 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PACKING | 184 | 00030 | Coolper 100gm | 0001 | 1,200 | 30.65 |
| PACKINGBATCH | 184 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 1,250 | 17 |
| PACKINGBATCH | 184 | 03118 | BOP Coolper Powder | 0001 | 120 | 109.99 |
| PACKINGBATCH | 184 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 233.42 |
| Productions | 177 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 19.49 |
| PRODUCTIONBATCH | 177 | 01003 | Bentonite | 0001 | 2 | 13.22 |
| PRODUCTIONBATCH | 177 | 01016 | DCP (Dana) | 0001 | 120 | 10 |
| PRODUCTIONBATCH | 177 | 01044 | Sodium Bicarbonate | 0001 | 12 | 128.03 |
| PRODUCTIONBATCH | 177 | 01015 | DCP (Calcium) | 0001 | 120 | 17 |
| Productions | 177 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 19.49 |
| PACKING | 185 | 00220 | Rumicid powder 25kg | 0001 | 10 | 682.5 |
| PACKINGBATCH | 185 | 02258 | Label Rumicid 25kg | 0001 | 10 | 40.16 |
| PACKINGBATCH | 185 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 185 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 19.49 |
| PACKING | 185 | 00220 | Rumicid powder 25kg | 0001 | 10 | 682.5 |
| Productions | 178 | 03001 | Growth Promoter BOP Oral | 0001 | 250 | 17.34 |
| PRODUCTIONBATCH | 178 | 01016 | DCP (Dana) | 0001 | 200 | 10 |
| PRODUCTIONBATCH | 178 | 01042 | Starch | 0001 | 3 | 169.89 |
| PRODUCTIONBATCH | 178 | 01043 | Sodium Chloride | 0001 | 50 | 13.75 |
| PRODUCTIONBATCH | 178 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| Productions | 178 | 03001 | Growth Promoter BOP Oral | 0001 | 250 | 17.34 |
| PACKING | 186 | 00016 | Growth Promoter 25kg | 0001 | 10 | 588.57 |
| PACKINGBATCH | 186 | 02032 | BAG Growth Promoter 25 KG | 0001 | 10 | 155 |
| PACKINGBATCH | 186 | 03001 | Growth Promoter BOP Oral | 0001 | 250 | 17.34 |
| PACKING | 186 | 00016 | Growth Promoter 25kg | 0001 | 10 | 588.57 |
| Productions | 179 | 03151 | Microgold-Bop | 0001 | 250 | 61 |
| PRODUCTIONBATCH | 179 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 179 | 01013 | Calcium Chloride | 0001 | 0 | 208.6 |
| PRODUCTIONBATCH | 179 | 01016 | DCP (Dana) | 0001 | 200 | 10 |
| PRODUCTIONBATCH | 179 | 01034 | Magnesium Sulphate | 0001 | 0 | 546.24 |
| PRODUCTIONBATCH | 179 | 01042 | Starch | 0001 | 3 | 169.89 |
| PRODUCTIONBATCH | 179 | 01043 | Sodium Chloride | 0001 | 50 | 13.75 |
| PRODUCTIONBATCH | 179 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,036.1 |
| PRODUCTIONBATCH | 179 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 179 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 179 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 179 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 179 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 179 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 179 | 01073 | Potassium Chloride | 0001 | 0 | 520 |
| PRODUCTIONBATCH | 179 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 179 | 03151 | Microgold-Bop | 0001 | 250 | 61 |
| PACKING | 187 | 00212 | Microgold-Bop 25 kg | 0001 | 10 | 1,679.98 |
| PACKINGBATCH | 187 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 187 | 03151 | Microgold-Bop | 0001 | 250 | 61 |
| Productions | 180 | 03109 | BOP Nephretic Powder | 0001 | 75 | 163.62 |
| PRODUCTIONBATCH | 180 | 01002 | Ammonium chloride | 0001 | 20 | 278.16 |
| PRODUCTIONBATCH | 180 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 180 | 01047 | Sodium Sulphate | 0001 | 45 | 68.08 |
| PRODUCTIONBATCH | 180 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 180 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 1 | 1,548.85 |
| PRODUCTIONBATCH | 180 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 180 | 03109 | BOP Nephretic Powder | 0001 | 75 | 163.62 |
| PACKING | 188 | 00121 | Nephretic 1kg powder | 0001 | 75 | 260.07 |
| PACKINGBATCH | 188 | 02076 | Unprint Packet 1kg | 0001 | 80 | 28.75 |
| PACKINGBATCH | 188 | 02094 | Label Nephretic 1 Kg | 0001 | 100 | 40 |
| PACKINGBATCH | 188 | 03109 | BOP Nephretic Powder | 0001 | 75 | 163.62 |
| PACKINGBATCH | 188 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 233.42 |
| PACKING | 188 | 00121 | Nephretic 1kg powder | 0001 | 75 | 260.07 |
| PurchasesBatch | 97 | 01075 | Peppermint Oil | 0001 | 3 | 4,500 |
| PurchasesBatch | 97 | 01019 | Eucluptus Oil | 0001 | 3 | 5,000 |
| PurchasesBatch | 97 | 01042 | Starch | 0001 | 50 | 164 |
| PurchasesBatch | 98 | 01184 | ARQ | 0001 | 30 | 366.67 |
| PurchasesBatch | 99 | 02097 | Bottle Round liter | 0001 | 720 | 185 |
| PurchasesBatch | 100 | 01038 | Phosphoric Acid 85% | 0001 | 70 | 650 |
| PurchasesBatch | 100 | 01041 | Sodium Benzoate | 0001 | 25 | 650 |
| PurchasesBatch | 100 | 01058 | Xanthan Gum | 0001 | 15 | 1,450 |
| PurchasesBatch | 100 | 01031 | Menthol Crystal | 0001 | 15 | 6,500 |
| PurchasesBatch | 100 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 6 | 1,550 |
| PurchasesBatch | 100 | 01201 | I.P.A | 0001 | 20 | 750 |
| PurchasesBatch | 100 | 01082 | Clove Oil | 0001 | 5 | 7,200 |
| PurchasesBatch | 100 | 01080 | Capsicum Oil | 0001 | 1 | 6,200 |
| PurchasesBatch | 100 | 01013 | Calcium Chloride | 0001 | 25 | 210 |
| PurchasesBatch | 100 | 01050 | Tartrazine Yellow Color Indian | 0001 | 5 | 3,100 |
| PurchasesBatch | 101 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 196 | 235 |
| PurchasesBatch | 102 | 02128 | White Can 25 Liter | 0001 | 126 | 1,065 |
| PurchasesBatch | 103 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 24 | 40 |
| PurchasesBatch | 103 | 02357 | Label Mento Respi Oral Liquid 5 Lit | 0001 | 12 | 40 |
| PurchasesBatch | 103 | 02272 | Label Stable C20  5Lit | 0001 | 12 | 40 |
| PurchasesBatch | 103 | 02289 | Label  Viro Immune Liquid 5L | 0001 | 12 | 40 |
| PurchasesBatch | 103 | 02028 | Label CID 7 (5)Lit | 0001 | 12 | 40 |
| PurchasesBatch | 103 | 02267 | Label Ex.Tox Liquid  5Lit | 0001 | 24 | 40 |
| PurchasesBatch | 103 | 02220 | Label Eggcelent Liquid 5 Litter | 0001 | 144 | 40 |
| PurchasesBatch | 103 | 02234 | Label Hepatic Optimizer fort 25kg | 0001 | 6 | 140 |
| PurchasesBatch | 103 | 02060 | Label Prime Grow Protein 25 kg | 0001 | 4 | 140 |
| PurchasesBatch | 103 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 10 | 140 |
| Productions | 181 | 03142 | Eggcelent liquid | 0001 | 500 | 130.44 |
| PRODUCTIONBATCH | 181 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 181 | 01013 | Calcium Chloride | 0001 | 12 | 209.76 |
| PRODUCTIONBATCH | 181 | 01038 | Phosphoric Acid 85% | 0001 | 60 | 650 |
| PRODUCTIONBATCH | 181 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 181 | 01104 | Lysine | 0001 | 1 | 1,100 |
| PRODUCTIONBATCH | 181 | 01176 | Cobalt Chloride | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 181 | 01034 | Magnesium Sulphate | 0001 | 5 | 546.24 |
| PRODUCTIONBATCH | 181 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.06 |
| PRODUCTIONBATCH | 181 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 181 | 01045 | Sorbitol Liquid 70% | 0001 | 20 | 421.7 |
| PACKING | 189 | 00197 | Eggcelent liquid 5 Liter | 0001 | 100 | 1,256.72 |
| PACKINGBATCH | 189 | 02014 | Plastic Can White 5 Liter | 0001 | 110 | 439.69 |
| PACKINGBATCH | 189 | 02220 | Label Eggcelent Liquid 5 Litter | 0001 | 144 | 40 |
| PACKINGBATCH | 189 | 03142 | Eggcelent liquid | 0001 | 500 | 130.44 |
| PACKINGBATCH | 189 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 27 | 234.35 |
| Productions | 182 | 03122 | Ex.Tox Liquid | 0001 | 80 | 24.96 |
| PRODUCTIONBATCH | 182 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 182 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 182 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 182 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 182 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 182 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 182 | 03122 | Ex.Tox Liquid | 0001 | 80 | 24.96 |
| PACKING | 190 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 16 | 697.72 |
| PACKINGBATCH | 190 | 02014 | Plastic Can White 5 Liter | 0001 | 16 | 439.69 |
| PACKINGBATCH | 190 | 02267 | Label Ex.Tox Liquid  5Lit | 0001 | 24 | 40 |
| PACKINGBATCH | 190 | 03122 | Ex.Tox Liquid | 0001 | 80 | 24.96 |
| PACKINGBATCH | 190 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 234.35 |
| PACKING | 190 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 16 | 697.72 |
| Productions | 183 | 03010 | Garlimint Plus BOP | 0001 | 40 | 164.26 |
| PRODUCTIONBATCH | 183 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 183 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 183 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 183 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 183 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 183 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,051.9 |
| PRODUCTIONBATCH | 183 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 183 | 03010 | Garlimint Plus BOP | 0001 | 40 | 164.26 |
| PACKING | 191 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 8 | 1,369.58 |
| PACKINGBATCH | 191 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 439.69 |
| PACKINGBATCH | 191 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 10 | 40 |
| PACKINGBATCH | 191 | 03010 | Garlimint Plus BOP | 0001 | 40 | 164.26 |
| PACKINGBATCH | 191 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 234.35 |
| PACKING | 191 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 8 | 1,369.58 |
| Productions | 184 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| PRODUCTIONBATCH | 184 | 01015 | DCP (Calcium) | 0001 | 500 | 17 |
| PACKING | 192 | 00231 | Calcium 72 25kg | 0001 | 20 | 465 |
| PACKINGBATCH | 192 | 02274 | Bag Calcium 72  25kg | 0001 | 10 | 80 |
| PACKINGBATCH | 192 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| Productions | 185 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.22 |
| PRODUCTIONBATCH | 185 | 01003 | Bentonite | 0001 | 250 | 13.22 |
| PACKING | 193 | 00022 | Magnet BOP 25kg | 0001 | 10 | 485.48 |
| PACKINGBATCH | 193 | 02033 | BAG Magnet 25 KG | 0001 | 10 | 155 |
| PACKINGBATCH | 193 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.22 |
| Productions | 186 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 20.42 |
| PRODUCTIONBATCH | 186 | 01003 | Bentonite | 0001 | 10 | 13.22 |
| PRODUCTIONBATCH | 186 | 01016 | DCP (Dana) | 0001 | 60 | 10 |
| PRODUCTIONBATCH | 186 | 01044 | Sodium Bicarbonate | 0001 | 6 | 128.03 |
| PRODUCTIONBATCH | 186 | 01015 | DCP (Calcium) | 0001 | 60 | 17 |
| PACKING | 194 | 00220 | Rumicid powder 25kg | 0001 | 5 | 705.64 |
| PACKINGBATCH | 194 | 02258 | Label Rumicid 25kg | 0001 | 5 | 40.16 |
| PACKINGBATCH | 194 | 02307 | Bag Bop Blue Colour | 0001 | 5 | 155 |
| PACKINGBATCH | 194 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 20.42 |
| PACKING | 194 | 00220 | Rumicid powder 25kg | 0001 | 5 | 705.64 |
| Productions | 187 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 250 | 16.81 |
| PRODUCTIONBATCH | 187 | 01003 | Bentonite | 0001 | 125 | 13.22 |
| PRODUCTIONBATCH | 187 | 01007 | CSL | 0001 | 5 | 35 |
| PRODUCTIONBATCH | 187 | 01015 | DCP (Calcium) | 0001 | 125 | 17 |
| PRODUCTIONBATCH | 187 | 01033 | Molasses | 0001 | 5 | 50 |
| Productions | 187 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 250 | 16.81 |
| PACKING | 195 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 000 | 10 | 621.09 |
| PACKINGBATCH | 195 | 02213 | Bag Bop Red Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 195 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 10 | 45.85 |
| PACKINGBATCH | 195 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 250 | 16.81 |
| PACKING | 195 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 000 | 10 | 621.09 |
| Productions | 188 | 03224 | IG Max Oral Liquid | 0001 | 240 | 81.73 |
| PRODUCTIONBATCH | 188 | 01023 | Garlic Oil | 0001 | 1 | 7,043.77 |
| PRODUCTIONBATCH | 188 | 01025 | Ginger Oil | 0001 | 1 | 7,200 |
| PRODUCTIONBATCH | 188 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 188 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 188 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 188 | 03224 | IG Max Oral Liquid | 0001 | 240 | 81.73 |
| PACKING | 196 | 00318 | IG Max Oral Liquid 1 Liter | 0001 | 240 | 285.89 |
| PACKINGBATCH | 196 | 02097 | Bottle Round liter | 0001 | 240 | 199.66 |
| PACKINGBATCH | 196 | 03224 | IG Max Oral Liquid | 0001 | 240 | 81.73 |
| PACKINGBATCH | 196 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 6 | 180 |
| PACKING | 196 | 00318 | IG Max Oral Liquid 1 Liter | 0001 | 240 | 285.89 |
| Productions | 189 | 03225 | Pulmonal Oral Liquid | 0001 | 240 | 271.37 |
| PRODUCTIONBATCH | 189 | 01031 | Menthol Crystal | 0001 | 2 | 6,500 |
| PRODUCTIONBATCH | 189 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 189 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 189 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.06 |
| PRODUCTIONBATCH | 189 | 01201 | I.P.A | 0001 | 20 | 750 |
| PRODUCTIONBATCH | 189 | 01189 | Glycerine | 0001 | 10 | 717.02 |
| PRODUCTIONBATCH | 189 | 01075 | Peppermint Oil | 0001 | 2 | 4,503.17 |
| PRODUCTIONBATCH | 189 | 01019 | Eucluptus Oil | 0001 | 2 | 5,000 |
| Productions | 189 | 03225 | Pulmonal Oral Liquid | 0001 | 240 | 271.37 |
| PACKING | 197 | 00319 | Pulmonal Oral Liquid 1 Liter | 0001 | 240 | 471.03 |
| PACKINGBATCH | 197 | 02097 | Bottle Round liter | 0001 | 240 | 199.66 |
| PACKINGBATCH | 197 | 03225 | Pulmonal Oral Liquid | 0001 | 240 | 271.37 |
| PACKING | 197 | 00319 | Pulmonal Oral Liquid 1 Liter | 0001 | 240 | 471.03 |
| Productions | 190 | 03223 | Tox End Oral Liquid | 0001 | 240 | 135.8 |
| PRODUCTIONBATCH | 190 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 190 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 190 | 01010 | Betaine | 0001 | 2 | 2,800 |
| PRODUCTIONBATCH | 190 | 01011 | Choline Chloride | 0001 | 4 | 4,840.92 |
| PRODUCTIONBATCH | 190 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 190 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 190 | 03223 | Tox End Oral Liquid | 0001 | 240 | 135.8 |
| PACKING | 198 | 00317 | Tox End Oral Liquid 1 Liter | 0001 | 240 | 335.46 |
| PACKINGBATCH | 198 | 02097 | Bottle Round liter | 0001 | 240 | 199.66 |
| PACKINGBATCH | 198 | 03223 | Tox End Oral Liquid | 0001 | 240 | 135.8 |
| PurchasesBatch | 104 | 01043 | Sodium Chloride | 0001 | 800 | 13.75 |
| PurchasesBatch | 105 | 02027 | Label Calci Phos D 5 Liter | 0001 | 100 | 40 |
| PurchasesBatch | 105 | 02440 | Label BOP DCAD Powder 25 kg | 0001 | 45 | 140 |
| PurchasesBatch | 106 | 01002 | Ammonium chloride | 0001 | 25 | 200 |
| PurchasesBatch | 106 | 01073 | Potassium Chloride | 0001 | 25 | 330 |
| PurchasesBatch | 107 | 01034 | Magnesium Sulphate | 0001 | 75 | 560 |
| PurchasesBatch | 107 | 01022 | Genshat Voilt (Crystal) | 0001 | 1 | 4,000 |
| PurchasesBatch | 107 | 01018 | Dextrose | 0001 | 25 | 560 |
| Productions | 191 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 50 | 16.81 |
| PRODUCTIONBATCH | 191 | 01003 | Bentonite | 0001 | 25 | 13.22 |
| PRODUCTIONBATCH | 191 | 01007 | CSL | 0001 | 1 | 35 |
| PRODUCTIONBATCH | 191 | 01015 | DCP (Calcium) | 0001 | 25 | 17 |
| PRODUCTIONBATCH | 191 | 01033 | Molasses | 0001 | 1 | 50 |
| Productions | 191 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 50 | 16.81 |
| PACKING | 199 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 2 | 621.09 |
| PACKINGBATCH | 199 | 02213 | Bag Bop Red Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 199 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 2 | 45.85 |
| PACKINGBATCH | 199 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 50 | 16.81 |
| PACKING | 199 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 2 | 621.09 |
| Productions | 192 | 03151 | Microgold-Bop | 0001 | 25 | 62.91 |
| PRODUCTIONBATCH | 192 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 192 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 192 | 01016 | DCP (Dana) | 0001 | 20 | 10 |
| PRODUCTIONBATCH | 192 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 192 | 01042 | Starch | 0001 | 0 | 168.72 |
| PRODUCTIONBATCH | 192 | 01043 | Sodium Chloride | 0001 | 5 | 13.75 |
| PRODUCTIONBATCH | 192 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,051.9 |
| PRODUCTIONBATCH | 192 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 192 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 192 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 192 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 192 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 192 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 192 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 192 | 01073 | Potassium Chloride | 0001 | 0 | 389.84 |
| PRODUCTIONBATCH | 192 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 192 | 03151 | Microgold-Bop | 0001 | 25 | 62.91 |
| PACKING | 200 | 00212 | Microgold-Bop 25 kg | 0001 | 1 | 1,727.64 |
| PACKINGBATCH | 200 | 02307 | Bag Bop Blue Colour | 0001 | 1 | 155 |
| PACKINGBATCH | 200 | 03151 | Microgold-Bop | 0001 | 25 | 62.91 |
| PACKING | 200 | 00212 | Microgold-Bop 25 kg | 0001 | 1 | 1,727.64 |
| Productions | 193 | 03270 | BOP DCAD Powder | 0001 | 1,000 | 71.62 |
| PRODUCTIONBATCH | 193 | 01002 | Ammonium chloride | 0001 | 25 | 234.83 |
| PRODUCTIONBATCH | 193 | 01003 | Bentonite | 0001 | 400 | 13.22 |
| PRODUCTIONBATCH | 193 | 01015 | DCP (Calcium) | 0001 | 530 | 17 |
| PRODUCTIONBATCH | 193 | 01034 | Magnesium Sulphate | 0001 | 75 | 556.06 |
| PRODUCTIONBATCH | 193 | 01073 | Potassium Chloride | 0001 | 25 | 389.84 |
| PACKING | 201 | 00377 | BOP DCAD Powder 25 kg | 0001 | 40 | 2,141.71 |
| PACKINGBATCH | 201 | 02277 | Bag Bop Yellow Colour | 0001 | 50 | 155 |
| PACKINGBATCH | 201 | 02440 | Label BOP DCAD Powder 25 kg | 0001 | 45 | 140 |
| PACKINGBATCH | 201 | 03270 | BOP DCAD Powder | 0001 | 1,000 | 71.62 |
| Productions | 194 | 03019 | Super Yeast Powder | 0001 | 25 | 47.2 |
| PRODUCTIONBATCH | 194 | 01003 | Bentonite | 0001 | 25 | 13.22 |
| PRODUCTIONBATCH | 194 | 01033 | Molasses | 0001 | 2 | 50 |
| PRODUCTIONBATCH | 194 | 01059 | Wheat Bran | 0001 | 10 | 72.45 |
| Productions | 194 | 03019 | Super Yeast Powder | 0001 | 25 | 47.2 |
| PACKING | 202 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,374.95 |
| PACKINGBATCH | 202 | 02042 | Label Super Yeast 25 KG | 0001 | 1 | 40 |
| PACKINGBATCH | 202 | 02213 | Bag Bop Red Colour | 0001 | 1 | 155 |
| PACKINGBATCH | 202 | 03019 | Super Yeast Powder | 0001 | 25 | 47.2 |
| PACKING | 202 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,374.95 |
| Productions | 195 | 03001 | Growth Promoter BOP Oral | 0001 | 2,275 | 10.68 |
| PRODUCTIONBATCH | 195 | 01016 | DCP (Dana) | 0001 | 301 | 10 |
| PRODUCTIONBATCH | 195 | 01042 | Starch | 0001 | 27 | 168.72 |
| PRODUCTIONBATCH | 195 | 01043 | Sodium Chloride | 0001 | 455 | 13.75 |
| PRODUCTIONBATCH | 195 | 01050 | Tartrazine Yellow Color Indian | 0001 | 3 | 3,051.9 |
| PACKING | 203 | 00016 | Growth Promoter 25kg | 0001 | 91 | 421.89 |
| PACKINGBATCH | 203 | 02032 | BAG Growth Promoter 25 KG | 0001 | 91 | 155 |
| PACKINGBATCH | 203 | 03001 | Growth Promoter BOP Oral | 0001 | 2,275 | 10.68 |
| Productions | 196 | 03003 | Calci-Phos-D | 0001 | 320 | 33.76 |
| PRODUCTIONBATCH | 196 | 01013 | Calcium Chloride | 0001 | 4 | 209.76 |
| PRODUCTIONBATCH | 196 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 196 | 01038 | Phosphoric Acid 85% | 0001 | 4 | 650 |
| PRODUCTIONBATCH | 196 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 196 | 01048 | Titanium Dioxide (T.T) | 0001 | 1 | 1,500 |
| PRODUCTIONBATCH | 196 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 196 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.06 |
| Productions | 196 | 03003 | Calci-Phos-D | 0001 | 320 | 33.76 |
| PACKING | 204 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 248.84 |
| PACKINGBATCH | 204 | 02097 | Bottle Round liter | 0001 | 120 | 199.66 |
| PACKINGBATCH | 204 | 03003 | Calci-Phos-D | 0001 | 120 | 33.76 |
| PACKINGBATCH | 204 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 10 | 185 |
| PACKING | 204 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 248.84 |
| PACKING | 205 | 00049 | Calci-Phos-D 5 Lit | 0001 | 40 | 717.07 |
| PACKINGBATCH | 205 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 439.69 |
| PACKINGBATCH | 205 | 02027 | Label Calci Phos D 5 Liter | 0001 | 50 | 40 |
| PACKINGBATCH | 205 | 03003 | Calci-Phos-D | 0001 | 200 | 33.76 |
| PACKINGBATCH | 205 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 234.35 |
| PACKING | 205 | 00049 | Calci-Phos-D 5 Lit | 0001 | 40 | 717.07 |
| PurchasesBatch | 108 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 10 | 140 |
| PurchasesBatch | 108 | 02058 | Label Magnet Plus 25 Kg | 0001 | 6 | 140 |
| PurchasesBatch | 108 | 02329 | Label Merlin Fix Oral Powder 25 kg | 0001 | 25 | 240 |
| PurchasesBatch | 108 | 02291 | Label Super Yeast Liquid 5 Liter | 0001 | 64 | 40 |
| PurchasesBatch | 108 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PurchasesBatch | 108 | 00374 | Renu Guard Bucket Label | 0001 | 15 | 75 |
| PurchasesBatch | 108 | 02438 | Label BOP TOX Oral Powder 25 kg | 0001 | 6 | 140 |
| PurchasesBatch | 109 | 01019 | Eucluptus Oil | 0001 | 3 | 5,000 |
| PurchasesBatch | 109 | 01075 | Peppermint Oil | 0001 | 3 | 4,500 |
| PurchasesBatch | 109 | 01047 | Sodium Sulphate | 0001 | 150 | 68 |
| PurchasesBatch | 110 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| PurchasesBatch | 110 | 01201 | I.P.A | 0001 | 15 | 750 |
| PurchasesBatch | 110 | 01187 | Sodium Metaby Sulphate | 0001 | 25 | 400 |
| PurchasesBatch | 111 | 02054 | White Bag Unprint | 0001 | 27 | 200 |
| PurchasesBatch | 112 | 02014 | Plastic Can White 5 Liter | 0001 | 510 | 440 |
| Productions | 197 | 03190 | CRD Mint Oral Liquid | 0001 | 300 | 264.48 |
| PRODUCTIONBATCH | 197 | 01019 | Eucluptus Oil | 0001 | 4 | 5,000 |
| PRODUCTIONBATCH | 197 | 01031 | Menthol Crystal | 0001 | 3 | 6,500 |
| PRODUCTIONBATCH | 197 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 197 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 197 | 01075 | Peppermint Oil | 0001 | 3 | 4,500.76 |
| PRODUCTIONBATCH | 197 | 01189 | Glycerine | 0001 | 15 | 717.02 |
| PRODUCTIONBATCH | 197 | 01201 | I.P.A | 0001 | 15 | 750 |
| PACKING | 206 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 60 | 1,935.36 |
| PACKINGBATCH | 206 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 439.91 |
| PACKINGBATCH | 206 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 80 | 80 |
| PACKINGBATCH | 206 | 03190 | CRD Mint Oral Liquid | 0001 | 300 | 264.48 |
| PACKINGBATCH | 206 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 17 | 234.35 |
| PACKING | 206 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 60 | 1,935.36 |
| Productions | 198 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 84.24 |
| PRODUCTIONBATCH | 198 | 01009 | Copper Sulphate | 0001 | 3 | 2,176.63 |
| PRODUCTIONBATCH | 198 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 198 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 421.7 |
| PRODUCTIONBATCH | 198 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 198 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 84.24 |
| PACKING | 207 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 001 | 20 | 1,051.42 |
| PACKINGBATCH | 207 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 439.91 |
| PACKINGBATCH | 207 | 02435 | Label CS Guard 20 Oral Liquid 5 Lit | 0001 | 30 | 80 |
| PACKINGBATCH | 207 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 84.24 |
| PACKINGBATCH | 207 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 234.35 |
| PACKING | 207 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 001 | 20 | 1,051.42 |
| Productions | 199 | 03266 | Vital Frame Oral Liquid | 0001 | 100 | 21.59 |
| PRODUCTIONBATCH | 199 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 199 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 199 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 199 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 199 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 199 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 199 | 03266 | Vital Frame Oral Liquid | 0001 | 100 | 21.59 |
| PACKING | 208 | 00372 | Vital Frame Oral Liquid 5 Lit | 0001 | 20 | 757.86 |
| PACKINGBATCH | 208 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 439.91 |
| PACKINGBATCH | 208 | 02436 | Label Vital Frame Oral Liquid 5 Lit | 0001 | 32 | 80 |
| PACKINGBATCH | 208 | 03266 | Vital Frame Oral Liquid | 0001 | 100 | 21.59 |
| PACKINGBATCH | 208 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 7 | 234.35 |
| PACKING | 208 | 00372 | Vital Frame Oral Liquid 5 Lit | 0001 | 20 | 757.86 |
| OpeningBatch | 108 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 150 | 5,000 |
| Productions | 200 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 152.79 |
| PRODUCTIONBATCH | 200 | 01002 | Ammonium chloride | 0001 | 20 | 259.87 |
| PRODUCTIONBATCH | 200 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 200 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 200 | 01047 | Sodium Sulphate | 0001 | 135 | 68 |
| PRODUCTIONBATCH | 200 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 5 | 1,549.33 |
| PRODUCTIONBATCH | 200 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 200 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 152.79 |
| PACKING | 209 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 244.62 |
| PACKINGBATCH | 209 | 02341 | Packet Reno Gurd Flush Oral Powder 1 kg | 0001 | 55 | 30 |
| PACKINGBATCH | 209 | 03197 | Reno Gurd Flush Oral Powder | 0001 | 150 | 152.79 |
| PACKINGBATCH | 209 | 00374 | Renu Guard Bucket Label | 0001 | 15 | 75 |
| PACKINGBATCH | 209 | 02140 | Bucket Large | 0001 | 10 | 1,100 |
| PACKING | 209 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 244.62 |
| Productions | 201 | 03268 | BOP TOX Oral Powder | 0001 | 75 | 13.22 |
| PRODUCTIONBATCH | 201 | 01003 | Bentonite | 0001 | 75 | 13.22 |
| Productions | 201 | 03268 | BOP TOX Oral Powder | 0001 | 75 | 13.22 |
| PACKING | 210 | 00375 | BOP TOX Oral Powder 25 kg | 0001 | 3 | 718.81 |
| PACKINGBATCH | 210 | 02277 | Bag Bop Yellow Colour | 0001 | 3 | 155 |
| PACKINGBATCH | 210 | 02438 | Label BOP TOX Oral Powder 25 kg | 0001 | 5 | 140 |
| PACKINGBATCH | 210 | 03268 | BOP TOX Oral Powder | 0001 | 75 | 13.22 |
| PACKING | 210 | 00375 | BOP TOX Oral Powder 25 kg | 0001 | 3 | 718.81 |
| Productions | 202 | 03163 | Calcium 72 | 0001 | 750 | 17 |
| PRODUCTIONBATCH | 202 | 01015 | DCP (Calcium) | 0001 | 750 | 17 |
| PACKING | 211 | 00231 | Calcium 72 25kg | 0001 | 30 | 433 |
| PACKINGBATCH | 211 | 02274 | Bag Calcium 72  25kg | 0001 | 3 | 80 |
| PACKINGBATCH | 211 | 03163 | Calcium 72 | 0001 | 750 | 17 |
| Productions | 203 | 03045 | Magnet Plus Oral Powder | 0001 | 50 | 13.98 |
| PRODUCTIONBATCH | 203 | 01003 | Bentonite | 0001 | 40 | 13.22 |
| PRODUCTIONBATCH | 203 | 01015 | DCP (Calcium) | 0001 | 10 | 17 |
| PACKING | 212 | 00074 | Magnet Plus 25 Kg | 0001 | 2 | 924.38 |
| PACKINGBATCH | 212 | 02058 | Label Magnet Plus 25 Kg | 0001 | 6 | 140 |
| PACKINGBATCH | 212 | 02307 | Bag Bop Blue Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 212 | 03045 | Magnet Plus Oral Powder | 0001 | 50 | 13.98 |
| Productions | 204 | 03011 | Hepatic-Optimizer Liquid | 0001 | 40 | 129.36 |
| PRODUCTIONBATCH | 204 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 204 | 01011 | Choline Chloride | 0001 | 0 | 4,840.92 |
| PRODUCTIONBATCH | 204 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 204 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 204 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 204 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 204 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 204 | 01184 | ARQ | 0001 | 2 | 366.67 |
| Productions | 204 | 03011 | Hepatic-Optimizer Liquid | 0001 | 40 | 129.36 |
| PACKING | 213 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 8 | 1,204.58 |
| PACKINGBATCH | 213 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 439.91 |
| PACKINGBATCH | 213 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 12 | 20 |
| PACKINGBATCH | 213 | 03011 | Hepatic-Optimizer Liquid | 0001 | 40 | 129.36 |
| PACKINGBATCH | 213 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 234.35 |
| PACKING | 213 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 8 | 1,204.58 |
| Productions | 205 | 03010 | Garlimint Plus BOP | 0001 | 60 | 156.01 |
| PRODUCTIONBATCH | 205 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 205 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 205 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 205 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 205 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,051.9 |
| PRODUCTIONBATCH | 205 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 205 | 03010 | Garlimint Plus BOP | 0001 | 60 | 156.01 |
| PACKING | 214 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 12 | 1,364.27 |
| PACKINGBATCH | 214 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 439.91 |
| PACKINGBATCH | 214 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 14 | 40 |
| PACKINGBATCH | 214 | 03010 | Garlimint Plus BOP | 0001 | 60 | 156.01 |
| PACKINGBATCH | 214 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 234.35 |
| PACKING | 214 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 12 | 1,364.27 |
| Productions | 206 | 03120 | E.S 200 Liquid | 0001 | 20 | 55.68 |
| PRODUCTIONBATCH | 206 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 206 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 206 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.33 |
| PRODUCTIONBATCH | 206 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 206 | 03120 | E.S 200 Liquid | 0001 | 20 | 55.68 |
| PACKING | 215 | 00266 | E.S  200 liquid 5 Liter | 0001 | 4 | 1,012.66 |
| PACKINGBATCH | 215 | 02014 | Plastic Can White 5 Liter | 0001 | 4 | 439.91 |
| PACKINGBATCH | 215 | 02271 | Label E.S 200 5Lit | 0001 | 6 | 40 |
| PACKINGBATCH | 215 | 03120 | E.S 200 Liquid | 0001 | 20 | 55.68 |
| PACKINGBATCH | 215 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 234.35 |
| PACKING | 215 | 00266 | E.S  200 liquid 5 Liter | 0001 | 4 | 1,012.66 |
| Productions | 207 | 03116 | Mento Respi Liquid | 0001 | 40 | 211.16 |
| PRODUCTIONBATCH | 207 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 207 | 01031 | Menthol Crystal | 0001 | 0 | 6,500 |
| PRODUCTIONBATCH | 207 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 207 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 207 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 207 | 03116 | Mento Respi Liquid | 0001 | 40 | 211.16 |
| PACKING | 216 | 00163 | Mento Respi Liquid 5 Lit | 0001 | 8 | 1,702.19 |
| PACKINGBATCH | 216 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 439.91 |
| PACKINGBATCH | 216 | 02357 | Label Mento Respi Oral Liquid 5 Lit | 0001 | 12 | 40 |
| PACKINGBATCH | 216 | 03116 | Mento Respi Liquid | 0001 | 40 | 211.16 |
| PACKINGBATCH | 216 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 234.35 |
| PACKING | 216 | 00163 | Mento Respi Liquid 5 Lit | 0001 | 8 | 1,702.2 |
| Productions | 208 | 03029 | CID-7 Oral Liquid | 0001 | 20 | 25.17 |
| PRODUCTIONBATCH | 208 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 208 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 208 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.62 |
| PRODUCTIONBATCH | 208 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 208 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 208 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 208 | 03029 | CID-7 Oral Liquid | 0001 | 20 | 25.17 |
| PACKING | 217 | 00072 | CID 7 Oral Liquid 5 Liter | 0001 | 4 | 802.93 |
| PACKINGBATCH | 217 | 02014 | Plastic Can White 5 Liter | 0001 | 4 | 439.91 |
| PACKINGBATCH | 217 | 02028 | Label CID 7 (5)Lit | 0001 | 12 | 40 |
| PACKINGBATCH | 217 | 03029 | CID-7 Oral Liquid | 0001 | 20 | 25.17 |
| PACKINGBATCH | 217 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 234.35 |
| PACKING | 217 | 00072 | CID 7 Oral Liquid 5 Liter | 0001 | 4 | 802.94 |
| Productions | 209 | 03147 | Hepatic Optimizer fort Powder | 0001 | 50 | 13.22 |
| PRODUCTIONBATCH | 209 | 01003 | Bentonite | 0001 | 50 | 13.22 |
| PACKING | 218 | 00209 | Hepatic Optimizer fort Powder 25kg | 0001 | 2 | 905.48 |
| PACKINGBATCH | 218 | 02234 | Label Hepatic Optimizer fort 25kg | 0001 | 6 | 140 |
| PACKINGBATCH | 218 | 02307 | Bag Bop Blue Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 218 | 03147 | Hepatic Optimizer fort Powder | 0001 | 50 | 13.22 |
| Productions | 210 | 03053 | Prime Grow Protein | 0001 | 50 | 35.84 |
| PRODUCTIONBATCH | 210 | 01003 | Bentonite | 0001 | 10 | 13.22 |
| PRODUCTIONBATCH | 210 | 01015 | DCP (Calcium) | 0001 | 40 | 17 |
| PRODUCTIONBATCH | 210 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 210 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 210 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| Productions | 210 | 03053 | Prime Grow Protein | 0001 | 50 | 35.84 |
| PACKING | 219 | 00076 | Prime Grow Protein 25 kg | 0001 | 2 | 1,376.08 |
| PACKINGBATCH | 219 | 02054 | White Bag Unprint | 0001 | 2 | 200 |
| PACKINGBATCH | 219 | 02060 | Label Prime Grow Protein 25 kg | 0001 | 4 | 140 |
| PACKINGBATCH | 219 | 03053 | Prime Grow Protein | 0001 | 50 | 35.84 |
| PACKING | 219 | 00076 | Prime Grow Protein 25 kg | 0001 | 2 | 1,376.08 |
| Productions | 211 | 03189 | Merlin Fix Oral Powder | 0001 | 500 | 23.36 |
| PRODUCTIONBATCH | 211 | 01003 | Bentonite | 0001 | 500 | 13.22 |
| PRODUCTIONBATCH | 211 | 01115 | Calcium Propionate | 0001 | 1 | 1,200 |
| PRODUCTIONBATCH | 211 | 01187 | Sodium Metaby Sulphate | 0001 | 10 | 387.09 |
| PACKING | 220 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 1,134.02 |
| PACKINGBATCH | 220 | 02054 | White Bag Unprint | 0001 | 25 | 200 |
| PACKINGBATCH | 220 | 02329 | Label Merlin Fix Oral Powder 25 kg | 0001 | 25 | 240 |
| PACKINGBATCH | 220 | 03189 | Merlin Fix Oral Powder | 0001 | 500 | 23.36 |
| Productions | 212 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 75 | 20.78 |
| PRODUCTIONBATCH | 212 | 01003 | Bentonite | 0001 | 37 | 13.22 |
| PRODUCTIONBATCH | 212 | 01007 | CSL | 0001 | 5 | 35 |
| PRODUCTIONBATCH | 212 | 01015 | DCP (Calcium) | 0001 | 37 | 17 |
| PRODUCTIONBATCH | 212 | 01033 | Molasses | 0001 | 5 | 50 |
| Productions | 212 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 75 | 20.78 |
| PACKING | 221 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 3 | 753.79 |
| PACKINGBATCH | 221 | 02213 | Bag Bop Red Colour | 0001 | 3 | 155 |
| PACKINGBATCH | 221 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 5 | 47.63 |
| PACKINGBATCH | 221 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 75 | 20.78 |
| PACKING | 221 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 3 | 753.79 |
| PurchasesBatch | 113 | 02258 | Label Rumicid 25kg | 0001 | 20 | 140 |
| PurchasesBatch | 113 | 02245 | Label Microgold-Bop 25 kg | 0001 | 365 | 40 |
| PurchasesBatch | 113 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 386 | 40 |
| OpeningBatch | 111 | 00369 | Febro Meon Spray 120 ML | 0001 | 5,080 | 300 |
| OpeningBatch | 15 | 01016 | DCP (Dana) | 0001 | 30,000 | 10 |
| Productions | 213 | 03021 | Vital Gold | 0001 | 4,360 | 61.61 |
| PRODUCTIONBATCH | 213 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 213 | 01013 | Calcium Chloride | 0001 | 2 | 209.76 |
| PRODUCTIONBATCH | 213 | 01016 | DCP (Dana) | 0001 | 3,488 | 10 |
| PRODUCTIONBATCH | 213 | 01034 | Magnesium Sulphate | 0001 | 8 | 556.06 |
| PRODUCTIONBATCH | 213 | 01042 | Starch | 0001 | 52 | 168.72 |
| PRODUCTIONBATCH | 213 | 01043 | Sodium Chloride | 0001 | 872 | 13.75 |
| PRODUCTIONBATCH | 213 | 01050 | Tartrazine Yellow Color Indian | 0001 | 6 | 3,051.9 |
| PRODUCTIONBATCH | 213 | 01052 | Vitamin A | 0001 | 2 | 14,500 |
| PRODUCTIONBATCH | 213 | 01053 | Vitamin B1 | 0001 | 2 | 17,499.52 |
| PRODUCTIONBATCH | 213 | 01054 | Vitamin B2 | 0001 | 1 | 17,499.11 |
| PRODUCTIONBATCH | 213 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 213 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 213 | 01072 | Vitamin E | 0001 | 1 | 9,500 |
| PRODUCTIONBATCH | 213 | 01073 | Potassium Chloride | 0001 | 1 | 389.84 |
| PRODUCTIONBATCH | 213 | 01143 | Vitamin B3 | 0001 | 13 | 3,200 |
| PACKING | 222 | 00026 | Vital Gold 1kg | 0001 | 1,860 | 61.61 |
| PACKINGBATCH | 222 | 03021 | Vital Gold | 0001 | 1,860 | 61.61 |
| PACKING | 223 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,540.15 |
| PACKINGBATCH | 223 | 03021 | Vital Gold | 0001 | 2,500 | 61.61 |
| PACKING | 223 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,540.15 |
| Productions | 214 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 19.89 |
| PRODUCTIONBATCH | 214 | 01003 | Bentonite | 0001 | 2 | 13.22 |
| PRODUCTIONBATCH | 214 | 01016 | DCP (Dana) | 0001 | 130 | 10 |
| PRODUCTIONBATCH | 214 | 01044 | Sodium Bicarbonate | 0001 | 12 | 128.03 |
| PRODUCTIONBATCH | 214 | 01015 | DCP (Calcium) | 0001 | 120 | 17 |
| Productions | 214 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 19.89 |
| PACKING | 224 | 00220 | Rumicid powder 25kg | 0001 | 10 | 731.91 |
| PACKINGBATCH | 224 | 02258 | Label Rumicid 25kg | 0001 | 15 | 53.04 |
| PACKINGBATCH | 224 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 224 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 19.89 |
| PACKING | 224 | 00220 | Rumicid powder 25kg | 0001 | 10 | 731.91 |
| Productions | 215 | 03019 | Super Yeast Powder | 0001 | 25 | 40.59 |
| PRODUCTIONBATCH | 215 | 01003 | Bentonite | 0001 | 12 | 13.22 |
| PRODUCTIONBATCH | 215 | 01033 | Molasses | 0001 | 2 | 50 |
| PRODUCTIONBATCH | 215 | 01059 | Wheat Bran | 0001 | 10 | 72.45 |
| Productions | 215 | 03019 | Super Yeast Powder | 0001 | 25 | 40.59 |
| PACKING | 225 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,209.72 |
| PACKINGBATCH | 225 | 02042 | Label Super Yeast 25 KG | 0001 | 1 | 40 |
| PACKINGBATCH | 225 | 02213 | Bag Bop Red Colour | 0001 | 1 | 155 |
| PACKINGBATCH | 225 | 03019 | Super Yeast Powder | 0001 | 25 | 40.59 |
| PACKING | 225 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,209.71 |
| Productions | 216 | 03014 | Magnet BOP Oral Powder | 0001 | 25 | 13.22 |
| PRODUCTIONBATCH | 216 | 01003 | Bentonite | 0001 | 25 | 13.22 |
| Productions | 216 | 03014 | Magnet BOP Oral Powder | 0001 | 25 | 13.22 |
| PACKING | 226 | 00022 | Magnet BOP 25kg | 0001 | 1 | 485.48 |
| PACKINGBATCH | 226 | 02033 | BAG Magnet 25 KG | 0001 | 1 | 155 |
| PACKINGBATCH | 226 | 03014 | Magnet BOP Oral Powder | 0001 | 25 | 13.22 |
| PACKING | 226 | 00022 | Magnet BOP 25kg | 0001 | 1 | 485.48 |
| Productions | 217 | 03018 | Scour Guard | 0001 | 80 | 65.19 |
| PRODUCTIONBATCH | 217 | 01027 | Kaolin | 0001 | 8 | 382.05 |
| PRODUCTIONBATCH | 217 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 217 | 01043 | Sodium Chloride | 0001 | 7 | 13.75 |
| PRODUCTIONBATCH | 217 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,051.9 |
| PRODUCTIONBATCH | 217 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 217 | 01073 | Potassium Chloride | 0001 | 3 | 389.84 |
| Productions | 217 | 03018 | Scour Guard | 0001 | 80 | 65.19 |
| PACKING | 227 | 00008 | Scour Guard100ML | 0001 | 800 | 31.4 |
| PACKINGBATCH | 227 | 02020 | S+D Scour Guard100 ML | 0001 | 850 | 12 |
| PACKINGBATCH | 227 | 03018 | Scour Guard | 0001 | 80 | 65.19 |
| PACKINGBATCH | 227 | 02010 | Bottle Pet Amber 100ML | 0001 | 850 | 9.12 |
| PACKINGBATCH | 227 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 9 | 217 |
| PurchasesBatch | 114 | 01019 | Eucluptus Oil | 0001 | 1 | 5,500 |
| PurchasesBatch | 114 | 01075 | Peppermint Oil | 0001 | 1 | 5,500 |
| PurchasesBatch | 114 | 01070 | Anise Oil | 0001 | 1 | 5,000 |
| PurchasesBatch | 114 | 01028 | Lactic Acid | 0001 | 60 | 1,650 |
| PurchasesBatch | 114 | 01050 | Tartrazine Yellow Color Indian | 0001 | 25 | 3,100 |
| PurchasesBatch | 115 | 01020 | Formic Acid | 0001 | 595 | 350 |
| PurchasesBatch | 115 | 01184 | ARQ | 0001 | 90 | 366.67 |
| PurchasesBatch | 116 | 02366 | Label Levo Care Oral Liquid 5 Lit | 0001 | 30 | 40 |
| PurchasesBatch | 116 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 60 | 40 |
| PurchasesBatch | 116 | 02346 | Label VETLIV Oral Solution 5 Lit | 0001 | 280 | 40 |
| PurchasesBatch | 116 | 02265 | Label Garliment Plus 1Liter | 0001 | 140 | 40 |
| PurchasesBatch | 116 | 02220 | Label Eggcelent Liquid 5 Litter | 0001 | 140 | 40 |
| PurchasesBatch | 116 | 02441 | Label Liv Guard Oral Liquid 1 Lit | 0001 | 70 | 40 |
| PurchasesBatch | 116 | 02442 | Label Aspolite C Oral Liquid 1 Lit | 0001 | 140 | 40 |
| PurchasesBatch | 116 | 02258 | Label Rumicid 25kg | 0001 | 300 | 40 |
| PurchasesBatch | 116 | 02385 | Label Calci Phos D 1 Lit | 0001 | 400 | 20 |
| PurchasesBatch | 116 | 02027 | Label Calci Phos D 5 Liter | 0001 | 400 | 20 |
| PurchasesBatch | 116 | 02405 | Label JELITO Liquid 25 Lit | 0001 | 60 | 75 |
| PurchasesBatch | 117 | 02014 | Plastic Can White 5 Liter | 0001 | 391 | 440 |
| PurchasesBatch | 117 | 02097 | Bottle Round liter | 0001 | 660 | 230 |
| Productions | 218 | 03217 | Levo Care Oral Liquid | 0001 | 100 | 206.46 |
| PRODUCTIONBATCH | 218 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 218 | 01038 | Phosphoric Acid 85% | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 218 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 218 | 01045 | Sorbitol Liquid 70% | 0001 | 3 | 421.7 |
| PRODUCTIONBATCH | 218 | 01046 | Silmyrin | 0001 | 1 | 13,130.73 |
| PRODUCTIONBATCH | 218 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 218 | 01184 | ARQ | 0001 | 3 | 366.67 |
| Productions | 218 | 03217 | Levo Care Oral Liquid | 0001 | 100 | 206.46 |
| PACKING | 228 | 00309 | Levo Care Oral Liquid 5 Lit | 0001 | 20 | 1,614.26 |
| PACKINGBATCH | 228 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 439.94 |
| PACKINGBATCH | 228 | 02366 | Label Levo Care Oral Liquid 5 Lit | 0001 | 30 | 40 |
| PACKINGBATCH | 228 | 03217 | Levo Care Oral Liquid | 0001 | 100 | 206.46 |
| PACKINGBATCH | 228 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 7 | 234.35 |
| PACKING | 228 | 00309 | Levo Care Oral Liquid 5 Lit | 0001 | 20 | 1,614.26 |
| Productions | 219 | 03094 | Super Copper Liquid | 001 | 120 | 161.52 |
| PRODUCTIONBATCH | 219 | 01004 | Citric Acid | 0001 | 2 | 400 |
| PRODUCTIONBATCH | 219 | 01009 | Copper Sulphate | 0001 | 1 | 2,176.63 |
| PRODUCTIONBATCH | 219 | 01028 | Lactic Acid | 0001 | 7 | 1,650 |
| PRODUCTIONBATCH | 219 | 01045 | Sorbitol Liquid 70% | 0001 | 6 | 421.7 |
| PRODUCTIONBATCH | 219 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 219 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| Productions | 219 | 03094 | Super Copper Liquid | 001 | 120 | 161.52 |
| PACKING | 229 | 00206 | Super Copper Liquid 1Lit | 0001 | 120 | 421.64 |
| PACKINGBATCH | 229 | 02097 | Bottle Round liter | 0001 | 120 | 222.21 |
| PACKINGBATCH | 229 | 02403 | Label Super Copper 1Lit | 0001 | 135 | 20 |
| PACKINGBATCH | 229 | 03094 | Super Copper Liquid | 001 | 120 | 161.52 |
| PACKINGBATCH | 229 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 10 | 185 |
| PACKING | 229 | 00206 | Super Copper Liquid 1Lit | 0001 | 120 | 421.64 |
| Productions | 220 | 03236 | LivGuard Oral Liquid | 0001 | 60 | 87.09 |
| PRODUCTIONBATCH | 220 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 220 | 01011 | Choline Chloride | 0001 | 0 | 4,840.92 |
| PRODUCTIONBATCH | 220 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 220 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 220 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 220 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 220 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 220 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 220 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 220 | 01184 | ARQ | 0001 | 6 | 366.67 |
| Productions | 220 | 03236 | LivGuard Oral Liquid | 0001 | 60 | 87.09 |
| PACKING | 230 | 00378 | Liv Guard Oral Liquid 1 Lit | 0001 | 60 | 374.46 |
| PACKINGBATCH | 230 | 02097 | Bottle Round liter | 0001 | 60 | 222.21 |
| PACKINGBATCH | 230 | 02441 | Label Liv Guard Oral Liquid 1 Lit | 0001 | 70 | 40 |
| PACKINGBATCH | 230 | 03236 | LivGuard Oral Liquid | 0001 | 60 | 87.09 |
| PACKINGBATCH | 230 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 6 | 185 |
| PACKING | 230 | 00378 | Liv Guard Oral Liquid 1 Lit | 0001 | 60 | 374.46 |
| Productions | 221 | 03028 | O-D Plus Oral Liquid | 0001 | 120 | 274.39 |
| PRODUCTIONBATCH | 221 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 221 | 01019 | Eucluptus Oil | 0001 | 1 | 5,473.93 |
| PRODUCTIONBATCH | 221 | 01031 | Menthol Crystal | 0001 | 1 | 6,500 |
| PRODUCTIONBATCH | 221 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 221 | 01045 | Sorbitol Liquid 70% | 0001 | 6 | 421.7 |
| PRODUCTIONBATCH | 221 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 221 | 01070 | Anise Oil | 0001 | 1 | 5,000 |
| PRODUCTIONBATCH | 221 | 01075 | Peppermint Oil | 0001 | 1 | 5,192.28 |
| Productions | 221 | 03028 | O-D Plus Oral Liquid | 0001 | 120 | 274.39 |
| PACKING | 231 | 00226 | O-D Plus Liquid 1lit | 0001 | 120 | 512.02 |
| PACKINGBATCH | 231 | 02097 | Bottle Round liter | 0001 | 120 | 222.21 |
| PACKINGBATCH | 231 | 03028 | O-D Plus Oral Liquid | 0001 | 120 | 274.39 |
| PACKINGBATCH | 231 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 10 | 185 |
| PACKING | 231 | 00226 | O-D Plus Liquid 1lit | 0001 | 120 | 512.02 |
| Productions | 222 | 03202 | VETLIV Oral Solution | 0001 | 1,000 | 89.96 |
| PRODUCTIONBATCH | 222 | 01009 | Copper Sulphate | 0001 | 2 | 2,176.63 |
| PRODUCTIONBATCH | 222 | 01010 | Betaine | 0001 | 8 | 2,800 |
| PRODUCTIONBATCH | 222 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 222 | 01020 | Formic Acid | 0001 | 3 | 350 |
| PRODUCTIONBATCH | 222 | 01028 | Lactic Acid | 0001 | 11 | 1,650 |
| PRODUCTIONBATCH | 222 | 01041 | Sodium Benzoate | 0001 | 5 | 650 |
| PRODUCTIONBATCH | 222 | 01045 | Sorbitol Liquid 70% | 0001 | 10 | 421.7 |
| PRODUCTIONBATCH | 222 | 01058 | Xanthan Gum | 0001 | 4 | 1,450.06 |
| PRODUCTIONBATCH | 222 | 01105 | Sodium Citrate | 0001 | 2 | 414.59 |
| PRODUCTIONBATCH | 222 | 01184 | ARQ | 0001 | 80 | 366.67 |
| PACKING | 232 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 200 | 1,060.03 |
| PACKINGBATCH | 232 | 02014 | Plastic Can White 5 Liter | 0001 | 220 | 439.94 |
| PACKINGBATCH | 232 | 02346 | Label VETLIV Oral Solution 5 Lit | 0001 | 280 | 40 |
| PACKINGBATCH | 232 | 03202 | VETLIV Oral Solution | 0001 | 1,000 | 89.96 |
| PACKINGBATCH | 232 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 60 | 234.35 |
| PACKING | 232 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 200 | 1,060.03 |
| Productions | 223 | 03002 | DCP Powder | 0001 | 1,250 | 11.96 |
| PRODUCTIONBATCH | 223 | 01190 | PHOSPHORUS Powder 29% | 0001 | 1,300 | 11.5 |
| PACKING | 233 | 00019 | DCP BOP 25kg | 0001 | 50 | 379 |
| PACKINGBATCH | 233 | 02034 | BAG BOP DCP 25 KG | 0001 | 50 | 80 |
| PACKINGBATCH | 233 | 03002 | DCP Powder | 0001 | 1,250 | 11.96 |
| Productions | 224 | 03024 | Bio Fat | 0001 | 425 | 226.36 |
| PRODUCTIONBATCH | 224 | 01008 | Calcium Carbonate | 0001 | 200 | 22.5 |
| PRODUCTIONBATCH | 224 | 01042 | Starch | 0001 | 110 | 168.72 |
| PRODUCTIONBATCH | 224 | 01182 | Fat Oil | 0001 | 154 | 466.84 |
| PRODUCTIONBATCH | 224 | 01033 | Molasses | 0001 | 25 | 50 |
| PACKING | 234 | 00035 | Bio-Fat 25kg | 0001 | 17 | 5,729.01 |
| PACKINGBATCH | 234 | 02053 | Bio Fat  Bag 25 KG | 0001 | 17 | 70 |
| PACKINGBATCH | 234 | 03024 | Bio Fat | 0001 | 425 | 226.36 |
| PACKING | 234 | 00035 | Bio-Fat 25kg | 0001 | 17 | 5,729.01 |
| Productions | 225 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 15.14 |
| PRODUCTIONBATCH | 225 | 01003 | Bentonite | 0001 | 1 | 13.22 |
| PRODUCTIONBATCH | 225 | 01016 | DCP (Dana) | 0001 | 60 | 10 |
| PRODUCTIONBATCH | 225 | 01044 | Sodium Bicarbonate | 0001 | 2 | 128.03 |
| PRODUCTIONBATCH | 225 | 01015 | DCP (Calcium) | 0001 | 60 | 17 |
| Productions | 225 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 15.14 |
| PACKING | 235 | 00220 | Rumicid powder 25kg | 0001 | 5 | 577.67 |
| PACKINGBATCH | 235 | 02258 | Label Rumicid 25kg | 0001 | 5 | 44.15 |
| PACKINGBATCH | 235 | 02307 | Bag Bop Blue Colour | 0001 | 5 | 155 |
| PACKINGBATCH | 235 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 15.14 |
| PACKING | 235 | 00220 | Rumicid powder 25kg | 0001 | 5 | 577.67 |
| Productions | 226 | 03144 | Yeast Plus Powder | 0001 | 50 | 47.59 |
| PRODUCTIONBATCH | 226 | 01003 | Bentonite | 0001 | 25 | 13.22 |
| PRODUCTIONBATCH | 226 | 01033 | Molasses | 0001 | 5 | 50 |
| PRODUCTIONBATCH | 226 | 01059 | Wheat Bran | 0001 | 20 | 72.45 |
| PRODUCTIONBATCH | 226 | 01007 | CSL | 0001 | 10 | 35 |
| Productions | 226 | 03144 | Yeast Plus Powder | 0001 | 50 | 47.59 |
| PACKING | 236 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 1,384.71 |
| PACKINGBATCH | 236 | 02213 | Bag Bop Red Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 236 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 2 | 40 |
| PACKINGBATCH | 236 | 03144 | Yeast Plus Powder | 0001 | 50 | 47.59 |
| Productions | 227 | 03014 | Magnet BOP Oral Powder | 0001 | 375 | 14.1 |
| PRODUCTIONBATCH | 227 | 01003 | Bentonite | 0001 | 400 | 13.22 |
| PACKING | 237 | 00022 | Magnet BOP 25kg | 0001 | 15 | 507.51 |
| PACKINGBATCH | 237 | 02033 | BAG Magnet 25 KG | 0001 | 15 | 155 |
| PACKINGBATCH | 237 | 03014 | Magnet BOP Oral Powder | 0001 | 375 | 14.1 |
| PACKING | 237 | 00022 | Magnet BOP 25kg | 0001 | 15 | 507.51 |
| OpeningBatch | 108 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 152 | 5,000 |
| Productions | 228 | 03151 | Microgold-Bop | 0001 | 50 | 61.06 |
| PRODUCTIONBATCH | 228 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 228 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 228 | 01016 | DCP (Dana) | 0001 | 40 | 10 |
| PRODUCTIONBATCH | 228 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 228 | 01042 | Starch | 0001 | 0 | 168.72 |
| PRODUCTIONBATCH | 228 | 01043 | Sodium Chloride | 0001 | 10 | 13.75 |
| PRODUCTIONBATCH | 228 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 228 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 228 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 228 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 228 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 228 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 228 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 228 | 01073 | Potassium Chloride | 0001 | 0 | 389.84 |
| PRODUCTIONBATCH | 228 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 228 | 03151 | Microgold-Bop | 0001 | 50 | 61.06 |
| PACKING | 238 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,721.42 |
| PACKINGBATCH | 238 | 02245 | Label Microgold-Bop 25 kg | 0001 | 2 | 40 |
| PACKINGBATCH | 238 | 02307 | Bag Bop Blue Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 238 | 03151 | Microgold-Bop | 0001 | 50 | 61.06 |
| PACKING | 238 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,721.42 |
| PurchasesBatch | 118 | 01060 | Zinc Sulphate | 0001 | 25 | 950 |
| PurchasesBatch | 118 | 01038 | Phosphoric Acid 85% | 0001 | 105 | 650 |
| Productions | 229 | 03245 | JELITO Liquid | 0001 | 550 | 111.12 |
| PRODUCTIONBATCH | 229 | 01020 | Formic Acid | 0001 | 150 | 350 |
| PRODUCTIONBATCH | 229 | 01028 | Lactic Acid | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 229 | 01038 | Phosphoric Acid 85% | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 229 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 229 | 01187 | Sodium Metaby Sulphate | 0001 | 5 | 387.09 |
| PACKING | 239 | 00344 | JELITO Liquid 25 Lit | 0001 | 22 | 3,918.53 |
| PACKINGBATCH | 239 | 02128 | White Can 25 Liter | 0001 | 22 | 1,065.44 |
| PACKINGBATCH | 239 | 02405 | Label JELITO Liquid 25 Lit | 0001 | 22 | 75 |
| PACKINGBATCH | 239 | 03245 | JELITO Liquid | 0001 | 550 | 111.12 |
| PACKING | 239 | 00344 | JELITO Liquid 25 Lit | 0001 | 22 | 3,918.53 |
| Productions | 230 | 03142 | Eggcelent liquid | 0001 | 500 | 132.63 |
| PRODUCTIONBATCH | 230 | 01013 | Calcium Chloride | 0001 | 6 | 209.76 |
| PRODUCTIONBATCH | 230 | 01038 | Phosphoric Acid 85% | 0001 | 75 | 650 |
| PRODUCTIONBATCH | 230 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 230 | 01060 | Zinc Sulphate | 0001 | 2 | 950 |
| PRODUCTIONBATCH | 230 | 01104 | Lysine | 0001 | 1 | 1,100 |
| PRODUCTIONBATCH | 230 | 01176 | Cobalt Chloride | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 230 | 01034 | Magnesium Sulphate | 0001 | 1 | 556.06 |
| Productions | 230 | 03142 | Eggcelent liquid | 0001 | 500 | 132.63 |
| PACKING | 240 | 00197 | Eggcelent liquid 5 Liter | 0001 | 100 | 1,273.38 |
| PACKINGBATCH | 240 | 02014 | Plastic Can White 5 Liter | 0001 | 110 | 439.94 |
| PACKINGBATCH | 240 | 02220 | Label Eggcelent Liquid 5 Litter | 0001 | 140 | 40 |
| PACKINGBATCH | 240 | 03142 | Eggcelent liquid | 0001 | 500 | 132.63 |
| PACKINGBATCH | 240 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 30 | 234.35 |
| PACKING | 240 | 00197 | Eggcelent liquid 5 Liter | 0001 | 100 | 1,273.38 |
| Productions | 231 | 03010 | Garlimint Plus BOP | 0001 | 340 | 164.26 |
| PRODUCTIONBATCH | 231 | 01023 | Garlic Oil | 0001 | 3 | 7,043.77 |
| PRODUCTIONBATCH | 231 | 01025 | Ginger Oil | 0001 | 3 | 7,200 |
| PRODUCTIONBATCH | 231 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 231 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 231 | 01045 | Sorbitol Liquid 70% | 0001 | 3 | 421.7 |
| PRODUCTIONBATCH | 231 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 231 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.06 |
| Productions | 231 | 03010 | Garlimint Plus BOP | 0001 | 340 | 164.26 |
| PACKING | 241 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 68 | 1,355.14 |
| PACKINGBATCH | 241 | 02014 | Plastic Can White 5 Liter | 0001 | 68 | 439.94 |
| PACKINGBATCH | 241 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 60 | 40 |
| PACKINGBATCH | 241 | 03010 | Garlimint Plus BOP | 0001 | 340 | 164.26 |
| PACKINGBATCH | 241 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 17 | 234.35 |
| PACKING | 241 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 68 | 1,355.14 |
| PurchasesBatch | 119 | 01027 | Kaolin | 0001 | 25 | 400 |
| Productions | 232 | 03003 | Calci-Phos-D | 0001 | 60 | 34.71 |
| PRODUCTIONBATCH | 232 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 232 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 232 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 232 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 232 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 232 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 232 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 232 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 232 | 03003 | Calci-Phos-D | 0001 | 60 | 34.71 |
| PACKING | 242 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 292.34 |
| PACKINGBATCH | 242 | 02097 | Bottle Round liter | 0001 | 60 | 222.21 |
| PACKINGBATCH | 242 | 02385 | Label Calci Phos D 1 Lit | 0001 | 60 | 20 |
| PACKINGBATCH | 242 | 03003 | Calci-Phos-D | 0001 | 60 | 34.71 |
| PACKINGBATCH | 242 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 5 | 185 |
| PACKING | 242 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 292.34 |
| Productions | 233 | 03001 | Growth Promoter BOP Oral | 0001 | 750 | 17.4 |
| PRODUCTIONBATCH | 233 | 01016 | DCP (Dana) | 0001 | 600 | 10 |
| PRODUCTIONBATCH | 233 | 01042 | Starch | 0001 | 9 | 168.72 |
| PRODUCTIONBATCH | 233 | 01043 | Sodium Chloride | 0001 | 150 | 13.75 |
| PRODUCTIONBATCH | 233 | 01050 | Tartrazine Yellow Color Indian | 0001 | 1 | 3,086.04 |
| Productions | 233 | 03001 | Growth Promoter BOP Oral | 0001 | 750 | 17.4 |
| PACKING | 243 | 00016 | Growth Promoter 25kg | 0001 | 30 | 590.09 |
| PACKINGBATCH | 243 | 02032 | BAG Growth Promoter 25 KG | 0001 | 30 | 155 |
| PACKINGBATCH | 243 | 03001 | Growth Promoter BOP Oral | 0001 | 750 | 17.4 |
| PACKING | 243 | 00016 | Growth Promoter 25kg | 0001 | 30 | 590.09 |
| Productions | 234 | 03144 | Yeast Plus Powder | 0001 | 1,750 | 31.37 |
| PRODUCTIONBATCH | 234 | 01003 | Bentonite | 0001 | 1,450 | 13.22 |
| PRODUCTIONBATCH | 234 | 01033 | Molasses | 0001 | 175 | 50 |
| PRODUCTIONBATCH | 234 | 01059 | Wheat Bran | 0001 | 300 | 72.45 |
| PRODUCTIONBATCH | 234 | 01007 | CSL | 0001 | 150 | 35 |
| PACKING | 244 | 00199 | Yeast Plus Powder 25 kg | 0001 | 70 | 982.17 |
| PACKINGBATCH | 244 | 02213 | Bag Bop Red Colour | 0001 | 70 | 155 |
| PACKINGBATCH | 244 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 75 | 40 |
| PACKINGBATCH | 244 | 03144 | Yeast Plus Powder | 0001 | 1,750 | 31.37 |
| PACKING | 244 | 00199 | Yeast Plus Powder 25 kg | 0001 | 70 | 982.17 |
| PurchasesBatch | 120 | 02322 | Label Dcp Gold 25KG | 0001 | 200 | 40 |
| PurchasesBatch | 120 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 22 | 90 |
| PurchasesBatch | 120 | 02266 | Label lysogar-lic 1KG | 0001 | 20 | 75 |
| PurchasesBatch | 121 | 01047 | Sodium Sulphate | 0001 | 150 | 68 |
| PurchasesBatch | 120 | 02443 | Label Bio Guard oral Liquid 5 Lit | 0001 | 90 | 40 |
| PurchasesBatch | 122 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 5 | 1,550 |
| PurchasesBatch | 123 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 1,700 | 350 |
| Productions | 235 | 03118 | BOP Coolper Powder | 0001 | 150 | 112.12 |
| PRODUCTIONBATCH | 235 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 235 | 01047 | Sodium Sulphate | 0001 | 150 | 68 |
| PRODUCTIONBATCH | 235 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 4 | 1,549.58 |
| PRODUCTIONBATCH | 235 | 01073 | Potassium Chloride | 0001 | 0 | 389.84 |
| PRODUCTIONBATCH | 235 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 235 | 03118 | BOP Coolper Powder | 0001 | 150 | 112.12 |
| PACKING | 245 | 00030 | Coolper 100gm | 0001 | 1,500 | 30.56 |
| PACKINGBATCH | 245 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 1,500 | 17 |
| PACKINGBATCH | 245 | 03118 | BOP Coolper Powder | 0001 | 150 | 112.12 |
| PACKINGBATCH | 245 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 15 | 234.35 |
| PACKING | 245 | 00030 | Coolper 100gm | 0001 | 1,500 | 30.56 |
| PACKINGBATCH | 245 | 02191 | Packet COOLPER Powder 100 gm |  | 0 | 0 |
| PACKINGBATCH | 245 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 1,550 | 17 |
| PACKING | 245 | 00030 | Coolper 100gm | 0001 | 1,500 | 31.12 |
| Productions | 236 | 03271 | Bio Guard oral Liquid | 0001 | 300 | 359.97 |
| PRODUCTIONBATCH | 236 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 236 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 236 | 01011 | Choline Chloride | 0001 | 6 | 4,840.92 |
| PRODUCTIONBATCH | 236 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 236 | 01020 | Formic Acid | 0001 | 3 | 350 |
| PRODUCTIONBATCH | 236 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 236 | 01046 | Silmyrin | 0001 | 4 | 13,130.73 |
| PRODUCTIONBATCH | 236 | 01058 | Xanthan Gum | 0001 | 1 | 1,450.06 |
| PRODUCTIONBATCH | 236 | 01184 | ARQ | 0001 | 20 | 366.67 |
| Productions | 236 | 03271 | Bio Guard oral Liquid | 0001 | 300 | 359.97 |
| PACKING | 246 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 2,362.31 |
| PACKINGBATCH | 246 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 439.94 |
| PACKINGBATCH | 246 | 02443 | Label Bio Guard oral Liquid 5 Lit | 0001 | 90 | 40 |
| PACKINGBATCH | 246 | 03271 | Bio Guard oral Liquid | 0001 | 300 | 359.97 |
| PACKINGBATCH | 246 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 16 | 234.35 |
| PACKING | 246 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 2,362.31 |
| Productions | 237 | 03184 | Dcp-Gold powder | 0001 | 5,000 | 10 |
| PRODUCTIONBATCH | 237 | 01016 | DCP (Dana) | 0001 | 5,000 | 10 |
| PACKING | 247 | 00264 | DCP-Gold 25Kg | 0001 | 200 | 445 |
| PACKINGBATCH | 247 | 02277 | Bag Bop Yellow Colour | 0001 | 200 | 155 |
| PACKINGBATCH | 247 | 02322 | Label Dcp Gold 25KG | 0001 | 200 | 40 |
| PACKINGBATCH | 247 | 03184 | Dcp-Gold powder | 0001 | 5,000 | 10 |
| Productions | 238 | 03119 | Stable C 20 Liquid | 0001 | 25 | 170.03 |
| PRODUCTIONBATCH | 238 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 238 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 238 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128.03 |
| PRODUCTIONBATCH | 238 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 238 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 238 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 2 | 1,549.58 |
| Productions | 238 | 03119 | Stable C 20 Liquid | 0001 | 25 | 170.03 |
| PACKING | 248 | 00180 | Stable C 20 (5 Liter) | 0001 | 5 | 1,376.95 |
| PACKINGBATCH | 248 | 02014 | Plastic Can White 5 Liter | 0001 | 5 | 439.94 |
| PACKINGBATCH | 248 | 02272 | Label Stable C20  5Lit | 0001 | 5 | 40 |
| PACKINGBATCH | 248 | 03119 | Stable C 20 Liquid | 0001 | 25 | 170.03 |
| PACKINGBATCH | 248 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 1 | 234.35 |
| PACKING | 248 | 00180 | Stable C 20 (5 Liter) | 0001 | 5 | 1,376.95 |
| PurchasesBatch | 124 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 50 | 1,550 |
| PurchasesBatch | 125 | 01184 | ARQ | 0001 | 120 | 366.67 |
| PurchasesBatch | 125 | 01047 | Sodium Sulphate | 0001 | 250 | 74 |
| PurchasesBatch | 125 | 01026 | Ginger Extract Powder | 0001 | 2 | 5,500 |
| PurchasesBatch | 125 | 01024 | Garlic Extract Powder | 0001 | 2 | 5,000 |
| PurchasesBatch | 126 | 02026 | Label Toxi Lic 5 Liter | 0001 | 400 | 18 |
| PurchasesBatch | 126 | 02272 | Label Stable C20  5Lit | 0001 | 60 | 40 |
| PurchasesBatch | 127 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 71 | 235 |
| PurchasesBatch | 128 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 60 | 227 |
| PurchasesBatch | 129 | 01016 | DCP (Dana) | 0001 | 22,000 | 10 |
| PurchasesBatch | 130 | 02014 | Plastic Can White 5 Liter | 0001 | 374 | 440 |
| Productions | 239 | 03020 | Toxi-Lic Liquid | 0001 | 1,000 | 209.08 |
| PRODUCTIONBATCH | 239 | 01004 | Citric Acid | 0001 | 1 | 400 |
| PRODUCTIONBATCH | 239 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 239 | 01011 | Choline Chloride | 0001 | 5 | 4,840.92 |
| PRODUCTIONBATCH | 239 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 239 | 01020 | Formic Acid | 0001 | 20 | 350 |
| PRODUCTIONBATCH | 239 | 01041 | Sodium Benzoate | 0001 | 4 | 650 |
| PRODUCTIONBATCH | 239 | 01046 | Silmyrin | 0001 | 10 | 13,130.73 |
| PRODUCTIONBATCH | 239 | 01058 | Xanthan Gum | 0001 | 2 | 1,450.06 |
| PRODUCTIONBATCH | 239 | 01184 | ARQ | 0001 | 100 | 366.67 |
| Productions | 239 | 03020 | Toxi-Lic Liquid | 0001 | 1,000 | 209.08 |
| PACKING | 249 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 200 | 1,572.73 |
| PACKINGBATCH | 249 | 02014 | Plastic Can White 5 Liter | 0001 | 200 | 439.97 |
| PACKINGBATCH | 249 | 02026 | Label Toxi Lic 5 Liter | 0001 | 260 | 18 |
| PACKINGBATCH | 249 | 03020 | Toxi-Lic Liquid | 0001 | 1,000 | 209.08 |
| PACKINGBATCH | 249 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 55 | 232.6 |
| PACKING | 249 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 200 | 1,572.73 |
| PACKINGBATCH | 249 | 02014 | Plastic Can White 5 Liter |  | 0 | 0 |
| PACKINGBATCH | 249 | 02014 | Plastic Can White 5 Liter | 0001 | 210 | 439.97 |
| PACKING | 249 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 200 | 1,594.72 |
| Productions | 240 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 126.61 |
| PRODUCTIONBATCH | 240 | 01020 | Formic Acid | 0001 | 160 | 350 |
| PRODUCTIONBATCH | 240 | 01028 | Lactic Acid | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 240 | 01038 | Phosphoric Acid 85% | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 240 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 240 | 01187 | Sodium Metaby Sulphate | 0001 | 1 | 387.09 |
| Productions | 240 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 126.61 |
| PACKING | 250 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 4,329.73 |
| PACKINGBATCH | 250 | 02128 | White Can 25 Liter | 0001 | 20 | 1,065.44 |
| PACKINGBATCH | 250 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 22 | 90 |
| PACKINGBATCH | 250 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 126.61 |
| PACKING | 250 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 4,329.73 |
| Productions | 241 | 03013 | Lysogar-Lic Powder | 0001 | 255 | 159.77 |
| PRODUCTIONBATCH | 241 | 01024 | Garlic Extract Powder | 0001 | 2 | 5,000 |
| PRODUCTIONBATCH | 241 | 01026 | Ginger Extract Powder | 0001 | 2 | 5,500 |
| PRODUCTIONBATCH | 241 | 01041 | Sodium Benzoate | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 241 | 01047 | Sodium Sulphate | 0001 | 250 | 73.66 |
| Productions | 241 | 03013 | Lysogar-Lic Powder | 0001 | 255 | 159.77 |
| PACKING | 251 | 00048 | Lysogar-Lic Powder 1kg | 0001 | 255 | 275.06 |
| PACKINGBATCH | 251 | 02035 | Packet Lysogar Lic 1 KG | 0001 | 270 | 30 |
| PACKINGBATCH | 251 | 03013 | Lysogar-Lic Powder | 0001 | 255 | 159.77 |
| PACKINGBATCH | 251 | 02140 | Bucket Large | 0001 | 18 | 1,100 |
| PACKINGBATCH | 251 | 02266 | Label lysogar-lic 1KG | 0001 | 20 | 75 |
| PACKING | 251 | 00048 | Lysogar-Lic Powder 1kg | 0001 | 255 | 275.06 |
| Productions | 242 | 03119 | Stable C 20 Liquid | 0001 | 220 | 164.86 |
| PRODUCTIONBATCH | 242 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 242 | 01044 | Sodium Bicarbonate | 0001 | 2 | 128.03 |
| PRODUCTIONBATCH | 242 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 421.7 |
| PRODUCTIONBATCH | 242 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 242 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 22 | 1,549.95 |
| PACKING | 252 | 00180 | Stable C 20 (5 Liter) | 0001 | 44 | 1,376.99 |
| PACKINGBATCH | 252 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 439.97 |
| PACKINGBATCH | 252 | 02272 | Label Stable C20  5Lit | 0001 | 60 | 40 |
| PACKINGBATCH | 252 | 03119 | Stable C 20 Liquid | 0001 | 220 | 164.86 |
| PACKINGBATCH | 252 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 11 | 232.6 |
| PACKING | 252 | 00180 | Stable C 20 (5 Liter) | 0001 | 44 | 1,376.99 |
| PurchasesBatch | 131 | 01031 | Menthol Crystal | 0001 | 6 | 5,500 |
| PurchasesBatch | 132 | 01010 | Betaine | 0001 | 25 | 2,800 |
| PurchasesBatch | 132 | 01048 | Titanium Dioxide (T.T) | 0001 | 25 | 1,400 |
| PurchasesBatch | 133 | 02114 | Label Ambro Lic 1 Lit | 0001 | 1,400 | 25 |
| PurchasesBatch | 133 | 02271 | Label E.S 200 5Lit | 0001 | 65 | 40 |
| PurchasesBatch | 133 | 02429 | Label Leo Sorbex Oral Powder 25 kg | 0001 | 17 | 140 |
| PurchasesBatch | 134 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 108 | 198 |
| Productions | 243 | 03052 | Ambro _ Lic Oral Liquid | 0001 | 1,296 | 85.18 |
| PRODUCTIONBATCH | 243 | 01017 | Camphor | 0001 | 7 | 3,370.68 |
| PRODUCTIONBATCH | 243 | 01031 | Menthol Crystal | 0001 | 13 | 6,055.56 |
| PRODUCTIONBATCH | 243 | 01048 | Titanium Dioxide (T.T) | 0001 | 3 | 1,405.95 |
| PRODUCTIONBATCH | 243 | 01031 | Menthol Crystal |  | 0 | 0 |
| PRODUCTIONBATCH | 243 | 01031 | Menthol Crystal | 0001 | 10 | 6,055.56 |
| Productions | 243 | 03052 | Ambro _ Lic Oral Liquid | 0001 | 1,296 | 71.17 |
| PACKING | 253 | 00073 | Ambro_Lic Oral Liquid 1 Liter | 0001 | 1,296 | 463.89 |
| PACKINGBATCH | 253 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 1,296 | 349.21 |
| PACKINGBATCH | 253 | 02114 | Label Ambro Lic 1 Lit | 0001 | 1,400 | 25 |
| PACKINGBATCH | 253 | 03052 | Ambro _ Lic Oral Liquid | 0001 | 1,296 | 71.17 |
| PACKINGBATCH | 253 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 108 | 198 |
| Productions | 244 | 03262 | Leo Sorbex Oral Powder | 0001 | 375 | 17.09 |
| PRODUCTIONBATCH | 244 | 01003 | Bentonite | 0001 | 375 | 13.22 |
| PRODUCTIONBATCH | 244 | 01187 | Sodium Metaby Sulphate | 0001 | 3 | 387.09 |
| Productions | 244 | 03262 | Leo Sorbex Oral Powder | 0001 | 375 | 17.09 |
| PACKING | 254 | 00366 | Leo Sorbex Oral Powder 25 kg | 0001 | 15 | 585.91 |
| PACKINGBATCH | 254 | 02429 | Label Leo Sorbex Oral Powder 25 kg | 0001 | 17 | 140 |
| PACKINGBATCH | 254 | 03262 | Leo Sorbex Oral Powder | 0001 | 375 | 17.09 |
| PACKING | 254 | 00366 | Leo Sorbex Oral Powder 25 kg | 0001 | 15 | 585.91 |
| Productions | 245 | 03120 | E.S 200 Liquid | 0001 | 200 | 52.8 |
| PRODUCTIONBATCH | 245 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 245 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 245 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 6 | 1,549.95 |
| Productions | 245 | 03120 | E.S 200 Liquid | 0001 | 200 | 52.8 |
| PACKING | 255 | 00266 | E.S  200 liquid 5 Liter | 0001 | 40 | 812.11 |
| PACKINGBATCH | 255 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 439.97 |
| PACKINGBATCH | 255 | 02271 | Label E.S 200 5Lit | 0001 | 50 | 40 |
| PACKINGBATCH | 255 | 03120 | E.S 200 Liquid | 0001 | 200 | 52.8 |
| PACKINGBATCH | 255 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 232.6 |
| PACKING | 255 | 00266 | E.S  200 liquid 5 Liter | 0001 | 40 | 812.11 |
| Productions | 246 | 03023 | Hepatic-Optimizer Powder | 0001 | 250 | 25.44 |
| PRODUCTIONBATCH | 246 | 01003 | Bentonite | 0001 | 175 | 13.22 |
| PRODUCTIONBATCH | 246 | 01015 | DCP (Calcium) | 0001 | 25 | 17 |
| PRODUCTIONBATCH | 246 | 01059 | Wheat Bran | 0001 | 50 | 72.45 |
| Productions | 246 | 03023 | Hepatic-Optimizer Powder | 0001 | 250 | 25.44 |
| PACKING | 256 | 00038 | Hepatic-Optimizer Powder 25kg | 0001 | 10 | 791.07 |
| PACKINGBATCH | 256 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 256 | 03023 | Hepatic-Optimizer Powder | 0001 | 250 | 25.44 |
| PACKING | 256 | 00038 | Hepatic-Optimizer Powder 25kg | 0001 | 10 | 791.07 |
| Productions | 247 | 03144 | Yeast Plus Powder | 0001 | 175 | 30.84 |
| PRODUCTIONBATCH | 247 | 01003 | Bentonite | 0001 | 170 | 13.22 |
| PRODUCTIONBATCH | 247 | 01033 | Molasses | 0001 | 20 | 50 |
| PRODUCTIONBATCH | 247 | 01059 | Wheat Bran | 0001 | 20 | 72.45 |
| PRODUCTIONBATCH | 247 | 01007 | CSL | 0001 | 20 | 35 |
| Productions | 247 | 03144 | Yeast Plus Powder | 0001 | 175 | 30.84 |
| PACKING | 257 | 00199 | Yeast Plus Powder 25 kg | 0001 | 7 | 965.88 |
| PACKINGBATCH | 257 | 02213 | Bag Bop Red Colour | 0001 | 7 | 155 |
| PACKINGBATCH | 257 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 7 | 40 |
| PACKINGBATCH | 257 | 03144 | Yeast Plus Powder | 0001 | 175 | 30.84 |
| PACKING | 257 | 00199 | Yeast Plus Powder 25 kg | 0001 | 7 | 965.88 |
| PurchasesBatch | 135 | 02025 | Label Fuzion Plus 5 Liter | 0001 | 80 | 40 |
| Productions | 248 | 03060 | Oripulmo Liquid | 0001 | 480 | 61.52 |
| PRODUCTIONBATCH | 248 | 01017 | Camphor | 0001 | 2 | 3,370.68 |
| PRODUCTIONBATCH | 248 | 01031 | Menthol Crystal | 0001 | 3 | 6,055.56 |
| PRODUCTIONBATCH | 248 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 248 | 01048 | Titanium Dioxide (T.T) | 0001 | 1 | 1,405.95 |
| PACKING | 258 | 00086 | Oripulmo Liquid 1 Lit | 0001 | 480 | 413.64 |
| PACKINGBATCH | 258 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 484 | 349.21 |
| PACKINGBATCH | 258 | 03060 | Oripulmo Liquid | 0001 | 480 | 61.52 |
| PACKING | 258 | 00086 | Oripulmo Liquid 1 Lit | 0001 | 480 | 413.64 |
| Productions | 249 | 03023 | Hepatic-Optimizer Powder | 0001 | 2,500 | 13.98 |
| PRODUCTIONBATCH | 249 | 01003 | Bentonite | 0001 | 2,000 | 13.22 |
| PRODUCTIONBATCH | 249 | 01015 | DCP (Calcium) | 0001 | 500 | 17 |
| PACKING | 259 | 00038 | Hepatic-Optimizer Powder 25kg | 0001 | 100 | 515.23 |
| PACKINGBATCH | 259 | 02307 | Bag Bop Blue Colour | 0001 | 42 | 155 |
| PACKINGBATCH | 259 | 03023 | Hepatic-Optimizer Powder | 0001 | 2,500 | 13.98 |
| PACKINGBATCH | 259 | 02277 | Bag Bop Yellow Colour | 0001 | 65 | 155 |
| Productions | 250 | 03009 | Fuzion Plus | 0001 | 300 | 48.17 |
| PRODUCTIONBATCH | 250 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 250 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 250 | 01020 | Formic Acid | 0001 | 10 | 350 |
| PRODUCTIONBATCH | 250 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 250 | 01184 | ARQ | 0001 | 4 | 366.67 |
| PACKING | 260 | 00046 | Fuzion Plus 5 Lit | 0001 | 60 | 865.61 |
| PACKINGBATCH | 260 | 02014 | Plastic Can White 5 Liter | 0001 | 70 | 439.97 |
| PACKINGBATCH | 260 | 02025 | Label Fuzion Plus 5 Liter | 0001 | 80 | 40 |
| PACKINGBATCH | 260 | 03009 | Fuzion Plus | 0001 | 300 | 48.17 |
| PACKINGBATCH | 260 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 15 | 232.6 |
| PACKING | 260 | 00046 | Fuzion Plus 5 Lit | 0001 | 60 | 865.61 |
| Productions | 251 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 10.53 |
| PRODUCTIONBATCH | 251 | 01003 | Bentonite | 0001 | 5 | 13.22 |
| PRODUCTIONBATCH | 251 | 01016 | DCP (Dana) | 0001 | 125 | 10 |
| Productions | 251 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 10.53 |
| PACKING | 261 | 00220 | Rumicid powder 25kg | 0001 | 5 | 462.37 |
| PACKINGBATCH | 261 | 02258 | Label Rumicid 25kg | 0001 | 5 | 44.15 |
| PACKINGBATCH | 261 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 10.53 |
| PACKINGBATCH | 261 | 02277 | Bag Bop Yellow Colour | 0001 | 5 | 155 |
| PACKING | 261 | 00220 | Rumicid powder 25kg | 0001 | 5 | 462.37 |
| Productions | 252 | 03104 | BOP PH 5 Liquid | 0001 | 75 | 25.98 |
| PRODUCTIONBATCH | 252 | 01020 | Formic Acid | 0001 | 5 | 350 |
| PRODUCTIONBATCH | 252 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 252 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 252 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PACKING | 262 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 3 | 1,755.03 |
| PACKINGBATCH | 262 | 02128 | White Can 25 Liter | 0001 | 3 | 1,065.44 |
| PACKINGBATCH | 262 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 3 | 40 |
| PACKINGBATCH | 262 | 03104 | BOP PH 5 Liquid | 0001 | 75 | 25.98 |
| PACKING | 262 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 3 | 1,755.03 |
| PurchasesBatch | 136 | 01003 | Bentonite | 0001 | 10,000 | 13 |
| PurchasesBatch | 137 | 01035 | Turpentine Oil | 0001 | 3 | 1,250 |
| PurchasesBatch | 138 | 02314 | Dropper  30ML | 0001 | 1,500 | 13 |
| Productions | 253 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 700 | 19.69 |
| PRODUCTIONBATCH | 253 | 01003 | Bentonite | 0001 | 350 | 13.1 |
| PRODUCTIONBATCH | 253 | 01007 | CSL | 0001 | 50 | 35 |
| PRODUCTIONBATCH | 253 | 01015 | DCP (Calcium) | 0001 | 350 | 17 |
| PRODUCTIONBATCH | 253 | 01033 | Molasses | 0001 | 30 | 50 |
| PACKING | 263 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 28 | 709.43 |
| PACKINGBATCH | 263 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 30 | 47.63 |
| PACKINGBATCH | 263 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 700 | 19.69 |
| PACKINGBATCH | 263 | 02277 | Bag Bop Yellow Colour | 0001 | 30 | 155 |
| PACKING | 263 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 28 | 709.43 |
| Productions | 254 | 03019 | Super Yeast Powder | 0001 | 25 | 49.46 |
| PRODUCTIONBATCH | 254 | 01003 | Bentonite | 0001 | 20 | 13.1 |
| PRODUCTIONBATCH | 254 | 01033 | Molasses | 0001 | 5 | 50 |
| PRODUCTIONBATCH | 254 | 01059 | Wheat Bran | 0001 | 10 | 72.45 |
| Productions | 254 | 03019 | Super Yeast Powder | 0001 | 25 | 49.46 |
| PACKING | 264 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,431.48 |
| PACKINGBATCH | 264 | 02042 | Label Super Yeast 25 KG | 0001 | 1 | 40 |
| PACKINGBATCH | 264 | 02213 | Bag Bop Red Colour | 0001 | 1 | 155 |
| PACKINGBATCH | 264 | 03019 | Super Yeast Powder | 0001 | 25 | 49.46 |
| PACKING | 264 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,431.48 |
| Productions | 255 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 19.06 |
| PRODUCTIONBATCH | 255 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 255 | 01035 | Turpentine Oil | 0001 | 0 | 1,278.57 |
| PRODUCTIONBATCH | 255 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 255 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 255 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128.03 |
| Productions | 255 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 19.06 |
| PACKING | 265 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 32.76 |
| PACKINGBATCH | 265 | 02010 | Bottle Pet Amber 100ML | 0001 | 300 | 9.12 |
| PACKINGBATCH | 265 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 250 | 12 |
| PACKINGBATCH | 265 | 03165 | Timp-Ex Oral Liquid | 0001 | 20 | 19.06 |
| PACKINGBATCH | 265 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 2 | 217 |
| PACKING | 265 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 32.76 |
| Productions | 256 | 03151 | Microgold-Bop | 0001 | 25 | 62.96 |
| PRODUCTIONBATCH | 256 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 256 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 256 | 01016 | DCP (Dana) | 0001 | 20 | 10 |
| PRODUCTIONBATCH | 256 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 256 | 01042 | Starch | 0001 | 0 | 168.72 |
| PRODUCTIONBATCH | 256 | 01043 | Sodium Chloride | 0001 | 5 | 13.75 |
| PRODUCTIONBATCH | 256 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 256 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 256 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 256 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 256 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 256 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 256 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 256 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 256 | 01073 | Potassium Chloride | 0001 | 0 | 389.84 |
| PRODUCTIONBATCH | 256 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 256 | 03151 | Microgold-Bop | 0001 | 25 | 62.96 |
| PACKING | 266 | 00212 | Microgold-Bop 25 kg | 0001 | 1 | 1,768.92 |
| PACKINGBATCH | 266 | 02245 | Label Microgold-Bop 25 kg | 0001 | 1 | 40 |
| PACKINGBATCH | 266 | 03151 | Microgold-Bop | 0001 | 25 | 62.96 |
| PACKINGBATCH | 266 | 02277 | Bag Bop Yellow Colour | 0001 | 1 | 155 |
| PACKING | 266 | 00212 | Microgold-Bop 25 kg | 0001 | 1 | 1,768.92 |
| Productions | 257 | 03010 | Garlimint Plus BOP | 0001 | 17 | 158.46 |
| PRODUCTIONBATCH | 257 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 257 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 257 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 257 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 257 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 257 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| Productions | 257 | 03010 | Garlimint Plus BOP | 0001 | 17 | 158.46 |
| PACKING | 267 | 00259 | Garliment-Plus BOP  30ML | 0001 | 225 | 25.63 |
| PACKINGBATCH | 267 | 02314 | Dropper  30ML | 0001 | 225 | 13 |
| PACKINGBATCH | 267 | 02316 | S+D Garliment Plus 30ML | 0001 | 250 | 6 |
| PACKINGBATCH | 267 | 03010 | Garlimint Plus BOP | 0001 | 7 | 158.46 |
| PACKINGBATCH | 267 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 1 | 232.6 |
| PACKING | 267 | 00259 | Garliment-Plus BOP  30ML | 0001 | 225 | 25.63 |
| PACKING | 268 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 100 | 53.51 |
| PACKINGBATCH | 268 | 02010 | Bottle Pet Amber 100ML | 0001 | 200 | 9.12 |
| PACKINGBATCH | 268 | 02224 | S+D Garlimint Plus Liquid 100 ML | 0001 | 150 | 11.5 |
| PACKINGBATCH | 268 | 03010 | Garlimint Plus BOP | 0001 | 10 | 158.46 |
| PACKINGBATCH | 268 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 1 | 217 |
| PACKING | 268 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 100 | 53.51 |
| Productions | 258 | 03003 | Calci-Phos-D | 0001 | 34 | 27.08 |
| PRODUCTIONBATCH | 258 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 258 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 258 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 258 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 258 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 258 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 258 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 258 | 03003 | Calci-Phos-D | 0001 | 34 | 27.08 |
| PACKING | 269 | 00032 | Calci-Phos-D 1000ml | 0001 | 24 | 289.71 |
| PACKINGBATCH | 269 | 02097 | Bottle Round liter | 0001 | 24 | 222.21 |
| PACKINGBATCH | 269 | 02385 | Label Calci Phos D 1 Lit | 0001 | 30 | 20 |
| PACKINGBATCH | 269 | 03003 | Calci-Phos-D | 0001 | 24 | 27.08 |
| PACKINGBATCH | 269 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 185 |
| PACKING | 269 | 00032 | Calci-Phos-D 1000ml | 0001 | 24 | 289.71 |
| PACKING | 270 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 36.56 |
| PACKINGBATCH | 270 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 150 | 12 |
| PACKINGBATCH | 270 | 03003 | Calci-Phos-D | 0001 | 10 | 27.08 |
| PACKINGBATCH | 270 | 02010 | Bottle Pet Amber 100ML | 0001 | 150 | 9.12 |
| PACKINGBATCH | 270 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 1 | 217 |
| PACKING | 270 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 36.56 |
| Productions | 259 | 03018 | Scour Guard | 0001 | 20 | 79.74 |
| PRODUCTIONBATCH | 259 | 01027 | Kaolin | 0001 | 3 | 400 |
| PRODUCTIONBATCH | 259 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 259 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 259 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 259 | 01073 | Potassium Chloride | 0001 | 0 | 389.84 |
| Productions | 259 | 03018 | Scour Guard | 0001 | 20 | 79.74 |
| PACKING | 271 | 00008 | Scour Guard100ML | 0001 | 200 | 35.35 |
| PACKINGBATCH | 271 | 02020 | S+D Scour Guard100 ML | 0001 | 250 | 12 |
| PACKINGBATCH | 271 | 03018 | Scour Guard | 0001 | 20 | 79.74 |
| PACKINGBATCH | 271 | 02010 | Bottle Pet Amber 100ML | 0001 | 200 | 9.12 |
| PACKINGBATCH | 271 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 3 | 217 |
| PACKING | 271 | 00008 | Scour Guard100ML | 0001 | 200 | 35.35 |
| Productions | 260 | 03264 | Febro Meon Spray | 0001 | 29 | 483.5 |
| PRODUCTIONBATCH | 260 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 260 | 01065 | Spt Amm. Aromatic | 0001 | 30 | 265 |
| PRODUCTIONBATCH | 260 | 01075 | Peppermint Oil | 0001 | 0 | 5,192.28 |
| PRODUCTIONBATCH | 260 | 01189 | Glycerine | 0001 | 5 | 717.02 |
| Productions | 260 | 03264 | Febro Meon Spray | 0001 | 29 | 483.5 |
| PACKING | 272 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 48.69 |
| PACKINGBATCH | 272 | 03264 | Febro Meon Spray | 0001 | 29 | 483.5 |
| PACKING | 272 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 48.69 |
| Productions | 261 | 03182 | GrowMore Powder | 0001 | 120 | 21.62 |
| PRODUCTIONBATCH | 261 | 01009 | Copper Sulphate | 0001 | 0 | 2,176.63 |
| PRODUCTIONBATCH | 261 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 261 | 01016 | DCP (Dana) | 0001 | 100 | 10 |
| PRODUCTIONBATCH | 261 | 01042 | Starch | 0001 | 1 | 168.72 |
| PRODUCTIONBATCH | 261 | 01043 | Sodium Chloride | 0001 | 24 | 13.75 |
| PRODUCTIONBATCH | 261 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 261 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 261 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 261 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| PACKING | 273 | 00265 | GrowMore 1Kg | 0001 | 20 | 51.62 |
| PACKINGBATCH | 273 | 02315 | Packet GrowMore 1KG | 0001 | 20 | 30 |
| PACKINGBATCH | 273 | 03182 | GrowMore Powder | 0001 | 20 | 21.62 |
| PACKING | 273 | 00265 | GrowMore 1Kg | 0001 | 20 | 51.62 |
| PACKING | 274 | 00258 | GrowMore 25KG | 0001 | 4 | 540.41 |
| PACKINGBATCH | 274 | 03182 | GrowMore Powder | 0001 | 100 | 21.62 |
| PACKING | 274 | 00258 | GrowMore 25KG | 0001 | 4 | 540.41 |
| OpeningBatch | 112 | 02312 | Label GrowMore 25KG | 0001 | 200 | 70 |
| Productions | 262 | 03014 | Magnet BOP Oral Powder | 0001 | 35 | 13.1 |
| PRODUCTIONBATCH | 262 | 01003 | Bentonite | 0001 | 35 | 13.1 |
| Productions | 262 | 03014 | Magnet BOP Oral Powder | 0001 | 35 | 13.1 |
| PACKING | 275 | 00020 | Magnet BOP 1kg | 0001 | 25 | 43.1 |
| PACKINGBATCH | 275 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 25 | 30 |
| PACKINGBATCH | 275 | 03014 | Magnet BOP Oral Powder | 0001 | 25 | 13.1 |
| PACKING | 275 | 00020 | Magnet BOP 1kg | 0001 | 25 | 43.1 |
| PACKING | 276 | 00262 | Magnet 100gm | 0001 | 100 | 10.81 |
| PACKINGBATCH | 276 | 02319 | Packet Magnet 100 gm | 0001 | 100 | 9.5 |
| PACKINGBATCH | 276 | 03014 | Magnet BOP Oral Powder | 0001 | 10 | 13.1 |
| PACKING | 276 | 00262 | Magnet 100gm | 0001 | 100 | 10.81 |
| Productions | 263 | 03179 | Heaatic Optimizer Liquid | 0001 | 10 | 91.46 |
| PRODUCTIONBATCH | 263 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 263 | 01011 | Choline Chloride | 0001 | 0 | 4,840.92 |
| PRODUCTIONBATCH | 263 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 263 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 263 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 263 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 263 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 263 | 03179 | Heaatic Optimizer Liquid | 0001 | 10 | 91.46 |
| PACKING | 277 | 00257 | Heaatic-Optimizer 100ML | 0001 | 100 | 34.33 |
| PACKINGBATCH | 277 | 02010 | Bottle Pet Amber 100ML | 0001 | 150 | 9.12 |
| PACKINGBATCH | 277 | 02313 | S+D Heaatic-Optimizer 100ML | 0001 | 100 | 11.5 |
| PACKINGBATCH | 277 | 03179 | Heaatic Optimizer Liquid | 0001 | 10 | 91.46 |
| PACKING | 277 | 00257 | Heaatic-Optimizer 100ML | 0001 | 100 | 34.33 |
| PurchasesBatch | 139 | 01015 | DCP (Calcium) | 0001 | 1,000 | 17 |
| PurchasesBatch | 140 | 02445 | Label Bop PH5  1 Lit | 0001 | 140 | 40 |
| PurchasesBatch | 140 | 02412 | Label BOP Glycholine Plus Oral Sol.25Lit | 0001 | 10 | 75 |
| PurchasesBatch | 140 | 02444 | Label Garlic Pro Oral Liquid  5 Lit | 0001 | 80 | 40 |
| PurchasesBatch | 141 | 02010 | Bottle Pet Amber 100ML | 0001 | 500 | 8 |
| PurchasesBatch | 142 | 01197 | Potassium Phosphate ( Di-Basic) | 0001 | 1 | 4,500 |
| PurchasesBatch | 142 | 01196 | Potassium Phosphate (Mono Basic) | 0001 | 20 | 1,250 |
| PurchasesBatch | 142 | 01207 | General Items For Lab | 0001 | 1 | 15,500 |
| PurchasesBatch | 143 | 01043 | Sodium Chloride | 0001 | 600 | 13.75 |
| Productions | 264 | 03043 | Microgest BOP Oral powder | 0001 | 10 | 233.8 |
| PRODUCTIONBATCH | 264 | 01002 | Ammonium chloride | 0001 | 8 | 259.87 |
| PRODUCTIONBATCH | 264 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 264 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 264 | 01047 | Sodium Sulphate | 0001 | 3 | 73.66 |
| PRODUCTIONBATCH | 264 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 264 | 03043 | Microgest BOP Oral powder | 0001 | 10 | 233.8 |
| PACKING | 278 | 00182 | Microgest Powder 100 gm | 0001 | 100 | 23.38 |
| PACKINGBATCH | 278 | 03043 | Microgest BOP Oral powder | 0001 | 10 | 233.8 |
| PACKING | 278 | 00182 | Microgest Powder 100 gm | 0001 | 100 | 23.38 |
| Productions | 265 | 03104 | BOP PH 5 Liquid | 0001 | 370 | 20.15 |
| PRODUCTIONBATCH | 265 | 01020 | Formic Acid | 0001 | 18 | 350 |
| PRODUCTIONBATCH | 265 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 265 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 265 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PACKING | 279 | 00381 | Bop PH5  1 Lit | 0001 | 120 | 304.44 |
| PACKINGBATCH | 279 | 02097 | Bottle Round liter | 0001 | 120 | 222.21 |
| PACKINGBATCH | 279 | 02445 | Label Bop PH5  1 Lit | 0001 | 140 | 40 |
| PACKINGBATCH | 279 | 03104 | BOP PH 5 Liquid | 0001 | 120 | 20.15 |
| PACKINGBATCH | 279 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 10 | 185 |
| PACKING | 280 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 10 | 1,629.19 |
| PACKINGBATCH | 280 | 02128 | White Can 25 Liter | 0001 | 10 | 1,065.44 |
| PACKINGBATCH | 280 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 15 | 40 |
| PACKINGBATCH | 280 | 03104 | BOP PH 5 Liquid | 0001 | 250 | 20.15 |
| PACKING | 280 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 10 | 1,629.19 |
| Productions | 266 | 03272 | Garlic Pro Oral Liquid | 0001 | 300 | 145.35 |
| PRODUCTIONBATCH | 266 | 01023 | Garlic Oil | 0001 | 3 | 7,043.77 |
| PRODUCTIONBATCH | 266 | 01025 | Ginger Oil | 0001 | 3 | 7,200 |
| PRODUCTIONBATCH | 266 | 01041 | Sodium Benzoate | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 266 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| Productions | 266 | 03272 | Garlic Pro Oral Liquid | 0001 | 300 | 145.35 |
| PACKING | 281 | 00382 | Garlic Pro Oral Liquid  5 Lit | 0001 | 60 | 1,363.14 |
| PACKINGBATCH | 281 | 02014 | Plastic Can White 5 Liter | 0001 | 70 | 439.97 |
| PACKINGBATCH | 281 | 02444 | Label Garlic Pro Oral Liquid  5 Lit | 0001 | 80 | 40 |
| PACKINGBATCH | 281 | 03272 | Garlic Pro Oral Liquid | 0001 | 300 | 145.35 |
| PACKINGBATCH | 281 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 18 | 232.6 |
| PACKING | 281 | 00382 | Garlic Pro Oral Liquid  5 Lit | 0001 | 60 | 1,363.14 |
| Productions | 267 | 03249 | BOP Glycholine Plus Oral Solution | 0001 | 100 | 100.6 |
| PRODUCTIONBATCH | 267 | 01011 | Choline Chloride | 0001 | 2 | 4,840.92 |
| PRODUCTIONBATCH | 267 | 01013 | Calcium Chloride | 0001 | 0 | 209.76 |
| PRODUCTIONBATCH | 267 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 267 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 267 | 01073 | Potassium Chloride | 0001 | 0 | 389.84 |
| PRODUCTIONBATCH | 267 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| Productions | 267 | 03249 | BOP Glycholine Plus Oral Solution | 0001 | 100 | 100.6 |
| PACKING | 282 | 00351 | BOP Glycholine Plus Oral Solution 25 Lit | 0001 | 4 | 3,767.89 |
| PACKINGBATCH | 282 | 02128 | White Can 25 Liter | 0001 | 4 | 1,065.44 |
| PACKINGBATCH | 282 | 02412 | Label BOP Glycholine Plus Oral Sol.25Lit | 0001 | 10 | 75 |
| PACKINGBATCH | 282 | 03249 | BOP Glycholine Plus Oral Solution | 0001 | 100 | 100.6 |
| PACKING | 282 | 00351 | BOP Glycholine Plus Oral Solution 25 Lit | 0001 | 4 | 3,767.88 |
| PurchasesBatch | 144 | 02041 | Label Growth Promoter Plus 25 KG | 0001 | 12 | 140 |
| PurchasesBatch | 144 | 02446 | Label Bio Drink Oral Powder 1 Kg | 0001 | 135 | 40 |
| PurchasesBatch | 144 | 02447 | Label Bop Cranol Oral Powder 1 Kg | 0001 | 135 | 40 |
| PurchasesBatch | 145 | 01047 | Sodium Sulphate | 0001 | 250 | 74 |
| PurchasesBatch | 146 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| PurchasesBatch | 146 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 25 | 1,550 |
| PurchasesBatch | 146 | 01195 | Ammonium Sulphate | 0001 | 50 | 850 |
| PurchasesBatch | 147 | 02043 | JAR 1 KG | 0001 | 240 | 160 |
| PurchasesBatch | 148 | 02118 | Shipper J | 0001 | 25 | 251 |
| Productions | 268 | 03046 | Rumicid BOP Oral Powder | 0001 | 500 | 13.63 |
| PRODUCTIONBATCH | 268 | 01003 | Bentonite | 0001 | 5 | 13.1 |
| PRODUCTIONBATCH | 268 | 01016 | DCP (Dana) | 0001 | 250 | 10 |
| PRODUCTIONBATCH | 268 | 01015 | DCP (Calcium) | 0001 | 250 | 17 |
| PACKING | 283 | 00220 | Rumicid powder 25kg | 0001 | 20 | 589.71 |
| PACKINGBATCH | 283 | 02258 | Label Rumicid 25kg | 0001 | 25 | 44.15 |
| PACKINGBATCH | 283 | 03046 | Rumicid BOP Oral Powder | 0001 | 500 | 13.63 |
| PACKINGBATCH | 283 | 02277 | Bag Bop Yellow Colour | 0001 | 25 | 155 |
| PACKING | 283 | 00220 | Rumicid powder 25kg | 0001 | 20 | 589.71 |
| Productions | 269 | 03003 | Calci-Phos-D | 0001 | 240 | 23.94 |
| PRODUCTIONBATCH | 269 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 269 | 01038 | Phosphoric Acid 85% | 0001 | 3 | 650 |
| PRODUCTIONBATCH | 269 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 269 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 269 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 269 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 269 | 03003 | Calci-Phos-D | 0001 | 240 | 23.94 |
| PACKING | 284 | 00049 | Calci-Phos-D 5 Lit | 0001 | 24 | 779.58 |
| PACKINGBATCH | 284 | 02014 | Plastic Can White 5 Liter | 0001 | 30 | 439.97 |
| PACKINGBATCH | 284 | 02027 | Label Calci Phos D 5 Liter | 0001 | 35 | 22.22 |
| PACKINGBATCH | 284 | 03003 | Calci-Phos-D | 0001 | 120 | 23.94 |
| PACKINGBATCH | 284 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 232.6 |
| PACKING | 284 | 00049 | Calci-Phos-D 5 Lit | 0001 | 24 | 779.58 |
| PACKING | 285 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 301.04 |
| PACKINGBATCH | 285 | 02097 | Bottle Round liter | 0001 | 130 | 222.21 |
| PACKINGBATCH | 285 | 02385 | Label Calci Phos D 1 Lit | 0001 | 135 | 20 |
| PACKINGBATCH | 285 | 03003 | Calci-Phos-D | 0001 | 120 | 23.94 |
| PACKINGBATCH | 285 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 9 | 185 |
| PACKING | 285 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 301.04 |
| Productions | 270 | 03002 | DCP Powder | 0001 | 2,000 | 12.07 |
| PRODUCTIONBATCH | 270 | 01190 | PHOSPHORUS Powder 29% | 0001 | 2,100 | 11.5 |
| PACKING | 286 | 00019 | DCP BOP 25kg | 0001 | 80 | 456.88 |
| PACKINGBATCH | 286 | 03002 | DCP Powder | 0001 | 2,000 | 12.07 |
| PACKINGBATCH | 286 | 02277 | Bag Bop Yellow Colour | 0001 | 80 | 155 |
| Productions | 271 | 03014 | Magnet BOP Oral Powder | 0001 | 1,340 | 14.18 |
| PRODUCTIONBATCH | 271 | 01003 | Bentonite | 0001 | 1,450 | 13.1 |
| PACKING | 287 | 00262 | Magnet 100gm | 0001 | 900 | 14.56 |
| PACKINGBATCH | 287 | 02319 | Packet Magnet 100 gm | 0001 | 1,000 | 9.5 |
| PACKINGBATCH | 287 | 03014 | Magnet BOP Oral Powder | 0001 | 90 | 14.18 |
| PACKINGBATCH | 287 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 232.6 |
| PACKING | 288 | 00022 | Magnet BOP 25kg | 0001 | 50 | 509.39 |
| PACKINGBATCH | 288 | 02033 | BAG Magnet 25 KG | 0001 | 50 | 155 |
| PACKINGBATCH | 288 | 03014 | Magnet BOP Oral Powder | 0001 | 1,250 | 14.18 |
| PACKING | 288 | 00022 | Magnet BOP 25kg | 0001 | 50 | 509.39 |
| Productions | 272 | 03043 | Microgest BOP Oral powder | 0001 | 60 | 62.1 |
| PRODUCTIONBATCH | 272 | 01002 | Ammonium chloride | 0001 | 10 | 271.82 |
| PRODUCTIONBATCH | 272 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 272 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 272 | 01047 | Sodium Sulphate | 0001 | 6 | 73.98 |
| PRODUCTIONBATCH | 272 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 272 | 01015 | DCP (Calcium) | 0001 | 10 | 17 |
| PRODUCTIONBATCH | 272 | 01016 | DCP (Dana) | 0001 | 10 | 10 |
| PRODUCTIONBATCH | 272 | 01003 | Bentonite | 0001 | 5 | 13.1 |
| Productions | 272 | 03043 | Microgest BOP Oral powder | 0001 | 60 | 62.1 |
| PACKING | 289 | 00182 | Microgest Powder 100 gm | 0001 | 600 | 8.15 |
| PACKINGBATCH | 289 | 03043 | Microgest BOP Oral powder | 0001 | 60 | 62.1 |
| PACKINGBATCH | 289 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 232.6 |
| PACKING | 289 | 00182 | Microgest Powder 100 gm | 0001 | 600 | 8.15 |
| Productions | 273 | 03165 | Timp-Ex Oral Liquid | 0001 | 50 | 17.14 |
| PRODUCTIONBATCH | 273 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 273 | 01035 | Turpentine Oil | 0001 | 0 | 1,278.57 |
| PRODUCTIONBATCH | 273 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 273 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| Productions | 273 | 03165 | Timp-Ex Oral Liquid | 0001 | 50 | 17.14 |
| PACKING | 290 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 500 | 38.28 |
| PACKINGBATCH | 290 | 02010 | Bottle Pet Amber 100ML | 0001 | 1,110 | 8.62 |
| PACKINGBATCH | 290 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 600 | 12 |
| PACKINGBATCH | 290 | 03165 | Timp-Ex Oral Liquid | 0001 | 50 | 17.14 |
| PACKINGBATCH | 290 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 7 | 217 |
| PACKING | 290 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 500 | 38.28 |
| Productions | 274 | 03163 | Calcium 72 | 0001 | 500 | 18.7 |
| PRODUCTIONBATCH | 274 | 01015 | DCP (Calcium) | 0001 | 550 | 17 |
| PACKING | 291 | 00248 | Calcium-72 1KG | 0001 | 500 | 63.33 |
| PACKINGBATCH | 291 | 02299 | Packet Calcium-72 1KG | 0001 | 550 | 30 |
| PACKINGBATCH | 291 | 03163 | Calcium 72 | 0001 | 500 | 18.7 |
| PACKINGBATCH | 291 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 232.6 |
| PACKING | 291 | 00248 | Calcium-72 1KG | 0001 | 500 | 63.33 |
| Productions | 275 | 03019 | Super Yeast Powder | 0001 | 175 | 46.5 |
| PRODUCTIONBATCH | 275 | 01003 | Bentonite | 0001 | 150 | 13.1 |
| PRODUCTIONBATCH | 275 | 01033 | Molasses | 0001 | 30 | 50 |
| PRODUCTIONBATCH | 275 | 01059 | Wheat Bran | 0001 | 50 | 72.45 |
| PRODUCTIONBATCH | 275 | 01007 | CSL | 0001 | 30 | 35 |
| PACKING | 292 | 00040 | Super Yeast Powder 25kg | 0001 | 7 | 1,441.06 |
| PACKINGBATCH | 292 | 02042 | Label Super Yeast 25 KG | 0001 | 10 | 40 |
| PACKINGBATCH | 292 | 02213 | Bag Bop Red Colour | 0001 | 10 | 155 |
| PACKINGBATCH | 292 | 03019 | Super Yeast Powder | 0001 | 175 | 46.5 |
| PACKING | 292 | 00040 | Super Yeast Powder 25kg | 0001 | 7 | 1,441.06 |
| Productions | 276 | 03001 | Growth Promoter BOP Oral | 0001 | 1,500 | 17.4 |
| PRODUCTIONBATCH | 276 | 01016 | DCP (Dana) | 0001 | 1,200 | 10 |
| PRODUCTIONBATCH | 276 | 01042 | Starch | 0001 | 18 | 168.72 |
| PRODUCTIONBATCH | 276 | 01043 | Sodium Chloride | 0001 | 300 | 13.75 |
| PRODUCTIONBATCH | 276 | 01050 | Tartrazine Yellow Color Indian | 0001 | 2 | 3,086.04 |
| PACKING | 293 | 00016 | Growth Promoter 25kg | 0001 | 60 | 590.09 |
| PACKINGBATCH | 293 | 02032 | BAG Growth Promoter 25 KG | 0001 | 60 | 155 |
| PACKINGBATCH | 293 | 03001 | Growth Promoter BOP Oral | 0001 | 1,500 | 17.4 |
| PurchasesBatch | 149 | 01043 | Sodium Chloride | 0001 | 1,250 | 13.75 |
| PurchasesBatch | 150 | 01009 | Copper Sulphate | 0001 | 25 | 2,200 |
| PurchasesBatch | 150 | 01013 | Calcium Chloride | 0001 | 25 | 210 |
| PurchasesBatch | 151 | 02425 | Label Leo Immunomax Oral Liquid 5 Lit | 0001 | 35 | 40 |
| PurchasesBatch | 151 | 02422 | Label Leo Hepaton Oral Liquid 5 Lit | 0001 | 35 | 40 |
| PurchasesBatch | 152 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 50 | 213 |
| PurchasesBatch | 152 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 85 | 235 |
| Productions | 277 | 03002 | DCP Powder | 0001 | 6,250 | 11.68 |
| PRODUCTIONBATCH | 277 | 01190 | PHOSPHORUS Powder 29% | 0001 | 6,350 | 11.5 |
| PACKING | 294 | 00019 | DCP BOP 25kg | 0001 | 250 | 372.1 |
| PACKINGBATCH | 294 | 02034 | BAG BOP DCP 25 KG | 0001 | 250 | 80 |
| PACKINGBATCH | 294 | 03002 | DCP Powder | 0001 | 6,250 | 11.68 |
| Productions | 278 | 03258 | Leo Immunomax Oral Liquid | 001 | 120 | 73.82 |
| PRODUCTIONBATCH | 278 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 278 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 278 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| Productions | 278 | 03258 | Leo Immunomax Oral Liquid | 001 | 120 | 73.82 |
| PACKING | 295 | 00362 | Leo Immunomax Oral Liquid 5 Lit | 0001 | 24 | 1,045.62 |
| PACKINGBATCH | 295 | 02014 | Plastic Can White 5 Liter | 0001 | 30 | 439.97 |
| PACKINGBATCH | 295 | 02425 | Label Leo Immunomax Oral Liquid 5 Lit | 0001 | 35 | 40 |
| PACKINGBATCH | 295 | 03258 | Leo Immunomax Oral Liquid | 001 | 120 | 73.82 |
| PACKINGBATCH | 295 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 7 | 233.94 |
| PACKING | 295 | 00362 | Leo Immunomax Oral Liquid 5 Lit | 0001 | 24 | 1,045.62 |
| Productions | 279 | 03254 | Hepa Leo Oral Liquid | 0001 | 100 | 116.29 |
| PRODUCTIONBATCH | 279 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 279 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 279 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 279 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 279 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 279 | 01184 | ARQ | 0001 | 5 | 366.67 |
| Productions | 279 | 03254 | Hepa Leo Oral Liquid | 0001 | 100 | 116.29 |
| PurchasesBatch | 151 | 02422 | Label Leo Hepaton Oral Liquid 5 Lit |  | 0 | 0 |
| PurchasesBatch | 151 | 02421 | Label Hepa Leo Oral Liquid 5 Lit | 0001 | 35 | 40 |
| PACKING | 296 | 00358 | Hepa Leo Oral Liquid 5 Lit | 0001 | 20 | 1,259.88 |
| PACKINGBATCH | 296 | 02014 | Plastic Can White 5 Liter | 0001 | 25 | 439.97 |
| PACKINGBATCH | 296 | 02421 | Label Hepa Leo Oral Liquid 5 Lit | 0001 | 35 | 40 |
| PACKINGBATCH | 296 | 03254 | Hepa Leo Oral Liquid | 0001 | 100 | 116.29 |
| PACKINGBATCH | 296 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 233.94 |
| PACKING | 296 | 00358 | Hepa Leo Oral Liquid 5 Lit | 0001 | 20 | 1,259.88 |
| Productions | 280 | 03001 | Growth Promoter BOP Oral | 0001 | 250 | 17.4 |
| PRODUCTIONBATCH | 280 | 01016 | DCP (Dana) | 0001 | 200 | 10 |
| PRODUCTIONBATCH | 280 | 01042 | Starch | 0001 | 3 | 168.72 |
| PRODUCTIONBATCH | 280 | 01043 | Sodium Chloride | 0001 | 50 | 13.75 |
| PRODUCTIONBATCH | 280 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| Productions | 280 | 03001 | Growth Promoter BOP Oral | 0001 | 250 | 17.4 |
| PACKING | 297 | 00016 | Growth Promoter 25kg | 0001 | 10 | 590.09 |
| PACKINGBATCH | 297 | 02032 | BAG Growth Promoter 25 KG | 0001 | 10 | 155 |
| PACKINGBATCH | 297 | 03001 | Growth Promoter BOP Oral | 0001 | 250 | 17.4 |
| PACKING | 297 | 00016 | Growth Promoter 25kg | 0001 | 10 | 590.09 |
| Productions | 281 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.1 |
| PRODUCTIONBATCH | 281 | 01003 | Bentonite | 0001 | 250 | 13.1 |
| Productions | 281 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.1 |
| PACKING | 298 | 00022 | Magnet BOP 25kg | 0001 | 10 | 482.5 |
| PACKINGBATCH | 298 | 02033 | BAG Magnet 25 KG | 0001 | 10 | 155 |
| PACKINGBATCH | 298 | 03014 | Magnet BOP Oral Powder | 0001 | 250 | 13.1 |
| PACKING | 298 | 00022 | Magnet BOP 25kg | 0001 | 10 | 482.5 |
| Productions | 282 | 03163 | Calcium 72 | 0001 | 100 | 17 |
| PRODUCTIONBATCH | 282 | 01015 | DCP (Calcium) | 0001 | 100 | 17 |
| PACKING | 299 | 00248 | Calcium-72 1KG | 0001 | 100 | 58.7 |
| PACKINGBATCH | 299 | 02299 | Packet Calcium-72 1KG | 0001 | 100 | 30 |
| PACKINGBATCH | 299 | 03163 | Calcium 72 | 0001 | 100 | 17 |
| PACKINGBATCH | 299 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 233.94 |
| Productions | 283 | 03273 | Bio Drink Oral Powder | 0001 | 120 | 138.88 |
| PRODUCTIONBATCH | 283 | 01047 | Sodium Sulphate | 0001 | 120 | 73.98 |
| PRODUCTIONBATCH | 283 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 283 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 5 | 1,549.97 |
| Productions | 283 | 03273 | Bio Drink Oral Powder | 0001 | 120 | 138.88 |
| PACKING | 300 | 00383 | Bio Drink Oral Powder 1 Kg | 0001 | 120 | 368.98 |
| PACKINGBATCH | 300 | 02043 | JAR 1 KG | 0001 | 120 | 160 |
| PACKINGBATCH | 300 | 02446 | Label Bio Drink Oral Powder 1 Kg | 0001 | 135 | 40 |
| PACKINGBATCH | 300 | 03273 | Bio Drink Oral Powder | 0001 | 120 | 138.88 |
| PACKINGBATCH | 300 | 02118 | Shipper J | 0001 | 12 | 251 |
| PACKING | 300 | 00383 | Bio Drink Oral Powder 1 Kg | 0001 | 120 | 368.98 |
| Productions | 284 | 03274 | Bop Cranol Oral Powder | 0001 | 120 | 88.38 |
| PRODUCTIONBATCH | 284 | 01002 | Ammonium chloride | 0001 | 6 | 271.82 |
| PRODUCTIONBATCH | 284 | 01047 | Sodium Sulphate | 0001 | 120 | 73.98 |
| PRODUCTIONBATCH | 284 | 01073 | Potassium Chloride | 0001 | 0 | 389.84 |
| PRODUCTIONBATCH | 284 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 284 | 03274 | Bop Cranol Oral Powder | 0001 | 120 | 88.38 |
| PACKING | 301 | 00384 | Bop Cranol Oral Powder 1 Kg | 0001 | 120 | 318.48 |
| PACKINGBATCH | 301 | 02043 | JAR 1 KG | 0001 | 120 | 160 |
| PACKINGBATCH | 301 | 02447 | Label Bop Cranol Oral Powder 1 Kg | 0001 | 135 | 40 |
| PACKINGBATCH | 301 | 03274 | Bop Cranol Oral Powder | 0001 | 120 | 88.38 |
| PACKINGBATCH | 301 | 02118 | Shipper J | 0001 | 12 | 251 |
| PACKING | 301 | 00384 | Bop Cranol Oral Powder 1 Kg | 0001 | 120 | 318.48 |
| Productions | 285 | 03022 | Growth Promoter Plus | 0001 | 250 | 17.94 |
| PRODUCTIONBATCH | 285 | 01003 | Bentonite | 0001 | 250 | 13.1 |
| PRODUCTIONBATCH | 285 | 01031 | Menthol Crystal | 0001 | 0 | 6,055.56 |
| Productions | 285 | 03022 | Growth Promoter Plus | 0001 | 250 | 17.94 |
| PACKING | 302 | 00041 | Growth Promoter Plus 25kg | 0001 | 10 | 771.62 |
| PACKINGBATCH | 302 | 02041 | Label Growth Promoter Plus 25 KG | 0001 | 12 | 140 |
| PACKINGBATCH | 302 | 03022 | Growth Promoter Plus | 0001 | 250 | 17.94 |
| PACKINGBATCH | 302 | 02277 | Bag Bop Yellow Colour | 0001 | 10 | 155 |
| PACKING | 302 | 00041 | Growth Promoter Plus 25kg | 0001 | 10 | 771.61 |
| Productions | 286 | 03003 | Calci-Phos-D | 0001 | 60 | 27.09 |
| PRODUCTIONBATCH | 286 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 286 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 286 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 286 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 286 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 286 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 286 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 286 | 03003 | Calci-Phos-D | 0001 | 60 | 27.09 |
| PACKING | 303 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 898.52 |
| PACKINGBATCH | 303 | 02097 | Bottle Round liter | 0001 | 229 | 222.21 |
| PACKINGBATCH | 303 | 02385 | Label Calci Phos D 1 Lit | 0001 | 70 | 20 |
| PACKINGBATCH | 303 | 03003 | Calci-Phos-D | 0001 | 60 | 27.09 |
| PACKING | 303 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 898.52 |
| SALESBATCH | 80 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 225 | 243.48 |
| SALESBATCH | 80 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 52 | 2,100.57 |
| SALESBATCH | 80 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 48 | 2,041.85 |
| SALESBATCH | 80 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 44 | 1,114.83 |
| SALESBATCH | 80 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 20 | 1,477.88 |
| SALESBATCH | 80 | 00289 | ACIDO FORTE 25 Lit | 0001 | 10 | 2,330.41 |
| SALESBATCH | 80 | 00373 | MLC 360 Oral Liquid 25 Lit | 0001 | 10 | 4,477.14 |
| SALESBATCH | 81 | 00352 | BronoKill  Liquid  25 Lit | 0001 | 20 | 3,827.36 |
| SALESBATCH | 82 | 00016 | Growth Promoter 25kg | 0001 | 34 | 525.41 |
| SALESBATCH | 82 | 00125 | Golden Premix 25Kg | 0001 | 19 | 721.45 |
| SALESBATCH | 82 | 00040 | Super Yeast Powder 25kg | 001 | 10 | 873.93 |
| SALESBATCH | 82 | 00231 | Calcium 72 25kg | 0001 | 100 | 487.06 |
| SALESBATCH | 83 | 00231 | Calcium 72 25kg | 0001 | 15 | 487.06 |
| SALESBATCH | 84 | 00135 | Super Copper Liquid 5 Lit | 0001 | 20 | 1,875.02 |
| SALESBATCH | 84 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 16 | 5,000 |
| SALESBATCH | 85 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 40 | 1,369 |
| SALESBATCH | 85 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 40 | 996.04 |
| SALESBATCH | 85 | 00339 | Veto Respi Oral Liquid Oil Base 5 Lit | 0001 | 48 | 1,481.95 |
| SALESBATCH | 85 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 60 | 1,085.87 |
| SALESBATCH | 86 | 00049 | Calci-Phos-D 5 Lit | 0001 | 44 | 740.02 |
| SALESBATCH | 86 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 8 | 996.04 |
| SALESBATCH | 86 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 44 | 1,059.87 |
| SALESBATCH | 87 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 60 | 1,059.87 |
| SALESBATCH | 88 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 44 | 1,059.87 |
| SALESBATCH | 89 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 120 | 1,861.16 |
| SALESBATCH | 90 | 00010 | Calci-Phos-D100ML | 0001 | 200 | 30.37 |
| SALESBATCH | 90 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 33.02 |
| SALESBATCH | 90 | 00248 | Calcium-72 1KG | 0001 | 25 | 61.94 |
| SALESBATCH | 91 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 200 | 33.02 |
| SALESBATCH | 91 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 43.98 |
| SALESBATCH | 91 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 30.37 |
| SALESBATCH | 91 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 363.05 |
| SALESBATCH | 91 | 00022 | Magnet BOP 25kg | 0001 | 30 | 498.38 |
| SALESBATCH | 91 | 00038 | Hepatic-Optimizer Powder 25kg | 0001 | 5 | 538.74 |
| SALESBATCH | 91 | 00054 | Mento Care Oral Liquid | 0001 | 24 | 409.95 |
| SALESBATCH | 91 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 12 | 1,059.87 |
| SALESBATCH | 91 | 00024 | Hepatic-Optimizer 1 Lit | 0001 | 48 | 410.29 |
| SALESBATCH | 91 | 00064 | Toniplex Bop Oral Liquid 1 Lit | 0001 | 60 | 364.92 |
| SALESBATCH | 91 | 00091 | Toniplex Oral Liquid 5 Lit | 0001 | 8 | 917.22 |
| SALESBATCH | 91 | 00151 | BOP Copper Liquid 1 Lit | 0001 | 60 | 431.77 |
| SALESBATCH | 91 | 00187 | TOXI-OFF Liquid 5 Liter | 0001 | 12 | 1,719.02 |
| SALESBATCH | 91 | 00030 | Coolper 100gm | 0001 | 1,200 | 30.91 |
| SALESBATCH | 91 | 00220 | Rumicid powder 25kg | 0001 | 10 | 630.3 |
| SALESBATCH | 91 | 00016 | Growth Promoter 25kg | 0001 | 10 | 525.41 |
| SALESBATCH | 91 | 00212 | Microgold-Bop 25 kg | 0001 | 10 | 1,695.66 |
| SALESBATCH | 91 | 00121 | Nephretic 1kg powder | 0001 | 75 | 260.07 |
| SALESBATCH | 92 | 00363 | PhytoFat Gold 25 Kg | 0001 | 100 | 14,000 |
| SALESBATCH | 93 | 00197 | Eggcelent liquid 5 Liter | 0001 | 100 | 1,265.05 |
| SALESBATCH | 94 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 16 | 697.72 |
| SALESBATCH | 94 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 8 | 1,369 |
| SALESBATCH | 95 | 00231 | Calcium 72 25kg | 0001 | 20 | 487.06 |
| SALESBATCH | 95 | 00022 | Magnet BOP 25kg | 0001 | 10 | 498.38 |
| SALESBATCH | 95 | 00220 | Rumicid powder 25kg | 0001 | 5 | 630.3 |
| SALESBATCH | 96 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 10 | 708.11 |
| SALESBATCH | 97 | 00318 | IG Max Oral Liquid 1 Liter | 0001 | 240 | 285.89 |
| SALESBATCH | 97 | 00319 | Pulmonal Oral Liquid 1 Liter | 0001 | 240 | 471.03 |
| SALESBATCH | 97 | 00317 | Tox End Oral Liquid 1 Liter | 0001 | 240 | 335.46 |
| SALESBATCH | 98 | 00377 | BOP DCAD Powder 25 kg | 0001 | 40 | 2,141.71 |
| SALESBATCH | 98 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,410.36 |
| SALESBATCH | 99 | 00375 | BOP TOX Oral Powder 25 kg | 0001 | 3 | 718.81 |
| SALESBATCH | 100 | 00231 | Calcium 72 25kg | 0001 | 10 | 487.06 |
| SALESBATCH | 101 | 00074 | Magnet Plus 25 Kg | 0001 | 2 | 924.38 |
| SALESBATCH | 102 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 8 | 1,059.87 |
| SALESBATCH | 102 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 12 | 1,369 |
| SALESBATCH | 102 | 00266 | E.S  200 liquid 5 Liter | 0001 | 4 | 830.34 |
| SALESBATCH | 102 | 00163 | Mento Respi Liquid 5 Lit | 0001 | 8 | 1,702.2 |
| SALESBATCH | 102 | 00072 | CID 7 Oral Liquid 5 Liter | 0001 | 4 | 802.94 |
| SALESBATCH | 102 | 00209 | Hepatic Optimizer fort Powder 25kg | 0001 | 2 | 905.48 |
| SALESBATCH | 102 | 00076 | Prime Grow Protein 25 kg | 0001 | 2 | 1,376.08 |
| SALESBATCH | 103 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 60 | 2,100.57 |
| SALESBATCH | 103 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 001 | 20 | 1,051.42 |
| SALESBATCH | 103 | 00372 | Vital Frame Oral Liquid 5 Lit | 0001 | 20 | 757.86 |
| SALESBATCH | 103 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 8 | 5,000 |
| SALESBATCH | 103 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 150 | 243.48 |
| SALESBATCH | 103 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 1,134.02 |
| SALERETURNSBATCH | 1 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 4 | 4 |
| SALERETURNSBATCH | 1 | 00281 | MLC 100  Oral Liquid 5 Liter |  | 0 | 0 |
| SALESBATCH | 104 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 104 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 3 | 708.11 |
| SALESBATCH | 105 | 00026 | Vital Gold 1kg | 0001 | 1,860 | 61.61 |
| SALESBATCH | 105 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,540.15 |
| SALESBATCH | 106 | 00220 | Rumicid powder 25kg | 0001 | 10 | 630.3 |
| SALESBATCH | 107 | 00231 | Calcium 72 25kg | 0001 | 20 | 487.06 |
| SALESBATCH | 108 | 00008 | Scour Guard100ML | 0001 | 400 | 32.19 |
| SALESBATCH | 108 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 285.75 |
| SALESBATCH | 109 | 00008 | Scour Guard100ML | 0001 | 400 | 32.19 |
| SALESBATCH | 109 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 285.75 |
| SALESBATCH | 110 | 00369 | Febro Meon Spray 120 ML | 0001 | 1,440 | 285.75 |
| SALESBATCH | 111 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 285.75 |
| SALESBATCH | 112 | 00369 | Febro Meon Spray 120 ML | 0001 | 960 | 285.75 |
| SALESBATCH | 113 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 285.75 |
| SALESBATCH | 114 | 00220 | Rumicid powder 25kg | 0001 | 5 | 630.3 |
| SALESBATCH | 114 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 990.92 |
| SALESBATCH | 114 | 00022 | Magnet BOP 25kg | 0001 | 15 | 498.38 |
| SALESBATCH | 114 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 2 | 5,000 |
| SALESBATCH | 114 | 00035 | Bio-Fat 25kg | 0001 | 10 | 5,729.01 |
| SALESBATCH | 114 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,695.66 |
| SALESBATCH | 115 | 00309 | Levo Care Oral Liquid 5 Lit | 0001 | 20 | 1,614.26 |
| SALESBATCH | 115 | 00206 | Super Copper Liquid 1Lit | 0001 | 120 | 421.64 |
| SALESBATCH | 115 | 00378 | Liv Guard Oral Liquid 1 Lit | 0001 | 60 | 374.46 |
| SALESBATCH | 115 | 00226 | O-D Plus Liquid 1lit | 0001 | 120 | 512.02 |
| SALESBATCH | 115 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 200 | 1,060.03 |
| SALESBATCH | 115 | 00019 | DCP BOP 25kg | 0001 | 50 | 390.86 |
| SALESBATCH | 116 | 00035 | Bio-Fat 25kg | 0001 | 7 | 5,729.01 |
| SALESBATCH | 117 | 00344 | JELITO Liquid 25 Lit | 0001 | 22 | 3,918.53 |
| SALESBATCH | 118 | 00197 | Eggcelent liquid 5 Liter | 0001 | 100 | 1,265.05 |
| SALESBATCH | 119 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 68 | 1,369 |
| SALESBATCH | 120 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 363.05 |
| SALESBATCH | 120 | 00016 | Growth Promoter 25kg | 0001 | 20 | 525.41 |
| SALESBATCH | 121 | 00016 | Growth Promoter 25kg | 0001 | 10 | 525.41 |
| SALESBATCH | 122 | 00199 | Yeast Plus Powder 25 kg | 0001 | 70 | 990.92 |
| SALESBATCH | 123 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 285.75 |
| SALESBATCH | 124 | 00248 | Calcium-72 1KG | 0001 | 500 | 61.94 |
| Productions | 287 | 03163 | Calcium 72 | 0001 | 1,950 | 8.72 |
| PRODUCTIONBATCH | 287 | 01015 | DCP (Calcium) | 0001 | 1,000 | 17 |
| PACKING | 304 | 00231 | Calcium 72 25kg | 0001 | 78 | 217.95 |
| PACKINGBATCH | 304 | 03163 | Calcium 72 | 0001 | 1,950 | 8.72 |
| PACKING | 304 | 00231 | Calcium 72 25kg | 0001 | 78 | 217.95 |
| SALESBATCH | 124 | 00231 | Calcium 72 25kg | 0001 | 78 | 217.95 |
| SALESBATCH | 124 | 00016 | Growth Promoter 25kg | 0001 | 20 | 525.41 |
| SALESBATCH | 124 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 363.05 |
| OpeningBatch | 113 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 70 |
| SALESBATCH | 124 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 63.39 |
| OpeningBatch | 114 | 00008 | Scour Guard100ML | 0001 | 500 | 64 |
| SALESBATCH | 124 | 00008 | Scour Guard100ML | 0001 | 500 | 54.91 |
| SALESBATCH | 125 | 00264 | DCP-Gold 25Kg | 0001 | 200 | 445 |
| SALESBATCH | 126 | 00030 | Coolper 100gm | 0001 | 1,500 | 30.91 |
| SALESBATCH | 127 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 2,362.31 |
| SALESBATCH | 128 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 200 | 1,861.16 |
| SALESBATCH | 128 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 4,329.73 |
| SALESBATCH | 128 | 00048 | Lysogar-Lic Powder 1kg | 0001 | 255 | 275.06 |
| SALESBATCH | 129 | 00180 | Stable C 20 (5 Liter) | 0001 | 44 | 1,376.98 |
| SALESBATCH | 130 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 131 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 132 | 00073 | Ambro_Lic Oral Liquid 1 Liter | 0001 | 1,296 | 463.89 |
| SALESBATCH | 133 | 00366 | Leo Sorbex Oral Powder 25 kg | 0001 | 15 | 585.91 |
| SALESBATCH | 134 | 00266 | E.S  200 liquid 5 Liter | 0001 | 40 | 830.34 |
| SALESBATCH | 135 | 00038 | Hepatic-Optimizer Powder 25kg | 0001 | 10 | 538.74 |
| SALESBATCH | 136 | 00086 | Oripulmo Liquid 1 Lit | 0001 | 480 | 413.64 |
| SALESBATCH | 137 | 00038 | Hepatic-Optimizer Powder 25kg | 0001 | 100 | 538.74 |
| SALESBATCH | 137 | 00046 | Fuzion Plus 5 Lit | 0001 | 60 | 865.61 |
| SALESBATCH | 138 | 00363 | PhytoFat Gold 25 Kg | 0001 | 2 | 14,000 |
| SALESBATCH | 138 | 00220 | Rumicid powder 25kg | 0001 | 5 | 630.3 |
| SALESBATCH | 139 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 3 | 1,658.23 |
| SALESBATCH | 140 | 00363 | PhytoFat Gold 25 Kg | 0001 | 40 | 14,000 |
| SALESBATCH | 141 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 20 | 708.11 |
| SALESBATCH | 141 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 000 | 8 | 621.09 |
| SALESBATCH | 142 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,410.36 |
| SALESBATCH | 142 | 00363 | PhytoFat Gold 25 Kg | 0001 | 1 | 14,000 |
| SALESBATCH | 142 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 100 | 33.02 |
| SALESBATCH | 142 | 00212 | Microgold-Bop 25 kg | 0001 | 1 | 1,695.66 |
| SALESBATCH | 142 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 100 | 43.98 |
| SALESBATCH | 143 | 00032 | Calci-Phos-D 1000ml | 0001 | 12 | 363.05 |
| SALESBATCH | 143 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 63.39 |
| SALESBATCH | 143 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 100 | 33.02 |
| SALESBATCH | 143 | 00008 | Scour Guard100ML | 0001 | 100 | 54.91 |
| SALESBATCH | 143 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 285.75 |
| SALESBATCH | 143 | 00265 | GrowMore 1Kg | 0001 | 20 | 51.62 |
| SALESBATCH | 143 | 00020 | Magnet BOP 1kg | 0001 | 25 | 43.1 |
| SALESBATCH | 143 | 00257 | Heaatic-Optimizer 100ML | 0001 | 100 | 34.33 |
| SALESBATCH | 144 | 00258 | GrowMore 25KG | 0001 | 4 | 540.41 |
| SALESBATCH | 144 | 00369 | Febro Meon Spray 120 ML | 0001 | 192 | 285.75 |
| SALESBATCH | 144 | 00032 | Calci-Phos-D 1000ml | 0001 | 12 | 363.05 |
| SALESBATCH | 144 | 00262 | Magnet 100gm | 0001 | 100 | 14.18 |
| SALESBATCH | 144 | 00363 | PhytoFat Gold 25 Kg | 0001 | 1 | 14,000 |
| SALESBATCH | 144 | 00008 | Scour Guard100ML | 0001 | 100 | 54.91 |
| SALESBATCH | 144 | 00182 | Microgest Powder 100 gm | 0001 | 100 | 10.32 |
| SALESBATCH | 144 | 00259 | Garliment-Plus BOP  30ML | 0001 | 225 | 25.63 |
| SALESBATCH | 145 | 00381 | Bop PH5  1 Lit | 0001 | 120 | 304.44 |
| SALESBATCH | 146 | 00382 | Garlic Pro Oral Liquid  5 Lit | 0001 | 60 | 1,363.14 |
| SALESBATCH | 147 | 00351 | BOP Glycholine Plus Oral Solution 25 Lit | 0001 | 4 | 3,767.88 |
| SALESBATCH | 148 | 00220 | Rumicid powder 25kg | 0001 | 20 | 630.3 |
| SALESBATCH | 149 | 00049 | Calci-Phos-D 5 Lit | 0001 | 24 | 740.02 |
| SALESBATCH | 150 | 00019 | DCP BOP 25kg | 0001 | 80 | 390.86 |
| SALESBATCH | 150 | 00022 | Magnet BOP 25kg | 0001 | 50 | 498.38 |
| SALESBATCH | 150 | 00262 | Magnet 100gm | 0001 | 900 | 14.18 |
| SALESBATCH | 150 | 00182 | Microgest Powder 100 gm | 0001 | 600 | 10.32 |
| SALESBATCH | 150 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 500 | 33.02 |
| SALESBATCH | 150 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 363.05 |
| SALESBATCH | 150 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 150 | 00199 | Yeast Plus Powder 25 kg | 0001 | 7 | 990.92 |
| SALESBATCH | 150 | 00016 | Growth Promoter 25kg | 0001 | 60 | 525.41 |
| Productions | 288 | 03163 | Calcium 72 | 0001 | 500 | 6.8 |
| PRODUCTIONBATCH | 288 | 01015 | DCP (Calcium) | 0001 | 200 | 17 |
| PACKING | 305 | 00248 | Calcium-72 1KG | 0001 | 500 | 49.7 |
| PACKINGBATCH | 305 | 02299 | Packet Calcium-72 1KG | 0001 | 520 | 30 |
| PACKINGBATCH | 305 | 03163 | Calcium 72 | 0001 | 500 | 6.8 |
| PACKINGBATCH | 305 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 233.94 |
| SALESBATCH | 150 | 00248 | Calcium-72 1KG | 0001 | 500 | 51.74 |
| SALESBATCH | 151 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 10 | 1,658.23 |
| SALESBATCH | 152 | 00362 | Leo Immunomax Oral Liquid 5 Lit | 0001 | 24 | 1,045.62 |
| SALESBATCH | 152 | 00358 | Hepa Leo Oral Liquid 5 Lit | 0001 | 20 | 1,259.88 |
| SALESBATCH | 153 | 00016 | Growth Promoter 25kg | 0001 | 10 | 525.41 |
| SALESBATCH | 153 | 00022 | Magnet BOP 25kg | 0001 | 10 | 498.38 |
| SALESBATCH | 153 | 00363 | PhytoFat Gold 25 Kg | 0001 | 2 | 14,000 |
| SALESBATCH | 153 | 00248 | Calcium-72 1KG | 0001 | 100 | 51.74 |
| SALESBATCH | 154 | 00019 | DCP BOP 25kg | 0001 | 250 | 390.86 |
| SALESBATCH | 155 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 155 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 1,410.36 |
| SALESBATCH | 155 | 00022 | Magnet BOP 25kg | 0001 | 1 | 498.38 |
| SALERETURNSBATCH | 1 | 00160 | VitaMinro-Lic Mineral 25 Kg | 0001 | 10 | 4,500 |
| SALERETURNSBATCH | 1 | 00161 | VitaMinro-Lic Mineral 1Kg | 001 | 45 | 210 |
| SALERETURNSBATCH | 1 | 00156 | DCP-Lic Powder 25 Kg (High) | 0001 | 2 | 1,500 |
| SALERETURNSBATCH | 1 | 00154 | Calpho-Lic Liquid 100 ML | 0001 | 3,873 | 60 |
| SALERETURNSBATCH | 1 | 00150 | Calpho Lic Liquid 5 Lit | 0001 | 5 | 3,000 |
| SALERETURNSBATCH | 1 | 00245 | Sparko-80 25L | 0001 | 1 | 7,500 |
| SALERETURNSBATCH | 1 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 2 | 6,000 |
| SALERETURNSBATCH | 1 | 00159 | Minro-Lic mineral 1 Kg | 0001 | 2 | 130 |
| SALERETURNSBATCH | 2 | 00048 | Lysogar-Lic Powder 1kg | 0001 | 20 | 1,500 |
| SALERETURNSBATCH | 2 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 1 | 6,000 |
| SALESBATCH | 156 | 00383 | Bio Drink Oral Powder 1 Kg | 0001 | 120 | 368.98 |
| SALESBATCH | 156 | 00384 | Bop Cranol Oral Powder 1 Kg | 0001 | 120 | 318.48 |
| SALESBATCH | 156 | 00041 | Growth Promoter Plus 25kg | 0001 | 10 | 771.61 |
| SALESBATCH | 156 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 363.05 |
| SALESBATCH | 156 | 00383 | Bio Drink Oral Powder 1 Kg |  | 0 | 0 |
| PurchasesBatch | 153 | 01042 | Starch | 001 | 50 | 167 |
| PurchasesBatch | 153 | 01042 | Starch |  | 0 | 0 |
| Productions | 289 | 03182 | GrowMore Powder | 001 | 450 | 21.28 |
| PRODUCTIONBATCH | 289 | 01009 | Copper Sulphate | 0001 | 0 | 2,199.69 |
| PRODUCTIONBATCH | 289 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 289 | 01016 | DCP (Dana) | 0001 | 360 | 10 |
| PRODUCTIONBATCH | 289 | 01042 | Starch | 0001 | 4 | 168.72 |
| PRODUCTIONBATCH | 289 | 01043 | Sodium Chloride | 0001 | 90 | 13.75 |
| PRODUCTIONBATCH | 289 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 289 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 289 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 289 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 289 | 03182 | GrowMore Powder | 001 | 450 | 21.28 |
| PACKING | 306 | 00265 | GrowMore 1Kg | 001 | 450 | 63.91 |
| PACKINGBATCH | 306 | 02315 | Packet GrowMore 1KG | 0001 | 460 | 30 |
| PACKINGBATCH | 306 | 03182 | GrowMore Powder | 001 | 450 | 21.28 |
| PACKINGBATCH | 306 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 23 | 233.94 |
| PACKING | 306 | 00265 | GrowMore 1Kg | 001 | 450 | 63.91 |
| Productions | 290 | 03003 | Calci-Phos-D | 001 | 60 | 27.09 |
| PRODUCTIONBATCH | 290 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 290 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 290 | 01038 | Phosphoric Acid 85% | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 290 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 290 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 290 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 290 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 290 | 03003 | Calci-Phos-D | 001 | 60 | 27.09 |
| OpeningBatch | 64 | 02097 | Bottle Round liter | 0001 | 800 | 220 |
| PACKING | 307 | 00032 | Calci-Phos-D 1000ml | 001 | 60 | 270.75 |
| PACKINGBATCH | 307 | 02097 | Bottle Round liter | 0001 | 60 | 220.33 |
| PACKINGBATCH | 307 | 02385 | Label Calci Phos D 1 Lit | 0001 | 70 | 20 |
| PACKINGBATCH | 307 | 03003 | Calci-Phos-D | 001 | 60 | 27.09 |
| PACKING | 307 | 00032 | Calci-Phos-D 1000ml | 001 | 60 | 270.75 |
| Productions | 291 | 03014 | Magnet BOP Oral Powder | 001 | 200 | 13.1 |
| PRODUCTIONBATCH | 291 | 01003 | Bentonite | 0001 | 200 | 13.1 |
| PACKING | 308 | 00020 | Magnet BOP 1kg | 001 | 200 | 56.3 |
| PACKINGBATCH | 308 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 210 | 30 |
| PACKINGBATCH | 308 | 03014 | Magnet BOP Oral Powder | 001 | 200 | 13.1 |
| PACKINGBATCH | 308 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 233.94 |
| Productions | 292 | 03010 | Garlimint Plus BOP | 001 | 13 | 164.26 |
| PRODUCTIONBATCH | 292 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 292 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 292 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 292 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 292 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 292 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 292 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 292 | 03010 | Garlimint Plus BOP | 001 | 13 | 164.26 |
| PACKING | 309 | 00259 | Garliment-Plus BOP  30ML | 001 | 13 | 107 |
| PACKINGBATCH | 309 | 02314 | Dropper  30ML | 0001 | 13 | 13 |
| PACKINGBATCH | 309 | 02316 | S+D Garliment Plus 30ML | 0001 | 13 | 6 |
| PACKINGBATCH | 309 | 03010 | Garlimint Plus BOP | 001 | 0 | 164.26 |
| PACKINGBATCH | 309 | 02003 | Shipper [C] 15 pcs Tin (1 KG) | 0001 | 5 | 216 |
| PACKING | 309 | 00259 | Garliment-Plus BOP  30ML | 001 | 13 | 107 |
| Productions | 293 | 03264 | Febro Meon Spray | 001 | 23 | 330.96 |
| PRODUCTIONBATCH | 293 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 293 | 01065 | Spt Amm. Aromatic | 0001 | 23 | 265 |
| PRODUCTIONBATCH | 293 | 01075 | Peppermint Oil | 0001 | 0 | 5,192.28 |
| Productions | 293 | 03264 | Febro Meon Spray | 001 | 23 | 330.96 |
| OpeningBatch | 109 | 02433 | Tin Febro Meon Spray | 0001 | 2,208 | 150 |
| PACKING | 310 | 00369 | Febro Meon Spray 120 ML | 001 | 23 | 1,583.14 |
| PACKINGBATCH | 310 | 02433 | Tin Febro Meon Spray | 0001 | 192 | 150 |
| PACKINGBATCH | 310 | 03264 | Febro Meon Spray | 001 | 23 | 330.96 |
| PACKING | 310 | 00369 | Febro Meon Spray 120 ML | 001 | 23 | 1,583.14 |
| PurchasesBatch | 153 | 02448 | white bag 5 kg | 001 | 30 | 100 |
| PurchasesBatch | 154 | 02097 | Bottle Round liter | 001 | 60 | 230 |
| PurchasesBatch | 155 | 02010 | Bottle Pet Amber 100ML | 001 | 600 | 8 |
| PurchasesBatch | 156 | 01044 | Sodium Bicarbonate | 001 | 25 | 128 |
| Productions | 294 | 03055 | Ori Tox Oral Powder 25 kg | 001 | 5,000 | 13.1 |
| PRODUCTIONBATCH | 294 | 01003 | Bentonite | 0001 | 5,000 | 13.1 |
| PACKING | 311 | 00078 | ORITOX Oral Powder  25 Kg | 001 | 200 | 327.5 |
| PACKINGBATCH | 311 | 03055 | Ori Tox Oral Powder 25 kg | 001 | 5,000 | 13.1 |
| Productions | 295 | 03003 | Calci-Phos-D | 001 | 100 | 0 |
| PRODUCTIONBATCH | 295 | 01013 | Calcium Chloride | 0001 | 1 | 209.98 |
| PRODUCTIONBATCH | 295 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 295 | 01038 | Phosphoric Acid 85% | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 295 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 295 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 295 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 295 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 295 | 03003 | Calci-Phos-D | 001 | 100 | 27.09 |
| PACKING | 312 | 00010 | Calci-Phos-D100ML | 001 | 400 | 25.45 |
| PACKINGBATCH | 312 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 420 | 12 |
| PACKINGBATCH | 312 | 03003 | Calci-Phos-D | 001 | 40 | 27.09 |
| PACKINGBATCH | 312 | 02010 | Bottle Pet Amber 100ML | 001 | 400 | 8 |
| PACKINGBATCH | 312 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 4 | 214.4 |
| PACKING | 313 | 00032 | Calci-Phos-D 1000ml | 001 | 60 | 263.92 |
| PACKINGBATCH | 313 | 02097 | Bottle Round liter | 0001 | 60 | 220.33 |
| PACKINGBATCH | 313 | 02385 | Label Calci Phos D 1 Lit | 0001 | 35 | 20 |
| PACKINGBATCH | 313 | 03003 | Calci-Phos-D | 001 | 60 | 27.09 |
| PACKING | 313 | 00032 | Calci-Phos-D 1000ml | 001 | 60 | 259.09 |
| Productions | 296 | 03165 | Timp-Ex Oral Liquid | 001 | 20 | 20.25 |
| PRODUCTIONBATCH | 296 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 296 | 01035 | Turpentine Oil | 0001 | 0 | 1,278.57 |
| PRODUCTIONBATCH | 296 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 296 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128.03 |
| PRODUCTIONBATCH | 296 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 296 | 03165 | Timp-Ex Oral Liquid | 001 | 20 | 20.25 |
| PACKING | 314 | 00233 | Timp-Ex Oral Liquid 120 ML | 001 | 200 | 24.77 |
| PACKINGBATCH | 314 | 02010 | Bottle Pet Amber 100ML | 001 | 200 | 8 |
| PACKINGBATCH | 314 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 210 | 12 |
| PACKINGBATCH | 314 | 03165 | Timp-Ex Oral Liquid | 001 | 20 | 20.25 |
| PACKINGBATCH | 314 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 2 | 214.4 |
| PACKING | 314 | 00233 | Timp-Ex Oral Liquid 120 ML | 001 | 200 | 24.77 |
| Productions | 297 | 03010 | Garlimint Plus BOP | 001 | 7 | 167.7 |
| PRODUCTIONBATCH | 297 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 297 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 297 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 297 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 297 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 297 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 297 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| Productions | 297 | 03010 | Garlimint Plus BOP | 001 | 7 | 167.7 |
| PACKING | 315 | 00259 | Garliment-Plus BOP  30ML | 001 | 7 | 619.96 |
| PACKINGBATCH | 315 | 02314 | Dropper  30ML | 0001 | 225 | 13 |
| PACKINGBATCH | 315 | 02316 | S+D Garliment Plus 30ML | 0001 | 230 | 6 |
| PACKINGBATCH | 315 | 03010 | Garlimint Plus BOP | 001 | 0 | 165.49 |
| PACKING | 315 | 00259 | Garliment-Plus BOP  30ML | 001 | 7 | 619.96 |
| Productions | 298 | 03163 | Calcium 72 | 001 | 100 | 14.2 |
| PRODUCTIONBATCH | 298 | 01015 | DCP (Calcium) | 0001 | 60 | 17 |
| PRODUCTIONBATCH | 298 | 01016 | DCP (Dana) | 0001 | 40 | 10 |
| PACKING | 316 | 00231 | Calcium 72 25kg | 001 | 3 | 355 |
| PACKINGBATCH | 316 | 03163 | Calcium 72 | 001 | 75 | 14.2 |
| PACKING | 317 | 00248 | Calcium-72 1KG | 001 | 25 | 53.56 |
| PACKINGBATCH | 317 | 02299 | Packet Calcium-72 1KG | 0001 | 25 | 30 |
| PACKINGBATCH | 317 | 03163 | Calcium 72 | 001 | 25 | 14.2 |
| PACKINGBATCH | 317 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 1 | 233.94 |
| Productions | 299 | 03264 | Febro Meon Spray | 001 | 11 | 501.74 |
| PRODUCTIONBATCH | 299 | 01019 | Eucluptus Oil | 0001 | 0 | 5,473.93 |
| PRODUCTIONBATCH | 299 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 299 | 01065 | Spt Amm. Aromatic | 0001 | 11 | 265 |
| PRODUCTIONBATCH | 299 | 01075 | Peppermint Oil | 0001 | 0 | 5,192.28 |
| PRODUCTIONBATCH | 299 | 01189 | Glycerine | 0001 | 2 | 717.02 |
| Productions | 299 | 03264 | Febro Meon Spray | 001 | 11 | 501.74 |
| OpeningBatch | 109 | 02433 | Tin Febro Meon Spray | 0001 | 2,304 | 150 |
| PACKING | 318 | 00369 | Febro Meon Spray 120 ML | 001 | 96 | 207.49 |
| PACKINGBATCH | 318 | 02433 | Tin Febro Meon Spray | 0001 | 96 | 150 |
| PACKINGBATCH | 318 | 03264 | Febro Meon Spray | 001 | 11 | 501.74 |
| PACKING | 318 | 00369 | Febro Meon Spray 120 ML | 001 | 96 | 207.49 |
| Productions | 300 | 03088 | Paower Plus | 001 | 25 | 45.39 |
| PRODUCTIONBATCH | 300 | 01016 | DCP (Dana) | 0001 | 20 | 10 |
| PRODUCTIONBATCH | 300 | 01042 | Starch | 0001 | 0 | 168.72 |
| PRODUCTIONBATCH | 300 | 01043 | Sodium Chloride | 0001 | 5 | 13.75 |
| PRODUCTIONBATCH | 300 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 300 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| Productions | 300 | 03088 | Paower Plus | 001 | 25 | 45.38 |
| PACKING | 319 | 00037 | paower Plus 25kg | 001 | 1 | 1,289.62 |
| PACKINGBATCH | 319 | 02213 | Bag Bop Red Colour | 0001 | 1 | 155 |
| PACKINGBATCH | 319 | 03088 | Paower Plus | 001 | 25 | 45.38 |
| PACKING | 319 | 00037 | paower Plus 25kg | 001 | 1 | 1,289.62 |
| Productions | 301 | 03253 | BOP Yeast Oral Powder (High) | 001 | 100 | 8.25 |
| PRODUCTIONBATCH | 301 | 01003 | Bentonite | 0001 | 50 | 13.1 |
| PRODUCTIONBATCH | 301 | 01007 | CSL | 0001 | 2 | 35 |
| PRODUCTIONBATCH | 301 | 01033 | Molasses | 0001 | 2 | 50 |
| Productions | 301 | 03253 | BOP Yeast Oral Powder (High) | 001 | 100 | 8.25 |
| PACKING | 320 | 00385 | Bop Yeast Oral Powder 5 KG | 001 | 20 | 191.25 |
| PACKINGBATCH | 320 | 02448 | white bag 5 kg | 001 | 30 | 100 |
| PACKINGBATCH | 320 | 03253 | BOP Yeast Oral Powder (High) | 001 | 100 | 8.25 |
| PACKING | 320 | 00385 | Bop Yeast Oral Powder 5 KG | 001 | 20 | 191.25 |
| PurchasesBatch | 157 | 02097 | Bottle Round liter | 001 | 540 | 230 |
| PurchasesBatch | 158 | 02010 | Bottle Pet Amber 100ML | 001 | 500 | 8 |
| PurchasesBatch | 159 | 01038 | Phosphoric Acid 85% | 001 | 25 | 650 |
| PurchasesBatch | 160 | 01073 | Potassium Chloride | 001 | 25 | 400 |
| PurchasesBatch | 161 | 02166 | Label ADEK Powder 1 Kg | 001 | 64 | 40 |
| PurchasesBatch | 161 | 02305 | Label Heaatic Optimizer 5 Liter | 001 | 56 | 40 |
| PurchasesBatch | 161 | 02141 | Label Immune Forte 5 Lit | PI012321 | 32 | 40 |
| PurchasesBatch | 161 | 02092 | Label Micro Sel E 5 Lit | 001 | 15 | 40 |
| PurchasesBatch | 161 | 02272 | Label Stable C20  5Lit | 001 | 20 | 40 |
| Productions | 302 | 03196 | Bop DCP Gold  Powder | 001 | 2,125 | 11.5 |
| PRODUCTIONBATCH | 302 | 01190 | PHOSPHORUS Powder 29% | 0001 | 2,125 | 11.5 |
| Productions | 303 | 03119 | Stable C 20 Liquid | 050726 | 60 | 164.87 |
| PRODUCTIONBATCH | 303 | 01041 | Sodium Benzoate | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 303 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128.03 |
| PRODUCTIONBATCH | 303 | 01044 | Sodium Bicarbonate | 001 | 0 | 128 |
| PRODUCTIONBATCH | 303 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 303 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 303 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 6 | 1,549.97 |
| Productions | 303 | 03119 | Stable C 20 Liquid | 050726 | 60 | 164.87 |
| PurchasesBatch | 162 | 01058 | Xanthan Gum | 001 | 20 | 1,450 |
| PurchasesBatch | 162 | 01041 | Sodium Benzoate | 001 | 25 | 560 |
| PurchasesBatch | 163 | 01047 | Sodium Sulphate | 001 | 50 | 68 |
| PurchasesBatch | 164 | 01050 | Tartrazine Yellow Color Indian | 001 | 25 | 3,100 |
| Productions | 304 | 03022 | Growth Promoter Plus | 060726 | 2,500 | 24.97 |
| PRODUCTIONBATCH | 304 | 01003 | Bentonite | 0001 | 2,000 | 13.1 |
| PRODUCTIONBATCH | 304 | 01059 | Wheat Bran | 0001 | 500 | 72.45 |
| PurchasesBatch | 165 | 01047 | Sodium Sulphate | 001 | 50 | 70 |
| PurchasesBatch | 166 | 02329 | Label Merlin Fix Oral Powder 25 kg | 001 | 25 | 120 |
| PurchasesBatch | 166 | 02345 | Label Acido Forte 25 Lit | 001 | 24 | 90 |
| PurchasesBatch | 166 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 001 | 60 | 40 |
| PurchasesBatch | 166 | 02342 | Label Frost Oral Liquid 5 Liter | 001 | 60 | 40 |
| PurchasesBatch | 166 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 001 | 40 | 40 |
| PurchasesBatch | 166 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 001 | 160 | 40 |
| PurchasesBatch | 166 | 02341 | Packet Reno Gurd Flush Oral Powder 1 kg | 001 | 1,035 | 33 |
| Productions | 305 | 03151 | Microgold-Bop | 070726 | 1,325 | 62.97 |
| PRODUCTIONBATCH | 305 | 01009 | Copper Sulphate | 0001 | 0 | 2,199.69 |
| PRODUCTIONBATCH | 305 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 305 | 01016 | DCP (Dana) | 0001 | 1,060 | 10 |
| PRODUCTIONBATCH | 305 | 01034 | Magnesium Sulphate | 0001 | 1 | 556.06 |
| PRODUCTIONBATCH | 305 | 01042 | Starch | 0001 | 15 | 168.72 |
| PRODUCTIONBATCH | 305 | 01043 | Sodium Chloride | 0001 | 265 | 13.75 |
| PRODUCTIONBATCH | 305 | 01050 | Tartrazine Yellow Color Indian | 001 | 1 | 3,100 |
| PRODUCTIONBATCH | 305 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 305 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 305 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 305 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 305 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 305 | 01060 | Zinc Sulphate | 0001 | 2 | 950 |
| PRODUCTIONBATCH | 305 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| PRODUCTIONBATCH | 305 | 01073 | Potassium Chloride | 001 | 0 | 400 |
| PRODUCTIONBATCH | 305 | 01143 | Vitamin B3 | 0001 | 3 | 3,200 |
| Productions | 305 | 03151 | Microgold-Bop | 070726 | 1,325 | 62.98 |
| Productions | 306 | 03182 | GrowMore Powder | 001 | 195 | 21.29 |
| PRODUCTIONBATCH | 306 | 01009 | Copper Sulphate | 0001 | 0 | 2,199.69 |
| PRODUCTIONBATCH | 306 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 306 | 01016 | DCP (Dana) | 0001 | 156 | 10 |
| PRODUCTIONBATCH | 306 | 01042 | Starch | 0001 | 1 | 168.72 |
| PRODUCTIONBATCH | 306 | 01043 | Sodium Chloride | 0001 | 39 | 13.75 |
| PRODUCTIONBATCH | 306 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 306 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 306 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 306 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 306 | 03182 | GrowMore Powder | 001 | 195 | 21.3 |
| Productions | 307 | 03003 | Calci-Phos-D | 001 | 230 | 34.34 |
| PRODUCTIONBATCH | 307 | 01013 | Calcium Chloride | 0001 | 3 | 209.98 |
| PRODUCTIONBATCH | 307 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 307 | 01038 | Phosphoric Acid 85% | 001 | 3 | 650 |
| PRODUCTIONBATCH | 307 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 307 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 307 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 307 | 01058 | Xanthan Gum | 001 | 1 | 1,450 |
| PRODUCTIONBATCH | 307 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 307 | 03003 | Calci-Phos-D | 001 | 230 | 34.34 |
| Productions | 308 | 03014 | Magnet BOP Oral Powder | 001 | 275 | 13.1 |
| PRODUCTIONBATCH | 308 | 01003 | Bentonite | 0001 | 275 | 13.1 |
| Productions | 309 | 03092 | Immune Forte Oral liquid | 001 | 24 | 159.94 |
| PRODUCTIONBATCH | 309 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 309 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.97 |
| PRODUCTIONBATCH | 309 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 309 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 309 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| PRODUCTIONBATCH | 309 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| Productions | 309 | 03092 | Immune Forte Oral liquid | 001 | 24 | 159.94 |
| Productions | 310 | 03010 | Garlimint Plus BOP | 001 | 13 | 167.79 |
| PRODUCTIONBATCH | 310 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 310 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 310 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 310 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 310 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 310 | 01045 | Sorbitol Liquid 70% | 0001 | 0 | 421.7 |
| PRODUCTIONBATCH | 310 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 310 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 310 | 03010 | Garlimint Plus BOP | 001 | 13 | 167.56 |
| Productions | 311 | 03179 | Heaatic Optimizer Liquid | 001 | 48 | 96.91 |
| PRODUCTIONBATCH | 311 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 311 | 01011 | Choline Chloride | 0001 | 0 | 4,840.92 |
| PRODUCTIONBATCH | 311 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 311 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 311 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 311 | 01041 | Sodium Benzoate | 001 | 1 | 560 |
| PRODUCTIONBATCH | 311 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 311 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 311 | 03179 | Heaatic Optimizer Liquid | 001 | 48 | 95.11 |
| Productions | 312 | 03204 | Adek Gold Oral Liquid | 001 | 50 | 103.23 |
| PRODUCTIONBATCH | 312 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 312 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 312 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 312 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 312 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 312 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 312 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 312 | 03204 | Adek Gold Oral Liquid | 001 | 50 | 103.01 |
| Productions | 313 | 03179 | Heaatic Optimizer Liquid | 001 | 100 | 48.5 |
| PRODUCTIONBATCH | 313 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 313 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 313 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 313 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 313 | 01041 | Sodium Benzoate | 001 | 4 | 560 |
| PRODUCTIONBATCH | 313 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 313 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 313 | 03179 | Heaatic Optimizer Liquid | 001 | 100 | 46.7 |
| Productions | 314 | 03027 | Micro Sel-E Oral Liquid | 001 | 40 | 215.22 |
| PRODUCTIONBATCH | 314 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 314 | 01045 | Sorbitol Liquid 70% | 0001 | 1 | 421.7 |
| PRODUCTIONBATCH | 314 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 314 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 314 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| Productions | 314 | 03027 | Micro Sel-E Oral Liquid | 001 | 40 | 215.04 |
| Productions | 315 | 03264 | Febro Meon Spray | 001 | 35 | 305 |
| PRODUCTIONBATCH | 315 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 315 | 01065 | Spt Amm. Aromatic | 0001 | 35 | 265 |
| Productions | 316 | 03144 | Yeast Plus Powder | 001 | 50 | 40.53 |
| PRODUCTIONBATCH | 316 | 01003 | Bentonite | 0001 | 25 | 13.1 |
| PRODUCTIONBATCH | 316 | 01033 | Molasses | 0001 | 5 | 50 |
| PRODUCTIONBATCH | 316 | 01059 | Wheat Bran | 0001 | 20 | 72.45 |
| Productions | 316 | 03144 | Yeast Plus Powder | 001 | 50 | 40.53 |
| PurchasesBatch | 167 | 02014 | Plastic Can White 5 Liter | 001 | 116 | 440 |
| PurchasesBatch | 168 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 300 | 235 |
| Productions | 317 | 03201 | Acido Forte | 001 | 500 | 40.17 |
| PRODUCTIONBATCH | 317 | 01009 | Copper Sulphate | 0001 | 2 | 2,199.69 |
| PRODUCTIONBATCH | 317 | 01020 | Formic Acid | 0001 | 40 | 350 |
| PRODUCTIONBATCH | 317 | 01041 | Sodium Benzoate | 001 | 2 | 560 |
| PRODUCTIONBATCH | 317 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 317 | 03201 | Acido Forte | 001 | 500 | 39.99 |
| Productions | 318 | 03198 | Frost Oral Liquid | 001 | 200 | 16.35 |
| PRODUCTIONBATCH | 318 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 318 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 318 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 318 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 318 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.97 |
| PRODUCTIONBATCH | 318 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 318 | 01073 | Potassium Chloride | 001 | 0 | 400 |
| PRODUCTIONBATCH | 318 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 318 | 03198 | Frost Oral Liquid | 001 | 200 | 16.18 |
| Productions | 319 | 03192 | Immunit Z Oral Liquid | 001 | 200 | 151.9 |
| PRODUCTIONBATCH | 319 | 01023 | Garlic Oil | 0001 | 2 | 7,043.77 |
| PRODUCTIONBATCH | 319 | 01025 | Ginger Oil | 0001 | 2 | 7,200 |
| PRODUCTIONBATCH | 319 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 319 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 319 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 319 | 03192 | Immunit Z Oral Liquid | 001 | 200 | 151.72 |
| Productions | 320 | 03194 | MLC 100  Oral Liquid | 001 | 120 | 107.33 |
| PRODUCTIONBATCH | 320 | 01009 | Copper Sulphate | 0001 | 1 | 2,199.69 |
| PRODUCTIONBATCH | 320 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 320 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 320 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 320 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 320 | 01045 | Sorbitol Liquid 70% | 0001 | 2 | 421.7 |
| PRODUCTIONBATCH | 320 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 320 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PRODUCTIONBATCH | 320 | 01115 | Calcium Propionate | 0001 | 0 | 1,200 |
| PRODUCTIONBATCH | 320 | 01184 | ARQ | 0001 | 6 | 366.67 |
| Productions | 320 | 03194 | MLC 100  Oral Liquid | 001 | 120 | 107.11 |
| PurchasesBatch | 169 | 01047 | Sodium Sulphate | 001 | 600 | 72 |
| PurchasesBatch | 170 | 01019 | Eucluptus Oil | 001 | 6 | 5,000 |
| PurchasesBatch | 170 | 01075 | Peppermint Oil | 001 | 5 | 5,000 |
| PurchasesBatch | 170 | 02448 | white bag 5 kg | 001 | 20 | 190 |
| PurchasesBatch | 171 | 01031 | Menthol Crystal | 001 | 25 | 6,500 |
| PurchasesBatch | 171 | 01189 | Glycerine | 001 | 50 | 650 |
| PurchasesBatch | 171 | 01045 | Sorbitol Liquid 70% | 001 | 275 | 350 |
| PurchasesBatch | 171 | 01055 | Vitamin C (Ascorbic acid) | 001 | 15 | 1,550 |
| PurchasesBatch | 172 | 02140 | Bucket Large | 001 | 50 | 1,100 |
| Productions | 321 | 03146 | Profen C+ Powder | 001 | 368 | 157.41 |
| PRODUCTIONBATCH | 321 | 01041 | Sodium Benzoate | 001 | 1 | 560 |
| PRODUCTIONBATCH | 321 | 01047 | Sodium Sulphate | 001 | 368 | 71.57 |
| PRODUCTIONBATCH | 321 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 321 | 01055 | Vitamin C (Ascorbic acid) | 001 | 15 | 1,550 |
| PRODUCTIONBATCH | 321 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,549.97 |
| PRODUCTIONBATCH | 321 | 01073 | Potassium Chloride | 001 | 0 | 400 |
| PRODUCTIONBATCH | 321 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 321 | 03146 | Profen C+ Powder | 001 | 368 | 156.04 |
| Productions | 322 | 03190 | CRD Mint Oral Liquid | 001 | 600 | 119.55 |
| PRODUCTIONBATCH | 322 | 01019 | Eucluptus Oil | 001 | 6 | 5,000 |
| PRODUCTIONBATCH | 322 | 01031 | Menthol Crystal | 001 | 6 | 6,500 |
| PRODUCTIONBATCH | 322 | 01041 | Sodium Benzoate | 001 | 2 | 560 |
| PRODUCTIONBATCH | 322 | 01058 | Xanthan Gum | 001 | 1 | 1,450 |
| Productions | 322 | 03190 | CRD Mint Oral Liquid | 001 | 600 | 121.59 |
| Productions | 323 | 03189 | Merlin Fix Oral Powder | 001 | 500 | 16.71 |
| PRODUCTIONBATCH | 323 | 01003 | Bentonite | 0001 | 490 | 13.1 |
| PRODUCTIONBATCH | 323 | 01187 | Sodium Metaby Sulphate | 0001 | 5 | 387.09 |
| Productions | 323 | 03189 | Merlin Fix Oral Powder | 001 | 500 | 16.71 |
| Productions | 324 | 03197 | Reno Gurd Flush Oral Powder | 001 | 300 | 85.27 |
| PRODUCTIONBATCH | 324 | 01041 | Sodium Benzoate | 001 | 1 | 560 |
| PRODUCTIONBATCH | 324 | 01047 | Sodium Sulphate | 001 | 270 | 71.57 |
| PRODUCTIONBATCH | 324 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,549.97 |
| PRODUCTIONBATCH | 324 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 324 | 03197 | Reno Gurd Flush Oral Powder | 001 | 300 | 83.96 |
| PurchasesBatch | 173 | 01201 | I.P.A | 001 | 60 | 750 |
| PurchasesBatch | 174 | 01044 | Sodium Bicarbonate | 001 | 25 | 128 |
| PurchasesBatch | 174 | 01184 | ARQ | 001 | 30 | 367 |
| PurchasesBatch | 175 | 01114 | Calcium | 001 | 2,000 | 17 |
| PurchasesBatch | 176 | 02350 | Label Hepa Gold Oral Liquid 5 Lit | 001 | 60 | 40 |
| PurchasesBatch | 176 | 02348 | Label COPPER Gold Oral Liquid 5 Lit | 001 | 50 | 40 |
| PurchasesBatch | 176 | 02026 | Label Toxi Lic 5 Liter | 001 | 50 | 40 |
| PurchasesBatch | 176 | 02216 | Label E.C Gold Oral Liquid 5 Litter | 001 | 50 | 40 |
| PurchasesBatch | 176 | 02268 | Label P.H Cure 25Liter | 001 | 20 | 90 |
| PurchasesBatch | 176 | 02351 | label Toxi Gold Forte Powder 25 kg | 001 | 20 | 140 |
| Productions | 325 | 03206 | Hepa Gold Oral Liquid | 001 | 200 | 105.82 |
| PRODUCTIONBATCH | 325 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 325 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 325 | 01034 | Magnesium Sulphate | 0001 | 5 | 556.06 |
| PRODUCTIONBATCH | 325 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 325 | 01045 | Sorbitol Liquid 70% | 001 | 10 | 350 |
| PRODUCTIONBATCH | 325 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 325 | 01184 | ARQ | 001 | 12 | 367 |
| Productions | 325 | 03206 | Hepa Gold Oral Liquid | 001 | 200 | 103.86 |
| Productions | 326 | 03205 | COPPER Gold Oral Liquid | 001 | 160 | 55.57 |
| PRODUCTIONBATCH | 326 | 01009 | Copper Sulphate | 0001 | 1 | 2,199.69 |
| PRODUCTIONBATCH | 326 | 01028 | Lactic Acid | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 326 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 326 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 326 | 03205 | COPPER Gold Oral Liquid | 001 | 160 | 55.35 |
| Productions | 327 | 03070 | Toxi Gold Liquid | 001 | 160 | 85.91 |
| PRODUCTIONBATCH | 327 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 327 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 327 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 327 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 327 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 327 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 327 | 03070 | Toxi Gold Liquid | 001 | 160 | 85.82 |
| Productions | 328 | 03075 | E.C Gold Oral  Liquid | 001 | 160 | 58.38 |
| PRODUCTIONBATCH | 328 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 328 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 328 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 328 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 328 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 328 | 03075 | E.C Gold Oral  Liquid | 001 | 160 | 58.2 |
| Productions | 329 | 03207 | Toxi Gold Forte Powder | 001 | 500 | 13.1 |
| PRODUCTIONBATCH | 329 | 01003 | Bentonite | 0001 | 500 | 13.1 |
| Productions | 329 | 03207 | Toxi Gold Forte Powder | 001 | 500 | 13.1 |
| Productions | 330 | 03162 | P.H Cure Liquid | 001 | 500 | 26.26 |
| PRODUCTIONBATCH | 330 | 01009 | Copper Sulphate | 0001 | 1 | 2,199.69 |
| PRODUCTIONBATCH | 330 | 01020 | Formic Acid | 0001 | 25 | 350 |
| PRODUCTIONBATCH | 330 | 01041 | Sodium Benzoate | 001 | 1 | 560 |
| PRODUCTIONBATCH | 330 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 330 | 03162 | P.H Cure Liquid | 001 | 500 | 26.17 |
| Productions | 331 | 03014 | Magnet BOP Oral Powder | 001 | 1,500 | 13.1 |
| PRODUCTIONBATCH | 331 | 01003 | Bentonite | 0001 | 1,500 | 13.1 |
| Productions | 332 | 03264 | Febro Meon Spray | 001 | 57 | 427.18 |
| PRODUCTIONBATCH | 332 | 01065 | Spt Amm. Aromatic | 0001 | 57 | 265 |
| PRODUCTIONBATCH | 332 | 01075 | Peppermint Oil | 001 | 0 | 5,000 |
| PRODUCTIONBATCH | 332 | 01189 | Glycerine | 001 | 11 | 650 |
| Productions | 332 | 03264 | Febro Meon Spray | 001 | 57 | 420 |
| Productions | 333 | 03003 | Calci-Phos-D | 110 | 245 | 34.34 |
| PRODUCTIONBATCH | 333 | 01013 | Calcium Chloride | 0001 | 3 | 209.98 |
| PRODUCTIONBATCH | 333 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 333 | 01038 | Phosphoric Acid 85% | 001 | 3 | 650 |
| PRODUCTIONBATCH | 333 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 333 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 333 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 333 | 01058 | Xanthan Gum | 001 | 1 | 1,450 |
| PRODUCTIONBATCH | 333 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 333 | 03003 | Calci-Phos-D | 110 | 245 | 34.34 |
| Productions | 334 | 03046 | Rumicid BOP Oral Powder | 001 | 500 | 16.53 |
| PRODUCTIONBATCH | 334 | 01003 | Bentonite | 0001 | 5 | 13.1 |
| PRODUCTIONBATCH | 334 | 01016 | DCP (Dana) | 0001 | 500 | 10 |
| PRODUCTIONBATCH | 334 | 01044 | Sodium Bicarbonate | 001 | 25 | 128 |
| PurchasesBatch | 177 | 01047 | Sodium Sulphate | 001 | 350 | 72 |
| PurchasesBatch | 177 | 01044 | Sodium Bicarbonate | 001 | 50 | 128 |
| PurchasesBatch | 178 | 02395 | Label Toxin Pro Oral Liquid 5 Lit | 001 | 55 | 40 |
| PurchasesBatch | 178 | 02220 | Label Eggcelent Liquid 5 Litter | 001 | 135 | 40 |
| PurchasesBatch | 178 | 02349 | Label Adek Gold Oral Liquid 5 Lit | 001 | 55 | 40 |
| PurchasesBatch | 178 | 02200 | Label URECTIC Powder 1 kg | 001 | 120 | 40 |
| PurchasesBatch | 178 | 02374 | Label Neufen Gold Oral Powder 1 kg | 001 | 320 | 40 |
| PurchasesBatch | 178 | 02129 | Label CID 7 Oral Liquid 25 Liter | 001 | 6 | 75 |
| PurchasesBatch | 178 | 02351 | label Toxi Gold Forte Powder 25 kg | 001 | 25 | 140 |
| PurchasesBatch | 178 | 02274 | Bag Calcium 72  25kg | 001 | 508 | 100 |
| PurchasesBatch | 178 | 02305 | Label Heaatic Optimizer 5 Liter | 001 | 140 | 1 |
| Productions | 335 | 03207 | Toxi Gold Forte Powder | 001 | 625 | 13.1 |
| PRODUCTIONBATCH | 335 | 01003 | Bentonite | 0001 | 625 | 13.1 |
| Productions | 335 | 03207 | Toxi Gold Forte Powder | 001 | 625 | 13.1 |
| Productions | 336 | 03046 | Rumicid BOP Oral Powder | 001 | 500 | 16.53 |
| PRODUCTIONBATCH | 336 | 01003 | Bentonite | 0001 | 5 | 13.1 |
| PRODUCTIONBATCH | 336 | 01016 | DCP (Dana) | 0001 | 500 | 10 |
| PRODUCTIONBATCH | 336 | 01044 | Sodium Bicarbonate | 001 | 25 | 128 |
| Productions | 337 | 03253 | BOP Yeast Oral Powder (High) | 001 | 150 | 8.25 |
| PRODUCTIONBATCH | 337 | 01003 | Bentonite | 0001 | 75 | 13.1 |
| PRODUCTIONBATCH | 337 | 01007 | CSL | 0001 | 3 | 35 |
| PRODUCTIONBATCH | 337 | 01033 | Molasses | 0001 | 3 | 50 |
| Productions | 337 | 03253 | BOP Yeast Oral Powder (High) | 001 | 150 | 8.25 |
| Productions | 338 | 03163 | Calcium 72 | 001 | 372 | 0.11 |
| PRODUCTIONBATCH | 338 | 01015 | DCP (Calcium) | 0001 | 2 | 17 |
| Productions | 338 | 03163 | Calcium 72 | 001 | 372 | 0.11 |
| Productions | 339 | 03204 | Adek Gold Oral Liquid | 001 | 180 | 95.73 |
| PRODUCTIONBATCH | 339 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 339 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 339 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 339 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 339 | 01057 | Vitamin B6 | 0001 | 0 | 14,000 |
| PRODUCTIONBATCH | 339 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 339 | 03204 | Adek Gold Oral Liquid | 001 | 180 | 95.51 |
| Productions | 340 | 03226 | Neufen Gold Oral Powder | 001 | 300 | 97.46 |
| PRODUCTIONBATCH | 340 | 01047 | Sodium Sulphate | 001 | 240 | 71.94 |
| PRODUCTIONBATCH | 340 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 6 | 1,549.97 |
| PRODUCTIONBATCH | 340 | 01073 | Potassium Chloride | 001 | 3 | 400 |
| PRODUCTIONBATCH | 340 | 01105 | Sodium Citrate | 0001 | 3 | 414.59 |
| Productions | 340 | 03226 | Neufen Gold Oral Powder | 001 | 300 | 96.69 |
| Productions | 341 | 03142 | Eggcelent liquid | 001 | 540 | 30.7 |
| PRODUCTIONBATCH | 341 | 01009 | Copper Sulphate | 0001 | 0 | 2,199.69 |
| PRODUCTIONBATCH | 341 | 01013 | Calcium Chloride | 0001 | 13 | 209.98 |
| PRODUCTIONBATCH | 341 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 341 | 01060 | Zinc Sulphate | 0001 | 2 | 950 |
| PRODUCTIONBATCH | 341 | 01104 | Lysine | 0001 | 1 | 1,100 |
| PRODUCTIONBATCH | 341 | 01176 | Cobalt Chloride | 0001 | 0 | 9,500 |
| Productions | 341 | 03142 | Eggcelent liquid | 001 | 540 | 30.7 |
| Productions | 342 | 03029 | CID-7 Oral Liquid | 001 | 125 | 26.66 |
| PRODUCTIONBATCH | 342 | 01009 | Copper Sulphate | 0001 | 0 | 2,199.69 |
| PRODUCTIONBATCH | 342 | 01020 | Formic Acid | 0001 | 6 | 350 |
| PRODUCTIONBATCH | 342 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 342 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 342 | 01060 | Zinc Sulphate | 0001 | 0 | 950 |
| Productions | 342 | 03029 | CID-7 Oral Liquid | 001 | 125 | 26.57 |
| Productions | 343 | 03241 | Toxin Pro Oral Liquid | 001 | 220 | 110.82 |
| PRODUCTIONBATCH | 343 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 343 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 343 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 343 | 01020 | Formic Acid | 0001 | 1 | 350 |
| PRODUCTIONBATCH | 343 | 01041 | Sodium Benzoate | 001 | 1 | 560 |
| PRODUCTIONBATCH | 343 | 01046 | Silmyrin | 0001 | 1 | 13,130.73 |
| PRODUCTIONBATCH | 343 | 01058 | Xanthan Gum | 001 | 1 | 1,450 |
| PRODUCTIONBATCH | 343 | 01184 | ARQ | 001 | 11 | 367 |
| Productions | 343 | 03241 | Toxin Pro Oral Liquid | 001 | 220 | 110.6 |
| PurchasesBatch | 179 | 01114 | Calcium | 001 | 10,000 | 17 |
| PurchasesBatch | 180 | 02351 | label Toxi Gold Forte Powder 25 kg | 001 | 25 | 140 |
| PurchasesBatch | 180 | 02385 | Label Calci Phos D 1 Lit | 001 | 1,240 | 18 |
| PurchasesBatch | 181 | 01038 | Phosphoric Acid 85% | 001 | 70 | 650 |
| PurchasesBatch | 182 | 02140 | Bucket Large | 001 | 20 | 1,100 |
| Productions | 344 | 03147 | Hepatic Optimizer fort Powder | 001 | 500 | 95.55 |
| PRODUCTIONBATCH | 344 | 01003 | Bentonite | 0001 | 500 | 13.1 |
| PRODUCTIONBATCH | 344 | 01016 | DCP (Dana) | 0001 | 500 | 10 |
| PRODUCTIONBATCH | 344 | 01059 | Wheat Bran | 0001 | 500 | 72.45 |
| Productions | 344 | 03147 | Hepatic Optimizer fort Powder | 001 | 500 | 95.55 |
| SALESBATCH | 137 | 00038 | Hepatic-Optimizer Powder 25kg |  | 0 | 0 |
| SALESBATCH | 137 | 00046 | Fuzion Plus 5 Lit |  | 0 | 0 |
| PurchasesBatch | 183 | 02014 | Plastic Can White 5 Liter | 001 | 170 | 440 |
| PurchasesBatch | 184 | 01009 | Copper Sulphate | 001 | 50 | 2,200 |
| PurchasesBatch | 184 | 01021 | Glacial Acetic Acid | 001 | 30 | 340 |
| PurchasesBatch | 184 | 01115 | Calcium Propionate | 001 | 25 | 650 |
| PurchasesBatch | 184 | 01013 | Calcium Chloride | 001 | 25 | 220 |
| PurchasesBatch | 184 | 01060 | Zinc Sulphate | 001 | 25 | 950 |
| PurchasesBatch | 185 | 01042 | Starch | 001 | 50 | 167 |
| PurchasesBatch | 185 | 01020 | Formic Acid | 001 | 70 | 312 |
| PurchasesBatch | 186 | 02443 | Label Bio Guard oral Liquid 5 Lit | 001 | 80 | 80 |
| PurchasesBatch | 186 | 02057 | Label Grow Plus 5 Liter | 001 | 20 | 80 |
| PurchasesBatch | 187 | 02449 | LABEL Ocid Fort Oral Liquid 25 L | 001 | 22 | 180 |
| PurchasesBatch | 188 | 01043 | Sodium Chloride | 001 | 1,600 | 13.75 |
| PurchasesBatch | 189 | 01186 | HCL | 001 | 30 | 70 |
| PurchasesBatch | 189 | 01003 | Bentonite | 001 | 10,000 | 13 |
| PurchasesBatch | 190 | 02097 | Bottle Round liter | 001 | 240 | 230 |
| PurchasesBatch | 191 | 02034 | BAG BOP DCP 25 KG | 001 | 506 | 100 |
| PurchasesBatch | 191 | 02031 | Label Garlimint Plus 5 Liter | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02271 | Label E.S 200 5Lit | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02237 | Label Bio Adeck Liquid 5Lit | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02297 | Label Ampro-Plus 5L | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02291 | Label Super Yeast Liquid 5 Liter | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02272 | Label Stable C20  5Lit | 001 | 30 | 40 |
| PurchasesBatch | 191 | 02395 | Label Toxin Pro Oral Liquid 5 Lit | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02201 | Label PROCOPCID Oral Liquid 5 Liter | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02357 | Label Mento Respi Oral Liquid 5 Lit | 001 | 15 | 40 |
| PurchasesBatch | 191 | 02288 | Label Bop Dairy Mineral 25 KG | 001 | 30 | 140 |
| PurchasesBatch | 191 | 02234 | Label Hepatic Optimizer fort 25kg | 001 | 6 | 140 |
| PurchasesBatch | 191 | 02170 | Label Bento-Lic 25 Kg | 001 | 12 | 140 |
| PurchasesBatch | 192 | 02010 | Bottle Pet Amber 100ML | 001 | 2,000 | 8 |
| PurchasesBatch | 192 | 02314 | Dropper  30ML | 001 | 2,000 | 13 |
| PurchasesBatch | 192 | 01047 | Sodium Sulphate | 001 | 50 | 72 |
| PurchasesBatch | 193 | 02014 | Plastic Can White 5 Liter | 001 | 340 | 440 |
| PurchasesBatch | 193 | 02009 | Bottle Can White  100ML | 001 | 600 | 20 |
| PurchasesBatch | 194 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 156 | 235 |
| Productions | 345 | 03221 | Phyto-Phos Oral Liquid | 001 | 25 | 137.06 |
| PRODUCTIONBATCH | 345 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 345 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 345 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 345 | 01034 | Magnesium Sulphate | 0001 | 0 | 556.06 |
| PRODUCTIONBATCH | 345 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 345 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 345 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 345 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 345 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 345 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 345 | 01189 | Glycerine | 001 | 1 | 650 |
| Productions | 345 | 03221 | Phyto-Phos Oral Liquid | 001 | 25 | 134.72 |
| Productions | 346 | 03221 | Phyto-Phos Oral Liquid | 001 | 125 | 137.06 |
| PRODUCTIONBATCH | 346 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 346 | 01013 | Calcium Chloride | 001 | 3 | 220 |
| PRODUCTIONBATCH | 346 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 346 | 01034 | Magnesium Sulphate | 0001 | 1 | 556.06 |
| PRODUCTIONBATCH | 346 | 01038 | Phosphoric Acid 85% | 001 | 6 | 650 |
| PRODUCTIONBATCH | 346 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 346 | 01045 | Sorbitol Liquid 70% | 001 | 3 | 350 |
| PRODUCTIONBATCH | 346 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 346 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 346 | 01060 | Zinc Sulphate | 001 | 1 | 950 |
| PRODUCTIONBATCH | 346 | 01189 | Glycerine | 001 | 5 | 650 |
| Productions | 346 | 03221 | Phyto-Phos Oral Liquid | 001 | 125 | 134.72 |
| Productions | 347 | 03014 | Magnet BOP Oral Powder | 001 | 500 | 13.05 |
| PRODUCTIONBATCH | 347 | 01003 | Bentonite | 001 | 500 | 13 |
| Productions | 347 | 03014 | Magnet BOP Oral Powder | 001 | 500 | 13 |
| Productions | 348 | 03014 | Magnet BOP Oral Powder | 001 | 375 | 13.05 |
| PRODUCTIONBATCH | 348 | 01003 | Bentonite | 001 | 375 | 13 |
| Productions | 348 | 03014 | Magnet BOP Oral Powder | 001 | 375 | 13 |
| PurchasesBatch | 179 | 01114 | Calcium |  | 0 | 0 |
| PurchasesBatch | 195 | 01015 | DCP (Calcium) | 0001 | 10,000 | 17 |
| Productions | 349 | 03167 | Bop Dairy Calcium | 001 | 5,500 | 17 |
| PRODUCTIONBATCH | 349 | 01015 | DCP (Calcium) | 0001 | 5,500 | 17 |
| Productions | 350 | 03167 | Bop Dairy Calcium | 001 | 750 | 17 |
| PRODUCTIONBATCH | 350 | 01015 | DCP (Calcium) | 0001 | 750 | 17 |
| Productions | 351 | 03002 | DCP Powder | 001 | 1,500 | 17 |
| PRODUCTIONBATCH | 351 | 01015 | DCP (Calcium) | 0001 | 1,500 | 17 |
| Productions | 352 | 03002 | DCP Powder | 001 | 1,500 | 17 |
| PRODUCTIONBATCH | 352 | 01015 | DCP (Calcium) | 0001 | 1,500 | 17 |
| Productions | 353 | 03134 | DCP Powder 29 % | 001 | 1,000 | 14.25 |
| PRODUCTIONBATCH | 353 | 01015 | DCP (Calcium) | 0001 | 500 | 17 |
| PRODUCTIONBATCH | 353 | 01190 | PHOSPHORUS Powder 29% | 0001 | 500 | 11.5 |
| Productions | 354 | 03003 | Calci-Phos-D | 001 | 220 | 34.41 |
| PRODUCTIONBATCH | 354 | 01013 | Calcium Chloride | 001 | 3 | 220 |
| PRODUCTIONBATCH | 354 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 354 | 01038 | Phosphoric Acid 85% | 001 | 3 | 650 |
| PRODUCTIONBATCH | 354 | 01043 | Sodium Chloride | 001 | 1 | 13.75 |
| PRODUCTIONBATCH | 354 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 354 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 354 | 01058 | Xanthan Gum | 001 | 1 | 1,450 |
| PRODUCTIONBATCH | 354 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 354 | 03003 | Calci-Phos-D | 001 | 220 | 34.49 |
| Productions | 355 | 03014 | Magnet BOP Oral Powder | 001 | 525 | 13.05 |
| PRODUCTIONBATCH | 355 | 01003 | Bentonite | 001 | 525 | 13 |
| Productions | 355 | 03014 | Magnet BOP Oral Powder | 001 | 525 | 13 |
| Productions | 356 | 03264 | Febro Meon Spray | 001 | 57 | 427.18 |
| PRODUCTIONBATCH | 356 | 01065 | Spt Amm. Aromatic | 0001 | 57 | 265 |
| PRODUCTIONBATCH | 356 | 01075 | Peppermint Oil | 001 | 0 | 5,000 |
| PRODUCTIONBATCH | 356 | 01189 | Glycerine | 001 | 11 | 650 |
| Productions | 356 | 03264 | Febro Meon Spray | 001 | 57 | 420 |
| Productions | 357 | 03271 | Bio Guard oral Liquid | 001 | 300 | 241.99 |
| PRODUCTIONBATCH | 357 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 357 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 357 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 357 | 01020 | Formic Acid | 001 | 3 | 312 |
| PRODUCTIONBATCH | 357 | 01021 | Glacial Acetic Acid | 001 | 3 | 340 |
| PRODUCTIONBATCH | 357 | 01041 | Sodium Benzoate | 001 | 1 | 560 |
| PRODUCTIONBATCH | 357 | 01046 | Silmyrin | 0001 | 4 | 13,130.73 |
| PRODUCTIONBATCH | 357 | 01058 | Xanthan Gum | 001 | 1 | 1,450 |
| Productions | 357 | 03271 | Bio Guard oral Liquid | 001 | 300 | 241.28 |
| Productions | 358 | 03022 | Growth Promoter Plus | 001 | 60 | 43.76 |
| PRODUCTIONBATCH | 358 | 01003 | Bentonite | 001 | 48 | 13 |
| PRODUCTIONBATCH | 358 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 358 | 01059 | Wheat Bran | 0001 | 12 | 72.45 |
| Productions | 358 | 03022 | Growth Promoter Plus | 001 | 60 | 44.39 |
| Productions | 359 | 03275 | Ocid Fort Oral Liquid | 001 | 500 | 33.74 |
| PRODUCTIONBATCH | 359 | 01009 | Copper Sulphate | 001 | 1 | 2,200 |
| PRODUCTIONBATCH | 359 | 01020 | Formic Acid | 001 | 25 | 312 |
| PRODUCTIONBATCH | 359 | 01021 | Glacial Acetic Acid | 001 | 12 | 340 |
| PRODUCTIONBATCH | 359 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 359 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 359 | 03275 | Ocid Fort Oral Liquid | 001 | 500 | 32.05 |
| Productions | 360 | 03098 | Bentox Powder | 001 | 250 | 13.05 |
| PRODUCTIONBATCH | 360 | 01003 | Bentonite | 001 | 250 | 13 |
| Productions | 360 | 03098 | Bentox Powder | 001 | 250 | 13 |
| Productions | 361 | 03144 | Yeast Plus Powder | 001 | 500 | 40.5 |
| PRODUCTIONBATCH | 361 | 01003 | Bentonite | 001 | 250 | 13 |
| PRODUCTIONBATCH | 361 | 01033 | Molasses | 0001 | 50 | 50 |
| PRODUCTIONBATCH | 361 | 01059 | Wheat Bran | 0001 | 200 | 72.45 |
| Productions | 361 | 03144 | Yeast Plus Powder | 001 | 500 | 40.48 |
| Productions | 362 | 03173 | Bop Dairy Mineral | 001 | 750 | 15.29 |
| PRODUCTIONBATCH | 362 | 01016 | DCP (Dana) | 0001 | 592 | 10 |
| PRODUCTIONBATCH | 362 | 01043 | Sodium Chloride | 001 | 150 | 13.75 |
| PRODUCTIONBATCH | 362 | 01050 | Tartrazine Yellow Color Indian | 001 | 1 | 3,100 |
| Productions | 362 | 03173 | Bop Dairy Mineral | 001 | 750 | 15.3 |
| Productions | 363 | 03045 | Magnet Plus Oral Powder | 001 | 25 | 13.84 |
| PRODUCTIONBATCH | 363 | 01003 | Bentonite | 001 | 20 | 13 |
| PRODUCTIONBATCH | 363 | 01015 | DCP (Calcium) | 0001 | 5 | 17 |
| Productions | 363 | 03045 | Magnet Plus Oral Powder | 001 | 25 | 13.8 |
| PurchasesBatch | 196 | 02014 | Plastic Can White 5 Liter | 001 | 204 | 440 |
| PurchasesBatch | 196 | 02097 | Bottle Round liter | 001 | 300 | 230 |
| PurchasesBatch | 197 | 01015 | DCP (Calcium) | 0001 | 2,500 | 17 |
| PurchasesBatch | 198 | 02265 | Label Garliment Plus 1Liter | 001 | 2,500 | 40 |
| PurchasesBatch | 198 | 02067 | Label Bio Ambrox 1 Liter | 001 | 16 | 40 |
| PurchasesBatch | 198 | 02431 | Label Toxi Off Oral Liquid 1 Lit | 001 | 32 | 40 |
| PurchasesBatch | 198 | 02440 | Label BOP DCAD Powder 25 kg | 001 | 20 | 140 |
| PurchasesBatch | 198 | 02282 | Label Bop Supper Gold 25kg | 001 | 20 | 140 |
| PurchasesBatch | 198 | 02346 | Label VETLIV Oral Solution 5 Lit | 001 | 60 | 40 |
| PurchasesBatch | 198 | 02428 | Label Leo Cid Pro 25 Lit | 001 | 10 | 40 |
| PurchasesBatch | 198 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 001 | 20 | 40 |
| PurchasesBatch | 198 | 02423 | Label Leo Adsorbo Oral Liquid 5 Lit | 001 | 20 | 40 |
| PurchasesBatch | 198 | 02439 | Label Leo Flush Oral Liquid 5 Lit | 001 | 20 | 40 |
| PurchasesBatch | 199 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 48 | 213 |
| Productions | 364 | 03010 | Garlimint Plus BOP | 001 | 24 | 163.68 |
| PRODUCTIONBATCH | 364 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 364 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 364 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 364 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 364 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 364 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 364 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 364 | 03010 | Garlimint Plus BOP | 001 | 24 | 163.1 |
| Productions | 365 | 03054 | Bio Ambrox  Liquid | 001 | 12 | 54.97 |
| PRODUCTIONBATCH | 365 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 365 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 365 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 365 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 365 | 03054 | Bio Ambrox  Liquid | 001 | 12 | 56.08 |
| Productions | 366 | 03135 | Toxi - Off Liquid | 001 | 24 | 223.44 |
| PRODUCTIONBATCH | 366 | 01005 | CMC Sodium | 0001 | 0 | 1,500 |
| PRODUCTIONBATCH | 366 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 366 | 01011 | Choline Chloride | 0001 | 0 | 4,840.92 |
| PRODUCTIONBATCH | 366 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 366 | 01020 | Formic Acid | 001 | 0 | 312 |
| PRODUCTIONBATCH | 366 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 366 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 366 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 366 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 366 | 01184 | ARQ | 001 | 1 | 367 |
| Productions | 366 | 03135 | Toxi - Off Liquid | 001 | 24 | 222.98 |
| Productions | 367 | 03202 | VETLIV Oral Solution | 001 | 200 | 87.83 |
| PRODUCTIONBATCH | 367 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 367 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 367 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 367 | 01020 | Formic Acid | 001 | 0 | 312 |
| PRODUCTIONBATCH | 367 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 367 | 01028 | Lactic Acid | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 367 | 01045 | Sorbitol Liquid 70% | 001 | 4 | 350 |
| PRODUCTIONBATCH | 367 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 367 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PRODUCTIONBATCH | 367 | 01184 | ARQ | 001 | 5 | 367 |
| PRODUCTIONBATCH | 367 | 01184 | ARQ | 0001 | 8 | 366.67 |
| Productions | 367 | 03202 | VETLIV Oral Solution | 001 | 200 | 86.94 |
| Productions | 368 | 03104 | BOP PH 5 Liquid | 001 | 500 | 33.34 |
| PRODUCTIONBATCH | 368 | 01009 | Copper Sulphate | 001 | 1 | 2,200 |
| PRODUCTIONBATCH | 368 | 01020 | Formic Acid | 001 | 25 | 312 |
| PRODUCTIONBATCH | 368 | 01021 | Glacial Acetic Acid | 001 | 12 | 340 |
| PRODUCTIONBATCH | 368 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 368 | 03104 | BOP PH 5 Liquid | 001 | 500 | 31.65 |
| Productions | 369 | 03014 | Magnet BOP Oral Powder | 001 | 5,000 | 13.05 |
| PRODUCTIONBATCH | 369 | 01003 | Bentonite | 001 | 5,000 | 13 |
| Productions | 369 | 03014 | Magnet BOP Oral Powder | 001 | 5,000 | 13 |
| Productions | 370 | 03270 | BOP DCAD Powder | 001 | 500 | 30.06 |
| PRODUCTIONBATCH | 370 | 01002 | Ammonium chloride | 0001 | 12 | 271.82 |
| PRODUCTIONBATCH | 370 | 01003 | Bentonite | 001 | 187 | 13 |
| PRODUCTIONBATCH | 370 | 01015 | DCP (Calcium) | 0001 | 250 | 17 |
| PRODUCTIONBATCH | 370 | 01073 | Potassium Chloride | 001 | 12 | 400 |
| Productions | 370 | 03270 | BOP DCAD Powder | 001 | 500 | 30.17 |
| Productions | 371 | 03164 | Bop SUPPER TOX Powder | 001 | 500 | 13.05 |
| PRODUCTIONBATCH | 371 | 01003 | Bentonite | 001 | 500 | 13 |
| Productions | 371 | 03164 | Bop SUPPER TOX Powder | 001 | 500 | 13 |
| Productions | 372 | 03046 | Rumicid BOP Oral Powder | 001 | 2,500 | 10.13 |
| PRODUCTIONBATCH | 372 | 01003 | Bentonite | 001 | 25 | 13 |
| PRODUCTIONBATCH | 372 | 01016 | DCP (Dana) | 0001 | 2,500 | 10 |
| Productions | 372 | 03046 | Rumicid BOP Oral Powder | 001 | 2,500 | 10.13 |
| Productions | 373 | 03264 | Febro Meon Spray | 170726 | 23 | 427.18 |
| PRODUCTIONBATCH | 373 | 01065 | Spt Amm. Aromatic | 0001 | 23 | 265 |
| PRODUCTIONBATCH | 373 | 01075 | Peppermint Oil | 001 | 0 | 5,000 |
| PRODUCTIONBATCH | 373 | 01189 | Glycerine | 001 | 4 | 650 |
| Productions | 373 | 03264 | Febro Meon Spray | 170726 | 23 | 420 |
| Productions | 374 | 03010 | Garlimint Plus BOP | 170726 | 81 | 163.68 |
| PRODUCTIONBATCH | 374 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 374 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 374 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 374 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 374 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 374 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 374 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 374 | 03010 | Garlimint Plus BOP | 170726 | 81 | 163.1 |
| Productions | 375 | 03179 | Heaatic Optimizer Liquid | 001 | 20 | 72.69 |
| PRODUCTIONBATCH | 375 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 375 | 01011 | Choline Chloride | 0001 | 0 | 4,840.92 |
| PRODUCTIONBATCH | 375 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 375 | 01020 | Formic Acid | 001 | 0 | 312 |
| PRODUCTIONBATCH | 375 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 375 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 375 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 375 | 03179 | Heaatic Optimizer Liquid | 001 | 20 | 72.67 |
| Productions | 376 | 03012 | Kirzan BOP | 001 | 40 | 47.56 |
| PRODUCTIONBATCH | 376 | 01027 | Kaolin | 0001 | 4 | 400 |
| PRODUCTIONBATCH | 376 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 376 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 376 | 03012 | Kirzan BOP | 001 | 40 | 47.56 |
| Productions | 377 | 03165 | Timp-Ex Oral Liquid | 001 | 40 | 24.19 |
| PRODUCTIONBATCH | 377 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 377 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 377 | 01035 | Turpentine Oil | 0001 | 0 | 1,278.57 |
| PRODUCTIONBATCH | 377 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 377 | 01043 | Sodium Chloride | 001 | 0 | 13.75 |
| PRODUCTIONBATCH | 377 | 01044 | Sodium Bicarbonate | 001 | 0 | 128 |
| PRODUCTIONBATCH | 377 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 377 | 03165 | Timp-Ex Oral Liquid | 001 | 40 | 23.88 |
| Productions | 378 | 03265 | CS Guard 20 Oral Liquid | 001 | 40 | 268.15 |
| PRODUCTIONBATCH | 378 | 01009 | Copper Sulphate | 001 | 4 | 2,200 |
| PRODUCTIONBATCH | 378 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 378 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 378 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 378 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 378 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 378 | 03265 | CS Guard 20 Oral Liquid | 001 | 40 | 266.64 |
| Productions | 379 | 03118 | BOP Coolper Powder | 001 | 90 | 113.73 |
| PRODUCTIONBATCH | 379 | 01047 | Sodium Sulphate | 001 | 90 | 71.95 |
| PRODUCTIONBATCH | 379 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 2 | 1,549.97 |
| PRODUCTIONBATCH | 379 | 01073 | Potassium Chloride | 001 | 0 | 400 |
| PRODUCTIONBATCH | 379 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 379 | 03118 | BOP Coolper Powder | 001 | 90 | 112.73 |
| Productions | 380 | 03019 | Super Yeast Powder | 001 | 100 | 40.5 |
| PRODUCTIONBATCH | 380 | 01003 | Bentonite | 001 | 50 | 13 |
| PRODUCTIONBATCH | 380 | 01033 | Molasses | 0001 | 10 | 50 |
| PRODUCTIONBATCH | 380 | 01059 | Wheat Bran | 0001 | 40 | 72.45 |
| Productions | 380 | 03019 | Super Yeast Powder | 001 | 100 | 40.48 |
| Productions | 381 | 03134 | DCP Powder 29 % | 001 | 250 | 14.25 |
| PRODUCTIONBATCH | 381 | 01015 | DCP (Calcium) | 0001 | 125 | 17 |
| PRODUCTIONBATCH | 381 | 01190 | PHOSPHORUS Powder 29% | 0001 | 125 | 11.5 |
| Productions | 382 | 03182 | GrowMore Powder | 001 | 250 | 21.28 |
| PRODUCTIONBATCH | 382 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 382 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 382 | 01016 | DCP (Dana) | 0001 | 200 | 10 |
| PRODUCTIONBATCH | 382 | 01042 | Starch | 001 | 2 | 167 |
| PRODUCTIONBATCH | 382 | 01043 | Sodium Chloride | 001 | 50 | 13.75 |
| PRODUCTIONBATCH | 382 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 382 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 382 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 382 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 382 | 03182 | GrowMore Powder | 001 | 250 | 21.28 |
| Productions | 383 | 03022 | Growth Promoter Plus | 001 | 500 | 43.76 |
| PRODUCTIONBATCH | 383 | 01003 | Bentonite | 001 | 400 | 13 |
| PRODUCTIONBATCH | 383 | 01031 | Menthol Crystal | 001 | 1 | 6,500 |
| PRODUCTIONBATCH | 383 | 01059 | Wheat Bran | 0001 | 100 | 72.45 |
| Productions | 383 | 03022 | Growth Promoter Plus | 001 | 500 | 44.39 |
| Productions | 384 | 03121 | Bio Adek Liquid | 001 | 40 | 54.83 |
| PRODUCTIONBATCH | 384 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 384 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 384 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| Productions | 384 | 03121 | Bio Adek Liquid | 001 | 40 | 54.83 |
| Productions | 385 | 03176 | Ampro-Plus Liquid | 001 | 40 | 125.86 |
| PRODUCTIONBATCH | 385 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 385 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 385 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 385 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 385 | 03176 | Ampro-Plus Liquid | 001 | 40 | 129.19 |
| Productions | 386 | 03179 | Heaatic Optimizer Liquid | 001 | 60 | 24.28 |
| PRODUCTIONBATCH | 386 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 386 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 386 | 01020 | Formic Acid | 001 | 0 | 312 |
| PRODUCTIONBATCH | 386 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 386 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 386 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 386 | 03179 | Heaatic Optimizer Liquid | 001 | 60 | 24.26 |
| Productions | 387 | 03086 | Super Yeast Liquid | 001 | 40 | 30 |
| PRODUCTIONBATCH | 387 | 01033 | Molasses | 0001 | 24 | 50 |
| Productions | 388 | 03186 | Bio ESEL 200 Oral Liquid | 001 | 40 | 73.93 |
| PRODUCTIONBATCH | 388 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 388 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 388 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 388 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| Productions | 388 | 03186 | Bio ESEL 200 Oral Liquid | 001 | 40 | 73.75 |
| Productions | 389 | 03241 | Toxin Pro Oral Liquid | 001 | 40 | 109.54 |
| PRODUCTIONBATCH | 389 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 389 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 389 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 389 | 01020 | Formic Acid | 001 | 0 | 312 |
| PRODUCTIONBATCH | 389 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 389 | 01021 | Glacial Acetic Acid | 0001 | 0 | 399.62 |
| PRODUCTIONBATCH | 389 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 389 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 389 | 01184 | ARQ | 0001 | 2 | 366.67 |
| Productions | 389 | 03241 | Toxin Pro Oral Liquid | 001 | 40 | 109.33 |
| Productions | 390 | 03130 | PROCOPCID Oral Liquid | 001 | 40 | 260.13 |
| PRODUCTIONBATCH | 390 | 01009 | Copper Sulphate | 001 | 4 | 2,200 |
| PRODUCTIONBATCH | 390 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 390 | 01045 | Sorbitol Liquid 70% | 001 | 2 | 350 |
| PRODUCTIONBATCH | 390 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 390 | 03130 | PROCOPCID Oral Liquid | 001 | 40 | 258.35 |
| Productions | 391 | 03119 | Stable C 20 Liquid | 001 | 60 | 161.8 |
| PRODUCTIONBATCH | 391 | 01044 | Sodium Bicarbonate | 001 | 0 | 128 |
| PRODUCTIONBATCH | 391 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 391 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 391 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 6 | 1,549.97 |
| Productions | 391 | 03119 | Stable C 20 Liquid | 001 | 60 | 161.34 |
| PurchasesBatch | 200 | 01114 | Calcium | 001 | 2,500 | 17 |
| PurchasesBatch | 201 | 01193 | Castor Oil | 001 | 2 | 1,150 |
| Productions | 392 | 03112 | Bento-lic Powder | 001 | 2,500 | 13.05 |
| PRODUCTIONBATCH | 392 | 01003 | Bentonite | 001 | 1,869 | 13 |
| PRODUCTIONBATCH | 392 | 01003 | Bentonite | 0001 | 630 | 13.1 |
| Productions | 392 | 03112 | Bento-lic Powder | 001 | 2,500 | 13.03 |
| Productions | 393 | 03112 | Bento-lic Powder | 001 | 2,500 | 13.1 |
| PRODUCTIONBATCH | 393 | 01003 | Bentonite | 0001 | 2,500 | 13.1 |
| PurchasesBatch | 202 | 01114 | Calcium | 001 | 2,500 | 17 |
| PurchasesBatch | 203 | 02014 | Plastic Can White 5 Liter | 001 | 170 | 440 |
| PurchasesBatch | 204 | 02097 | Bottle Round liter | 001 | 120 | 230 |
| PurchasesBatch | 205 | 02010 | Bottle Pet Amber 100ML | 001 | 1,000 | 8 |
| PurchasesBatch | 206 | 02163 | Label Calpho Lic Liquid 5 Lit | 001 | 30 | 40 |
| PurchasesBatch | 207 | 02237 | Label Bio Adeck Liquid 5Lit | 001 | 30 | 40 |
| PurchasesBatch | 208 | 02297 | Label Ampro-Plus 5L | 001 | 55 | 40 |
| PurchasesBatch | 209 | 02214 | Label Bop Livercare 25 kg | 001 | 20 | 140 |
| PurchasesBatch | 210 | 02146 | Label Acidi-Lic 25 Lit | 001 | 20 | 90 |
| PurchasesBatch | 211 | 02125 | Packet Golden Premix 1Kg | 001 | 2,075 | 33 |
| Productions | 394 | 03144 | Yeast Plus Powder | 001 | 100 | 40.53 |
| PRODUCTIONBATCH | 394 | 01003 | Bentonite | 0001 | 50 | 13.1 |
| PRODUCTIONBATCH | 394 | 01033 | Molasses | 0001 | 10 | 50 |
| PRODUCTIONBATCH | 394 | 01059 | Wheat Bran | 0001 | 40 | 72.45 |
| Productions | 394 | 03144 | Yeast Plus Powder | 001 | 100 | 40.53 |
| Productions | 395 | 03116 | Mento Respi Liquid | 001 | 20 | 206.21 |
| PRODUCTIONBATCH | 395 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 395 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 395 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 395 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 395 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 395 | 03116 | Mento Respi Liquid | 001 | 20 | 210.52 |
| Productions | 396 | 03147 | Hepatic Optimizer fort Powder | 001 | 100 | 95.55 |
| PRODUCTIONBATCH | 396 | 01003 | Bentonite | 0001 | 100 | 13.1 |
| PRODUCTIONBATCH | 396 | 01016 | DCP (Dana) | 0001 | 100 | 10 |
| PRODUCTIONBATCH | 396 | 01059 | Wheat Bran | 0001 | 100 | 72.45 |
| Productions | 396 | 03147 | Hepatic Optimizer fort Powder | 001 | 100 | 95.55 |
| Productions | 397 | 03022 | Growth Promoter Plus | 001 | 500 | 29.31 |
| PRODUCTIONBATCH | 397 | 01003 | Bentonite | 0001 | 400 | 13.1 |
| PRODUCTIONBATCH | 397 | 01031 | Menthol Crystal | 001 | 1 | 6,500 |
| Productions | 397 | 03022 | Growth Promoter Plus | 001 | 500 | 29.98 |
| Productions | 398 | 03014 | Magnet BOP Oral Powder | 001 | 130 | 13.1 |
| PRODUCTIONBATCH | 398 | 01003 | Bentonite | 0001 | 130 | 13.1 |
| Productions | 399 | 03010 | Garlimint Plus BOP | 001 | 20 | 160.66 |
| PRODUCTIONBATCH | 399 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 399 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 399 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 399 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 399 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 399 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 399 | 03010 | Garlimint Plus BOP | 001 | 20 | 160.3 |
| Productions | 400 | 03003 | Calci-Phos-D | 001 | 34 | 34.41 |
| PRODUCTIONBATCH | 400 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 400 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 400 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 400 | 01043 | Sodium Chloride | 001 | 0 | 13.75 |
| PRODUCTIONBATCH | 400 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 400 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 400 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 400 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 400 | 03003 | Calci-Phos-D | 001 | 34 | 34.49 |
| Productions | 401 | 03012 | Kirzan BOP | 001 | 10 | 117.66 |
| PRODUCTIONBATCH | 401 | 01027 | Kaolin | 0001 | 1 | 400 |
| PRODUCTIONBATCH | 401 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 401 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 401 | 01117 | Magnesium Oxide | 0001 | 0 | 420 |
| PRODUCTIONBATCH | 401 | 01193 | Castor Oil | 001 | 0 | 1,150 |
| Productions | 401 | 03012 | Kirzan BOP | 001 | 10 | 117.66 |
| Productions | 402 | 03179 | Heaatic Optimizer Liquid | 001 | 10 | 72.69 |
| PRODUCTIONBATCH | 402 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 402 | 01011 | Choline Chloride | 0001 | 0 | 4,840.92 |
| PRODUCTIONBATCH | 402 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 402 | 01020 | Formic Acid | 001 | 0 | 312 |
| PRODUCTIONBATCH | 402 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 402 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 402 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 402 | 03179 | Heaatic Optimizer Liquid | 001 | 10 | 72.67 |
| Productions | 403 | 03121 | Bio Adek Liquid | 001 | 100 | 11.33 |
| PRODUCTIONBATCH | 403 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 403 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| Productions | 403 | 03121 | Bio Adek Liquid | 001 | 100 | 11.33 |
| Productions | 404 | 03176 | Ampro-Plus Liquid | 001 | 200 | 125.86 |
| PRODUCTIONBATCH | 404 | 01017 | Camphor | 0001 | 1 | 3,370.68 |
| PRODUCTIONBATCH | 404 | 01031 | Menthol Crystal | 001 | 3 | 6,500 |
| PRODUCTIONBATCH | 404 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 404 | 01058 | Xanthan Gum | 001 | 1 | 1,450 |
| Productions | 404 | 03176 | Ampro-Plus Liquid | 001 | 200 | 129.19 |
| Productions | 405 | 03018 | Scour Guard | 001 | 60 | 86.57 |
| PRODUCTIONBATCH | 405 | 01027 | Kaolin | 0001 | 9 | 400 |
| PRODUCTIONBATCH | 405 | 01043 | Sodium Chloride | 001 | 5 | 13.75 |
| PRODUCTIONBATCH | 405 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 405 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 405 | 01073 | Potassium Chloride | 001 | 2 | 400 |
| Productions | 405 | 03018 | Scour Guard | 001 | 60 | 86.8 |
| PurchasesBatch | 212 | 01038 | Phosphoric Acid 85% | 001 | 35 | 650 |
| PurchasesBatch | 213 | 01184 | ARQ | 001 | 60 | 367 |
| PurchasesBatch | 214 | 01027 | Kaolin | 001 | 50 | 400 |
| PurchasesBatch | 215 | 01009 | Copper Sulphate | 001 | 50 | 2,200 |
| PurchasesBatch | 216 | 01186 | HCL | 001 | 30 | 70 |
| PurchasesBatch | 217 | 02451 | Label Brosteine 15 Oral Liquid 5 LIT | 001 | 70 | 40 |
| PurchasesBatch | 218 | 02452 | Label Copper lac oral liquid 1L | 001 | 70 | 40 |
| PurchasesBatch | 219 | 02453 | Label Copper Lac plus Oral Liquid 1L | 001 | 70 | 40 |
| PurchasesBatch | 220 | 02454 | Label Tox Go Vital Oral Liquid 5 Lit | 001 | 50 | 80 |
| PurchasesBatch | 221 | 02455 | Label Promune 35 Oral Liquid 5 Lit | 001 | 50 | 80 |
| PACKING | 321 | 00019 | DCP BOP 25kg | 0001 | 85 | 515 |
| PACKINGBATCH | 321 | 02034 | BAG BOP DCP 25 KG | 001 | 85 | 100 |
| PACKINGBATCH | 321 | 03002 | DCP Powder | 001 | 2,125 | 17 |
| PACKING | 321 | 00019 | DCP BOP 25kg | 0001 | 85 | 525 |
| PACKING | 322 | 00180 | Stable C 20 (5 Liter) | 0001 | 12 | 1,383.77 |
| PACKINGBATCH | 322 | 02014 | Plastic Can White 5 Liter | 001 | 12 | 440 |
| PACKINGBATCH | 322 | 02272 | Label Stable C20  5Lit | 001 | 15 | 40 |
| PACKINGBATCH | 322 | 03119 | Stable C 20 Liquid | 050726 | 60 | 164.87 |
| PACKINGBATCH | 322 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 4 | 235 |
| PACKING | 322 | 00180 | Stable C 20 (5 Liter) | 0001 | 12 | 1,392.67 |
| PRODUCTIONBATCH | 304 | 01003 | Bentonite |  | 0 | 0 |
| PRODUCTIONBATCH | 304 | 01059 | Wheat Bran |  | 0 | 0 |
| Production | 304 | 03022 | Growth Promoter Plus |  | 0 | 0 |
| Productions | 406 | 03001 | Growth Promoter BOP Oral | 0001 | 2,500 | 17.4 |
| PRODUCTIONBATCH | 406 | 01016 | DCP (Dana) | 0001 | 2,000 | 10 |
| PRODUCTIONBATCH | 406 | 01042 | Starch | 001 | 30 | 167 |
| PRODUCTIONBATCH | 406 | 01043 | Sodium Chloride | 001 | 500 | 13.75 |
| PRODUCTIONBATCH | 406 | 01050 | Tartrazine Yellow Color Indian | 001 | 3 | 3,100 |
| Productions | 406 | 03001 | Growth Promoter BOP Oral | 0001 | 2,500 | 17.4 |
| OpeningBatch | 58 | 02032 | BAG Growth Promoter 25 KG | 0001 | 700 | 155 |
| PACKING | 323 | 00016 | Growth Promoter 25kg | 0001 | 100 | 590.1 |
| PACKINGBATCH | 323 | 02032 | BAG Growth Promoter 25 KG | 0001 | 100 | 155 |
| PACKINGBATCH | 323 | 03001 | Growth Promoter BOP Oral | 0001 | 2,500 | 17.4 |
| PACKING | 324 | 00212 | Microgold-Bop 25 kg | 0001 | 53 | 1,771.01 |
| PACKINGBATCH | 324 | 02245 | Label Microgold-Bop 25 kg | 0001 | 55 | 40 |
| PACKINGBATCH | 324 | 03151 | Microgold-Bop | 070726 | 1,325 | 62.98 |
| PACKINGBATCH | 324 | 02213 | Bag Bop Red Colour | 0001 | 53 | 155 |
| PACKING | 324 | 00212 | Microgold-Bop 25 kg | 0001 | 53 | 1,771.01 |
| PACKING | 325 | 00263 | GrowMore 100gm | 0001 | 450 | 14.74 |
| PACKINGBATCH | 325 | 02320 | Packet GrowMore 100 gm | 0001 | 450 | 10 |
| PACKINGBATCH | 325 | 03182 | GrowMore Powder | 001 | 45 | 21.29 |
| PACKINGBATCH | 325 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 5 | 235 |
| PACKING | 325 | 00263 | GrowMore 100gm | 0001 | 450 | 14.74 |
| PACKING | 326 | 00258 | GrowMore 25KG | 0001 | 6 | 602.27 |
| PACKINGBATCH | 326 | 02312 | Label GrowMore 25KG | 0001 | 6 | 70 |
| PACKINGBATCH | 326 | 03182 | GrowMore Powder | 001 | 150 | 21.29 |
| PACKING | 326 | 00258 | GrowMore 25KG | 0001 | 6 | 602.27 |
| PACKING | 327 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 26.48 |
| PACKINGBATCH | 327 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 520 | 12 |
| PACKINGBATCH | 327 | 03003 | Calci-Phos-D | 001 | 50 | 34.41 |
| PACKINGBATCH | 327 | 02010 | Bottle Pet Amber 100ML | 001 | 500 | 8 |
| PACKINGBATCH | 327 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 6 | 213 |
| PACKING | 327 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 26.48 |
| PACKING | 328 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 279.79 |
| PACKINGBATCH | 328 | 02097 | Bottle Round liter | 0001 | 45 | 220.33 |
| PACKINGBATCH | 328 | 02097 | Bottle Round liter | 001 | 75 | 230 |
| PACKINGBATCH | 328 | 02385 | Label Calci Phos D 1 Lit | 001 | 135 | 18 |
| PACKINGBATCH | 328 | 03003 | Calci-Phos-D | 001 | 120 | 34.41 |
| PACKING | 328 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 281.04 |
| PACKING | 329 | 00049 | Calci-Phos-D 5 Lit | 0001 | 60 | 708.03 |
| PACKINGBATCH | 329 | 02014 | Plastic Can White 5 Liter | 001 | 60 | 440 |
| PACKINGBATCH | 329 | 02027 | Label Calci Phos D 5 Liter | 0001 | 80 | 22.22 |
| PACKINGBATCH | 329 | 03003 | Calci-Phos-D | 001 | 300 | 34.41 |
| PACKINGBATCH | 329 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 17 | 235 |
| PACKING | 329 | 00049 | Calci-Phos-D 5 Lit | 0001 | 60 | 708.28 |
| PACKING | 330 | 00022 | Magnet BOP 25kg | 0001 | 10 | 480.57 |
| PACKINGBATCH | 330 | 02033 | BAG Magnet 25 KG | 0001 | 10 | 155 |
| PACKINGBATCH | 330 | 03014 | Magnet BOP Oral Powder | 001 | 250 | 13.02 |
| PACKING | 330 | 00022 | Magnet BOP 25kg | 0001 | 10 | 480.57 |
| PACKING | 331 | 00020 | Magnet BOP 1kg | 0001 | 25 | 43.02 |
| PACKINGBATCH | 331 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 25 | 30 |
| PACKINGBATCH | 331 | 03014 | Magnet BOP Oral Powder | 001 | 25 | 13.02 |
| PACKING | 331 | 00020 | Magnet BOP 1kg | 0001 | 25 | 43.02 |
| PACKING | 332 | 00122 | immune forte Oral Liquid 1 Lit | 0001 | 24 | 389.94 |
| PACKINGBATCH | 332 | 02097 | Bottle Round liter | 001 | 24 | 230 |
| PACKINGBATCH | 332 | 03092 | Immune Forte Oral liquid | 001 | 24 | 159.94 |
| PACKING | 332 | 00122 | immune forte Oral Liquid 1 Lit | 0001 | 24 | 389.94 |
| PACKING | 333 | 00259 | Garliment-Plus BOP  30ML | 0001 | 450 | 22.48 |
| PACKINGBATCH | 333 | 02314 | Dropper  30ML | 001 | 450 | 13 |
| PACKINGBATCH | 333 | 02316 | S+D Garliment Plus 30ML | 0001 | 357 | 6 |
| PACKINGBATCH | 333 | 03010 | Garlimint Plus BOP | 001 | 13 | 163.73 |
| PACKING | 333 | 00259 | Garliment-Plus BOP  30ML | 0001 | 450 | 22.49 |
| PACKING | 334 | 00392 | Heaatic Optimiser Oral Liquid 1 Lit | 0001 | 48 | 284.08 |
| PACKINGBATCH | 334 | 02097 | Bottle Round liter | 001 | 48 | 230 |
| PACKINGBATCH | 334 | 03179 | Heaatic Optimizer Liquid | 001 | 48 | 54.08 |
| PACKING | 334 | 00392 | Heaatic Optimiser Oral Liquid 1 Lit | 0001 | 48 | 284.08 |
| PRODUCTIONBATCH | 312 | 01036 | Propylene Glycol (PG) |  | 0 | 0 |
| PRODUCTIONBATCH | 312 | 01041 | Sodium Benzoate |  | 0 | 0 |
| PRODUCTIONBATCH | 312 | 01052 | Vitamin A |  | 0 | 0 |
| PRODUCTIONBATCH | 312 | 01053 | Vitamin B1 |  | 0 | 0 |
| PRODUCTIONBATCH | 312 | 01056 | Vitamin D3 |  | 0 | 0 |
| PRODUCTIONBATCH | 312 | 01057 | Vitamin B6 |  | 0 | 0 |
| PRODUCTIONBATCH | 312 | 01058 | Xanthan Gum |  | 0 | 0 |
| Production | 312 | 03204 | Adek Gold Oral Liquid |  | 0 | 0 |
| Productions | 407 | 03108 | Bop ADEK Powder | 0001 | 50 | 124.77 |
| PRODUCTIONBATCH | 407 | 01001 | Aerosil | 0001 | 0 | 1,850 |
| PRODUCTIONBATCH | 407 | 01002 | Ammonium chloride | 0001 | 5 | 271.82 |
| PRODUCTIONBATCH | 407 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 407 | 01047 | Sodium Sulphate | 001 | 45 | 71.95 |
| PRODUCTIONBATCH | 407 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 407 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 407 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| Productions | 407 | 03108 | Bop ADEK Powder | 0001 | 50 | 123.63 |
| PACKING | 335 | 00152 | Bop ADEK Powder 1 Kg | 0001 | 50 | 184.22 |
| PACKINGBATCH | 335 | 02166 | Label ADEK Powder 1 Kg | 001 | 64 | 40 |
| PACKINGBATCH | 335 | 03108 | Bop ADEK Powder | 0001 | 50 | 123.63 |
| PACKINGBATCH | 335 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 2 | 235 |
| PACKING | 335 | 00152 | Bop ADEK Powder 1 Kg | 0001 | 50 | 184.23 |
| PRODUCTIONBATCH | 313 | 01010 | Betaine |  | 0 | 0 |
| PRODUCTIONBATCH | 313 | 01012 | Chocolate Brown Colour |  | 0 | 0 |
| PRODUCTIONBATCH | 313 | 01020 | Formic Acid |  | 0 | 0 |
| PRODUCTIONBATCH | 313 | 01038 | Phosphoric Acid 85% |  | 0 | 0 |
| PRODUCTIONBATCH | 313 | 01041 | Sodium Benzoate |  | 0 | 0 |
| PRODUCTIONBATCH | 313 | 01058 | Xanthan Gum |  | 0 | 0 |
| PRODUCTIONBATCH | 313 | 01060 | Zinc Sulphate |  | 0 | 0 |
| Production | 313 | 03179 | Heaatic Optimizer Liquid |  | 0 | 0 |
| Productions | 408 | 03011 | Hepatic-Optimizer Liquid | 0001 | 100 | 81.99 |
| PRODUCTIONBATCH | 408 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 408 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 408 | 01013 | Calcium Chloride | 001 | 1 | 220 |
| PRODUCTIONBATCH | 408 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 408 | 01043 | Sodium Chloride | 001 | 0 | 13.75 |
| PRODUCTIONBATCH | 408 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 408 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 408 | 01184 | ARQ | 001 | 5 | 367 |
| Productions | 408 | 03011 | Hepatic-Optimizer Liquid | 0001 | 100 | 82.07 |
| PACKING | 336 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 20 | 929.04 |
| PACKINGBATCH | 336 | 02014 | Plastic Can White 5 Liter | 001 | 20 | 440 |
| PACKINGBATCH | 336 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 20 | 20 |
| PACKINGBATCH | 336 | 03011 | Hepatic-Optimizer Liquid | 0001 | 100 | 82.07 |
| PACKINGBATCH | 336 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 5 | 235 |
| PACKING | 336 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 20 | 929.09 |
| PACKING | 337 | 00090 | Micro Sel E Oral Liquid 5 Lit | 0001 | 8 | 1,788.26 |
| PACKINGBATCH | 337 | 02014 | Plastic Can White 5 Liter | 001 | 10 | 440 |
| PACKINGBATCH | 337 | 02092 | Label Micro Sel E 5 Lit | 001 | 15 | 40 |
| PACKINGBATCH | 337 | 03027 | Micro Sel-E Oral Liquid | 001 | 40 | 215.04 |
| PACKINGBATCH | 337 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 3 | 235 |
| PACKING | 337 | 00090 | Micro Sel E Oral Liquid 5 Lit | 0001 | 8 | 1,788.33 |
| OpeningBatch | 109 | 02433 | Tin Febro Meon Spray | 0001 | 4,224 | 150 |
| PACKING | 338 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 196.82 |
| PACKINGBATCH | 338 | 02433 | Tin Febro Meon Spray | 0001 | 288 | 150 |
| PACKINGBATCH | 338 | 03264 | Febro Meon Spray | 001 | 34 | 392.99 |
| PACKING | 338 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 196.39 |
| PACKING | 339 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 1,207.27 |
| PACKINGBATCH | 339 | 02213 | Bag Bop Red Colour | 0001 | 2 | 155 |
| PACKINGBATCH | 339 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 2 | 40 |
| PACKINGBATCH | 339 | 03144 | Yeast Plus Powder | 001 | 50 | 40.49 |
| PACKING | 339 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 1,207.27 |
| PACKING | 340 | 00289 | ACIDO FORTE 25 Lit | 0001 | 20 | 2,173.16 |
| PACKINGBATCH | 340 | 02128 | White Can 25 Liter | 0001 | 20 | 1,065.44 |
| PACKINGBATCH | 340 | 02345 | Label Acido Forte 25 Lit | 001 | 24 | 90 |
| PACKINGBATCH | 340 | 03201 | Acido Forte | 001 | 500 | 39.99 |
| PACKING | 340 | 00289 | ACIDO FORTE 25 Lit | 0001 | 20 | 2,173.16 |
| PACKING | 341 | 00286 | Frost Oral Liquid 5 liter | 0001 | 40 | 694.58 |
| PACKINGBATCH | 341 | 02014 | Plastic Can White 5 Liter | 001 | 45 | 440 |
| PACKINGBATCH | 341 | 02342 | Label Frost Oral Liquid 5 Liter | 001 | 60 | 40 |
| PACKINGBATCH | 341 | 03198 | Frost Oral Liquid | 001 | 200 | 16.18 |
| PACKINGBATCH | 341 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 10 | 235 |
| PACKING | 341 | 00286 | Frost Oral Liquid 5 liter | 0001 | 40 | 694.63 |
| PACKING | 342 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 1,384.03 |
| PACKINGBATCH | 342 | 02014 | Plastic Can White 5 Liter | 001 | 45 | 440 |
| PACKINGBATCH | 342 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 001 | 60 | 40 |
| PACKINGBATCH | 342 | 03192 | Immunit Z Oral Liquid | 001 | 200 | 151.72 |
| PACKINGBATCH | 342 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 12 | 235 |
| PACKING | 342 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 1,384.09 |
| PACKING | 343 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 24 | 1,110.67 |
| PACKINGBATCH | 343 | 02014 | Plastic Can White 5 Liter | 001 | 24 | 440 |
| PACKINGBATCH | 343 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 001 | 40 | 40 |
| PACKINGBATCH | 343 | 03194 | MLC 100  Oral Liquid | 001 | 120 | 107.11 |
| PACKINGBATCH | 343 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 7 | 235 |
| PACKING | 343 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 24 | 1,110.74 |
| PACKING | 344 | 00208 | Profen C+ Powder 1Kg | 0001 | 368 | 259.3 |
| PACKINGBATCH | 344 | 02232 | Packet Profen C+ 1kg | 0001 | 130 | 30 |
| PACKINGBATCH | 344 | 03146 | Profen C+ Powder | 001 | 368 | 156.04 |
| PACKINGBATCH | 344 | 02140 | Bucket Large | 001 | 31 | 1,100 |
| PACKING | 345 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 120 | 1,206.43 |
| PACKINGBATCH | 345 | 02014 | Plastic Can White 5 Liter | 001 | 130 | 440 |
| PACKINGBATCH | 345 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 001 | 160 | 40 |
| PACKINGBATCH | 345 | 03190 | CRD Mint Oral Liquid | 001 | 600 | 121.59 |
| PACKINGBATCH | 345 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 35 | 235 |
| PACKING | 345 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 120 | 1,206.49 |
| PACKING | 346 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 567.73 |
| PACKINGBATCH | 346 | 02329 | Label Merlin Fix Oral Powder 25 kg | 001 | 25 | 120 |
| PACKINGBATCH | 346 | 03189 | Merlin Fix Oral Powder | 001 | 500 | 16.71 |
| PACKING | 346 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 567.73 |
| PACKING | 347 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 300 | 191.39 |
| PACKINGBATCH | 347 | 02341 | Packet Reno Gurd Flush Oral Powder 1 kg | 001 | 310 | 33 |
| PACKINGBATCH | 347 | 03197 | Reno Gurd Flush Oral Powder | 001 | 300 | 83.96 |
| PACKINGBATCH | 347 | 02140 | Bucket Large | 001 | 20 | 1,100 |
| PACKING | 348 | 00295 | Hepa Gold Oral Liquid 5 Lit | 0001 | 40 | 1,077.99 |
| PACKINGBATCH | 348 | 02014 | Plastic Can White 5 Liter | 001 | 40 | 440 |
| PACKINGBATCH | 348 | 02350 | Label Hepa Gold Oral Liquid 5 Lit | 001 | 60 | 40 |
| PACKINGBATCH | 348 | 03206 | Hepa Gold Oral Liquid | 001 | 200 | 103.86 |
| PACKINGBATCH | 348 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 10 | 235 |
| PACKING | 348 | 00295 | Hepa Gold Oral Liquid 5 Lit | 0001 | 40 | 1,078.06 |
| PACKING | 349 | 00291 | COPPER Gold Oral Liquid 5 Lit | 0001 | 32 | 837.92 |
| PACKINGBATCH | 349 | 02014 | Plastic Can White 5 Liter | 001 | 32 | 440 |
| PACKINGBATCH | 349 | 02348 | Label COPPER Gold Oral Liquid 5 Lit | 001 | 50 | 40 |
| PACKINGBATCH | 349 | 03205 | COPPER Gold Oral Liquid | 001 | 160 | 55.35 |
| PACKINGBATCH | 349 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 8 | 235 |
| PACKING | 349 | 00291 | COPPER Gold Oral Liquid 5 Lit | 0001 | 32 | 837.98 |
| PurchasesBatch | 176 | 02026 | Label Toxi Lic 5 Liter |  | 0 | 0 |
| PurchasesBatch | 176 | 02210 | Label TOXI GOLD Liquid 5 Liter | 0001 | 50 | 40 |
| PACKING | 350 | 00188 | TOXI GOLD Liquid 5 Liter | 0001 | 32 | 1,004.98 |
| PACKINGBATCH | 350 | 02014 | Plastic Can White 5 Liter | 001 | 32 | 440 |
| PACKINGBATCH | 350 | 02210 | Label TOXI GOLD Liquid 5 Liter | 0001 | 50 | 40 |
| PACKINGBATCH | 350 | 03070 | Toxi Gold Liquid | 001 | 160 | 85.82 |
| PACKINGBATCH | 350 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 10 | 235 |
| PACKING | 350 | 00188 | TOXI GOLD Liquid 5 Liter | 0001 | 32 | 1,005.06 |
| PACKING | 351 | 00194 | E.C Gold Oral Liquid  5 Liter | 0001 | 32 | 852.2 |
| PACKINGBATCH | 351 | 02014 | Plastic Can White 5 Liter | 001 | 32 | 440 |
| PACKINGBATCH | 351 | 02216 | Label E.C Gold Oral Liquid 5 Litter | 001 | 50 | 40 |
| PACKINGBATCH | 351 | 03075 | E.C Gold Oral  Liquid | 001 | 160 | 58.2 |
| PACKINGBATCH | 351 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 8 | 235 |
| PACKING | 351 | 00194 | E.C Gold Oral Liquid  5 Liter | 0001 | 32 | 852.27 |
| PACKING | 352 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 20 | 762.5 |
| PACKINGBATCH | 352 | 02351 | label Toxi Gold Forte Powder 25 kg | 001 | 40 | 140 |
| PACKINGBATCH | 352 | 03207 | Toxi Gold Forte Powder | 001 | 500 | 13.1 |
| PACKINGBATCH | 352 | 02213 | Bag Bop Red Colour | 0001 | 20 | 155 |
| PACKING | 352 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 20 | 762.5 |
| PACKING | 353 | 00228 | P.H Cure 25 Liter | 0001 | 20 | 1,809.67 |
| PACKINGBATCH | 353 | 02128 | White Can 25 Liter | 0001 | 20 | 1,065.44 |
| PACKINGBATCH | 353 | 02268 | Label P.H Cure 25Liter | 001 | 20 | 90 |
| PACKINGBATCH | 353 | 03162 | P.H Cure Liquid | 001 | 500 | 26.17 |
| PACKING | 353 | 00228 | P.H Cure 25 Liter | 0001 | 20 | 1,809.67 |
| PACKING | 354 | 00220 | Rumicid powder 25kg | 0001 | 20 | 498.12 |
| PACKINGBATCH | 354 | 02258 | Label Rumicid 25kg | 0001 | 20 | 44.15 |
| PACKINGBATCH | 354 | 03046 | Rumicid BOP Oral Powder | 001 | 500 | 11.96 |
| PACKINGBATCH | 354 | 02213 | Bag Bop Red Colour | 0001 | 20 | 155 |
| PACKING | 354 | 00220 | Rumicid powder 25kg | 0001 | 20 | 498.12 |
| PACKING | 355 | 00020 | Magnet BOP 1kg | 0001 | 250 | 52.41 |
| PACKINGBATCH | 355 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 250 | 30 |
| PACKINGBATCH | 355 | 03014 | Magnet BOP Oral Powder | 001 | 250 | 13.02 |
| PACKINGBATCH | 355 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 10 | 235 |
| PACKING | 355 | 00020 | Magnet BOP 1kg | 0001 | 250 | 52.42 |
| PACKING | 356 | 00022 | Magnet BOP 25kg | 0001 | 50 | 480.57 |
| PACKINGBATCH | 356 | 02033 | BAG Magnet 25 KG | 0001 | 50 | 155 |
| PACKINGBATCH | 356 | 03014 | Magnet BOP Oral Powder | 001 | 1,250 | 13.02 |
| PACKING | 356 | 00022 | Magnet BOP 25kg | 0001 | 50 | 480.57 |
| PACKING | 357 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 197.2 |
| PACKINGBATCH | 357 | 02433 | Tin Febro Meon Spray | 0001 | 480 | 150 |
| PACKINGBATCH | 357 | 03264 | Febro Meon Spray | 001 | 57 | 392.99 |
| PACKING | 357 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 196.67 |
| PACKING | 358 | 00049 | Calci-Phos-D 5 Lit | 0001 | 40 | 712.85 |
| PACKINGBATCH | 358 | 02014 | Plastic Can White 5 Liter | 001 | 40 | 440 |
| PACKINGBATCH | 358 | 02027 | Label Calci Phos D 5 Liter | 0001 | 55 | 22.22 |
| PACKINGBATCH | 358 | 03003 | Calci-Phos-D | 001 | 14 | 34.41 |
| PACKINGBATCH | 358 | 03003 | Calci-Phos-D | 110 | 186 | 34.34 |
| PACKINGBATCH | 358 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 12 | 235 |
| PACKING | 358 | 00049 | Calci-Phos-D 5 Lit | 0001 | 40 | 712.76 |
| PACKING | 359 | 00032 | Calci-Phos-D 1000ml | 0001 | 45 | 284.34 |
| PACKINGBATCH | 359 | 02097 | Bottle Round liter | 001 | 45 | 230 |
| PACKINGBATCH | 359 | 02385 | Label Calci Phos D 1 Lit | 001 | 50 | 18 |
| PACKINGBATCH | 359 | 03003 | Calci-Phos-D | 110 | 45 | 34.34 |
| PACKING | 359 | 00032 | Calci-Phos-D 1000ml | 0001 | 45 | 284.34 |
| PACKING | 360 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 25 | 681.5 |
| PACKINGBATCH | 360 | 02351 | label Toxi Gold Forte Powder 25 kg | 001 | 30 | 140 |
| PACKINGBATCH | 360 | 03207 | Toxi Gold Forte Powder | 001 | 625 | 13.1 |
| PACKINGBATCH | 360 | 02213 | Bag Bop Red Colour | 0001 | 30 | 155 |
| PACKING | 360 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 25 | 681.5 |
| PACKING | 361 | 00220 | Rumicid powder 25kg | 0001 | 20 | 509.16 |
| PACKINGBATCH | 361 | 02258 | Label Rumicid 25kg | 0001 | 25 | 44.15 |
| PACKINGBATCH | 361 | 03046 | Rumicid BOP Oral Powder | 001 | 500 | 11.96 |
| PACKINGBATCH | 361 | 02213 | Bag Bop Red Colour | 0001 | 20 | 155 |
| PACKING | 361 | 00220 | Rumicid powder 25kg | 0001 | 20 | 509.16 |
| Productions | 338 | 03163 | Calcium 72 | 001 | 375 | 0.11 |
| PRODUCTIONBATCH | 338 | 01015 | DCP (Calcium) |  | 0 | 0 |
| PRODUCTIONBATCH | 338 | 01015 | DCP (Calcium) | 0001 | 375 | 17 |
| Productions | 338 | 03163 | Calcium 72 | 001 | 375 | 17 |
| PACKING | 362 | 00231 | Calcium 72 25kg | 0001 | 15 | 525 |
| PACKINGBATCH | 362 | 02274 | Bag Calcium 72  25kg | 001 | 15 | 100 |
| PACKINGBATCH | 362 | 03163 | Calcium 72 | 001 | 375 | 17 |
| PACKING | 363 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 6 | 408.88 |
| PACKINGBATCH | 363 | 02213 | Bag Bop Red Colour | 0001 | 6 | 155 |
| PACKINGBATCH | 363 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 6 | 47.63 |
| PACKINGBATCH | 363 | 03253 | BOP Yeast Oral Powder (High) | 001 | 150 | 8.25 |
| PACKING | 363 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 6 | 408.88 |
| PACKING | 364 | 00294 | Adek Gold Oral Liquid 5 Lit | 0001 | 36 | 1,030.81 |
| PACKINGBATCH | 364 | 02014 | Plastic Can White 5 Liter | 001 | 36 | 440 |
| PACKINGBATCH | 364 | 02349 | Label Adek Gold Oral Liquid 5 Lit | 001 | 55 | 40 |
| PACKINGBATCH | 364 | 03204 | Adek Gold Oral Liquid | 001 | 180 | 95.51 |
| PACKINGBATCH | 364 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 8 | 235 |
| PACKING | 364 | 00294 | Adek Gold Oral Liquid 5 Lit | 0001 | 36 | 1,030.87 |
| PACKING | 365 | 00320 | Neufen Gold Oral Powder 1 kg | 0001 | 300 | 212.69 |
| PACKINGBATCH | 365 | 02374 | Label Neufen Gold Oral Powder 1 kg | 001 | 320 | 40 |
| PACKINGBATCH | 365 | 03226 | Neufen Gold Oral Powder | 001 | 300 | 96.69 |
| PACKINGBATCH | 365 | 02140 | Bucket Large | 001 | 19 | 1,100 |
| PACKINGBATCH | 365 | 02140 | Bucket Large | 0001 | 1 | 1,100 |
| PACKING | 366 | 00197 | Eggcelent liquid 5 Liter | 0001 | 108 | 712.49 |
| PACKINGBATCH | 366 | 02014 | Plastic Can White 5 Liter | 001 | 110 | 440 |
| PACKINGBATCH | 366 | 02220 | Label Eggcelent Liquid 5 Litter | 001 | 135 | 40 |
| PACKINGBATCH | 366 | 03142 | Eggcelent liquid | 001 | 540 | 30.7 |
| PACKINGBATCH | 366 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 28 | 235 |
| PACKING | 366 | 00197 | Eggcelent liquid 5 Liter | 0001 | 108 | 712.56 |
| PACKING | 367 | 00118 | CID 7 Oral Liquid 25 Lit | 0001 | 5 | 1,819.67 |
| PACKINGBATCH | 367 | 02128 | White Can 25 Liter | 0001 | 5 | 1,065.44 |
| PACKINGBATCH | 367 | 02129 | Label CID 7 Oral Liquid 25 Liter | 001 | 6 | 75 |
| PACKINGBATCH | 367 | 03029 | CID-7 Oral Liquid | 001 | 125 | 26.57 |
| PACKING | 367 | 00118 | CID 7 Oral Liquid 25 Lit | 0001 | 5 | 1,819.67 |
| PACKING | 368 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 44 | 1,119.68 |
| PACKINGBATCH | 368 | 02014 | Plastic Can White 5 Liter | 001 | 44 | 440 |
| PACKINGBATCH | 368 | 02395 | Label Toxin Pro Oral Liquid 5 Lit | 001 | 70 | 40 |
| PACKINGBATCH | 368 | 03241 | Toxin Pro Oral Liquid | 001 | 220 | 110.41 |
| PACKINGBATCH | 368 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 12 | 235 |
| PACKING | 368 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 44 | 1,119.76 |
| PurchasesBatch | 178 | 02305 | Label Heaatic Optimizer 5 Liter |  | 0 | 0 |
| PurchasesBatch | 178 | 02234 | Label Hepatic Optimizer fort 25kg | 0001 | 20 | 140 |
| PACKING | 369 | 00209 | Hepatic Optimizer fort Powder 25kg | 0001 | 20 | 2,683.7 |
| PACKINGBATCH | 369 | 02234 | Label Hepatic Optimizer fort 25kg | 001 | 6 | 140 |
| PACKINGBATCH | 369 | 02234 | Label Hepatic Optimizer fort 25kg | 0001 | 14 | 140 |
| PACKINGBATCH | 369 | 03147 | Hepatic Optimizer fort Powder | 001 | 500 | 95.55 |
| PACKINGBATCH | 369 | 02213 | Bag Bop Red Colour | 0001 | 20 | 155 |
| PRODUCTIONBATCH | 345 | 01009 | Copper Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01013 | Calcium Chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01028 | Lactic Acid |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01034 | Magnesium Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01038 | Phosphoric Acid 85% |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01041 | Sodium Benzoate |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01045 | Sorbitol Liquid 70% |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01056 | Vitamin D3 |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01058 | Xanthan Gum |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01060 | Zinc Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 345 | 01189 | Glycerine |  | 0 | 0 |
| Production | 345 | 03221 | Phyto-Phos Oral Liquid |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01009 | Copper Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01013 | Calcium Chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01028 | Lactic Acid |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01034 | Magnesium Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01038 | Phosphoric Acid 85% |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01041 | Sodium Benzoate |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01045 | Sorbitol Liquid 70% |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01056 | Vitamin D3 |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01058 | Xanthan Gum |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01060 | Zinc Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 346 | 01189 | Glycerine |  | 0 | 0 |
| Production | 346 | 03221 | Phyto-Phos Oral Liquid |  | 0 | 0 |
| PRODUCTIONBATCH | 349 | 01015 | DCP (Calcium) |  | 0 | 0 |
| Production | 349 | 03167 | Bop Dairy Calcium |  | 0 | 0 |
| PRODUCTIONBATCH | 350 | 01015 | DCP (Calcium) |  | 0 | 0 |
| Production | 350 | 03167 | Bop Dairy Calcium |  | 0 | 0 |
| Productions | 409 | 03163 | Calcium 72 | 0001 | 5,500 | 17 |
| PRODUCTIONBATCH | 409 | 01015 | DCP (Calcium) | 0001 | 5,500 | 17 |
| PACKING | 370 | 00248 | Calcium-72 1KG | 0001 | 500 | 58.74 |
| PACKINGBATCH | 370 | 02299 | Packet Calcium-72 1KG | 0001 | 500 | 30 |
| PACKINGBATCH | 370 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| PACKINGBATCH | 370 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 25 | 235 |
| PACKING | 370 | 00248 | Calcium-72 1KG | 0001 | 500 | 58.75 |
| PACKING | 371 | 00231 | Calcium 72 25kg | 0001 | 200 | 525 |
| PACKINGBATCH | 371 | 02274 | Bag Calcium 72  25kg | 001 | 200 | 100 |
| PACKINGBATCH | 371 | 03163 | Calcium 72 | 0001 | 5,000 | 17 |
| PACKING | 372 | 00020 | Magnet BOP 1kg | 0001 | 500 | 54.76 |
| PACKINGBATCH | 372 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 500 | 30 |
| PACKINGBATCH | 372 | 03014 | Magnet BOP Oral Powder | 001 | 500 | 13.02 |
| PACKINGBATCH | 372 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 25 | 235 |
| PACKING | 372 | 00020 | Magnet BOP 1kg | 0001 | 500 | 54.77 |
| PurchasesBatch | 222 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 25 | 1,550 |
| PurchasesBatch | 222 | 01208 | Ammonium Metavandate | 0001 | 0 | 55,000 |
| PRODUCTIONBATCH | 353 | 01015 | DCP (Calcium) |  | 0 | 0 |
| PRODUCTIONBATCH | 353 | 01190 | PHOSPHORUS Powder 29% |  | 0 | 0 |
| Production | 353 | 03134 | DCP Powder 29 % |  | 0 | 0 |
| Productions | 410 | 03163 | Calcium 72 | 0001 | 750 | 0 |
| PRODUCTIONBATCH | 410 | 01015 | DCP (Calcium) | 0001 | 750 | 17 |
| Productions | 410 | 03163 | Calcium 72 | 0001 | 750 | 17 |
| PACKING | 373 | 00248 | Calcium-72 1KG | 0001 | 250 | 58.27 |
| PACKINGBATCH | 373 | 02299 | Packet Calcium-72 1KG | 0001 | 250 | 30 |
| PACKINGBATCH | 373 | 03163 | Calcium 72 | 0001 | 250 | 17 |
| PACKINGBATCH | 373 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 12 | 235 |
| PACKING | 373 | 00248 | Calcium-72 1KG | 0001 | 250 | 58.28 |
| PACKING | 374 | 00231 | Calcium 72 25kg | 0001 | 20 | 525 |
| PACKINGBATCH | 374 | 02274 | Bag Calcium 72  25kg | 001 | 20 | 100 |
| PACKINGBATCH | 374 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| PACKING | 375 | 00020 | Magnet BOP 1kg | 0001 | 250 | 52.41 |
| PACKINGBATCH | 375 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 250 | 30 |
| PACKINGBATCH | 375 | 03014 | Magnet BOP Oral Powder | 001 | 250 | 13.02 |
| PACKINGBATCH | 375 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 10 | 235 |
| PACKING | 375 | 00020 | Magnet BOP 1kg | 0001 | 250 | 52.42 |
| PACKING | 376 | 00022 | Magnet BOP 25kg | 0001 | 5 | 480.57 |
| PACKINGBATCH | 376 | 02033 | BAG Magnet 25 KG | 0001 | 5 | 155 |
| PACKINGBATCH | 376 | 03014 | Magnet BOP Oral Powder | 001 | 125 | 13.02 |
| PACKING | 376 | 00022 | Magnet BOP 25kg | 0001 | 5 | 480.57 |
| PRODUCTIONBATCH | 352 | 01190 | PHOSPHORUS Powder 29% | 0001 | 1,000 | 11.5 |
| PRODUCTIONBATCH | 352 | 01015 | DCP (Calcium) |  | 0 | 0 |
| Productions | 352 | 03002 | DCP Powder | 001 | 1,500 | 7.67 |
| PACKING | 377 | 00019 | DCP BOP 25kg | 0001 | 40 | 111.88 |
| PACKINGBATCH | 377 | 02034 | BAG BOP DCP 25 KG | 001 | 40 | 100 |
| PACKINGBATCH | 377 | 03002 | DCP Powder | 001 | 875 | 1 |
| PACKING | 377 | 00019 | DCP BOP 25kg | 0001 | 40 | 121.88 |
| PACKINGBATCH | 377 | 02034 | BAG BOP DCP 25 KG |  | 0 | 0 |
| PACKINGBATCH | 377 | 03002 | DCP Powder |  | 0 | 0 |
| PACKING | 377 | 00019 | DCP BOP 25kg |  | 0 | 0 |
| PACKING | 377 | 00019 | DCP BOP 25kg | 0001 | 100 | 98.75 |
| PACKINGBATCH | 377 | 02034 | BAG BOP DCP 25 KG | 001 | 100 | 100 |
| PACKING | 377 | 00019 | DCP BOP 25kg | 0001 | 100 | 108.75 |
| PACKING | 378 | 00248 | Calcium-72 1KG | 0001 | 500 | 0 |
| PACKINGBATCH | 378 | 02299 | Packet Calcium-72 1KG | 0001 | 530 | 30 |
| PACKING | 378 | 00248 | Calcium-72 1KG | 0001 | 500 | 31.8 |
| PACKING | 379 | 00231 | Calcium 72 25kg | 0001 | 200 | 100 |
| PACKINGBATCH | 379 | 02274 | Bag Calcium 72  25kg | 001 | 200 | 100 |
| Productions | 411 | 03163 | Calcium 72 | 0001 | 2,500 | 0 |
| PRODUCTIONBATCH | 411 | 01015 | DCP (Calcium) | 0001 | 2,500 | 17 |
| Productions | 411 | 03163 | Calcium 72 | 0001 | 2,500 | 17 |
| PACKING | 380 | 00231 | Calcium 72 25kg | 0001 | 100 | 0 |
| PACKINGBATCH | 380 | 02274 | Bag Calcium 72  25kg | 001 | 73 | 100 |
| PACKINGBATCH | 380 | 03163 | Calcium 72 | 0001 | 2,500 | 17 |
| PACKING | 380 | 00231 | Calcium 72 25kg | 0001 | 100 | 498 |
| PRODUCTIONBATCH | 354 | 01013 | Calcium Chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 354 | 01022 | Genshat Voilt (Crystal) |  | 0 | 0 |
| PRODUCTIONBATCH | 354 | 01038 | Phosphoric Acid 85% |  | 0 | 0 |
| PRODUCTIONBATCH | 354 | 01043 | Sodium Chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 354 | 01048 | Titanium Dioxide (T.T) |  | 0 | 0 |
| PRODUCTIONBATCH | 354 | 01056 | Vitamin D3 |  | 0 | 0 |
| PRODUCTIONBATCH | 354 | 01058 | Xanthan Gum |  | 0 | 0 |
| PRODUCTIONBATCH | 354 | 01060 | Zinc Sulphate |  | 0 | 0 |
| PACKING | 381 | 00049 | Calci-Phos-D 5 Lit | 0001 | 20 | 568.38 |
| PACKINGBATCH | 381 | 02014 | Plastic Can White 5 Liter | 001 | 20 | 440 |
| PACKINGBATCH | 381 | 02027 | Label Calci Phos D 5 Liter | 0001 | 20 | 22.22 |
| PACKINGBATCH | 381 | 03003 | Calci-Phos-D | 110 | 14 | 34.34 |
| PACKINGBATCH | 381 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 7 | 235 |
| PACKING | 381 | 00049 | Calci-Phos-D 5 Lit | 0001 | 20 | 568.51 |
| PACKING | 382 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 248 |
| PACKINGBATCH | 382 | 02097 | Bottle Round liter | 001 | 120 | 230 |
| PACKINGBATCH | 382 | 02385 | Label Calci Phos D 1 Lit | 001 | 120 | 18 |
| PACKING | 383 | 00020 | Magnet BOP 1kg | 0001 | 500 | 54.76 |
| PACKINGBATCH | 383 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 500 | 30 |
| PACKINGBATCH | 383 | 03014 | Magnet BOP Oral Powder | 001 | 500 | 13.02 |
| PACKINGBATCH | 383 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 25 | 235 |
| PACKING | 383 | 00020 | Magnet BOP 1kg | 0001 | 500 | 54.77 |
| PACKING | 384 | 00022 | Magnet BOP 25kg | 0001 | 1 | 480.57 |
| PACKINGBATCH | 384 | 02033 | BAG Magnet 25 KG | 0001 | 1 | 155 |
| PACKINGBATCH | 384 | 03014 | Magnet BOP Oral Powder | 001 | 25 | 13.02 |
| PACKING | 384 | 00022 | Magnet BOP 25kg | 0001 | 1 | 480.57 |
| PACKING | 385 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 197.58 |
| PACKINGBATCH | 385 | 02433 | Tin Febro Meon Spray | 0001 | 480 | 150 |
| PACKINGBATCH | 385 | 03264 | Febro Meon Spray | 001 | 57 | 392.99 |
| PACKING | 385 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 196.67 |
| PACKING | 386 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 1,819.54 |
| PACKINGBATCH | 386 | 02014 | Plastic Can White 5 Liter | 001 | 60 | 440 |
| PACKINGBATCH | 386 | 02443 | Label Bio Guard oral Liquid 5 Lit | 001 | 80 | 80 |
| PACKINGBATCH | 386 | 03271 | Bio Guard oral Liquid | 001 | 300 | 241.28 |
| PACKINGBATCH | 386 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 17 | 235 |
| PACKING | 386 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 1,819.65 |
| PRODUCTIONBATCH | 358 | 01003 | Bentonite |  | 0 | 0 |
| PRODUCTIONBATCH | 358 | 01031 | Menthol Crystal |  | 0 | 0 |
| PRODUCTIONBATCH | 358 | 01059 | Wheat Bran |  | 0 | 0 |
| Production | 358 | 03022 | Growth Promoter Plus |  | 0 | 0 |
| PurchasesBatch | 186 | 02057 | Label Grow Plus 5 Liter |  | 0 | 0 |
| PurchasesBatch | 187 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 20 | 40 |
| PurchasesBatch | 187 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 20 | 80 |
| Productions | 412 | 03281 | Grow Pro + Oral Liquid | 0001 | 60 | 10.43 |
| PRODUCTIONBATCH | 412 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 412 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 412 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 412 | 03281 | Grow Pro + Oral Liquid | 0001 | 60 | 10.2 |
| PACKING | 387 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 12 | 702.52 |
| PACKINGBATCH | 387 | 02014 | Plastic Can White 5 Liter | 001 | 12 | 440 |
| PACKINGBATCH | 387 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 20 | 80 |
| PACKINGBATCH | 387 | 03281 | Grow Pro + Oral Liquid | 0001 | 60 | 10.2 |
| PACKINGBATCH | 387 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 4 | 235 |
| PACKING | 387 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 12 | 702.67 |
| PACKING | 388 | 00386 | Ocid Fort Oral Liquid 25 L | 0001 | 20 | 2,064.7 |
| PACKINGBATCH | 388 | 02128 | White Can 25 Liter | 0001 | 20 | 1,065.44 |
| PACKINGBATCH | 388 | 02449 | LABEL Ocid Fort Oral Liquid 25 L | 001 | 22 | 180 |
| PACKINGBATCH | 388 | 03275 | Ocid Fort Oral Liquid | 001 | 500 | 32.05 |
| PACKING | 388 | 00386 | Ocid Fort Oral Liquid 25 L | 0001 | 20 | 2,064.69 |
| PurchasesBatch | 191 | 02170 | Label Bento-Lic 25 Kg |  | 0 | 0 |
| PurchasesBatch | 191 | 02148 | Label Bentox Powder 25kg | 0001 | 12 | 140 |
| PACKING | 389 | 00139 | Bentox Powder 25 kg | 0001 | 10 | 648 |
| PACKINGBATCH | 389 | 02148 | Label Bentox Powder 25kg | 0001 | 12 | 140 |
| PACKINGBATCH | 389 | 03098 | Bentox Powder | 001 | 250 | 13 |
| PACKINGBATCH | 389 | 02213 | Bag Bop Red Colour | 0001 | 10 | 155 |
| PRODUCTIONBATCH | 361 | 01007 | CSL | 0001 | 50 | 35 |
| Productions | 361 | 03144 | Yeast Plus Powder | 001 | 500 | 43.98 |
| PACKING | 390 | 00199 | Yeast Plus Powder 25 kg | 0001 | 20 | 1,290.18 |
| PACKINGBATCH | 390 | 02213 | Bag Bop Red Colour | 0001 | 20 | 155 |
| PACKINGBATCH | 390 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 25 | 40 |
| PACKINGBATCH | 390 | 03144 | Yeast Plus Powder | 001 | 500 | 43.41 |
| PRODUCTIONBATCH | 362 | 01016 | DCP (Dana) |  | 0 | 0 |
| PRODUCTIONBATCH | 362 | 01016 | DCP (Dana) | 0001 | 600 | 10 |
| PRODUCTIONBATCH | 362 | 01042 | Starch | 001 | 10 | 167 |
| Productions | 362 | 03173 | Bop Dairy Mineral | 001 | 750 | 17.63 |
| PACKING | 391 | 00243 | Bop dairy Mineral 25 KG | 0001 | 30 | 735.67 |
| PACKINGBATCH | 391 | 02288 | Label Bop Dairy Mineral 25 KG | 001 | 30 | 140 |
| PACKINGBATCH | 391 | 03173 | Bop Dairy Mineral | 001 | 750 | 17.63 |
| PACKINGBATCH | 391 | 02213 | Bag Bop Red Colour | 0001 | 30 | 155 |
| PACKING | 391 | 00243 | Bop dairy Mineral 25 KG | 0001 | 30 | 735.67 |
| OpeningBatch | 115 | 00264 | DCP-Gold 25Kg | 001 | 10 | 1,500 |
| PACKING | 392 | 00074 | Magnet Plus 25 Kg | 0001 | 1 | 500 |
| PACKINGBATCH | 392 | 03045 | Magnet Plus Oral Powder | 001 | 25 | 13.8 |
| PACKINGBATCH | 392 | 02213 | Bag Bop Red Colour | 0001 | 1 | 155 |
| PurchasesBatch | 223 | 01002 | Ammonium chloride | 0001 | 50 | 280 |
| PurchasesBatch | 223 | 01073 | Potassium Chloride | 0001 | 25 | 370 |
| PurchasesBatch | 223 | 01034 | Magnesium Sulphate | 0001 | 50 | 560 |
| PACKING | 393 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 433.42 |
| PACKINGBATCH | 393 | 02097 | Bottle Round liter | 001 | 24 | 230 |
| PACKINGBATCH | 393 | 02265 | Label Garliment Plus 1Liter | 0001 | 24 | 40 |
| PACKINGBATCH | 393 | 03010 | Garlimint Plus BOP | 001 | 24 | 163.73 |
| PACKING | 393 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 433.73 |
| PurchasesBatch | 198 | 02265 | Label Garliment Plus 1Liter | 001 | 32 | 40 |
| PACKING | 394 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 433.42 |
| PACKINGBATCH | 394 | 02097 | Bottle Round liter | 001 | 24 | 230 |
| PACKINGBATCH | 394 | 02265 | Label Garliment Plus 1Liter | 0001 | 24 | 40 |
| PACKINGBATCH | 394 | 03010 | Garlimint Plus BOP | 001 | 24 | 163.73 |
| PACKING | 394 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 433.73 |
| PACKING | 395 | 00077 | Bio Ambrox 1 Liter Liquid | 0001 | 12 | 339.41 |
| PACKINGBATCH | 395 | 02067 | Label Bio Ambrox 1 Liter | 001 | 16 | 40 |
| PACKINGBATCH | 395 | 03054 | Bio Ambrox  Liquid | 001 | 12 | 56.08 |
| PACKINGBATCH | 395 | 02097 | Bottle Round liter | 001 | 12 | 230 |
| PACKING | 395 | 00077 | Bio Ambrox 1 Liter Liquid | 0001 | 12 | 339.41 |
| PACKING | 396 | 00368 | Toxi Off Oral Liquid 1 Lit | 0001 | 24 | 506.32 |
| PACKINGBATCH | 396 | 02097 | Bottle Round liter | 001 | 24 | 230 |
| PACKINGBATCH | 396 | 02431 | Label Toxi Off Oral Liquid 1 Lit | 001 | 32 | 40 |
| PACKINGBATCH | 396 | 03135 | Toxi - Off Liquid | 001 | 24 | 222.98 |
| PACKING | 396 | 00368 | Toxi Off Oral Liquid 1 Lit | 0001 | 24 | 506.32 |
| PRODUCTIONBATCH | 367 | 01184 | ARQ |  | 0 | 0 |
| PRODUCTIONBATCH | 367 | 01184 | ARQ | 001 | 20 | 367 |
| Productions | 367 | 03202 | VETLIV Oral Solution | 001 | 200 | 97.96 |
| PACKING | 397 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 40 | 1,115.16 |
| PACKINGBATCH | 397 | 02014 | Plastic Can White 5 Liter | 001 | 45 | 440 |
| PACKINGBATCH | 397 | 02346 | Label VETLIV Oral Solution 5 Lit | 001 | 60 | 40 |
| PACKINGBATCH | 397 | 03202 | VETLIV Oral Solution | 001 | 200 | 97.96 |
| PACKINGBATCH | 397 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 12 | 235 |
| PACKING | 397 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 40 | 1,115.31 |
| PRODUCTIONBATCH | 368 | 01020 | Formic Acid |  | 0 | 0 |
| PRODUCTIONBATCH | 368 | 01020 | Formic Acid | 001 | 40 | 312 |
| Productions | 368 | 03104 | BOP PH 5 Liquid | 001 | 500 | 41.01 |
| PACKING | 398 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 20 | 2,140.7 |
| PACKINGBATCH | 398 | 02128 | White Can 25 Liter | 0001 | 20 | 1,065.44 |
| PACKINGBATCH | 398 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 25 | 40 |
| PACKINGBATCH | 398 | 03104 | BOP PH 5 Liquid | 001 | 500 | 41.01 |
| PACKING | 398 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 20 | 2,140.69 |
| PACKING | 399 | 00022 | Magnet BOP 25kg | 0001 | 200 | 468.17 |
| PACKINGBATCH | 399 | 02033 | BAG Magnet 25 KG | 0001 | 184 | 155 |
| PACKINGBATCH | 399 | 03014 | Magnet BOP Oral Powder | 001 | 5,000 | 13.02 |
| PRODUCTIONBATCH | 370 | 01002 | Ammonium chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 370 | 01002 | Ammonium chloride | 0001 | 25 | 277.57 |
| Productions | 370 | 03270 | BOP DCAD Powder | 001 | 500 | 37.25 |
| PACKING | 400 | 00377 | BOP DCAD Powder 25 kg | 0001 | 20 | 1,226.34 |
| PACKINGBATCH | 400 | 02440 | Label BOP DCAD Powder 25 kg | 001 | 20 | 140 |
| PACKINGBATCH | 400 | 03270 | BOP DCAD Powder | 001 | 500 | 37.25 |
| PACKINGBATCH | 400 | 02213 | Bag Bop Red Colour | 0001 | 20 | 155 |
| PRODUCTIONBATCH | 371 | 01003 | Bentonite |  | 0 | 0 |
| Production | 371 | 03164 | Bop SUPPER TOX Powder |  | 0 | 0 |
| PurchasesBatch | 198 | 02282 | Label Bop Supper Gold 25kg |  | 0 | 0 |
| Productions | 413 | 03282 | Bop Super Premix Oral Powder | 0001 | 500 | 68.2 |
| PRODUCTIONBATCH | 413 | 01003 | Bentonite | 001 | 30 | 13 |
| PRODUCTIONBATCH | 413 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 413 | 01015 | DCP (Calcium) | 0001 | 425 | 17 |
| PRODUCTIONBATCH | 413 | 01034 | Magnesium Sulphate | 0001 | 5 | 559.15 |
| PRODUCTIONBATCH | 413 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 413 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 413 | 01060 | Zinc Sulphate | 001 | 1 | 950 |
| PRODUCTIONBATCH | 413 | 01143 | Vitamin B3 | 0001 | 1 | 3,200 |
| Productions | 413 | 03282 | Bop Super Premix Oral Powder | 0001 | 500 | 68.2 |
| PurchasesBatch | 198 | 02458 | Label Bop Super Premix Oral Powder 25 kg | 0001 | 20 | 140 |
| PACKING | 401 | 00394 | Bop Super Premix Oral Powder 25 kg | 0001 | 20 | 2,000 |
| PACKINGBATCH | 401 | 02213 | Bag Bop Red Colour | 0001 | 20 | 155 |
| PACKINGBATCH | 401 | 02458 | Label Bop Super Premix Oral Powder 25 kg | 0001 | 20 | 140 |
| PACKINGBATCH | 401 | 03282 | Bop Super Premix Oral Powder | 0001 | 500 | 68.2 |
| PACKING | 401 | 00394 | Bop Super Premix Oral Powder 25 kg | 0001 | 20 | 2,000 |
| PRODUCTIONBATCH | 381 | 01015 | DCP (Calcium) |  | 0 | 0 |
| PRODUCTIONBATCH | 381 | 01190 | PHOSPHORUS Powder 29% |  | 0 | 0 |
| Production | 381 | 03134 | DCP Powder 29 % |  | 0 | 0 |
| PRODUCTIONBATCH | 372 | 01003 | Bentonite |  | 0 | 0 |
| PRODUCTIONBATCH | 372 | 01016 | DCP (Dana) |  | 0 | 0 |
| Production | 372 | 03046 | Rumicid BOP Oral Powder |  | 0 | 0 |
| Productions | 414 | 03046 | Rumicid BOP Oral Powder | 0001 | 750 | 15.68 |
| PRODUCTIONBATCH | 414 | 01003 | Bentonite | 001 | 7 | 13 |
| PRODUCTIONBATCH | 414 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 414 | 01044 | Sodium Bicarbonate | 001 | 20 | 128 |
| PRODUCTIONBATCH | 414 | 01015 | DCP (Calcium) | 0001 | 300 | 17 |
| Productions | 414 | 03046 | Rumicid BOP Oral Powder | 0001 | 750 | 15.68 |
| PACKING | 402 | 00220 | Rumicid powder 25kg | 0001 | 30 | 591.07 |
| PACKINGBATCH | 402 | 02258 | Label Rumicid 25kg | 0001 | 30 | 44.15 |
| PACKINGBATCH | 402 | 03046 | Rumicid BOP Oral Powder | 0001 | 750 | 15.68 |
| PACKINGBATCH | 402 | 02213 | Bag Bop Red Colour | 0001 | 30 | 155 |
| PACKING | 402 | 00220 | Rumicid powder 25kg | 0001 | 30 | 591.07 |
| PACKING | 403 | 00369 | Febro Meon Spray 120 ML | 0001 | 192 | 202.36 |
| PACKINGBATCH | 403 | 02433 | Tin Febro Meon Spray | 0001 | 192 | 150 |
| PACKINGBATCH | 403 | 03264 | Febro Meon Spray | 001 | 1 | 392.99 |
| PACKINGBATCH | 403 | 03264 | Febro Meon Spray | 170726 | 23 | 420 |
| PACKING | 403 | 00369 | Febro Meon Spray 120 ML | 0001 | 192 | 202.36 |
| PACKING | 404 | 00259 | Garliment-Plus BOP  30ML | 0001 | 692 | 17.95 |
| PACKINGBATCH | 404 | 02314 | Dropper  30ML | 001 | 692 | 13 |
| PACKINGBATCH | 404 | 03010 | Garlimint Plus BOP | 001 | 15 | 163.73 |
| PACKINGBATCH | 404 | 03010 | Garlimint Plus BOP | 170726 | 5 | 163.1 |
| PACKING | 404 | 00259 | Garliment-Plus BOP  30ML | 0001 | 692 | 17.96 |
| PACKING | 405 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 39.02 |
| PACKINGBATCH | 405 | 02010 | Bottle Pet Amber 100ML | 001 | 200 | 8 |
| PACKINGBATCH | 405 | 02224 | S+D Garlimint Plus Liquid 100 ML | 0001 | 200 | 11.5 |
| PACKINGBATCH | 405 | 03010 | Garlimint Plus BOP | 170726 | 20 | 163.1 |
| PACKINGBATCH | 405 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 3 | 213 |
| PACKING | 405 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 39 |
| PACKING | 406 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 8 | 1,389.12 |
| PACKINGBATCH | 406 | 02014 | Plastic Can White 5 Liter | 001 | 8 | 440 |
| PACKINGBATCH | 406 | 02031 | Label Garlimint Plus 5 Liter | 001 | 15 | 40 |
| PACKINGBATCH | 406 | 03010 | Garlimint Plus BOP | 170726 | 40 | 163.1 |
| PACKINGBATCH | 406 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 2 | 235 |
| PACKING | 406 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 8 | 1,389.24 |
| PRODUCTIONBATCH | 375 | 01184 | ARQ | 001 | 2 | 367 |
| Productions | 375 | 03179 | Heaatic Optimizer Liquid | 001 | 20 | 109.37 |
| PACKING | 407 | 00257 | Heaatic-Optimizer 100ML | 0001 | 200 | 29.75 |
| PACKINGBATCH | 407 | 02010 | Bottle Pet Amber 100ML | 001 | 200 | 8 |
| PACKINGBATCH | 407 | 02313 | S+D Heaatic-Optimizer 100ML | 0001 | 200 | 11.5 |
| PACKINGBATCH | 407 | 03179 | Heaatic Optimizer Liquid | 001 | 20 | 70.44 |
| PACKINGBATCH | 407 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 3 | 213 |
| PACKING | 407 | 00257 | Heaatic-Optimizer 100ML | 0001 | 200 | 29.74 |
| PACKING | 408 | 00013 | Kirzan BOP 100ml | 0001 | 400 | 40.59 |
| PACKINGBATCH | 408 | 02009 | Bottle Can White  100ML | 001 | 400 | 20 |
| PACKINGBATCH | 408 | 02019 | S+D Kirzan 100 ML | 0001 | 400 | 11.5 |
| PACKINGBATCH | 408 | 03012 | Kirzan BOP | 001 | 40 | 61.58 |
| PACKINGBATCH | 408 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 5 | 235 |
| PACKING | 408 | 00013 | Kirzan BOP 100ml | 0001 | 400 | 40.6 |
| PACKING | 409 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 400 | 25.06 |
| PACKINGBATCH | 409 | 02010 | Bottle Pet Amber 100ML | 001 | 400 | 8 |
| PACKINGBATCH | 409 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 400 | 12 |
| PACKINGBATCH | 409 | 03165 | Timp-Ex Oral Liquid | 001 | 40 | 23.88 |
| PACKINGBATCH | 409 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 5 | 213 |
| PACKING | 409 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 400 | 25.05 |
| PRODUCTIONBATCH | 378 | 01009 | Copper Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 378 | 01021 | Glacial Acetic Acid |  | 0 | 0 |
| PRODUCTIONBATCH | 378 | 01028 | Lactic Acid |  | 0 | 0 |
| PRODUCTIONBATCH | 378 | 01041 | Sodium Benzoate |  | 0 | 0 |
| PRODUCTIONBATCH | 378 | 01045 | Sorbitol Liquid 70% |  | 0 | 0 |
| PRODUCTIONBATCH | 378 | 01058 | Xanthan Gum |  | 0 | 0 |
| Production | 378 | 03265 | CS Guard 20 Oral Liquid |  | 0 | 0 |
| Productions | 415 | 03018 | Scour Guard | 0001 | 40 | 86.81 |
| PRODUCTIONBATCH | 415 | 01027 | Kaolin | 001 | 6 | 400 |
| PRODUCTIONBATCH | 415 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 415 | 01043 | Sodium Chloride | 001 | 3 | 13.75 |
| PRODUCTIONBATCH | 415 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 415 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 415 | 01073 | Potassium Chloride | 001 | 1 | 400 |
| Productions | 415 | 03018 | Scour Guard | 0001 | 40 | 87.36 |
| PACKING | 410 | 00008 | Scour Guard100ML | 0001 | 400 | 31.38 |
| PACKINGBATCH | 410 | 02020 | S+D Scour Guard100 ML | 0001 | 400 | 12 |
| PACKINGBATCH | 410 | 03018 | Scour Guard | 001 | 40 | 86.8 |
| PACKINGBATCH | 410 | 02010 | Bottle Pet Amber 100ML | 001 | 400 | 8 |
| PACKINGBATCH | 410 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 5 | 213 |
| PACKING | 410 | 00008 | Scour Guard100ML | 0001 | 400 | 31.34 |
| PACKING | 411 | 00030 | Coolper 100gm | 0001 | 900 | 31.26 |
| PACKINGBATCH | 411 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 920 | 17 |
| PACKINGBATCH | 411 | 03118 | BOP Coolper Powder | 001 | 90 | 112.73 |
| PACKINGBATCH | 411 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 10 | 235 |
| PACKING | 411 | 00030 | Coolper 100gm | 0001 | 900 | 31.26 |
| PRODUCTIONBATCH | 380 | 01007 | CSL | 0001 | 10 | 35 |
| Productions | 380 | 03019 | Super Yeast Powder | 001 | 100 | 43.98 |
| PACKING | 412 | 00040 | Super Yeast Powder 25kg | 0001 | 4 | 1,294.48 |
| PACKINGBATCH | 412 | 02042 | Label Super Yeast 25 KG | 0001 | 4 | 40 |
| PACKINGBATCH | 412 | 02213 | Bag Bop Red Colour | 0001 | 4 | 155 |
| PACKINGBATCH | 412 | 03019 | Super Yeast Powder | 001 | 100 | 43.98 |
| Productions | 416 | 03002 | DCP Powder | 0001 | 250 | 11.5 |
| PRODUCTIONBATCH | 416 | 01190 | PHOSPHORUS Powder 29% | 0001 | 250 | 11.5 |
| PACKING | 413 | 00019 | DCP BOP 25kg | 0001 | 10 | 377.5 |
| PACKINGBATCH | 413 | 02034 | BAG BOP DCP 25 KG | 001 | 10 | 100 |
| PACKINGBATCH | 413 | 03002 | DCP Powder | 0001 | 250 | 11.5 |
| PACKING | 413 | 00019 | DCP BOP 25kg | 0001 | 10 | 387.5 |
| PACKING | 414 | 00258 | GrowMore 25KG | 0001 | 10 | 602.27 |
| PACKINGBATCH | 414 | 02312 | Label GrowMore 25KG | 0001 | 10 | 70 |
| PACKINGBATCH | 414 | 03182 | GrowMore Powder | 001 | 250 | 21.29 |
| PACKING | 414 | 00258 | GrowMore 25KG | 0001 | 10 | 602.27 |
| Productions | 417 | 03163 | Calcium 72 | 0001 | 2,500 | 0 |
| PRODUCTIONBATCH | 417 | 01015 | DCP (Calcium) | 0001 | 500 | 17 |
| Productions | 417 | 03163 | Calcium 72 | 0001 | 2,500 | 3.4 |
| PACKING | 415 | 00231 | Calcium 72 25kg | 0001 | 100 | 85 |
| PACKINGBATCH | 415 | 03163 | Calcium 72 | 0001 | 2,500 | 3.4 |
| Productions | 418 | 03001 | Growth Promoter BOP Oral | 0001 | 500 | 17.3 |
| PRODUCTIONBATCH | 418 | 01016 | DCP (Dana) | 0001 | 395 | 10 |
| PRODUCTIONBATCH | 418 | 01042 | Starch | 001 | 6 | 167 |
| PRODUCTIONBATCH | 418 | 01043 | Sodium Chloride | 001 | 100 | 13.75 |
| PRODUCTIONBATCH | 418 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| Productions | 418 | 03001 | Growth Promoter BOP Oral | 0001 | 500 | 17.3 |
| PACKING | 416 | 00016 | Growth Promoter 25kg | 0001 | 20 | 587.6 |
| PACKINGBATCH | 416 | 02032 | BAG Growth Promoter 25 KG | 0001 | 20 | 155 |
| PACKINGBATCH | 416 | 03001 | Growth Promoter BOP Oral | 0001 | 500 | 17.3 |
| PRODUCTIONBATCH | 384 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 384 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| Productions | 384 | 03121 | Bio Adek Liquid | 001 | 40 | 64.88 |
| PACKING | 417 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 8 | 681.78 |
| PACKINGBATCH | 417 | 02014 | Plastic Can White 5 Liter | 001 | 8 | 440 |
| PACKINGBATCH | 417 | 02237 | Label Bio Adeck Liquid 5Lit | 001 | 10 | 40 |
| PACKINGBATCH | 417 | 03121 | Bio Adek Liquid | 001 | 40 | 26.63 |
| PACKINGBATCH | 417 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 2 | 235 |
| PACKING | 417 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 8 | 681.91 |
| PACKING | 418 | 00247 | Ampro-Plus Liquid 5L | 0001 | 8 | 1,194.58 |
| PACKINGBATCH | 418 | 02014 | Plastic Can White 5 Liter | 001 | 8 | 440 |
| PACKINGBATCH | 418 | 02297 | Label Ampro-Plus 5L | 001 | 10 | 40 |
| PACKINGBATCH | 418 | 03176 | Ampro-Plus Liquid | 001 | 40 | 129.19 |
| PACKINGBATCH | 418 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 2 | 235 |
| PACKING | 418 | 00247 | Ampro-Plus Liquid 5L | 0001 | 8 | 1,194.71 |
| PRODUCTIONBATCH | 386 | 01010 | Betaine |  | 0 | 0 |
| PRODUCTIONBATCH | 386 | 01012 | Chocolate Brown Colour |  | 0 | 0 |
| PRODUCTIONBATCH | 386 | 01020 | Formic Acid |  | 0 | 0 |
| PRODUCTIONBATCH | 386 | 01038 | Phosphoric Acid 85% |  | 0 | 0 |
| PRODUCTIONBATCH | 386 | 01058 | Xanthan Gum |  | 0 | 0 |
| PRODUCTIONBATCH | 386 | 01060 | Zinc Sulphate |  | 0 | 0 |
| Production | 386 | 03179 | Heaatic Optimizer Liquid |  | 0 | 0 |
| Productions | 419 | 03011 | Hepatic-Optimizer Liquid | 0001 | 60 | 81.99 |
| PRODUCTIONBATCH | 419 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 419 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 419 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 419 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 419 | 01043 | Sodium Chloride | 001 | 0 | 13.75 |
| PRODUCTIONBATCH | 419 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 419 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 419 | 01184 | ARQ | 001 | 3 | 367 |
| Productions | 419 | 03011 | Hepatic-Optimizer Liquid | 0001 | 60 | 82.07 |
| PACKING | 419 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 12 | 961.84 |
| PACKINGBATCH | 419 | 02014 | Plastic Can White 5 Liter | 001 | 12 | 440 |
| PACKINGBATCH | 419 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 20 | 20 |
| PACKINGBATCH | 419 | 03011 | Hepatic-Optimizer Liquid | 0001 | 60 | 82.07 |
| PACKINGBATCH | 419 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 4 | 235 |
| PACKING | 419 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 12 | 962.01 |
| PRODUCTIONBATCH | 387 | 01033 | Molasses |  | 0 | 0 |
| Production | 387 | 03086 | Super Yeast Liquid |  | 0 | 0 |
| OpeningBatch | 108 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 160 | 5,000 |
| PRODUCTIONBATCH | 388 | 01045 | Sorbitol Liquid 70% |  | 0 | 0 |
| PRODUCTIONBATCH | 388 | 01056 | Vitamin D3 |  | 0 | 0 |
| PRODUCTIONBATCH | 388 | 01058 | Xanthan Gum |  | 0 | 0 |
| PRODUCTIONBATCH | 388 | 01072 | Vitamin E |  | 0 | 0 |
| Production | 388 | 03186 | Bio ESEL 200 Oral Liquid |  | 0 | 0 |
| Productions | 420 | 03120 | E.S 200 Liquid | 0001 | 40 | 55.56 |
| PRODUCTIONBATCH | 420 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 420 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 420 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 1 | 1,549.99 |
| PRODUCTIONBATCH | 420 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 420 | 03120 | E.S 200 Liquid | 0001 | 40 | 55.43 |
| PACKING | 420 | 00266 | E.S  200 liquid 5 Liter | 0001 | 8 | 1,215.76 |
| PACKINGBATCH | 420 | 02014 | Plastic Can White 5 Liter | 001 | 8 | 440 |
| PACKINGBATCH | 420 | 02271 | Label E.S 200 5Lit | 001 | 15 | 40 |
| PACKINGBATCH | 420 | 02271 | Label E.S 200 5Lit | 0001 | 73 | 40 |
| PACKINGBATCH | 420 | 03120 | E.S 200 Liquid | 0001 | 40 | 55.43 |
| PACKINGBATCH | 420 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 2 | 235 |
| PACKING | 420 | 00266 | E.S  200 liquid 5 Liter | 0001 | 8 | 1,215.9 |
| PACKING | 421 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 8 | 1,079.96 |
| PACKINGBATCH | 421 | 02014 | Plastic Can White 5 Liter | 001 | 8 | 440 |
| PACKINGBATCH | 421 | 03241 | Toxin Pro Oral Liquid | 001 | 40 | 110.41 |
| PACKINGBATCH | 421 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 3 | 235 |
| PACKING | 421 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 8 | 1,080.16 |
| PACKING | 422 | 00179 | PROCOPCID Oral Liquid 5 Liter | 0001 | 8 | 1,865.36 |
| PACKINGBATCH | 422 | 02014 | Plastic Can White 5 Liter | 001 | 8 | 440 |
| PACKINGBATCH | 422 | 02201 | Label PROCOPCID Oral Liquid 5 Liter | 001 | 15 | 40 |
| PACKINGBATCH | 422 | 03130 | PROCOPCID Oral Liquid | 001 | 40 | 258.35 |
| PACKINGBATCH | 422 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 2 | 235 |
| PACKING | 422 | 00179 | PROCOPCID Oral Liquid 5 Liter | 0001 | 8 | 1,865.5 |
| PACKING | 423 | 00180 | Stable C 20 (5 Liter) | 0001 | 12 | 1,378.16 |
| PACKINGBATCH | 423 | 02014 | Plastic Can White 5 Liter | 001 | 12 | 440 |
| PACKINGBATCH | 423 | 02272 | Label Stable C20  5Lit | 001 | 16 | 40 |
| PACKINGBATCH | 423 | 03119 | Stable C 20 Liquid | 001 | 60 | 161.34 |
| PACKINGBATCH | 423 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 4 | 235 |
| PACKING | 423 | 00180 | Stable C 20 (5 Liter) | 0001 | 12 | 1,378.34 |
| PRODUCTIONBATCH | 394 | 01007 | CSL | 0001 | 20 | 35 |
| Productions | 394 | 03144 | Yeast Plus Powder | 001 | 100 | 47.53 |
| PACKING | 424 | 00199 | Yeast Plus Powder 25 kg | 0001 | 4 | 1,455.18 |
| PACKINGBATCH | 424 | 02213 | Bag Bop Red Colour | 0001 | 4 | 155 |
| PACKINGBATCH | 424 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 4 | 40 |
| PACKINGBATCH | 424 | 03144 | Yeast Plus Powder | 001 | 100 | 50.41 |
| PACKING | 424 | 00199 | Yeast Plus Powder 25 kg | 0001 | 4 | 1,455.18 |
| PACKING | 425 | 00163 | Mento Respi Liquid 5 Lit | 001 | 4 | 1,642.57 |
| PACKINGBATCH | 425 | 02014 | Plastic Can White 5 Liter | 001 | 4 | 440 |
| PACKINGBATCH | 425 | 02357 | Label Mento Respi Oral Liquid 5 Lit | 001 | 15 | 40 |
| PACKINGBATCH | 425 | 03116 | Mento Respi Liquid | 001 | 20 | 210.52 |
| PACKING | 425 | 00163 | Mento Respi Liquid 5 Lit | 001 | 4 | 1,642.59 |
| PRODUCTIONBATCH | 396 | 01016 | DCP (Dana) |  | 0 | 0 |
| PRODUCTIONBATCH | 396 | 01016 | DCP (Dana) | 0001 | 10 | 10 |
| Productions | 396 | 03147 | Hepatic Optimizer fort Powder | 001 | 100 | 86.55 |
| PACKING | 426 | 00209 | Hepatic Optimizer fort Powder 25kg | 0001 | 4 | 2,528.7 |
| PACKINGBATCH | 426 | 02234 | Label Hepatic Optimizer fort 25kg | 0001 | 6 | 140 |
| PACKINGBATCH | 426 | 03147 | Hepatic Optimizer fort Powder | 001 | 100 | 86.55 |
| PACKINGBATCH | 426 | 02213 | Bag Bop Red Colour | 0001 | 4 | 155 |
| PACKING | 426 | 00209 | Hepatic Optimizer fort Powder 25kg | 0001 | 4 | 2,528.7 |
| Productions | 421 | 03001 | Growth Promoter BOP Oral | 0001 | 500 | 0 |
| PRODUCTIONBATCH | 421 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 421 | 01042 | Starch | 001 | 1 | 167 |
| PRODUCTIONBATCH | 421 | 01042 | Starch | 0001 | 4 | 168.72 |
| PRODUCTIONBATCH | 421 | 01043 | Sodium Chloride | 001 | 100 | 13.75 |
| PRODUCTIONBATCH | 421 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| Productions | 421 | 03001 | Growth Promoter BOP Oral | 0001 | 500 | 17.42 |
| PACKING | 427 | 00016 | Growth Promoter 25kg | 0001 | 20 | 590.49 |
| PACKINGBATCH | 427 | 02032 | BAG Growth Promoter 25 KG | 0001 | 20 | 155 |
| PACKINGBATCH | 427 | 03001 | Growth Promoter BOP Oral | 0001 | 500 | 17.42 |
| PACKING | 427 | 00016 | Growth Promoter 25kg | 0001 | 20 | 590.49 |
| PACKING | 428 | 00008 | Scour Guard100ML | 0001 | 600 | 32.2 |
| PACKINGBATCH | 428 | 02020 | S+D Scour Guard100 ML | 0001 | 630 | 12 |
| PACKINGBATCH | 428 | 03018 | Scour Guard | 001 | 20 | 86.8 |
| PACKINGBATCH | 428 | 03018 | Scour Guard | 0001 | 40 | 87.36 |
| PACKINGBATCH | 428 | 02010 | Bottle Pet Amber 100ML | 001 | 630 | 8 |
| PACKINGBATCH | 428 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 7 | 213 |
| PACKING | 428 | 00008 | Scour Guard100ML | 0001 | 600 | 32.2 |
| PACKING | 429 | 00262 | Magnet 100gm | 0001 | 300 | 13.15 |
| PACKINGBATCH | 429 | 02319 | Packet Magnet 100 gm | 0001 | 300 | 9.5 |
| PACKINGBATCH | 429 | 03014 | Magnet BOP Oral Powder | 001 | 30 | 13.02 |
| PACKINGBATCH | 429 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 3 | 235 |
| PACKING | 429 | 00262 | Magnet 100gm | 0001 | 300 | 13.15 |
| PACKING | 430 | 00022 | Magnet BOP 25kg | 0001 | 4 | 325.57 |
| PACKINGBATCH | 430 | 03014 | Magnet BOP Oral Powder | 001 | 100 | 13.02 |
| PACKING | 430 | 00022 | Magnet BOP 25kg | 0001 | 4 | 325.57 |
| PACKING | 431 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 35.27 |
| PACKINGBATCH | 431 | 02010 | Bottle Pet Amber 100ML | 001 | 200 | 8 |
| PACKINGBATCH | 431 | 02224 | S+D Garlimint Plus Liquid 100 ML | 0001 | 200 | 11.5 |
| PACKINGBATCH | 431 | 03010 | Garlimint Plus BOP | 170726 | 15 | 163.1 |
| PACKINGBATCH | 431 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 3 | 213 |
| PACKING | 431 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 35.25 |
| Productions | 422 | 03003 | Calci-Phos-D | 0001 | 34 | 0 |
| PRODUCTIONBATCH | 422 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 422 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 422 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 422 | 01043 | Sodium Chloride | 001 | 0 | 13.75 |
| PRODUCTIONBATCH | 422 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 422 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 422 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 422 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 422 | 03003 | Calci-Phos-D | 0001 | 34 | 34.49 |
| PACKING | 432 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 26.39 |
| PACKINGBATCH | 432 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 100 | 12 |
| PACKINGBATCH | 432 | 03003 | Calci-Phos-D | 0001 | 10 | 34.49 |
| PACKINGBATCH | 432 | 02010 | Bottle Pet Amber 100ML | 001 | 110 | 8 |
| PACKINGBATCH | 432 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 1 | 213 |
| PACKING | 432 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 26.38 |
| PACKING | 433 | 00032 | Calci-Phos-D 1000ml | 0001 | 24 | 286.99 |
| PACKINGBATCH | 433 | 02097 | Bottle Round liter | 001 | 24 | 230 |
| PACKINGBATCH | 433 | 02385 | Label Calci Phos D 1 Lit | 001 | 30 | 18 |
| PACKINGBATCH | 433 | 03003 | Calci-Phos-D | 0001 | 24 | 34.49 |
| PACKING | 433 | 00032 | Calci-Phos-D 1000ml | 0001 | 24 | 286.99 |
| PACKING | 434 | 00013 | Kirzan BOP 100ml | 0001 | 100 | 40 |
| PACKINGBATCH | 434 | 02009 | Bottle Can White  100ML | 001 | 100 | 20 |
| PACKINGBATCH | 434 | 02019 | S+D Kirzan 100 ML | 0001 | 100 | 11.5 |
| PACKINGBATCH | 434 | 03012 | Kirzan BOP | 001 | 10 | 61.58 |
| PACKINGBATCH | 434 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 1 | 235 |
| PACKING | 434 | 00013 | Kirzan BOP 100ml | 0001 | 100 | 40.01 |
| Productions | 423 | 03011 | Hepatic-Optimizer Liquid | 0001 | 300 | 0 |
| PRODUCTIONBATCH | 423 | 01010 | Betaine | 0001 | 4 | 2,800 |
| PRODUCTIONBATCH | 423 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 423 | 01013 | Calcium Chloride | 001 | 4 | 220 |
| PRODUCTIONBATCH | 423 | 01038 | Phosphoric Acid 85% | 001 | 4 | 650 |
| PRODUCTIONBATCH | 423 | 01043 | Sodium Chloride | 001 | 1 | 13.75 |
| PRODUCTIONBATCH | 423 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 423 | 01184 | ARQ | 001 | 15 | 367 |
| Productions | 423 | 03011 | Hepatic-Optimizer Liquid | 0001 | 300 | 74.82 |
| PACKING | 435 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 60 | 984.4 |
| PACKINGBATCH | 435 | 02014 | Plastic Can White 5 Liter | 001 | 70 | 440 |
| PACKINGBATCH | 435 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 80 | 20 |
| PACKINGBATCH | 435 | 03011 | Hepatic-Optimizer Liquid | 0001 | 300 | 74.82 |
| PACKINGBATCH | 435 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 18 | 235 |
| PACKING | 435 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 60 | 984.59 |
| PACKING | 436 | 00257 | Heaatic-Optimizer 100ML | 0001 | 100 | 58.53 |
| PACKINGBATCH | 436 | 02010 | Bottle Pet Amber 100ML | 001 | 100 | 8 |
| PACKINGBATCH | 436 | 02313 | S+D Heaatic-Optimizer 100ML | 0001 | 100 | 11.5 |
| PACKINGBATCH | 436 | 03179 | Heaatic Optimizer Liquid | 001 | 10 | 347.48 |
| PACKINGBATCH | 436 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 2 | 213 |
| PACKING | 436 | 00257 | Heaatic-Optimizer 100ML | 0001 | 100 | 58.51 |
| PACKING | 437 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 20 | 713.46 |
| PACKINGBATCH | 437 | 02014 | Plastic Can White 5 Liter | 001 | 5 | 440 |
| PACKINGBATCH | 437 | 02014 | Plastic Can White 5 Liter | 0001 | 15 | 439.97 |
| PACKINGBATCH | 437 | 02237 | Label Bio Adeck Liquid 5Lit | 001 | 35 | 40 |
| PACKINGBATCH | 437 | 03121 | Bio Adek Liquid | 001 | 100 | 26.63 |
| PACKINGBATCH | 437 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 6 | 235 |
| PACKING | 437 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 20 | 713.64 |
| PACKING | 438 | 00247 | Ampro-Plus Liquid 5L | 0001 | 40 | 1,216.23 |
| PACKINGBATCH | 438 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 439.97 |
| PACKINGBATCH | 438 | 02297 | Label Ampro-Plus 5L | 001 | 60 | 40 |
| PACKINGBATCH | 438 | 03176 | Ampro-Plus Liquid | 001 | 200 | 129.19 |
| PACKINGBATCH | 438 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 12 | 235 |
| PACKING | 438 | 00247 | Ampro-Plus Liquid 5L | 0001 | 40 | 1,216.43 |
| Productions | 424 | 03279 | Tox Go Vital Oral Liquid | 0001 | 100 | 0 |
| PRODUCTIONBATCH | 424 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 424 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 424 | 01020 | Formic Acid | 001 | 0 | 312 |
| PRODUCTIONBATCH | 424 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 424 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 424 | 01046 | Silmyrin | 0001 | 1 | 13,130.73 |
| PRODUCTIONBATCH | 424 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 424 | 01184 | ARQ | 001 | 10 | 367 |
| Productions | 424 | 03279 | Tox Go Vital Oral Liquid | 0001 | 100 | 273.64 |
| PACKING | 439 | 00390 | Tox Go Vital Oral Liquid 5 Lit | 0001 | 20 | 2,066.74 |
| PACKINGBATCH | 439 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 439.97 |
| PACKINGBATCH | 439 | 02454 | Label Tox Go Vital Oral Liquid 5 Lit | 001 | 50 | 80 |
| PACKINGBATCH | 439 | 03279 | Tox Go Vital Oral Liquid | 0001 | 100 | 273.64 |
| PACKINGBATCH | 439 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 5 | 235 |
| PACKING | 439 | 00390 | Tox Go Vital Oral Liquid 5 Lit | 0001 | 20 | 2,066.92 |
| Productions | 425 | 03280 | Promune 35 Oral Liquid | 0001 | 200 | 77.33 |
| PRODUCTIONBATCH | 425 | 01023 | Garlic Oil | 0001 | 2 | 7,043.77 |
| PRODUCTIONBATCH | 425 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 425 | 01045 | Sorbitol Liquid 70% | 001 | 2 | 350 |
| PRODUCTIONBATCH | 425 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| Productions | 425 | 03280 | Promune 35 Oral Liquid | 0001 | 200 | 76.8 |
| PACKING | 440 | 00391 | Promune 35 Oral Liquid 5 Lit | 0001 | 40 | 1,049.23 |
| PACKINGBATCH | 440 | 02014 | Plastic Can White 5 Liter | 0001 | 45 | 439.97 |
| PACKINGBATCH | 440 | 02455 | Label Promune 35 Oral Liquid 5 Lit | 001 | 50 | 80 |
| PACKINGBATCH | 440 | 03280 | Promune 35 Oral Liquid | 0001 | 200 | 76.8 |
| PACKINGBATCH | 440 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 12 | 235 |
| PACKING | 440 | 00391 | Promune 35 Oral Liquid 5 Lit | 0001 | 40 | 1,049.45 |
| Productions | 426 | 03277 | Copper lac oral liquid | 0001 | 60 | 252.95 |
| PRODUCTIONBATCH | 426 | 01009 | Copper Sulphate | 001 | 6 | 2,200 |
| PRODUCTIONBATCH | 426 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 426 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 426 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| Productions | 426 | 03277 | Copper lac oral liquid | 0001 | 60 | 252.79 |
| PACKING | 441 | 00388 | Copper lac oral liquid 1L | 0001 | 60 | 529.46 |
| PACKINGBATCH | 441 | 02097 | Bottle Round liter | 001 | 60 | 230 |
| PACKINGBATCH | 441 | 02452 | Label Copper lac oral liquid 1L | 001 | 70 | 40 |
| PACKINGBATCH | 441 | 03277 | Copper lac oral liquid | 0001 | 60 | 252.79 |
| Productions | 427 | 03278 | Copper Lac plus Oral Liquid | 0001 | 60 | 247.15 |
| PRODUCTIONBATCH | 427 | 01009 | Copper Sulphate | 001 | 6 | 2,200 |
| PRODUCTIONBATCH | 427 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 427 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| Productions | 427 | 03278 | Copper Lac plus Oral Liquid | 0001 | 60 | 246.99 |
| PACKING | 442 | 00389 | Copper Lac plus Oral Liquid 1L | 0001 | 60 | 523.66 |
| PACKINGBATCH | 442 | 02097 | Bottle Round liter | 001 | 60 | 230 |
| PACKINGBATCH | 442 | 02453 | Label Copper Lac plus Oral Liquid 1L | 001 | 70 | 40 |
| PACKINGBATCH | 442 | 03278 | Copper Lac plus Oral Liquid | 0001 | 60 | 246.99 |
| Productions | 428 | 03276 | Brosteine 15 Oral Liquid | 0001 | 60 | 79.91 |
| PRODUCTIONBATCH | 428 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 428 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 428 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 428 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 428 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| Productions | 428 | 03276 | Brosteine 15 Oral Liquid | 0001 | 60 | 81.95 |
| PurchasesBatch | 217 | 02451 | Label Brosteine 15 Oral Liquid 5 LIT |  | 0 | 0 |
| PurchasesBatch | 217 | 02459 | Label Brosteine Oral Liquid 1 Lit | 0001 | 70 | 40 |
| PACKING | 443 | 00395 | Brosteine Oral Liquid 1 Lit | 0001 | 60 | 358.62 |
| PACKINGBATCH | 443 | 02097 | Bottle Round liter | 001 | 60 | 230 |
| PACKINGBATCH | 443 | 02459 | Label Brosteine Oral Liquid 1 Lit | 0001 | 70 | 40 |
| PACKINGBATCH | 443 | 03276 | Brosteine 15 Oral Liquid | 0001 | 60 | 81.95 |
| PACKING | 443 | 00395 | Brosteine Oral Liquid 1 Lit | 0001 | 60 | 358.62 |
| PurchasesBatch | 224 | 02014 | Plastic Can White 5 Liter | 0001 | 204 | 440 |
| PurchasesBatch | 225 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 39 | 227 |
| Productions | 429 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 54.52 |
| PRODUCTIONBATCH | 429 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 429 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 429 | 01020 | Formic Acid | 0001 | 25 | 350 |
| PRODUCTIONBATCH | 429 | 01041 | Sodium Benzoate | 001 | 2 | 560 |
| PRODUCTIONBATCH | 429 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 429 | 01184 | ARQ | 001 | 10 | 367 |
| PRODUCTIONBATCH | 429 | 01184 | ARQ | 0001 | 9 | 366.67 |
| Productions | 429 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 54.34 |
| PACKING | 444 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 845.89 |
| PACKINGBATCH | 444 | 02014 | Plastic Can White 5 Liter | 0001 | 110 | 439.98 |
| PACKINGBATCH | 444 | 02026 | Label Toxi Lic 5 Liter | 0001 | 140 | 18 |
| PACKINGBATCH | 444 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 54.34 |
| PACKINGBATCH | 444 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 001 | 20 | 235 |
| PACKINGBATCH | 444 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 231.59 |
| PACKING | 444 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 846.43 |
| Productions | 430 | 03106 | Calpho Lic Liquid | 0001 | 100 | 148.79 |
| PRODUCTIONBATCH | 430 | 01013 | Calcium Chloride | 001 | 1 | 220 |
| PRODUCTIONBATCH | 430 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 430 | 01038 | Phosphoric Acid 85% | 001 | 20 | 650 |
| PRODUCTIONBATCH | 430 | 01043 | Sodium Chloride | 001 | 0 | 13.75 |
| PRODUCTIONBATCH | 430 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 430 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 430 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 430 | 03106 | Calpho Lic Liquid | 0001 | 100 | 148.86 |
| PACKING | 445 | 00150 | Calpho Lic Liquid 5 Lit | 0001 | 20 | 1,313.78 |
| PACKINGBATCH | 445 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 439.98 |
| PACKINGBATCH | 445 | 02163 | Label Calpho Lic Liquid 5 Lit | 001 | 30 | 40 |
| PACKINGBATCH | 445 | 03106 | Calpho Lic Liquid | 0001 | 100 | 148.86 |
| PACKINGBATCH | 445 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 231.59 |
| PACKING | 445 | 00150 | Calpho Lic Liquid 5 Lit | 0001 | 20 | 1,313.78 |
| Productions | 431 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 116.82 |
| PRODUCTIONBATCH | 431 | 01009 | Copper Sulphate | 001 | 1 | 2,200 |
| PRODUCTIONBATCH | 431 | 01020 | Formic Acid | 0001 | 100 | 350 |
| PRODUCTIONBATCH | 431 | 01028 | Lactic Acid | 0001 | 2 | 1,650 |
| PRODUCTIONBATCH | 431 | 01038 | Phosphoric Acid 85% | 001 | 20 | 650 |
| PRODUCTIONBATCH | 431 | 01186 | HCL | 001 | 15 | 70 |
| PRODUCTIONBATCH | 431 | 01187 | Sodium Metaby Sulphate | 0001 | 5 | 387.09 |
| Productions | 431 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 116.82 |
| PACKING | 446 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 4,075.97 |
| PACKINGBATCH | 446 | 02128 | White Can 25 Liter | 0001 | 20 | 1,065.44 |
| PACKINGBATCH | 446 | 02146 | Label Acidi-Lic 25 Lit | 001 | 20 | 90 |
| PACKINGBATCH | 446 | 03097 | Acidi-Lic Liquid | 0001 | 500 | 116.82 |
| PACKING | 446 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 4,075.97 |
| Productions | 432 | 03054 | Bio Ambrox  Liquid | 0001 | 120 | 44.7 |
| PRODUCTIONBATCH | 432 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 432 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| Productions | 432 | 03054 | Bio Ambrox  Liquid | 0001 | 120 | 46.03 |
| PACKING | 447 | 00138 | Bio Ambrox 5Lit | 0001 | 24 | 737.68 |
| PACKINGBATCH | 447 | 02014 | Plastic Can White 5 Liter | 0001 | 24 | 439.98 |
| PACKINGBATCH | 447 | 03054 | Bio Ambrox  Liquid | 0001 | 120 | 46.03 |
| PACKINGBATCH | 447 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 7 | 231.59 |
| PACKING | 447 | 00138 | Bio Ambrox 5Lit | 0001 | 24 | 737.68 |
| Productions | 433 | 03261 | Leo Cid Pro | 0001 | 250 | 56.11 |
| PRODUCTIONBATCH | 433 | 01009 | Copper Sulphate | 001 | 2 | 2,200 |
| PRODUCTIONBATCH | 433 | 01020 | Formic Acid | 0001 | 10 | 350 |
| PRODUCTIONBATCH | 433 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 433 | 01038 | Phosphoric Acid 85% | 001 | 5 | 650 |
| PRODUCTIONBATCH | 433 | 01186 | HCL | 001 | 7 | 70 |
| PRODUCTIONBATCH | 433 | 01187 | Sodium Metaby Sulphate | 0001 | 0 | 387.09 |
| Productions | 433 | 03261 | Leo Cid Pro | 0001 | 250 | 56.11 |
| PACKING | 448 | 00365 | Leo Cid Pro 25 Lit | 0001 | 10 | 2,508.23 |
| PACKINGBATCH | 448 | 02128 | White Can 25 Liter | 0001 | 10 | 1,065.44 |
| PACKINGBATCH | 448 | 02428 | Label Leo Cid Pro 25 Lit | 001 | 10 | 40 |
| PACKINGBATCH | 448 | 03261 | Leo Cid Pro | 0001 | 250 | 56.11 |
| PACKING | 448 | 00365 | Leo Cid Pro 25 Lit | 0001 | 10 | 2,508.23 |
| Productions | 434 | 03260 | Leo Viton Oral Liquid | 0001 | 60 | 52.31 |
| PRODUCTIONBATCH | 434 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 434 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 434 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 434 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 434 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| Productions | 434 | 03260 | Leo Viton Oral Liquid | 0001 | 60 | 51.6 |
| PACKING | 449 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 12 | 841.84 |
| PACKINGBATCH | 449 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 439.98 |
| PACKINGBATCH | 449 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 001 | 20 | 40 |
| PACKINGBATCH | 449 | 03260 | Leo Viton Oral Liquid | 0001 | 60 | 51.6 |
| PACKINGBATCH | 449 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 231.59 |
| PACKING | 449 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 12 | 841.84 |
| Productions | 435 | 03256 | Leo Adsorbo Oral Liquid | 0001 | 60 | 63.16 |
| PRODUCTIONBATCH | 435 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 435 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 435 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 435 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 435 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 435 | 01184 | ARQ | 0001 | 3 | 366.67 |
| Productions | 435 | 03256 | Leo Adsorbo Oral Liquid | 0001 | 60 | 62.98 |
| PACKING | 450 | 00360 | Leo Adsorbo Oral Liquid 5 Lit | 0001 | 12 | 898.77 |
| PACKINGBATCH | 450 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 439.98 |
| PACKINGBATCH | 450 | 02423 | Label Leo Adsorbo Oral Liquid 5 Lit | 001 | 20 | 40 |
| PACKINGBATCH | 450 | 03256 | Leo Adsorbo Oral Liquid | 0001 | 60 | 62.98 |
| PACKINGBATCH | 450 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 231.59 |
| PACKING | 450 | 00360 | Leo Adsorbo Oral Liquid 5 Lit | 0001 | 12 | 898.77 |
| Productions | 436 | 03269 | Leo Flush Oral Liquid | 0001 | 60 | 142.11 |
| PRODUCTIONBATCH | 436 | 01002 | Ammonium chloride | 0001 | 6 | 277.57 |
| PRODUCTIONBATCH | 436 | 01034 | Magnesium Sulphate | 0001 | 1 | 559.15 |
| PRODUCTIONBATCH | 436 | 01044 | Sodium Bicarbonate | 001 | 1 | 128 |
| PRODUCTIONBATCH | 436 | 01045 | Sorbitol Liquid 70% | 001 | 3 | 350 |
| PRODUCTIONBATCH | 436 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 3 | 1,549.99 |
| PRODUCTIONBATCH | 436 | 01073 | Potassium Chloride | 001 | 0 | 400 |
| Productions | 436 | 03269 | Leo Flush Oral Liquid | 0001 | 60 | 140.34 |
| PACKING | 451 | 00376 | Leo Flush Oral Liquid 5 Lit | 0001 | 12 | 1,285.52 |
| PACKINGBATCH | 451 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 439.98 |
| PACKINGBATCH | 451 | 02439 | Label Leo Flush Oral Liquid 5 Lit | 001 | 20 | 40 |
| PACKINGBATCH | 451 | 03269 | Leo Flush Oral Liquid | 0001 | 60 | 140.34 |
| PACKINGBATCH | 451 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 4 | 231.59 |
| PACKING | 451 | 00376 | Leo Flush Oral Liquid 5 Lit | 0001 | 12 | 1,285.52 |
| Productions | 437 | 03104 | BOP PH 5 Liquid | 0001 | 625 | 14.31 |
| PRODUCTIONBATCH | 437 | 01009 | Copper Sulphate | 001 | 3 | 2,200 |
| PRODUCTIONBATCH | 437 | 01020 | Formic Acid | 0001 | 5 | 350 |
| PRODUCTIONBATCH | 437 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 437 | 03104 | BOP PH 5 Liquid | 0001 | 625 | 14.31 |
| PACKING | 452 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 25 | 1,471.19 |
| PACKINGBATCH | 452 | 02128 | White Can 25 Liter | 0001 | 25 | 1,065.44 |
| PACKINGBATCH | 452 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 30 | 40 |
| PACKINGBATCH | 452 | 03104 | BOP PH 5 Liquid | 0001 | 625 | 14.31 |
| PACKING | 452 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 25 | 1,471.19 |
| Productions | 438 | 03002 | DCP Powder | 0001 | 1,000 | 11.5 |
| PRODUCTIONBATCH | 438 | 01190 | PHOSPHORUS Powder 29% | 0001 | 1,000 | 11.5 |
| PACKING | 453 | 00019 | DCP BOP 25kg | 0001 | 40 | 377.5 |
| PACKINGBATCH | 453 | 02034 | BAG BOP DCP 25 KG | 001 | 40 | 100 |
| PACKINGBATCH | 453 | 03002 | DCP Powder | 0001 | 1,000 | 11.5 |
| PACKING | 453 | 00019 | DCP BOP 25kg | 0001 | 40 | 387.5 |
| Productions | 439 | 03136 | BOP Livercare powder | 0001 | 500 | 33.9 |
| PRODUCTIONBATCH | 439 | 01003 | Bentonite | 001 | 400 | 13 |
| PRODUCTIONBATCH | 439 | 01059 | Wheat Bran | 0001 | 150 | 72.45 |
| PRODUCTIONBATCH | 439 | 01015 | DCP (Calcium) | 0001 | 50 | 17 |
| Productions | 439 | 03136 | BOP Livercare powder | 0001 | 500 | 33.83 |
| PACKING | 454 | 00191 | BOP LIVERCARE Powder 25 KG | 0001 | 20 | 985.86 |
| PACKINGBATCH | 454 | 02214 | Label Bop Livercare 25 kg | 001 | 20 | 140 |
| PACKINGBATCH | 454 | 03136 | BOP Livercare powder | 0001 | 500 | 33.83 |
| PACKING | 454 | 00191 | BOP LIVERCARE Powder 25 KG | 0001 | 20 | 985.86 |
| Productions | 440 | 03244 | BOP Nutramin Forte | 0001 | 1,250 | 15.12 |
| PRODUCTIONBATCH | 440 | 01015 | DCP (Calcium) | 0001 | 300 | 17 |
| PRODUCTIONBATCH | 440 | 01143 | Vitamin B3 | 0001 | 1 | 3,200 |
| PRODUCTIONBATCH | 440 | 01016 | DCP (Dana) | 0001 | 900 | 10 |
| PACKING | 455 | 00343 | BOP Nutramin Forte 25 KG | 0001 | 50 | 378 |
| PACKINGBATCH | 455 | 03244 | BOP Nutramin Forte | 0001 | 1,250 | 15.12 |
| PurchasesBatch | 226 | 01044 | Sodium Bicarbonate | 0001 | 50 | 128 |
| PurchasesBatch | 227 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 150 | 350 |
| PurchasesBatch | 228 | 02126 | Label Golden Premix 25Kg | 0001 | 40 | 140 |
| Productions | 441 | 03087 | Golden Premix Bop | 0001 | 2,950 | 21.05 |
| PRODUCTIONBATCH | 441 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 441 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 441 | 01016 | DCP (Dana) | 0001 | 2,360 | 10 |
| PRODUCTIONBATCH | 441 | 01043 | Sodium Chloride | 001 | 590 | 13.75 |
| PRODUCTIONBATCH | 441 | 01050 | Tartrazine Yellow Color Indian | 001 | 3 | 3,100 |
| PRODUCTIONBATCH | 441 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 441 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 441 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 441 | 01143 | Vitamin B3 | 0001 | 1 | 3,200 |
| Productions | 441 | 03087 | Golden Premix Bop | 0001 | 2,950 | 21.06 |
| PACKING | 456 | 00125 | Golden Premix 25Kg | 0001 | 40 | 633.27 |
| PACKINGBATCH | 456 | 02126 | Label Golden Premix 25Kg | 0001 | 38 | 140 |
| PACKINGBATCH | 456 | 03087 | Golden Premix Bop | 0001 | 950 | 21.06 |
| PACKING | 456 | 00125 | Golden Premix 25Kg | 0001 | 40 | 633.27 |
| PACKING | 457 | 00126 | Golden Premix 1 Kg | 0001 | 2,000 | 56.96 |
| PACKINGBATCH | 457 | 02125 | Packet Golden Premix 1Kg | 001 | 2,000 | 33 |
| PACKINGBATCH | 457 | 03087 | Golden Premix Bop | 0001 | 2,000 | 21.06 |
| PACKINGBATCH | 457 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 231.59 |
| Productions | 442 | 03182 | GrowMore Powder | 001 | 500 | 19.61 |
| PRODUCTIONBATCH | 442 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 442 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 442 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 442 | 01043 | Sodium Chloride | 001 | 96 | 13.75 |
| PRODUCTIONBATCH | 442 | 01043 | Sodium Chloride | 0001 | 3 | 13.75 |
| PRODUCTIONBATCH | 442 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 442 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 442 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 442 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 442 | 03182 | GrowMore Powder | 001 | 500 | 19.61 |
| PACKING | 458 | 00265 | GrowMore 1Kg | 0001 | 500 | 58.88 |
| PACKINGBATCH | 458 | 02315 | Packet GrowMore 1KG | 0001 | 500 | 30 |
| PACKINGBATCH | 458 | 03182 | GrowMore Powder | 001 | 500 | 19.61 |
| PACKINGBATCH | 458 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 20 | 231.59 |
| Productions | 443 | 03014 | Magnet BOP Oral Powder | 0001 | 1,625 | 13.05 |
| PRODUCTIONBATCH | 443 | 01003 | Bentonite | 001 | 135 | 13 |
| PRODUCTIONBATCH | 443 | 01003 | Bentonite | 0001 | 1,489 | 13.1 |
| Productions | 443 | 03014 | Magnet BOP Oral Powder | 0001 | 1,625 | 13.09 |
| PACKING | 459 | 00262 | Magnet 100gm | 0001 | 100 | 22.39 |
| PACKINGBATCH | 459 | 02319 | Packet Magnet 100 gm | 0001 | 100 | 9.5 |
| PACKINGBATCH | 459 | 03014 | Magnet BOP Oral Powder | 0001 | 10 | 13.09 |
| PACKINGBATCH | 459 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 231.59 |
| PACKING | 459 | 00262 | Magnet 100gm | 0001 | 100 | 22.39 |
| PACKING | 460 | 00022 | Magnet BOP 25kg | 0001 | 62 | 327.3 |
| PACKINGBATCH | 460 | 03014 | Magnet BOP Oral Powder | 0001 | 1,550 | 13.09 |
| Productions | 444 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,750 | 10.13 |
| PRODUCTIONBATCH | 444 | 01003 | Bentonite | 0001 | 17 | 13.1 |
| PRODUCTIONBATCH | 444 | 01016 | DCP (Dana) | 0001 | 1,750 | 10 |
| PACKING | 461 | 00220 | Rumicid powder 25kg | 0001 | 70 | 297.43 |
| PACKINGBATCH | 461 | 02258 | Label Rumicid 25kg | 0001 | 70 | 44.15 |
| PACKINGBATCH | 461 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,750 | 10.13 |
| PACKING | 461 | 00220 | Rumicid powder 25kg | 0001 | 70 | 297.43 |
| Productions | 445 | 03264 | Febro Meon Spray | 0001 | 57 | 427.18 |
| PRODUCTIONBATCH | 445 | 01065 | Spt Amm. Aromatic | 0001 | 57 | 265 |
| PRODUCTIONBATCH | 445 | 01075 | Peppermint Oil | 001 | 0 | 5,000 |
| PRODUCTIONBATCH | 445 | 01189 | Glycerine | 001 | 11 | 650 |
| Productions | 445 | 03264 | Febro Meon Spray | 0001 | 57 | 420 |
| PACKING | 462 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 150 |
| PACKINGBATCH | 462 | 02433 | Tin Febro Meon Spray | 0001 | 480 | 150 |
| Productions | 446 | 03002 | DCP Powder | 0001 | 1,000 | 11.5 |
| PRODUCTIONBATCH | 446 | 01190 | PHOSPHORUS Powder 29% | 0001 | 1,000 | 11.5 |
| PACKING | 463 | 00019 | DCP BOP 25kg | 0001 | 40 | 377.5 |
| PACKINGBATCH | 463 | 02034 | BAG BOP DCP 25 KG | 001 | 40 | 100 |
| PACKINGBATCH | 463 | 03002 | DCP Powder | 0001 | 1,000 | 11.5 |
| PACKING | 463 | 00019 | DCP BOP 25kg | 0001 | 40 | 387.5 |
| Productions | 447 | 03163 | Calcium 72 | 0001 | 125 | 10 |
| PRODUCTIONBATCH | 447 | 01016 | DCP (Dana) | 0001 | 125 | 10 |
| PRODUCTIONBATCH | 447 | 01016 | DCP (Dana) |  | 0 | 0 |
| Production | 447 | 03163 | Calcium 72 |  | 0 | 0 |
| Productions | 447 | 03163 | Calcium 72 | 220726 | 1 | 2,000 |
| PRODUCTIONBATCH | 447 | 01016 | DCP (Dana) | 0001 | 200 | 10 |
| Productions | 447 | 03163 | Calcium 72 | 0001 | 200 | 10 |
| PACKING | 464 | 00231 | Calcium 72 25kg | 0001 | 8 | 250 |
| PACKINGBATCH | 464 | 03163 | Calcium 72 | 0001 | 200 | 10 |
| PurchasesBatch | 229 | 01044 | Sodium Bicarbonate | 0001 | 25 | 128 |
| PurchasesBatch | 230 | 02091 | Label Immune Forte 1 Lit | 0001 | 64 | 40 |
| PurchasesBatch | 230 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 15 | 40 |
| PurchasesBatch | 230 | 02031 | Label Garlimint Plus 5 Liter | 0001 | 30 | 40 |
| PurchasesBatch | 230 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 55 | 80 |
| Productions | 448 | 03014 | Magnet BOP Oral Powder | 0001 | 750 | 13.1 |
| PRODUCTIONBATCH | 448 | 01003 | Bentonite | 0001 | 750 | 13.1 |
| Productions | 449 | 03003 | Calci-Phos-D | 0001 | 120 | 0 |
| PRODUCTIONBATCH | 449 | 01013 | Calcium Chloride | 001 | 1 | 220 |
| PRODUCTIONBATCH | 449 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 449 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 449 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 449 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 449 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 449 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 449 | 03003 | Calci-Phos-D | 0001 | 120 | 27.24 |
| PACKING | 465 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 286.81 |
| PACKINGBATCH | 465 | 02097 | Bottle Round liter | 001 | 120 | 230 |
| PACKINGBATCH | 465 | 02385 | Label Calci Phos D 1 Lit | 001 | 120 | 18 |
| PACKINGBATCH | 465 | 03003 | Calci-Phos-D | 0001 | 120 | 27.24 |
| PACKINGBATCH | 465 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 6 | 231.59 |
| PACKING | 465 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 286.81 |
| Productions | 450 | 03163 | Calcium 72 | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 450 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PACKING | 466 | 00248 | Calcium-72 1KG | 0001 | 25 | 40 |
| PACKINGBATCH | 466 | 02299 | Packet Calcium-72 1KG | 0001 | 25 | 30 |
| PACKINGBATCH | 466 | 03163 | Calcium 72 | 0001 | 25 | 10 |
| PACKING | 467 | 00231 | Calcium 72 25kg | 0001 | 15 | 250 |
| PACKINGBATCH | 467 | 03163 | Calcium 72 | 0001 | 375 | 10 |
| Productions | 451 | 03118 | BOP Coolper Powder | 0001 | 90 | 113.71 |
| PRODUCTIONBATCH | 451 | 01047 | Sodium Sulphate | 001 | 87 | 71.95 |
| PRODUCTIONBATCH | 451 | 01047 | Sodium Sulphate | 0001 | 3 | 73.98 |
| PRODUCTIONBATCH | 451 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 2 | 1,549.99 |
| PRODUCTIONBATCH | 451 | 01073 | Potassium Chloride | 001 | 0 | 400 |
| PRODUCTIONBATCH | 451 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 451 | 03118 | BOP Coolper Powder | 0001 | 90 | 112.8 |
| PACKING | 468 | 00030 | Coolper 100gm | 0001 | 900 | 28.28 |
| PACKINGBATCH | 468 | 02191 | Packet COOLPER Powder 100 gm | 0001 | 900 | 17 |
| PACKINGBATCH | 468 | 03118 | BOP Coolper Powder | 0001 | 90 | 112.8 |
| Productions | 452 | 03019 | Super Yeast Powder | 0001 | 325 | 40.53 |
| PRODUCTIONBATCH | 452 | 01003 | Bentonite | 0001 | 162 | 13.1 |
| PRODUCTIONBATCH | 452 | 01033 | Molasses | 0001 | 32 | 50 |
| PRODUCTIONBATCH | 452 | 01059 | Wheat Bran | 0001 | 130 | 72.45 |
| Productions | 452 | 03019 | Super Yeast Powder | 0001 | 325 | 40.53 |
| PACKING | 469 | 00040 | Super Yeast Powder 25kg | 0001 | 13 | 1,053.23 |
| PACKINGBATCH | 469 | 02042 | Label Super Yeast 25 KG | 0001 | 13 | 40 |
| PACKINGBATCH | 469 | 03019 | Super Yeast Powder | 0001 | 325 | 40.53 |
| PACKING | 469 | 00040 | Super Yeast Powder 25kg | 0001 | 13 | 1,053.23 |
| Productions | 453 | 03092 | Immune Forte Oral liquid | 0001 | 48 | 159.94 |
| PRODUCTIONBATCH | 453 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 453 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 453 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 453 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 453 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 453 | 01072 | Vitamin E | 0001 | 0 | 9,500 |
| Productions | 453 | 03092 | Immune Forte Oral liquid | 0001 | 48 | 159.94 |
| PACKING | 470 | 00122 | immune forte Oral Liquid 1 Lit | 0001 | 48 | 429.94 |
| PACKINGBATCH | 470 | 02091 | Label Immune Forte 1 Lit | 0001 | 48 | 40 |
| PACKINGBATCH | 470 | 02097 | Bottle Round liter | 001 | 48 | 230 |
| PACKINGBATCH | 470 | 03092 | Immune Forte Oral liquid | 0001 | 48 | 159.94 |
| PACKING | 470 | 00122 | immune forte Oral Liquid 1 Lit | 0001 | 48 | 429.94 |
| Productions | 454 | 03183 | Pro-Tox Liquid | 0001 | 40 | 67.1 |
| PRODUCTIONBATCH | 454 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 454 | 01020 | Formic Acid | 0001 | 0 | 350 |
| PRODUCTIONBATCH | 454 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 454 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 454 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 454 | 01058 | Xanthan Gum | 001 | 0 | 1,450 |
| PRODUCTIONBATCH | 454 | 01058 | Xanthan Gum | 0001 | 0 | 1,450.06 |
| PRODUCTIONBATCH | 454 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PRODUCTIONBATCH | 454 | 01184 | ARQ | 0001 | 2 | 366.67 |
| Productions | 454 | 03183 | Pro-Tox Liquid | 0001 | 40 | 65.96 |
| PACKING | 471 | 00337 | Bop Pro-Tox Liquid 1 Lit | 0001 | 40 | 295.96 |
| PACKINGBATCH | 471 | 02097 | Bottle Round liter | 001 | 40 | 230 |
| PACKINGBATCH | 471 | 03183 | Pro-Tox Liquid | 0001 | 40 | 65.96 |
| PACKING | 471 | 00337 | Bop Pro-Tox Liquid 1 Lit | 0001 | 40 | 295.96 |
| Productions | 455 | 03281 | Grow Pro + Oral Liquid | 0001 | 200 | 1.6 |
| PRODUCTIONBATCH | 455 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PACKING | 472 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 40 | 527.98 |
| PACKINGBATCH | 472 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 439.98 |
| PACKINGBATCH | 472 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 40 | 80 |
| PACKINGBATCH | 472 | 03281 | Grow Pro + Oral Liquid | 0001 | 200 | 1.6 |
| PACKING | 472 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 40 | 527.98 |
| PurchasesBatch | 231 | 01020 | Formic Acid | 0001 | 140 | 312 |
| PACKING | 473 | 00020 | Magnet BOP 1kg | 0001 | 325 | 43.1 |
| PACKINGBATCH | 473 | 02051 | Packet Magnet Oral Powder 1KG | 0001 | 325 | 30 |
| PACKINGBATCH | 473 | 03014 | Magnet BOP Oral Powder | 0001 | 325 | 13.1 |
| PACKING | 474 | 00022 | Magnet BOP 25kg | 0001 | 12 | 327.49 |
| PACKINGBATCH | 474 | 03014 | Magnet BOP Oral Powder | 0001 | 300 | 13.1 |
| PACKING | 474 | 00022 | Magnet BOP 25kg | 0001 | 12 | 327.49 |
| PACKING | 475 | 00262 | Magnet 100gm | 0001 | 1,000 | 10.81 |
| PACKINGBATCH | 475 | 02319 | Packet Magnet 100 gm | 0001 | 1,000 | 9.5 |
| PACKINGBATCH | 475 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 13.1 |
| Productions | 456 | 03002 | DCP Powder | 0001 | 625 | 0 |
| PRODUCTIONBATCH | 456 | 01190 | PHOSPHORUS Powder 29% | 0001 | 100 | 11.5 |
| Productions | 456 | 03002 | DCP Powder | 0001 | 625 | 1.84 |
| PACKING | 476 | 00019 | DCP BOP 25kg | 0001 | 25 | 0 |
| PACKINGBATCH | 476 | 02034 | BAG BOP DCP 25 KG | 001 | 25 | 100 |
| PACKINGBATCH | 476 | 03002 | DCP Powder | 0001 | 625 | 1.84 |
| PACKING | 476 | 00019 | DCP BOP 25kg | 0001 | 25 | 146 |
| PurchasesBatch | 230 | 02460 | Label Tox Guard Plus Oral Liquid 5 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 232 | 02014 | Plastic Can White 5 Liter | 0001 | 255 | 440 |
| Productions | 457 | 03283 | Tox Guard Plus Oral Liquid | 0001 | 100 | 164.05 |
| PRODUCTIONBATCH | 457 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 457 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 457 | 01020 | Formic Acid | 0001 | 1 | 314.71 |
| PRODUCTIONBATCH | 457 | 01046 | Silmyrin | 0001 | 1 | 13,130.73 |
| Productions | 457 | 03283 | Tox Guard Plus Oral Liquid | 0001 | 100 | 164.05 |
| PACKING | 477 | 00396 | Tox Guard Plus Oral Liquid 5 LIT | 0001 | 20 | 1,300.26 |
| PACKINGBATCH | 477 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 439.99 |
| PACKINGBATCH | 477 | 02460 | Label Tox Guard Plus Oral Liquid 5 LIT | 0001 | 20 | 40 |
| PACKINGBATCH | 477 | 03283 | Tox Guard Plus Oral Liquid | 0001 | 100 | 164.05 |
| PACKING | 477 | 00396 | Tox Guard Plus Oral Liquid 5 LIT | 0001 | 20 | 1,300.26 |
| PurchasesBatch | 233 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 40 | 90 |
| PurchasesBatch | 233 | 02151 | Packet Promin Gold Minerals 1kg | 0001 | 1,008 | 33 |
| PurchasesBatch | 234 | 02014 | Plastic Can White 5 Liter | 0001 | 300 | 440 |
| PurchasesBatch | 235 | 02128 | White Can 25 Liter | 0001 | 300 | 1,070 |
| Productions | 458 | 03097 | Acidi-Lic Liquid | 0001 | 1,000 | 21.36 |
| PRODUCTIONBATCH | 458 | 01009 | Copper Sulphate | 001 | 3 | 2,200 |
| PRODUCTIONBATCH | 458 | 01028 | Lactic Acid | 0001 | 5 | 1,650 |
| PRODUCTIONBATCH | 458 | 01038 | Phosphoric Acid 85% | 001 | 5 | 650 |
| PRODUCTIONBATCH | 458 | 01186 | HCL | 001 | 30 | 70 |
| PRODUCTIONBATCH | 458 | 01187 | Sodium Metaby Sulphate | 0001 | 3 | 387.09 |
| Productions | 458 | 03097 | Acidi-Lic Liquid | 0001 | 1,000 | 21.36 |
| PACKING | 478 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 40 | 1,693.64 |
| PACKINGBATCH | 478 | 02128 | White Can 25 Liter | 0001 | 40 | 1,069.61 |
| PACKINGBATCH | 478 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 40 | 90 |
| PACKINGBATCH | 478 | 03097 | Acidi-Lic Liquid | 0001 | 1,000 | 21.36 |
| PACKING | 478 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 40 | 1,693.64 |
| Productions | 459 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 250 | 8.25 |
| PRODUCTIONBATCH | 459 | 01003 | Bentonite | 0001 | 125 | 13.1 |
| PRODUCTIONBATCH | 459 | 01007 | CSL | 0001 | 5 | 35 |
| PRODUCTIONBATCH | 459 | 01033 | Molasses | 0001 | 5 | 50 |
| PACKING | 479 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 10 | 253.88 |
| PACKINGBATCH | 479 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 10 | 47.63 |
| PACKINGBATCH | 479 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 250 | 8.25 |
| PACKING | 479 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 10 | 253.88 |
| PurchasesBatch | 233 | 02461 | Label Garliment Forte Oral Liquid 5 LIT | 0001 | 150 | 40 |
| Productions | 460 | 03284 | Garliment Forte Oral Liquid | 0001 | 400 | 3.86 |
| PRODUCTIONBATCH | 460 | 01045 | Sorbitol Liquid 70% | 001 | 4 | 350 |
| Productions | 460 | 03284 | Garliment Forte Oral Liquid | 0001 | 400 | 3.5 |
| PACKING | 480 | 00397 | Garliment Forte Oral Liquid 5 LIT | 0001 | 80 | 497.5 |
| PACKINGBATCH | 480 | 02014 | Plastic Can White 5 Liter | 0001 | 80 | 440 |
| PACKINGBATCH | 480 | 02461 | Label Garliment Forte Oral Liquid 5 LIT | 0001 | 80 | 40 |
| PACKINGBATCH | 480 | 03284 | Garliment Forte Oral Liquid | 0001 | 400 | 3.5 |
| PACKING | 480 | 00397 | Garliment Forte Oral Liquid 5 LIT | 0001 | 80 | 497.5 |
| SALESBATCH | 157 | 00265 | GrowMore 1Kg | 001 | 200 | 63.91 |
| SALESBATCH | 157 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 285.01 |
| SALESBATCH | 158 | 00020 | Magnet BOP 1kg | 001 | 200 | 56.3 |
| SALESBATCH | 158 | 00265 | GrowMore 1Kg | 001 | 250 | 63.91 |
| SALESBATCH | 159 | 00259 | Garliment-Plus BOP  30ML | 001 | 20 | 286.54 |
| SALESBATCH | 159 | 00259 | Garliment-Plus BOP  30ML | 0001 | 430 | 19.75 |
| SALESBATCH | 159 | 00369 | Febro Meon Spray 120 ML | 001 | 119 | 473.37 |
| SALESBATCH | 159 | 00369 | Febro Meon Spray 120 ML | 0001 | 73 | 222.95 |
| SALESBATCH | 160 | 00078 | ORITOX Oral Powder  25 Kg | 001 | 200 | 327.5 |
| OpeningBatch | 116 | 00398 | Cambo Stab C Oral Liquid 5 Lit | 0001 | 40 | 3,000 |
| SALESBATCH | 161 | 00398 | Cambo Stab C Oral Liquid 5 Lit | 0001 | 40 | 3,000 |
| SALESBATCH | 162 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 285.01 |
| SALESBATCH | 162 | 00037 | paower Plus 25kg | 001 | 1 | 1,289.62 |
| SALESBATCH | 162 | 00231 | Calcium 72 25kg | 001 | 1 | 355 |
| SALESBATCH | 163 | 00010 | Calci-Phos-D100ML | 001 | 400 | 25.45 |
| SALESBATCH | 163 | 00233 | Timp-Ex Oral Liquid 120 ML | 001 | 200 | 24.77 |
| SALESBATCH | 163 | 00259 | Garliment-Plus BOP  30ML | 0001 | 225 | 19.75 |
| SALESBATCH | 163 | 00248 | Calcium-72 1KG | 001 | 25 | 53.56 |
| SALESBATCH | 163 | 00369 | Febro Meon Spray 120 ML | 0001 | 96 | 222.95 |
| SALESBATCH | 164 | 00385 | Bop Yeast Oral Powder 5 KG | 001 | 20 | 191.25 |
| SALESBATCH | 165 | 00019 | DCP BOP 25kg | 0001 | 85 | 313.42 |
| SALESBATCH | 166 | 00180 | Stable C 20 (5 Liter) | 0001 | 12 | 1,384.04 |
| SALESBATCH | 167 | 00016 | Growth Promoter 25kg | 0001 | 70 | 568.13 |
| SALESBATCH | 168 | 00016 | Growth Promoter 25kg | 0001 | 15 | 568.13 |
| SALESBATCH | 169 | 00016 | Growth Promoter 25kg | 0001 | 5 | 568.13 |
| SALESBATCH | 170 | 00016 | Growth Promoter 25kg | 0001 | 10 | 568.13 |
| PurchasesBatch | 236 | 01044 | Sodium Bicarbonate | 0001 | 100 | 128 |
| Productions | 461 | 03046 | Rumicid BOP Oral Powder | 0001 | 2,500 | 16.53 |
| PRODUCTIONBATCH | 461 | 01003 | Bentonite | 0001 | 25 | 13.1 |
| PRODUCTIONBATCH | 461 | 01016 | DCP (Dana) | 0001 | 2,500 | 10 |
| PRODUCTIONBATCH | 461 | 01044 | Sodium Bicarbonate | 0001 | 125 | 128 |
| PACKING | 481 | 00220 | Rumicid powder 25kg | 0001 | 100 | 457.43 |
| PACKINGBATCH | 481 | 02258 | Label Rumicid 25kg | 0001 | 100 | 44.15 |
| PACKINGBATCH | 481 | 03046 | Rumicid BOP Oral Powder | 0001 | 2,500 | 16.53 |
| PACKING | 481 | 00220 | Rumicid powder 25kg | 0001 | 100 | 457.43 |
| Productions | 462 | 03019 | Super Yeast Powder | 0001 | 750 | 5 |
| PRODUCTIONBATCH | 462 | 01033 | Molasses | 0001 | 75 | 50 |
| PACKING | 482 | 00040 | Super Yeast Powder 25kg | 0001 | 30 | 165 |
| PACKINGBATCH | 482 | 02042 | Label Super Yeast 25 KG | 0001 | 30 | 40 |
| PACKINGBATCH | 482 | 03019 | Super Yeast Powder | 0001 | 750 | 5 |
| PurchasesBatch | 237 | 02311 | Drum White 25 kg | 0001 | 200 | 2,050 |
| PurchasesBatch | 238 | 01015 | DCP (Calcium) | 0001 | 10,000 | 17 |
| PurchasesBatch | 239 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 195 | 235 |
| PurchasesBatch | 239 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 104 | 100 |
| PurchasesBatch | 240 | 01041 | Sodium Benzoate | 0001 | 25 | 560 |
| PurchasesBatch | 240 | 01058 | Xanthan Gum | 0001 | 25 | 1,400 |
| PurchasesBatch | 240 | 01209 | Sodium Alginate | 0001 | 2 | 3,500 |
| Productions | 463 | 03003 | Calci-Phos-D | 0001 | 170 | 34.16 |
| PRODUCTIONBATCH | 463 | 01013 | Calcium Chloride | 001 | 2 | 220 |
| PRODUCTIONBATCH | 463 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 463 | 01038 | Phosphoric Acid 85% | 001 | 2 | 650 |
| PRODUCTIONBATCH | 463 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 463 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 463 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 463 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 463 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 463 | 03003 | Calci-Phos-D | 0001 | 170 | 34.24 |
| PACKING | 483 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 282.24 |
| PACKINGBATCH | 483 | 02097 | Bottle Round liter | 001 | 120 | 230 |
| PACKINGBATCH | 483 | 02385 | Label Calci Phos D 1 Lit | 001 | 120 | 18 |
| PACKINGBATCH | 483 | 03003 | Calci-Phos-D | 0001 | 120 | 34.24 |
| PACKING | 483 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 282.24 |
| PACKING | 484 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 15.42 |
| PACKINGBATCH | 484 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 500 | 12 |
| PACKINGBATCH | 484 | 03003 | Calci-Phos-D | 0001 | 50 | 34.24 |
| PACKING | 484 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 15.42 |
| Productions | 464 | 03107 | Bop Copper Liquid | 0001 | 100 | 138.19 |
| PRODUCTIONBATCH | 464 | 01009 | Copper Sulphate | 001 | 5 | 2,200 |
| PRODUCTIONBATCH | 464 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 464 | 01041 | Sodium Benzoate | 001 | 0 | 560 |
| PRODUCTIONBATCH | 464 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 464 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 464 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 464 | 03107 | Bop Copper Liquid | 0001 | 100 | 137.84 |
| PACKING | 485 | 00261 | Bop Copper 5L | 0001 | 20 | 1,129.2 |
| PACKINGBATCH | 485 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 440 |
| PACKINGBATCH | 485 | 03107 | Bop Copper Liquid | 0001 | 100 | 137.84 |
| PACKING | 485 | 00261 | Bop Copper 5L | 0001 | 20 | 1,129.2 |
| PurchasesBatch | 241 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 103 | 176 |
| PurchasesBatch | 242 | 02097 | Bottle Round liter | 0001 | 360 | 230 |
| PurchasesBatch | 243 | 02323 | Label Bop Copper Liquiq 5L | 0001 | 32 | 40 |
| PACKINGBATCH | 485 | 02014 | Plastic Can White 5 Liter |  | 0 | 0 |
| PACKINGBATCH | 485 | 03107 | Bop Copper Liquid |  | 0 | 0 |
| PACKING | 485 | 00261 | Bop Copper 5L |  | 0 | 0 |
| PACKING | 485 | 00261 | Bop Copper 5L | 0001 | 20 | 1,169.2 |
| PACKINGBATCH | 485 | 02323 | Label Bop Copper Liquiq 5L | 0001 | 20 | 40 |
| PACKING | 485 | 00261 | Bop Copper 5L | 0001 | 20 | 1,169.2 |
| SALESBATCH | 171 | 00212 | Microgold-Bop 25 kg | 0001 | 53 | 1,769.62 |
| SALESBATCH | 171 | 00258 | GrowMore 25KG | 0001 | 6 | 602.27 |
| SALESBATCH | 171 | 00263 | GrowMore 100gm | 0001 | 450 | 14.74 |
| SALESBATCH | 171 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 284.33 |
| SALESBATCH | 171 | 00049 | Calci-Phos-D 5 Lit | 0001 | 12 | 699.86 |
| SALESBATCH | 171 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 21.44 |
| SALESBATCH | 171 | 00020 | Magnet BOP 1kg | 0001 | 25 | 51.93 |
| SALESBATCH | 171 | 00122 | immune forte Oral Liquid 1 Lit | 0001 | 24 | 416.61 |
| SALESBATCH | 171 | 00259 | Garliment-Plus BOP  30ML | 0001 | 450 | 19.75 |
| SALESBATCH | 171 | 00392 | Heaatic Optimiser Oral Liquid 1 Lit | 0001 | 48 | 284.08 |
| SALESBATCH | 171 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 20 | 969.58 |
| SALESBATCH | 171 | 00152 | Bop ADEK Powder 1 Kg | 0001 | 50 | 184.23 |
| SALESBATCH | 171 | 00090 | Micro Sel E Oral Liquid 5 Lit | 0001 | 8 | 1,788.33 |
| SALESBATCH | 171 | 00022 | Magnet BOP 25kg | 0001 | 10 | 438.6 |
| SALESBATCH | 171 | 00369 | Febro Meon Spray 120 ML | 0001 | 288 | 222.95 |
| SALESBATCH | 171 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 1,309.19 |
| SALESBATCH | 172 | 00208 | Profen C+ Powder 1Kg | 0001 | 368 | 259.3 |
| SALESBATCH | 173 | 00285 | Reno Gurd Flush Oral Powder 1 kg | 0001 | 300 | 191.39 |
| SALESBATCH | 173 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 120 | 1,206.49 |
| SALESBATCH | 173 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 1,384.09 |
| SALESBATCH | 173 | 00281 | MLC 100  Oral Liquid 5 Liter | 0001 | 24 | 1,110.74 |
| SALESBATCH | 173 | 00286 | Frost Oral Liquid 5 liter | 0001 | 40 | 694.63 |
| SALESBATCH | 173 | 00289 | ACIDO FORTE 25 Lit | 0001 | 20 | 2,173.16 |
| SALESBATCH | 173 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 567.73 |
| SALESBATCH | 174 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 175 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 176 | 00295 | Hepa Gold Oral Liquid 5 Lit | 0001 | 40 | 1,078.06 |
| SALESBATCH | 176 | 00291 | COPPER Gold Oral Liquid 5 Lit | 0001 | 32 | 837.98 |
| SALESBATCH | 176 | 00188 | TOXI GOLD Liquid 5 Liter | 0001 | 32 | 1,005.06 |
| SALESBATCH | 176 | 00194 | E.C Gold Oral Liquid  5 Liter | 0001 | 32 | 852.27 |
| SALESBATCH | 176 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 20 | 717.5 |
| SALESBATCH | 176 | 00228 | P.H Cure 25 Liter | 0001 | 20 | 1,809.67 |
| SALESBATCH | 177 | 00220 | Rumicid powder 25kg | 0001 | 20 | 435.17 |
| SALESBATCH | 177 | 00022 | Magnet BOP 25kg | 0001 | 50 | 438.6 |
| SALESBATCH | 177 | 00020 | Magnet BOP 1kg | 0001 | 250 | 51.93 |
| SALESBATCH | 177 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 222.95 |
| SALESBATCH | 177 | 00032 | Calci-Phos-D 1000ml | 0001 | 45 | 284.33 |
| SALESBATCH | 177 | 00049 | Calci-Phos-D 5 Lit | 0001 | 40 | 699.86 |
| SALESBATCH | 178 | 00296 | Toxi Gold Forte Powder 25 kg | 0001 | 25 | 717.5 |
| SALESBATCH | 179 | 00220 | Rumicid powder 25kg | 0001 | 20 | 435.17 |
| SALESBATCH | 179 | 00231 | Calcium 72 25kg | 001 | 2 | 355 |
| SALESBATCH | 179 | 00231 | Calcium 72 25kg | 0001 | 13 | 315.24 |
| SALESBATCH | 180 | 00294 | Adek Gold Oral Liquid 5 Lit | 0001 | 36 | 1,030.87 |
| SALESBATCH | 180 | 00320 | Neufen Gold Oral Powder 1 kg | 0001 | 180 | 212.69 |
| SALESBATCH | 181 | 00320 | Neufen Gold Oral Powder 1 kg | 0001 | 120 | 212.69 |
| SALESBATCH | 182 | 00197 | Eggcelent liquid 5 Liter | 0001 | 108 | 712.56 |
| SALESBATCH | 183 | 00118 | CID 7 Oral Liquid 25 Lit | 0001 | 5 | 1,819.67 |
| SALESBATCH | 183 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 44 | 1,113.67 |
| SALESBATCH | 183 | 00209 | Hepatic Optimizer fort Powder 25kg | 0001 | 20 | 2,657.86 |
| SALESBATCH | 184 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 184 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 000 | 2 | 621.09 |
| SALESBATCH | 185 | 00363 | PhytoFat Gold 25 Kg | 0001 | 10 | 14,000 |
| SALESBATCH | 186 | 00363 | PhytoFat Gold 25 Kg | 0001 | 100 | 14,000 |
| SALESBATCH | 187 | 00020 | Magnet BOP 1kg | 0001 | 500 | 51.93 |
| SALESBATCH | 188 | 00248 | Calcium-72 1KG | 0001 | 500 | 47.72 |
| SALESBATCH | 188 | 00231 | Calcium 72 25kg | 0001 | 200 | 315.24 |
| SALESBATCH | 189 | 00019 | DCP BOP 25kg | 0001 | 60 | 313.42 |
| SALESBATCH | 190 | 00019 | DCP BOP 25kg | 0001 | 40 | 313.42 |
| SALESBATCH | 191 | 00231 | Calcium 72 25kg | 0001 | 100 | 315.24 |
| SALESBATCH | 191 | 00020 | Magnet BOP 1kg | 0001 | 500 | 51.93 |
| SALESBATCH | 191 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 284.33 |
| SALESBATCH | 191 | 00049 | Calci-Phos-D 5 Lit | 0001 | 20 | 699.86 |
| SALESBATCH | 191 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 222.95 |
| SALESBATCH | 192 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 192 | 00022 | Magnet BOP 25kg | 0001 | 1 | 438.6 |
| SALESBATCH | 192 | 00074 | Magnet Plus 25 Kg | 0001 | 1 | 500 |
| SALESBATCH | 193 | 00022 | Magnet BOP 25kg | 0001 | 200 | 438.6 |
| SALESBATCH | 194 | 00368 | Toxi Off Oral Liquid 1 Lit | 0001 | 24 | 506.32 |
| SALESBATCH | 195 | 00377 | BOP DCAD Powder 25 kg | 0001 | 20 | 1,226.34 |
| SALESBATCH | 195 | 00394 | Bop Super Premix Oral Powder 25 kg | 0001 | 20 | 2,000 |
| SALESBATCH | 196 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 6 | 312.01 |
| SALESBATCH | 197 | 00231 | Calcium 72 25kg | 0001 | 10 | 315.24 |
| SALESBATCH | 197 | 00248 | Calcium-72 1KG | 0001 | 125 | 47.72 |
| SALESBATCH | 197 | 00020 | Magnet BOP 1kg | 0001 | 125 | 51.93 |
| SALESBATCH | 197 | 00363 | PhytoFat Gold 25 Kg | 0001 | 2 | 14,000 |
| SALESBATCH | 198 | 00231 | Calcium 72 25kg | 0001 | 10 | 315.24 |
| SALESBATCH | 198 | 00248 | Calcium-72 1KG | 0001 | 125 | 47.72 |
| SALESBATCH | 198 | 00020 | Magnet BOP 1kg | 0001 | 125 | 51.93 |
| SALESBATCH | 198 | 00022 | Magnet BOP 25kg | 0001 | 5 | 438.6 |
| SALESBATCH | 198 | 00363 | PhytoFat Gold 25 Kg | 0001 | 3 | 14,000 |
| SALESBATCH | 199 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 1,819.65 |
| SALESBATCH | 199 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 12 | 568.29 |
| SALESBATCH | 199 | 00386 | Ocid Fort Oral Liquid 25 L | 0001 | 20 | 2,064.69 |
| SALESBATCH | 200 | 00139 | Bentox Powder 25 kg | 0001 | 10 | 648 |
| SALESBATCH | 200 | 00199 | Yeast Plus Powder 25 kg | 0001 | 20 | 1,309.19 |
| SALESBATCH | 200 | 00264 | DCP-Gold 25Kg | 001 | 10 | 1,500 |
| SALESBATCH | 200 | 00243 | Bop dairy Mineral 25 KG | 0001 | 30 | 735.67 |
| SALESBATCH | 201 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 40 | 1,115.31 |
| SALESBATCH | 201 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 20 | 1,768.75 |
| SALESBATCH | 202 | 00231 | Calcium 72 25kg | 0001 | 100 | 315.24 |
| SALESBATCH | 202 | 00220 | Rumicid powder 25kg | 0001 | 20 | 435.17 |
| SALESBATCH | 202 | 00369 | Febro Meon Spray 120 ML | 0001 | 192 | 222.95 |
| OpeningBatch | 117 | 00259 | Garliment-Plus BOP  30ML | 0001 | 655 | 40 |
| SALESBATCH | 203 | 00259 | Garliment-Plus BOP  30ML | 0001 | 692 | 38.92 |
| SALESBATCH | 203 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 37.13 |
| SALESBATCH | 203 | 00257 | Heaatic-Optimizer 100ML | 0001 | 200 | 39.33 |
| SALESBATCH | 203 | 00013 | Kirzan BOP 100ml | 0001 | 400 | 40.48 |
| SALESBATCH | 203 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 400 | 25.05 |
| SALESBATCH | 203 | 00008 | Scour Guard100ML | 0001 | 400 | 31.86 |
| SALESBATCH | 203 | 00030 | Coolper 100gm | 0001 | 900 | 29.77 |
| SALESBATCH | 203 | 00040 | Super Yeast Powder 25kg | 0001 | 4 | 623.93 |
| SALESBATCH | 203 | 00019 | DCP BOP 25kg | 0001 | 10 | 313.42 |
| SALESBATCH | 203 | 00220 | Rumicid powder 25kg | 0001 | 10 | 435.17 |
| SALESBATCH | 203 | 00258 | GrowMore 25KG | 0001 | 10 | 602.27 |
| SALESBATCH | 203 | 00016 | Growth Promoter 25kg | 0001 | 20 | 568.13 |
| SALESBATCH | 204 | 00051 | Garlimint Plus BOP 5Lit | 0001 | 8 | 1,389.24 |
| SALESBATCH | 204 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 8 | 704.57 |
| SALESBATCH | 204 | 00247 | Ampro-Plus Liquid 5L | 0001 | 8 | 1,212.81 |
| SALESBATCH | 204 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 12 | 969.58 |
| SALESBATCH | 204 | 00124 | Super Yeast Liquid 5 Lit | 0001 | 8 | 5,000 |
| SALESBATCH | 204 | 00266 | E.S  200 liquid 5 Liter | 0001 | 8 | 1,215.9 |
| SALESBATCH | 204 | 00180 | Stable C 20 (5 Liter) | 0001 | 12 | 1,384.04 |
| SALESBATCH | 204 | 00340 | Toxin Pro Oral Liquid 5 Lit | 0001 | 8 | 1,113.67 |
| SALESBATCH | 204 | 00179 | PROCOPCID Oral Liquid 5 Liter | 0001 | 8 | 1,865.5 |
| SALESBATCH | 204 | 00199 | Yeast Plus Powder 25 kg | 0001 | 4 | 1,309.19 |
| SALESBATCH | 204 | 00163 | Mento Respi Liquid 5 Lit | 001 | 4 | 1,642.59 |
| SALESBATCH | 204 | 00209 | Hepatic Optimizer fort Powder 25kg | 0001 | 4 | 2,657.86 |
| SALESBATCH | 205 | 00016 | Growth Promoter 25kg | 0001 | 20 | 568.13 |
| SALESBATCH | 206 | 00008 | Scour Guard100ML | 0001 | 500 | 31.86 |
| SALESBATCH | 206 | 00262 | Magnet 100gm | 0001 | 300 | 12.14 |
| SALESBATCH | 206 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 200 | 37.13 |
| SALESBATCH | 206 | 00032 | Calci-Phos-D 1000ml | 0001 | 24 | 284.33 |
| SALESBATCH | 207 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 60 | 969.58 |
| SALESBATCH | 207 | 00211 | Bio Adeck Liquid 5Lit | 0001 | 20 | 704.57 |
| SALESBATCH | 207 | 00247 | Ampro-Plus Liquid 5L | 0001 | 40 | 1,212.81 |
| SALESBATCH | 208 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 21.44 |
| SALESBATCH | 208 | 00008 | Scour Guard100ML | 0001 | 100 | 31.86 |
| SALESBATCH | 208 | 00013 | Kirzan BOP 100ml | 0001 | 100 | 40.48 |
| SALESBATCH | 208 | 00257 | Heaatic-Optimizer 100ML | 0001 | 100 | 39.33 |
| SALESBATCH | 208 | 00022 | Magnet BOP 25kg | 0001 | 4 | 438.6 |
| SALESBATCH | 209 | 00390 | Tox Go Vital Oral Liquid 5 Lit | 0001 | 20 | 2,066.92 |
| SALESBATCH | 209 | 00391 | Promune 35 Oral Liquid 5 Lit | 0001 | 40 | 1,049.45 |
| SALESBATCH | 209 | 00388 | Copper lac oral liquid 1L | 0001 | 60 | 529.46 |
| SALESBATCH | 209 | 00389 | Copper Lac plus Oral Liquid 1L | 0001 | 60 | 523.66 |
| SALESBATCH | 209 | 00395 | Brosteine Oral Liquid 1 Lit | 0001 | 60 | 358.62 |
| SALESBATCH | 210 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 846.43 |
| SALESBATCH | 210 | 00150 | Calpho Lic Liquid 5 Lit | 0001 | 20 | 1,651.02 |
| SALESBATCH | 210 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 20 | 2,655 |
| SALESBATCH | 211 | 00138 | Bio Ambrox 5Lit | 0001 | 24 | 737.68 |
| SALESBATCH | 212 | 00365 | Leo Cid Pro 25 Lit | 0001 | 10 | 2,508.23 |
| SALESBATCH | 212 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 12 | 841.84 |
| SALESBATCH | 212 | 00360 | Leo Adsorbo Oral Liquid 5 Lit | 0001 | 12 | 898.77 |
| SALESBATCH | 212 | 00376 | Leo Flush Oral Liquid 5 Lit | 0001 | 12 | 1,285.52 |
| SALESBATCH | 213 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 25 | 1,768.75 |
| SALESBATCH | 213 | 00019 | DCP BOP 25kg | 0001 | 40 | 313.42 |
| SALESBATCH | 213 | 00191 | BOP LIVERCARE Powder 25 KG | 0001 | 20 | 985.86 |
| SALESBATCH | 213 | 00343 | BOP Nutramin Forte 25 KG | 0001 | 50 | 378 |
| SALESBATCH | 214 | 00126 | Golden Premix 1 Kg | 0001 | 2,000 | 56.96 |
| SALESBATCH | 214 | 00125 | Golden Premix 25Kg | 0001 | 38 | 633.27 |
| SALESBATCH | 214 | 00265 | GrowMore 1Kg | 0001 | 500 | 58.88 |
| SALESBATCH | 215 | 00022 | Magnet BOP 25kg | 0001 | 50 | 438.6 |
| SALESBATCH | 215 | 00220 | Rumicid powder 25kg | 0001 | 50 | 435.17 |
| SALESBATCH | 215 | 00262 | Magnet 100gm | 0001 | 750 | 12.14 |
| SALESBATCH | 215 | 00369 | Febro Meon Spray 120 ML | 0001 | 480 | 222.95 |
| SALESBATCH | 216 | 00220 | Rumicid powder 25kg | 0001 | 10 | 435.17 |
| SALESBATCH | 217 | 00220 | Rumicid powder 25kg | 0001 | 5 | 435.17 |
| SALESBATCH | 217 | 00022 | Magnet BOP 25kg | 0001 | 2 | 438.6 |
| SALESBATCH | 218 | 00220 | Rumicid powder 25kg | 0001 | 5 | 435.17 |
| SALESBATCH | 218 | 00022 | Magnet BOP 25kg | 0001 | 5 | 438.6 |
| SALESBATCH | 219 | 00019 | DCP BOP 25kg | 0001 | 20 | 313.42 |
| SALESBATCH | 220 | 00019 | DCP BOP 25kg | 0001 | 20 | 313.42 |
| SALESBATCH | 221 | 00231 | Calcium 72 25kg | 0001 | 8 | 315.24 |
| OpeningBatch | 118 | 00262 | Magnet 100gm | 0001 | 748 | 40 |
| SALESBATCH | 222 | 00262 | Magnet 100gm | 0001 | 1,098 | 31.12 |
| SALESBATCH | 222 | 00020 | Magnet BOP 1kg | 0001 | 300 | 51.93 |
| SALESBATCH | 222 | 00022 | Magnet BOP 25kg | 0001 | 12 | 438.6 |
| SALESBATCH | 222 | 00040 | Super Yeast Powder 25kg | 0001 | 13 | 623.93 |
| SALESBATCH | 222 | 00019 | DCP BOP 25kg | 0001 | 20 | 313.42 |
| SALESBATCH | 222 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 284.33 |
| SALESBATCH | 222 | 00231 | Calcium 72 25kg | 0001 | 10 | 315.24 |
| SALESBATCH | 222 | 00030 | Coolper 100gm | 0001 | 850 | 29.77 |
| SALESBATCH | 223 | 00231 | Calcium 72 25kg | 0001 | 5 | 315.24 |
| SALESBATCH | 223 | 00248 | Calcium-72 1KG | 0001 | 25 | 47.72 |
| SALESBATCH | 223 | 00019 | DCP BOP 25kg | 0001 | 5 | 313.42 |
| SALESBATCH | 223 | 00020 | Magnet BOP 1kg | 0001 | 25 | 51.93 |
| OpeningBatch | 118 | 00262 | Magnet 100gm | 0001 | 898 | 40 |
| OpeningBatch | 119 | 00030 | Coolper 100gm | 0001 | 100 | 48 |
| SALESBATCH | 223 | 00262 | Magnet 100gm | 0001 | 150 | 40 |
| SALESBATCH | 223 | 00030 | Coolper 100gm | 0001 | 150 | 41.92 |
| PACKINGBATCH | 471 | 02097 | Bottle Round liter |  | 0 | 0 |
| PACKINGBATCH | 471 | 03183 | Pro-Tox Liquid |  | 0 | 0 |
| PACKING | 471 | 00337 | Bop Pro-Tox Liquid 1 Lit |  | 0 | 0 |
| PACKING | 486 | 00260 | Pro-Tox Liquid 5L | 0001 | 8 | 932.78 |
| PACKINGBATCH | 486 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 440 |
| PACKINGBATCH | 486 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 15 | 40 |
| PACKINGBATCH | 486 | 03183 | Pro-Tox Liquid | 0001 | 40 | 65.96 |
| PACKINGBATCH | 486 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 234.6 |
| PACKING | 486 | 00260 | Pro-Tox Liquid 5L | 0001 | 8 | 932.78 |
| SALESBATCH | 224 | 00122 | immune forte Oral Liquid 1 Lit | 0001 | 48 | 416.61 |
| SALESBATCH | 224 | 00260 | Pro-Tox Liquid 5L | 0001 | 8 | 932.78 |
| SALESBATCH | 225 | 00396 | Tox Guard Plus Oral Liquid 5 LIT | 0001 | 20 | 1,300.26 |
| SALESBATCH | 226 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 40 | 568.29 |
| SALESBATCH | 227 | 00363 | PhytoFat Gold 25 Kg | 0001 | 1 | 14,000 |
| SALESBATCH | 228 | 00397 | Garliment Forte Oral Liquid 5 LIT | 0001 | 80 | 497.5 |
| SALESBATCH | 229 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 10 | 312.01 |
| SALESBATCH | 230 | 00363 | PhytoFat Gold 25 Kg | 0001 | 4 | 14,000 |
| SALESBATCH | 231 | 00137 | Acidi-Lic Liquid 25 Lit | 0001 | 40 | 2,655 |
| OpeningBatch | 81 | 00019 | DCP BOP 25kg | 0001 | 77 | 1,440 |
| OpeningBatch | 81 | 00019 | DCP BOP 25kg | 0001 | 177 | 1,440 |
| SALESBATCH | 232 | 00019 | DCP BOP 25kg | 0001 | 21 | 1,440 |
| SALESBATCH | 233 | 00220 | Rumicid powder 25kg | 0001 | 100 | 435.17 |
| SALESBATCH | 233 | 00019 | DCP BOP 25kg | 0001 | 100 | 1,440 |
| SALESBATCH | 233 | 00040 | Super Yeast Powder 25kg | 0001 | 30 | 623.93 |
| SALESBATCH | 234 | 00032 | Calci-Phos-D 1000ml | 0001 | 60 | 284.33 |
| SALESBATCH | 234 | 00032 | Calci-Phos-D 1000ml | 001 | 60 | 264.92 |
| SALESBATCH | 234 | 00010 | Calci-Phos-D100ML | 0001 | 500 | 21.44 |
| SALESBATCH | 234 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 235 | 00261 | Bop Copper 5L | 0001 | 20 | 1,169.2 |
| PurchasesBatch | 244 | 01003 | Bentonite | 0001 | 1,000 | 14 |
| PurchasesBatch | 245 | 01042 | Starch | 0001 | 50 | 165 |
| PurchasesBatch | 245 | 01044 | Sodium Bicarbonate | 0001 | 25 | 128 |
| PurchasesBatch | 246 | 02010 | Bottle Pet Amber 100ML | 0001 | 4,700 | 7.8 |
| PurchasesBatch | 247 | 01038 | Phosphoric Acid 85% | 0001 | 35 | 650 |
| PurchasesBatch | 247 | 01021 | Glacial Acetic Acid | 0001 | 30 | 340 |
| PurchasesBatch | 247 | 01028 | Lactic Acid | 0001 | 30 | 1,650 |
| PurchasesBatch | 247 | 01004 | Citric Acid | 0001 | 25 | 400 |
| PurchasesBatch | 247 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 25 | 1,550 |
| PurchasesBatch | 247 | 01072 | Vitamin E | 0001 | 10 | 9,000 |
| PurchasesBatch | 247 | 01057 | Vitamin B6 | 0001 | 5 | 12,500 |
| PurchasesBatch | 247 | 01010 | Betaine | 0001 | 25 | 2,800 |
| PurchasesBatch | 247 | 01074 | Crystal Violet | 00001 | 2 | 4,000 |
| PurchasesBatch | 248 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 20 | 150 |
| PurchasesBatch | 248 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 20 | 208 |
| PurchasesBatch | 249 | 02462 | LABEL MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PurchasesBatch | 249 | 02463 | LABEL THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PurchasesBatch | 249 | 02464 | LABEL RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PurchasesBatch | 249 | 02465 | LABEL ADEVIX C ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PurchasesBatch | 249 | 02466 | LABEL IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PurchasesBatch | 249 | 02467 | LABEL AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 32 | 40 |
| PurchasesBatch | 249 | 02443 | Label Bio Guard oral Liquid 5 Lit | 0001 | 80 | 80 |
| Productions | 465 | 03286 | MYCOVIX PLUS ORAL LIQUID | 0001 | 24 | 255.42 |
| PRODUCTIONBATCH | 465 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 465 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 465 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 465 | 01020 | Formic Acid | 0001 | 0 | 314.71 |
| PRODUCTIONBATCH | 465 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 465 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 465 | 01046 | Silmyrin | 0001 | 0 | 13,130.73 |
| PRODUCTIONBATCH | 465 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 465 | 01184 | ARQ | 0001 | 0 | 366.67 |
| Productions | 465 | 03286 | MYCOVIX PLUS ORAL LIQUID | 0001 | 24 | 255.42 |
| PACKING | 487 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 697.75 |
| PACKINGBATCH | 487 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 24 | 350 |
| PACKINGBATCH | 487 | 02462 | LABEL MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PACKINGBATCH | 487 | 03286 | MYCOVIX PLUS ORAL LIQUID | 0001 | 24 | 255.42 |
| PACKINGBATCH | 487 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 2 | 208 |
| PACKING | 487 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 697.75 |
| Productions | 466 | 03287 | THERMOXFIX C ORAL LIQUID | 0001 | 24 | 29.74 |
| PRODUCTIONBATCH | 466 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 466 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 466 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128 |
| PRODUCTIONBATCH | 466 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 466 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 466 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| Productions | 466 | 03287 | THERMOXFIX C ORAL LIQUID | 0001 | 24 | 29.28 |
| Productions | 467 | 03288 | RESPIFIX PLUS ORAL LIQUID | 0001 | 24 | 125.61 |
| PRODUCTIONBATCH | 467 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 467 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 467 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 467 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 467 | 03288 | RESPIFIX PLUS ORAL LIQUID | 0001 | 24 | 128.94 |
| PACKING | 488 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 471.61 |
| PACKINGBATCH | 488 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 24 | 350 |
| PACKINGBATCH | 488 | 02463 | LABEL THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PACKINGBATCH | 488 | 03287 | THERMOXFIX C ORAL LIQUID | 0001 | 24 | 29.28 |
| PACKINGBATCH | 488 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 2 | 208 |
| PACKING | 488 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 471.61 |
| PACKING | 489 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 571.28 |
| PACKINGBATCH | 489 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 24 | 350 |
| PACKINGBATCH | 489 | 02464 | LABEL RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PACKINGBATCH | 489 | 03288 | RESPIFIX PLUS ORAL LIQUID | 0001 | 24 | 128.94 |
| PACKINGBATCH | 489 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 2 | 208 |
| PACKING | 489 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 571.28 |
| Productions | 468 | 03289 | ADEVIX C ORAL LIQUID | 0001 | 24 | 45.89 |
| PRODUCTIONBATCH | 468 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 468 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 468 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 468 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 468 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 468 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 468 | 03289 | ADEVIX C ORAL LIQUID | 0001 | 24 | 45.9 |
| Productions | 469 | 03290 | IMUNIIX PLUS ORAL LIQUID | 0001 | 24 | 66.74 |
| PRODUCTIONBATCH | 469 | 01023 | Garlic Oil | 0001 | 0 | 7,043.77 |
| PRODUCTIONBATCH | 469 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 469 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 469 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 469 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 469 | 03290 | IMUNIIX PLUS ORAL LIQUID | 0001 | 24 | 66.56 |
| Productions | 470 | 03291 | AQUAFIX PLUS ORAL LIQUID | 0001 | 24 | 46.81 |
| PRODUCTIONBATCH | 470 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 470 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 470 | 01020 | Formic Acid | 0001 | 1 | 314.71 |
| PRODUCTIONBATCH | 470 | 01021 | Glacial Acetic Acid | 001 | 0 | 340 |
| PRODUCTIONBATCH | 470 | 01021 | Glacial Acetic Acid | 0001 | 0 | 340.07 |
| PRODUCTIONBATCH | 470 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 470 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 750 |
| PRODUCTIONBATCH | 470 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 470 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 470 | 03291 | AQUAFIX PLUS ORAL LIQUID | 0001 | 24 | 46.81 |
| PACKING | 490 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 280726 | 24 | 488.23 |
| PACKINGBATCH | 490 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 24 | 350 |
| PACKINGBATCH | 490 | 02465 | LABEL ADEVIX C ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PACKINGBATCH | 490 | 03289 | ADEVIX C ORAL LIQUID | 0001 | 24 | 45.9 |
| PACKINGBATCH | 490 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 2 | 208 |
| PACKING | 490 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 280726 | 24 | 488.23 |
| PACKING | 491 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 280726 | 24 | 508.89 |
| PACKINGBATCH | 491 | 02015 | Metal Bottle Silver 1 Liter | 0001 | 24 | 350 |
| PACKINGBATCH | 491 | 02466 | LABEL IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 60 |
| PACKINGBATCH | 491 | 03290 | IMUNIIX PLUS ORAL LIQUID | 0001 | 24 | 66.56 |
| PACKINGBATCH | 491 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 2 | 208 |
| PACKING | 491 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 280726 | 24 | 508.89 |
| PACKING | 492 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 341.47 |
| PACKINGBATCH | 492 | 02097 | Bottle Round liter | 0001 | 24 | 230 |
| PACKINGBATCH | 492 | 02467 | LABEL AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PACKINGBATCH | 492 | 03291 | AQUAFIX PLUS ORAL LIQUID | 0001 | 24 | 46.81 |
| PACKINGBATCH | 492 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 176 |
| PACKING | 492 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 341.47 |
| Productions | 471 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 100 | 17.1 |
| PRODUCTIONBATCH | 471 | 01003 | Bentonite | 0001 | 50 | 13.8 |
| PRODUCTIONBATCH | 471 | 01007 | CSL | 0001 | 2 | 35 |
| PRODUCTIONBATCH | 471 | 01015 | DCP (Calcium) | 0001 | 50 | 17 |
| PRODUCTIONBATCH | 471 | 01033 | Molasses | 0001 | 2 | 50 |
| Productions | 471 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 100 | 17.1 |
| Productions | 472 | 03271 | Bio Guard oral Liquid | 0001 | 300 | 44.15 |
| PRODUCTIONBATCH | 472 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 472 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 472 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 472 | 01020 | Formic Acid | 0001 | 3 | 314.71 |
| PRODUCTIONBATCH | 472 | 01021 | Glacial Acetic Acid | 0001 | 3 | 340.07 |
| PRODUCTIONBATCH | 472 | 01041 | Sodium Benzoate | 0001 | 1 | 560.01 |
| PRODUCTIONBATCH | 472 | 01058 | Xanthan Gum | 0001 | 1 | 1,400.15 |
| Productions | 472 | 03271 | Bio Guard oral Liquid | 0001 | 300 | 44.15 |
| PACKING | 493 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 4 | 630.16 |
| PACKINGBATCH | 493 | 02213 | Bag Bop Red Colour | 0001 | 4 | 155 |
| PACKINGBATCH | 493 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 4 | 47.63 |
| PACKINGBATCH | 493 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 100 | 17.1 |
| PACKING | 493 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 4 | 630.16 |
| PACKING | 494 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 740.74 |
| PACKINGBATCH | 494 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 440 |
| PACKINGBATCH | 494 | 02443 | Label Bio Guard oral Liquid 5 Lit | 0001 | 60 | 80 |
| PACKINGBATCH | 494 | 03271 | Bio Guard oral Liquid | 0001 | 300 | 44.15 |
| PACKING | 494 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 740.74 |
| Productions | 473 | 03046 | Rumicid BOP Oral Powder | 0001 | 425 | 16.54 |
| PRODUCTIONBATCH | 473 | 01003 | Bentonite | 0001 | 4 | 13.8 |
| PRODUCTIONBATCH | 473 | 01016 | DCP (Dana) | 0001 | 425 | 10 |
| PRODUCTIONBATCH | 473 | 01044 | Sodium Bicarbonate | 0001 | 21 | 128 |
| Productions | 473 | 03046 | Rumicid BOP Oral Powder | 0001 | 425 | 16.54 |
| Productions | 474 | 03014 | Magnet BOP Oral Powder | 0001 | 175 | 13.8 |
| PRODUCTIONBATCH | 474 | 01003 | Bentonite | 0001 | 175 | 13.8 |
| Productions | 474 | 03014 | Magnet BOP Oral Powder | 0001 | 175 | 13.8 |
| PACKING | 495 | 00220 | Rumicid powder 25kg | 0001 | 17 | 457.6 |
| PACKINGBATCH | 495 | 02258 | Label Rumicid 25kg | 0001 | 17 | 44.15 |
| PACKINGBATCH | 495 | 03046 | Rumicid BOP Oral Powder | 0001 | 425 | 16.54 |
| PACKING | 495 | 00220 | Rumicid powder 25kg | 0001 | 17 | 457.6 |
| PRODUCTIONBATCH | 474 | 01003 | Bentonite |  | 0 | 0 |
| PRODUCTIONBATCH | 474 | 01003 | Bentonite | 0001 | 180 | 13.8 |
| Productions | 474 | 03014 | Magnet BOP Oral Powder | 0001 | 175 | 14.2 |
| PACKING | 496 | 00022 | Magnet BOP 25kg | 0001 | 7 | 345.6 |
| PACKINGBATCH | 496 | 03014 | Magnet BOP Oral Powder | 0001 | 175 | 13.82 |
| PACKING | 496 | 00022 | Magnet BOP 25kg | 0001 | 7 | 345.6 |
| Productions | 475 | 03151 | Microgold-Bop | 0001 | 50 | 62.56 |
| PRODUCTIONBATCH | 475 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 475 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 475 | 01016 | DCP (Dana) | 0001 | 40 | 10 |
| PRODUCTIONBATCH | 475 | 01034 | Magnesium Sulphate | 0001 | 0 | 559.15 |
| PRODUCTIONBATCH | 475 | 01042 | Starch | 0001 | 0 | 165.2 |
| PRODUCTIONBATCH | 475 | 01043 | Sodium Chloride | 0001 | 10 | 13.75 |
| PRODUCTIONBATCH | 475 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 475 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 475 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 475 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 475 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 475 | 01057 | Vitamin B6 | 0001 | 0 | 12,863.29 |
| PRODUCTIONBATCH | 475 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 475 | 01072 | Vitamin E | 0001 | 0 | 9,146.18 |
| PRODUCTIONBATCH | 475 | 01073 | Potassium Chloride | 001 | 0 | 400 |
| PRODUCTIONBATCH | 475 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 475 | 03151 | Microgold-Bop | 0001 | 50 | 62.57 |
| Productions | 476 | 03163 | Calcium 72 | 0001 | 50 | 17 |
| PRODUCTIONBATCH | 476 | 01015 | DCP (Calcium) | 0001 | 50 | 17 |
| PACKING | 497 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,604.32 |
| PACKINGBATCH | 497 | 02245 | Label Microgold-Bop 25 kg | 0001 | 2 | 40 |
| PACKINGBATCH | 497 | 03151 | Microgold-Bop | 0001 | 50 | 62.57 |
| PACKING | 497 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,604.31 |
| PACKING | 498 | 00231 | Calcium 72 25kg | 0001 | 2 | 425 |
| PACKINGBATCH | 498 | 03163 | Calcium 72 | 0001 | 50 | 17 |
| PurchasesBatch | 250 | 01047 | Sodium Sulphate | 0001 | 50 | 66 |
| PurchasesBatch | 250 | 01193 | Castor Oil | 0001 | 5 | 710 |
| PurchasesBatch | 250 | 01184 | ARQ | 0001 | 25 | 367 |
| PurchasesBatch | 251 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| PurchasesBatch | 251 | 01027 | Kaolin | 0001 | 25 | 400 |
| PurchasesBatch | 252 | 02200 | Label URECTIC Powder 1 kg | 0001 | 64 | 40 |
| PurchasesBatch | 252 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 25 | 75 |
| PurchasesBatch | 253 | 02010 | Bottle Pet Amber 100ML | 0001 | 1,300 | 7.8 |
| PurchasesBatch | 254 | 02009 | Bottle Can White  100ML | 0001 | 1,200 | 20 |
| Productions | 477 | 03011 | Hepatic-Optimizer Liquid | 0001 | 100 | 81.74 |
| PRODUCTIONBATCH | 477 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 477 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 477 | 01013 | Calcium Chloride | 001 | 1 | 220 |
| PRODUCTIONBATCH | 477 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 477 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 477 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 477 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 477 | 01184 | ARQ | 0001 | 5 | 366.97 |
| Productions | 477 | 03011 | Hepatic-Optimizer Liquid | 0001 | 100 | 81.82 |
| Productions | 478 | 03129 | Bop URETIC Powder | 0001 | 50 | 317.82 |
| PRODUCTIONBATCH | 478 | 01001 | Aerosil | 0001 | 0 | 1,850 |
| PRODUCTIONBATCH | 478 | 01002 | Ammonium chloride | 0001 | 19 | 278.51 |
| PRODUCTIONBATCH | 478 | 01047 | Sodium Sulphate | 0001 | 31 | 67.65 |
| PRODUCTIONBATCH | 478 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 478 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 5 | 1,549.99 |
| Productions | 478 | 03129 | Bop URETIC Powder | 0001 | 50 | 317.82 |
| Productions | 479 | 03182 | GrowMore Powder | 001 | 550 | 21.26 |
| PRODUCTIONBATCH | 479 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 479 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 479 | 01016 | DCP (Dana) | 0001 | 440 | 10 |
| PRODUCTIONBATCH | 479 | 01042 | Starch | 0001 | 5 | 165.2 |
| PRODUCTIONBATCH | 479 | 01043 | Sodium Chloride | 0001 | 110 | 13.75 |
| PRODUCTIONBATCH | 479 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 479 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 479 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 479 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 479 | 03182 | GrowMore Powder | 001 | 550 | 21.27 |
| PACKING | 499 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 20 | 927.74 |
| PACKINGBATCH | 499 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 440 |
| PACKINGBATCH | 499 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 20 | 20 |
| PACKINGBATCH | 499 | 03011 | Hepatic-Optimizer Liquid | 0001 | 100 | 81.82 |
| PACKINGBATCH | 499 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 234.6 |
| PACKING | 499 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 20 | 927.74 |
| PACKING | 500 | 00178 | Bop URETIC Powder 1 kg | 0001 | 50 | 371.21 |
| PACKINGBATCH | 500 | 02200 | Label URECTIC Powder 1 kg | 001 | 55 | 40 |
| PACKINGBATCH | 500 | 03129 | Bop URETIC Powder | 0001 | 50 | 317.82 |
| PACKINGBATCH | 500 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 234.6 |
| PACKING | 500 | 00178 | Bop URETIC Powder 1 kg | 0001 | 50 | 371.21 |
| PACKING | 501 | 00265 | GrowMore 1Kg | 0001 | 500 | 63 |
| PACKINGBATCH | 501 | 02315 | Packet GrowMore 1KG | 0001 | 500 | 30 |
| PACKINGBATCH | 501 | 03182 | GrowMore Powder | 001 | 500 | 21.27 |
| PACKINGBATCH | 501 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 234.6 |
| PACKING | 502 | 00258 | GrowMore 25KG | 0001 | 2 | 2,651.64 |
| PACKINGBATCH | 502 | 02311 | Drum White 25 kg | 0001 | 2 | 2,050 |
| PACKINGBATCH | 502 | 02312 | Label GrowMore 25KG | 0001 | 2 | 70 |
| PACKINGBATCH | 502 | 03182 | GrowMore Powder | 001 | 50 | 21.27 |
| PACKING | 502 | 00258 | GrowMore 25KG | 0001 | 2 | 2,651.65 |
| SALESBATCH | 221 | 00231 | Calcium 72 25kg |  | 0 | 0 |
| SALESBATCH | 221 | 00231 | Calcium 72 25kg | 0001 | 8 | 316.27 |
| Productions | 480 | 03002 | DCP Powder | 0001 | 1,250 | 17 |
| PRODUCTIONBATCH | 480 | 01015 | DCP (Calcium) | 0001 | 1,250 | 17 |
| PACKING | 503 | 00019 | DCP BOP 25kg | 0001 | 50 | 515 |
| PACKINGBATCH | 503 | 02034 | BAG BOP DCP 25 KG | 001 | 50 | 100 |
| PACKINGBATCH | 503 | 03002 | DCP Powder | 0001 | 1,250 | 17 |
| PACKING | 503 | 00019 | DCP BOP 25kg | 0001 | 50 | 525 |
| Productions | 481 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 16.54 |
| PRODUCTIONBATCH | 481 | 01003 | Bentonite | 0001 | 2 | 13.8 |
| PRODUCTIONBATCH | 481 | 01016 | DCP (Dana) | 0001 | 250 | 10 |
| PRODUCTIONBATCH | 481 | 01044 | Sodium Bicarbonate | 0001 | 12 | 128 |
| Productions | 481 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 16.54 |
| PACKING | 504 | 00220 | Rumicid powder 25kg | 0001 | 10 | 466.43 |
| PACKINGBATCH | 504 | 02258 | Label Rumicid 25kg | 0001 | 12 | 44.15 |
| PACKINGBATCH | 504 | 03046 | Rumicid BOP Oral Powder | 0001 | 250 | 16.54 |
| PACKING | 504 | 00220 | Rumicid powder 25kg | 0001 | 10 | 466.43 |
| Productions | 482 | 03182 | GrowMore Powder | 0001 | 750 | 21.26 |
| PRODUCTIONBATCH | 482 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 482 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 482 | 01016 | DCP (Dana) | 0001 | 600 | 10 |
| PRODUCTIONBATCH | 482 | 01042 | Starch | 0001 | 7 | 165.2 |
| PRODUCTIONBATCH | 482 | 01043 | Sodium Chloride | 0001 | 150 | 13.75 |
| PRODUCTIONBATCH | 482 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 482 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 482 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 482 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 482 | 03182 | GrowMore Powder | 0001 | 750 | 21.27 |
| PACKING | 505 | 00258 | GrowMore 25KG | 0001 | 30 | 2,663.31 |
| PACKINGBATCH | 505 | 02311 | Drum White 25 kg | 0001 | 30 | 2,050 |
| PACKINGBATCH | 505 | 02312 | Label GrowMore 25KG | 0001 | 35 | 70 |
| PACKINGBATCH | 505 | 03182 | GrowMore Powder | 0001 | 750 | 21.27 |
| PACKING | 505 | 00258 | GrowMore 25KG | 0001 | 30 | 2,663.31 |
| Productions | 483 | 03144 | Yeast Plus Powder | 0001 | 1,250 | 11.9 |
| PRODUCTIONBATCH | 483 | 01003 | Bentonite | 0001 | 625 | 13.8 |
| PRODUCTIONBATCH | 483 | 01033 | Molasses | 0001 | 125 | 50 |
| Productions | 483 | 03144 | Yeast Plus Powder | 0001 | 1,250 | 11.9 |
| Productions | 484 | 03003 | Calci-Phos-D | 0001 | 340 | 34.16 |
| PRODUCTIONBATCH | 484 | 01013 | Calcium Chloride | 001 | 5 | 220 |
| PRODUCTIONBATCH | 484 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 484 | 01038 | Phosphoric Acid 85% | 001 | 5 | 650 |
| PRODUCTIONBATCH | 484 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 484 | 01048 | Titanium Dioxide (T.T) | 0001 | 1 | 1,405.95 |
| PRODUCTIONBATCH | 484 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 484 | 01058 | Xanthan Gum | 0001 | 1 | 1,400.15 |
| PRODUCTIONBATCH | 484 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 484 | 03003 | Calci-Phos-D | 0001 | 340 | 34.24 |
| PACKING | 506 | 00199 | Yeast Plus Powder 25 kg | 0001 | 50 | 337.53 |
| PACKINGBATCH | 506 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 50 | 40 |
| PACKINGBATCH | 506 | 03144 | Yeast Plus Powder | 0001 | 1,250 | 11.9 |
| PACKING | 507 | 00049 | Calci-Phos-D 5 Lit | 0001 | 32 | 633.4 |
| PACKINGBATCH | 507 | 02014 | Plastic Can White 5 Liter | 0001 | 32 | 440 |
| PACKINGBATCH | 507 | 02027 | Label Calci Phos D 5 Liter | 0001 | 32 | 22.22 |
| PACKINGBATCH | 507 | 03003 | Calci-Phos-D | 0001 | 160 | 34.24 |
| PACKING | 507 | 00049 | Calci-Phos-D 5 Lit | 0001 | 32 | 633.4 |
| PACKING | 508 | 00032 | Calci-Phos-D 1000ml | 0001 | 180 | 282.24 |
| PACKINGBATCH | 508 | 02097 | Bottle Round liter | 0001 | 180 | 230 |
| PACKINGBATCH | 508 | 02385 | Label Calci Phos D 1 Lit | 001 | 180 | 18 |
| PACKINGBATCH | 508 | 03003 | Calci-Phos-D | 0001 | 180 | 34.24 |
| PACKING | 508 | 00032 | Calci-Phos-D 1000ml | 0001 | 180 | 282.24 |
| PACKINGBATCH | 508 | 03003 | Calci-Phos-D |  | 0 | 0 |
| PACKINGBATCH | 508 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 12 | 176 |
| PACKING | 508 | 00032 | Calci-Phos-D 1000ml | 0001 | 180 | 293.97 |
| PACKINGBATCH | 507 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 234.6 |
| PACKING | 507 | 00049 | Calci-Phos-D 5 Lit | 0001 | 32 | 692.05 |
| PurchasesBatch | 255 | 01003 | Bentonite | 0001 | 10,000 | 13 |
| PurchasesBatch | 256 | 02097 | Bottle Round liter | 0001 | 600 | 230 |
| PurchasesBatch | 257 | 01043 | Sodium Chloride | 0001 | 400 | 13.75 |
| Productions | 485 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 16.53 |
| PRODUCTIONBATCH | 485 | 01003 | Bentonite | 0001 | 1 | 13.03 |
| PRODUCTIONBATCH | 485 | 01016 | DCP (Dana) | 0001 | 125 | 10 |
| PRODUCTIONBATCH | 485 | 01044 | Sodium Bicarbonate | 0001 | 6 | 128 |
| PACKING | 509 | 00220 | Rumicid powder 25kg | 0001 | 5 | 457.41 |
| PACKINGBATCH | 509 | 02258 | Label Rumicid 25kg | 0001 | 5 | 44.15 |
| PACKINGBATCH | 509 | 03046 | Rumicid BOP Oral Powder | 0001 | 125 | 16.53 |
| PACKING | 509 | 00220 | Rumicid powder 25kg | 0001 | 5 | 457.41 |
| PurchasesBatch | 258 | 01027 | Kaolin | 0001 | 25 | 400 |
| Productions | 486 | 03010 | Garlimint Plus BOP | 0001 | 40 | 92.82 |
| PRODUCTIONBATCH | 486 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 486 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 486 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 486 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 486 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 486 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 486 | 03010 | Garlimint Plus BOP | 0001 | 40 | 92.46 |
| Productions | 487 | 03179 | Heaatic Optimizer Liquid | 0001 | 40 | 46.42 |
| PRODUCTIONBATCH | 487 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 487 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 487 | 01020 | Formic Acid | 0001 | 0 | 314.71 |
| PRODUCTIONBATCH | 487 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 487 | 01041 | Sodium Benzoate | 0001 | 1 | 560.01 |
| PRODUCTIONBATCH | 487 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 487 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 488 | 03003 | Calci-Phos-D | 0001 | 80 | 34.16 |
| PRODUCTIONBATCH | 488 | 01013 | Calcium Chloride | 001 | 0 | 220 |
| PRODUCTIONBATCH | 488 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 488 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 488 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 488 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 488 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 488 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 488 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 488 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 488 | 03003 | Calci-Phos-D | 0001 | 80 | 34.19 |
| Productions | 489 | 03012 | Kirzan BOP | 0001 | 80 | 102.21 |
| PRODUCTIONBATCH | 489 | 01027 | Kaolin | 001 | 8 | 400 |
| PRODUCTIONBATCH | 489 | 01041 | Sodium Benzoate | 0001 | 1 | 560.01 |
| PRODUCTIONBATCH | 489 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 489 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 489 | 01193 | Castor Oil | 001 | 1 | 1,150 |
| PRODUCTIONBATCH | 489 | 01193 | Castor Oil | 0001 | 2 | 710 |
| Productions | 489 | 03012 | Kirzan BOP | 0001 | 80 | 99.46 |
| Productions | 490 | 03165 | Timp-Ex Oral Liquid | 0001 | 80 | 23.83 |
| PRODUCTIONBATCH | 490 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 490 | 01021 | Glacial Acetic Acid | 0001 | 0 | 340.07 |
| PRODUCTIONBATCH | 490 | 01035 | Turpentine Oil | 0001 | 0 | 1,278.57 |
| PRODUCTIONBATCH | 490 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 490 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 490 | 01044 | Sodium Bicarbonate | 0001 | 1 | 128 |
| PRODUCTIONBATCH | 490 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 490 | 03165 | Timp-Ex Oral Liquid | 0001 | 80 | 23.83 |
| Productions | 491 | 03018 | Scour Guard | 0001 | 80 | 86.51 |
| PRODUCTIONBATCH | 491 | 01027 | Kaolin | 001 | 12 | 400 |
| PRODUCTIONBATCH | 491 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 491 | 01043 | Sodium Chloride | 0001 | 7 | 13.75 |
| PRODUCTIONBATCH | 491 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 491 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 491 | 01073 | Potassium Chloride | 001 | 3 | 400 |
| PRODUCTIONBATCH | 491 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| Productions | 491 | 03018 | Scour Guard | 0001 | 80 | 86.95 |
| PACKING | 510 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 400 | 30.73 |
| PACKINGBATCH | 510 | 02010 | Bottle Pet Amber 100ML | 0001 | 400 | 7.8 |
| PACKINGBATCH | 510 | 02224 | S+D Garlimint Plus Liquid 100 ML | 0001 | 420 | 11.5 |
| PACKINGBATCH | 510 | 03010 | Garlimint Plus BOP | 0001 | 40 | 92.46 |
| PACKINGBATCH | 510 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 4 | 213 |
| PACKING | 510 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 400 | 31.25 |
| PACKING | 511 | 00257 | Heaatic-Optimizer 100ML | 0001 | 400 | 26.11 |
| PACKINGBATCH | 511 | 02010 | Bottle Pet Amber 100ML | 0001 | 400 | 7.8 |
| PACKINGBATCH | 511 | 02313 | S+D Heaatic-Optimizer 100ML | 0001 | 420 | 11.5 |
| PACKINGBATCH | 511 | 03179 | Heaatic Optimizer Liquid | 0001 | 40 | 46.42 |
| PACKINGBATCH | 511 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 4 | 213 |
| PACKING | 511 | 00257 | Heaatic-Optimizer 100ML | 0001 | 400 | 26.65 |
| PACKING | 512 | 00010 | Calci-Phos-D100ML | 0001 | 800 | 12.25 |
| PACKINGBATCH | 512 | 02018 | S+D Calci-Phos D 100 ML | 0001 | 490 | 12 |
| PACKINGBATCH | 512 | 03003 | Calci-Phos-D | 0001 | 80 | 34.19 |
| PACKINGBATCH | 512 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 001 | 5 | 213 |
| PACKINGBATCH | 512 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 3 | 146.41 |
| PACKING | 512 | 00010 | Calci-Phos-D100ML | 0001 | 800 | 12.65 |
| PACKING | 513 | 00013 | Kirzan BOP 100ml | 0001 | 800 | 43.2 |
| PACKINGBATCH | 513 | 02009 | Bottle Can White  100ML | 001 | 100 | 20 |
| PACKINGBATCH | 513 | 02009 | Bottle Can White  100ML | 0001 | 700 | 20 |
| PACKINGBATCH | 513 | 02019 | S+D Kirzan 100 ML | 0001 | 820 | 11.5 |
| PACKINGBATCH | 513 | 03012 | Kirzan BOP | 0001 | 80 | 99.46 |
| PACKINGBATCH | 513 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 8 | 146.41 |
| PACKING | 514 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 800 | 24.05 |
| PACKINGBATCH | 514 | 02010 | Bottle Pet Amber 100ML | 0001 | 800 | 7.8 |
| PACKINGBATCH | 514 | 02278 | S+D Timp-Ex Oral Liquid 120 ML | 0001 | 820 | 12 |
| PACKINGBATCH | 514 | 03165 | Timp-Ex Oral Liquid | 0001 | 80 | 23.83 |
| PACKINGBATCH | 514 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 8 | 146.41 |
| PACKING | 514 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 800 | 23.95 |
| PACKING | 515 | 00008 | Scour Guard100ML | 0001 | 800 | 30.29 |
| PACKINGBATCH | 515 | 02020 | S+D Scour Guard100 ML | 0001 | 820 | 12 |
| PACKINGBATCH | 515 | 03018 | Scour Guard | 0001 | 80 | 86.95 |
| PACKINGBATCH | 515 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 8 | 146.41 |
| PACKINGBATCH | 515 | 02010 | Bottle Pet Amber 100ML | 0001 | 800 | 7.8 |
| PACKING | 515 | 00008 | Scour Guard100ML | 0001 | 800 | 30.26 |
| Productions | 492 | 03151 | Microgold-Bop | 0001 | 200 | 55.31 |
| PRODUCTIONBATCH | 492 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 492 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 492 | 01016 | DCP (Dana) | 0001 | 160 | 10 |
| PRODUCTIONBATCH | 492 | 01034 | Magnesium Sulphate | 0001 | 0 | 559.15 |
| PRODUCTIONBATCH | 492 | 01042 | Starch | 0001 | 2 | 165.2 |
| PRODUCTIONBATCH | 492 | 01043 | Sodium Chloride | 0001 | 40 | 13.75 |
| PRODUCTIONBATCH | 492 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 492 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 492 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 492 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 492 | 01057 | Vitamin B6 | 0001 | 0 | 12,863.29 |
| PRODUCTIONBATCH | 492 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 492 | 01072 | Vitamin E | 0001 | 0 | 9,146.18 |
| PRODUCTIONBATCH | 492 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| PRODUCTIONBATCH | 492 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 492 | 03151 | Microgold-Bop | 0001 | 200 | 55.32 |
| Productions | 493 | 03182 | GrowMore Powder | 0001 | 620 | 21.26 |
| PRODUCTIONBATCH | 493 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 493 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 493 | 01016 | DCP (Dana) | 0001 | 496 | 10 |
| PRODUCTIONBATCH | 493 | 01042 | Starch | 0001 | 6 | 165.2 |
| PRODUCTIONBATCH | 493 | 01043 | Sodium Chloride | 0001 | 124 | 13.75 |
| PRODUCTIONBATCH | 493 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 493 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 493 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 493 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 493 | 03182 | GrowMore Powder | 0001 | 620 | 21.26 |
| Productions | 494 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| PRODUCTIONBATCH | 494 | 01015 | DCP (Calcium) | 0001 | 500 | 17 |
| Productions | 495 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 100 | 16.72 |
| PRODUCTIONBATCH | 495 | 01003 | Bentonite | 0001 | 50 | 13.03 |
| PRODUCTIONBATCH | 495 | 01007 | CSL | 0001 | 2 | 35 |
| PRODUCTIONBATCH | 495 | 01015 | DCP (Calcium) | 0001 | 50 | 17 |
| PRODUCTIONBATCH | 495 | 01033 | Molasses | 0001 | 2 | 50 |
| Productions | 495 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 100 | 16.72 |
| Productions | 496 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.03 |
| PRODUCTIONBATCH | 496 | 01003 | Bentonite | 0001 | 50 | 13.03 |
| Productions | 496 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.03 |
| Productions | 497 | 03151 | Microgold-Bop | 0001 | 50 | 55.31 |
| PRODUCTIONBATCH | 497 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 497 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 497 | 01016 | DCP (Dana) | 0001 | 40 | 10 |
| PRODUCTIONBATCH | 497 | 01034 | Magnesium Sulphate | 0001 | 0 | 559.15 |
| PRODUCTIONBATCH | 497 | 01042 | Starch | 0001 | 0 | 165.2 |
| PRODUCTIONBATCH | 497 | 01043 | Sodium Chloride | 0001 | 10 | 13.75 |
| PRODUCTIONBATCH | 497 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 497 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 497 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 497 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 497 | 01057 | Vitamin B6 | 0001 | 0 | 12,863.29 |
| PRODUCTIONBATCH | 497 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 497 | 01072 | Vitamin E | 0001 | 0 | 9,146.18 |
| PRODUCTIONBATCH | 497 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| PRODUCTIONBATCH | 497 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 497 | 03151 | Microgold-Bop | 0001 | 50 | 55.32 |
| PACKING | 516 | 00212 | Microgold-Bop 25 kg | 0001 | 8 | 1,422.98 |
| PACKINGBATCH | 516 | 02245 | Label Microgold-Bop 25 kg | 0001 | 8 | 40 |
| PACKINGBATCH | 516 | 03151 | Microgold-Bop | 0001 | 200 | 55.32 |
| PACKING | 517 | 00263 | GrowMore 100gm | 0001 | 1,200 | 14.64 |
| PACKINGBATCH | 517 | 02320 | Packet GrowMore 100 gm | 0001 | 1,220 | 10 |
| PACKINGBATCH | 517 | 03182 | GrowMore Powder | 0001 | 120 | 21.26 |
| PACKINGBATCH | 517 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 12 | 234.6 |
| PACKING | 517 | 00263 | GrowMore 100gm | 0001 | 1,200 | 14.64 |
| PACKING | 518 | 00265 | GrowMore 1Kg | 0001 | 250 | 68.06 |
| PACKINGBATCH | 518 | 02315 | Packet GrowMore 1KG | 0001 | 250 | 30 |
| PACKINGBATCH | 518 | 03182 | GrowMore Powder | 0001 | 250 | 21.26 |
| PACKINGBATCH | 518 | 02306 | Shipper [K] 1KG large | 0001 | 20 | 210 |
| PACKING | 518 | 00265 | GrowMore 1Kg | 0001 | 250 | 68.06 |
| PACKING | 519 | 00258 | GrowMore 25KG | 0001 | 10 | 2,651.62 |
| PACKINGBATCH | 519 | 02311 | Drum White 25 kg | 0001 | 10 | 2,050 |
| PACKINGBATCH | 519 | 02312 | Label GrowMore 25KG | 0001 | 10 | 70 |
| PACKINGBATCH | 519 | 03182 | GrowMore Powder | 0001 | 250 | 21.26 |
| PACKING | 519 | 00258 | GrowMore 25KG | 0001 | 10 | 2,651.62 |
| PACKING | 520 | 00248 | Calcium-72 1KG | 0001 | 500 | 55.4 |
| PACKINGBATCH | 520 | 02299 | Packet Calcium-72 1KG | 0001 | 500 | 30 |
| PACKINGBATCH | 520 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| PACKINGBATCH | 520 | 02306 | Shipper [K] 1KG large | 0001 | 20 | 210 |
| PACKING | 521 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 4 | 465.54 |
| PACKINGBATCH | 521 | 02420 | Label BOP Yeast Oral Powder 25 kg | 0001 | 4 | 47.63 |
| PACKINGBATCH | 521 | 03253 | BOP Yeast Oral Powder (High) | 0001 | 100 | 16.72 |
| PACKING | 521 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 4 | 465.54 |
| PACKING | 522 | 00022 | Magnet BOP 25kg | 0001 | 4 | 338.54 |
| PACKINGBATCH | 522 | 03014 | Magnet BOP Oral Powder | 0001 | 100 | 13.54 |
| PACKING | 522 | 00022 | Magnet BOP 25kg | 0001 | 4 | 338.53 |
| PACKING | 522 | 00022 | Magnet BOP 25kg | 0001 | 2 | 338.53 |
| PACKINGBATCH | 522 | 03014 | Magnet BOP Oral Powder |  | 0 | 0 |
| PACKINGBATCH | 522 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.54 |
| PACKING | 523 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,422.98 |
| PACKINGBATCH | 523 | 02245 | Label Microgold-Bop 25 kg | 0001 | 2 | 40 |
| PACKINGBATCH | 523 | 03151 | Microgold-Bop | 0001 | 50 | 55.32 |
| PACKINGBATCH | 515 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML |  | 0 | 0 |
| PACKINGBATCH | 515 | 02010 | Bottle Pet Amber 100ML |  | 0 | 0 |
| PACKINGBATCH | 515 | 02020 | S+D Scour Guard100 ML |  | 0 | 0 |
| PACKINGBATCH | 515 | 03018 | Scour Guard |  | 0 | 0 |
| PACKING | 515 | 00008 | Scour Guard100ML |  | 0 | 0 |
| PACKINGBATCH | 513 | 02010 | Bottle Pet Amber 100ML | 0001 | 805 | 7.8 |
| PACKINGBATCH | 513 | 02009 | Bottle Can White  100ML |  | 0 | 0 |
| PACKING | 513 | 00013 | Kirzan BOP 100ml | 0001 | 800 | 31.05 |
| PACKING | 524 | 00008 | Scour Guard100ML | 0001 | 800 | 30.34 |
| PACKINGBATCH | 524 | 02020 | S+D Scour Guard100 ML | 0001 | 820 | 12 |
| PACKINGBATCH | 524 | 03018 | Scour Guard | 0001 | 80 | 86.95 |
| PACKINGBATCH | 524 | 02010 | Bottle Pet Amber 100ML | 0001 | 805 | 7.8 |
| PACKINGBATCH | 524 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 8 | 146.41 |
| PACKING | 524 | 00008 | Scour Guard100ML | 0001 | 800 | 30.31 |
| SALESBATCH | 236 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 697.75 |
| SALESBATCH | 236 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 471.61 |
| SALESBATCH | 236 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 571.28 |
| SALESBATCH | 236 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 280726 | 24 | 488.23 |
| SALESBATCH | 236 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 280726 | 24 | 508.89 |
| SALESBATCH | 236 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 341.47 |
| SALESBATCH | 237 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 4 | 547.85 |
| SALESBATCH | 238 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 60 | 740.74 |
| SALESBATCH | 239 | 00220 | Rumicid powder 25kg | 0001 | 2 | 460.33 |
| SALESBATCH | 239 | 00022 | Magnet BOP 25kg | 0001 | 7 | 377.81 |
| SALESBATCH | 239 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,477.55 |
| SALESBATCH | 239 | 00231 | Calcium 72 25kg | 0001 | 2 | 316.27 |
| SALESBATCH | 240 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 20 | 927.74 |
| SALESBATCH | 240 | 00178 | Bop URETIC Powder 1 kg | 0001 | 50 | 371.21 |
| SALESBATCH | 241 | 00220 | Rumicid powder 25kg | 0001 | 10 | 460.33 |
| SALESBATCH | 242 | 00265 | GrowMore 1Kg | 0001 | 500 | 64.69 |
| SALESBATCH | 242 | 00258 | GrowMore 25KG | 0001 | 2 | 2,659.97 |
| SALESBATCH | 242 | 00363 | PhytoFat Gold 25 Kg | 0001 | 2 | 14,000 |
| SALESBATCH | 242 | 00019 | DCP BOP 25kg | 0001 | 50 | 525 |
| SALESBATCH | 243 | 00258 | GrowMore 25KG | 0001 | 30 | 2,659.97 |
| SALESBATCH | 243 | 00199 | Yeast Plus Powder 25 kg | 0001 | 50 | 337.53 |
| SALESBATCH | 243 | 00032 | Calci-Phos-D 1000ml | 001 | 60 | 264.92 |
| SALESBATCH | 243 | 00032 | Calci-Phos-D 1000ml | 0001 | 120 | 293.97 |
| SALESBATCH | 243 | 00049 | Calci-Phos-D 5 Lit | 0001 | 32 | 697.78 |
| SALESBATCH | 244 | 00363 | PhytoFat Gold 25 Kg | 0001 | 2 | 14,000 |
| SALESBATCH | 245 | 00220 | Rumicid powder 25kg | 0001 | 5 | 460.33 |
| SALESBATCH | 246 | 00201 | Garlimint Plus Liquid 100 ML | 0001 | 400 | 31.25 |
| SALESBATCH | 246 | 00257 | Heaatic-Optimizer 100ML | 0001 | 400 | 26.65 |
| SALESBATCH | 246 | 00010 | Calci-Phos-D100ML | 0001 | 800 | 12.65 |
| SALESBATCH | 246 | 00013 | Kirzan BOP 100ml | 0001 | 800 | 31.05 |
| SALESBATCH | 246 | 00233 | Timp-Ex Oral Liquid 120 ML | 0001 | 800 | 23.95 |
| SALESBATCH | 246 | 00008 | Scour Guard100ML | 0001 | 800 | 30.31 |
| SALESBATCH | 246 | 00220 | Rumicid powder 25kg | 0001 | 15 | 460.33 |
| SALESBATCH | 246 | 00212 | Microgold-Bop 25 kg | 0001 | 8 | 1,477.55 |
| SALESBATCH | 246 | 00265 | GrowMore 1Kg | 0001 | 250 | 64.69 |
| SALESBATCH | 246 | 00258 | GrowMore 25KG | 0001 | 10 | 2,659.97 |
| SALESBATCH | 246 | 00263 | GrowMore 100gm | 0001 | 1,200 | 14.64 |
| SALESBATCH | 246 | 00248 | Calcium-72 1KG | 0001 | 500 | 51.56 |
| PurchasesBatch | 259 | 01184 | ARQ | 0001 | 90 | 367 |
| PurchasesBatch | 259 | 01043 | Sodium Chloride | 0001 | 400 | 13.75 |
| PurchasesBatch | 260 | 02014 | Plastic Can White 5 Liter | 0001 | 340 | 440 |
| PurchasesBatch | 261 | 02274 | Bag Calcium 72  25kg | 0001 | 515 | 100 |
| PurchasesBatch | 261 | 02346 | Label VETLIV Oral Solution 5 Lit | 0001 | 325 | 40 |
| PurchasesBatch | 261 | 02385 | Label Calci Phos D 1 Lit | 0001 | 1,275 | 18 |
| PurchasesBatch | 261 | 02258 | Label Rumicid 25kg | 0001 | 220 | 40 |
| PurchasesBatch | 261 | 02440 | Label BOP DCAD Powder 25 kg | 0001 | 10 | 190 |
| PurchasesBatch | 261 | 02272 | Label Stable C20  5Lit | 0001 | 25 | 40 |
| PurchasesBatch | 262 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 200 | 235 |
| Productions | 498 | 03182 | GrowMore Powder | 0001 | 500 | 21.26 |
| PRODUCTIONBATCH | 498 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 498 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 498 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 498 | 01042 | Starch | 0001 | 5 | 165.2 |
| PRODUCTIONBATCH | 498 | 01043 | Sodium Chloride | 0001 | 100 | 13.75 |
| PRODUCTIONBATCH | 498 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 498 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 498 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 498 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 498 | 03182 | GrowMore Powder | 0001 | 500 | 21.26 |
| Productions | 499 | 03202 | VETLIV Oral Solution | 0001 | 1,200 | 90.28 |
| PRODUCTIONBATCH | 499 | 01009 | Copper Sulphate | 001 | 2 | 2,200 |
| PRODUCTIONBATCH | 499 | 01010 | Betaine | 0001 | 9 | 2,800 |
| PRODUCTIONBATCH | 499 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 499 | 01020 | Formic Acid | 0001 | 4 | 314.71 |
| PRODUCTIONBATCH | 499 | 01021 | Glacial Acetic Acid | 0001 | 4 | 340.07 |
| PRODUCTIONBATCH | 499 | 01028 | Lactic Acid | 0001 | 13 | 1,650 |
| PRODUCTIONBATCH | 499 | 01041 | Sodium Benzoate | 0001 | 6 | 560.01 |
| PRODUCTIONBATCH | 499 | 01045 | Sorbitol Liquid 70% | 001 | 24 | 350 |
| PRODUCTIONBATCH | 499 | 01058 | Xanthan Gum | 0001 | 4 | 1,400.15 |
| PRODUCTIONBATCH | 499 | 01105 | Sodium Citrate | 0001 | 2 | 414.59 |
| PRODUCTIONBATCH | 499 | 01184 | ARQ | 0001 | 84 | 367 |
| Productions | 499 | 03202 | VETLIV Oral Solution | 0001 | 1,200 | 89.56 |
| PACKING | 525 | 00258 | GrowMore 25KG | 0001 | 20 | 2,651.62 |
| PACKINGBATCH | 525 | 02311 | Drum White 25 kg | 0001 | 20 | 2,050 |
| PACKINGBATCH | 525 | 02312 | Label GrowMore 25KG | 0001 | 20 | 70 |
| PACKINGBATCH | 525 | 03182 | GrowMore Powder | 0001 | 500 | 21.26 |
| PACKING | 526 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 240 | 986.51 |
| PACKINGBATCH | 526 | 02014 | Plastic Can White 5 Liter | 0001 | 240 | 440 |
| PACKINGBATCH | 526 | 02346 | Label VETLIV Oral Solution 5 Lit | 0001 | 240 | 40 |
| PACKINGBATCH | 526 | 03202 | VETLIV Oral Solution | 0001 | 1,200 | 89.56 |
| PACKINGBATCH | 526 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 60 | 234.82 |
| PurchasesBatch | 263 | 02014 | Plastic Can White 5 Liter | 0001 | 357 | 440 |
| PurchasesBatch | 263 | 02097 | Bottle Round liter | 0001 | 120 | 230 |
| PurchasesBatch | 264 | 01060 | Zinc Sulphate | 0001 | 25 | 950 |
| PurchasesBatch | 265 | 01193 | Castor Oil | 0001 | 5 | 950 |
| PurchasesBatch | 266 | 02054 | White Bag Unprint | 0001 | 20 | 190 |
| PurchasesBatch | 266 | 02443 | Label Bio Guard oral Liquid 5 Lit | 0001 | 55 | 80 |
| PurchasesBatch | 266 | 02455 | Label Promune 35 Oral Liquid 5 Lit | 0001 | 80 | 80 |
| PurchasesBatch | 266 | 02459 | Label Brosteine Oral Liquid 1 Lit | 0001 | 135 | 40 |
| PurchasesBatch | 266 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 80 | 80 |
| PurchasesBatch | 266 | 02297 | Label Ampro-Plus 5L | 0001 | 70 | 40 |
| PurchasesBatch | 266 | 02271 | Label E.S 200 5Lit | 0001 | 55 | 40 |
| PurchasesBatch | 266 | 02129 | Label CID 7 Oral Liquid 25 Liter | 0001 | 12 | 75 |
| PurchasesBatch | 267 | 02468 | Label MB Adek Oril Liquid 1Lit | 0001 | 135 | 40 |
| PurchasesBatch | 267 | 02469 | Label MB VitaMun Oral Liquid 1 LIT | 0001 | 135 | 40 |
| PurchasesBatch | 267 | 02470 | Label LEO Civon 5 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 267 | 02471 | Label MB FCR Grow Oral Powder 25KG | 0001 | 12 | 140 |
| PurchasesBatch | 267 | 02472 | Label MB Neutral Plus Oral Powder 25 Lit | 0001 | 12 | 140 |
| Productions | 500 | 03294 | LEO Civon | 0001 | 100 | 29.74 |
| PRODUCTIONBATCH | 500 | 01004 | Citric Acid | 0001 | 1 | 400 |
| PRODUCTIONBATCH | 500 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 500 | 01044 | Sodium Bicarbonate | 0001 | 1 | 128 |
| PRODUCTIONBATCH | 500 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 500 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 500 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 1 | 1,549.99 |
| Productions | 500 | 03294 | LEO Civon | 0001 | 100 | 29.28 |
| Productions | 501 | 03144 | Yeast Plus Powder | 0001 | 50 | 40.5 |
| PRODUCTIONBATCH | 501 | 01003 | Bentonite | 0001 | 25 | 13.03 |
| PRODUCTIONBATCH | 501 | 01033 | Molasses | 0001 | 5 | 50 |
| PRODUCTIONBATCH | 501 | 01059 | Wheat Bran | 0001 | 20 | 72.45 |
| Productions | 501 | 03144 | Yeast Plus Powder | 0001 | 50 | 40.5 |
| Productions | 502 | 03271 | Bio Guard oral Liquid | 0001 | 200 | 80.85 |
| PRODUCTIONBATCH | 502 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 502 | 01010 | Betaine | 0001 | 2 | 2,800 |
| PRODUCTIONBATCH | 502 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 502 | 01020 | Formic Acid | 0001 | 2 | 314.71 |
| PRODUCTIONBATCH | 502 | 01021 | Glacial Acetic Acid | 0001 | 2 | 340.07 |
| PRODUCTIONBATCH | 502 | 01041 | Sodium Benzoate | 0001 | 1 | 560.01 |
| PRODUCTIONBATCH | 502 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 502 | 01184 | ARQ | 0001 | 20 | 367 |
| Productions | 502 | 03271 | Bio Guard oral Liquid | 0001 | 200 | 80.85 |
| Productions | 503 | 03280 | Promune 35 Oral Liquid | 0001 | 300 | 12.32 |
| PRODUCTIONBATCH | 503 | 01041 | Sodium Benzoate | 0001 | 1 | 560.01 |
| PRODUCTIONBATCH | 503 | 01045 | Sorbitol Liquid 70% | 001 | 3 | 350 |
| PRODUCTIONBATCH | 503 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 503 | 01058 | Xanthan Gum | 0001 | 1 | 1,400.15 |
| Productions | 503 | 03280 | Promune 35 Oral Liquid | 0001 | 300 | 11.96 |
| Productions | 504 | 03281 | Grow Pro + Oral Liquid | 0001 | 300 | 10 |
| PRODUCTIONBATCH | 504 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 504 | 01041 | Sodium Benzoate | 0001 | 1 | 560.01 |
| PRODUCTIONBATCH | 504 | 01058 | Xanthan Gum | 0001 | 1 | 1,400.15 |
| Productions | 504 | 03281 | Grow Pro + Oral Liquid | 0001 | 300 | 10 |
| Productions | 505 | 03276 | Brosteine 15 Oral Liquid | 0001 | 120 | 131.98 |
| PRODUCTIONBATCH | 505 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 505 | 01031 | Menthol Crystal | 001 | 1 | 6,500 |
| PRODUCTIONBATCH | 505 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 505 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 505 | 01058 | Xanthan Gum | 0001 | 4 | 1,400.15 |
| Productions | 505 | 03276 | Brosteine 15 Oral Liquid | 0001 | 120 | 134.21 |
| Productions | 506 | 03292 | MB Adek Oril Liquid | 0001 | 120 | 43.43 |
| PRODUCTIONBATCH | 506 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 506 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 506 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 506 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 506 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 506 | 03292 | MB Adek Oril Liquid | 0001 | 120 | 43.43 |
| Productions | 507 | 03293 | MB VitaMun Oral Liquid | 0001 | 120 | 152.74 |
| PRODUCTIONBATCH | 507 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 507 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 507 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 507 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 507 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 507 | 01057 | Vitamin B6 | 0001 | 0 | 12,863.29 |
| PRODUCTIONBATCH | 507 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 507 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 507 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 507 | 03293 | MB VitaMun Oral Liquid | 0001 | 120 | 152.38 |
| Productions | 508 | 03296 | MB Neutral Plus Oral Powder | 0001 | 250 | 21.93 |
| PRODUCTIONBATCH | 508 | 01003 | Bentonite | 0001 | 225 | 13.03 |
| PRODUCTIONBATCH | 508 | 01007 | CSL | 0001 | 25 | 35 |
| PRODUCTIONBATCH | 508 | 01015 | DCP (Calcium) | 0001 | 25 | 17 |
| PRODUCTIONBATCH | 508 | 01033 | Molasses | 0001 | 25 | 50 |
| Productions | 509 | 03295 | MB FCR Grow Oral Powder | 0001 | 250 | 20.84 |
| PRODUCTIONBATCH | 509 | 01015 | DCP (Calcium) | 0001 | 250 | 17 |
| PRODUCTIONBATCH | 509 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 510 | 03176 | Ampro-Plus Liquid | 0001 | 260 | 127.85 |
| PRODUCTIONBATCH | 510 | 01017 | Camphor | 0001 | 1 | 3,370.68 |
| PRODUCTIONBATCH | 510 | 01031 | Menthol Crystal | 001 | 3 | 6,500 |
| PRODUCTIONBATCH | 510 | 01041 | Sodium Benzoate | 0001 | 1 | 560.01 |
| PRODUCTIONBATCH | 510 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 510 | 01058 | Xanthan Gum | 0001 | 1 | 1,400.15 |
| Productions | 510 | 03176 | Ampro-Plus Liquid | 0001 | 260 | 131.18 |
| PACKING | 527 | 00407 | LEO Civon 5 LIT | 0001 | 20 | 744.09 |
| PACKINGBATCH | 527 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 440 |
| PACKINGBATCH | 527 | 02470 | Label LEO Civon 5 LIT | 0001 | 20 | 40 |
| PACKINGBATCH | 527 | 03294 | LEO Civon | 0001 | 20 | 29.28 |
| PACKINGBATCH | 527 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 20 | 234.82 |
| PACKING | 527 | 00407 | LEO Civon 5 LIT | 0001 | 20 | 744.09 |
| PACKING | 528 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 1,052.38 |
| PACKINGBATCH | 528 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 2 | 40 |
| PACKINGBATCH | 528 | 03144 | Yeast Plus Powder | 0001 | 50 | 40.5 |
| PACKING | 528 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 1,052.38 |
| PACKING | 529 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 40 | 1,159.06 |
| PACKINGBATCH | 529 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 440 |
| PACKINGBATCH | 529 | 02443 | Label Bio Guard oral Liquid 5 Lit | 0001 | 40 | 80 |
| PACKINGBATCH | 529 | 03271 | Bio Guard oral Liquid | 0001 | 200 | 80.85 |
| PACKINGBATCH | 529 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 40 | 234.82 |
| PACKING | 529 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 40 | 1,159.06 |
| PACKING | 530 | 00391 | Promune 35 Oral Liquid 5 Lit | 0001 | 60 | 873.32 |
| PACKINGBATCH | 530 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 440 |
| PACKINGBATCH | 530 | 02455 | Label Promune 35 Oral Liquid 5 Lit | 0001 | 60 | 80 |
| PACKINGBATCH | 530 | 03280 | Promune 35 Oral Liquid | 0001 | 300 | 11.96 |
| PACKINGBATCH | 530 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 75 | 234.82 |
| PACKING | 531 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 60 | 863.52 |
| PACKINGBATCH | 531 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 440 |
| PACKINGBATCH | 531 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 60 | 80 |
| PACKINGBATCH | 531 | 03281 | Grow Pro + Oral Liquid | 0001 | 300 | 10 |
| PACKINGBATCH | 531 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 75 | 234.82 |
| PACKING | 532 | 00405 | MB Adek Oril Liquid 1Lit | 0001 | 120 | 313.43 |
| PACKINGBATCH | 532 | 02097 | Bottle Round liter | 0001 | 120 | 230 |
| PACKINGBATCH | 532 | 02468 | Label MB Adek Oril Liquid 1Lit | 0001 | 120 | 40 |
| PACKINGBATCH | 532 | 03292 | MB Adek Oril Liquid | 0001 | 120 | 43.43 |
| PACKING | 532 | 00405 | MB Adek Oril Liquid 1Lit | 0001 | 120 | 313.43 |
| PACKING | 533 | 00406 | MB VitaMun Oral Liquid 1 LIT | 0001 | 120 | 422.38 |
| PACKINGBATCH | 533 | 02097 | Bottle Round liter | 0001 | 120 | 230 |
| PACKINGBATCH | 533 | 02469 | Label MB VitaMun Oral Liquid 1 LIT | 0001 | 120 | 40 |
| PACKINGBATCH | 533 | 03293 | MB VitaMun Oral Liquid | 0001 | 120 | 152.38 |
| PACKING | 533 | 00406 | MB VitaMun Oral Liquid 1 LIT | 0001 | 120 | 422.38 |
| PACKING | 534 | 00409 | MB Neutral Plus Oral Powder 25 kg | 0001 | 10 | 161.93 |
| PACKINGBATCH | 534 | 02472 | Label MB Neutral Plus Oral Powder 25 Lit | 0001 | 10 | 140 |
| PACKINGBATCH | 534 | 03296 | MB Neutral Plus Oral Powder | 0001 | 10 | 21.93 |
| PACKING | 534 | 00409 | MB Neutral Plus Oral Powder 25 kg | 0001 | 10 | 161.93 |
| PACKING | 535 | 00408 | MB FCR Grow Oral Powder 25KG | 0001 | 10 | 160.84 |
| PACKINGBATCH | 535 | 02471 | Label MB FCR Grow Oral Powder 25KG | 0001 | 10 | 140 |
| PACKINGBATCH | 535 | 03295 | MB FCR Grow Oral Powder | 0001 | 10 | 20.84 |
| PACKING | 536 | 00247 | Ampro-Plus Liquid 5L | 0001 | 52 | 1,429.43 |
| PACKINGBATCH | 536 | 02014 | Plastic Can White 5 Liter | 0001 | 52 | 440 |
| PACKINGBATCH | 536 | 02297 | Label Ampro-Plus 5L | 0001 | 52 | 40 |
| PACKINGBATCH | 536 | 03176 | Ampro-Plus Liquid | 0001 | 260 | 131.18 |
| PACKINGBATCH | 536 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 65 | 234.82 |
| PurchasesBatch | 268 | 01184 | ARQ | 0001 | 30 | 367 |
| PurchasesBatch | 268 | 01044 | Sodium Bicarbonate | 0001 | 25 | 128 |
| Productions | 511 | 03120 | E.S 200 Liquid | 0001 | 220 | 0 |
| PRODUCTIONBATCH | 511 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 511 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 6 | 1,549.99 |
| PRODUCTIONBATCH | 511 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 511 | 03120 | E.S 200 Liquid | 0001 | 220 | 50.98 |
| Productions | 512 | 03003 | Calci-Phos-D | 0001 | 120 | 34.09 |
| PRODUCTIONBATCH | 512 | 01013 | Calcium Chloride | 0001 | 1 | 209.98 |
| PRODUCTIONBATCH | 512 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 512 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 512 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 512 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 512 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 512 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 512 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 512 | 03003 | Calci-Phos-D | 0001 | 120 | 34.09 |
| Productions | 513 | 03182 | GrowMore Powder | 0001 | 2,825 | 19.18 |
| PRODUCTIONBATCH | 513 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 513 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 513 | 01016 | DCP (Dana) | 0001 | 2,140 | 10 |
| PRODUCTIONBATCH | 513 | 01043 | Sodium Chloride | 0001 | 565 | 13.75 |
| PRODUCTIONBATCH | 513 | 01050 | Tartrazine Yellow Color Indian | 001 | 3 | 3,100 |
| PRODUCTIONBATCH | 513 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 513 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 513 | 01143 | Vitamin B3 | 0001 | 1 | 3,200 |
| Productions | 513 | 03182 | GrowMore Powder | 0001 | 2,825 | 19.19 |
| Productions | 514 | 03018 | Scour Guard | 0001 | 95 | 85.91 |
| PRODUCTIONBATCH | 514 | 01027 | Kaolin | 001 | 14 | 400 |
| PRODUCTIONBATCH | 514 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 514 | 01043 | Sodium Chloride | 0001 | 8 | 13.75 |
| PRODUCTIONBATCH | 514 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 514 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 514 | 01073 | Potassium Chloride | 0001 | 4 | 373.48 |
| Productions | 514 | 03018 | Scour Guard | 0001 | 95 | 85.91 |
| Productions | 515 | 03003 | Calci-Phos-D | 0001 | 520 | 23.94 |
| PRODUCTIONBATCH | 515 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 515 | 01038 | Phosphoric Acid 85% | 001 | 7 | 650 |
| PRODUCTIONBATCH | 515 | 01043 | Sodium Chloride | 0001 | 2 | 13.75 |
| PRODUCTIONBATCH | 515 | 01048 | Titanium Dioxide (T.T) | 0001 | 2 | 1,405.95 |
| PRODUCTIONBATCH | 515 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 515 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 515 | 03003 | Calci-Phos-D | 0001 | 520 | 23.94 |
| Productions | 516 | 03163 | Calcium 72 | 0001 | 2,925 | 17 |
| PRODUCTIONBATCH | 516 | 01015 | DCP (Calcium) | 0001 | 2,925 | 17 |
| Productions | 517 | 03012 | Kirzan BOP | 0001 | 32 | 99.21 |
| PRODUCTIONBATCH | 517 | 01027 | Kaolin | 001 | 3 | 400 |
| PRODUCTIONBATCH | 517 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 517 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 517 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 517 | 01193 | Castor Oil | 0001 | 1 | 870 |
| Productions | 517 | 03012 | Kirzan BOP | 0001 | 32 | 99.21 |
| PACKING | 537 | 00266 | E.S  200 liquid 5 Liter | 0001 | 44 | 895 |
| PACKINGBATCH | 537 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 440 |
| PACKINGBATCH | 537 | 02271 | Label E.S 200 5Lit | 0001 | 44 | 40 |
| PACKINGBATCH | 537 | 03120 | E.S 200 Liquid | 0001 | 220 | 50.98 |
| PACKINGBATCH | 537 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 30 | 234.82 |
| PACKING | 537 | 00266 | E.S  200 liquid 5 Liter | 0001 | 44 | 895 |
| PACKING | 538 | 00049 | Calci-Phos-D 5 Lit | 0001 | 24 | 591.41 |
| PACKINGBATCH | 538 | 02014 | Plastic Can White 5 Liter | 0001 | 24 | 440 |
| PACKINGBATCH | 538 | 02027 | Label Calci Phos D 5 Liter | 0001 | 24 | 22.22 |
| PACKINGBATCH | 538 | 03003 | Calci-Phos-D | 0001 | 120 | 25.84 |
| PACKING | 539 | 00265 | GrowMore 1Kg | 0001 | 500 | 49.19 |
| PACKINGBATCH | 539 | 02315 | Packet GrowMore 1KG | 0001 | 500 | 30 |
| PACKINGBATCH | 539 | 03182 | GrowMore Powder | 0001 | 500 | 19.19 |
| PACKING | 540 | 00258 | GrowMore 25KG | 0001 | 93 | 2,599.7 |
| PACKINGBATCH | 540 | 02311 | Drum White 25 kg | 0001 | 93 | 2,050 |
| PACKINGBATCH | 540 | 02312 | Label GrowMore 25KG | 0001 | 93 | 70 |
| PACKINGBATCH | 540 | 03182 | GrowMore Powder | 0001 | 2,325 | 19.19 |
| PACKING | 540 | 00258 | GrowMore 25KG | 0001 | 93 | 2,599.7 |
| PACKING | 541 | 00008 | Scour Guard100ML | 0001 | 950 | 20.59 |
| PACKINGBATCH | 541 | 02020 | S+D Scour Guard100 ML | 0001 | 950 | 12 |
| PACKINGBATCH | 541 | 03018 | Scour Guard | 0001 | 95 | 85.91 |
| PACKING | 542 | 00032 | Calci-Phos-D 1000ml | 0001 | 360 | 273.84 |
| PACKINGBATCH | 542 | 02097 | Bottle Round liter | 0001 | 360 | 230 |
| PACKINGBATCH | 542 | 02385 | Label Calci Phos D 1 Lit | 001 | 360 | 18 |
| PACKINGBATCH | 542 | 03003 | Calci-Phos-D | 0001 | 360 | 25.84 |
| PACKING | 542 | 00032 | Calci-Phos-D 1000ml | 0001 | 360 | 273.84 |
| PACKING | 543 | 00231 | Calcium 72 25kg | 0001 | 100 | 525 |
| PACKINGBATCH | 543 | 02274 | Bag Calcium 72  25kg | 0001 | 100 | 100 |
| PACKINGBATCH | 543 | 03163 | Calcium 72 | 0001 | 2,500 | 17 |
| PACKING | 544 | 00248 | Calcium-72 1KG | 0001 | 425 | 47 |
| PACKINGBATCH | 544 | 02299 | Packet Calcium-72 1KG | 0001 | 425 | 30 |
| PACKINGBATCH | 544 | 03163 | Calcium 72 | 0001 | 425 | 17 |
| PACKING | 545 | 00013 | Kirzan BOP 100ml | 0001 | 325 | 41.27 |
| PACKINGBATCH | 545 | 02009 | Bottle Can White  100ML | 001 | 100 | 20 |
| PACKINGBATCH | 545 | 02009 | Bottle Can White  100ML | 0001 | 225 | 20 |
| PACKINGBATCH | 545 | 02019 | S+D Kirzan 100 ML | 0001 | 325 | 11.5 |
| PACKINGBATCH | 545 | 03012 | Kirzan BOP | 0001 | 32 | 99.21 |
| PACKINGBATCH | 531 | 02004 | Shipper [D] 4pcs cane (5 Liter) |  | 0 | 0 |
| PACKINGBATCH | 531 | 02014 | Plastic Can White 5 Liter |  | 0 | 0 |
| PACKINGBATCH | 531 | 02457 | Label Grow Pro + Oral Liquid 5 Lit |  | 0 | 0 |
| PACKINGBATCH | 531 | 03281 | Grow Pro + Oral Liquid |  | 0 | 0 |
| PACKING | 531 | 00393 | Grow Pro + Oral Liquid 5 Lit |  | 0 | 0 |
| PACKING | 546 | 00395 | Brosteine Oral Liquid 1 Lit | 0001 | 120 | 423.87 |
| PACKINGBATCH | 546 | 02097 | Bottle Round liter | 0001 | 120 | 230 |
| PACKINGBATCH | 546 | 02459 | Label Brosteine Oral Liquid 1 Lit | 0001 | 135 | 40 |
| PACKINGBATCH | 546 | 03276 | Brosteine 15 Oral Liquid | 0001 | 120 | 134.21 |
| PACKINGBATCH | 546 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 10 | 176 |
| PACKING | 546 | 00395 | Brosteine Oral Liquid 1 Lit | 0001 | 120 | 423.87 |
| PurchasesBatch | 269 | 01002 | Ammonium chloride | 0001 | 25 | 280 |
| PurchasesBatch | 270 | 02267 | Label Ex.Tox Liquid  5Lit | 0001 | 50 | 40 |
| PurchasesBatch | 270 | 02147 | Label Bio Ambrox 5 Lit | 0001 | 50 | 40 |
| PurchasesBatch | 270 | 02210 | Label TOXI GOLD Liquid 5 Liter | 0001 | 50 | 40 |
| PurchasesBatch | 270 | 02343 | Label Flush Gold 5 Lit | 0001 | 50 | 40 |
| PurchasesBatch | 271 | 01043 | Sodium Chloride | 0001 | 2,000 | 13.75 |
| PurchasesBatch | 272 | 02054 | White Bag Unprint | 0001 | 35 | 190 |
| Productions | 518 | 03270 | BOP DCAD Powder | 0001 | 250 | 71.64 |
| PRODUCTIONBATCH | 518 | 01002 | Ammonium chloride | 0001 | 6 | 279.03 |
| PRODUCTIONBATCH | 518 | 01003 | Bentonite | 0001 | 93 | 13.03 |
| PRODUCTIONBATCH | 518 | 01015 | DCP (Calcium) | 0001 | 125 | 17 |
| PRODUCTIONBATCH | 518 | 01034 | Magnesium Sulphate | 0001 | 18 | 559.15 |
| PRODUCTIONBATCH | 518 | 01073 | Potassium Chloride | 0001 | 6 | 373.48 |
| Productions | 518 | 03270 | BOP DCAD Powder | 0001 | 250 | 71.64 |
| Productions | 519 | 03046 | Rumicid BOP Oral Powder | 0001 | 625 | 6.53 |
| PRODUCTIONBATCH | 519 | 01003 | Bentonite | 0001 | 6 | 13.03 |
| PRODUCTIONBATCH | 519 | 01044 | Sodium Bicarbonate | 0001 | 31 | 128 |
| Productions | 520 | 03119 | Stable C 20 Liquid | 0001 | 80 | 169.24 |
| PRODUCTIONBATCH | 520 | 01004 | Citric Acid | 0001 | 1 | 400 |
| PRODUCTIONBATCH | 520 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 520 | 01044 | Sodium Bicarbonate | 0001 | 1 | 128 |
| PRODUCTIONBATCH | 520 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 520 | 01050 | Tartrazine Yellow Color Indian | 001 | 0 | 3,100 |
| PRODUCTIONBATCH | 520 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 8 | 1,549.99 |
| Productions | 520 | 03119 | Stable C 20 Liquid | 0001 | 80 | 168.78 |
| Productions | 521 | 03086 | Super Yeast Liquid | 0001 | 60 | 30 |
| PRODUCTIONBATCH | 521 | 01033 | Molasses | 0001 | 36 | 50 |
| Productions | 522 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.03 |
| PRODUCTIONBATCH | 522 | 01003 | Bentonite | 0001 | 50 | 13.03 |
| Productions | 522 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.03 |
| Productions | 523 | 03144 | Yeast Plus Powder | 0001 | 300 | 40.5 |
| PRODUCTIONBATCH | 523 | 01003 | Bentonite | 0001 | 150 | 13.03 |
| PRODUCTIONBATCH | 523 | 01033 | Molasses | 0001 | 30 | 50 |
| PRODUCTIONBATCH | 523 | 01059 | Wheat Bran | 0001 | 120 | 72.45 |
| Productions | 523 | 03144 | Yeast Plus Powder | 0001 | 300 | 40.5 |
| Productions | 524 | 03054 | Bio Ambrox  Liquid | 0001 | 180 | 54.5 |
| PRODUCTIONBATCH | 524 | 01031 | Menthol Crystal | 001 | 1 | 6,500 |
| PRODUCTIONBATCH | 524 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 524 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 524 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 524 | 03054 | Bio Ambrox  Liquid | 0001 | 180 | 55.83 |
| Productions | 525 | 03070 | Toxi Gold Liquid | 0001 | 180 | 21.59 |
| PRODUCTIONBATCH | 525 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 525 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 525 | 01020 | Formic Acid | 0001 | 0 | 314.71 |
| PRODUCTIONBATCH | 525 | 01021 | Glacial Acetic Acid | 0001 | 0 | 340.07 |
| PRODUCTIONBATCH | 525 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 525 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| Productions | 525 | 03070 | Toxi Gold Liquid | 0001 | 180 | 21.59 |
| Productions | 526 | 03199 | Flush Gold Oral Liquid | 0001 | 180 | 25.61 |
| PRODUCTIONBATCH | 526 | 01002 | Ammonium chloride | 0001 | 4 | 279.03 |
| PRODUCTIONBATCH | 526 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 526 | 01020 | Formic Acid | 0001 | 0 | 314.71 |
| PRODUCTIONBATCH | 526 | 01021 | Glacial Acetic Acid | 0001 | 0 | 340.07 |
| PRODUCTIONBATCH | 526 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 526 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 526 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 526 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 526 | 03199 | Flush Gold Oral Liquid | 0001 | 180 | 25.25 |
| Productions | 527 | 03011 | Hepatic-Optimizer Liquid | 0001 | 220 | 71.52 |
| PRODUCTIONBATCH | 527 | 01010 | Betaine | 0001 | 3 | 2,800 |
| PRODUCTIONBATCH | 527 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 527 | 01038 | Phosphoric Acid 85% | 001 | 3 | 650 |
| PRODUCTIONBATCH | 527 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 527 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 527 | 01184 | ARQ | 0001 | 11 | 367 |
| Productions | 527 | 03011 | Hepatic-Optimizer Liquid | 0001 | 220 | 71.52 |
| Productions | 528 | 03122 | Ex.Tox Liquid | 0001 | 100 | 71.29 |
| PRODUCTIONBATCH | 528 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 528 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 528 | 01020 | Formic Acid | 0001 | 10 | 314.71 |
| PRODUCTIONBATCH | 528 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 528 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 528 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 528 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| Productions | 528 | 03122 | Ex.Tox Liquid | 0001 | 100 | 70.75 |
| PACKING | 547 | 00377 | BOP DCAD Powder 25 kg | 0001 | 10 | 2,170.9 |
| PACKINGBATCH | 547 | 02440 | Label BOP DCAD Powder 25 kg | 0001 | 10 | 190 |
| PACKINGBATCH | 547 | 03270 | BOP DCAD Powder | 0001 | 250 | 71.64 |
| PACKINGBATCH | 547 | 02054 | White Bag Unprint | 0001 | 10 | 190 |
| PACKING | 547 | 00377 | BOP DCAD Powder 25 kg | 0001 | 10 | 2,170.9 |
| PACKING | 548 | 00220 | Rumicid powder 25kg | 0001 | 25 | 394.77 |
| PACKINGBATCH | 548 | 02258 | Label Rumicid 25kg | 0001 | 25 | 41.51 |
| PACKINGBATCH | 548 | 03046 | Rumicid BOP Oral Powder | 0001 | 625 | 6.53 |
| PACKINGBATCH | 548 | 02054 | White Bag Unprint | 0001 | 25 | 190 |
| PACKING | 548 | 00220 | Rumicid powder 25kg | 0001 | 25 | 394.77 |
| PACKING | 549 | 00180 | Stable C 20 (5 Liter) | 0001 | 16 | 1,617.41 |
| PACKINGBATCH | 549 | 02014 | Plastic Can White 5 Liter | 0001 | 16 | 440 |
| PACKINGBATCH | 549 | 02272 | Label Stable C20  5Lit | 001 | 16 | 40 |
| PACKINGBATCH | 549 | 03119 | Stable C 20 Liquid | 0001 | 80 | 168.78 |
| PACKINGBATCH | 549 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 20 | 234.82 |
| PACKING | 549 | 00180 | Stable C 20 (5 Liter) | 0001 | 16 | 1,617.41 |
| PACKING | 550 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 44 | 1,111.11 |
| PACKINGBATCH | 550 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 440 |
| PACKINGBATCH | 550 | 02029 | Label Hepatic Optimizer 5 Liter | 0001 | 44 | 20 |
| PACKINGBATCH | 550 | 03011 | Hepatic-Optimizer Liquid | 0001 | 220 | 71.52 |
| PACKINGBATCH | 550 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 55 | 234.82 |
| PACKING | 550 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 44 | 1,111.11 |
| PACKING | 551 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 20 | 833.76 |
| PACKINGBATCH | 551 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 440 |
| PACKINGBATCH | 551 | 02267 | Label Ex.Tox Liquid  5Lit | 0001 | 20 | 40 |
| PACKINGBATCH | 551 | 03122 | Ex.Tox Liquid | 0001 | 100 | 70.75 |
| PACKING | 551 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 20 | 833.76 |
| PACKING | 552 | 00267 | Super Yeast Liquid 5 Liter | 0001 | 12 | 630 |
| PACKINGBATCH | 552 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 440 |
| PACKINGBATCH | 552 | 02291 | Label Super Yeast Liquid 5 Liter | 001 | 12 | 40 |
| PACKINGBATCH | 552 | 03086 | Super Yeast Liquid | 0001 | 60 | 30 |
| PACKING | 552 | 00267 | Super Yeast Liquid 5 Liter | 0001 | 12 | 630 |
| PRODUCTIONBATCH | 522 | 01003 | Bentonite |  | 0 | 0 |
| Production | 522 | 03014 | Magnet BOP Oral Powder |  | 0 | 0 |
| PACKING | 553 | 00199 | Yeast Plus Powder 25 kg | 0001 | 12 | 1,242.38 |
| PACKINGBATCH | 553 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 12 | 40 |
| PACKINGBATCH | 553 | 03144 | Yeast Plus Powder | 0001 | 300 | 40.5 |
| PACKINGBATCH | 553 | 02054 | White Bag Unprint | 0001 | 12 | 190 |
| PACKING | 553 | 00199 | Yeast Plus Powder 25 kg | 0001 | 12 | 1,242.38 |
| PACKING | 554 | 00138 | Bio Ambrox 5Lit | 0001 | 36 | 759.15 |
| PACKINGBATCH | 554 | 02014 | Plastic Can White 5 Liter | 0001 | 36 | 440 |
| PACKINGBATCH | 554 | 02147 | Label Bio Ambrox 5 Lit | 0001 | 36 | 40 |
| PACKINGBATCH | 554 | 03054 | Bio Ambrox  Liquid | 0001 | 180 | 55.83 |
| PACKING | 554 | 00138 | Bio Ambrox 5Lit | 0001 | 36 | 759.15 |
| PACKING | 555 | 00188 | TOXI GOLD Liquid 5 Liter | 0001 | 36 | 587.97 |
| PACKINGBATCH | 555 | 02014 | Plastic Can White 5 Liter | 0001 | 36 | 440 |
| PACKINGBATCH | 555 | 02210 | Label TOXI GOLD Liquid 5 Liter | 0001 | 36 | 40 |
| PACKINGBATCH | 555 | 03070 | Toxi Gold Liquid | 0001 | 180 | 21.59 |
| PACKING | 555 | 00188 | TOXI GOLD Liquid 5 Liter | 0001 | 36 | 587.97 |
| PACKING | 556 | 00287 | Flush Gold Oral Liquid 5 Lit | 0001 | 36 | 606.24 |
| PACKINGBATCH | 556 | 02014 | Plastic Can White 5 Liter | 0001 | 36 | 440 |
| PACKINGBATCH | 556 | 02343 | Label Flush Gold 5 Lit | 0001 | 36 | 40 |
| PACKINGBATCH | 556 | 03199 | Flush Gold Oral Liquid | 0001 | 180 | 25.25 |
| PACKING | 556 | 00287 | Flush Gold Oral Liquid 5 Lit | 0001 | 36 | 606.24 |
| Productions | 529 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.03 |
| PRODUCTIONBATCH | 529 | 01003 | Bentonite | 0001 | 50 | 13.03 |
| Productions | 529 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.03 |
| PACKING | 557 | 00022 | Magnet BOP 25kg | 0001 | 2 | 523.99 |
| PACKINGBATCH | 557 | 03014 | Magnet BOP Oral Powder | 0001 | 50 | 13.36 |
| PACKINGBATCH | 557 | 02054 | White Bag Unprint | 0001 | 2 | 190 |
| PACKING | 557 | 00022 | Magnet BOP 25kg | 0001 | 2 | 523.99 |
| PurchasesBatch | 273 | 02055 | Label Paower Plus 25 KG | 0001 | 26 | 140 |
| Productions | 530 | 03088 | Paower Plus | 0001 | 500 | 37.41 |
| PRODUCTIONBATCH | 530 | 01042 | Starch | 0001 | 6 | 165.2 |
| PRODUCTIONBATCH | 530 | 01043 | Sodium Chloride | 0001 | 100 | 13.75 |
| PRODUCTIONBATCH | 530 | 01050 | Tartrazine Yellow Color Indian | 001 | 4 | 3,100 |
| PRODUCTIONBATCH | 530 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 530 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| Productions | 530 | 03088 | Paower Plus | 0001 | 500 | 37.47 |
| Productions | 531 | 03014 | Magnet BOP Oral Powder | 0001 | 650 | 13.03 |
| PRODUCTIONBATCH | 531 | 01003 | Bentonite | 0001 | 650 | 13.03 |
| Productions | 532 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| PRODUCTIONBATCH | 532 | 01015 | DCP (Calcium) | 0001 | 500 | 17 |
| Productions | 533 | 03046 | Rumicid BOP Oral Powder | 0001 | 50 | 6.53 |
| PRODUCTIONBATCH | 533 | 01003 | Bentonite | 0001 | 0 | 13.03 |
| PRODUCTIONBATCH | 533 | 01044 | Sodium Bicarbonate | 0001 | 2 | 128 |
| Productions | 533 | 03046 | Rumicid BOP Oral Powder | 0001 | 50 | 6.53 |
| Productions | 534 | 03003 | Calci-Phos-D | 0001 | 10 | 34.09 |
| PRODUCTIONBATCH | 534 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 534 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 534 | 01038 | Phosphoric Acid 85% | 001 | 0 | 650 |
| PRODUCTIONBATCH | 534 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 534 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 534 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 534 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 534 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 534 | 03003 | Calci-Phos-D | 0001 | 10 | 34.09 |
| Productions | 535 | 03018 | Scour Guard | 0001 | 20 | 85.91 |
| PRODUCTIONBATCH | 535 | 01027 | Kaolin | 001 | 3 | 400 |
| PRODUCTIONBATCH | 535 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 535 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 535 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 535 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 535 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| Productions | 535 | 03018 | Scour Guard | 0001 | 20 | 85.91 |
| Productions | 536 | 03012 | Kirzan BOP | 0001 | 10 | 111.81 |
| PRODUCTIONBATCH | 536 | 01027 | Kaolin | 001 | 1 | 400 |
| PRODUCTIONBATCH | 536 | 01041 | Sodium Benzoate | 0001 | 0 | 560.01 |
| PRODUCTIONBATCH | 536 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 536 | 01058 | Xanthan Gum | 0001 | 0 | 1,400.15 |
| PRODUCTIONBATCH | 536 | 01117 | Magnesium Oxide | 0001 | 0 | 420 |
| PRODUCTIONBATCH | 536 | 01193 | Castor Oil | 0001 | 0 | 870 |
| Productions | 536 | 03012 | Kirzan BOP | 0001 | 10 | 111.81 |
| Productions | 537 | 03182 | GrowMore Powder | 0001 | 15 | 13.25 |
| PRODUCTIONBATCH | 537 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 537 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 537 | 01042 | Starch | 0001 | 0 | 165.2 |
| PRODUCTIONBATCH | 537 | 01043 | Sodium Chloride | 0001 | 3 | 13.75 |
| PRODUCTIONBATCH | 537 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 537 | 01053 | Vitamin B1 | 0001 | 0 | 17,499.52 |
| PRODUCTIONBATCH | 537 | 01054 | Vitamin B2 | 0001 | 0 | 17,499.11 |
| PRODUCTIONBATCH | 537 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 537 | 03182 | GrowMore Powder | 0001 | 15 | 13.25 |
| PACKING | 558 | 00022 | Magnet BOP 25kg | 0001 | 26 | 326.8 |
| PACKINGBATCH | 558 | 03014 | Magnet BOP Oral Powder | 0001 | 650 | 13.07 |
| PACKING | 558 | 00022 | Magnet BOP 25kg | 0001 | 26 | 326.8 |
| PACKING | 559 | 00231 | Calcium 72 25kg | 0001 | 20 | 525 |
| PACKINGBATCH | 559 | 02274 | Bag Calcium 72  25kg | 0001 | 20 | 100 |
| PACKINGBATCH | 559 | 03163 | Calcium 72 | 0001 | 500 | 17 |
| PACKING | 560 | 00220 | Rumicid powder 25kg | 0001 | 2 | 204.77 |
| PACKINGBATCH | 560 | 02258 | Label Rumicid 25kg | 0001 | 2 | 41.51 |
| PACKINGBATCH | 560 | 03046 | Rumicid BOP Oral Powder | 0001 | 50 | 6.53 |
| PACKING | 560 | 00220 | Rumicid powder 25kg | 0001 | 2 | 204.77 |
| PACKING | 561 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 149.05 |
| PACKINGBATCH | 561 | 03003 | Calci-Phos-D | 0001 | 10 | 26.32 |
| PACKINGBATCH | 561 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 100 | 146.41 |
| PACKING | 561 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 149.05 |
| PACKING | 562 | 00008 | Scour Guard100ML | 0001 | 20 | 20.59 |
| PACKINGBATCH | 562 | 02020 | S+D Scour Guard100 ML | 0001 | 20 | 12 |
| PACKINGBATCH | 562 | 03018 | Scour Guard | 0001 | 2 | 85.91 |
| PACKING | 562 | 00008 | Scour Guard100ML | 0001 | 20 | 20.59 |
| PACKING | 563 | 00263 | GrowMore 100gm | 0001 | 150 | 12.89 |
| PACKINGBATCH | 563 | 02320 | Packet GrowMore 100 gm | 0001 | 150 | 10 |
| PACKINGBATCH | 563 | 03182 | GrowMore Powder | 0001 | 15 | 13.25 |
| PACKINGBATCH | 563 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 1 | 234.82 |
| PACKING | 563 | 00263 | GrowMore 100gm | 0001 | 150 | 12.89 |
| PurchasesBatch | 274 | 01184 | ARQ | 0001 | 60 | 367 |
| PurchasesBatch | 274 | 01044 | Sodium Bicarbonate | 0001 | 50 | 128 |
| PurchasesBatch | 275 | 02014 | Plastic Can White 5 Liter | 0001 | 340 | 440 |
| PurchasesBatch | 276 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 40 | 227 |
| PurchasesBatch | 277 | 02026 | Label Toxi Lic 5 Liter | 0001 | 150 | 30 |
| PurchasesBatch | 277 | 02163 | Label Calpho Lic Liquid 5 Lit | 0001 | 30 | 40 |
| PurchasesBatch | 277 | 02168 | Label Minro-Lic 25 Kg | 0001 | 200 | 40 |
| PurchasesBatch | 277 | 02041 | Label Growth Promoter Plus 25 KG | 0001 | 12 | 120 |
| PurchasesBatch | 277 | 02219 | Label Sachro-lic Oral Powder 25 KG | 0001 | 20 | 120 |
| PurchasesBatch | 277 | 02329 | Label Merlin Fix Oral Powder 25 kg | 0001 | 20 | 240 |
| PurchasesBatch | 277 | 02345 | Label Acido Forte 25 Lit | 0001 | 20 | 75 |
| PurchasesBatch | 277 | 02332 | Label Task 1 Oral Liquid  5 Liter | 0001 | 55 | 80 |
| PurchasesBatch | 277 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 55 | 80 |
| PurchasesBatch | 277 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 55 | 80 |
| PurchasesBatch | 277 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 160 | 80 |
| PurchasesBatch | 277 | 02342 | Label Frost Oral Liquid 5 Liter | 0001 | 55 | 80 |
| PurchasesBatch | 277 | 02336 | Label TopVit Oral Liquid  5 Liter | 0001 | 55 | 80 |
| PurchasesBatch | 277 | 02435 | Label CS Guard 20 Oral Liquid 5 Lit | 0001 | 30 | 80 |
| PurchasesBatch | 277 | 02436 | Label Vital Frame Oral Liquid 5 Lit | 0001 | 30 | 80 |
| PurchasesBatch | 277 | 02331 | Label CRD Mint Oral Liquid  1 Liter | 0001 | 72 | 40 |
| PurchasesBatch | 277 | 02291 | Label Super Yeast Liquid 5 Liter | 0001 | 50 | 40 |
| PurchasesBatch | 278 | 01046 | Silmyrin | 0001 | 25 | 10,500 |
| PurchasesBatch | 278 | 01053 | Vitamin B1 | 0001 | 5 | 14,500 |
| PurchasesBatch | 278 | 01054 | Vitamin B2 | 0001 | 10 | 16,500 |
| PurchasesBatch | 277 | 02213 | Bag Bop Red Colour | 0001 | 1,000 | 168 |
| PurchasesBatch | 277 | 02307 | Bag Bop Blue Colour | 0001 | 1,040 | 168 |
| PurchasesBatch | 277 | 02277 | Bag Bop Yellow Colour | 0001 | 1,030 | 168 |
| Productions | 538 | 03163 | Calcium 72 | 080826 | 2,525 | 0 |
| PRODUCTIONBATCH | 538 | 01015 | DCP (Calcium) | 0001 | 2,525 | 17 |
| Productions | 538 | 03163 | Calcium 72 | 080826 | 2,525 | 17 |
| Productions | 539 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,250 | 6.53 |
| PRODUCTIONBATCH | 539 | 01003 | Bentonite | 0001 | 12 | 13.03 |
| PRODUCTIONBATCH | 539 | 01044 | Sodium Bicarbonate | 0001 | 62 | 128 |
| Productions | 540 | 03014 | Magnet BOP Oral Powder | 0001 | 1,275 | 13.03 |
| PRODUCTIONBATCH | 540 | 01003 | Bentonite | 0001 | 1,275 | 13.03 |
| Productions | 541 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 204.62 |
| PRODUCTIONBATCH | 541 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 541 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 541 | 01020 | Formic Acid | 0001 | 5 | 314.71 |
| PRODUCTIONBATCH | 541 | 01021 | Glacial Acetic Acid | 0001 | 5 | 340.07 |
| PRODUCTIONBATCH | 541 | 01041 | Sodium Benzoate | 0001 | 2 | 560.01 |
| PRODUCTIONBATCH | 541 | 01046 | Silmyrin | 0001 | 7 | 10,502.1 |
| PRODUCTIONBATCH | 541 | 01184 | ARQ | 0001 | 50 | 367 |
| Productions | 541 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 204.62 |
| Productions | 542 | 03106 | Calpho Lic Liquid | 0001 | 100 | 25.31 |
| PRODUCTIONBATCH | 542 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 542 | 01038 | Phosphoric Acid 85% | 001 | 1 | 650 |
| PRODUCTIONBATCH | 542 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 542 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 542 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 542 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 542 | 03106 | Calpho Lic Liquid | 0001 | 100 | 25.31 |
| PACKING | 564 | 00231 | Calcium 72 25kg | 0001 | 101 | 525 |
| PACKINGBATCH | 564 | 02274 | Bag Calcium 72  25kg | 0001 | 101 | 100 |
| PACKINGBATCH | 564 | 03163 | Calcium 72 | 080826 | 2,525 | 17 |
| PACKING | 565 | 00220 | Rumicid powder 25kg | 0001 | 50 | 372.77 |
| PACKINGBATCH | 565 | 02258 | Label Rumicid 25kg | 0001 | 50 | 41.51 |
| PACKINGBATCH | 565 | 02307 | Bag Bop Blue Colour | 0001 | 50 | 168 |
| PACKINGBATCH | 565 | 03046 | Rumicid BOP Oral Powder | 0001 | 1,250 | 6.53 |
| PACKING | 565 | 00220 | Rumicid powder 25kg | 0001 | 50 | 372.77 |
| OpeningBatch | 59 | 02033 | BAG Magnet 25 KG | 0001 | 650 | 155 |
| PACKING | 566 | 00022 | Magnet BOP 25kg | 0001 | 51 | 480.87 |
| PACKINGBATCH | 566 | 02033 | BAG Magnet 25 KG | 0001 | 51 | 155 |
| PACKINGBATCH | 566 | 03014 | Magnet BOP Oral Powder | 0001 | 1,275 | 13.03 |
| PACKING | 566 | 00022 | Magnet BOP 25kg | 0001 | 51 | 480.87 |
| PACKING | 567 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 1,549.85 |
| PACKINGBATCH | 567 | 02014 | Plastic Can White 5 Liter | 0001 | 100 | 440 |
| PACKINGBATCH | 567 | 02026 | Label Toxi Lic 5 Liter | 0001 | 100 | 30 |
| PACKINGBATCH | 567 | 03020 | Toxi-Lic Liquid | 0001 | 500 | 204.62 |
| PACKINGBATCH | 567 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 25 | 227 |
| PACKING | 567 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 1,549.85 |
| PACKING | 568 | 00150 | Calpho Lic Liquid 5 Lit | 0001 | 20 | 776.82 |
| PACKINGBATCH | 568 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 440 |
| PACKINGBATCH | 568 | 02163 | Label Calpho Lic Liquid 5 Lit | 0001 | 20 | 40 |
| PACKINGBATCH | 568 | 03106 | Calpho Lic Liquid | 0001 | 100 | 25.31 |
| PACKINGBATCH | 568 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 15 | 227 |
| PACKING | 568 | 00150 | Calpho Lic Liquid 5 Lit | 0001 | 20 | 776.82 |
| PurchasesBatch | 279 | 01016 | DCP (Dana) | 0001 | 17,180 | 10 |
| Productions | 543 | 03110 | Minro-Lic mineral | 0001 | 500 | 17.36 |
| PRODUCTIONBATCH | 543 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 543 | 01042 | Starch | 0001 | 6 | 165.2 |
| PRODUCTIONBATCH | 543 | 01043 | Sodium Chloride | 0001 | 100 | 13.75 |
| PRODUCTIONBATCH | 543 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| Productions | 543 | 03110 | Minro-Lic mineral | 0001 | 500 | 17.36 |
| Productions | 544 | 03141 | Sachro-lic Oral Powder | 0001 | 500 | 11.52 |
| PRODUCTIONBATCH | 544 | 01003 | Bentonite | 0001 | 250 | 13.03 |
| PRODUCTIONBATCH | 544 | 01033 | Molasses | 0001 | 50 | 50 |
| Productions | 545 | 03134 | DCP Powder 29 % | 0001 | 125 | 10.8 |
| PRODUCTIONBATCH | 545 | 01015 | DCP (Calcium) | 0001 | 62 | 17 |
| PRODUCTIONBATCH | 545 | 01190 | PHOSPHORUS Powder 29% | 0001 | 25 | 11.5 |
| Productions | 546 | 03151 | Microgold-Bop | 0001 | 75 | 54.13 |
| PRODUCTIONBATCH | 546 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 546 | 01013 | Calcium Chloride | 0001 | 0 | 209.98 |
| PRODUCTIONBATCH | 546 | 01016 | DCP (Dana) | 0001 | 60 | 10 |
| PRODUCTIONBATCH | 546 | 01034 | Magnesium Sulphate | 0001 | 0 | 559.15 |
| PRODUCTIONBATCH | 546 | 01042 | Starch | 0001 | 0 | 165.2 |
| PRODUCTIONBATCH | 546 | 01043 | Sodium Chloride | 0001 | 15 | 13.75 |
| PRODUCTIONBATCH | 546 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 546 | 01053 | Vitamin B1 | 0001 | 0 | 15,760.35 |
| PRODUCTIONBATCH | 546 | 01054 | Vitamin B2 | 0001 | 0 | 16,752.11 |
| PRODUCTIONBATCH | 546 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 546 | 01057 | Vitamin B6 | 0001 | 0 | 12,863.29 |
| PRODUCTIONBATCH | 546 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 546 | 01072 | Vitamin E | 0001 | 0 | 9,146.18 |
| PRODUCTIONBATCH | 546 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| PRODUCTIONBATCH | 546 | 01143 | Vitamin B3 | 0001 | 0 | 3,200 |
| Productions | 546 | 03151 | Microgold-Bop | 0001 | 75 | 54.13 |
| Productions | 547 | 03022 | Growth Promoter Plus | 0001 | 250 | 43.75 |
| PRODUCTIONBATCH | 547 | 01003 | Bentonite | 0001 | 200 | 13.03 |
| PRODUCTIONBATCH | 547 | 01031 | Menthol Crystal | 001 | 0 | 6,500 |
| PRODUCTIONBATCH | 547 | 01059 | Wheat Bran | 0001 | 50 | 72.45 |
| Productions | 547 | 03022 | Growth Promoter Plus | 0001 | 250 | 44.42 |
| PACKING | 569 | 00158 | Minro-Lic mineral 25 Kg | 0001 | 20 | 619.04 |
| PACKINGBATCH | 569 | 02168 | Label Minro-Lic 25 Kg | 0001 | 20 | 40 |
| PACKINGBATCH | 569 | 02173 | Bag UnPrint idyLic 25 Kg | 0001 | 20 | 145 |
| PACKINGBATCH | 569 | 03110 | Minro-Lic mineral | 0001 | 500 | 17.36 |
| PACKING | 569 | 00158 | Minro-Lic mineral 25 Kg | 0001 | 20 | 619.04 |
| PACKING | 570 | 00196 | Sachro-lic Oral Powder 25 KG | 0001 | 20 | 552.9 |
| PACKINGBATCH | 570 | 02173 | Bag UnPrint idyLic 25 Kg | 0001 | 20 | 145 |
| PACKINGBATCH | 570 | 02219 | Label Sachro-lic Oral Powder 25 KG | 0001 | 20 | 120 |
| PACKINGBATCH | 570 | 03141 | Sachro-lic Oral Powder | 0001 | 500 | 11.52 |
| OpeningBatch | 61 | 02034 | BAG BOP DCP 25 KG | 0001 | 606 | 80 |
| PACKING | 571 | 00186 | DCP Powder - 29 %.   25 kg | 0001 | 5 | 270 |
| PACKINGBATCH | 571 | 03134 | DCP Powder 29 % | 0001 | 125 | 10.8 |
| PACKING | 572 | 00212 | Microgold-Bop 25 kg | 0001 | 3 | 1,561.25 |
| PACKINGBATCH | 572 | 02245 | Label Microgold-Bop 25 kg | 0001 | 3 | 40 |
| PACKINGBATCH | 572 | 02307 | Bag Bop Blue Colour | 0001 | 3 | 168 |
| PACKINGBATCH | 572 | 03151 | Microgold-Bop | 0001 | 75 | 54.13 |
| PACKING | 572 | 00212 | Microgold-Bop 25 kg | 0001 | 3 | 1,561.25 |
| PACKING | 573 | 00041 | Growth Promoter Plus 25kg | 0001 | 10 | 1,308 |
| PACKINGBATCH | 573 | 02041 | Label Growth Promoter Plus 25 KG | 0001 | 10 | 120 |
| PACKINGBATCH | 573 | 02307 | Bag Bop Blue Colour | 0001 | 10 | 168 |
| PACKINGBATCH | 573 | 03022 | Growth Promoter Plus | 001 | 250 | 37.18 |
| PACKING | 573 | 00041 | Growth Promoter Plus 25kg | 0001 | 10 | 1,217.62 |
| PurchasesBatch | 280 | 02014 | Plastic Can White 5 Liter | 0001 | 306 | 440 |
| PurchasesBatch | 281 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 155 | 235 |
| PurchasesBatch | 281 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 10 | 176 |
| PurchasesBatch | 282 | 01019 | Eucluptus Oil | 0001 | 6 | 5,200 |
| PurchasesBatch | 282 | 01075 | Peppermint Oil | 0001 | 6 | 4,700 |
| PurchasesBatch | 283 | 02173 | Bag UnPrint idyLic 25 Kg | 0001 | 20 | 190 |
| SALESBATCH | 247 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 2 | 547.85 |
| SALESBATCH | 248 | 00258 | GrowMore 25KG | 0001 | 10 | 2,608.89 |
| SALESBATCH | 248 | 00363 | PhytoFat Gold 25 Kg | 0001 | 10 | 14,000 |
| SALESBATCH | 249 | 00258 | GrowMore 25KG | 0001 | 10 | 2,608.89 |
| SALESBATCH | 249 | 00363 | PhytoFat Gold 25 Kg | 0001 | 5 | 14,000 |
| SALESBATCH | 250 | 00247 | Ampro-Plus Liquid 5L | 0001 | 52 | 1,429.43 |
| SALESBATCH | 251 | 00407 | LEO Civon 5 LIT | 0001 | 20 | 744.09 |
| SALESBATCH | 251 | 00407 | LEO Civon 5 LIT |  | 0 | 0 |
| SALESBATCH | 252 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 1,215.24 |
| SALESBATCH | 253 | 00266 | E.S  200 liquid 5 Liter | 0001 | 44 | 895 |
| SALESBATCH | 254 | 00363 | PhytoFat Gold 25 Kg | 0001 | 10 | 14,000 |
| SALESBATCH | 255 | 00377 | BOP DCAD Powder 25 kg | 0001 | 10 | 2,170.9 |
| SALESBATCH | 255 | 00220 | Rumicid powder 25kg | 0001 | 25 | 375.55 |
| SALESBATCH | 255 | 00180 | Stable C 20 (5 Liter) | 0001 | 8 | 1,561.84 |
| SALESBATCH | 256 | 00258 | GrowMore 25KG | 0001 | 93 | 2,608.89 |
| SALESBATCH | 256 | 00265 | GrowMore 1Kg | 0001 | 500 | 49.19 |
| SALESBATCH | 256 | 00008 | Scour Guard100ML | 0001 | 950 | 20.59 |
| SALESBATCH | 256 | 00032 | Calci-Phos-D 1000ml | 0001 | 360 | 276.71 |
| PACKING | 574 | 00010 | Calci-Phos-D100ML | 0001 | 1,600 | 11.94 |
| PACKINGBATCH | 574 | 03003 | Calci-Phos-D | 0001 | 160 | 26.32 |
| PACKINGBATCH | 574 | 02010 | Bottle Pet Amber 100ML | 0001 | 1,600 | 7.8 |
| PACKINGBATCH | 574 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 16 | 146.41 |
| PACKING | 574 | 00010 | Calci-Phos-D100ML | 0001 | 1,600 | 11.9 |
| SALESBATCH | 256 | 00010 | Calci-Phos-D100ML | 0001 | 1,600 | 19.96 |
| SALESBATCH | 256 | 00231 | Calcium 72 25kg | 0001 | 100 | 425.32 |
| SALESBATCH | 256 | 00248 | Calcium-72 1KG | 0001 | 425 | 49.47 |
| OpeningBatch | 120 | 00013 | Kirzan BOP 100ml | 0001 | 100 | 64 |
| SALESBATCH | 256 | 00013 | Kirzan BOP 100ml | 0001 | 425 | 46.62 |
| PurchasesBatch | 284 | 01143 | Vitamin B3 | 0001 | 50 | 3,400 |
| PurchasesBatch | 284 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 25 | 1,550 |
| PurchasesBatch | 284 | 01038 | Phosphoric Acid 85% | 0001 | 35 | 650 |
| PurchasesBatch | 284 | 01010 | Betaine | 0001 | 25 | 2,800 |
| PurchasesBatch | 284 | 01013 | Calcium Chloride | 0001 | 25 | 260 |
| PurchasesBatch | 284 | 01041 | Sodium Benzoate | 0001 | 25 | 560 |
| PurchasesBatch | 284 | 01058 | Xanthan Gum | 0001 | 25 | 1,450 |
| PurchasesBatch | 284 | 01201 | I.P.A | 0001 | 90 | 750 |
| PurchasesBatch | 284 | 01189 | Glycerine | 0001 | 70 | 700 |
| PurchasesBatch | 284 | 01031 | Menthol Crystal | 0001 | 25 | 6,500 |
| PurchasesBatch | 284 | 01080 | Capsicum Oil | 0001 | 5 | 5,800 |
| PurchasesBatch | 284 | 01057 | Vitamin B6 | 0001 | 10 | 12,500 |
| Productions | 548 | 03194 | MLC 100  Oral Liquid | 0001 | 200 | 107.28 |
| PRODUCTIONBATCH | 548 | 01009 | Copper Sulphate | 001 | 3 | 2,200 |
| PRODUCTIONBATCH | 548 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 548 | 01020 | Formic Acid | 0001 | 1 | 314.71 |
| PRODUCTIONBATCH | 548 | 01021 | Glacial Acetic Acid | 0001 | 1 | 340.07 |
| PRODUCTIONBATCH | 548 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 548 | 01041 | Sodium Benzoate | 0001 | 1 | 560 |
| PRODUCTIONBATCH | 548 | 01045 | Sorbitol Liquid 70% | 001 | 4 | 350 |
| PRODUCTIONBATCH | 548 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 548 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PRODUCTIONBATCH | 548 | 01115 | Calcium Propionate | 001 | 0 | 650 |
| PRODUCTIONBATCH | 548 | 01184 | ARQ | 0001 | 10 | 367 |
| Productions | 548 | 03194 | MLC 100  Oral Liquid | 0001 | 200 | 106.01 |
| Productions | 549 | 03192 | Immunit Z Oral Liquid | 0001 | 200 | 28.57 |
| PRODUCTIONBATCH | 549 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 549 | 01045 | Sorbitol Liquid 70% | 001 | 10 | 350 |
| PRODUCTIONBATCH | 549 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 549 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 549 | 03192 | Immunit Z Oral Liquid | 0001 | 200 | 26.77 |
| Productions | 550 | 03198 | Frost Oral Liquid | 0001 | 200 | 16.13 |
| PRODUCTIONBATCH | 550 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 550 | 01034 | Magnesium Sulphate | 0001 | 0 | 559.15 |
| PRODUCTIONBATCH | 550 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 550 | 01043 | Sodium Chloride | 0001 | 0 | 13.75 |
| PRODUCTIONBATCH | 550 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 550 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 550 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| PRODUCTIONBATCH | 550 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| Productions | 550 | 03198 | Frost Oral Liquid | 0001 | 200 | 16.13 |
| Productions | 551 | 03191 | Task 1 Oral Liquid | 0001 | 160 | 92.61 |
| PRODUCTIONBATCH | 551 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 551 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 551 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 551 | 01020 | Formic Acid | 0001 | 0 | 314.71 |
| PRODUCTIONBATCH | 551 | 01021 | Glacial Acetic Acid | 0001 | 0 | 340.07 |
| PRODUCTIONBATCH | 551 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 551 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 551 | 01045 | Sorbitol Liquid 70% | 001 | 3 | 350 |
| PRODUCTIONBATCH | 551 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 551 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PRODUCTIONBATCH | 551 | 01115 | Calcium Propionate | 001 | 0 | 650 |
| PRODUCTIONBATCH | 551 | 01184 | ARQ | 0001 | 11 | 367 |
| Productions | 551 | 03191 | Task 1 Oral Liquid | 0001 | 160 | 91.62 |
| Productions | 552 | 03193 | TopVit Oral Liquid | 0001 | 220 | 253.07 |
| PRODUCTIONBATCH | 552 | 01007 | CSL | 0001 | 1 | 35 |
| PRODUCTIONBATCH | 552 | 01009 | Copper Sulphate | 001 | 4 | 2,200 |
| PRODUCTIONBATCH | 552 | 01041 | Sodium Benzoate | 0001 | 1 | 560 |
| PRODUCTIONBATCH | 552 | 01045 | Sorbitol Liquid 70% | 001 | 30 | 350 |
| PRODUCTIONBATCH | 552 | 01053 | Vitamin B1 | 0001 | 0 | 15,760.35 |
| PRODUCTIONBATCH | 552 | 01054 | Vitamin B2 | 0001 | 0 | 16,752.11 |
| PRODUCTIONBATCH | 552 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 552 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 552 | 01057 | Vitamin B6 | 0001 | 0 | 12,640.67 |
| PRODUCTIONBATCH | 552 | 01058 | Xanthan Gum | 0001 | 1 | 1,449.92 |
| PRODUCTIONBATCH | 552 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| PRODUCTIONBATCH | 552 | 01143 | Vitamin B3 | 0001 | 0 | 3,396.86 |
| Productions | 552 | 03193 | TopVit Oral Liquid | 0001 | 220 | 248.05 |
| Productions | 553 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 267.52 |
| PRODUCTIONBATCH | 553 | 01009 | Copper Sulphate | 001 | 10 | 2,200 |
| PRODUCTIONBATCH | 553 | 01021 | Glacial Acetic Acid | 0001 | 1 | 340.07 |
| PRODUCTIONBATCH | 553 | 01028 | Lactic Acid | 0001 | 1 | 1,650 |
| PRODUCTIONBATCH | 553 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 553 | 01045 | Sorbitol Liquid 70% | 001 | 2 | 350 |
| PRODUCTIONBATCH | 553 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 553 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 266.64 |
| Productions | 554 | 03190 | CRD Mint Oral Liquid | 0001 | 500 | 314.62 |
| PRODUCTIONBATCH | 554 | 01019 | Eucluptus Oil | 0001 | 5 | 5,200 |
| PRODUCTIONBATCH | 554 | 01031 | Menthol Crystal | 001 | 3 | 6,500 |
| PRODUCTIONBATCH | 554 | 01031 | Menthol Crystal | 0001 | 1 | 6,494.73 |
| PRODUCTIONBATCH | 554 | 01041 | Sodium Benzoate | 0001 | 2 | 560 |
| PRODUCTIONBATCH | 554 | 01058 | Xanthan Gum | 0001 | 1 | 1,449.92 |
| PRODUCTIONBATCH | 554 | 01075 | Peppermint Oil | 001 | 4 | 5,000 |
| PRODUCTIONBATCH | 554 | 01075 | Peppermint Oil | 0001 | 0 | 4,710.44 |
| PRODUCTIONBATCH | 554 | 01189 | Glycerine | 001 | 11 | 650 |
| PRODUCTIONBATCH | 554 | 01189 | Glycerine | 0001 | 38 | 700.02 |
| PRODUCTIONBATCH | 554 | 01201 | I.P.A | 001 | 50 | 750 |
| Productions | 554 | 03190 | CRD Mint Oral Liquid | 0001 | 500 | 316.89 |
| Productions | 555 | 03189 | Merlin Fix Oral Powder | 0001 | 500 | 25.89 |
| PRODUCTIONBATCH | 555 | 01003 | Bentonite | 0001 | 490 | 13.03 |
| PRODUCTIONBATCH | 555 | 01115 | Calcium Propionate | 001 | 5 | 650 |
| PRODUCTIONBATCH | 555 | 01187 | Sodium Metaby Sulphate | 0001 | 5 | 387.09 |
| Productions | 555 | 03189 | Merlin Fix Oral Powder | 0001 | 500 | 23.14 |
| PACKING | 575 | 00281 | MLC 100  Oral Liquid 5 Liter | 090826 | 40 | 0 |
| PACKINGBATCH | 575 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 440 |
| PACKINGBATCH | 575 | 02337 | Label MLC 100  Oral Liquid 5 Liter | 0001 | 40 | 80 |
| PACKINGBATCH | 575 | 03194 | MLC 100  Oral Liquid | 0001 | 200 | 106.01 |
| PACKINGBATCH | 575 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 235 |
| PACKING | 575 | 00281 | MLC 100  Oral Liquid 5 Liter | 090826 | 40 | 1,108.81 |
| PACKING | 576 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 712.62 |
| PACKINGBATCH | 576 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 440 |
| PACKINGBATCH | 576 | 02334 | Label Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 80 |
| PACKINGBATCH | 576 | 03192 | Immunit Z Oral Liquid | 0001 | 200 | 26.77 |
| PACKINGBATCH | 576 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 235 |
| PACKING | 576 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 712.62 |
| PACKING | 577 | 00286 | Frost Oral Liquid 5 liter | 0001 | 40 | 659.39 |
| PACKINGBATCH | 577 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 440 |
| PACKINGBATCH | 577 | 02342 | Label Frost Oral Liquid 5 Liter | 0001 | 40 | 80 |
| PACKINGBATCH | 577 | 03198 | Frost Oral Liquid | 0001 | 200 | 16.13 |
| PACKINGBATCH | 577 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 235 |
| PACKING | 577 | 00286 | Frost Oral Liquid 5 liter | 0001 | 40 | 659.39 |
| PACKING | 578 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 32 | 1,056.85 |
| PACKINGBATCH | 578 | 02014 | Plastic Can White 5 Liter | 0001 | 32 | 440 |
| PACKINGBATCH | 578 | 02332 | Label Task 1 Oral Liquid  5 Liter | 0001 | 40 | 80 |
| PACKINGBATCH | 578 | 03191 | Task 1 Oral Liquid | 0001 | 160 | 91.62 |
| PACKINGBATCH | 578 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 8 | 235 |
| PACKING | 578 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 32 | 1,056.85 |
| PACKING | 579 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 44 | 1,819.02 |
| PACKINGBATCH | 579 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 440 |
| PACKINGBATCH | 579 | 02336 | Label TopVit Oral Liquid  5 Liter | 0001 | 44 | 80 |
| PACKINGBATCH | 579 | 03193 | TopVit Oral Liquid | 0001 | 220 | 248.05 |
| PACKINGBATCH | 579 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 11 | 235 |
| PACKING | 579 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 44 | 1,819.02 |
| PACKING | 580 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 0001 | 20 | 1,911.95 |
| PACKINGBATCH | 580 | 02014 | Plastic Can White 5 Liter | 0001 | 20 | 440 |
| PACKINGBATCH | 580 | 02435 | Label CS Guard 20 Oral Liquid 5 Lit | 0001 | 20 | 80 |
| PACKINGBATCH | 580 | 03265 | CS Guard 20 Oral Liquid | 0001 | 100 | 266.64 |
| PACKINGBATCH | 580 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 235 |
| PACKING | 580 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 0001 | 20 | 1,911.95 |
| PACKING | 581 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 88 | 2,163.21 |
| PACKINGBATCH | 581 | 02014 | Plastic Can White 5 Liter | 0001 | 88 | 440 |
| PACKINGBATCH | 581 | 02330 | Label CRD Mint Oral Liquid 5 Liter | 0001 | 88 | 80 |
| PACKINGBATCH | 581 | 03190 | CRD Mint Oral Liquid | 0001 | 440 | 316.89 |
| PACKINGBATCH | 581 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 22 | 235 |
| PACKING | 581 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 88 | 2,163.21 |
| PACKING | 582 | 00275 | CRD Mint Oral Liquid  1 Liter | 0001 | 60 | 370.76 |
| PACKINGBATCH | 582 | 02331 | Label CRD Mint Oral Liquid  1 Liter | 0001 | 60 | 40 |
| PACKINGBATCH | 582 | 03190 | CRD Mint Oral Liquid | 0001 | 60 | 316.89 |
| PACKINGBATCH | 582 | 02002 | Shipper [B] 12 Bottle (1 Liter) | 0001 | 4 | 208 |
| PACKING | 582 | 00275 | CRD Mint Oral Liquid  1 Liter | 0001 | 60 | 370.76 |
| PACKING | 583 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 818.56 |
| PACKINGBATCH | 583 | 02329 | Label Merlin Fix Oral Powder 25 kg | 0001 | 20 | 240 |
| PACKINGBATCH | 583 | 03189 | Merlin Fix Oral Powder | 0001 | 500 | 23.14 |
| PACKING | 583 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 818.56 |
| PurchasesBatch | 285 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 44 | 235 |
| PurchasesBatch | 286 | 02097 | Bottle Round liter | 0001 | 60 | 230 |
| PurchasesBatch | 287 | 01184 | ARQ | 0001 | 60 | 367 |
| PurchasesBatch | 288 | 02358 | Label Bentox Plus Oral Powder 25 kg | 0001 | 6 | 140 |
| SALESBATCH | 257 | 00052 | Hepatic-Optimizer 5Lit | 0001 | 44 | 1,111.11 |
| SALESBATCH | 257 | 00170 | Ex.Tox Liquid 5 Lit | 0001 | 20 | 833.76 |
| SALESBATCH | 257 | 00180 | Stable C 20 (5 Liter) | 0001 | 8 | 1,561.84 |
| SALESBATCH | 257 | 00267 | Super Yeast Liquid 5 Liter | 0001 | 12 | 630 |
| SALESBATCH | 258 | 00199 | Yeast Plus Powder 25 kg | 0001 | 10 | 1,215.24 |
| Productions | 556 | 03088 | Paower Plus | 0001 | 500 | 45.27 |
| PRODUCTIONBATCH | 556 | 01016 | DCP (Dana) | 0001 | 400 | 10 |
| PRODUCTIONBATCH | 556 | 01042 | Starch | 0001 | 6 | 165.2 |
| PRODUCTIONBATCH | 556 | 01043 | Sodium Chloride | 0001 | 100 | 13.75 |
| PRODUCTIONBATCH | 556 | 01050 | Tartrazine Yellow Color Indian | 0001 | 5 | 3,086.04 |
| PRODUCTIONBATCH | 556 | 01054 | Vitamin B2 | 0001 | 0 | 16,752.11 |
| Productions | 556 | 03088 | Paower Plus | 0001 | 500 | 45.27 |
| PACKING | 584 | 00037 | paower Plus 25kg | 0001 | 20 | 1,384.22 |
| PACKINGBATCH | 584 | 02055 | Label Paower Plus 25 KG | 0001 | 26 | 140 |
| PACKINGBATCH | 584 | 02307 | Bag Bop Blue Colour | 0001 | 20 | 168 |
| PACKINGBATCH | 584 | 03088 | Paower Plus | 0001 | 500 | 41.37 |
| PACKING | 584 | 00037 | paower Plus 25kg | 0001 | 20 | 1,384.22 |
| SALESBATCH | 259 | 00037 | paower Plus 25kg | 0001 | 20 | 1,384.22 |
| SALESBATCH | 259 | 00022 | Magnet BOP 25kg | 0001 | 20 | 426.91 |
| SALESBATCH | 259 | 00231 | Calcium 72 25kg | 0001 | 20 | 425.32 |
| SALESBATCH | 260 | 00363 | PhytoFat Gold 25 Kg | 0001 | 16 | 14,000 |
| PACKING | 562 | 00008 | Scour Guard100ML | 0001 | 200 | 20.59 |
| PACKINGBATCH | 562 | 02020 | S+D Scour Guard100 ML |  | 0 | 0 |
| PACKINGBATCH | 562 | 02020 | S+D Scour Guard100 ML | 0001 | 200 | 12 |
| PACKINGBATCH | 562 | 03018 | Scour Guard |  | 0 | 0 |
| PACKINGBATCH | 562 | 03018 | Scour Guard | 0001 | 20 | 85.91 |
| PACKINGBATCH | 562 | 02010 | Bottle Pet Amber 100ML | 0001 | 205 | 7.8 |
| PACKINGBATCH | 562 | 02006 | Shipper [F] 100 pcs bottle Pet 100 ML | 0001 | 2 | 146.41 |
| PACKING | 562 | 00008 | Scour Guard100ML | 0001 | 200 | 30.05 |
| SALESBATCH | 261 | 00010 | Calci-Phos-D100ML | 0001 | 100 | 19.96 |
| SALESBATCH | 261 | 00008 | Scour Guard100ML | 0001 | 200 | 30.05 |
| OpeningBatch | 120 | 00013 | Kirzan BOP 100ml | 0001 | 200 | 64 |
| SALESBATCH | 261 | 00013 | Kirzan BOP 100ml | 0001 | 100 | 64 |
| SALESBATCH | 261 | 00263 | GrowMore 100gm | 0001 | 150 | 12.89 |
| SALESBATCH | 262 | 00231 | Calcium 72 25kg | 0001 | 100 | 425.32 |
| SALESBATCH | 262 | 00220 | Rumicid powder 25kg | 0001 | 50 | 375.55 |
| SALESBATCH | 262 | 00022 | Magnet BOP 25kg | 0001 | 50 | 426.91 |
| SALESBATCH | 263 | 00047 | Toxi-Lic Liquid 5 Lit | 0001 | 100 | 1,549.85 |
| SALESBATCH | 263 | 00150 | Calpho Lic Liquid 5 Lit | 0001 | 20 | 951.66 |
| SALESBATCH | 263 | 00158 | Minro-Lic mineral 25 Kg | 0001 | 20 | 619.04 |
| SALESBATCH | 263 | 00196 | Sachro-lic Oral Powder 25 KG | 0001 | 20 | 552.9 |
| SALESBATCH | 264 | 00186 | DCP Powder - 29 %.   25 kg | 0001 | 5 | 270 |
| PurchasesBatch | 289 | 02473 | Label Deak C Oral Liquid 5 Lit | 0001 | 15 | 40 |
| PurchasesBatch | 289 | 02475 | Label De Resp Oral Liquid 5 Lit | 0001 | 15 | 40 |
| PurchasesBatch | 289 | 02477 | Label Livocent Plus Oril Liquid  5 Lit | 0001 | 15 | 40 |
| PurchasesBatch | 289 | 02478 | Label Es Dec Oral Liquid 5 Lit | 0001 | 15 | 40 |
| PurchasesBatch | 289 | 02476 | Label De Mune Oral Liquid 5 Lit | 0001 | 15 | 40 |
| Productions | 557 | 03297 | De Resp Oral Liquid | 0001 | 40 | 129.11 |
| PRODUCTIONBATCH | 557 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 557 | 01031 | Menthol Crystal | 0001 | 0 | 6,494.73 |
| PRODUCTIONBATCH | 557 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 557 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 557 | 03297 | De Resp Oral Liquid | 0001 | 40 | 129.11 |
| Productions | 558 | 03298 | De Mune Oral Liquid | 0001 | 40 | 68.19 |
| PRODUCTIONBATCH | 558 | 01025 | Ginger Oil | 0001 | 0 | 7,200 |
| PRODUCTIONBATCH | 558 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 558 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 558 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 558 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 558 | 03298 | De Mune Oral Liquid | 0001 | 40 | 68.01 |
| Productions | 559 | 03299 | Livocent Plus Oril Liquid | 0001 | 40 | 96.02 |
| PRODUCTIONBATCH | 559 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 559 | 01020 | Formic Acid | 0001 | 0 | 314.71 |
| PRODUCTIONBATCH | 559 | 01021 | Glacial Acetic Acid | 0001 | 0 | 340.07 |
| PRODUCTIONBATCH | 559 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 559 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 559 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 559 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 559 | 01105 | Sodium Citrate | 0001 | 0 | 414.59 |
| PRODUCTIONBATCH | 559 | 01115 | Calcium Propionate | 001 | 0 | 650 |
| PRODUCTIONBATCH | 559 | 01184 | ARQ | 0001 | 2 | 367 |
| Productions | 559 | 03299 | Livocent Plus Oril Liquid | 0001 | 40 | 90.59 |
| Productions | 560 | 03300 | Es Dec Oral Liquid | 0001 | 40 | 206.89 |
| PRODUCTIONBATCH | 560 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 560 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 560 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 560 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 560 | 01072 | Vitamin E | 0001 | 0 | 9,146.18 |
| Productions | 560 | 03300 | Es Dec Oral Liquid | 0001 | 40 | 205.81 |
| Productions | 561 | 03213 | Bentox Plus Oral Powder | 0001 | 125 | 15.61 |
| PRODUCTIONBATCH | 561 | 01003 | Bentonite | 0001 | 125 | 13.03 |
| PRODUCTIONBATCH | 561 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128 |
| PRODUCTIONBATCH | 561 | 01187 | Sodium Metaby Sulphate | 0001 | 0 | 387.09 |
| Productions | 562 | 03144 | Yeast Plus Powder | 0001 | 25 | 40.5 |
| PRODUCTIONBATCH | 562 | 01003 | Bentonite | 0001 | 12 | 13.03 |
| PRODUCTIONBATCH | 562 | 01033 | Molasses | 0001 | 2 | 50 |
| PRODUCTIONBATCH | 562 | 01059 | Wheat Bran | 0001 | 10 | 72.45 |
| Productions | 562 | 03144 | Yeast Plus Powder | 0001 | 25 | 40.5 |
| Productions | 563 | 03014 | Magnet BOP Oral Powder | 0001 | 75 | 13.03 |
| PRODUCTIONBATCH | 563 | 01003 | Bentonite | 0001 | 75 | 13.03 |
| Productions | 563 | 03014 | Magnet BOP Oral Powder | 0001 | 75 | 13.03 |
| Productions | 564 | 03163 | Calcium 72 | 0001 | 150 | 17 |
| PRODUCTIONBATCH | 564 | 01015 | DCP (Calcium) | 0001 | 150 | 17 |
| Productions | 565 | 03021 | Vital Gold | 0001 | 4,100 | 52.7 |
| PRODUCTIONBATCH | 565 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 565 | 01013 | Calcium Chloride | 0001 | 0 | 259.63 |
| PRODUCTIONBATCH | 565 | 01016 | DCP (Dana) | 0001 | 3,280 | 10 |
| PRODUCTIONBATCH | 565 | 01034 | Magnesium Sulphate | 0001 | 4 | 559.15 |
| PRODUCTIONBATCH | 565 | 01043 | Sodium Chloride | 0001 | 820 | 13.75 |
| PRODUCTIONBATCH | 565 | 01050 | Tartrazine Yellow Color Indian | 0001 | 6 | 3,086.04 |
| PRODUCTIONBATCH | 565 | 01053 | Vitamin B1 | 0001 | 2 | 15,760.35 |
| PRODUCTIONBATCH | 565 | 01054 | Vitamin B2 | 0001 | 1 | 16,752.11 |
| PRODUCTIONBATCH | 565 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 565 | 01057 | Vitamin B6 | 0001 | 0 | 12,640.67 |
| PRODUCTIONBATCH | 565 | 01060 | Zinc Sulphate | 001 | 8 | 950 |
| PRODUCTIONBATCH | 565 | 01072 | Vitamin E | 0001 | 1 | 9,146.18 |
| PRODUCTIONBATCH | 565 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| PRODUCTIONBATCH | 565 | 01143 | Vitamin B3 | 0001 | 12 | 3,396.86 |
| Productions | 565 | 03021 | Vital Gold | 0001 | 4,100 | 52.7 |
| PACKING | 585 | 00411 | De Resp Oral Liquid 5 Lit | 0001 | 8 | 1,184.31 |
| PACKINGBATCH | 585 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 440 |
| PACKINGBATCH | 585 | 02475 | Label De Resp Oral Liquid 5 Lit | 0001 | 8 | 40 |
| PACKINGBATCH | 585 | 03297 | De Resp Oral Liquid | 0001 | 40 | 129.11 |
| PACKINGBATCH | 585 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 235 |
| PACKING | 585 | 00411 | De Resp Oral Liquid 5 Lit | 0001 | 8 | 1,184.31 |
| PACKING | 586 | 00412 | De Mune Oral Liquid 5 Lit | 0001 | 8 | 878.78 |
| PACKINGBATCH | 586 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 440 |
| PACKINGBATCH | 586 | 02476 | Label De Mune Oral Liquid 5 Lit | 0001 | 8 | 40 |
| PACKINGBATCH | 586 | 03298 | De Mune Oral Liquid | 0001 | 40 | 68.01 |
| PACKINGBATCH | 586 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 235 |
| PACKING | 586 | 00412 | De Mune Oral Liquid 5 Lit | 0001 | 8 | 878.78 |
| PACKING | 587 | 00413 | Livocent Plus Oril Liquid  5 Lit | 0001 | 8 | 991.71 |
| PACKINGBATCH | 587 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 440 |
| PACKINGBATCH | 587 | 02477 | Label Livocent Plus Oril Liquid  5 Lit | 0001 | 8 | 40 |
| PACKINGBATCH | 587 | 03299 | Livocent Plus Oril Liquid | 0001 | 40 | 90.59 |
| PACKINGBATCH | 587 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 235 |
| PACKING | 587 | 00413 | Livocent Plus Oril Liquid  5 Lit | 0001 | 8 | 991.71 |
| PACKING | 588 | 00414 | Es Dec Oral Liquid 5 Lit | 0001 | 8 | 1,567.82 |
| PACKINGBATCH | 588 | 02014 | Plastic Can White 5 Liter | 0001 | 8 | 440 |
| PACKINGBATCH | 588 | 02478 | Label Es Dec Oral Liquid 5 Lit | 0001 | 8 | 40 |
| PACKINGBATCH | 588 | 03300 | Es Dec Oral Liquid | 0001 | 40 | 205.81 |
| PACKINGBATCH | 588 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 2 | 235 |
| PACKING | 588 | 00414 | Es Dec Oral Liquid 5 Lit | 0001 | 8 | 1,567.82 |
| PACKING | 589 | 00302 | Bentox Plus Oral Powder 25 kg | 0001 | 5 | 698.19 |
| PACKINGBATCH | 589 | 02213 | Bag Bop Red Colour | 0001 | 5 | 168 |
| PACKINGBATCH | 589 | 02358 | Label Bentox Plus Oral Powder 25 kg | 0001 | 5 | 140 |
| PACKINGBATCH | 589 | 03213 | Bentox Plus Oral Powder | 0001 | 125 | 15.61 |
| PACKING | 590 | 00199 | Yeast Plus Powder 25 kg | 0001 | 1 | 1,220.38 |
| PACKINGBATCH | 590 | 02213 | Bag Bop Red Colour | 0001 | 1 | 168 |
| PACKINGBATCH | 590 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 1 | 40 |
| PACKINGBATCH | 590 | 03144 | Yeast Plus Powder | 0001 | 25 | 40.5 |
| PACKING | 590 | 00199 | Yeast Plus Powder 25 kg | 0001 | 1 | 1,220.38 |
| PACKING | 591 | 00022 | Magnet BOP 25kg | 0001 | 3 | 480.84 |
| PACKINGBATCH | 591 | 02033 | BAG Magnet 25 KG | 0001 | 3 | 155 |
| PACKINGBATCH | 591 | 03014 | Magnet BOP Oral Powder | 0001 | 75 | 13.03 |
| PACKING | 591 | 00022 | Magnet BOP 25kg | 0001 | 3 | 480.84 |
| PACKING | 592 | 00231 | Calcium 72 25kg | 0001 | 6 | 525 |
| PACKINGBATCH | 592 | 02274 | Bag Calcium 72  25kg | 0001 | 6 | 100 |
| PACKINGBATCH | 592 | 03163 | Calcium 72 | 0001 | 150 | 17 |
| PRODUCTIONBATCH | 565 | 01009 | Copper Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01013 | Calcium Chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01016 | DCP (Dana) |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01034 | Magnesium Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01043 | Sodium Chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01050 | Tartrazine Yellow Color Indian |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01053 | Vitamin B1 |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01054 | Vitamin B2 |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01056 | Vitamin D3 |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01057 | Vitamin B6 |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01060 | Zinc Sulphate |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01072 | Vitamin E |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01073 | Potassium Chloride |  | 0 | 0 |
| PRODUCTIONBATCH | 565 | 01143 | Vitamin B3 |  | 0 | 0 |
| Production | 565 | 03021 | Vital Gold |  | 0 | 0 |
| Productions | 565 | 03244 | BOP Nutramin Forte | 0001 | 125 | 21.08 |
| PRODUCTIONBATCH | 565 | 01015 | DCP (Calcium) | 0001 | 125 | 17 |
| PRODUCTIONBATCH | 565 | 01143 | Vitamin B3 | 0001 | 0 | 3,396.86 |
| Productions | 566 | 03021 | Vital Gold | 0001 | 4,100 | 52.7 |
| PRODUCTIONBATCH | 566 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 566 | 01013 | Calcium Chloride | 0001 | 0 | 259.63 |
| PRODUCTIONBATCH | 566 | 01016 | DCP (Dana) | 0001 | 3,280 | 10 |
| PRODUCTIONBATCH | 566 | 01034 | Magnesium Sulphate | 0001 | 4 | 559.15 |
| PRODUCTIONBATCH | 566 | 01043 | Sodium Chloride | 0001 | 820 | 13.75 |
| PRODUCTIONBATCH | 566 | 01050 | Tartrazine Yellow Color Indian | 0001 | 6 | 3,086.04 |
| PRODUCTIONBATCH | 566 | 01053 | Vitamin B1 | 0001 | 2 | 15,760.35 |
| PRODUCTIONBATCH | 566 | 01054 | Vitamin B2 | 0001 | 1 | 16,752.11 |
| PRODUCTIONBATCH | 566 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 566 | 01057 | Vitamin B6 | 0001 | 0 | 12,640.67 |
| PRODUCTIONBATCH | 566 | 01060 | Zinc Sulphate | 001 | 8 | 950 |
| PRODUCTIONBATCH | 566 | 01072 | Vitamin E | 0001 | 1 | 9,146.18 |
| PRODUCTIONBATCH | 566 | 01073 | Potassium Chloride | 0001 | 0 | 373.48 |
| PRODUCTIONBATCH | 566 | 01143 | Vitamin B3 | 0001 | 12 | 3,396.86 |
| Productions | 566 | 03021 | Vital Gold | 0001 | 4,100 | 52.7 |
| PACKING | 593 | 00343 | BOP Nutramin Forte 25 KG | 0001 | 5 | 884.91 |
| PACKINGBATCH | 593 | 02307 | Bag Bop Blue Colour | 0001 | 5 | 168 |
| PACKINGBATCH | 593 | 03244 | BOP Nutramin Forte | 0001 | 125 | 21.08 |
| PACKINGBATCH | 593 | 02054 | White Bag Unprint | 0001 | 5 | 190 |
| PACKING | 594 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,317.41 |
| PACKINGBATCH | 594 | 03021 | Vital Gold | 0001 | 2,500 | 52.7 |
| PACKING | 594 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,317.41 |
| PACKING | 595 | 00026 | Vital Gold 1kg | 0001 | 1,600 | 52.7 |
| PACKINGBATCH | 595 | 03021 | Vital Gold | 0001 | 1,600 | 52.7 |
| PurchasesBatch | 290 | 02316 | S+D Garliment Plus 30ML | 0001 | 5,300 | 7.25 |
| PurchasesBatch | 291 | 01015 | DCP (Calcium) | 0001 | 2,750 | 17 |
| PurchasesBatch | 292 | 01042 | Starch | 0001 | 50 | 169 |
| Productions | 567 | 03163 | Calcium 72 | 0001 | 1,250 | 17 |
| PRODUCTIONBATCH | 567 | 01015 | DCP (Calcium) | 0001 | 1,250 | 17 |
| Productions | 568 | 03144 | Yeast Plus Powder | 0001 | 500 | 11.52 |
| PRODUCTIONBATCH | 568 | 01003 | Bentonite | 0001 | 250 | 13.03 |
| PRODUCTIONBATCH | 568 | 01033 | Molasses | 0001 | 50 | 50 |
| Productions | 569 | 03100 | Promin Gold Minerals | 0001 | 1,000 | 21.14 |
| PRODUCTIONBATCH | 569 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 569 | 01013 | Calcium Chloride | 0001 | 0 | 259.63 |
| PRODUCTIONBATCH | 569 | 01016 | DCP (Dana) | 0001 | 800 | 10 |
| PRODUCTIONBATCH | 569 | 01042 | Starch | 0001 | 10 | 168.59 |
| PRODUCTIONBATCH | 569 | 01043 | Sodium Chloride | 0001 | 200 | 13.75 |
| PRODUCTIONBATCH | 569 | 01050 | Tartrazine Yellow Color Indian | 0001 | 1 | 3,086.04 |
| PRODUCTIONBATCH | 569 | 01053 | Vitamin B1 | 0001 | 0 | 15,760.35 |
| PRODUCTIONBATCH | 569 | 01054 | Vitamin B2 | 0001 | 0 | 16,752.11 |
| PRODUCTIONBATCH | 569 | 01143 | Vitamin B3 | 0001 | 0 | 3,396.86 |
| Productions | 569 | 03100 | Promin Gold Minerals | 0001 | 1,000 | 21.14 |
| PACKING | 596 | 00231 | Calcium 72 25kg | 0001 | 50 | 525 |
| PACKINGBATCH | 596 | 02274 | Bag Calcium 72  25kg | 0001 | 50 | 100 |
| PACKINGBATCH | 596 | 03163 | Calcium 72 | 0001 | 1,250 | 17 |
| PACKING | 597 | 00199 | Yeast Plus Powder 25 kg | 0001 | 20 | 495.9 |
| PACKINGBATCH | 597 | 02213 | Bag Bop Red Colour | 0001 | 20 | 168 |
| PACKINGBATCH | 597 | 02222 | label Yeast Plus Powder 25 kg | 0001 | 20 | 40 |
| PACKINGBATCH | 597 | 03144 | Yeast Plus Powder | 0001 | 500 | 11.52 |
| PACKING | 598 | 00141 | Promin Gold Minerals 1kg | 0001 | 1,000 | 65.89 |
| PACKINGBATCH | 598 | 02151 | Packet Promin Gold Minerals 1kg | 0001 | 1,000 | 33 |
| PACKINGBATCH | 598 | 03100 | Promin Gold Minerals | 0001 | 1,000 | 21.14 |
| PACKINGBATCH | 598 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 50 | 235 |
| SALESBATCH | 265 | 00281 | MLC 100  Oral Liquid 5 Liter | 090826 | 40 | 1,108.81 |
| SALESBATCH | 265 | 00278 | Immunit Z Oral Liquid  5 Liter | 0001 | 40 | 712.62 |
| SALESBATCH | 265 | 00276 | Task 1 Oral Liquid  5 Liter | 0001 | 32 | 1,056.85 |
| SALESBATCH | 265 | 00286 | Frost Oral Liquid 5 liter | 0001 | 40 | 659.39 |
| SALESBATCH | 265 | 00280 | TopVit Oral Liquid  5 Liter | 0001 | 44 | 1,819.02 |
| SALESBATCH | 265 | 00371 | CS Guard 20 Oral Liquid 5 Lit | 0001 | 20 | 1,911.95 |
| SALESBATCH | 265 | 00274 | CRD Mint Oral Liquid 5 Liter | 0001 | 88 | 2,163.21 |
| SALESBATCH | 265 | 00275 | CRD Mint Oral Liquid  1 Liter | 0001 | 60 | 370.76 |
| SALESBATCH | 265 | 00273 | Merlin Fix Oral Powder 25 kg | 0001 | 20 | 818.56 |
| SALESBATCH | 266 | 00028 | Vital Gold 25kg | 0001 | 100 | 1,317.41 |
| SALESBATCH | 266 | 00026 | Vital Gold 1kg | 0001 | 1,600 | 52.7 |
| SALESBATCH | 267 | 00199 | Yeast Plus Powder 25 kg | 0001 | 20 | 589.95 |
| SALESBATCH | 267 | 00231 | Calcium 72 25kg | 0001 | 50 | 446.88 |
| SALESBATCH | 267 | 00141 | Promin Gold Minerals 1kg | 0001 | 1,000 | 65.89 |
| SALESBATCH | 268 | 00292 | VETLIV Oral Solution 5 Lit | 0001 | 240 | 986.51 |
| SALESBATCH | 269 | 00380 | Bio Guard oral Liquid 5 Lit | 0001 | 40 | 1,159.06 |
| SALESBATCH | 269 | 00391 | Promune 35 Oral Liquid 5 Lit | 0001 | 60 | 873.32 |
| PACKING | 599 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 60 | 628.75 |
| PACKINGBATCH | 599 | 02014 | Plastic Can White 5 Liter | 0001 | 60 | 440 |
| PACKINGBATCH | 599 | 02457 | Label Grow Pro + Oral Liquid 5 Lit | 0001 | 60 | 80 |
| PACKINGBATCH | 599 | 03281 | Grow Pro + Oral Liquid | 0001 | 300 | 10 |
| PACKINGBATCH | 599 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 15 | 235 |
| PACKING | 599 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 60 | 628.75 |
| SALESBATCH | 269 | 00393 | Grow Pro + Oral Liquid 5 Lit | 0001 | 60 | 628.75 |
| SALESBATCH | 269 | 00395 | Brosteine Oral Liquid 1 Lit | 0001 | 120 | 423.87 |
| SALESBATCH | 269 | 00405 | MB Adek Oril Liquid 1Lit | 0001 | 120 | 313.43 |
| SALESBATCH | 269 | 00406 | MB VitaMun Oral Liquid 1 LIT | 0001 | 120 | 422.38 |
| SALESBATCH | 269 | 00409 | MB Neutral Plus Oral Powder 25 kg | 0001 | 10 | 161.93 |
| SALESBATCH | 269 | 00408 | MB FCR Grow Oral Powder 25KG | 0001 | 10 | 160.84 |
| SALESBATCH | 270 | 00049 | Calci-Phos-D 5 Lit | 0001 | 24 | 674.99 |
| SALESBATCH | 271 | 00138 | Bio Ambrox 5Lit | 0001 | 36 | 759.15 |
| SALESBATCH | 271 | 00188 | TOXI GOLD Liquid 5 Liter | 0001 | 36 | 587.97 |
| SALESBATCH | 271 | 00287 | Flush Gold Oral Liquid 5 Lit | 0001 | 36 | 606.24 |
| SALESBATCH | 272 | 00041 | Growth Promoter Plus 25kg | 0001 | 10 | 1,217.62 |
| SALESBATCH | 273 | 00411 | De Resp Oral Liquid 5 Lit | 0001 | 8 | 1,184.31 |
| SALESBATCH | 273 | 00412 | De Mune Oral Liquid 5 Lit | 0001 | 8 | 878.78 |
| SALESBATCH | 273 | 00413 | Livocent Plus Oril Liquid  5 Lit | 0001 | 8 | 991.71 |
| SALESBATCH | 273 | 00414 | Es Dec Oral Liquid 5 Lit | 0001 | 8 | 1,567.82 |
| SALESBATCH | 274 | 00343 | BOP Nutramin Forte 25 KG | 0001 | 5 | 884.91 |
| SALESBATCH | 274 | 00302 | Bentox Plus Oral Powder 25 kg | 0001 | 5 | 698.19 |
| PurchasesBatch | 293 | 01045 | Sorbitol Liquid 70% | 0001 | 275 | 285 |
| PurchasesBatch | 293 | 01036 | Propylene Glycol (PG) | 0001 | 215 | 650 |
| PurchasesBatch | 293 | 01020 | Formic Acid | 0001 | 140 | 312 |
| PurchasesBatch | 293 | 01019 | Eucluptus Oil | 0001 | 1 | 5,200 |
| PurchasesBatch | 293 | 01075 | Peppermint Oil | 0001 | 1 | 4,600 |
| PurchasesBatch | 293 | 01070 | Anise Oil | 0001 | 1 | 5,000 |
| PurchasesBatch | 294 | 02014 | Plastic Can White 5 Liter | 0001 | 255 | 440 |
| PurchasesBatch | 294 | 02097 | Bottle Round liter | 0001 | 360 | 230 |
| PurchasesBatch | 295 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 225 |
| PurchasesBatch | 296 | 02294 | Label Aqua-Guard Liquid 25L | 0001 | 5 | 75 |
| PurchasesBatch | 296 | 02467 | LABEL AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 296 | 02410 | Label Aspolite C Oral Liquid 5 Lit | 0001 | 55 | 80 |
| PurchasesBatch | 296 | 02268 | Label P.H Cure 25Liter | 0001 | 20 | 75 |
| PurchasesBatch | 296 | 02163 | Label Calpho Lic Liquid 5 Lit | 0001 | 55 | 40 |
| PurchasesBatch | 296 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 0001 | 25 | 40 |
| PurchasesBatch | 296 | 02129 | Label CID 7 Oral Liquid 25 Liter | 0001 | 10 | 75 |
| PurchasesBatch | 296 | 02465 | LABEL ADEVIX C ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 296 | 02463 | LABEL THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 296 | 02462 | LABEL MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 296 | 02466 | LABEL IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 296 | 02464 | LABEL RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PurchasesBatch | 296 | 02127 | Packet Paower Plus 1 kg | 0001 | 1,000 | 33 |
| Productions | 570 | 03162 | P.H Cure Liquid | 0001 | 700 | 36.83 |
| PRODUCTIONBATCH | 570 | 01004 | Citric Acid | 0001 | 10 | 400 |
| PRODUCTIONBATCH | 570 | 01009 | Copper Sulphate | 001 | 2 | 2,200 |
| PRODUCTIONBATCH | 570 | 01020 | Formic Acid | 0001 | 35 | 313.25 |
| PRODUCTIONBATCH | 570 | 01036 | Propylene Glycol (PG) | 0001 | 7 | 650 |
| PRODUCTIONBATCH | 570 | 01041 | Sodium Benzoate | 0001 | 1 | 560 |
| PRODUCTIONBATCH | 570 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 570 | 03162 | P.H Cure Liquid | 0001 | 700 | 36.83 |
| Productions | 571 | 03260 | Leo Viton Oral Liquid | 0001 | 60 | 117.06 |
| PRODUCTIONBATCH | 571 | 01036 | Propylene Glycol (PG) | 0001 | 6 | 650 |
| PRODUCTIONBATCH | 571 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 571 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 571 | 01053 | Vitamin B1 | 0001 | 0 | 15,760.35 |
| PRODUCTIONBATCH | 571 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 571 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 571 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 571 | 03260 | Leo Viton Oral Liquid | 0001 | 60 | 117.68 |
| PACKING | 600 | 00228 | P.H Cure 25 Liter | 0001 | 28 | 2,043.99 |
| PACKINGBATCH | 600 | 02128 | White Can 25 Liter | 0001 | 28 | 1,069.61 |
| PACKINGBATCH | 600 | 02268 | Label P.H Cure 25Liter | 0001 | 20 | 75 |
| PACKINGBATCH | 600 | 03162 | P.H Cure Liquid | 0001 | 700 | 36.83 |
| PACKING | 600 | 00228 | P.H Cure 25 Liter | 0001 | 28 | 2,043.99 |
| PACKING | 601 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 12 | 1,126.73 |
| PACKINGBATCH | 601 | 02014 | Plastic Can White 5 Liter | 0001 | 12 | 440 |
| PACKINGBATCH | 601 | 02427 | Label Leo Viton Oral Liquid 5 Lit | 0001 | 12 | 40 |
| PACKINGBATCH | 601 | 03260 | Leo Viton Oral Liquid | 0001 | 60 | 117.68 |
| PACKINGBATCH | 601 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 3 | 233.33 |
| PACKING | 601 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 12 | 1,126.73 |
| SALERETURNSBATCH | 3 | 00040 | Super Yeast Powder 25kg | 0001 | 185 | 9,000 |
| Productions | 572 | 03028 | O-D Plus Oral Liquid | 0001 | 60 | 325.69 |
| PRODUCTIONBATCH | 572 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 572 | 01019 | Eucluptus Oil | 0001 | 0 | 5,200 |
| PRODUCTIONBATCH | 572 | 01031 | Menthol Crystal | 0001 | 0 | 6,494.73 |
| PRODUCTIONBATCH | 572 | 01036 | Propylene Glycol (PG) | 0001 | 3 | 650 |
| PRODUCTIONBATCH | 572 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 572 | 01045 | Sorbitol Liquid 70% | 001 | 3 | 350 |
| PRODUCTIONBATCH | 572 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 572 | 01075 | Peppermint Oil | 0001 | 0 | 4,692.51 |
| PRODUCTIONBATCH | 572 | 01189 | Glycerine | 0001 | 4 | 700.02 |
| Productions | 572 | 03028 | O-D Plus Oral Liquid | 0001 | 60 | 327.24 |
| Productions | 573 | 03248 | Aspolite C Oral Liquid | 0001 | 220 | 104.62 |
| PRODUCTIONBATCH | 573 | 01004 | Citric Acid | 0001 | 2 | 400 |
| PRODUCTIONBATCH | 573 | 01036 | Propylene Glycol (PG) | 0001 | 2 | 650 |
| PRODUCTIONBATCH | 573 | 01041 | Sodium Benzoate | 0001 | 2 | 560 |
| PRODUCTIONBATCH | 573 | 01043 | Sodium Chloride | 0001 | 1 | 13.75 |
| PRODUCTIONBATCH | 573 | 01045 | Sorbitol Liquid 70% | 001 | 2 | 350 |
| PRODUCTIONBATCH | 573 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 573 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 11 | 1,549.99 |
| PRODUCTIONBATCH | 573 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 573 | 01073 | Potassium Chloride | 0001 | 1 | 373.48 |
| Productions | 573 | 03248 | Aspolite C Oral Liquid | 0001 | 220 | 104.93 |
| Productions | 574 | 03291 | AQUAFIX PLUS ORAL LIQUID | 0001 | 124 | 45.73 |
| PRODUCTIONBATCH | 574 | 01004 | Citric Acid | 0001 | 1 | 400 |
| PRODUCTIONBATCH | 574 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 574 | 01020 | Formic Acid | 0001 | 6 | 313.25 |
| PRODUCTIONBATCH | 574 | 01021 | Glacial Acetic Acid | 0001 | 3 | 340.07 |
| PRODUCTIONBATCH | 574 | 01022 | Genshat Voilt (Crystal) | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 574 | 01036 | Propylene Glycol (PG) | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 574 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 574 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 574 | 03291 | AQUAFIX PLUS ORAL LIQUID | 0001 | 124 | 45.73 |
| Productions | 575 | 03019 | Super Yeast Powder | 0001 | 1,250 | 13.83 |
| PRODUCTIONBATCH | 575 | 01003 | Bentonite | 0001 | 625 | 13.03 |
| PRODUCTIONBATCH | 575 | 01033 | Molasses | 0001 | 125 | 50 |
| PRODUCTIONBATCH | 575 | 01059 | Wheat Bran | 0001 | 40 | 72.45 |
| PACKING | 602 | 00226 | O-D Plus Liquid 1lit | 0001 | 60 | 571.91 |
| PACKINGBATCH | 602 | 02097 | Bottle Round liter | 0001 | 60 | 230 |
| PACKINGBATCH | 602 | 03028 | O-D Plus Oral Liquid | 0001 | 60 | 327.24 |
| PACKINGBATCH | 602 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 5 | 176 |
| PACKING | 602 | 00226 | O-D Plus Liquid 1lit | 0001 | 60 | 571.91 |
| PACKING | 603 | 00349 | Aspolite C Oral Liquid 5 Lit | 0001 | 44 | 1,102.97 |
| PACKINGBATCH | 603 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 440 |
| PACKINGBATCH | 603 | 02410 | Label Aspolite C Oral Liquid 5 Lit | 0001 | 44 | 80 |
| PACKINGBATCH | 603 | 03248 | Aspolite C Oral Liquid | 0001 | 220 | 104.93 |
| PACKINGBATCH | 603 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 11 | 233.33 |
| PACKING | 603 | 00349 | Aspolite C Oral Liquid 5 Lit | 0001 | 44 | 1,102.97 |
| PACKING | 604 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 340.4 |
| PACKINGBATCH | 604 | 02097 | Bottle Round liter | 0001 | 24 | 230 |
| PACKINGBATCH | 604 | 02467 | LABEL AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PACKINGBATCH | 604 | 03291 | AQUAFIX PLUS ORAL LIQUID | 0001 | 24 | 45.73 |
| PACKINGBATCH | 604 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 176 |
| PACKING | 604 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 340.4 |
| PurchasesBatch | 296 | 02294 | Label Aqua-Guard Liquid 25L |  | 0 | 0 |
| PurchasesBatch | 296 | 02479 | LABEL AQUAFIX PLUS ORAL LIQUID 25 LIT | 0001 | 5 | 75 |
| PACKING | 605 | 00415 | AQUAFIX PLUS ORAL LIQUID 25 LIT | 0001 | 4 | 2,306.72 |
| PACKINGBATCH | 605 | 02128 | White Can 25 Liter | 0001 | 4 | 1,069.61 |
| PACKINGBATCH | 605 | 02479 | LABEL AQUAFIX PLUS ORAL LIQUID 25 LIT | 0001 | 5 | 75 |
| PACKINGBATCH | 605 | 03291 | AQUAFIX PLUS ORAL LIQUID | 0001 | 100 | 45.73 |
| PACKING | 605 | 00415 | AQUAFIX PLUS ORAL LIQUID 25 LIT | 0001 | 4 | 2,306.72 |
| PACKING | 606 | 00040 | Super Yeast Powder 25kg | 0001 | 50 | 553.86 |
| PACKINGBATCH | 606 | 02042 | Label Super Yeast 25 KG | 0001 | 50 | 40 |
| PACKINGBATCH | 606 | 02213 | Bag Bop Red Colour | 0001 | 50 | 168 |
| PACKINGBATCH | 606 | 03019 | Super Yeast Powder | 0001 | 1,250 | 13.83 |
| Productions | 576 | 03289 | ADEVIX C ORAL LIQUID | 0001 | 24 | 57.19 |
| PRODUCTIONBATCH | 576 | 01028 | Lactic Acid | 0001 | 0 | 1,650 |
| PRODUCTIONBATCH | 576 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 576 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 576 | 01052 | Vitamin A | 0001 | 0 | 14,500 |
| PRODUCTIONBATCH | 576 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| PRODUCTIONBATCH | 576 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 576 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 576 | 03289 | ADEVIX C ORAL LIQUID | 0001 | 24 | 57.19 |
| Productions | 577 | 03287 | THERMOXFIX C ORAL LIQUID | 0001 | 24 | 28.87 |
| PRODUCTIONBATCH | 577 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 577 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 577 | 01044 | Sodium Bicarbonate | 0001 | 0 | 128 |
| PRODUCTIONBATCH | 577 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 577 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 577 | 01055 | Vitamin C (Ascorbic acid) | 0001 | 0 | 1,549.99 |
| Productions | 577 | 03287 | THERMOXFIX C ORAL LIQUID | 0001 | 24 | 29.28 |
| Productions | 578 | 03286 | MYCOVIX PLUS ORAL LIQUID | 0001 | 24 | 216.17 |
| PRODUCTIONBATCH | 578 | 01004 | Citric Acid | 0001 | 0 | 400 |
| PRODUCTIONBATCH | 578 | 01010 | Betaine | 0001 | 0 | 2,800 |
| PRODUCTIONBATCH | 578 | 01012 | Chocolate Brown Colour | 0001 | 0 | 4,000 |
| PRODUCTIONBATCH | 578 | 01020 | Formic Acid | 0001 | 0 | 313.25 |
| PRODUCTIONBATCH | 578 | 01021 | Glacial Acetic Acid | 0001 | 0 | 340.07 |
| PRODUCTIONBATCH | 578 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 578 | 01046 | Silmyrin | 0001 | 0 | 10,502.1 |
| PRODUCTIONBATCH | 578 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 578 | 01184 | ARQ | 0001 | 0 | 367 |
| Productions | 578 | 03286 | MYCOVIX PLUS ORAL LIQUID | 0001 | 24 | 216.17 |
| Productions | 579 | 03290 | IMUNIIX PLUS ORAL LIQUID | 0001 | 24 | 23.25 |
| PRODUCTIONBATCH | 579 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 579 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 579 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 579 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 579 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 579 | 03290 | IMUNIIX PLUS ORAL LIQUID | 0001 | 24 | 23.41 |
| Productions | 580 | 03074 | Respi Fit Oral Liquid | 0001 | 24 | 128.66 |
| PRODUCTIONBATCH | 580 | 01017 | Camphor | 0001 | 0 | 3,370.68 |
| PRODUCTIONBATCH | 580 | 01031 | Menthol Crystal | 0001 | 0 | 6,494.73 |
| PRODUCTIONBATCH | 580 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 580 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 580 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 580 | 03074 | Respi Fit Oral Liquid | 0001 | 24 | 128.65 |
| PACKING | 607 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 0001 | 24 | 351.86 |
| PACKINGBATCH | 607 | 02465 | LABEL ADEVIX C ORAL LIQUID 1 LIT | 0001 | 30 | 40 |
| PACKINGBATCH | 607 | 03289 | ADEVIX C ORAL LIQUID | 0001 | 24 | 57.19 |
| PACKINGBATCH | 607 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 176 |
| PACKINGBATCH | 607 | 02097 | Bottle Round liter | 0001 | 24 | 230 |
| PACKING | 607 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 0001 | 24 | 351.86 |
| PACKING | 608 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 103.11 |
| PACKINGBATCH | 608 | 02463 | LABEL THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 40 |
| PACKINGBATCH | 608 | 03287 | THERMOXFIX C ORAL LIQUID | 0001 | 24 | 29.28 |
| PACKINGBATCH | 608 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 176 |
| PACKINGBATCH | 608 | 02097 | Bottle Round liter | 0001 | 2 | 230 |
| PACKING | 608 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 103.11 |
| PACKING | 609 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 290.01 |
| PACKINGBATCH | 609 | 02462 | LABEL MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 40 |
| PACKINGBATCH | 609 | 03286 | MYCOVIX PLUS ORAL LIQUID | 0001 | 24 | 216.17 |
| PACKINGBATCH | 609 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 176 |
| PACKINGBATCH | 609 | 02097 | Bottle Round liter | 0001 | 2 | 230 |
| PACKING | 609 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 290.01 |
| PACKING | 610 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 97.24 |
| PACKINGBATCH | 610 | 02466 | LABEL IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 40 |
| PACKINGBATCH | 610 | 03290 | IMUNIIX PLUS ORAL LIQUID | 0001 | 24 | 23.41 |
| PACKINGBATCH | 610 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 176 |
| PACKINGBATCH | 610 | 02097 | Bottle Round liter | 0001 | 2 | 230 |
| PACKING | 610 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 97.24 |
| PRODUCTIONBATCH | 580 | 01017 | Camphor |  | 0 | 0 |
| PRODUCTIONBATCH | 580 | 01031 | Menthol Crystal |  | 0 | 0 |
| PRODUCTIONBATCH | 580 | 01041 | Sodium Benzoate |  | 0 | 0 |
| PRODUCTIONBATCH | 580 | 01048 | Titanium Dioxide (T.T) |  | 0 | 0 |
| PRODUCTIONBATCH | 580 | 01058 | Xanthan Gum |  | 0 | 0 |
| Production | 580 | 03074 | Respi Fit Oral Liquid |  | 0 | 0 |
| Productions | 580 | 03288 | RESPIFIX PLUS ORAL LIQUID | 0001 | 24 | 129.11 |
| Productions | 580 | 03288 | RESPIFIX PLUS ORAL LIQUID | 0001 | 24 | 129.11 |
| PACKING | 611 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 413.78 |
| PACKINGBATCH | 611 | 02464 | LABEL RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 40 |
| PACKINGBATCH | 611 | 03288 | RESPIFIX PLUS ORAL LIQUID | 0001 | 24 | 129.11 |
| PACKINGBATCH | 611 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 2 | 176 |
| PACKINGBATCH | 611 | 02097 | Bottle Round liter | 0001 | 24 | 230 |
| PACKING | 611 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 413.78 |
| PurchasesBatch | 297 | 01043 | Sodium Chloride | 0001 | 800 | 13.75 |
| PurchasesBatch | 298 | 02014 | Plastic Can White 5 Liter | 0001 | 170 | 440 |
| PurchasesBatch | 299 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 92 | 166 |
| PurchasesBatch | 300 | 01015 | DCP (Calcium) | 0001 | 10,000 | 17 |
| PurchasesBatch | 300 | 01003 | Bentonite | 0001 | 750 | 15 |
| SALESBATCH | 275 | 00050 | Garlimint Plus BOP 1Lit | 0001 | 24 | 433.73 |
| SALESBATCH | 275 | 00077 | Bio Ambrox 1 Liter Liquid | 0001 | 12 | 339.41 |
| PurchasesBatch | 301 | 02041 | Label Growth Promoter Plus 25 KG | 0001 | 10 | 140 |
| PurchasesBatch | 301 | 02300 | Label Bop Adek Liquid 1Liter | 0001 | 16 | 40 |
| PurchasesBatch | 301 | 02048 | Label Micro Sel-E Oral Liquid 1 Liter | 0001 | 16 | 40 |
| PurchasesBatch | 301 | 02096 | Label En Boost 1 Lit | 0001 | 135 | 40 |
| PurchasesBatch | 301 | 02204 | Label En-Boost Liquid 5 liter | 0001 | 55 | 40 |
| PurchasesBatch | 301 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 55 | 40 |
| PurchasesBatch | 301 | 02404 | Label Bop D-Cal Oral Liquid 5 Lit | 0001 | 55 | 40 |
| PurchasesBatch | 301 | 02384 | Label LivGuard Oral Liquid 5 Lit | 0001 | 55 | 40 |
| PurchasesBatch | 301 | 02441 | Label Liv Guard Oral Liquid 1 Lit | 0001 | 140 | 40 |
| PurchasesBatch | 301 | 02060 | Label Prime Grow Protein 25 kg | 0001 | 5 | 140 |
| PurchasesBatch | 301 | 02234 | Label Hepatic Optimizer fort 25kg | 0001 | 10 | 140 |
| Productions | 581 | 03034 | BOP ADEK Oral Liquid | 0001 | 12 | 43.37 |
| PRODUCTIONBATCH | 581 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 581 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 581 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 581 | 01053 | Vitamin B1 | 0001 | 0 | 15,760.35 |
| PRODUCTIONBATCH | 581 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 581 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 581 | 03034 | BOP ADEK Oral Liquid | 0001 | 12 | 43.99 |
| Productions | 582 | 03027 | Micro Sel-E Oral Liquid | 0001 | 12 | 207.03 |
| PRODUCTIONBATCH | 582 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 582 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 582 | 01045 | Sorbitol Liquid 70% | 001 | 0 | 350 |
| PRODUCTIONBATCH | 582 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 582 | 01072 | Vitamin E | 0001 | 0 | 9,146.18 |
| Productions | 582 | 03027 | Micro Sel-E Oral Liquid | 0001 | 12 | 207.96 |
| Productions | 583 | 03022 | Growth Promoter Plus | 0001 | 125 | 30.09 |
| PRODUCTIONBATCH | 583 | 01003 | Bentonite | 0001 | 100 | 13.26 |
| PRODUCTIONBATCH | 583 | 01031 | Menthol Crystal | 0001 | 0 | 6,494.73 |
| Productions | 583 | 03022 | Growth Promoter Plus | 0001 | 125 | 30.09 |
| PACKING | 612 | 00063 | BOP ADEK Oral Liquid 1 Lit | 0001 | 12 | 341.52 |
| PACKINGBATCH | 612 | 02097 | Bottle Round liter | 0001 | 12 | 230 |
| PACKINGBATCH | 612 | 02300 | Label Bop Adek Liquid 1Liter | 0001 | 16 | 40 |
| PACKINGBATCH | 612 | 03034 | BOP ADEK Oral Liquid | 0001 | 12 | 43.99 |
| PACKINGBATCH | 612 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 1 | 170.39 |
| PACKING | 612 | 00063 | BOP ADEK Oral Liquid 1 Lit | 0001 | 12 | 341.52 |
| PACKING | 613 | 00055 | Micro Sel-E Oral Liquid 1 Lit | 0001 | 12 | 498.83 |
| PACKINGBATCH | 613 | 02048 | Label Micro Sel-E Oral Liquid 1 Liter | 0001 | 14 | 40 |
| PACKINGBATCH | 613 | 02097 | Bottle Round liter | 0001 | 12 | 230 |
| PACKINGBATCH | 613 | 03027 | Micro Sel-E Oral Liquid | 0001 | 12 | 207.96 |
| PACKINGBATCH | 613 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 1 | 170.39 |
| PACKING | 613 | 00055 | Micro Sel-E Oral Liquid 1 Lit | 0001 | 12 | 498.83 |
| PACKING | 614 | 00041 | Growth Promoter Plus 25kg | 0001 | 5 | 1,264.98 |
| PACKINGBATCH | 614 | 02041 | Label Growth Promoter Plus 25 KG | 0001 | 5 | 136.67 |
| PACKINGBATCH | 614 | 02307 | Bag Bop Blue Colour | 0001 | 5 | 168 |
| PACKINGBATCH | 614 | 03022 | Growth Promoter Plus | 001 | 125 | 37.18 |
| PACKING | 614 | 00041 | Growth Promoter Plus 25kg | 0001 | 5 | 1,234.29 |
| SALESBATCH | 276 | 00228 | P.H Cure 25 Liter | 0001 | 28 | 2,043.99 |
| SALESBATCH | 277 | 00364 | Leo Viton Oral Liquid 5 Lit | 0001 | 12 | 1,126.73 |
| SALESBATCH | 278 | 00226 | O-D Plus Liquid 1lit | 0001 | 60 | 571.91 |
| SALESBATCH | 278 | 00349 | Aspolite C Oral Liquid 5 Lit | 0001 | 44 | 1,102.97 |
| OpeningBatch | 121 | 00416 | Silva Feed 25 Kg | 001 | 5 | 50,000 |
| SALESBATCH | 279 | 00040 | Super Yeast Powder 25kg | 0001 | 50 | 7,012.65 |
| SALESBATCH | 279 | 00416 | Silva Feed 25 Kg | 001 | 5 | 50,000 |
| OpeningBatch | 121 | 00416 | Silva Feed 25 Kg | 001 | 100 | 50,000 |
| SALESBATCH | 280 | 00415 | AQUAFIX PLUS ORAL LIQUID 25 LIT | 0001 | 4 | 2,306.72 |
| SALESBATCH | 280 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 340.4 |
| SALESBATCH | 280 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 413.78 |
| SALESBATCH | 280 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 290.01 |
| SALESBATCH | 280 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 103.11 |
| SALESBATCH | 280 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 0001 | 24 | 351.86 |
| SALESBATCH | 280 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 97.24 |
| SALESBATCH | 281 | 00063 | BOP ADEK Oral Liquid 1 Lit | 0001 | 12 | 341.52 |
| SALESBATCH | 281 | 00055 | Micro Sel-E Oral Liquid 1 Lit | 0001 | 12 | 498.83 |
| SALESBATCH | 282 | 00041 | Growth Promoter Plus 25kg | 0001 | 5 | 1,234.29 |
| SALERETURNSBATCH | 4 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 1,200 |
| SALERETURNSBATCH | 4 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 001 | 24 | 1,675 |
| SALERETURNSBATCH | 4 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 1,560 |
| SALERETURNSBATCH | 4 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 800 |
| SALERETURNSBATCH | 4 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 0001 | 24 | 980 |
| SALERETURNSBATCH | 4 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 1,800 |
| SALESBATCH | 155 | 00022 | Magnet BOP 25kg |  | 0 | 0 |
| SALESBATCH | 155 | 00022 | Magnet BOP 25kg | 0001 | 1 | 438.57 |
| SALESBATCH | 155 | 00040 | Super Yeast Powder 25kg |  | 0 | 0 |
| SALESBATCH | 155 | 00040 | Super Yeast Powder 25kg | 0001 | 1 | 6,983.62 |
| SALESBATCH | 192 | 00022 | Magnet BOP 25kg |  | 0 | 0 |
| SALESBATCH | 192 | 00022 | Magnet BOP 25kg | 0001 | 1 | 438.57 |
| SALESBATCH | 283 | 00357 | BOP Yeast Oral Powder 25 kg (High) | 0001 | 2 | 547.85 |
| SALESBATCH | 283 | 00022 | Magnet BOP 25kg | 0001 | 2 | 438.57 |
| SALESBATCH | 283 | 00212 | Microgold-Bop 25 kg | 0001 | 2 | 1,519.4 |
| SALESBATCH | 284 | 00022 | Magnet BOP 25kg | 0001 | 2 | 438.57 |
| SALESBATCH | 284 | 00199 | Yeast Plus Powder 25 kg | 0001 | 2 | 589.95 |
| SALESBATCH | 285 | 00220 | Rumicid powder 25kg | 0001 | 2 | 375.55 |
| SALESBATCH | 285 | 00022 | Magnet BOP 25kg | 0001 | 1 | 438.57 |
| SALESBATCH | 285 | 00363 | PhytoFat Gold 25 Kg | 0001 | 1 | 14,000 |
| SALESBATCH | 286 | 00212 | Microgold-Bop 25 kg | 0001 | 3 | 1,519.4 |
| SALESBATCH | 286 | 00022 | Magnet BOP 25kg | 0001 | 1 | 438.57 |
| SALESBATCH | 286 | 00231 | Calcium 72 25kg | 0001 | 1 | 446.88 |
| SALESBATCH | 287 | 00199 | Yeast Plus Powder 25 kg | 0001 | 1 | 589.95 |
| SALESBATCH | 287 | 00022 | Magnet BOP 25kg | 0001 | 3 | 438.57 |
| SALESBATCH | 287 | 00231 | Calcium 72 25kg | 0001 | 6 | 446.88 |
| ExpiriesBatch | 1 | 00402 | ADEVIX C ORAL LIQUID 1 LIT | 0001 | 24 | 980 |
| ExpiriesBatch | 1 | 00399 | MYCOVIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 1,560 |
| ExpiriesBatch | 1 | 00400 | THERMOXFIX C ORAL LIQUID 1 LIT | 0001 | 24 | 1,200 |
| ExpiriesBatch | 1 | 00404 | AQUAFIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 800 |
| ExpiriesBatch | 1 | 00401 | RESPIFIX PLUS ORAL LIQUID 1 LIT | 001 | 24 | 1,675 |
| ExpiriesBatch | 1 | 00403 | IMUNIIX PLUS ORAL LIQUID 1 LIT | 0001 | 24 | 1,800 |
| PACKINGBATCH | 534 | 03296 | MB Neutral Plus Oral Powder |  | 0 | 0 |
| PACKINGBATCH | 534 | 03296 | MB Neutral Plus Oral Powder | 0001 | 250 | 21.93 |
| PACKING | 534 | 00409 | MB Neutral Plus Oral Powder 25 kg | 0001 | 10 | 688.23 |
| PACKINGBATCH | 535 | 03295 | MB FCR Grow Oral Powder |  | 0 | 0 |
| PACKINGBATCH | 535 | 03295 | MB FCR Grow Oral Powder | 0001 | 250 | 20.84 |
| PACKING | 535 | 00408 | MB FCR Grow Oral Powder 25KG | 0001 | 10 | 661 |
| PACKINGBATCH | 527 | 02004 | Shipper [D] 4pcs cane (5 Liter) |  | 0 | 0 |
| PACKINGBATCH | 527 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 5 | 233.78 |
| PACKINGBATCH | 527 | 02470 | Label LEO Civon 5 LIT |  | 0 | 0 |
| PACKINGBATCH | 527 | 02470 | Label LEO Civon 5 LIT | 0001 | 30 | 40 |
| PACKINGBATCH | 527 | 03294 | LEO Civon |  | 0 | 0 |
| PACKINGBATCH | 527 | 03294 | LEO Civon | 0001 | 100 | 29.28 |
| PACKING | 527 | 00407 | LEO Civon 5 LIT | 0001 | 20 | 704.83 |
| SALESBATCH | 192 | 00074 | Magnet Plus 25 Kg |  | 0 | 0 |
| SALESBATCH | 269 | 00408 | MB FCR Grow Oral Powder 25KG |  | 0 | 0 |
| SALESBATCH | 269 | 00409 | MB Neutral Plus Oral Powder 25 kg |  | 0 | 0 |
| PurchasesBatch | 302 | 02009 | Bottle Can White  100ML | 0001 | 2,400 | 20 |
| PurchasesBatch | 303 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 202 | 225 |
| PurchasesBatch | 304 | 01060 | Zinc Sulphate | 0001 | 25 | 950 |
| PurchasesBatch | 304 | 01034 | Magnesium Sulphate | 0001 | 25 | 480 |
| Productions | 584 | 03131 | EN-BOOST Liquid | 0001 | 320 | 78.17 |
| PRODUCTIONBATCH | 584 | 01021 | Glacial Acetic Acid | 0001 | 1 | 340.07 |
| PRODUCTIONBATCH | 584 | 01028 | Lactic Acid | 0001 | 3 | 1,650 |
| PRODUCTIONBATCH | 584 | 01041 | Sodium Benzoate | 0001 | 1 | 560 |
| PRODUCTIONBATCH | 584 | 01045 | Sorbitol Liquid 70% | 001 | 3 | 350 |
| PRODUCTIONBATCH | 584 | 01050 | Tartrazine Yellow Color Indian | 0001 | 0 | 3,086.04 |
| PRODUCTIONBATCH | 584 | 01057 | Vitamin B6 | 0001 | 0 | 12,640.67 |
| PRODUCTIONBATCH | 584 | 01058 | Xanthan Gum | 0001 | 1 | 1,449.92 |
| PRODUCTIONBATCH | 584 | 01115 | Calcium Propionate | 001 | 12 | 650 |
| PRODUCTIONBATCH | 584 | 01143 | Vitamin B3 | 0001 | 0 | 3,396.86 |
| Productions | 584 | 03131 | EN-BOOST Liquid | 0001 | 320 | 68.03 |
| Productions | 585 | 03183 | Pro-Tox Liquid | 0001 | 200 | 65.02 |
| PRODUCTIONBATCH | 585 | 01010 | Betaine | 0001 | 1 | 2,800 |
| PRODUCTIONBATCH | 585 | 01020 | Formic Acid | 0001 | 1 | 313.25 |
| PRODUCTIONBATCH | 585 | 01021 | Glacial Acetic Acid | 0001 | 1 | 340.07 |
| PRODUCTIONBATCH | 585 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 585 | 01045 | Sorbitol Liquid 70% | 001 | 4 | 350 |
| PRODUCTIONBATCH | 585 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 585 | 01105 | Sodium Citrate | 0001 | 1 | 414.59 |
| PRODUCTIONBATCH | 585 | 01184 | ARQ | 0001 | 10 | 367 |
| Productions | 585 | 03183 | Pro-Tox Liquid | 0001 | 200 | 65.67 |
| Productions | 586 | 03089 | RespiGuard Liquid | 0001 | 220 | 111.02 |
| PRODUCTIONBATCH | 586 | 01017 | Camphor | 0001 | 1 | 3,370.68 |
| PRODUCTIONBATCH | 586 | 01031 | Menthol Crystal | 0001 | 2 | 6,494.73 |
| PRODUCTIONBATCH | 586 | 01036 | Propylene Glycol (PG) | 0001 | 0 | 650 |
| PRODUCTIONBATCH | 586 | 01041 | Sodium Benzoate | 0001 | 0 | 560 |
| PRODUCTIONBATCH | 586 | 01045 | Sorbitol Liquid 70% | 001 | 6 | 350 |
| PRODUCTIONBATCH | 586 | 01048 | Titanium Dioxide (T.T) | 0001 | 0 | 1,405.95 |
| PRODUCTIONBATCH | 586 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| Productions | 586 | 03089 | RespiGuard Liquid | 0001 | 220 | 111.95 |
| Productions | 587 | 03101 | BOP DCAL Liquid | 0001 | 220 | 72.86 |
| PRODUCTIONBATCH | 587 | 01009 | Copper Sulphate | 001 | 0 | 2,200 |
| PRODUCTIONBATCH | 587 | 01013 | Calcium Chloride | 0001 | 6 | 259.63 |
| PRODUCTIONBATCH | 587 | 01034 | Magnesium Sulphate | 0001 | 2 | 525.41 |
| PRODUCTIONBATCH | 587 | 01036 | Propylene Glycol (PG) | 0001 | 1 | 650 |
| PRODUCTIONBATCH | 587 | 01038 | Phosphoric Acid 85% | 001 | 8 | 650 |
| PRODUCTIONBATCH | 587 | 01045 | Sorbitol Liquid 70% | 001 | 1 | 350 |
| PRODUCTIONBATCH | 587 | 01056 | Vitamin D3 | 0001 | 0 | 18,697.38 |
| PRODUCTIONBATCH | 587 | 01058 | Xanthan Gum | 0001 | 0 | 1,449.92 |
| PRODUCTIONBATCH | 587 | 01060 | Zinc Sulphate | 001 | 1 | 950 |
| Productions | 587 | 03101 | BOP DCAL Liquid | 0001 | 220 | 73.02 |
| Productions | 588 | 03104 | BOP PH 5 Liquid | 0001 | 700 | 30.83 |
| PRODUCTIONBATCH | 588 | 01009 | Copper Sulphate | 001 | 2 | 2,200 |
| PRODUCTIONBATCH | 588 | 01020 | Formic Acid | 0001 | 35 | 313.25 |
| PRODUCTIONBATCH | 588 | 01036 | Propylene Glycol (PG) | 0001 | 7 | 650 |
| PRODUCTIONBATCH | 588 | 01041 | Sodium Benzoate | 0001 | 1 | 560 |
| PRODUCTIONBATCH | 588 | 01060 | Zinc Sulphate | 001 | 0 | 950 |
| Productions | 588 | 03104 | BOP PH 5 Liquid | 0001 | 700 | 30.83 |
| PACKING | 615 | 00183 | BOP EN-BOOST Liquid 5 Liter | 0001 | 40 | 886.9 |
| PACKINGBATCH | 615 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 440 |
| PACKINGBATCH | 615 | 02204 | Label En-Boost Liquid 5 liter | 0001 | 50 | 40 |
| PACKINGBATCH | 615 | 03131 | EN-BOOST Liquid | 0001 | 200 | 68.03 |
| PACKINGBATCH | 615 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 227.04 |
| PACKING | 615 | 00183 | BOP EN-BOOST Liquid 5 Liter | 0001 | 40 | 886.9 |
| PACKING | 616 | 00260 | Pro-Tox Liquid 5L | 0001 | 40 | 865.11 |
| PACKINGBATCH | 616 | 02014 | Plastic Can White 5 Liter | 0001 | 40 | 440 |
| PACKINGBATCH | 616 | 02293 | Label Bop Pro-Tox Liquid 5L | 0001 | 40 | 40 |
| PACKINGBATCH | 616 | 03183 | Pro-Tox Liquid | 0001 | 200 | 65.67 |
| PACKINGBATCH | 616 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 10 | 227.04 |
| PACKING | 616 | 00260 | Pro-Tox Liquid 5L | 0001 | 40 | 865.11 |
| PACKING | 617 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 44 | 1,076.51 |
| PACKINGBATCH | 617 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 440 |
| PACKINGBATCH | 617 | 02131 | Label RespiGuard 5 Liter | 0001 | 44 | 20 |
| PACKINGBATCH | 617 | 03089 | RespiGuard Liquid | 0001 | 220 | 111.95 |
| PACKINGBATCH | 617 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 11 | 227.04 |
| PACKING | 617 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 44 | 1,076.51 |
| PACKING | 618 | 00144 | BOP DCAL Liquid 5 Lit | 0001 | 44 | 901.84 |
| PACKINGBATCH | 618 | 02014 | Plastic Can White 5 Liter | 0001 | 44 | 440 |
| PACKINGBATCH | 618 | 02404 | Label Bop D-Cal Oral Liquid 5 Lit | 0001 | 44 | 40 |
| PACKINGBATCH | 618 | 03101 | BOP DCAL Liquid | 0001 | 220 | 73.02 |
| PACKINGBATCH | 618 | 02004 | Shipper [D] 4pcs cane (5 Liter) | 0001 | 11 | 227.04 |
| PACKING | 618 | 00144 | BOP DCAL Liquid 5 Lit | 0001 | 44 | 901.84 |
| PACKING | 619 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 28 | 1,883.28 |
| PACKINGBATCH | 619 | 02128 | White Can 25 Liter | 0001 | 28 | 1,069.61 |
| PACKINGBATCH | 619 | 02160 | Label PH5 Liquid 25 Liter | 0001 | 30 | 40 |
| PACKINGBATCH | 619 | 03104 | BOP PH 5 Liquid | 0001 | 700 | 30.83 |
| PACKING | 619 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 28 | 1,883.28 |
| SALESBATCH | 288 | 00183 | BOP EN-BOOST Liquid 5 Liter | 0001 | 40 | 886.9 |
| SALESBATCH | 288 | 00260 | Pro-Tox Liquid 5L | 0001 | 40 | 865.11 |
| SALESBATCH | 288 | 00129 | RespiGuard Liquid  5 Liter | 0001 | 44 | 1,076.51 |
| SALESBATCH | 288 | 00144 | BOP DCAL Liquid 5 Lit | 0001 | 44 | 901.84 |
| SALESBATCH | 288 | 00147 | BOP PH 5 Liquid 25 Liter | 0001 | 28 | 1,883.28 |
| PACKING | 620 | 00268 | Bop En-Boost Oral Liquid 1 Liter | 0001 | 120 | 355.07 |
| PACKINGBATCH | 620 | 02096 | Label En Boost 1 Lit | 0001 | 120 | 40 |
| PACKINGBATCH | 620 | 02097 | Bottle Round liter | 0001 | 120 | 230 |
| PACKINGBATCH | 620 | 03131 | EN-BOOST Liquid | 0001 | 120 | 68.03 |
| PACKINGBATCH | 620 | 02059 | Shipper { I } 12 Pcs Bottle New | 0001 | 12 | 170.39 |
| PACKING | 620 | 00268 | Bop En-Boost Oral Liquid 1 Liter | 0001 | 120 | 355.07 |
| SALESBATCH | 288 | 00268 | Bop En-Boost Oral Liquid 1 Liter | 0001 | 120 | 355.07 |
| OpeningBatch | 115 | 00264 | DCP-Gold 25Kg | 001 | 110 | 1,500 |
| SALESBATCH | 289 | 00264 | DCP-Gold 25Kg | 001 | 100 | 1,500 |
| PurchasesBatch | 305 | 02010 | Bottle Pet Amber 100ML | 0001 | 10,000 | 8.5 |
| PurchasesBatch | 305 | 02314 | Dropper  30ML | 0001 | 3,000 | 12 |
| PurchasesBatch | 305 | 01042 | Starch | 0001 | 50 | 169 |
| PurchasesBatch | 305 | 01044 | Sodium Bicarbonate | 0001 | 100 | 128 |
| PurchasesBatch | 305 | 01043 | Sodium Chloride | 0001 | 1,360 | 13.75 |
| PurchasesBatch | 305 | 01038 | Phosphoric Acid 85% | 0001 | 35 | 640 |
| PurchasesBatch | 305 | 01193 | Castor Oil | 0001 | 5 | 950 |
| PurchasesBatch | 306 | 02007 | Shipper [G] 100 pcs cane 100 ML | 0001 | 51 | 260 |
| PurchasesBatch | 307 | 01027 | Kaolin | 0001 | 25 | 400 |
| PurchasesBatch | 308 | 02481 | Label Bop Restore-M 25 Kg | 0001 | 52 | 120 |
| PurchasesBatch | 308 | 02146 | Label Acidi-Lic 25 Lit | 0001 | 20 | 75 |

