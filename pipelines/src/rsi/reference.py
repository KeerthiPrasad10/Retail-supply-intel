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

# Approximate country centroids (lat, lon) for the flow map.
CENTROIDS: dict[str, tuple[float, float]] = {
    "DE": (51.0, 9.0), "GB": (54.0, -2.0), "FR": (46.0, 2.0), "IT": (42.8, 12.8),
    "ES": (40.0, -4.0), "NL": (52.2, 5.3), "PL": (52.0, 19.0), "AT": (47.5, 14.5),
    "BE": (50.6, 4.6), "IE": (53.2, -8.0), "PT": (39.5, -8.0), "SE": (62.0, 15.0),
    "DK": (56.0, 10.0), "FI": (64.0, 26.0), "CZ": (49.8, 15.5), "RO": (46.0, 25.0),
    "HU": (47.2, 19.5), "GR": (39.0, 22.0), "US": (39.0, -98.0), "CN": (35.0, 105.0),
    "VN": (16.0, 108.0), "IN": (22.0, 79.0), "TR": (39.0, 35.0), "BD": (24.0, 90.0),
    "ID": (-2.0, 118.0), "TH": (15.0, 101.0), "KH": (12.5, 105.0), "PK": (30.0, 70.0),
    "JP": (36.0, 138.0), "KR": (36.5, 128.0), "MX": (23.0, -102.0), "BR": (-10.0, -55.0),
    "MA": (32.0, -6.0),
}

# Asian sourcing origins (the LKA supplier base) — used to scope export-side flows.
ASIAN_ORIGINS: list[str] = [
    "CN", "VN", "IN", "TR", "BD", "ID", "TH", "KH", "PK", "JP", "KR",
]

# Top-10 Lidl competitors (retailers). Kaufland is excluded — it is part of the
# Schwarz Group / LKA ("us"), not a competitor. (name, home_country)
COMPETITORS: list[tuple[str, str | None]] = [
    ("Aldi", "DE"),
    ("Tesco", "GB"),
    ("Carrefour", "FR"),
    ("Rewe", "DE"),
    ("Edeka", "DE"),
    ("Auchan", "FR"),
    ("Mercadona", "ES"),
    ("Ahold Delhaize", "NL"),
    ("Sainsbury's", "GB"),
    ("Walmart", "US"),
]

# Best-effort Asian suppliers per category — RESEARCHED, NOT customs-verified.
# (supplier_name, country_code, category_name)
SUPPLIERS: list[tuple[str, str, str]] = [
    ("Cosmax", "KR", "Beauty & Cosmetics"),
    ("Kolmar Korea", "KR", "Beauty & Cosmetics"),
    ("Yixin Cosmetics", "CN", "Beauty & Cosmetics"),
    ("Aiya", "JP", "Tea & Matcha"),
    ("Marukyu Koyamaen", "JP", "Tea & Matcha"),
    ("Zhejiang Tea Group", "CN", "Tea & Matcha"),
    ("Trung Nguyen", "VN", "Coffee"),
    ("Vinacafe", "VN", "Coffee"),
    ("Santos Jaya Abadi", "ID", "Coffee"),
    ("Pou Chen", "VN", "Footwear"),
    ("Feng Tay", "VN", "Footwear"),
    ("Lai Yih", "VN", "Footwear"),
    ("Crystal International", "CN", "Knitwear & Apparel"),
    ("Shenzhou International", "CN", "Knitwear & Apparel"),
    ("Beximco", "BD", "Knitwear & Apparel"),
    ("DBL Group", "BD", "Knitwear & Apparel"),
    ("Pop Mart", "CN", "Toys & Collectibles"),
    ("Goldlok Toys", "CN", "Toys & Collectibles"),
    ("Winning Crown", "CN", "Toys & Collectibles"),
    ("Midea", "CN", "Small Kitchen Appliances"),
    ("Joyoung", "CN", "Small Kitchen Appliances"),
    ("Guangdong Xinbao", "CN", "Small Kitchen Appliances"),
    ("Haers", "CN", "Drinkware & Tumblers"),
    ("Sup Drinkware", "CN", "Drinkware & Tumblers"),
    ("Quanzhou Yongchun", "CN", "Candles & Home Fragrance"),
    ("Hosley", "IN", "Candles & Home Fragrance"),
    ("Goertek", "CN", "Audio & Earbuds"),
    ("Luxshare", "CN", "Audio & Earbuds"),
    ("AAC Technologies", "CN", "Audio & Earbuds"),
    ("Charoen Pokphand Foods", "TH", "Pet Care"),
    ("Gambol Pet", "CN", "Pet Care"),
    # Expanded via web research (Exa) — still best-effort / unverified.
    ("TBS Group", "VN", "Footwear"),
    ("Gia Dinh Group", "VN", "Footwear"),
    ("Mescot", "CN", "Footwear"),
    ("Interstoff Apparels", "BD", "Knitwear & Apparel"),
    ("NR Group", "BD", "Knitwear & Apparel"),
    ("A-One Toys", "CN", "Toys & Collectibles"),
    ("D King Group", "CN", "Toys & Collectibles"),
    ("KingStar", "CN", "Drinkware & Tumblers"),
    ("Ansheng Technology", "CN", "Drinkware & Tumblers"),
    ("Saehan Cosmetics", "KR", "Beauty & Cosmetics"),
    ("MIC Exports", "IN", "Candles & Home Fragrance"),
    ("Qingdao Aroma Home", "CN", "Candles & Home Fragrance"),
    ("i-Tail (Thai Union)", "TH", "Pet Care"),
    ("Asian Alliance International", "TH", "Pet Care"),
]

# Best-effort competitor sourcing links — RESEARCHED, NOT customs-verified.
# (competitor_name, category_name, origin_country_code)
COMPETITOR_SOURCING: list[tuple[str, str, str]] = [
    ("Aldi", "Footwear", "VN"),
    ("Aldi", "Knitwear & Apparel", "BD"),
    ("Aldi", "Small Kitchen Appliances", "CN"),
    ("Aldi", "Audio & Earbuds", "CN"),
    ("Tesco", "Knitwear & Apparel", "BD"),
    ("Tesco", "Footwear", "CN"),
    ("Tesco", "Toys & Collectibles", "CN"),
    ("Tesco", "Drinkware & Tumblers", "CN"),
    ("Carrefour", "Knitwear & Apparel", "TR"),
    ("Carrefour", "Footwear", "VN"),
    ("Carrefour", "Candles & Home Fragrance", "IN"),
    ("Rewe", "Coffee", "VN"),
    ("Rewe", "Tea & Matcha", "CN"),
    ("Rewe", "Pet Care", "TH"),
    ("Edeka", "Small Kitchen Appliances", "CN"),
    ("Edeka", "Beauty & Cosmetics", "KR"),
    ("Auchan", "Footwear", "ID"),
    ("Auchan", "Knitwear & Apparel", "BD"),
    ("Mercadona", "Footwear", "VN"),
    ("Mercadona", "Knitwear & Apparel", "TR"),
    ("Ahold Delhaize", "Toys & Collectibles", "CN"),
    ("Ahold Delhaize", "Audio & Earbuds", "CN"),
    ("Sainsbury's", "Knitwear & Apparel", "BD"),
    ("Sainsbury's", "Tea & Matcha", "IN"),
    ("Walmart", "Small Kitchen Appliances", "CN"),
    ("Walmart", "Toys & Collectibles", "CN"),
    ("Walmart", "Footwear", "VN"),
]
