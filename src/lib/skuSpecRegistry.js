// ═══════════════════════════════════════════════════════════════════════════
// src/lib/skuSpecRegistry.js — SKU Master field registry (Canonical Amendment 02).
//
// GENERATED from the SPEC sheet of APSPL NAGPUR Master_20260720.xlsx (row 3
// headers, sheet order and TechSpec v4 groups). Do not reorder by hand: sheet
// order and grouping are part of CDM-43.
//
// SKU_SPEC_GROUPS  the 39 fields SKU Master stores (quotation- and
//                  costing-relevant), in sheet groups and sheet order.
// PRODUCTION_BACKLOG  the 94 remaining SPEC columns: listed only, not
//                  implemented and never required. Partition (CP–DF) and Plate
//                  (DG–DU) columns are retired and appear in neither list.
// ═══════════════════════════════════════════════════════════════════════════

export const PRINT_TECHNOLOGIES = ["Flexo", "CMYK", "Offset", "Unprinted"];

export const SKU_SPEC_GROUPS = [
  {
    "id": "identity",
    "label": "Identity & Linking",
    "short": "Identity",
    "source": "identity",
    "sheetRange": "A–H",
    "fields": [
      {
        "key": "A",
        "sheet": "A",
        "order": 1,
        "label": "Primary Customer Alias",
        "width": 110,
        "origin": "sheet",
        "authority": null,
        "use": "Resolves the Customer and the SKU's Location applicability"
      },
      {
        "key": "B",
        "sheet": "B",
        "order": 2,
        "label": "Item Name",
        "width": 190,
        "origin": "sheet",
        "authority": null,
        "use": "Item name on the SKU version"
      },
      {
        "key": "C",
        "sheet": "C",
        "order": 3,
        "label": "Item Short Name",
        "width": 170,
        "origin": "sheet",
        "authority": null,
        "use": "Item short name on the SKU version"
      },
      {
        "key": "D",
        "sheet": "D",
        "order": 4,
        "label": "APSPL Item Code",
        "width": 104,
        "origin": "sheet",
        "authority": null,
        "use": "Plant Item Code (permanent, CDM-09)"
      },
      {
        "key": "E",
        "sheet": "E",
        "order": 5,
        "label": "Primary Customer",
        "width": 170,
        "origin": "sheet",
        "authority": null,
        "use": "Customer (Party)"
      },
      {
        "key": "F",
        "sheet": "F",
        "order": 6,
        "label": "Customer Item Code",
        "width": 120,
        "origin": "sheet",
        "authority": null,
        "use": "Customer Item Code reference"
      },
      {
        "key": "G",
        "sheet": "G",
        "order": 7,
        "label": "Item Family",
        "width": 80,
        "origin": "sheet",
        "authority": null,
        "use": "Box type input"
      },
      {
        "key": "H",
        "sheet": "H",
        "order": 8,
        "label": "Item Group",
        "width": 90,
        "origin": "sheet",
        "authority": null,
        "use": "Box type detail (joint style)"
      }
    ]
  },
  {
    "id": "std_carton",
    "label": "STD Carton Specification",
    "short": "STD Carton",
    "source": "customer",
    "sheetRange": "I–AA",
    "fields": [
      {
        "key": "I",
        "sheet": "I",
        "order": 9,
        "label": "STD Ply#",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction version · ply"
      },
      {
        "key": "J",
        "sheet": "J",
        "order": 10,
        "label": "STD Flute Type",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction version · flute type"
      },
      {
        "key": "K",
        "sheet": "K",
        "order": 11,
        "label": "STD Flute 1",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction version · flute 1"
      },
      {
        "key": "L",
        "sheet": "L",
        "order": 12,
        "label": "STD Flute 2",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction version · flute 2"
      },
      {
        "key": "N",
        "sheet": "N",
        "order": 14,
        "label": "STD Graphics / Print Quality",
        "width": 130,
        "origin": "sheet",
        "authority": null,
        "use": "Print quality statement (CDM-10)"
      },
      {
        "key": "PT",
        "sheet": null,
        "order": 14.1,
        "label": "STD Print Technology",
        "width": 100,
        "origin": "new",
        "authority": null,
        "use": "Flexo / CMYK / Offset / Unprinted (CDM-10)"
      },
      {
        "key": "NC",
        "sheet": null,
        "order": 14.2,
        "label": "STD Number of Colours",
        "width": 86,
        "origin": "new",
        "authority": null,
        "use": "Whole number, zero or more (CDM-10)"
      },
      {
        "key": "O",
        "sheet": "O",
        "order": 15,
        "label": "STD Printing Colour",
        "width": 150,
        "origin": "sheet",
        "authority": null,
        "use": "Descriptive colour detail (CDM-10)"
      },
      {
        "key": "AA",
        "sheet": "AA",
        "order": 27,
        "label": "STD Cobb Value",
        "width": 90,
        "origin": "sheet",
        "authority": null,
        "use": "Cobb value → coating cost (CDM-43)"
      }
    ]
  },
  {
    "id": "std_dims",
    "label": "STD Internal Dimensions",
    "short": "STD Dims",
    "source": "customer",
    "sheetRange": "AE–AH",
    "fields": [
      {
        "key": "AE",
        "sheet": "AE",
        "order": 31,
        "label": "STD ID Length (mm)",
        "width": 76,
        "origin": "sheet",
        "authority": null,
        "use": "Costing L"
      },
      {
        "key": "AF",
        "sheet": "AF",
        "order": 32,
        "label": "STD ID Width (mm)",
        "width": 76,
        "origin": "sheet",
        "authority": null,
        "use": "Costing W"
      },
      {
        "key": "AG",
        "sheet": "AG",
        "order": 33,
        "label": "STD ID Height (mm)",
        "width": 76,
        "origin": "sheet",
        "authority": null,
        "use": "Costing H"
      }
    ]
  },
  {
    "id": "std_board",
    "label": "STD Board & Paper Composition",
    "short": "STD Board",
    "source": "customer",
    "sheetRange": "AI–AX",
    "fields": [
      {
        "key": "AI",
        "sheet": "AI",
        "order": 35,
        "label": "STD Top BF",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer BF"
      },
      {
        "key": "AJ",
        "sheet": "AJ",
        "order": 36,
        "label": "STD Top GSM",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer GSM"
      },
      {
        "key": "AK",
        "sheet": "AK",
        "order": 37,
        "label": "STD Flute-1 BF",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer BF"
      },
      {
        "key": "AL",
        "sheet": "AL",
        "order": 38,
        "label": "STD Flute-1 GSM",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer GSM"
      },
      {
        "key": "AM",
        "sheet": "AM",
        "order": 39,
        "label": "STD Back-1 BF",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer BF"
      },
      {
        "key": "AN",
        "sheet": "AN",
        "order": 40,
        "label": "STD Back-1 GSM",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer GSM"
      },
      {
        "key": "AO",
        "sheet": "AO",
        "order": 41,
        "label": "STD Flute-2 BF",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer BF"
      },
      {
        "key": "AP",
        "sheet": "AP",
        "order": 42,
        "label": "STD Flute-2 GSM",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer GSM"
      },
      {
        "key": "AQ",
        "sheet": "AQ",
        "order": 43,
        "label": "STD Back-2 BF",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer BF"
      },
      {
        "key": "AR",
        "sheet": "AR",
        "order": 44,
        "label": "STD Back-2 GSM",
        "width": 76,
        "origin": "sheet",
        "authority": "construction",
        "use": "Construction layer GSM"
      },
      {
        "key": "AS",
        "sheet": "AS",
        "order": 45,
        "label": "STD Item GSM",
        "width": 120,
        "origin": "sheet",
        "authority": null,
        "use": "Stated item GSM"
      },
      {
        "key": "AT",
        "sheet": "AT",
        "order": 46,
        "label": "STD Item Weight",
        "width": 76,
        "origin": "sheet",
        "authority": null,
        "use": "Required box weight"
      },
      {
        "key": "AU",
        "sheet": "AU",
        "order": 47,
        "label": "STD Item CS",
        "width": 150,
        "origin": "sheet",
        "authority": null,
        "use": "Stated CS (BCT)"
      },
      {
        "key": "AV",
        "sheet": "AV",
        "order": 48,
        "label": "STD Item BS",
        "width": 130,
        "origin": "sheet",
        "authority": null,
        "use": "Stated BS"
      },
      {
        "key": "AW",
        "sheet": "AW",
        "order": 49,
        "label": "STD Item ECT",
        "width": 90,
        "origin": "sheet",
        "authority": null,
        "use": "Stated ECT"
      }
    ]
  },
  {
    "id": "conversion",
    "label": "Conversion · Deckle · Sheet Sizing",
    "short": "Conversion",
    "source": "production",
    "sheetRange": "AY–BO",
    "fields": [
      {
        "key": "BH",
        "sheet": "BH",
        "order": 60,
        "label": "B/L Ups",
        "width": 76,
        "origin": "sheet",
        "authority": null,
        "use": "Ups — pieces across the deckle"
      }
    ]
  },
  {
    "id": "status",
    "label": "Status & Governance",
    "short": "Status",
    "source": "governance",
    "sheetRange": "DV–EB",
    "fields": [
      {
        "key": "LC",
        "sheet": null,
        "order": 125.9,
        "label": "Lifecycle",
        "width": 90,
        "origin": "app",
        "authority": null,
        "use": "Proposed → Active → Discontinued (CDM-11)"
      },
      {
        "key": "DX",
        "sheet": "DX",
        "order": 128,
        "label": "CUSTOMER SPECIFICATION NUMBER AND VERSION",
        "width": 150,
        "origin": "sheet",
        "authority": null,
        "use": "Customer specification number and version"
      },
      {
        "key": "DZ",
        "sheet": "DZ",
        "order": 130,
        "label": "SoftComp Code",
        "width": 90,
        "origin": "sheet",
        "authority": null,
        "use": "SoftComp code reference"
      }
    ]
  }
];

