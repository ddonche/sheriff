# Uploaded PNG Icons

Open **Desk → Icons → Upload PNG**, choose a PNG, and give it an icon name. The name defaults to the filename with lowercase letters and hyphens. Uploads are saved to the selected portal's `public/icons` folder, with a 1 MB limit and no silent replacement of existing icons.

Use the same syntax in articles, navigation labels, patterns, and admonition titles:

```text
[[icon|everwind-emblem]]
[[icon|everwind-emblem||18]]
```

PNG icons retain their original colors and transparency. Their color field is ignored; the pickers disable color controls when a PNG is selected. Sizes remain optional, from 8 to 256 pixels.

Uploaded icons appear immediately in the Icons panel and the content/navigation **Insert icon** picker. Uploading saves the source asset; building a page publishes the referenced icon through the regular render schedule. **Build portal** updates all pages.

To use a PNG as a default admonition icon, put its name in the portal theme's `admonition_icons` map, exactly like an SVG icon.

Manually managed portal icons resolve in this order: portal SVG, portal PNG, then Core SVG. The upload form asks for a unique name so that uploading does not silently change an existing icon.
