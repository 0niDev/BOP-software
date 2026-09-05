# Master Data

## Companies (4)

| CompanyId | CompanyName | ExternalCode | IsActive |
|---|---|---|---|
| 00 | Finished Goods | 00 | True |
| 01 | Raw Materials | 01 | True |
| 02 | Packing Materials | 02 | True |
| 03 | UnPacked-Materials | 03 | True |

## Sectors (5)

| ActualSectorId | SectorName |
|---|---|
| 1 | PUNJAB |
| 2 | KPK |
| 3 | Afghanistan |
| 14 | Sindh |
| 15 | BALOCHISTAN |

## Towns (49)

| ActualTownId | Sector | TownName |
|---|---|---|
| 1 | PUNJAB | Chak Jhumra |
| 3 | Afghanistan | Kabul |
| 4 | KPK | Peshawer  |
| 5 | PUNJAB | Faisalabad |
| 6 | PUNJAB | Dajkot |
| 7 | PUNJAB | Lodhran |
| 8 | PUNJAB | Sahiwal |
| 9 | PUNJAB | Toba Tek Singh |
| 10 | PUNJAB | Bahawalpur |
| 11 | PUNJAB | Rahim Yar Khan |
| 12 | PUNJAB | Jhang |
| 13 | PUNJAB | Sargodha |
| 14 | PUNJAB | Layyah |
| 15 | PUNJAB | Kamaliya |
| 16 | PUNJAB | Multan |
| 17 | PUNJAB | Lahore |
| 18 | PUNJAB | Qila dedar Singh QDS |
| 19 | PUNJAB | Rawalpindi |
| 20 | PUNJAB | Gujranwala |
| 22 | PUNJAB | Islamabad |
| 23 | PUNJAB | Attock |
| 24 | PUNJAB | Bhakkar |
| 25 | PUNJAB | Chakwal |
| 26 | PUNJAB | Chiniot |
| 27 | PUNJAB | Dera Gazi Khan DGK |
| 28 | PUNJAB | Gujrat |
| 29 | PUNJAB | Gojer Khan |
| 30 | PUNJAB | Mianwali |
| 31 | PUNJAB | Sialkot |
| 32 | KPK | Lucky Marwat |
| 33 | BALOCHISTAN | Quetta |
| 34 | Sindh | Rohri |
| 35 | Sindh | Sakkur |
| 36 | Sindh | Hyderabad |
| 37 | Sindh | Karachi |
| 38 | KPK | Surai Nurang |
| 39 | KPK | Surai Nurang |
| 40 | PUNJAB | Samundri |
| 41 | PUNJAB | Jaranwala |
| 42 | PUNJAB | Hafizabad |
| 43 | PUNJAB | OKARA |
| 44 | PUNJAB | Satiyana |
| 45 | PUNJAB | PakPattan |
| 46 | PUNJAB | Muzaffarghar |
| 47 | KPK | Mangora,Sawat |
| 48 | KPK | Sawaat |
| 49 | KPK | Cuttling |
| 50 | KPK | Boneer  |
| 51 | KPK | Khaal |

## Users (1)

| UserNo | UserName | Narration | IsEnabled | IsAdministrator |
|---|---|---|---|---|
| 1 | Admin | Administrator | True | True |

## Chart of Accounts (260 accounts)

