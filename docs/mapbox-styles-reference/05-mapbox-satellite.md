> For the complete documentation index, see [llms.txt](https://docs.mapbox.com/map-styles/llms.txt)

# Mapbox Satellite

**Mapbox Satellite** is a global basemap of high-resolution satellite and aerial imagery. It provides a photorealistic view of the world without any vector overlays, making it ideal as a standalone imagery layer or as a base for custom label and data overlays.

> **Note (warning): Classic style — no longer maintained**
> 
> Mapbox Satellite is a classic style that is no longer actively maintained. It remains available for existing applications.
> 
> For new projects, use [Mapbox Standard Satellite](https://docs.mapbox.com/map-styles/reference/standard-satellite/), which combines satellite imagery with dynamic lighting, 3D features, and continuously improving cartography from Mapbox Standard.

### Access this Style

Use this **Style URL** to load this style in any Mapbox SDK or library:

```text
mapbox://styles/mapbox/satellite-v9
```

Retrieve the full style JSON via the [Styles API](https://docs.mapbox.com/api/maps/styles/):

```text
https://api.mapbox.com/styles/v1/mapbox/satellite-v9?access_token=YOUR_MAPBOX_ACCESS_TOKEN
```

[Clone in Studio](https://account.mapbox.com/auth/signin/?route-to=https://studio.mapbox.com/styles/add-style/mapbox/satellite-v9)

### Map Preview

**Tilesets used in this style:**

-   [Mapbox Satellite](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/)

## Common uses

-   Standalone satellite imagery basemaps
-   Background layer for custom vector data overlays
-   Applications where photorealistic imagery is the primary map content

## Customization

Classic styles can be customized in two ways:

-   **At runtime in code** — use `setLayoutProperty` and `setPaintProperty` to show, hide, or restyle individual layers after the map loads. This keeps all style logic in your codebase and is well-suited for dynamic changes driven by user interaction or application state.
-   **In Mapbox Studio** — clone the style in [Mapbox Studio](https://console.mapbox.com/studio/) to adjust colors, toggle layers, change fonts, and add custom data sources. The resulting custom style is hosted by Mapbox and referenced by a style URL.

For new projects, consider using [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/) instead. Standard provides a richer feature set, continuously improving cartography, and a configuration API that replaces direct layer manipulation.