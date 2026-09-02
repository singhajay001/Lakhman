# Product photos

Drop image files in this folder named after the product's slug and they appear
on the site automatically. No code change, no edit to `build/specials.json`.

```bash
python3 build/specials.py   # picks up whatever is here
./check.sh
```

Anything without a photo keeps its brand-coloured silhouette, so a part-finished
set still looks deliberate. Upload five or fifty - both work.

## Rules

| | |
|---|---|
| Format | `.webp` preferred, then `.png`, `.jpg`, `.avif` |
| Background | White or transparent. The cards sit on white. |
| Size | Roughly 600&times;1000px. Bigger is fine; it is scaled down. |
| Weight | Under 150KB each if you can - this folder ships to every visitor |
| Naming | Exactly the slug below, all lowercase, hyphens only |

Do not use the images from the product spreadsheet: every one of those URLs
points at BWS's media server.

## Filenames

Ten marked **&starf;** appear on the homepage - do those first if you are
picking where to start.

### Spirits & liqueurs

| File | Product |
|---|---|
| `chivas-regal-12yo-blended-scotch-whisky.webp` &starf; | Chivas Regal 12YO Blended Scotch Whisky |
| `the-glenlivet-12yo-single-malt-scotch-whisky.webp` | The Glenlivet 12YO Single Malt Scotch Whisky |
| `chivas-regal-crystalgold.webp` | Chivas Regal Crystalgold |
| `makers-mark-kentucky-straight-bourbon-whisky.webp` &starf; | Maker&rsquo;s Mark Kentucky Straight Bourbon Whisky |
| `the-macallan-double-cask-12yo.webp` | The Macallan Double Cask 12YO |
| `st-agnes-vs-brandy.webp` | St Agnes VS Brandy |
| `cougar-bourbon-vodka-o-or-black-douglas-scotch-whisky.webp` | Cougar Bourbon, Vodka O or Black Douglas Scotch Whisky |
| `jim-beam-white-label-or-canadian-club-original-whisky.webp` | Jim Beam White Label or Canadian Club Original Whisky |
| `j-germeister-liqueur.webp` | J&auml;germeister Liqueur |
| `jameson-blended-irish-whiskey-or-jameson-orange.webp` | Jameson Blended Irish Whiskey or Jameson Orange |
| `bombay-sapphire-gin.webp` | Bombay Sapphire Gin |
| `absolut-vodka-or-fireball-whisky.webp` | Absolut Vodka or Fireball Whisky |
| `jameson-black-barrel-irish-whiskey.webp` | Jameson Black Barrel Irish Whiskey |
| `patr-n-silver-tequila.webp` | Patr&oacute;n Silver Tequila |
| `glenfiddich-12yo-single-malt-scotch-whisky.webp` &starf; | Glenfiddich 12YO Single Malt Scotch Whisky |
| `glenmorangie-the-original.webp` | Glenmorangie The Original |
| `the-balvenie-doublewood-12yo-single-malt-scotch-whisky.webp` | The Balvenie DoubleWood 12YO Single Malt Scotch Whisky |

### Premix & RTDs

| File | Product |
|---|---|
| `fellr.webp` | FELLR 4% Range |
| `four-pillars-tin.webp` | Four Pillars 5.1% Tin Range |
| `hard-rated.webp` | Hard Rated 4.5% Range |
| `kirin-hyoketsu-mango.webp` &starf; | Kirin Hyoketsu Mango 6% |
| `jameson-ultra-dry-and-lime.webp` | Jameson Ultra Dry &amp; Lime 10% |
| `jim-beam-white-or-canadian-club.webp` &starf; | Jim Beam White or Canadian Club 4.8% Ranges |
| `woodstock-bourbon-and-cola-or-vodka-cruiser-mixed.webp` | Woodstock Bourbon &amp; Cola 4.8% or Vodka Cruiser Mixed 4.6% |
| `suntory-196.webp` &starf; | Suntory -196 6% Range |
| `woodstock-bourbon-and-cola-special.webp` | Woodstock Bourbon &amp; Cola 6% Special |

### Beer & cider

| File | Product |
|---|---|
| `strongbow-cider.webp` | Strongbow Cider 5% Range |
| `jervis-bay-brewing-co-11-days-pale-ale.webp` | Jervis Bay Brewing Co. 11 Days Pale Ale |
| `4-pines-pacific-ale.webp` | 4 Pines Pacific Ale |
| `stone-and-wood-pacific-ale.webp` &starf; | Stone &amp; Wood Pacific Ale |
| `corona-extra.webp` | Corona Extra |
| `tooheys-extra-dry.webp` | Tooheys Extra Dry |
| `great-northern-super-crisp.webp` | Great Northern Super Crisp |
| `heineken-lager-or-tooheys-new.webp` &starf; | Heineken Lager or Tooheys New |
| `coopers-mild-ale.webp` | Coopers Mild Ale 3.5% |
| `hahn-superdry.webp` | Hahn SuperDry 4.6% |
| `victoria-bitter.webp` | Victoria Bitter |
| `carlton-dry.webp` | Carlton Dry 3.5% |
| `xxxx-gold.webp` | XXXX Gold |
| `peroni-nastro-azzurro.webp` | Peroni Nastro Azzurro |
| `great-northern-original.webp` &starf; | Great Northern Original |

### Wine

| File | Product |
|---|---|
| `the-drover.webp` | The Drover Range |
| `mcguigan-black-label.webp` | McGuigan Black Label Range |
| `winesmiths-traditional.webp` | Winesmiths Traditional Range |
| `stones-ginger-wine.webp` | Stones Ginger Wine |
| `st-hallett-faith.webp` | St Hallett Faith Range |
| `wynns-the-siding.webp` | Wynns The Siding Range |
| `angove-organic.webp` | Angove Organic Range |
| `yarra-burn-prosecco-or-grant-burge-5th-generation.webp` | Yarra Burn Prosecco or Grant Burge 5th Generation Ranges |
| `villa-maria-private-bin.webp` | Villa Maria Private Bin Range (excl. Pinot Noir) |
| `jacobs-creek-double-barrel.webp` | Jacob&rsquo;s Creek Double Barrel Range |
| `devils-corner.webp` | Devil&rsquo;s Corner Range |
| `bird-in-hand-sparkling.webp` | Bird In Hand Sparkling |
| `little-yering-or-xanadu-circa-77.webp` | Little Yering or Xanadu Circa 77 Ranges |
| `penfolds-bin-389-cabernet-shiraz.webp` &starf; | Penfolds Bin 389 Cabernet Shiraz |