| AccountNo | AccountName | Type | Depth | Parent | BalFlag | PLFlag | ExpFlag |
|---|---|---|---|---|---|---|---|
| 1 | Assets | Asset | 0 |  | False |   | False |
| 11 | Current Assets | Asset | 1 | 1 | False |   | False |
| 111 | Cash In Hand | Asset | 2 | 11 | True | + | False |
| 112 | Bank Accounts | Asset | 2 | 11 | True |   | False |
| 113 | Inventory | Asset | 2 | 11 | True |   | False |
| 1131 | Opening stock | Asset | 3 | 113 | False |   | False |
| 1132 | Stock purchased | Asset | 3 | 113 | False |   | False |
| 11321 | Purchase stock value | Asset | 4 | 1132 | False |   | False |
| 11322 | Returned stock value | Asset | 4 | 1132 | False |   | False |
| 1133 | Stock sold | Asset | 3 | 113 | False |   | False |
| 11331 | Sold stock original value | Asset | 4 | 1133 | False |   | False |
| 11332 | Returned stock original value | Asset | 4 | 1133 | False |   | False |
| 1134 | Stockgot from expiry claims | Asset | 3 | 113 | False |   | False |
| 1135 | Stock given for expiry claims | Asset | 3 | 113 | False |   | False |
| 1136 | Stock expired | Asset | 3 | 113 | False |   | False |
| 1137 | Stock Productions | Asset | 3 | 113 | False |   | False |
| 1137001 | Actual Cost Of Consume Stock | Asset | 4 | 1137 | False |   | False |
| 1137002 | Actual Cost Of Produce Stock | Asset | 4 | 1137 | False |   | False |
| 1138 | Stock Packings | Asset | 3 | 113 | False |   | False |
| 1138001 | Actual Cost Of Packing Consume | Asset | 4 | 1138 | False |   | False |
| 1138002 | Actual Cost Of Finish Goods | Asset | 4 | 1138 | False |   | False |
| 12 | Fixed Assets | Asset | 1 | 1 | False |   | False |
| 12001 | HBL Instalment | Asset | 2 | 12 | False |  | True |
| 12002 | Instalment of Moter Bike | Asset | 2 | 12 | False |  | True |
| 12003 | Instalment of Moter Car | Asset | 2 | 12 | False |  | True |
| 121 | Auto vehicles | Asset | 2 | 12 | True |   | False |
| 1211 | Auto vehicles: Original value | Asset | 3 | 121 | False |   | False |
| 1212 | Auto vehicles: Depriciatiion | Asset | 3 | 121 | False |   | False |
| 122 | Furniture and fixture | Asset | 2 | 12 | True |   | False |
| 1221 | Fur and Fix: Original value | Asset | 3 | 122 | False |   | False |
| 1222 | Fur and Fix: Depriciation | Asset | 3 | 122 | False |   | False |
| 123 | Building and grounds | Asset | 2 | 12 | True |   | False |
| 1231 | Building and G: Original value | Asset | 3 | 123 | False |   | False |
| 1232 | Building and G: Depriciation | Asset | 3 | 123 | False |   | False |
| 124 | Office equipment | Asset | 2 | 12 | True |   | False |
| 1241 | Office equip: Original value | Asset | 3 | 124 | False |   | False |
| 1242 | Office equip: Depriciation.. | Asset | 3 | 124 | False |   | False |
| 125 | Computer & software | Asset | 2 | 12 | True |   | False |
| 1251 | Comp and Soft: Original value | Asset | 3 | 125 | False |   | False |
| 1252 | Comp and Soft: Depriciation | Asset | 3 | 125 | False |   | False |
| 13 | Other assets | Asset | 1 | 1 | True |   | False |
| 13001 | Factory Machinery Purchase | Asset | 2 | 13 | False |  | True |
| 131 | Salestax receivable | Asset | 2 | 13 | False |   | False |
| 1311 | Salestax paid on opening | Asset | 3 | 131 | False |   | False |
| 1312 | Salestax paid on purchase | Asset | 3 | 131 | False |   | False |
| 1313 | Salestax received on return | Asset | 3 | 131 | False |   | False |
| 1314 | Salestax received on sales | Asset | 3 | 131 | False |   | False |
| 1315 | Salestax paid on sales return | Asset | 3 | 131 | False |   | False |
| 132 | Prepaid expenses | Asset | 2 | 13 | False |   | False |
| 133 | Deposits and securities | Asset | 2 | 13 | False |   | False |
| 134 | Long term investment | Asset | 2 | 13 | False |   | False |
| 14 | Car Purchase Payment | Asset | 1 | 1 | False |  | False |
| 14001 | Car Sale And Purchase | Asset | 2 | 14 | False |  | False |
| 2 | Liabilities | Liability | 0 |  | True |   | False |
| 21 | Short term liabilities | Liability | 1 | 2 | False |   | False |
| 21001 | Atta Lab | Liability | 2 | 21 | False |  | True |
| 21002 | Anaiyat Aluminium Door | Liability | 2 | 21 | False |  | True |
| 21008 | Riaz Karachi | Liability | 2 | 21 | False |  | True |
| 22 | Long term liabilities | Liability | 1 | 2 | False |   | False |
| 3 | Equity | Capital | 0 |  | False |   | False |
| 31 | Capital investment | Capital | 1 | 3 | True |   | False |
| 31002 | Zafer Iqbal Saudia | Capital | 2 | 31 | False |  | True |
| 31003 | Rana Asad | Capital | 2 | 31 | False |  | True |
| 32 | Withdrawls | Capital | 1 | 3 | True |   | False |
| 33 | Last year earnings | Capital | 1 | 3 | True |   | False |
| 34 | Current year earnings | Capital | 1 | 3 | True |   | False |
| 4 | Revenue | Revenue | 0 |  | False |   | False |
| 41 | Net Sales | Revenue | 1 | 4 | False | + | False |
| 411 | Gross sales value | Revenue | 2 | 41 | False |   | False |
| 412 | Sales returned value | Revenue | 2 | 41 | False |   | False |
| 42 | Revenue through vendor claims | Revenue | 1 | 4 | False | + | False |
| 49 | Other income | Revenue | 1 | 4 | False | + | False |
| 5 | Expense | Expense | 0 |  | False |   | False |
| 51 | Sales expenses | Expense | 1 | 5 | False | - | False |
| 511 | Cost ofgoods sold | Expense | 2 | 51 | False |   | False |
| 5111 | Actual cost of sold stock | Expense | 3 | 511 | False |   | False |
| 5112 | Actual cost of returned stock | Expense | 3 | 511 | False |   | False |
| 5113 | MACHINE REPAIR AND MAINTENANCE | Expense | 3 | 511 | False | - | True |
| 512 | Discounts | Expense | 2 | 51 | False |   | False |
| 5121 | Special discount on sale | Expense | 3 | 512 | False |   | False |
| 5122 | Special discount returned | Expense | 3 | 512 | False |   | False |
| 5123 | Discount on recovery | Expense | 3 | 512 | False |   | False |
| 513 | Customer claimed stock value | Expense | 2 | 51 | False |   | False |
| 514 | Expired stock actual value | Expense | 2 | 51 | False |   | False |
| 515 | Purchase Return Cost Difference | Expense | 2 | 51 | False | - | False |
| 518 | Salery SalesMan | Expense | 2 | 51 | False | - | True |
| 519 | L.C MARKET EXP | Expense | 2 | 51 | False | - | True |
| 52 | General and admin expenses | Expense | 1 | 5 | False | - | False |
| 52001 | Factory Kitchen | Expense | 2 | 52 | False | - | True |
| 52002 | Zeeshan D.i / Drap | Expense | 2 | 52 | False | - | True |
| 52003 | Womiqa Ahmad | Expense | 2 | 52 | False | - | True |
| 52004 | RAHEEL Adv | Expense | 2 | 52 | False | - | True |
| 52005 | Product Regestration Fee DRAP | Expense | 2 | 52 | False | - | True |
| 52006 | IMRANULLAH (Labour inspecter) | Expense | 2 | 52 | False | - | True |
| 52007 | Liquid Yeast Purchase | Expense | 2 | 52 | False | - | True |
| 52008 | Bank Alhabib L.C Account | Expense | 2 | 52 | False | - | True |
| 52009 | Habib Car Rent | Expense | 2 | 52 | False | - | True |
| 5201 | Payroll | Expense | 2 | 52 | False |   | True |
| 52010 | Zafer Iqbal Profit | Expense | 2 | 52 | False | - | True |
| 52011 | Wages | Expense | 3 | 5201 | False | - | True |
| 52012 | Benifits | Expense | 3 | 5201 | False | - | False |
| 52013 | Payroll taxes | Expense | 3 | 5201 | False | - | False |
| 52014 | Salary Factory Staff | Expense | 3 | 5201 | False | - | True |
| 52015 | Salary Market Staff | Expense | 3 | 5201 | False | - | True |
| 5202 | Maintenance | Expense | 2 | 52 | False |   | True |
| 52021 | Auto vehicles | Expense | 3 | 5202 | False |   | False |
| 52022 | Furniture and fixture | Expense | 3 | 5202 | False |   | False |
| 52023 | Building and ground | Expense | 3 | 5202 | False |   | True |
| 52024 | Office equipment | Expense | 3 | 5202 | False |   | False |
| 52025 | Computer and software | Expense | 3 | 5202 | False |   | False |
| 52026 | Staitionary | Expense | 3 | 5202 | False |   | False |
| 5203 | Depriciation | Expense | 2 | 52 | False |   | False |
| 52031 | Depr: Auto vehicles | Expense | 3 | 5203 | False |   | False |
| 52032 | Depr: Furniture and fixture | Expense | 3 | 5203 | False |   | False |
| 52033 | Depr: Building and ground | Expense | 3 | 5203 | False |   | False |
| 52034 | Depr: Office equipment | Expense | 3 | 5203 | False |   | False |
| 52035 | Depr: Computer and software | Expense | 3 | 5203 | False |   | False |
| 5204 | Rents and leases | Expense | 2 | 52 | False |   | True |
| 52041 | Shop and store rent | Expense | 3 | 5204 | False |   | False |
| 5205 | Travel & entertainment | Expense | 2 | 52 | False |   | True |
| 52051 | Lodging | Expense | 3 | 5205 | False |   | False |
| 52052 | Transportation | Expense | 3 | 5205 | False |   | False |
| 52053 | Meals | Expense | 3 | 5205 | False |   | False |
| 52054 | Entertainment | Expense | 3 | 5205 | False |   | True |
| 52055 | Gasoline charges | Expense | 3 | 5205 | False |   | True |
| 5206 | Shipping | Expense | 2 | 52 | False |   | True |
| 52061 | Freight | Expense | 3 | 5206 | False |   | False |
| 52062 | Supply And Bility expenses | Expense | 3 | 5206 | False |  | True |
| 52063 | Insurance | Expense | 3 | 5206 | False |   | False |
| 5207 | Taxes & Zakat | Expense | 2 | 52 | False |   | True |
| 5208 | Consultancy fees | Expense | 2 | 52 | False |   | True |
| 5209 | Overhead expenes | Expense | 2 | 52 | False |   | False |
| 520901 | Telephone and faxes | Expense | 3 | 5209 | False |   | True |
| 520902 | Internet expenses | Expense | 3 | 5209 | False |   | True |
| 520903 | Mail and postages | Expense | 3 | 5209 | False |   | True |
| 520904 | Utitlity expenses | Expense | 3 | 5209 | False |   | True |
| 5209041 | Electricity bills | Expense | 4 | 520904 | False |   | True |
| 5209042 | Gas Bills | Expense | 4 | 520904 | False |   | True |
| 5209043 | Telephone Bill | Expense | 4 | 520904 | False |   | False |
| 520905 | Advertising | Expense | 3 | 5209 | False |   | True |
| 520906 | Contributions and donations | Expense | 3 | 5209 | False |   | True |
| 520907 | License or permit fees | Expense | 3 | 5209 | False |   | True |
| 520908 | Membership dues | Expense | 3 | 5209 | False |   | True |
| 520909 | News papers and journals | Expense | 3 | 5209 | False |   | True |
| 520910 | Promotion public relations | Expense | 3 | 5209 | False |   | True |
| 5210 | Financial expenses | Expense | 2 | 52 | False |   | True |
| 52101 | Intrests | Expense | 3 | 5210 | False |   | False |
| 52102 | Bank charges | Expense | 3 | 5210 | False |   | True |
| 5211 | Admin Staff Salay | Expense | 2 | 52 | False |  | False |
| 5211001 | admin staff salary | Expense | 3 | 5211 | False | - | True |
| 53 | Income tax | Expense | 1 | 5 | False | - | True |
| 54 | Other expenses | Expense | 1 | 5 | False | - | True |
| 540 | Factory Utility Bills | Expense | 2 | 54 | False | - | True |
| 540001 | Bank Instalment | Expense | 2 | 54 | True | - | True |
| 54001 | Shafeeq/ Ishaq | Expense | 2 | 54 | False | - | True |
| 541 | Cash short | Expense | 2 | 54 | False |   | False |
| 544 | Foreign Tour | Expense | 2 | 54 | False | - | True |
| 546 | Dr.Abdul Razzaq Sb Travelling | Expense | 2 | 54 | False | - | True |
| 547 | Factory Karcha | Expense | 2 | 54 | False | - | True |
| 548 | Market Team Expenses | Expense | 2 | 54 | False | - | True |
| 549 | Market Incentive | Expense | 2 | 54 | False | - | True |
| 55 | Car maintinance | Expense | 1 | 5 | False |  | False |
| 55001 | Car And Loader Vehciles Repair | Expense | 2 | 55 | False | - | True |
| 6 | Parties | Party | 0 |  | False |   | False |
| 61 | Vendors | Party | 1 | 6 | True |   | False |
| 610001 | Khalid Plastic Bottle  | Party | 2 | 61 | False |  | True |
| 610003 | Dr.Umer plastic Bottle Pet | Party | 2 | 61 | False |  | True |
| 610004 | Waqas Printing | Party | 2 | 61 | False |  | True |
| 610005 | Muneer Carton | Party | 2 | 61 | False |  | True |
| 610006 | Hafeez DCP  | Party | 2 | 61 | False |  | True |
| 610010 | S.A Salt | Party | 2 | 61 | False |  | True |
| 610012 | HAFIZ IMRAN Plastic | Party | 2 | 61 | False |  | True |
| 610014 | USMAN Lab | Party | 2 | 61 | False |  | True |
| 610016 | Khalid Bento | Party | 2 | 61 | False |  | True |
| 610018 | Local Raw Material Purchase  | Party | 2 | 61 | False |  | True |
| 610019 | Local Packing Material Purchase  | Party | 2 | 61 | False |  | True |
| 610021 | Quality Plastic  | Party | 2 | 61 | False |  | True |
| 610022 | Calcium And Bentonite Purchase | Party | 2 | 61 | False |  | True |
| 62 | Customers | Party | 1 | 6 | True |   | False |
| 620001 | Dr Zia | Party | 2 | 62 | False |  | True |
| 620005 | Dr/Wajid V/S | Party | 2 | 62 | False |  | True |
| 620006 | Nasir Jamal | Party | 2 | 62 | False |  | True |
| 620007 | Mehar Younas | Party | 2 | 62 | False |  | True |
| 620008 | Amir Mian | Party | 2 | 62 | False |  | True |
| 620010 | Shan M/S  | Party | 2 | 62 | False |  | True |
| 620012 | Raao Shifakhana  | Party | 2 | 62 | False |  | True |
| 620013 | Alharam Traders | Party | 2 | 62 | False |  | True |
| 620014 | Hamza & Talha Traders | Party | 2 | 62 | False |  | True |
| 620015 | Faizan Ejaz | Party | 2 | 62 | False |  | True |
| 620016 | Habib Malik  | Party | 2 | 62 | False |  | True |
| 620020 | Dr.Tahir | Party | 2 | 62 | False |  | True |
| 620022 | Imtiyaz Supra Traders 2 | Party | 2 | 62 | False |  | True |
| 620024 | Rana Flour Mill & Kashmir Wanda | Party | 2 | 62 | False |  | True |
| 620027 | H.P.I Traders | Party | 2 | 62 | False |  | True |
| 620031 | Dr.Khalid  | Party | 2 | 62 | False |  | True |
| 620032 | Dr.wasey | Party | 2 | 62 | False |  | True |
| 620033 | Enaam Traders | Party | 2 | 62 | False |  | True |
| 620034 | Lucky Marwat V/S | Party | 2 | 62 | False |  | True |
| 620035 | Yaqoob | Party | 2 | 62 | False |  | True |
| 620037 | Meer Khan  | Party | 2 | 62 | False |  | True |
| 620038 | Noor Khan | Party | 2 | 62 | False |  | True |
| 620039 | Shareef  | Party | 2 | 62 | False |  | True |
| 620040 | Meer Khan | Party | 2 | 62 | False |  | True |
| 620041 | Qazi Irfan | Party | 2 | 62 | False |  | True |
| 620042 | Dr.Darban Azad Traders | Party | 2 | 62 | False |  | True |
| 620045 | Dr.Irfan Ullah  | Party | 2 | 62 | False |  | True |
| 620046 | Aaman Ullah | Party | 2 | 62 | False |  | True |
| 620047 | Ameen Medical Store | Party | 2 | 62 | False |  | True |
| 620049 | ORION GROUP FSD | Party | 2 | 62 | False |  | True |
| 620060 | Hafiz Poultry medicos | Party | 2 | 62 | False |  | True |
| 620061 | Supreme Poultry  | Party | 2 | 62 | False |  | True |
| 620062 | Dr,ASIF | Party | 2 | 62 | False |  | True |
| 620063 | Sheikh Shahid  | Party | 2 | 62 | False |  | True |
| 620064 | Glubal V/S  | Party | 2 | 62 | False |  | True |
| 620065 | OBAID KAREEM | Party | 2 | 62 | False |  | True |
| 620067 | HALEEM Vetnairy Store | Party | 2 | 62 | False |  | True |
| 620071 | Dr.Usman | Party | 2 | 62 | False |  | True |
| 620074 | Zeeshan Bivet Lahore | Party | 2 | 62 | False |  | True |
| 620076 | Attique | Party | 2 | 62 | False |  | True |
| 620078 | Kashmir poultry LiveStock | Party | 2 | 62 | False |  | True |
| 620080 | A.R Group Pindi | Party | 2 | 62 | False |  | True |
| 620081 | Vassy Jhang | Party | 2 | 62 | False |  | True |
| 620083 | AL-Qabeer Poultary | Party | 2 | 62 | False |  | True |
| 620091 | Hamza and Talha Traders 2 | Party | 2 | 62 | False |  | True |
| 620092 | Dr SAQAB  | Party | 2 | 62 | False |  | True |
| 620094 | Alharam Traders 2. | Party | 2 | 62 | False |  | True |
| 620095 | Malik Afaaq | Party | 2 | 62 | False |  | True |
| 620096 | Merlin Life care/ Dr.Asif | Party | 2 | 62 | False |  | True |
| 620097 | Dr.TAHIR SGD | Party | 2 | 62 | False |  | True |
| 620098 | RANA LIAQAT SGD | Party | 2 | 62 | False |  | True |
| 620099 | HAFIZ MEDICOZ LIVESTOCK | Party | 2 | 62 | False |  | True |
| 620103 | Nimat Ullah | Party | 2 | 62 | False |  | True |
| 620104 | VIRTUS Pharmaceuticals | Party | 2 | 62 | False |  | True |
| 620107 | Danish Poultry Sakkhar | Party | 2 | 62 | False |  | True |
| 620108 | The Poultry Solution  | Party | 2 | 62 | False |  | True |
| 620109 | Dr.Saqab Leon Group | Party | 2 | 62 | False |  | True |
| 620110 | Z.A Enterprises | Party | 2 | 62 | False |  | True |
| 620111 | Dr.Wadood  C/O Hafiz Poultry | Party | 2 | 62 | False |  | True |
| 620112 | Hassan Shahid  | Party | 2 | 62 | False |  | True |
| 620113 | Waseem Traders | Party | 2 | 62 | False |  | True |
| 620114 | Zain V/S Cuttling | Party | 2 | 62 | False |  | True |
| 620115 | Shah V/S  | Party | 2 | 62 | False |  | True |
| 620116 | Almansoor V/S  | Party | 2 | 62 | False |  | True |
| 620117 | Dr.Shakeel  | Party | 2 | 62 | False |  | True |
| 620118 | Amjad Khan  | Party | 2 | 62 | False |  | True |
| 620119 | Dr.Fida  | Party | 2 | 62 | False |  | True |
| 620120 | Decent Poluntry  | Party | 2 | 62 | False |  | True |
| 620121 | Jahzaib Sumandari | Party | 2 | 62 | False |  | True |
| 620122 | Islamabad Poultry | Party | 2 | 62 | False |  | False |
| 63 | Salesmen | Party | 1 | 6 | True |   | False |
| 64 | personal | Party | 1 | 6 | False |  | False |
| 64002 | DR.Abdul Razzaq Sb | Party | 2 | 64 | False |  | True |
| 64004 | Rana Anwaar | Party | 2 | 64 | False |  | True |
| 64005 | Rana Shezad | Party | 2 | 64 | False |  | True |
| 64007 | Mrs.Farah | Party | 2 | 64 | False |  | True |
| 64008 | Rana Asad | Party | 2 | 64 | False |  | True |
| 64009 | NBP Loan | Party | 2 | 64 | False |  | True |
| 64010 | Zafer Iqbal Investment | Party | 2 | 64 | False |  | True |
| 64011 | Ishaq Okara Investment | Party | 2 | 64 | False |  | True |
| 64012 | Bio Oxime | Party | 2 | 64 | False |  | True |

