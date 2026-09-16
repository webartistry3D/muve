> For the complete documentation index, see [llms.txt](https://docs.mapbox.com/map-styles/llms.txt)

# Mapbox Navigation Day

**Mapbox Navigation Day** is a high-contrast map style optimized for in-vehicle turn-by-turn navigation in daytime conditions. It emphasizes road hierarchies, shields, and junction details while reducing visual noise from non-navigational map elements.

> **Note (warning): Classic style — no longer maintained**
> 
> Mapbox Navigation Day is a classic style that is no longer actively maintained. It remains available for existing applications.
> 
> For new projects, use [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/), which supports a `day` light preset and is continuously improved.

### Access this Style

Use this **Style URL** to load this style in any Mapbox SDK or library:

```text
mapbox://styles/mapbox/navigation-day-v1
```

Retrieve the full style JSON via the [Styles API](https://docs.mapbox.com/api/maps/styles/):

```text
https://api.mapbox.com/styles/v1/mapbox/navigation-day-v1?access_token=YOUR_MAPBOX_ACCESS_TOKEN
```

[Clone in Studio](https://account.mapbox.com/auth/signin/?route-to=https://studio.mapbox.com/styles/add-style/mapbox/navigation-day-v1)

### Map Preview

**Tilesets used in this style:**

-   [Mapbox Streets v8](https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/)
-   [Mapbox Terrain v2](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-v2/)
-   [Mapbox Traffic v1](https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/)
-   Mapbox Incidents v1

## Common uses

-   In-vehicle navigation applications
-   Ride-sharing and delivery routing interfaces
-   Any application requiring a high-contrast, road-focused map in daytime conditions

## Customization

Classic styles can be customized in two ways:

-   **At runtime in code** — use `setLayoutProperty` and `setPaintProperty` to show, hide, or restyle individual layers after the map loads. This keeps all style logic in your codebase and is well-suited for dynamic changes driven by user interaction or application state.
-   **In Mapbox Studio** — clone the style in [Mapbox Studio](https://console.mapbox.com/studio/) to adjust colors, toggle layers, change fonts, and add custom data sources. The resulting custom style is hosted by Mapbox and referenced by a style URL.

For new projects, consider using [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/) instead. Standard provides a richer feature set, continuously improving cartography, and a configuration API that replaces direct layer manipulation.