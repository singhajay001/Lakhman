# Product images

Two routes in. Both end with `python3 build/specials.py`.

## 1 · Catalogue tiles (how the current 55 got here)

Drop the banner's asset-pack PNGs into `_source/`, add the pairing to
`build/product-images.json`, then:

```bash
python3 build/crop-tiles.py    # crops the caption off, writes <slug>.webp
python3 build/specials.py
./check.sh
```

Pairings are written **by hand**, never fuzzy-matched. A fuzzy pass put
Glenfiddich's bottle against The Glenlivet's price; on a page carrying prices
that is worse than no photograph. Check a contact sheet before shipping.

`_source/` never reaches the live site - `publish.sh` strips it.

## 2 · Your own photographs

Drop a file in this folder named `<slug>.webp` (or .png/.jpg/.avif) and it is
used as-is. White or transparent background, roughly 600&times;1000px, under
150KB. A photo you took that no other Local Liquor store has is worth more to
Google than the supplier render everyone else uses.

Cards with an image show no gold price tag - the catalogue tile carries its own
badge. A card with your own price-free photograph will show no price at all, so
if you supply one, say so and the tag can be switched back on for it.

## Current state

### Spirits & liqueurs

| File | Product | |
|---|---|---|
| `chivas-regal-12yo-blended-scotch-whisky.webp` | Chivas Regal 12YO Blended Scotch Whisky | photo |
| `the-glenlivet-12yo-single-malt-scotch-whisky.webp` | The Glenlivet 12YO Single Malt Scotch Whisky | photo |
| `chivas-regal-crystalgold.webp` | Chivas Regal Crystalgold | photo |
| `makers-mark-kentucky-straight-bourbon-whisky.webp` | Maker&rsquo;s Mark Kentucky Straight Bourbon Whisky | photo |
| `the-macallan-double-cask-12yo.webp` | The Macallan Double Cask 12YO | photo |
| `st-agnes-vs-brandy.webp` | St Agnes VS Brandy | photo |
| `cougar-bourbon-vodka-o-or-black-douglas-scotch-whisky.webp` | Cougar Bourbon, Vodka O or Black Douglas Scotch Whisky | photo |
| `jim-beam-white-label-or-canadian-club-original-whisky.webp` | Jim Beam White Label or Canadian Club Original Whisky | photo |
| `jagermeister-liqueur.webp` | J&auml;germeister Liqueur | photo |
| `jameson-blended-irish-whiskey-or-jameson-orange.webp` | Jameson Blended Irish Whiskey or Jameson Orange | photo |
| `bombay-sapphire-gin.webp` | Bombay Sapphire Gin | photo |
| `absolut-vodka-or-fireball-whisky.webp` | Absolut Vodka or Fireball Whisky | photo |
| `jameson-black-barrel-irish-whiskey.webp` | Jameson Black Barrel Irish Whiskey | photo |
| `patron-silver-tequila.webp` | Patr&oacute;n Silver Tequila | photo |
| `glenfiddich-12yo-single-malt-scotch-whisky.webp` | Glenfiddich 12YO Single Malt Scotch Whisky | photo |
| `glenmorangie-the-original.webp` | Glenmorangie The Original | photo |
| `the-balvenie-doublewood-12yo-single-malt-scotch-whisky.webp` | The Balvenie DoubleWood 12YO Single Malt Scotch Whisky | photo |

### Premix & RTDs

| File | Product | |
|---|---|---|
| `fellr.webp` | FELLR 4% Range | photo |
| `four-pillars-tin.webp` | Four Pillars 5.1% Tin Range | photo |
| `hard-rated.webp` | Hard Rated 4.5% Range | photo |
| `kirin-hyoketsu-mango.webp` | Kirin Hyoketsu Mango 6% | photo |
| `jameson-ultra-dry-and-lime.webp` | Jameson Ultra Dry &amp; Lime 10% | photo |
| `jim-beam-white-or-canadian-club.webp` | Jim Beam White or Canadian Club 4.8% Ranges | photo |
| `woodstock-bourbon-and-cola-or-vodka-cruiser-mixed.webp` | Woodstock Bourbon &amp; Cola 4.8% or Vodka Cruiser Mixed 4.6% | photo |
| `suntory-196.webp` | Suntory -196 6% Range | photo |
| `woodstock-bourbon-and-cola-special.webp` | Woodstock Bourbon &amp; Cola 6% Special | photo |