## Parties (83)

| AccountNo | Name | Type | CustomerType | Town | City | Phone | CreditLimit | CreditPeriod | License | LicenseExpiry | BirthDate | PriceCategory | Active |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 610001 | Khalid Plastic Bottle  | Vendor | Other |  | Faisalabad | 0300-5468286 | 0 | 0 |  |  | 06/26/2023 00:00:00 | TradePrice1 | True |
| 610003 | Dr.Umer plastic Bottle Pet | Vendor | Other |  | Faisalabad | 0321-6669999 | 0 | 0 |  |  | 06/26/2023 00:00:00 | TradePrice1 | True |
| 610004 | Waqas Printing | Vendor | Other |  | Faisalabad | 0300-5549513 | 0 | 0 |  |  | 06/26/2023 00:00:00 | TradePrice1 | True |
| 610005 | Muneer Carton | Vendor | Other |  | Faisalabad | 0307-3513772 | 0 | 0 |  |  | 06/26/2023 00:00:00 | TradePrice1 | True |
| 610006 | Hafeez DCP  | Vendor | Other |  | Faisalabad | 0300-8650473 | 0 | 0 |  |  | 06/26/2023 00:00:00 | TradePrice1 | True |
| 610010 | S.A Salt | Vendor | Other |  | Faisalabad | 0300-6635509 | 0 | 0 |  |  | 06/26/2023 00:00:00 | TradePrice1 | True |
| 610012 | HAFIZ IMRAN Plastic | Vendor | Other |  | Faisalabad | 0302-9316106 | 0 | 0 |  |  | 07/13/2023 00:00:00 | TradePrice1 | True |
| 610014 | USMAN Lab | Vendor | Other |  | Faisalabad | 041-2646801 | 0 | 0 |  |  | 07/01/2023 00:00:00 | TradePrice1 | True |
| 610016 | Khalid Bento | Vendor | Other |  | Faisalabad | 0303-7777467 | 0 | 0 |  |  | 06/26/2023 00:00:00 | TradePrice1 | True |
| 610018 | Local Raw Material Purchase  | Vendor | Other |  | FSD |  | 0 | 0 |  |  | 10/17/2024 00:00:00 | TradePrice1 | True |
| 610019 | Local Packing Material Purchase  | Vendor | Other |  | FSD |  | 0 | 0 |  |  | 10/17/2024 00:00:00 | TradePrice1 | True |
| 610021 | Quality Plastic  | Vendor | Other |  |  |  | 0 | 0 |  |  | 01/01/2026 00:00:00 | TradePrice1 | True |
| 610022 | Calcium And Bentonite Purchase | Vendor | Other |  |  |  | 0 | 0 |  |  | 04/01/2026 00:00:00 | TradePrice1 | True |
| 620001 | Dr Zia | Customer | Retailer | Kabul |  |  | 0 | 0 |  | 06/20/2025 00:00:00 | 06/21/2023 00:00:00 | TradePrice1 | True |
| 620005 | Dr/Wajid V/S | Customer | Retailer | Peshawer |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620006 | Nasir Jamal | Customer | Retailer | Islamabad |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620007 | Mehar Younas | Customer | Retailer | Dajkot |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620008 | Amir Mian | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620010 | Shan M/S  | Customer | Retailer | Toba Tek Singh |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620012 | Raao Shifakhana  | Customer | Retailer | Layyah |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620013 | Alharam Traders | Customer | Retailer | Kamaliya |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620014 | Hamza & Talha Traders | Customer | Retailer | Sargodha |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620015 | Faizan Ejaz | Customer | Retailer | Lahore |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620016 | Habib Malik  | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 06/24/2025 00:00:00 | 06/25/2023 00:00:00 | TradePrice1 | True |
| 620020 | Dr.Tahir | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620022 | Imtiyaz Supra Traders 2 | Customer | Retailer | Gujranwala |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620024 | Rana Flour Mill & Kashmir Wanda | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620027 | H.P.I Traders | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620031 | Dr.Khalid  | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620032 | Dr.wasey | Customer | Retailer | Jhang |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620033 | Enaam Traders | Customer | Retailer | Peshawer |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620034 | Lucky Marwat V/S | Customer | Retailer | Lucky Marwat |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620035 | Yaqoob | Customer | Retailer | Quetta |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620037 | Meer Khan  | Customer | Retailer | Quetta |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620038 | Noor Khan | Customer | Retailer | Quetta |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620039 | Shareef  | Customer | Retailer | Quetta |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620040 | Meer Khan | Customer | Retailer | Kabul |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620041 | Qazi Irfan | Customer | Retailer | Rohri |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620042 | Dr.Darban Azad Traders | Customer | Retailer | Sakkur |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620045 | Dr.Irfan Ullah  | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 06/25/2025 00:00:00 | 06/26/2023 00:00:00 | TradePrice1 | True |
| 620046 | Aaman Ullah | Customer | Retailer | Surai Nurang |  |  | 0 | 0 |  | 07/15/2025 00:00:00 | 07/16/2023 00:00:00 | TradePrice1 | True |
| 620047 | Ameen Medical Store | Customer | Doctor | Peshawer |  |  | 0 | 0 |  | 07/15/2025 00:00:00 | 07/16/2023 00:00:00 | TradePrice1 | True |
| 620049 | ORION GROUP FSD | Customer | Doctor | Faisalabad |  |  | 0 | 0 |  | 07/17/2025 00:00:00 | 07/18/2023 00:00:00 | TradePrice1 | True |
| 620060 | Hafiz Poultry medicos | Customer | Retailer | Jaranwala |  |  | 0 | 0 |  | 04/29/2026 00:00:00 | 04/18/2024 00:00:00 | TradePrice1 | True |
| 620061 | Supreme Poultry  | Customer | Retailer | Peshawer |  |  | 0 | 0 |  | 04/29/2026 00:00:00 | 04/23/2024 00:00:00 | TradePrice1 | True |
| 620062 | Dr,ASIF | Customer | Retailer | Hafizabad |  |  | 0 | 0 |  | 05/19/2026 00:00:00 | 05/19/2024 00:00:00 | TradePrice1 | True |
| 620063 | Sheikh Shahid  | Customer | Retailer | Hyderabad |  |  | 0 | 0 |  | 05/31/2026 00:00:00 | 05/22/2024 00:00:00 | TradePrice1 | True |
| 620064 | Glubal V/S  | Customer | Retailer | Quetta |  |  | 0 | 0 |  | 06/02/2026 00:00:00 | 05/25/2024 00:00:00 | TradePrice1 | True |
| 620065 | OBAID KAREEM | Customer | Retailer | Hyderabad |  |  | 0 | 0 |  | 08/24/2026 00:00:00 | 08/24/2024 00:00:00 | TradePrice1 | True |
| 620067 | HALEEM Vetnairy Store | Customer | Retailer | Peshawer |  |  | 0 | 0 |  | 09/18/2026 00:00:00 | 09/18/2024 00:00:00 | TradePrice1 | True |
| 620071 | Dr.Usman | Customer | Retailer | Kamaliya |  |  | 0 | 0 |  | 10/24/2026 00:00:00 | 10/24/2024 00:00:00 | TradePrice1 | True |
| 620074 | Zeeshan Bivet Lahore | Customer | Retailer | Lahore |  |  | 0 | 0 |  | 11/27/2026 00:00:00 | 11/27/2024 00:00:00 | TradePrice1 | True |
| 620076 | Attique | Customer | Retailer | Quetta |  |  | 0 | 0 |  | 12/16/2026 00:00:00 | 12/16/2024 00:00:00 | TradePrice1 | True |
| 620078 | Kashmir poultry LiveStock | Customer | Retailer | Rawalpindi |  |  | 0 | 0 |  | 12/19/2026 00:00:00 | 12/19/2024 00:00:00 | TradePrice1 | True |
| 620080 | A.R Group Pindi | Customer | Retailer | Rawalpindi |  |  | 0 | 0 |  | 01/19/2027 00:00:00 | 01/19/2025 00:00:00 | TradePrice1 | True |
| 620081 | Vassy Jhang | Customer | Retailer | Jhang |  |  | 0 | 0 |  | 02/08/2027 00:00:00 | 02/08/2025 00:00:00 | TradePrice1 | True |
| 620083 | AL-Qabeer Poultary | Customer | Retailer | Mianwali |  |  | 0 | 0 |  | 02/08/2027 00:00:00 | 02/08/2025 00:00:00 | TradePrice1 | True |
| 620091 | Hamza and Talha Traders 2 | Customer | Retailer | Sargodha |  |  | 0 | 0 |  | 04/07/2027 00:00:00 | 04/07/2025 00:00:00 | TradePrice1 | True |
| 620092 | Dr SAQAB  | Customer | Retailer | Muzaffarghar |  |  | 0 | 0 |  | 04/29/2027 00:00:00 | 04/29/2025 00:00:00 | TradePrice1 | True |
| 620094 | Alharam Traders 2. | Customer | Retailer | Kamaliya |  |  | 0 | 0 |  | 08/19/2027 00:00:00 | 08/13/2025 00:00:00 | TradePrice1 | True |
| 620095 | Malik Afaaq | Customer | Retailer | Sargodha |  |  | 0 | 0 |  | 08/19/2027 00:00:00 | 08/07/2025 00:00:00 | TradePrice1 | True |
| 620096 | Merlin Life care/ Dr.Asif | Customer | Retailer | Multan |  |  | 0 | 0 |  | 09/02/2027 00:00:00 | 08/23/2025 00:00:00 | TradePrice1 | True |
| 620097 | Dr.TAHIR SGD | Customer | Retailer | Sargodha |  |  | 0 | 0 |  | 12/02/2027 00:00:00 | 11/01/2025 00:00:00 | TradePrice1 | True |
| 620098 | RANA LIAQAT SGD | Customer | Retailer | Sargodha |  |  | 0 | 0 |  | 12/02/2027 00:00:00 | 11/15/2025 00:00:00 | TradePrice1 | True |
| 620099 | HAFIZ MEDICOZ LIVESTOCK | Customer | Retailer | Jaranwala |  |  | 0 | 0 |  | 12/28/2027 00:00:00 | 11/01/2025 00:00:00 | TradePrice1 | True |
| 620103 | Nimat Ullah | Customer | Other | Sawaat |  |  | 0 | 0 |  | 02/17/2028 00:00:00 | 01/01/2026 00:00:00 | TradePrice1 | True |
| 620104 | VIRTUS Pharmaceuticals | Customer | Doctor | Faisalabad |  |  | 0 | 0 |  | 02/25/2028 00:00:00 | 01/01/2026 00:00:00 | TradePrice1 | True |
| 620107 | Danish Poultry Sakkhar | Customer | Retailer | Sakkur |  |  | 0 | 0 |  | 04/22/2028 00:00:00 | 04/23/2026 00:00:00 | TradePrice1 | True |
| 620108 | The Poultry Solution  | Customer | Retailer | Karachi |  |  | 0 | 0 |  | 04/22/2028 00:00:00 | 02/28/2026 00:00:00 | TradePrice1 | True |
| 620109 | Dr.Saqab Leon Group | Customer | Retailer | Multan |  |  | 0 | 0 |  | 04/29/2028 00:00:00 | 04/15/2026 00:00:00 | TradePrice1 | True |
| 620110 | Z.A Enterprises | Customer | Retailer | Faisalabad |  |  | 0 | 0 |  | 05/25/2028 00:00:00 | 05/26/2026 00:00:00 | TradePrice1 | True |
| 620111 | Dr.Wadood  C/O Hafiz Poultry | Customer | Retailer | Sahiwal |  |  | 0 | 0 |  | 07/03/2028 00:00:00 | 07/04/2026 00:00:00 | TradePrice1 | True |
| 620112 | Hassan Shahid  | Customer | Retailer | OKARA |  |  | 0 | 0 |  | 07/03/2028 00:00:00 | 07/04/2026 00:00:00 | TradePrice1 | True |
| 620113 | Waseem Traders | Customer | Retailer | Hyderabad |  |  | 0 | 0 |  | 07/03/2028 00:00:00 | 07/04/2026 00:00:00 | TradePrice1 | True |
| 620114 | Zain V/S Cuttling | Customer | Retailer | Cuttling |  |  | 0 | 0 |  | 07/07/2028 00:00:00 | 07/08/2026 00:00:00 | TradePrice1 | True |
| 620115 | Shah V/S  | Customer | Retailer | Boneer |  |  | 0 | 0 |  | 07/07/2028 00:00:00 | 07/08/2026 00:00:00 | TradePrice1 | True |
| 620116 | Almansoor V/S  | Customer | Retailer | Khaal |  |  | 0 | 0 |  | 07/07/2028 00:00:00 | 07/08/2026 00:00:00 | TradePrice1 | True |
| 620117 | Dr.Shakeel  | Customer | Retailer | Rahim Yar Khan |  |  | 0 | 0 |  | 07/28/2028 00:00:00 | 07/29/2026 00:00:00 | TradePrice1 | True |
| 620118 | Amjad Khan  | Customer | Retailer | Peshawer |  |  | 0 | 0 |  | 07/28/2028 00:00:00 | 07/29/2026 00:00:00 | TradePrice1 | True |
| 620119 | Dr.Fida  | Customer | Retailer | Mianwali |  |  | 0 | 0 |  | 07/28/2028 00:00:00 | 07/29/2026 00:00:00 | TradePrice1 | True |
| 620120 | Decent Poluntry  | Customer | Retailer | Rahim Yar Khan |  |  | 0 | 0 |  | 08/12/2028 00:00:00 | 08/13/2026 00:00:00 | TradePrice1 | True |
| 620121 | Jahzaib Sumandari | Customer | Retailer | Dajkot |  |  | 0 | 0 |  | 08/16/2028 00:00:00 | 08/17/2026 00:00:00 | TradePrice1 | True |
| 620122 | Islamabad Poultry | Customer | Retailer | Quetta |  |  | 0 | 0 |  | 08/17/2028 00:00:00 | 08/18/2026 00:00:00 | TradePrice1 | True |

