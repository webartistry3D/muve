> For the complete documentation index, see [llms.txt](https://docs.mapbox.com/map-styles/llms.txt)

# Mapbox Standard

### Access this Style

Use this **Style URL** to load this style in any Mapbox SDK or library:

```text
mapbox://styles/mapbox/standard
```

Retrieve the full style JSON via the [Styles API](https://docs.mapbox.com/api/maps/styles/):

```text
https://api.mapbox.com/styles/v1/mapbox/standard?access_token=YOUR_MAPBOX_ACCESS_TOKEN
```

[Create a custom style importing Mapbox Standard](https://account.mapbox.com/auth/signin/?route-to=https://studio.mapbox.com/styles/add-style/mapbox/standard)

### Map Preview

This page provides a comprehensive overview of the Mapbox Standard style's configuration options. The Mapbox Standard style is a modern, continuously improving style designed to reduce configuration complexity while delivering high-quality map visualizations.

> **Related content (playground): [Mapbox Standard Style Playground](https://docs.mapbox.com/playground/standard-style/)**
> 
> You can try out many of the configuration options listed below in the **Mapbox Standard Style Playground**. This interactive tool allows you to see how different configurations affect the map style in real-time, and see the implementation code for web, iOS, and Android projects.

## Configuration Properties

Mapbox Standard provides the following configuration properties which you can apply when first importing the style, or at runtime after the style is already loaded. Implementation code is platform specific, but the configuration options are the same across all platforms.

The following configurations are available in Mapbox Standard starting with the version number indicated in the Compatibility section below.

<table><thead><tr><th>Property</th><th>Type</th><th>Description</th><th>Compatibility</th></tr></thead><tbody><tr><td><code>showPedestrianRoads</code></td><td><code>Boolean</code></td><td>Show or hide pedestrian roads, paths, trails.</td><td>Android and iOS SDK <code>v11.0.0</code> and GL-JS <code>v3.0.0</code></td></tr><tr><td><code>showPlaceLabels</code></td><td><code>Boolean</code></td><td>Show or hide place label layers.</td><td>Android and iOS SDK <code>v11.0.0</code> and GL-JS <code>v3.0.0</code></td></tr><tr><td><code>showPointOfInterestLabels</code></td><td><code>Boolean</code></td><td>Show or hide POI icons and text.</td><td>Android and iOS SDK <code>v11.0.0</code> and GL-JS <code>v3.0.0</code></td></tr><tr><td><code>showRoadLabels</code></td><td><code>Boolean</code></td><td>Show or hide road labels, including road shields.</td><td>Android and iOS SDK <code>v11.0.0</code> and GL-JS <code>v3.0.0</code></td></tr><tr><td><code>showTransitLabels</code></td><td><code>Boolean</code></td><td>Show or hide transit icons and text.</td><td>Android and iOS SDK <code>v11.0.0</code> and GL-JS <code>v3.0.0</code></td></tr><tr><td><code>show3dObjects</code></td><td><code>Boolean</code></td><td>Show or hide all 3D objects (3D buildings, landmarks, trees, etc.) including shadows, ambient occlusion, and flood lights.</td><td>Android and iOS SDK <code>v11.5.2</code> and GL-JS <code>v3.5.2</code></td></tr><tr><td><code>show3dBuildings</code></td><td><code>Boolean</code></td><td>Show or hide 3D buildings.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>show3dTrees</code></td><td><code>Boolean</code></td><td>Show or hide 3D trees.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>show3dLandmarks</code></td><td><code>Boolean</code></td><td>Show or hide 3D landmark buildings.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>show3dFacades</code></td><td><code>Boolean</code></td><td>Show or hide 3D building facades.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>showLandmarkIcons</code></td><td><code>Boolean</code></td><td>Show or hide landmark icons.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>showLandmarkIconLabels</code></td><td><code>Boolean</code></td><td>Show or hide landmark icon labels.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>showAdminBoundaries</code></td><td><code>Boolean</code></td><td>Show or hide administrative boundaries.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>showIndoor</code></td><td><code>Boolean</code></td><td>Show or hide indoor mapped areas.</td><td>Android and iOS SDK <code>v11.19.0</code> and GL-JS <code>v3.21.0</code></td></tr><tr><td><code>showIndoorLabels</code></td><td><code>Boolean</code></td><td>Show or hide labels and POIs in indoor mapped areas.</td><td>Android and iOS SDK <code>v11.19.0</code> and GL-JS <code>v3.21.0</code></td></tr><tr><td><code>theme</code></td><td><code>String</code></td><td>Switches between 4 themes: <code>default</code>, <code>faded</code>, <code>monochrome</code> &amp; <code>custom</code>.</td><td>Android and iOS SDK <code>v11.5.2</code> and GL-JS <code>v3.5.2</code></td></tr><tr><td><code>theme-data</code></td><td><code>String</code></td><td>LUT image encoded in Base64 to create a custom color theme.</td><td>Android and iOS SDK <code>v11.9.0</code> and GL-JS <code>v3.9.0</code></td></tr><tr><td><code>lightPreset</code></td><td><code>String</code></td><td>Switches between 4 time-of-day states: <code>dusk</code>, <code>dawn</code>, <code>day</code>, and <code>night</code>.<br>Lights can also be fully customized beyond the presets using the <a href="https://docs.mapbox.com/style-spec/reference/">Mapbox style specification</a>.</td><td>Android and iOS SDK <code>v11.0.0</code> and GL-JS <code>v3.0.0</code></td></tr><tr><td><code>font</code></td><td><code>String</code></td><td>Defines font family for the style, including any custom font uploaded to your account. Mapbox Standard will fallback to a default font if a custom font family doesn't include necessary weights (weights used by the basemap: <code>Bold</code>, <code>Medium</code>, <code>Regular</code>, <code>Italic</code>). We recommend the following default Mapbox fonts: <code>Alegreya</code>, <code>Alegreya SC</code>, <code>Asap</code>, <code>Barlow</code>, <code>DIN Pro</code>, <code>EB Garamond</code>, <code>Faustina</code>, <code>Frank Ruhl Libre</code>, <code>Heebo</code>, <code>Inter</code>, <code>League Mono</code>, <code>Montserrat</code>, <code>Poppins</code>, <code>Raleway</code>, <code>Roboto</code>, <code>Roboto Mono</code>, <code>Rubik</code>, <code>Source Code Pro</code>, <code>Spectral</code>, <code>Ubuntu</code>, <code>Noto Sans CJK JP</code>, <code>Open Sans</code>, <code>Manrope</code>, <code>Source Sans Pro</code>, <code>Lato</code>.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.14.0</code></td></tr><tr><td><code>colorModePointOfInterestLabels</code></td><td><code>String</code></td><td>Switches between <code>default</code> and <code>single</code> color modes for POI labels.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>backgroundPointOfInterestLabels</code></td><td><code>String</code></td><td>Switches between <code>circle</code> and <code>none</code> for the background of POI labels.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>densityPointOfInterestLabels</code></td><td><code>Number</code></td><td>Set the density of POI labels between <code>1</code> and <code>5</code>, default set to <code>3</code>.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>fuelingStationModePointOfInterestLabels</code></td><td><code>String</code></td><td>Control the visibility of fuel and electric charging station POI labels. Default displays both types.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.14.0</code></td></tr><tr><td><code>colorPlaceLabels</code></td><td><code>Color</code></td><td>Color override for place labels.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>colorRoadLabels</code></td><td><code>Color</code></td><td>Color override for road labels.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>colorCommercial</code></td><td><code>Color</code></td><td>Color override for commercial zones.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>colorEducation</code></td><td><code>Color</code></td><td>Color override for schools and universities.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>colorMedical</code></td><td><code>Color</code></td><td>Color override for hospitals.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>colorIndustrial</code></td><td><code>Color</code></td><td>Color override for industrial zones and airports.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>colorGreenspace</code></td><td><code>Color</code></td><td>Color override for greenspaces such as forests, parks, and woods.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>colorWater</code></td><td><code>Color</code></td><td>Color override for water.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>colorLand</code></td><td><code>Color</code></td><td>Color override for land.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>colorAdminBoundaries</code></td><td><code>Color</code></td><td>Color override for administrative boundaries.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>colorPointOfInterestLabels</code></td><td><code>Color</code></td><td>Color override for POI labels with a single color.</td><td>Android and iOS SDK <code>v11.11.0</code> and GL-JS <code>v3.11.1</code></td></tr><tr><td><code>colorMotorways</code></td><td><code>Color</code></td><td>Color override for motorways.</td><td>Android and iOS SDK <code>v11.9.0</code> and GL-JS <code>v3.9.0</code></td></tr><tr><td><code>colorTrunks</code></td><td><code>Color</code></td><td>Color override for trunk roads.</td><td>Android and iOS SDK <code>v11.9.0</code> and GL-JS <code>v3.9.0</code></td></tr><tr><td><code>colorRoads</code></td><td><code>Color</code></td><td>Color override for other roads.</td><td>Android and iOS SDK <code>v11.9.0</code> and GL-JS <code>v3.9.0</code></td></tr><tr><td><code>colorBuildings</code></td><td><code>Color</code></td><td>Color override for 2D and 3D buildings.</td><td>Android and iOS SDK <code>v11.17.0</code> and GL-JS <code>v3.17.0</code></td></tr><tr><td><code>colorBuildingHighlight</code></td><td><code>Color</code></td><td>Building color used when setting highlight feature-state.</td><td>Android and iOS SDK <code>v11.10.0</code> and GL-JS <code>v3.10.0</code></td></tr><tr><td><code>colorBuildingSelect</code></td><td><code>Color</code></td><td>Building color used when setting select feature-state.</td><td>Android and iOS SDK <code>v11.10.0</code> and GL-JS <code>v3.10.0</code></td></tr><tr><td><code>colorPlaceLabelHighlight</code></td><td><code>Color</code></td><td>Place label color used when setting highlight feature-state.</td><td>Android and iOS SDK <code>v11.9.0</code> and GL-JS <code>v3.9.0</code></td></tr><tr><td><code>colorPlaceLabelSelect</code></td><td><code>Color</code></td><td>Place label color used when setting select feature-state.</td><td>Android and iOS SDK <code>v11.9.0</code> and GL-JS <code>v3.9.0</code></td></tr><tr><td><code>colorIndoorLabelSelect</code></td><td><code>Color</code></td><td>Indoor building label color used when setting select feature-state.</td><td>Android and iOS SDK <code>v11.19.0</code> and GL-JS <code>v3.21.0</code></td></tr><tr><td><code>colorIndoorLabelHighlight</code></td><td><code>Color</code></td><td>Indoor building label color used when setting highlight feature-state.</td><td>Android and iOS SDK <code>v11.19.0</code> and GL-JS <code>v3.21.0</code></td></tr></tbody></table>

## Featuresets

Mapbox Standard includes several predefined `featuresets` that can be used to quickly configure the style for specific use cases. Featuresets are a collection of configuration properties that can be applied to the style all at once. The following featuresets are available:

You can use Interactions to retrieve basemap attributes and interact with individual features in POI Label, Place Label and building layers in the basemap.

Featuresets describe a collection of layers that can be interacted with in the Standard style, by setting `feature-states` to change their appearance when interacted with, or to query feature attributes. The following interactions have been added:

---

### Points of Interest

The `poi` featureset contains all the point of interest layers in the Mapbox Standard style. This featureset is useful for applications that want to display additional information about points of interest on the map, or to highlight points of interest when a user interacts with them.

#### Feature State

| Property | Type | Description |
| --- | --- | --- |
| `hide` | `Boolean` | when `true` hides the icon and text. Use this state when displaying a custom annotation in place of the hidden symbol. |

#### Feature Properties

Available for all features in the `poi` featureset:

| Property | Description |
| --- | --- |
| `name` | Name of the point of interest. |
| `class` | A broad point of interest category, for example 'food_and_drink'. |
| `maki` | An icon identifier, designed to assign icons using the Maki icon project or other icons that follow the same naming scheme. |
| `group` | A high-level point of interest category like airport, transit, etc. |

Available for features with `group = transit`:

| Property | Description |
| --- | --- |
| `transit_mode` | Mode of transport served by a stop/station. |
| `transit_stop_type` | A type of transit stop. |
| `transit_network` | A rail station network identifier that is part of specific local or regional transit systems. |

Available for features with `group = airport`:

| Property | Description |
| --- | --- |
| `airport_ref` | A short identifier code of the airport. |

Available for features with `group = natural-point`:

| Property | Description |
| --- | --- |
| `name` | Name of the natural feature. |
| `class` | A broad category of the natural feature. |
| `maki` | An icon identifier for the natural feature. |

### Place Labels

The `place-labels` featureset contains all the place label layers in the Mapbox Standard style. This featureset is useful for applications that want to display additional information about places on the map, or to highlight places when a user interacts with them.

#### Feature State

| Property | Type | Description |
| --- | --- | --- |
| `hide` | `Boolean` | When `true`, hides the label. Use this state when displaying a custom annotation in place of the hidden symbol. |
| `highlight` | `Boolean` | When `true`, the feature is highlighted. Use this state to create a temporary effect (e.g., hover). |
| `select` | `Boolean` | When `true`, the feature is selected. Use this state to create an effect that persists until another state is selected. **Note:** The `select` state has a higher priority than `highlight`. |

#### Feature Properties

Each feature in the `place-labels` featureset has the following properties:

| Property | Description |
| --- | --- |
| `name` | Name of the place label |
| `class` | Provides a broad distinction between place types. |

You can see `select` & `highlight` in action in this [demo page](https://labs.mapbox.com/map-design-demos/ime/index.html).

### Buildings

The `buildings` featureset contains all the building layers in the Mapbox Standard style. This featureset is useful for applications that want to highlight or interact with individual buildings on the map.

#### Feature State

| Property | Type | Description |
| --- | --- | --- |
| `highlight` | `Boolean` | When `true`, the building is highlighted. Use this state to create a temporary effect (e.g., hover). |
| `select` | `Boolean` | When `true`, the building is selected. Use this state to create an effect that persists until another state is selected. **Note:** The `select` state has a higher priority than `highlight`. |

#### Feature Properties

Each feature in the `buildings` featureset has the following properties:

| Property | Description |
| --- | --- |
| `group` | A high-level building group, either `building-2d` or `building-3d`. |
| `height` | The height in meters of a building or building part (rounded to the nearest integer). |
| `min_height` | The height in meters from the ground to the bottom of a building part, for cases where the bottom of the part is not on the ground. |

### Landmark Icons

The `landmark-icons` featureset contains all the icons and labels that highlight our 3D landmark buildings.

#### Feature Properties

Each feature in the `landmark-icons` featureset has the following properties:

| Property | Description |
| --- | --- |
| `id` | Unique landmark ID. |
| `name` | Name of the landmark in local language. |
| `name_en` | Name of the landmark in English. |
| `short_name` | Short name of the landmark in local language. |
| `short_name_en` | Short name of the landmark in English. |
| `type` | Landmark type or building use. |

### Indoor Labels

The `indoor-labels` featureset contains all the icons and labels that appear in indoor mapped areas. The building labels (names of terminals, parking lots, etc.) have the following feature states:

#### Feature State

| Property | Type | Description |
| --- | --- | --- |
| `highlight` | `Boolean` | When `true`, the feature is highlighted. Use this state to create a temporary effect (e.g., hover). |
| `select` | `Boolean` | When `true`, the feature is selected. Use this state to create an effect that persists until another state is selected. **Note:** The `select` state has a higher priority than `highlight`. |

#### Feature Properties

Each feature in the `indoor-labels` featureset has the following properties:

| Property | Description |
| --- | --- |
| `name` | Name of the point of interest. |
| `shape_type` | A description of the room or area type. |
| `class` | A high-level category, like restaurant, retail, etc. |
| `type` | A sub-category, like cafe, newsstand, etc. |

## Slots

Mapbox Standard includes three [slot layers](https://docs.mapbox.com/style-spec/reference/layers/#slot) to help you control where custom layers will appear relative to other layers in the style. The following slots are available:

| Slot | Description |
| --- | --- |
| `bottom` | Above polygons (land, landuse, water, etc.) |
| `middle` | Above lines (roads, etc.) and behind 3D buildings |
| `top` | Above POI labels and behind Place and Transit labels |
| not specified | Above all existing layers in the style when not using the globe projection. Below labels when using the globe projection. Learn more about projections in the [Mapbox Style Spec reference](https://docs.mapbox.com/style-spec/reference/projection/). |