### Beer & cider

| File | Product | |
|---|---|---|
| `strongbow-cider.webp` | Strongbow Cider 5% Range | **silhouette** |
| `jervis-bay-brewing-co-11-days-pale-ale.webp` | Jervis Bay Brewing Co. 11 Days Pale Ale | photo |
| `4-pines-pacific-ale.webp` | 4 Pines Pacific Ale | photo |
| `stone-and-wood-pacific-ale.webp` | Stone &amp; Wood Pacific Ale | photo |
| `corona-extra.webp` | Corona Extra | photo |
| `tooheys-extra-dry.webp` | Tooheys Extra Dry | photo |
| `great-northern-super-crisp.webp` | Great Northern Super Crisp | photo |
| `heineken-lager-or-tooheys-new.webp` | Heineken Lager or Tooheys New | photo |
| `coopers-mild-ale.webp` | Coopers Mild Ale 3.5% | photo |
| `hahn-superdry.webp` | Hahn SuperDry 4.6% | photo |
| `victoria-bitter.webp` | Victoria Bitter | photo |
| `carlton-dry.webp` | Carlton Dry 3.5% | photo |
| `xxxx-gold.webp` | XXXX Gold | photo |
| `peroni-nastro-azzurro.webp` | Peroni Nastro Azzurro | photo |
| `great-northern-original.webp` | Great Northern Original | photo |

### Wine

| File | Product | |
|---|---|---|
| `the-drover.webp` | The Drover Range | photo |
| `mcguigan-black-label.webp` | McGuigan Black Label Range | photo |
| `winesmiths-traditional.webp` | Winesmiths Traditional Range | photo |
| `stoneleigh-marlborough.webp` | Stoneleigh Marlborough Range | photo |
| `stones-ginger-wine.webp` | Stones Ginger Wine | photo |
| `st-hallett-faith.webp` | St Hallett Faith Range | photo |
| `wynns-the-siding.webp` | Wynns The Siding Range | photo |
| `angove-organic.webp` | Angove Organic Range | photo |
| `yarra-burn-prosecco-or-grant-burge-5th-generation.webp` | Yarra Burn Prosecco or Grant Burge 5th Generation Ranges | photo |
| `villa-maria-private-bin.webp` | Villa Maria Private Bin Range (excl. Pinot Noir) | photo |
| `jacobs-creek-double-barrel.webp` | Jacob&rsquo;s Creek Double Barrel Range | photo |
| `devils-corner.webp` | Devil&rsquo;s Corner Range | photo |
| `bird-in-hand-sparkling.webp` | Bird In Hand Sparkling | photo |
| `little-yering-or-xanadu-circa-77.webp` | Little Yering or Xanadu Circa 77 Ranges | photo |
| `penfolds-bin-389-cabernet-shiraz.webp` | Penfolds Bin 389 Cabernet Shiraz | photo |

## Not published

In the pack, priced, but absent from the NSW/ACT/VIC P37 pages - the asset pack
is national. Confirm with the store before adding:

- `LLP37_BentSpoke_Crankshaft_IPA_2_FOR_40.png` - 2 FOR $40
- `LLP37_Vodka_Cruiser_X_10percent_Range_22.99.png` - $22.99 4pk
- `LLP37_Tamnavulin_Double_Cask_Single_Malt_Scotch_Whisky_69.99.png` - $69.99 ea
- `LLP37_Tamnavulin_Sherry_Cask_Single_Malt_Scotch_Whisky_69.99.png` - $69.99 ea
- `LLP37_Ara_Single_Estate_Range_18.99.png` - $18.99 ea