### Party full details

**610001 — Khalid Plastic Bottle **

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: 204 Chak canal Road
- Contact: ; Phone1: 0300-5468286; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610003 — Dr.Umer plastic Bottle Pet**

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: D,Type colony 
- Contact: ; Phone1: 0321-6669999; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610004 — Waqas Printing**

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: Model Town Narwala Road
- Contact: ; Phone1: 0300-5549513; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610005 — Muneer Carton**

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: Kashmir Road G M Abad
- Contact: ; Phone1: 0307-3513772; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610006 — Hafeez DCP **

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: 
- Contact: ; Phone1: 0300-8650473; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610010 — S.A Salt**

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: 7 Chak Same Pully Daewoo Road 
- Contact: M.Faqeer; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 0300-6635509
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610012 — HAFIZ IMRAN Plastic**

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: Kashmir Road, Gulam.M. Abad
- Contact: Imran Sb; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 0302-9316106
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 07/13/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610014 — USMAN Lab**

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: Jinnah Colony
- Contact: Usman; Phone1: 041-2646801; Phone2: ; Phone3: ; Fax: 041-2413352; Mobile: 0300-7636605
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 07/01/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610016 — Khalid Bento**

- Type: Vendor; CustomerType: Other
- Town: ; City: Faisalabad; Address: Muslim Town,FSD
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 0303-7777467
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**610018 — Local Raw Material Purchase **

- Type: Vendor; CustomerType: Other
- Town: ; City: FSD; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 10/17/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**610019 — Local Packing Material Purchase **

- Type: Vendor; CustomerType: Other
- Town: ; City: FSD; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 10/17/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**610021 — Quality Plastic **

- Type: Vendor; CustomerType: Other
- Town: ; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 01/01/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**610022 — Calcium And Bentonite Purchase**

- Type: Vendor; CustomerType: Other
- Town: ; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry ); BirthDate: 04/01/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620001 — Dr Zia**

- Type: Customer; CustomerType: Retailer
- Town: Kabul; City: ; Address: 
- Contact: 0320-5788580; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/20/2025 00:00:00); BirthDate: 06/21/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620005 — Dr/Wajid V/S**

- Type: Customer; CustomerType: Retailer
- Town: Peshawer; City: ; Address: Mardan
- Contact: 0300-5713893; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620006 — Nasir Jamal**

- Type: Customer; CustomerType: Retailer
- Town: Islamabad; City: ; Address: Rawalpindi
- Contact: 0333-9598515; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620007 — Mehar Younas**

- Type: Customer; CustomerType: Retailer
- Town: Dajkot; City: ; Address: -
- Contact: 0300-6010017; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620008 — Amir Mian**

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: 
- Contact: 0303-9004350; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620010 — Shan M/S **

- Type: Customer; CustomerType: Retailer
- Town: Toba Tek Singh; City: ; Address: -
- Contact: 0321-2215324; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620012 — Raao Shifakhana **

- Type: Customer; CustomerType: Retailer
- Town: Layyah; City: ; Address: -
- Contact: 0300-6762646; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620013 — Alharam Traders**

- Type: Customer; CustomerType: Retailer
- Town: Kamaliya; City: ; Address: -
- Contact: 0342-7588588; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620014 — Hamza & Talha Traders**

- Type: Customer; CustomerType: Retailer
- Town: Sargodha; City: ; Address: -
- Contact: 0300-9600979; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620015 — Faizan Ejaz**

- Type: Customer; CustomerType: Retailer
- Town: Lahore; City: ; Address: -
- Contact: 0311-4366713; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620016 — Habib Malik **

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: -
- Contact: 0321-8669948; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/24/2025 00:00:00); BirthDate: 06/25/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620020 — Dr.Tahir**

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: A block G.M Abad
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620022 — Imtiyaz Supra Traders 2**

- Type: Customer; CustomerType: Retailer
- Town: Gujranwala; City: ; Address: -
- Contact: 0300-8430956; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620024 — Rana Flour Mill & Kashmir Wanda**

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: 29 chak
- Contact: 0321-7535757; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620027 — H.P.I Traders**

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: Sargodha Road
- Contact: 0321-9660960; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620031 — Dr.Khalid **

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: Faisalabad 
- Contact: 0333-8179255; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620032 — Dr.wasey**

- Type: Customer; CustomerType: Retailer
- Town: Jhang; City: ; Address: -
- Contact: 0303-4465194, 0326-1991491; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620033 — Enaam Traders**

- Type: Customer; CustomerType: Retailer
- Town: Peshawer; City: ; Address: -
- Contact: 0300-8584201; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620034 — Lucky Marwat V/S**

- Type: Customer; CustomerType: Retailer
- Town: Lucky Marwat; City: ; Address: Lucky Marwat
- Contact: 0313-9006490; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620035 — Yaqoob**

- Type: Customer; CustomerType: Retailer
- Town: Quetta; City: ; Address: 
- Contact: 0302-3874430; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620037 — Meer Khan **

