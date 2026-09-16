> For the complete documentation index, see [llms.txt](https://docs.mapbox.com/style-spec/llms.txt)

# Mapbox Style Specification

Current version:`v14.30.0`  
  

[Contribute on GitHub](https://github.com/mapbox/mapbox-gl-js/tree/main/src/style-spec)

A Mapbox [style](https://docs.mapbox.com/help/glossary/style/) is a document that defines the visual appearance of a map: what data to draw, the order to draw it in, and how to style the data when drawing it. A style document is a [JSON](http://www.json.org/) object with specific root level and nested properties. This specification defines and describes these properties.

The intended audience of this specification includes:

-   Advanced designers and cartographers who want to write styles by hand rather than use [Mapbox Studio](https://console.mapbox.com/studio/).
    
-   Developers using style-related features of [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/api/), the [Mapbox Maps SDK for Android](https://docs.mapbox.com/android/maps/guides/), or the [Mapbox Maps SDK for iOS](https://docs.mapbox.com/ios/maps/overview/).
    
-   Authors of software that generates or processes Mapbox styles.
    

Explore the Style Spec Reference to find details about each property, including its type, default value, and a description of how the property works.

[

Explore the Style Spec Reference

](https://docs.mapbox.com/style-spec/reference)

## Style document structure

A Mapbox style consists of a set of [root properties](https://docs.mapbox.com/style-spec/reference/root/), some of which describe a single global property, and some of which contain nested properties. Some root properties, like [`version`](https://docs.mapbox.com/style-spec/reference/root#version), [`name`](https://docs.mapbox.com/style-spec/reference/root#name), and [`metadata`](https://docs.mapbox.com/style-spec/reference/root#metadata), don't have any influence over the appearance or behavior of your map, but provide important descriptive information related to your map. Others, like [`layers`](https://docs.mapbox.com/style-spec/reference/layers/) and [`sources`](https://docs.mapbox.com/style-spec/reference/sources/), are critical and determine which map features will appear on your map and what they will look like. Some properties, like [`center`](https://docs.mapbox.com/style-spec/reference/root#center), [`zoom`](https://docs.mapbox.com/style-spec/reference/root#zoom), [`pitch`](https://docs.mapbox.com/style-spec/reference/root#pitch), and [`bearing`](https://docs.mapbox.com/style-spec/reference/root#bearing), provide the map renderer with a set of defaults to be used when initially displaying the map.

The snippet below shows an example style JSON, including the basic structure and some of the most common properties. See the [Root](https://docs.mapbox.com/style-spec/reference/root/) section of the spec reference for the full list of root properties.

```json
{
  "name": "some-style",
  "version": 8,

  // default camera position
  "center": [ -74, 40.73 ],
  "zoom": 11.3,
  "bearing": 20.8,
  "pitch": 17.5,

  // sprites and fonts
  "sprite": "mapbox://sprites/mapbox/light-v11",
  "glyphs": "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",

  // spatial data to include, used one-to-many with layers
  "sources": {
    "some-vector-source": {
      "type": "vector",
      "url": "mapbox://mapbox.mapbox-streets-v8"
    },
    "some-raster-source": {
      "type": "raster",
      "url": "mapbox://mapbox.satellite",
      "tileSize": 256
    },
    "some-geojson-source": {
      "type": "geojson",
      "data": "https://path-to-geojson-data"
    },
  },
  // layers define rendering the map, in order; used many-to-one with sources
  "layers": [
    {
      "id": "some-layer",
      "type": "fill",
      "source": "some-vector-source",
      "source-layer": "some-source-layer",
      "layout": {
        "visibility": "visible"
      },
      "paint": {
        "fill-color": "#888888",
        "fill-opacity": 0.5
      }
    },
    {
      "id": "another-layer",
      "type": "circle",
      "source": "some-geojson-source",
      "paint": {
        "circle-radius": 10,
        "circle-color": "#FF0000"
      }
    },
    {
      "id": "some-raster-layer",
      "type": "raster",
      "source": "some-raster-source",
      "minzoom": 0,
      "maxzoom": 22,
      "paint": {
        "raster-opacity": 0.5
      }
    }
  ]
}

```

## How styles are used

Styles are used to add digital maps to web and mobile applications using Mapbox's map SDKs and libraries. The renderer reads the style document and uses it to determine which data to fetch from the specified sources and how to display it on the map.

Mapbox's renderers are all compliant with the Mapbox Style Specification, which means that they can all read and interpret the same style documents. This allows developers to create a single style document that can be used across multiple platforms and devices.

Mapbox's map rendering SDKs and libraries include:

-   [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/): A JavaScript library for building interactive, customizable maps on the web.
-   [Mapbox Maps SDK for Android](https://docs.mapbox.com/android/maps/): An SDK for building interactive, customizable maps in Android applications.
-   [Mapbox Maps SDK for iOS](https://docs.mapbox.com/ios/maps/): An SDK for building interactive, customizable maps in iOS applications.

Once a style is loaded, its structure remains the same and can be modified at runtime. For example, developers can programmatically add additional sources and layers to the original style, change the fog or lighting, toggle the visibility of layers, etc. The renderer will automatically update the map display to reflect any changes made to the style at runtime.

## Creating a style

A Mapbox style can be created in several ways:

-   **Using Mapbox Studio**: [Mapbox Studio](https://console.mapbox.com/studio/) is the easiest way to create a style, as it provides a user-friendly graphical interface. Mapbox Studio also includes a library of pre-built styles that you can use as a starting point for your own custom designs. Styles saved in Mapbox Studio are hosted by Mapbox for use in your applications, but can also be exported to style JSON files.
    
-   **Programmatically**: You can create a style document programmatically, using a programming language like JavaScript or Python. This is a good option if you want to generate styles dynamically or automate the style creation process.
    
-   **By hand**: You can create a style document by hand, using a text editor or IDE. This is the most flexible way to create a style, but it requires a good understanding of the style specification and JSON syntax.
    

## Storing and referencing a style

There are several ways to store and reference a style document for use in your application, depending on your needs and preferences:

### Via the Styles API (via Mapbox Studio)

You can store a style document in Mapbox's cloud infrastructure and reference it using the [Styles API](https://docs.mapbox.com/api/maps/styles/). This is a good option if you want to use Mapbox's hosting and caching infrastructure to serve your styles, or if you want to use Mapbox Studio to create and manage your styles. Styles created in Mapbox Studio are automatically hosted by Mapbox and can be referenced using their unique style ID via the Styles API. You can also use the Styles API independently of Mapbox Studio to create, update, and delete styles.

### As a JSON file or string in your codebase

You can store a style document as a JSON file or string variable in your web or mobile app's codebase. This is a good option if you want to version control your styles and keep them organized in your project.

### As a JSON file in a remote location

You can store a style document as a JSON file in a remote location, such as a web server, S3 bucket, or a CDN. This is a good option if you want to share a style document with others or use it in multiple applications.

Mapbox's renderers can load styles from any publicly accessible URL, so you can host your style documents anywhere you like.

## Modifying a style at runtime

Once a style is loaded, its structure remains the same and can be modified at runtime. Developers can programmatically add additional sources and layers to the original style, change the fog or lighting, toggle the visibility of layers, etc. The renderer will automatically update the map display to reflect any changes made to the style at runtime.

See the **Map Styles** guide for each renderer for more details about using styles in your application and how to update a style at runtime:

-   [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/styles/)
-   [Mapbox Maps SDK for Android](https://docs.mapbox.com/android/maps/guides/styles/)
-   [Mapbox Maps SDK for iOS](https://docs.mapbox.com/ios/maps/guides/styles/)

## Developer Resources

You can use the [`@mapbox/mapbox-gl-style-spec`](https://www.npmjs.com/package/@mapbox/mapbox-gl-style-spec) npm package to access the style specification in a JavaScript environment. This package includes TypeScript definitions for the style specification, as well as a [JSON schema](https://json-schema.org/) that can be used to validate style documents.

It also includes command line tools such as `gl-style-validate` which can be used to validate style JSON documents against the specification. You can run the command line tools on any platform that supports Node.js.

```bash
$ gl-style-validate path/to/style.json
```