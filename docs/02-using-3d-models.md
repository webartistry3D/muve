> For the complete documentation index, see [llms.txt](https://docs.mapbox.com/style-spec/llms.txt)

# Using 3D Models

This guide details feature support for static 3D model rendering in Mapbox GL JS and the Mapbox Maps SDK for iOS and Android.

Models are added to a style using a [model](https://docs.mapbox.com/style-spec/reference/layers/#model) layer. The model layer can be used with several sources, serving different use cases from individual models to instanced models.

Model support is based on the [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) format.

## Supported glTF features

Import models in glTF format using these extensions:

| Extension | Description |
| --- | --- |
| `.gltf` (JSON) | Scene description in JSON format. Binary data is stored in a supplementary `.bin` file. Textures can be embedded in the bin file or stored as separate `.png` or `.jpg` files and referenced by URL. |
| `.glb` (binary) | Self-contained scene with model geometry and textures embedded in the binary. |

**Geometry**

-   Triangle meshes with vertex attributes (position, normal, texture coordinates)
-   Mesh compression: `KHR_draco_mesh_compression` and `EXT_meshopt_compression`

**Material**

-   Physically-based rendering (PBR) using the [metallic roughness material](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#metallic-roughness-material) model
-   Base color, normal, metallic-roughness, and occlusion texture maps
-   Opaque, alpha-blended, and alpha-masked materials

### Limitations

**Geometry and scene**

-   Geometry limited to 65,536 vertices per mesh (16-bit indices)
-   No support for glTF scene definitions such as cameras, lights, or multiple scenes per glTF file

**Animation**

-   No support for glTF animations (key frame animations, skinning, or morph targets)
-   Model parts and materials can be animated using [model node and material overrides](#node-material-overrides)

**Material**

-   Texture format extensions such as WebP ([`EXT_texture_webp`](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_texture_webp)) are not supported
-   Only the metallic-roughness material model is supported

For full glTF support including animations, use [custom layers with Three.js](https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model/).

## Style-based customization

Customize and animate the orientation and materials of model sub-parts using style-driven overrides. Apply overrides directly to a model source or in paint properties.

-   Create material variations for multiple instances of the same model
-   Animate doors or wheels of a car model
-   Animate plane propellers or wind turbine rotors

### Model source overrides

Specify material and node orientation overrides directly in the model source [`models`](https://docs.mapbox.com/style-spec/reference/types/#modelSourceModels) property.

```json
{
  ....
  "materialOverrides": {
      "body": {
          "model-color": [1.0, 0, 0],
          "model-color-mix-intensity": 1.0
      },
      "lights_brakes": {
          "model-color": [0.88, 0.0, 0.0],
          "model-color-mix-intensity": 0.4,
          "model-emissive-strength": 0.8
      }
  },
  "nodeOverrides": {
      "doors_front-left": {
          "orientation": [0.0, -35.0, 0.0]
      },
      "trunk": {
          "orientation": [ -45, 0.0, 0.0 ]
      }
  }
  ....
}
```

### Paint property overrides with expressions

Paint properties for **material** overrides:

-   [model-color](https://docs.mapbox.com/style-spec/reference/layers/#paint-model-model-color)
-   [model-color-mix-intensity](https://docs.mapbox.com/style-spec/reference/layers/#paint-model-model-color-mix-intensity)
-   [model-emissive-strength](https://docs.mapbox.com/style-spec/reference/layers/#paint-model-model-emissive-strength)
-   [model-opacity](https://docs.mapbox.com/style-spec/reference/layers/#paint-model-model-opacity)

Paint properties for **node** overrides:

-   [model-rotation](https://docs.mapbox.com/style-spec/reference/layers/#paint-model-model-rotation)

To override node orientation or materials in paint properties, select the node and material names for override in the model source using [`nodeOverrideNames`](https://docs.mapbox.com/style-spec/reference/types/#nodeOverrideNames) and [`materialOverrideNames`](https://docs.mapbox.com/style-spec/reference/types/#materialOverrideNames).

```json
// ...
  "sources": {
    "3d-model-source": {
        "type": "model",
        "models": {
            "car": {
                "uri": "/mapbox-gl-js/assets/ego_car.glb",
                "position": [-74.0135, 40.7153],
                "orientation": [0, 0, 0],
                // List of material names to be overridden in paint properties.
                "materialOverrideNames": [
                    "body",
                    "lights_brakes",
                ],
                // List of node names to be overridden in paint properties.
                "nodeOverrideNames": [
                    "doors_front-left",
                    "doors_front-right",
                    "hood",
                    "trunk"
                ]
            }
        }
    }
 }
// ...
```

Once selected, use paint properties to override the node orientation and material properties of a model. Both constants and expressions like [feature-state](https://docs.mapbox.com/style-spec/reference/expressions/#feature-state) are supported as values.

```json
{
    "layers" : [
    {
        "id": "3d-model-layer",
        "type": "model",
        "source": "3d-model-source",
        "paint": {
            "model-scale": [10, 10, 10],
            "model-type": "location-indicator",
            // The following properties target materials, 'part' therefore is matched with material names listed in overrideMaterialNames
            "model-color": [
                "match",
                ["get", "part"],
                "lights_brakes",
                ["feature-state", "brake-light-color"],
                "rgba(225, 0, 0, 1)" // fallback
            ],
            "model-color-mix-intensity": [
                "match",
                ["get", "part"],
                "body",
                1.0,
                0.0
            ],

            // Control rotation of model and model nodes.
            // Node names listed in overrideNodeNames are matched using ["get","part"] expression.
            // Rotation value is obtained from feature state.
            "model-rotation": [
                "match",
                ["get", "part"],
                "doors_front-left",
                ["feature-state", "doors-front-left"],
                // ....
                "trunk",
                ["feature-state", "trunk"],
                [0.0, 0.0, 0.0]
            ]
        }}
    ]
}
```

### Modeling considerations

-   Sub-part rotation is applied around the node's origin. Set the pivot to the desired rotation center in your 3D modeling application.
-   Material overrides affect all sub-parts of a model using the given material. Assign different materials to sub-parts to change them independently.

#### Advanced: Bloom Geometry

Bloom geometry creates volumetric light effects without expensive rendering computations by using additive blending. Use bloom geometry to add volumetric glow around lights, such as vehicle brake lights. Control visibility and emissive factor with part-based styling.

![](https://docs.mapbox.com/assets/ideal-img/style-spec--guides-using-3d-models-bloom-geometry.16d88fe.480.png)

To mark geometry for bloom effects, add the `MAPBOX_geometry_bloom` property to a node's [`extra`](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-node) field in your glTF model. In Blender, use [custom properties](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html#custom-properties) to add this property.

![](https://docs.mapbox.com/assets/ideal-img/style-spec--guides-using-3d-models-blender-props.c458ebe.480.png)

## Model optimization

### General

**Geometry**

-   Remove geometry for parts of the model that are not visible. For example, omit a vehicle's interior and tint the windows to hide it.
-   Reduce geometric complexity wherever possible. Decimate dense meshes and merge duplicate vertices.

**Materials & Textures**

-   Use the lowest texture resolution that meets visual quality requirements.
-   Reduce materials wherever possible. Bake material properties into a single texture, or encode color variations as vertex colors.
-   Reduce transparency. Rendering transparent surfaces has a significant performance cost, so prefer opaque materials.

### Use-case specific

**Individual animated models** (such as the main navigation puck or an ego vehicle)

-   Define separate nodes only for parts that need to be animated.
-   Define dedicated materials only for materials that need to be overridden or that cannot be merged with others.
-   Geometric complexity should stay below 25.000 vertices.

**Small to medium number of instances** (such as detections)

-   Reduce geometric complexity to the minimum needed.
-   Minimize the number of distinct materials and nodes, ideally a single material and a single node.
-   Geometric complexity should stay below 15.000 vertices.

### Tooling

Use [`gltfpack`](https://www.npmjs.com/package/gltfpack) to do glTF model compression and optimization.

By default, `gltfpack` aggressively merges meshes and compresses data to reduce file size, which can remove the node hierarchy required for overrides. To achieve a "lossless" optimization while keeping materials and nodes intact, use the following flags:

```shell
$ gltfpack -i input.glb -o output.glb -kn -km -ke -noq
```

-   `-kn` Keep nodes: Preserves the node hierarchy required for node overrides.
-   `-km` Keep materials: Preserves individual materials required for material overrides.
-   `-ke` Keep extras: Preserves custom metadata, including the `MAPBOX_geometry_bloom` property.
-   `-noq` Disable quantization: Prevents coordinate quantization to keep high geometric precision.

## Resources

-   [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
-   [Model layer reference](https://docs.mapbox.com/style-spec/reference/layers#model)