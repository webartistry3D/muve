> For the complete documentation index, see [llms.txt](https://docs.mapbox.com/map-styles/llms.txt)

# Mapbox Dark

**Mapbox Dark** is a minimal, dark-colored basemap designed to provide a rich backdrop for data visualizations and night-mode interfaces. Its dark background makes brightly colored data layers highly legible.

> **Note (warning): Classic style — no longer maintained**
> 
> Mapbox Dark is a classic style that is no longer actively maintained. It remains available for existing applications.
> 
> For new projects, use [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/), which includes continuously improving cartography, 3D features, and dynamic lighting.

### Access this Style

Use this **Style URL** to load this style in any Mapbox SDK or library:

```text
mapbox://styles/mapbox/dark-v11
```

Retrieve the full style JSON via the [Styles API](https://docs.mapbox.com/api/maps/styles/):

```text
https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=YOUR_MAPBOX_ACCESS_TOKEN
```

[Clone in Studio](https://account.mapbox.com/auth/signin/?route-to=https://studio.mapbox.com/styles/add-style/mapbox/dark-v11)

### Map Preview

**Tilesets used in this style:**

-   [Mapbox Streets v8](https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/)
-   [Mapbox Terrain v2](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-v2/)
-   [Mapbox Bathymetry v2](https://docs.mapbox.com/data/tilesets/reference/mapbox-bathymetry-v2/)

## Common uses

-   Dark-mode application maps
-   Data visualization overlays where bright colors stand out against a dark background
-   Night-themed dashboards and analytics interfaces

## Customization

Classic styles can be customized in two ways:

-   **At runtime in code** — use `setLayoutProperty` and `setPaintProperty` to show, hide, or restyle individual layers after the map loads. This keeps all style logic in your codebase and is well-suited for dynamic changes driven by user interaction or application state.
-   **In Mapbox Studio** — clone the style in [Mapbox Studio](https://console.mapbox.com/studio/) to adjust colors, toggle layers, change fonts, and add custom data sources. The resulting custom style is hosted by Mapbox and referenced by a style URL.

For new projects, consider using [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/) instead. Standard provides a richer feature set, continuously improving cartography, and a configuration API that replaces direct layer manipulation.