- Type: Customer; CustomerType: Retailer
- Town: Quetta; City: ; Address: 
- Contact: 0315-0972320, 0333-3352320; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620038 — Noor Khan**

- Type: Customer; CustomerType: Retailer
- Town: Quetta; City: ; Address: 
- Contact: 0300-0440079; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620039 — Shareef **

- Type: Customer; CustomerType: Retailer
- Town: Quetta; City: ; Address: 
- Contact: 0311-8337130, 0336-1824900; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620040 — Meer Khan**

- Type: Customer; CustomerType: Retailer
- Town: Kabul; City: ; Address: 
- Contact: 0093700088551; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620041 — Qazi Irfan**

- Type: Customer; CustomerType: Retailer
- Town: Rohri; City: ; Address: -
- Contact: 0304-2383290; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620042 — Dr.Darban Azad Traders**

- Type: Customer; CustomerType: Retailer
- Town: Sakkur; City: ; Address: 
- Contact: 0304-7783209; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620045 — Dr.Irfan Ullah **

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: Model Town Narwala Road
- Contact: 0302-6093663; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/25/2025 00:00:00); BirthDate: 06/26/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620046 — Aaman Ullah**

- Type: Customer; CustomerType: Retailer
- Town: Surai Nurang; City: ; Address: Suraiy Nurang + Peshawar
- Contact: 0300-5764491; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/15/2025 00:00:00); BirthDate: 07/16/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620047 — Ameen Medical Store**

- Type: Customer; CustomerType: Doctor
- Town: Peshawer; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/15/2025 00:00:00); BirthDate: 07/16/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620049 — ORION GROUP FSD**

- Type: Customer; CustomerType: Doctor
- Town: Faisalabad; City: ; Address: Sargodha Road
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/17/2025 00:00:00); BirthDate: 07/18/2023 00:00:00
- PriceCategory: TradePrice1; Active: True

**620060 — Hafiz Poultry medicos**

- Type: Customer; CustomerType: Retailer
- Town: Jaranwala; City: ; Address: Jaranwala.
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 04/29/2026 00:00:00); BirthDate: 04/18/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620061 — Supreme Poultry **

- Type: Customer; CustomerType: Retailer
- Town: Peshawer; City: ; Address: Peshawer
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 04/29/2026 00:00:00); BirthDate: 04/23/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620062 — Dr,ASIF**

- Type: Customer; CustomerType: Retailer
- Town: Hafizabad; City: ; Address: Hafizabad
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 05/19/2026 00:00:00); BirthDate: 05/19/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620063 — Sheikh Shahid **

- Type: Customer; CustomerType: Retailer
- Town: Hyderabad; City: ; Address: Hyderabad
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 05/31/2026 00:00:00); BirthDate: 05/22/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620064 — Glubal V/S **

- Type: Customer; CustomerType: Retailer
- Town: Quetta; City: ; Address: QUETTA
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 06/02/2026 00:00:00); BirthDate: 05/25/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620065 — OBAID KAREEM**

- Type: Customer; CustomerType: Retailer
- Town: Hyderabad; City: ; Address: Hyderabad
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 08/24/2026 00:00:00); BirthDate: 08/24/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620067 — HALEEM Vetnairy Store**

- Type: Customer; CustomerType: Retailer
- Town: Peshawer; City: ; Address: Peshawer
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 09/18/2026 00:00:00); BirthDate: 09/18/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620071 — Dr.Usman**

- Type: Customer; CustomerType: Retailer
- Town: Kamaliya; City: ; Address: Kamaliya
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 10/24/2026 00:00:00); BirthDate: 10/24/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620074 — Zeeshan Bivet Lahore**

- Type: Customer; CustomerType: Retailer
- Town: Lahore; City: ; Address: Lahore
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 11/27/2026 00:00:00); BirthDate: 11/27/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620076 — Attique**

- Type: Customer; CustomerType: Retailer
- Town: Quetta; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 12/16/2026 00:00:00); BirthDate: 12/16/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620078 — Kashmir poultry LiveStock**

- Type: Customer; CustomerType: Retailer
- Town: Rawalpindi; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 12/19/2026 00:00:00); BirthDate: 12/19/2024 00:00:00
- PriceCategory: TradePrice1; Active: True

**620080 — A.R Group Pindi**

- Type: Customer; CustomerType: Retailer
- Town: Rawalpindi; City: ; Address: RawalPindi
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 01/19/2027 00:00:00); BirthDate: 01/19/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620081 — Vassy Jhang**

- Type: Customer; CustomerType: Retailer
- Town: Jhang; City: ; Address: Jhang
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 02/08/2027 00:00:00); BirthDate: 02/08/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620083 — AL-Qabeer Poultary**

- Type: Customer; CustomerType: Retailer
- Town: Mianwali; City: ; Address: Mianwali
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 02/08/2027 00:00:00); BirthDate: 02/08/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620091 — Hamza and Talha Traders 2**

- Type: Customer; CustomerType: Retailer
- Town: Sargodha; City: ; Address: Sargodha
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 04/07/2027 00:00:00); BirthDate: 04/07/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620092 — Dr SAQAB **

- Type: Customer; CustomerType: Retailer
- Town: Muzaffarghar; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 04/29/2027 00:00:00); BirthDate: 04/29/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620094 — Alharam Traders 2.**

- Type: Customer; CustomerType: Retailer
- Town: Kamaliya; City: ; Address: Kamaliya
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 08/19/2027 00:00:00); BirthDate: 08/13/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620095 — Malik Afaaq**

- Type: Customer; CustomerType: Retailer
- Town: Sargodha; City: ; Address: Sargodah
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 08/19/2027 00:00:00); BirthDate: 08/07/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620096 — Merlin Life care/ Dr.Asif**

- Type: Customer; CustomerType: Retailer
- Town: Multan; City: ; Address: MULTAN
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 09/02/2027 00:00:00); BirthDate: 08/23/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620097 — Dr.TAHIR SGD**

- Type: Customer; CustomerType: Retailer
- Town: Sargodha; City: ; Address: Sargodah
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 12/02/2027 00:00:00); BirthDate: 11/01/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620098 — RANA LIAQAT SGD**

- Type: Customer; CustomerType: Retailer
- Town: Sargodha; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 12/02/2027 00:00:00); BirthDate: 11/15/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620099 — HAFIZ MEDICOZ LIVESTOCK**

- Type: Customer; CustomerType: Retailer
- Town: Jaranwala; City: ; Address: Jaranwala
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 12/28/2027 00:00:00); BirthDate: 11/01/2025 00:00:00
- PriceCategory: TradePrice1; Active: True

**620103 — Nimat Ullah**

- Type: Customer; CustomerType: Other
- Town: Sawaat; City: ; Address: Sawaat
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 02/17/2028 00:00:00); BirthDate: 01/01/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620104 — VIRTUS Pharmaceuticals**

- Type: Customer; CustomerType: Doctor
- Town: Faisalabad; City: ; Address: Faisalabad
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 02/25/2028 00:00:00); BirthDate: 01/01/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620107 — Danish Poultry Sakkhar**

- Type: Customer; CustomerType: Retailer
- Town: Sakkur; City: ; Address: Sakkhar
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 04/22/2028 00:00:00); BirthDate: 04/23/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620108 — The Poultry Solution **

- Type: Customer; CustomerType: Retailer
- Town: Karachi; City: ; Address: Karachi
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 04/22/2028 00:00:00); BirthDate: 02/28/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620109 — Dr.Saqab Leon Group**

- Type: Customer; CustomerType: Retailer
- Town: Multan; City: ; Address: Multan
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 04/29/2028 00:00:00); BirthDate: 04/15/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620110 — Z.A Enterprises**

- Type: Customer; CustomerType: Retailer
- Town: Faisalabad; City: ; Address: 
- Contact: FSD; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 05/25/2028 00:00:00); BirthDate: 05/26/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620111 — Dr.Wadood  C/O Hafiz Poultry**

- Type: Customer; CustomerType: Retailer
- Town: Sahiwal; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/03/2028 00:00:00); BirthDate: 07/04/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620112 — Hassan Shahid **

- Type: Customer; CustomerType: Retailer
- Town: OKARA; City: ; Address: Okara
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/03/2028 00:00:00); BirthDate: 07/04/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620113 — Waseem Traders**

- Type: Customer; CustomerType: Retailer
- Town: Hyderabad; City: ; Address: Hyderabad
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/03/2028 00:00:00); BirthDate: 07/04/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620114 — Zain V/S Cuttling**

- Type: Customer; CustomerType: Retailer
- Town: Cuttling; City: ; Address: Cuttling Kpk
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/07/2028 00:00:00); BirthDate: 07/08/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620115 — Shah V/S **

- Type: Customer; CustomerType: Retailer
- Town: Boneer; City: ; Address: Boneer 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/07/2028 00:00:00); BirthDate: 07/08/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620116 — Almansoor V/S **

- Type: Customer; CustomerType: Retailer
- Town: Khaal; City: ; Address: Khaal
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/07/2028 00:00:00); BirthDate: 07/08/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620117 — Dr.Shakeel **

- Type: Customer; CustomerType: Retailer
- Town: Rahim Yar Khan; City: ; Address: Raheem Yar Khan
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/28/2028 00:00:00); BirthDate: 07/29/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620118 — Amjad Khan **

- Type: Customer; CustomerType: Retailer
- Town: Peshawer; City: ; Address: Peshawer
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/28/2028 00:00:00); BirthDate: 07/29/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620119 — Dr.Fida **

- Type: Customer; CustomerType: Retailer
- Town: Mianwali; City: ; Address: Mianwali
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 07/28/2028 00:00:00); BirthDate: 07/29/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620120 — Decent Poluntry **

- Type: Customer; CustomerType: Retailer
- Town: Rahim Yar Khan; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 08/12/2028 00:00:00); BirthDate: 08/13/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620121 — Jahzaib Sumandari**

- Type: Customer; CustomerType: Retailer
- Town: Dajkot; City: ; Address: Sumandri
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 08/16/2028 00:00:00); BirthDate: 08/17/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

**620122 — Islamabad Poultry**

- Type: Customer; CustomerType: Retailer
- Town: Quetta; City: ; Address: 
- Contact: ; Phone1: ; Phone2: ; Phone3: ; Fax: ; Mobile: 
- Email: ; WWW: ; NTN: ; STN: 
- CreditLimit: 0; CreditPeriod: 0 days
- License:  (valid: False, expiry 08/17/2028 00:00:00); BirthDate: 08/18/2026 00:00:00
- PriceCategory: TradePrice1; Active: True

## Project Registry (122 settings)

