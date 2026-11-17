# Map design and address lookup

Alpha 0.7 adds an approximate geographic design workspace while preserving the original roof-plane editor and all saved rectangular designs. Maps and traces support preliminary design, not a surveyed site plan, imagery-rights determination or engineering certification.

## Working through a site

- **Enable the map**: open a project, choose Map design and explicitly enable third-party maps. The default sourced street style comes from OpenFreeMap using MapLibre, with its attribution visible ([OpenFreeMap integration guide](https://openfreemap.org/quick_start/)).
- **Find an address**: enter an address, postcode or named place, consent to sending only that text to the displayed provider and press Search UK locations. Choose a named result to focus the map and, for a designer, update the project pin. The optional checkbox also applies the result's address/postcode; it is off by default.
- **Set coordinates**: expand manual coordinates and enter latitude/longitude, or return to the saved site pin. The supported working extent is longitude −9 to 2.5 and latitude 49 to 61.5; this is a UI/data bound, not a jurisdiction check.
- **Trace a roof**: select Trace roof, choose a new face or an empty unmapped face and set an assumed pitch. Start along the upper/ridge edge and proceed clockwise with the downslope direction on the right of the first edge. Click 3–32 vertices, do not repeat the first point, then Finish roof. Undo vertex and Cancel are available.
- **Check assumptions**: 0° treats the outline as a plan plane; non-zero pitch converts horizontal downslope distances to roof-plane lengths. Dimensions and azimuth are estimates derived from the chosen points and pitch, not measured or independently inferred.
- **Design the array**: choose a mapped face, orientation and clearance. Place module/obstruction centres by clicking the map, or auto-fill the actual polygon. Select a drawn object or use the Selection dropdown, move to a new centre, enter roof-plane coordinates, rotate or remove. Replacing existing modules via auto-fill needs a second explicit click; check stale string assignments afterward.
- **Save and export**: Save revision retains the pin, polygon, georeference and modules. Documents exports GeoJSON of mapped roofs/modules/obstructions/site pin, plus roof-plane SVG/DXF and frozen preliminary A3 technical packs. None includes map imagery.

Pan/zoom and search are available to viewing roles, but only designer/admin roles can change saved design data. Old roofs are not silently moved to a searched address; changing the site pin never translates an existing drawing. Unmapped roofs remain fully available in Roof design.

## Geometry and compatibility

`design.mapLocation`, `roof.boundary` and `roof.geo` are optional/nullable JSON fields. They have no defaults in legacy designs; no database column migration or rewrite is needed. Saves from an older client preserve omitted fields by roof ID; explicit null clears them, whereas restoring a historical revision restores its exact historical geometry.

Mapping uses a spherical small-area approximation about a local origin and a first-edge bearing. Dimensions are limited to 2–80 m width and 2–60 m on-slope length per face, with ten faces and existing 150-module/50-kWp design caps. Large or complex buildings must be split and externally verified; this is not a projected CRS or a measured 3D roof reconstruction.

Placement checks require complete rectangular modules inside the simple roof polygon and the requested distance from every boundary segment. Concave notches cannot be bridged merely because four corners fit. Module spacing and obstruction checks still apply; imported mounting rails and points outside the polygon are findings. No fire-access, wind-zone, structural or regulatory setback is selected automatically.

Changing mapped width/height/pitch/azimuth outside the mapped UI produces a stale-map error. Roof design locks those inputs until the map reference is explicitly unlinked; the polygon/modules remain when unlinked. A separate, confirmed conversion removes the polygon/reference and uses rectangular bounds; undo restores it. Added cloned roofs do not inherit a location.

Engineering bindings include roof polygon/reference data and a present site pin. Old designs without those fields retain the original engineering hash envelope, and pricing-only edits remain independent. Mapped technical issues use `technical-review-v2`; old v1 issue snapshots/templates are not rewritten. All packs remain not for installation.

## Providers, privacy and operations

Keep the 0.7+ backend when supporting older client bundles: preservation of omitted map fields is implemented there. Older server releases cannot interpret these extensions and can strip them on save; take and verify a runtime backup before any server rollback, and do not edit mapped projects using a pre-0.7 server.

The default address service is the public Photon pilot; its documentation permits reasonable usage, may throttle/ban abusive use, and offers no availability guarantee ([Photon service documentation](https://github.com/komoot/photon)). For a multi-user production deployment, operate a suitable Photon instance or arrange a service with explicit capacity and privacy terms.

Search is never autocomplete. The backend requires `consent: true`, a 3–180-character manually submitted query, and UK country/bounding-box constraints. It normalises at most five result records, restricts streamed responses to 256 kB, aborts after nine seconds, refuses redirects, rate-limits actors to 20 calls/minute, permits at most one uncached upstream request every 1.2 seconds per running process, and holds at most 200 successful queries for 15 minutes in RAM.

Query text is not added to application access logs or audit events. The RAM cache contains query text; the chosen location/label is intentionally saved in project revisions/exports if a designer selects it. Operators and external providers may process IPs, viewed areas and their own access logs; this feature does not claim to implement retention/consent governance for an installer.

Public Nominatim is not used, and the app does not use the referer-sensitive public OSM raster tile endpoint or borrow unauthorised commercial imagery. Provider availability and map accuracy remain external dependencies.

## Self-hosted configuration

| Native environment | Compose/helper configuration | Default |
|---|---|---|
| `MAPS_ENABLED` | `SOLAR_MAPS_ENABLED` | `true` |
| `ADDRESS_SEARCH_ENABLED` | `SOLAR_ADDRESS_SEARCH_ENABLED` | `true` |
| `MAP_STYLE_URL` | `SOLAR_MAP_STYLE_URL` | `https://tiles.openfreemap.org/styles/liberty` |
| `PHOTON_URL` | `SOLAR_PHOTON_URL` | `https://photon.komoot.io/api/` |
| `MAPTILER_API_KEY` | `SOLAR_MAPTILER_API_KEY` | unset, satellite disabled |

For native deployment, set variables privately in the process supervisor. For the Linux helper, optional `SOLAR_*` rows can be added to the existing protected `.env.selfhost`; retain its 0600 permissions and existing Compose identity. Run `bash script/self-host.sh check`, then `bash script/self-host.sh up` to apply. Never paste credentials into chat, source control, a browser query box or public files.

Provider URLs must use HTTPS without embedded username/password or fragments; style URLs are intentionally public browser configuration. A custom style is responsible for its own sourced geography, compatible glyph/sprite/tile URLs, CORS and attribution. To be fully offline, self-host every map dependency and Photon; changing the main style URL alone does not remove that style's external URLs. Disabling maps/search makes those application functions unavailable without removing saved geometry.

## Optional satellite layer

The app includes an opt-in MapTiler satellite-v4 adapter using the operator's own authorised key and licence. MapTiler documents both the required API key and the TileJSON metadata endpoint; metadata supplies supported zooms and credits rather than this app inventing coverage or resolution ([MapTiler Tiles API](https://docs.maptiler.com/cloud/api/tiles/)).

The key stays server-side. Scoped/authenticated routes proxy bounded metadata/raster requests only to the fixed provider, validate integer XYZ bounds and raster MIME types, and do not return or log credential-bearing upstream exceptions. The app retains provider credits and does not provide bulk imagery download or imagery in exported plans.

No live licensed satellite key was available during this release's verification. The no-key disabled state and mocked adapter paths can be tested, but real aerial coverage, zoom quality, provider restrictions, billing, proxy permissions and attribution requirements must be verified against the operator's plan before enabling it. Server-side proxying is not a licence exemption or proof of high-resolution roof imagery.
