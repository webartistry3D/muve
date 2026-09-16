> For the complete documentation index, see [llms.txt](https://docs.mapbox.com/map-styles/llms.txt)

# Mapbox Satellite Streets

**Mapbox Satellite Streets** combines global satellite and aerial imagery with road and place label overlays. It provides real-world visual context alongside navigational information.

> **Note (warning): Classic style — no longer maintained**
> 
> Mapbox Satellite Streets is a classic style that is no longer actively maintained. It remains available for existing applications.
> 
> For new projects, use [Mapbox Standard Satellite](https://docs.mapbox.com/map-styles/reference/standard-satellite/), which combines satellite imagery with the continuously improving cartography and features of Mapbox Standard.

### Access this Style

Use this **Style URL** to load this style in any Mapbox SDK or library:

```text
mapbox://styles/mapbox/satellite-streets-v12
```

Retrieve the full style JSON via the [Styles API](https://docs.mapbox.com/api/maps/styles/):

```text
https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12?access_token=YOUR_MAPBOX_ACCESS_TOKEN
```

[Clone in Studio](https://account.mapbox.com/auth/signin/?route-to=https://studio.mapbox.com/styles/add-style/mapbox/satellite-streets-v12)

### Map Preview

**Tilesets used in this style:**

-   [Mapbox Satellite](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/)
-   [Mapbox Streets v8](https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/)

## Common uses

-   Location and property mapping with real-world context
-   Urban planning and site analysis
-   Applications where users enjoy seeing both real images and navigational labels

## Customization

Classic styles can be customized in two ways:

-   **At runtime in code** — use `setLayoutProperty` and `setPaintProperty` to show, hide, or restyle individual layers after the map loads. This keeps all style logic in your codebase and is well-suited for dynamic changes driven by user interaction or application state.
-   **In Mapbox Studio** — clone the style in [Mapbox Studio](https://console.mapbox.com/studio/) to adjust colors, toggle layers, change fonts, and add custom data sources. The resulting custom style is hosted by Mapbox and referenced by a style URL.

For new projects, consider using [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/) instead. Standard provides a richer feature set, continuously improving cartography, and a configuration API that replaces direct layer manipulation.