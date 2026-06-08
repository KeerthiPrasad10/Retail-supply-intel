"""Seed reference data: countries and trend->trade product categories.

Countries focus on Lidl's retail markets plus the major sourcing origins.
Categories carry an HS4 code (the join key to customs/trade data) and the
keywords used to map free-text social trends onto them.
"""

from __future__ import annotations

# (alpha-2, iso3, name, region)
COUNTRIES: list[tuple[str, str, str, str]] = [
    # Retail markets
    ("DE", "DEU", "Germany", "Europe"),
    ("GB", "GBR", "United Kingdom", "Europe"),
    ("FR", "FRA", "France", "Europe"),
    ("IT", "ITA", "Italy", "Europe"),
    ("ES", "ESP", "Spain", "Europe"),
    ("NL", "NLD", "Netherlands", "Europe"),
    ("PL", "POL", "Poland", "Europe"),
    ("AT", "AUT", "Austria", "Europe"),
    ("BE", "BEL", "Belgium", "Europe"),
    ("IE", "IRL", "Ireland", "Europe"),
    ("PT", "PRT", "Portugal", "Europe"),
    ("SE", "SWE", "Sweden", "Europe"),
    ("DK", "DNK", "Denmark", "Europe"),
    ("FI", "FIN", "Finland", "Europe"),
    ("CZ", "CZE", "Czechia", "Europe"),
    ("RO", "ROU", "Romania", "Europe"),
    ("HU", "HUN", "Hungary", "Europe"),
    ("GR", "GRC", "Greece", "Europe"),
    ("US", "USA", "United States", "Americas"),
    # Sourcing origins
    ("CN", "CHN", "China", "Asia"),
    ("VN", "VNM", "Vietnam", "Asia"),
    ("IN", "IND", "India", "Asia"),
    ("TR", "TUR", "Turkey", "Asia"),
    ("BD", "BGD", "Bangladesh", "Asia"),
    ("ID", "IDN", "Indonesia", "Asia"),
    ("TH", "THA", "Thailand", "Asia"),
    ("KH", "KHM", "Cambodia", "Asia"),
    ("PK", "PAK", "Pakistan", "Asia"),
    ("JP", "JPN", "Japan", "Asia"),
    ("KR", "KOR", "South Korea", "Asia"),
    ("MX", "MEX", "Mexico", "Americas"),
    ("BR", "BRA", "Brazil", "Americas"),
    ("MA", "MAR", "Morocco", "Africa"),
]

# (name, hs_code, keywords)
CATEGORIES: list[tuple[str, str, list[str]]] = [
    (
        "Beauty & Cosmetics",
        "3304",
        ["makeup", "skincare", "serum", "lip oil", "blush", "mascara",
         "foundation", "concealer", "retinol", "niacinamide", "glass skin"],
    ),
    ("Tea & Matcha", "0902", ["matcha", "green tea", "chai", "herbal tea", "tea latte"]),
    ("Coffee", "0901", ["coffee", "espresso", "cold brew", "dalgona", "iced coffee"]),
    (
        "Footwear",
        "6404",
        ["sneakers", "shoes", "sambas", "mary janes", "ballet flats", "clogs", "loafers"],
    ),
    ("Knitwear & Apparel", "6110", ["sweater", "cardigan", "knit", "hoodie", "quarter zip"]),
    (
        "Toys & Collectibles",
        "9503",
        ["plush", "squishmallow", "labubu", "blind box", "fidget", "lego", "sonny angel"],
    ),
    (
        "Small Kitchen Appliances",
        "8516",
        ["air fryer", "electric kettle", "milk frother", "blender", "sandwich maker"],
    ),
    (
        "Drinkware & Tumblers",
        "9617",
        ["stanley cup", "tumbler", "water bottle", "owala", "hydration", "insulated bottle"],
    ),
    (
        "Candles & Home Fragrance",
        "3406",
        ["candle", "scented candle", "home fragrance", "diffuser", "wax melt"],
    ),
    ("Audio & Earbuds", "8518", ["earbuds", "headphones", "airpods", "bluetooth speaker"]),
    ("Pet Care", "2309", ["dog treats", "cat food", "pet food", "dog food"]),
]

# ISO3 -> UN M49 numeric code, used by the Comtrade connector. Only the
# countries above are mapped.
ISO3_TO_M49: dict[str, str] = {
    "DEU": "276", "GBR": "826", "FRA": "251", "ITA": "381", "ESP": "724",
    "NLD": "528", "POL": "616", "AUT": "040", "BEL": "056", "IRL": "372",
    "PRT": "620", "SWE": "752", "DNK": "208", "FIN": "246", "CZE": "203",
    "ROU": "642", "HUN": "348", "GRC": "300", "USA": "842", "CHN": "156",
    "VNM": "704", "IND": "699", "TUR": "792", "BGD": "050", "IDN": "360",
    "THA": "764", "KHM": "116", "PAK": "586", "JPN": "392", "KOR": "410",
    "MEX": "484", "BRA": "076", "MAR": "504",
}
M49_TO_ISO3: dict[str, str] = {v: k for k, v in ISO3_TO_M49.items()}