| RegistryKey | ParentRegistryKey | Narration | Value | IsEditable |
|---|---|---|---|---|
| AccAsset |  |  | 1 | False |
| AccBankAccount |  |  | 112 | False |
| AccCashAccount |  |  | 111 | False |
| AccCurrentAsset |  |  | 11 | False |
| AccCurrentEarnings |  |  | 49 | False |
| AccEquity |  |  | 3 | False |
| AccExpense |  |  | 5 | False |
| AccFiscalYear |  |  | 2026-27 | False |
| AccFixedAsset |  |  | 12 | False |
| AccIsEnablePosting |  |  | 0 | False |
| AccLiability |  |  | 2 | False |
| AccNewVoucherSerialNo |  |  | Yearly | False |
| AccOtherIncome |  |  | 48 | False |
| AccParty |  |  | 6 | False |
| ACCPURRETURNCOSTDIFF |  | Purchase Return Cost Difference | 515 | False |
| AccRevenue |  |  | 4 | False |
| BackupPath |  |  | e:\PCBackupHome | True |
| BlockExpLicCustomer |  | 0 | 0 | False |
| CompanyAddress |  |  | Plot No A-2, Phase 1-A, M-3 Industrial City, ChakJhumra, Faisalabad | False |
| CompanyCity |  |  | YourCity | False |
| CompanyDescription |  |  |  | False |
| CompanyEmail |  |  |  | False |
| CompanyFax |  |  |  | False |
| CompanyMobileNo |  |  |  | False |
| CompanyName |  |  | BOP NUTRACEUTICALS | False |
| CompanyNTN |  |  |  | False |
| CompanyPhone1 |  |  |  | False |
| CompanyPhone2 |  |  |  | False |
| CompanySTN |  |  |  | False |
| CompanyWeb |  |  |  | False |
| CustomerCreditDays |  |  | 0 | False |
| DBVersion |  |  | 1.050 | True |
| DistributionCode |  |  |  | False |
| Edition |  |  | Ent | False |
| EnableAutoSaveInvoice |  |  | 0 | False |
| EnableInvoiceTypeInSale |  |  | 1 | False |
| EnableIsClaimableInSale |  |  | 1 | False |
| EnableProductDetailinInvoicing |  |  | 0 | False |
| EnableSmartSearch |  | Enable Smart Search | 1 | False |
| EnableUserAccounsAssignment |  | User Accounts Assignments | 0 | False |
| ExpLicCustWarningDays |  | Expired License Customer Warning Days | 10 | False |
| FullPageVoucherPrinting |  |  | 0 | False |
| IsLocalPurchaseEnabled |  |  | 0 | False |
| LastLoginUser |  |  | Admin | False |
| NTNNo |  |  |  | False |
| OldDatabase4History |  | Old Database for History | PC23241 | False |
| PartyAccountLength |  | Party Account No Length | 4 | False |
| PhrAutoPrintInvoices |  |  | 0 | False |
| PhrAutoSaveTimeInterval |  |  | 5 | False |
| PhrBackupEnabled |  |  | 1 | False |
| PhrBackupFrequency |  |  | 180 | False |
| PhrCashCollectionDescAccount |  |  | 5123 | False |
| PhrCClaimRepliedStockValueAccount |  |  | 513 | False |
| PhrCClaimValueAccount |  |  | 1134 | False |
| PhrCompanyWarranter |  |  | ABDUL RAZZAK | False |
| PhrCostOfSaleAccount |  |  | 5111 | False |
| PhrCostOfSaleReturnAccount |  |  | 5112 | False |
| PhrCounterSaleInvType |  |  | C | False |
| PhrCustomersAccount |  |  | 62 | False |
| PhrDefaultCustomerId |  |  |  | False |
| PhrDefaultExpiryDate |  |  | 3000 | False |
| PhrDesktopRefreshTime |  |  | 60 | False |
| PhrDoNotPrintWarranty |  |  | 0 | False |
| PhrExpiredStockValueAccount |  |  | 1136 | False |
| PhrExpiryLossAccount |  |  | 514 | False |
| PhrExpiryWarningDays |  |  | 30 | False |
| PhrFTRatio |  |  | 3 | False |
| PhrInvoiceNote |  |  |  | False |
| PhrInvoicePrintingDriver |  |  | EPSON Generic 24Pin With Euro | False |
| PhrInvoiceRemarks |  |  |  | True |
| PhrIsCashInvoice |  |  | False | False |
| PhrIsLaserPrint |  |  | 1 | False |
| PhrIsNearExpiryStockBlocked |  |  | 1 | False |
| PhrIsPrintedPaperForInvoice |  |  | 0 | False |
| PhrIsPrintGrouped |  |  | 0 | False |
| PhrIsPrintInColor |  |  | 1 | False |
| PhrLastBackupDate |  |  | 4/11/2005 | False |
| PhrOpeningStockAccount |  |  | 1131 | False |
| PhrOpeningStockSTAccount |  |  | 1311 | False |
| PhrPrintHerbalWarranty |  |  | 0 | True |
| PhrPrintInvoiceCondenseMode |  |  | 0 | False |
| PhrPrintReportsBodyLines |  |  | 1 | False |
| PhrPurchaseAccount |  |  | 11321 | False |
| PhrPurchaseExpValueAccount |  |  | 551 | False |
| PhrPurchaseReturnAccount |  |  | 11322 | False |
| PhrPurchaseReturnSTAccount |  |  | 1313 | False |
| PhrPurchaseSTAccount |  |  | 1312 | False |
| PhrSaleAccount |  |  | 411 | False |
| PhrSaleReturnAccount |  |  | 412 | False |
| PhrSaleReturnSpecialDiscountAccount |  |  | 5122 | False |
| PhrSaleReturnSTAccount |  |  | 1315 | False |
| PhrSaleReturnStockValueAccount |  |  | 11332 | False |
| PhrSalesMenAccount |  |  | 63 | False |
| PhrSaleSpecialDiscountAccount |  |  | 5121 | False |
| PhrSaleSTAccount |  |  | 1314 | False |
| PhrSearchMinChar |  |  | 3 | False |
| PhrShowExpiryStatement |  |  | 1 | False |
| PhrShowRemarksInInvoice |  |  | 1 | False |
| PhrShowReportBodyLines |  |  | 0 | False |
| PhrShowSearchFormByEnter |  |  | 1 | False |
| PhrSoldStockValueAccount |  |  | 11331 | False |
| PhrSortProductsCompanyWise |  |  | 0 | False |
| PhrSTSaleInvType |  |  | T | False |
| PhrSupplySaleInvType |  |  | S | False |
| PhrVClaimRepliedStockValueAccount |  |  | 42 | False |
| PhrVClaimValueAccount |  |  | 1135 | False |
| PhrVendorsAccount |  |  | 61 | False |
| PhrVouchersAll |  |  |  | False |
| PrintAccordingToInvoice |  |  | 0 | False |
| PrintDosThermalInvoice |  |  | 0 | False |
| PrintingCharges |  |  | 0 | False |
| PrintInvoiceDetail |  |  | 0 | False |
| PrintSurgicalInvoice |  |  | 0 | False |
| PrintThermalSaleInvoice |  |  | 0 | False |
| PromptForWarranty |  |  | 1 | False |
| PurchaseOrderAler |  | Purchase Order Aler |  | False |
| ReportZoom |  |  | 120 | False |
| ShowPrevBalInInvoicePrint |  |  | 1 | False |
| ShowPriceTagInInvoicePrint |  | Show Price Tag In Invoice Printing | 0 | False |
| STNNo |  |  |  | False |
| USBBackUpPath |  | Null | K:\UltraBizDataBackup | False |
| ViewPrintingOptionsInSale |  |  | 1 | False |

## Project Tasks (258 features)