export const PRODUCTION_BACKLOG = [
  {
    "id": "std_carton",
    "label": "STD Carton Specification",
    "short": "STD Carton",
    "source": "customer",
    "sheetRange": "I–AA",
    "columns": [
      {
        "sheet": "M",
        "order": 13,
        "label": "STD Adhesive",
        "note": null
      },
      {
        "sheet": "P",
        "order": 16,
        "label": "STD Mfg Joint Position",
        "note": null
      },
      {
        "sheet": "Q",
        "order": 17,
        "label": "STD Mfg Joint Width (mm)",
        "note": null
      },
      {
        "sheet": "R",
        "order": 18,
        "label": "STD Mfg Joint Type",
        "note": null
      },
      {
        "sheet": "S",
        "order": 19,
        "label": "STD No of Stitches",
        "note": null
      },
      {
        "sheet": "T",
        "order": 20,
        "label": "STD Gap between the closing flap",
        "note": null
      },
      {
        "sheet": "U",
        "order": 21,
        "label": "STD No of Flutes/30 cm",
        "note": null
      },
      {
        "sheet": "V",
        "order": 22,
        "label": "STD Board Thickness",
        "note": null
      },
      {
        "sheet": "W",
        "order": 23,
        "label": "STD Moisture Requirement",
        "note": null
      },
      {
        "sheet": "X",
        "order": 24,
        "label": "STD Slitting Requirement",
        "note": null
      },
      {
        "sheet": "Y",
        "order": 25,
        "label": "STD Cracking Requirement",
        "note": null
      },
      {
        "sheet": "Z",
        "order": 26,
        "label": "STD Creasing Requirement",
        "note": null
      }
    ]
  },
  {
    "id": "artwork",
    "label": "Artwork Tracking",
    "short": "Artwork",
    "source": "customer",
    "sheetRange": "AB–AD",
    "columns": [
      {
        "sheet": "AB",
        "order": 28,
        "label": "Artwork Receipt",
        "note": null
      },
      {
        "sheet": "AC",
        "order": 29,
        "label": "Artwork Submitted for Approval",
        "note": null
      },
      {
        "sheet": "AD",
        "order": 30,
        "label": "Approved Artwork (Stereo) No.",
        "note": null
      }
    ]
  },
  {
    "id": "std_dims",
    "label": "STD Internal Dimensions",
    "short": "STD Dims",
    "source": "customer",
    "sheetRange": "AE–AH",
    "columns": [
      {
        "sheet": "AH",
        "order": 34,
        "label": "STD Tolerance",
        "note": null
      }
    ]
  },
  {
    "id": "std_board",
    "label": "STD Board & Paper Composition",
    "short": "STD Board",
    "source": "customer",
    "sheetRange": "AI–AX",
    "columns": [
      {
        "sheet": "AX",
        "order": 50,
        "label": "STD Packing Size",
        "note": null
      }
    ]
  },
  {
    "id": "conversion",
    "label": "Conversion · Deckle · Sheet Sizing",
    "short": "Conversion",
    "source": "production",
    "sheetRange": "AY–BO",
    "columns": [
      {
        "sheet": "AY",
        "order": 51,
        "label": "Length Conversion Factor (mm)",
        "note": null
      },
      {
        "sheet": "AZ",
        "order": 52,
        "label": "Width Conversion Factor (mm)",
        "note": null
      },
      {
        "sheet": "BA",
        "order": 53,
        "label": "Height Conversion Factor (mm)",
        "note": null
      },
      {
        "sheet": "BB",
        "order": 54,
        "label": "Flap Conversion Factor (mm)",
        "note": null
      },
      {
        "sheet": "BC",
        "order": 55,
        "label": "OD Length (mm)",
        "note": null
      },
      {
        "sheet": "BD",
        "order": 56,
        "label": "OD Width (mm)",
        "note": null
      },
      {
        "sheet": "BE",
        "order": 57,
        "label": "OD Height (mm)",
        "note": null
      },
      {
        "sheet": "BF",
        "order": 58,
        "label": "Flap (L) (mm)",
        "note": null
      },
      {
        "sheet": "BG",
        "order": 59,
        "label": "Flap (W) (mm)",
        "note": null
      },
      {
        "sheet": "BI",
        "order": 61,
        "label": "Trimming for full deckle (mm)",
        "note": null
      },
      {
        "sheet": "BJ",
        "order": 62,
        "label": "INT Deckle (mm)",
        "note": null
      },
      {
        "sheet": "BK",
        "order": 63,
        "label": "INT Deckle (cm)",
        "note": null
      },
      {
        "sheet": "BL",
        "order": 64,
        "label": "Trimming for Sheet Length",
        "note": null
      },
      {
        "sheet": "BM",
        "order": 65,
        "label": "Sheet Length (mm)",
        "note": null
      },
      {
        "sheet": "BN",
        "order": 66,
        "label": "Sheet Length (cm)",
        "note": null
      },
      {
        "sheet": "BO",
        "order": 67,
        "label": "Sheet Area (sqm)",
        "note": null
      }
    ]
  },
  {
    "id": "int_boardline",
    "label": "INT Boardline Composition & Production",
    "short": "INT Boardline",
    "source": "production",
    "sheetRange": "BP–CO",
    "columns": [
      {
        "sheet": "BP",
        "order": 68,
        "label": "INT Flute 1",
        "note": null
      },
      {
        "sheet": "BQ",
        "order": 69,
        "label": "INT Flute 1 Take-up",
        "note": null
      },
      {
        "sheet": "BR",
        "order": 70,
        "label": "INT Flute 2",
        "note": null
      },
      {
        "sheet": "BS",
        "order": 71,
        "label": "INT Flute 2 Take-up",
        "note": null
      },
      {
        "sheet": "BT",
        "order": 72,
        "label": "INT Top BF",
        "note": null
      },
      {
        "sheet": "BU",
        "order": 73,
        "label": "INT Top GSM",
        "note": null
      },
      {
        "sheet": "BV",
        "order": 74,
        "label": "INT Flute-1 BF",
        "note": null
      },
      {
        "sheet": "BW",
        "order": 75,
        "label": "INT Flute-1 GSM",
        "note": null
      },
      {
        "sheet": "BX",
        "order": 76,
        "label": "INT Back-1 BF",
        "note": null
      },
      {
        "sheet": "BY",
        "order": 77,
        "label": "INT Back-1 GSM",
        "note": null
      },
      {
        "sheet": "BZ",
        "order": 78,
        "label": "INT Flute-2 BF",
        "note": null
      },
      {
        "sheet": "CA",
        "order": 79,
        "label": "INT Flute-2 GSM",
        "note": null
      },
      {
        "sheet": "CB",
        "order": 80,
        "label": "INT Back-2 BF",
        "note": null
      },
      {
        "sheet": "CC",
        "order": 81,
        "label": "INT Back-2 GSM",
        "note": null
      },
      {
        "sheet": "CD",
        "order": 82,
        "label": "INT Item Sheet Wt (Kg)",
        "note": null
      },
      {
        "sheet": "CE",
        "order": 83,
        "label": "INT Dispatch Set Wt (Kg)",
        "note": null
      },
      {
        "sheet": "CF",
        "order": 84,
        "label": "INT Item BS (Kg/cm2)",
        "note": null
      },
      {
        "sheet": "CG",
        "order": 85,
        "label": "INT Item GSM",
        "note": null
      },
      {
        "sheet": "CH",
        "order": 86,
        "label": "INT CS (Kgf)",
        "note": null
      },
      {
        "sheet": "CI",
        "order": 87,
        "label": "INT Boardline Category",
        "note": null
      },
      {
        "sheet": "CJ",
        "order": 88,
        "label": "INT Printer Ups",
        "note": null
      },
      {
        "sheet": "CK",
        "order": 89,
        "label": "INT Punching Ups",
        "note": null
      },
      {
        "sheet": "CL",
        "order": 90,
        "label": "INT Printer Speed",
        "note": null
      },
      {
        "sheet": "CM",
        "order": 91,
        "label": "INT Production Process Flow",
        "note": null
      },
      {
        "sheet": "CN",
        "order": 92,
        "label": "INT Boardline Deckle Trim Wt (Kg)",
        "note": null
      },
      {
        "sheet": "CO",
        "order": 93,
        "label": "INT Printer Trim Wt (Kg)",
        "note": null
      }
    ]
  },
  {
    "id": "status",
    "label": "Status & Governance",
    "short": "Status",
    "source": "governance",
    "sheetRange": "DV–EB",
    "columns": [
      {
        "sheet": "DV",
        "order": 126,
        "label": "Strapping Type",
        "note": null
      },
      {
        "sheet": "DW",
        "order": 127,
        "label": "Special Remarks",
        "note": null
      },
      {
        "sheet": "DY",
        "order": 129,
        "label": "ITEM STATUS",
        "note": "Superseded by the app lifecycle (CDM-11, Amendment 02 B-04)"
      },
      {
        "sheet": "EA",
        "order": 131,
        "label": "Discontinued DATE",
        "note": "Superseded by the app lifecycle (CDM-11, Amendment 02 B-04)"
      },
      {
        "sheet": "EB",
        "order": 132,
        "label": "(unnamed in sheet)",
        "note": null
      }
    ]
  },
  {
    "id": "area",
    "label": "Area · Scrap · Costing Support",
    "short": "Area / Costing",
    "source": "production",
    "sheetRange": "FO–FX",
    "columns": [
      {
        "sheet": "FO",
        "order": 171,
        "label": "SHIPPER STRUCTURE",
        "note": null
      },
      {
        "sheet": "FP",
        "order": 172,
        "label": "REMARKS",
        "note": null
      },
      {
        "sheet": "FQ",
        "order": 173,
        "label": "area of box",
        "note": null
      },
      {
        "sheet": "FR",
        "order": 174,
        "label": "area of partition",
        "note": null
      },
      {
        "sheet": "FS",
        "order": 175,
        "label": "area of plate",
        "note": null
      },
      {
        "sheet": "FT",
        "order": 176,
        "label": "Gluing Area (sqm)",
        "note": null
      },
      {
        "sheet": "FU",
        "order": 177,
        "label": "TRIMING PER BOX",
        "note": null
      },
      {
        "sheet": "FV",
        "order": 178,
        "label": "NET PER BOX SQ MTR",
        "note": null
      },
      {
        "sheet": "FW",
        "order": 179,
        "label": "DECKLE X SL SQ MTR",
        "note": null
      },
      {
        "sheet": "FX",
        "order": 180,
        "label": "Diff scrap SQ MTR",
        "note": null
      }
    ]
  },
  {
    "id": "deckle",
    "label": "Deckle Reconciliation & Internal Board Values",
    "short": "Deckle",
    "source": "production",
    "sheetRange": "HX–IK",
    "columns": [
      {
        "sheet": "HX",
        "order": 232,
        "label": "Diff mm",
        "note": null
      },
      {
        "sheet": "HY",
        "order": 233,
        "label": "Act Deckle",
        "note": null
      },
      {
        "sheet": "HZ",
        "order": 234,
        "label": "Common Deckle",
        "note": null
      },
      {
        "sheet": "IA",
        "order": 235,
        "label": "Item Code",
        "note": null
      },
      {
        "sheet": "IB",
        "order": 236,
        "label": "Internal Top",
        "note": null
      },
      {
        "sheet": "IC",
        "order": 237,
        "label": "Internal Flute-1",
        "note": null
      },
      {
        "sheet": "ID",
        "order": 238,
        "label": "Internal Back-1",
        "note": null
      },
      {
        "sheet": "IE",
        "order": 239,
        "label": "Internal Flute-2",
        "note": null
      },
      {
        "sheet": "IF",
        "order": 240,
        "label": "Internal Back-2",
        "note": null
      },
      {
        "sheet": "IG",
        "order": 241,
        "label": "Internal Top (Common Deckle)",
        "note": null
      },
      {
        "sheet": "IH",
        "order": 242,
        "label": "Internal Flute-1 (Common Deckle)",
        "note": null
      },
      {
        "sheet": "II",
        "order": 243,
        "label": "Internal Back-1 (Common Deckle)",
        "note": null
      },
      {
        "sheet": "IJ",
        "order": 244,
        "label": "Internal Flute-2 (Common Deckle)",
        "note": null
      },
      {
        "sheet": "IK",
        "order": 245,
        "label": "Internal Back-2 (Common Deckle)",
        "note": null
      }
    ]
  },
  {
    "id": "mill",
    "label": "Paper Mill Assignment",
    "short": "Paper Mill",
    "source": "production",
    "sheetRange": "IL–IP",
    "columns": [
      {
        "sheet": "IL",
        "order": 246,
        "label": "Top Paper Mill",
        "note": null
      },
      {
        "sheet": "IM",
        "order": 247,
        "label": "Flute-1 Paper Mill",
        "note": null
      },
      {
        "sheet": "IN",
        "order": 248,
        "label": "Back-1 Paper Mill",
        "note": null
      },
      {
        "sheet": "IO",
        "order": 249,
        "label": "Flute-2 Paper Mill",
        "note": null
      },
      {
        "sheet": "IP",
        "order": 250,
        "label": "Back-2 Paper Mill",
        "note": null
      }
    ]
  },
  {
    "id": "packing",
    "label": "Packing / Set Configuration",
    "short": "Packing",
    "source": "production",
    "sheetRange": "IZ–IZ",
    "columns": [
      {
        "sheet": "IZ",
        "order": 260,
        "label": "Pc per set",
        "note": "Superseded by quantity per set on each SKU Set member (CDM-44)"
      }
    ]
  }
];

export const SKU_SPEC_FIELD_COUNT = 39;
export const PRODUCTION_BACKLOG_COUNT = 94;
