import os
import re
from PIL import Image

img = Image.open('Gemini_Generated_Image_254g9i254g9i254g.jpg')
output_dir = os.path.join('public', 'uploads', 'services')
os.makedirs(output_dir, exist_ok=True)

cols = [
  (65, 298), (339, 574), (614, 848), (889, 1123), (1163, 1396),
  (1436, 1669), (1709, 1943), (1982, 2215), (2255, 2487), (2527, 2759)
]

rows = [
  (46, 260),
  (353, 560),
  (660, 867),
  (963, 1159),
  (1245, 1450)
]

# Primary optimal mapping for each of the 40 distinct services in garmentCatalogMaster:
service_to_cell = {
  # Row 0
  "Area Rug Runner (Washable)": (0, 0),
  "Athletic & Canvas Sneakers": (0, 1),
  "Backpack & Gym Bag": (0, 2),
  "Bath Towel & Bathrobe Set": (0, 3),
  "Bed Sheet & Pillowcase Set": (0, 5),
  "Blackout Curtains (Per Panel)": (1, 0),
  "Cashmere Cardigan": (0, 7),
  "Casual Blazer / Sport Coat": (0, 8),
  "Men's Formal Shirt": (3, 2), # Row 3 Col 2 has the white formal shirt with collar & pocket

  # Row 1
  "Casual Denim Jeans": (1, 3),
  "Casual Summer Dress": (1, 4),
  "Down Feather Puffer Coat": (1, 6),
  "Handbag / Purse (Leather/Fabric)": (1, 7),
  "Heavy Quilt & Comforter": (1, 9),

  # Row 2
  "Duvet Cover (King/Queen)": (2, 1),
  "Embroidered Kurta / Salwar Kameez": (2, 2),
  "Evening Cocktail Gown": (2, 3),
  "Formal Women's Jumpsuit": (2, 4),
  "Genuine Leather Biker Jacket": (2, 5),
  "Heavy Trench Coat": (2, 6),
  "Hoodie & Sweatshirt": (2, 8),

  # Row 3
  "Leather Oxford Dress Shoes": (3, 0),
  "Men's Casual T-Shirt": (3, 1),
  "Motorcycle / Winter Riding Gloves": (3, 3),
  "Necktie / Bowtie / Scarf": (3, 4),
  "Pleated Skirt": (3, 5),
  "Plush Decorative Pillow / Cushion": (3, 6),
  "Sheer Window Drapes (Pair)": (3, 7),
  "Silk Blouse / Top": (3, 8),
  "Sofa Slipcover Set": (3, 9),

  # Row 4
  "Suede Boots / Chukka": (4, 0),
  "Suede Coat / Overshirt": (4, 1),
  "Tablecloth & Napkins (Set of 6)": (4, 2),
  "Three-Piece Tuxedo": (4, 3),
  "Tracksuit / Sweatpants": (4, 4),
  "Traditional Silk Saree": (4, 5),
  "Trousers & Chinos": (4, 6),
  "Two-Piece Business Suit": (4, 7),
  "Winter Woolen Jacket": (4, 8),
  "Woolen Fleece Blanket": (4, 9)
}

print(f"Total services to crop: {len(service_to_cell)}")

for s_name, (r, c) in service_to_cell.items():
    slug = re.sub(r'[^a-z0-9]+', '_', s_name.lower()).strip('_')
    filename = f"{slug}.png"
    filepath = os.path.join(output_dir, filename)
    
    x1, x2 = cols[c]
    y1, y2 = rows[r]
    cropped = img.crop((x1, y1, x2, y2))
    cropped.save(filepath, 'PNG')
    print(f"Saved: {filename} from row {r}, col {c}")

print("All 40 service icons successfully saved to public/uploads/services/")