| TaskKey | TaskName | TaskGroup | IsAutoPost | IsPosting | Edition | ApplicationMode |
|---|---|---|---|---|---|---|
| AccountsBalances | Accounts Balances | Accounts Reports | True | False | Pro | 0 |
| AccountsLedger | Account Ledger | Accounts Reports | True | False | Lit | 0 |
| AccountsOpeningBalances | Opening Balances for Accounts | Defination | True | False | Lit | 0 |
| AccountsPayable | Accounts Payable | Accounts Reports | True | False | Lit | 0 |
| AccountsReceivables | Accounts Receiveable | Accounts Reports | True | False | Lit | 0 |
| AddressBook | Address Book | Listings | True | False | Lit | 0 |
| AdjustPurchaseRates | Adjust Purchase Rates | Invoicing | True | False | Pro | 0 |
| AllowBackDataEntry | Allow Back Date Entry to Users | Invoicing | True | False | Pro | 0 |
| AllowBonusInPurchase | Enter Bonus Qty In Purchase | Invoicing | True | False | Pro | 0 |
| AllowBonusInSale | Enter Bonus Qty In Sale | Invoicing | True | False | Pro | 0 |
| AllowChangeDiscInPurchase | Change Discount In Purchase | Invoicing | True | False | Pro | 0 |
| AllowChangeDiscInSale | Change Discount In Sale | Invoicing | True | False | Pro | 0 |
| AllowChangePriceInPurchase | Change Price In Purchase | Invoicing | True | False | Pro | 0 |
| AllowChangePriceInSale | Change Price In Sale | Invoicing | True | False | Pro | 0 |
| AllowDigitalSignatureonPrint | Allow Digital Signature on Print | Invoicing | True | False | Lit | 0 |
| AllowEditVouchers | Allow Vouchers Update to Users | Transaction | True | False | Pro | 0 |
| AllowUnderPurchaseSale | Allow Under Purchase Sale | Invoicing | True | False | Pro | 0 |
| AmsonData | Generate Amson Data | AddOn | True | False | Pro | 0 |
| ASM | ASM Form | Defination | True | False | Pro | 0 |
| AsmSaleStatement | ASM SaleStatement(Spo Wise) | AddOn | True | False | Ent | 0 |
| AssignAccountsToUser | Assign Accounts To User | System | True | False | Ent | 0 |
| AssignCustomersToCompanyTowns | AssignCustomers To Company Towns | Defination | True | False | Pro | 0 |
| AssignCustomersToSPOs | Assign Customers To SPOs | Defination | True | False | Pro | 0 |
| AssignProductsToSPOs | Assign Products To SPOs | Defination | True | False | Pro | 0 |
| AutoFillingFormulation | Auto Filling Filling/Packing | Manufacturing | True | False | Pro | 0 |
| AutoFormulation | Auto Formulation | Manufacturing | True | False | Ent | 0 |
| AutoPurchaseOrder | Auto Purchase Order | Stock Reports | True | False | Lit | 0 |
| BackupDB | Backup | System | True | False | Lit | 0 |
| BalanceSheet | Balance Sheet | Accounts Reports | True | False | Lit | 0 |
| BalanceSheetSettings | Balance Sheet Settings | Transaction | True | False | Pro | 0 |
| BanksPosition | Banks Position | Accounts Reports | True | False | Pro | 0 |
| BankStatement | Bank Statement | Accounts Reports | True | False | Pro | 0 |
| BatchSearching | Batch Searching | Other Reports | True | False | Lit | 0 |
| BonusClaimReport | Discount Claim Report | AddOn | True | False | Pro | 0 |
| BoschData | Generate Bosch Data | AddOn | True | False | Pro | 0 |
| BouncedCheques | Bounced Cheques | Accounts Reports | True | False | Pro | 0 |
| BusinessSummary | Daily Business Activity | Daily Activity Reports | True | False | Lit | 0 |
| Cashbook | Cash Book | Accounts Reports | True | False | Lit | 0 |
| CashDeposit | Cash Deposit In Bank | Transaction | True | False | Pro | 0 |
| CashPaymentChart | Cash Payment Chart | Accounts Reports | True | False | Pro | 0 |
| CashPaymentVoucher | Cash Payment Voucher | Transaction | True | False | Pro | 0 |
| CashReceivingVoucher | Cash Receiving Voucher | Transaction | True | False | Pro | 0 |
| ChangeDateInCreditVoucher | Change Date in Credit Voucher | Transaction | True | False | Lit | 0 |
| ChangeDateInDebitVoucher | Change Date in Debit Voucher | Transaction | True | False | Lit | 0 |
| ChangeDateInJournalVoucher | Change Date in Journal Voucher | Transaction | True | False | Lit | 0 |
| ChangeExpiryDamagesClaimsFromCustomer | Change Expiry/Damages Claims From Customer | Invoicing | True | False | Pro | 0 |
| ChangeExpiryDamagesClaimsToVendor | Change Expiry/Damages Claims To Vendor | Invoicing | True | False | Pro | 0 |
| ChangeExpiryDates | Change Expiry Dates | Invoicing | True | False | Lit | 0 |
| ChangePurchaseInvoice | Change Purchase Invoice | Invoicing | True | False | Lit | 0 |
| ChangePurchaseOrder | Change Purchase Order | Invoicing | True | False | Lit | 0 |
| ChangePurchaseReturnWithInvoice | Change Purchase Return With Invoice | Invoicing | True | False | Lit | 0 |
| ChangePurchaseReturnWithOutInvoice | Change Purchase Return WithOut Invoice | Invoicing | True | False | Pro | 0 |
| ChangeRecoveryCompanyWise | Change Recovery Company Wise | Transaction | True | False | Ent | 0 |
| ChangeRecoveryCustomerWise | Change Recovery Customer Wise | Transaction | True | False | Ent | 0 |
| ChangeRecoveryInvoiceWise | Change Recovery Invoice Wise | Transaction | True | False | Lit | 0 |
| ChangeRecoveryInvoiceWiseAuto | Change Recovery Customer Wise Auto | Transaction | True | False | Ent | 0 |
| ChangeRecoveryReceipt | Change Recovery Receipt | Transaction | True | False | Pro | 0 |
| ChangeRecoveryReceivableWise | Change Recovery Receivable Wise | Transaction | True | False | Lit | 0 |
| ChangeSaleInvoice | Change Sale Invoice | Invoicing | True | False | Lit | 0 |
| ChangeSaleReturnWithInvoice | Change Sale Return With Invoice | Invoicing | True | False | Pro | 0 |
| ChangeSaleReturnWithOutInvoice | Change Sale Return With Out Invoice | Invoicing | True | False | Pro | 0 |
| ChangeSalesOrder | Change Sales Order | Invoicing | True | False | Pro | 0 |
| ChangeSeasonCompany | Change Season/Company | System | True | False | Ent | 0 |
| ChangeStockExpiryInvoice | Change Stock Expiry Invoice | Invoicing | True | False | Lit | 0 |
| ChartofAccounts | Accounts Management | Defination | True | False | Lit | 0 |
| ChartofAccountsReports | Chart of Accounts | Accounts Reports | True | False | Lit | 0 |
| ChequeDeposit | Cheque Deposit In Bank | Transaction | True | False | Pro | 0 |
| ChequesIssuing | Bank Cheque issuing | Transaction | True | False | Pro | 0 |
| ChequesReconcilation | Bank Cheques Reconciliation | Transaction | True | False | Pro | 0 |
| Companies | Companies | Defination | True | False | Lit | 0 |
| CompaniesList | Companies List | Listings | True | False | Lit | 0 |
| CompanySector | Company Sector | Defination | True | False | Pro | 0 |
| CompanySectorWiseSale | Company Sector Wise Sale | Sale Reports | True | False | Pro | 0 |
| CompanyTowns | Company Towns | Defination | True | False | Pro | 0 |
| CompanyTownWiseSale | Company Town Wise Sale | Sale Reports | True | False | Lit | 0 |
| CompanyWisePurchase | Company Wise Purchase | Purchase Reports | True | False | Pro | 0 |
| CompanyWiseSale | Company Wise Sale | Sale Reports | True | False | Lit | 0 |
| comwisprofit | Company Wise Profits | Profit Reports | True | False | Pro | 0 |
| Configuration | System Configuration | System | True | False | Lit | 0 |
| CreateUser | Create New User | System | True | False | Lit | 0 |
| CreditVoucher | Cash Receiving Voucher | Transaction | True | False | Lit | 0 |
| crruntstockcost | Current Stock (Cost wise) | Stock Reports | True | False | Lit | 0 |
| CurrentStockCompanyWise | Current Stock Company Wise | Stock Reports | True | False | Ent | 0 |
| CurrentStockDateWise | Current Stock Date Wise | Stock Reports | True | False | Ent | 0 |
| CurrentStockWithoutValue | CurrentStock (Without Value) | Stock Reports | True | False | Ent | 0 |
| currenttp | Current Stock (TP wise) | Stock Reports | True | False | Pro | 0 |
| Customer | Customers | Defination | True | False | Lit | 0 |
| CustomerBalancesChart | Customer Balances Chart | Analysis Reports | True | False | Ent | 0 |
| CustomerClaim | Expiry Claim From Customer | Invoicing | True | False | Pro | 0 |
| CustomerProductWiseSale | Customer Product Wise Sale Chart | Sale Reports | True | False | Ent | 0 |
| CustomerReceivables | Customer Receivables | Daily Activity Reports | True | False | Pro | 0 |
| CustomerReceivablesCompanyWise | Customer Receivables (Company Wise) | Recovery Reports | True | False | Ent | 0 |
| CustomerReceivablesInv | Customer Receivables (Inv. wise) | Daily Activity Reports | True | False | Lit | 0 |
| CustomerReceivablesSalesmanWise | Customer Receivables (Salesman Wise) | Recovery Reports | True | False | Ent | 0 |
| CustomerReply | Claim Reply To Customer | Invoicing | True | False | Pro | 0 |
| CustomersList | Customers List | Listings | True | False | Lit | 0 |
| CustomerTownSectorWiseSale | Customer/Town/Sector Wise Sale | Sale Reports | True | False | Lit | 0 |
| cuswiseprofit | Customer Wise Profits | Profit Reports | True | False | Pro | 0 |
| DailyProfits | Daily Profits | Profit Reports | True | False | Lit | 0 |
| DayBook | Day Book | Accounts Reports | True | False | Pro | 0 |
| DeadPartiesList | Dead Parties List | Listings | True | False | Pro | 0 |
| DebitVoucher | Cash Payment Voucher | Transaction | True | False | Lit | 0 |
| DeliveryChallan | Delivery Challan | Invoicing | True | False | Ent | 0 |
| DeliveryNoteAccumulative | Delivery Note (Accumulative) | Daily Activity Reports | True | False | Pro | 0 |
| DepositReconcilation | Deposit Reconciliation | Transaction | True | False | Pro | 0 |
| DiscountClaimInvoiceWise | Discount Claim Invoice Wise | Sale Reports | True | False | Pro | 0 |
| DiscountClaimReport | Discount Claim Report | AddOn | True | False | Pro | 0 |
| DiscountClaimSummary | Discount Claim Summary | Sale Reports | True | False | Ent | 0 |
| DueDateRecoveryPromises | Due Date Sale Recovery Promises | Recovery Reports | True | False | Pro | 0 |
| DummySalesInvoice | Dummy Sales Invoice | Invoicing | True | False | Lit | 0 |
| EnableDateSaleInvoice | Enable Date Sale Invoice | Invoicing | True | False | Pro | 0 |
| EnableSaleIDInSale | Enable SaleID In Sale Invoice | Invoicing | True | False | Pro | 0 |
| ExpenseReportSetting | Expense Report Setting | Transaction | True | False | Pro | 0 |
| ExpiryInvoice | Expiry / Damages Invoice | Invoicing | True | False | Lit | 0 |
| FrequentTasks | Frequent Tasks | System | True | False | Pro | 0 |
| GenixData | Generate Genix Data | AddOn | True | False | Pro | 0 |
| GetzData | Generate Getz Data | AddOn | True | False | Pro | 0 |
| GLJournal | G/L Journal | Accounts Reports | True | False | Lit | 0 |
| HotColdCustomers | Ho & Cold Customers | Daily Activity Reports | True | False | Pro | 0 |
| HotColdProducts | Ho & Cold Products | Daily Activity Reports | True | False | Pro | 0 |
| IMSData | Generate IMS Data | AddOn | True | False | Pro | 0 |
| InvoiceDetailedProfits | Invoice Detailed Profits | Profit Reports | True | False | Pro | 0 |
| InvoiceWiseProfits | Invoice Wise Profits | Profit Reports | True | False | Pro | 0 |
| JournalVouchers | Journal Voucher | Transaction | True | False | Lit | 0 |
| LicensedCustomersList | Licensed Customer List | Listings | True | False | Ent | 0 |
| LocalPurchaseInvoice | Local Purchae Invoice | Invoicing | True | False | Pro | 0 |
| LostCheques | Lost Cheques | Accounts Reports | True | False | Pro | 0 |
| MacterData | Generate Macter Data | AddOn | True | False | Pro | 0 |
| MeijiData | Generate Meiji Data | AddOn | True | False | Pro | 0 |
| MerckData | Generate Merck Data | AddOn | True | False | Pro | 0 |
| MonthlyExpenseChart | Monthly Expense Chart | Accounts Reports | True | False | Pro | 0 |
| MonthlySaleChartCustomerWise | Monthly Sale Chart Customer Wise | Sale Reports | True | False | Ent | 0 |
| MonthlySaleChartProductWise | Monthly Sale Chart Product Wise | Sale Reports | True | False | Ent | 0 |
| MonthlySaleTable | Monthly Sale Table | Sale Reports | True | False | Pro | 0 |
| OpBalReport | Opening Balances | Accounts Reports | True | False | Lit | 0 |
| OpeningStock | Opening Stock | Defination | True | False | Lit | 0 |
| OpeningStockReport | Opening Stock | Stock Reports | True | False | Lit | 0 |
| OverStock | Over Stock Report | Stock Reports | True | False | Ent | 0 |
| Paidreportpartywise | Sales Reports | Sale Reports | True | False | Pro | 0 |
| PartyDetailLedger | Party Detail Ledger | Accounts Reports | True | False | Ent | 0 |
| PartyPurchaseLedger | Party Purchase Ledger | Purchase Reports | True | False | Pro | 0 |
| PartySaleReturnLedger | Party Sale Return Ledger | Sales Return Reports | True | False | Pro | 0 |
| PartyWiseProductPurchases | Party Wise Product Purchases | Purchase Reports | True | False | Pro | 0 |
| PendingPurchaseOrder | Pending Purchase Order | Purchase Reports | True | False | Pro | 0 |
| PostAvailabilityInvoices | Post Availability Invoices | Invoicing | True | False | Ent | 0 |
| PostSalesOrder | Post Sales Order | Invoicing | True | False | Pro | 0 |
| PriceList | Price List | Listings | True | False | Lit | 0 |
| PrintInvoicesInBatch | Print Invoices in Batch | Daily Activity Reports | True | False | Lit | 0 |
| ProcessCurrentStock | Process Current Stock | Manufacturing | True | False | Ent | 0 |
| ProcessIssueRegister | Process Issue Register | Manufacturing | True | False | Ent | 0 |
| Product | Products | Defination | True | False | Lit | 0 |
| ProductDivisions | Product Divisions | Defination | True | False | Pro | 0 |
| ProductFilling | Product Filling/Packing | Manufacturing | True | False | Pro | 0 |
| ProductGroups | Product Groups | Defination | True | False | Lit | 0 |
| Production | Production | Manufacturing | True | False | Ent | 0 |
| ProductionAssessmentSummary | Production Assessment Summary | Daily Activity Reports | True | False | Pro | 0 |
| ProductionRegister | Production Register | Manufacturing | True | False | Ent | 0 |
| ProductionSummary | Production Summary | Manufacturing | True | False | Ent | 0 |
| ProductLedger | Product Ledger | Daily Activity Reports | True | False | Ent | 0 |
| ProductSaleLedgerBatchWise | Product Sales Ledger (Batch Wise) | Sale Reports | True | False | Ent | 0 |
| Productsaleledgerpartywise | Sales Reports | Sale Reports | True | False | Pro | 0 |
| ProductSaleReturnLedger | Product Sale Return Ledger | Sales Return Reports | True | False | Pro | 0 |
| ProductSalesLedger | Product Sales Ledger Report | Sale Reports | True | False | Pro | 0 |
| ProductTownWiseSale | Product Town Wise Sale | Sale Reports | True | False | Ent | 0 |
| ProductWiseDailySaleChart | Product Wise Daily Sale Chart | Analysis Reports | True | False | Ent | 0 |
| ProductWiseProfits | Product Wise Profits | Profit Reports | True | False | Pro | 0 |
| ProductwiseSales | Product Wise Sale | Sale Reports | True | False | Lit | 0 |
| ProductWiseSalesSummary | Product Wise Sales Summary | Sale Reports | True | False | Ent | 0 |
| ProfitAndLossSettings | Profit and Loss Settings | Transaction | True | False | Lit | 0 |
| ProfitLossStatement | Profit and Loss Statement | Accounts Reports | True | False | Lit | 0 |
| propurledger | Product Purchase Ledger | Purchase Reports | True | False | Pro | 0 |
| prowisepurchases | Product Wise Purchases | Purchase Reports | True | False | Lit | 0 |
| purchasedetail | Purchase Detailed | Purchase Reports | True | False | Lit | 0 |
| PurchaseOrder | Purchase Order | Invoicing | True | False | Lit | 0 |
| PurchaseWithoutOrder | Allow User To Make Purchase Without Order | Invoicing | True | False | Pro | 0 |
| PurInvoice | Purchase Invoice | Invoicing | True | False | Lit | 0 |
| PurRetLedger | Purchase Return Ledger | Sales Return Reports | True | False | Pro | 0 |
| Purretsummery | Purchase Return Summary | Sales Return Reports | True | False | Lit | 0 |
| pursummery | Purchase Summary | Purchase Reports | True | False | Lit | 0 |
| PurWInvoice | Purchase Return (With Invoice) | Invoicing | True | False | Lit | 0 |
| PurWOInvoice | Purchase Return (Without Invoice) | Invoicing | True | False | Pro | 0 |
| RecoveryAnalysis | Recovery Analysis | Analysis Reports | True | False | Ent | 0 |
| RecoveryAutoInvoicewise | Recovery Auto (Invoice wise) | Transaction | True | False | Pro | 0 |
| RecoveryCombined | Sale Recovery Combined | Transaction | True | False | Pro | 0 |
| RecoveryCompanyWise | Recovery Report(Company Wise) | Recovery Reports | True | False | Pro | 0 |
| RecoveryCustomerwise | Recovery (Customer Wise) | Transaction | True | False | Lit | 0 |
| RecoveryInvoicewise | Recovery (Invoice Wise) | Transaction | True | False | Lit | 0 |
| RecoveryReceipt | Recovery Receipt | Transaction | True | False | Pro | 0 |
| RecoveryReceivableWise | Recovery (ReceivableWise) | Transaction | True | False | Pro | 0 |
| RecoveryReport | Recovery Report | Daily Activity Reports | True | False | Lit | 0 |
| ReIndexingDatabase | Re-Indexing Database | System | True | False | Pro | 0 |
| ReturnNote | Sale Return Note | Sales Return Reports | True | False | Pro | 0 |
| SaleAndStockStatementJS | Sale And Stock Statement For JS Ent | AddOn | True | False | Pro | 0 |
| SaleInvoiceAutoBatch | Sale Invoice (Auto Batch) | Invoicing | True | False | Lit | 0 |
| SaleInvoiceManualBatch | Sales Invoice (Manual Batch) | Invoicing | True | False | Lit | 0 |
| SaleInvoicePending | Make Sale Invoice Pending | Invoicing | True | False | Pro | 0 |
| Saleman | Salesmen | Defination | True | False | Lit | 0 |
| SaleRegisterAccumulative | Sale Register Accumulative | Analysis Reports | True | False | Ent | 0 |
| SaleReturnRegister | Sales Return Register | Sales Return Reports | True | False | Lit | 0 |
| SaleReturnSummary | Sales Return Summary | Sales Return Reports | True | False | Lit | 0 |
| SaleReturnsWI | Sales Return (With Invoice) | Invoicing | True | False | Lit | 0 |
| SaleReturnsWoI | Sales Return (Without Invoice) | Invoicing | True | False | Pro | 0 |
| SalesandStockStatement | Sales and Stock Statement | Sale Reports | True | False | Lit | 0 |
| SalesandStockStatementSami | Sales and Stock Statement Sami | AddOn | True | False | Pro | 0 |
| SalesandStockStatementTP | Sales and Stock Statement TP Wise | Sale Reports | True | False | Pro | 0 |
| salesdetail | Sale Detailed | Sale Reports | True | False | Lit | 0 |
| SalesmanBonusProductDetailed | Salesman Bonus Product Detailed | Salesman Reports | True | False | Pro | 0 |
| SalesmanCommission | Salesman Commission Report | Salesman Reports | True | False | Pro | 0 |
| SalesmanMonthlyPerformance | Salesman Monthly Performance Report | Salesman Reports | True | False | Pro | 0 |
| SalesmanSaleProductWise | Salesman Sale Product Wise | Salesman Reports | True | False | Pro | 0 |
| SalesmanSummary | Salesman Summary Report | Salesman Reports | True | False | Lit | 0 |
| SalesmanwiseSales | Salesmanwise Sales Report | Salesman Reports | True | False | Pro | 0 |
| SalesmenParties | Salesmen Parties | Listings | True | False | Pro | 0 |
| SalesOrder | Sales Order | Invoicing | True | False | Pro | 0 |
| salesummery | Sales Summary | Sale Reports | True | False | Lit | 0 |
| SamiData | Generate Sami Data | AddOn | True | False | Pro | 0 |
| Sector | Sectors | Defination | True | False | Lit | 0 |
| SectorsList | Sectors List | Listings | True | False | Lit | 0 |
| SendPurOrder | Send Purchase Order | Invoicing | True | False | Ent | 0 |
| SetPrices | SetProduct Prices | Defination | True | False | Lit | 0 |
| ShortStockPosting | Post Sale Invoice (Short Stock) | Invoicing | True | False | Pro | 0 |
| ShortStockSale | Sale Invoice (Short Stock) | Invoicing | True | False | Pro | 0 |
| ShortStockSummary | Short Stock Summary | Daily Activity Reports | True | False | Pro | 0 |
| ShowCost | Show cost to User | Invoicing | True | False | Pro | 0 |
| SMSalessummary | Salesman Sales Summary | Sale Reports | True | False | Lit | 0 |
| SPOProductsIncentive | SPO Products Incentive | Defination | True | False | Ent | 0 |
| SPOProductWiseIncentiveReport | SPO Product Wise Incentive Report | AddOn | True | False | Ent | 0 |
| SPOs | SPOs | Defination | True | False | Pro | 0 |
| SPOTargets | SPO Targets | Defination | True | False | Pro | 0 |
| SpoTownList | SpoTownList | Listings | True | False | Ent | 0 |
| SpoTownSaleSharing | Spo Town Wise Sale Sharing | Defination | True | False | Pro | 0 |
| SpoTownWiseReport | Spo Town Wise Statement | AddOn | True | False | Pro | 0 |
| StockCountSheet | Stock Count Sheet | Stock Reports | True | False | Lit | 0 |
| StockDeliveryNote | Stock Delivery Note | Daily Activity Reports | True | False | Pro | 0 |
| StockExpiryRegister | Stock Expiry Register | Stock Reports | True | False | Pro | 0 |
| StockGoingToExp | Stock Going To Exp | Stock Reports | True | False | Lit | 0 |
| StockGoingToShort | Stock Going To Shortt | Stock Reports | True | False | Pro | 0 |
| StockIssueRegister | Stock Issue Register | Stock Reports | True | False | Ent | 0 |
| StockIssueToProcess | Stock Issue To Process | Manufacturing | True | False | Ent | 0 |
| StockIssueToStore | Stock Issue To Store | Invoicing | True | False | Ent | 0 |
| StockReceiveFromStore | Stock Receive From Store | Invoicing | True | False | Ent | 0 |
| StockReceiveRegister | Stock Receive Register | Stock Reports | True | False | Ent | 0 |
| StoreCurrentStock | Store Current Stock | Stock Reports | True | False | Ent | 0 |
| Stores | Stores | Defination | True | False | Ent | 0 |
| TaskAssignment | Task Assignment to User | System | True | False | Lit | 0 |
| TownList | Town List | Listings | True | False | Pro | 0 |
| Towns | Towns | Defination | True | False | Lit | 0 |
| TownsList | Towns List | Listings | True | False | Lit | 0 |
| TrialBalance | Trial Balance | Accounts Reports | True | False | Pro | 0 |
| TrialBalSummary | Trial Balance Summary | Accounts Reports | True | False | Lit | 0 |
| UnclearedCheques | Uncleared Cheques | Accounts Reports | True | False | Pro | 0 |
| USBBackUp | Back Up On USB Drive | System | True | False | Pro | 0 |
| Vendor | Vendors | Defination | True | False | Lit | 0 |
| VendorClaim | Expiry Claim To Vendor | Invoicing | True | False | Pro | 0 |
| VendorReply | Claim Reply From Vendor | Invoicing | True | False | Pro | 0 |
| WithholdingTaxDetails | With Holding Tax Details | Purchase Reports | True | False | Ent | 0 |
| WithholdingTaxSummary | With Holding Tax Summary | Purchase Reports | True | False | Ent | 0 |
| YearlyComparisonReports | Yearly Comparison Reports | Analysis Reports | True | False | Pro | 0 |

