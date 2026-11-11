# PNG Icons Documentation Addition

## Upload Your Own PNG Icons

Open **Desk → Icons → Upload PNG**, select a PNG, and choose an icon name. Desk suggests a lowercase name based on the filename. PNG uploads can be up to **1 MB**.

Uploaded icons appear immediately in the Icons panel and the **Insert icon** pickers in Content and Navigation. Use their names with the same syntax:

```md
[[icon|everwind-emblem]]
[[icon|everwind-emblem||18]]
```

PNGs keep their original colors and transparency. The color field is ignored for PNGs, and the pickers disable color controls. The optional size still works normally.

PNG icons also work inside patterns:

```md
::: pattern vertical Faction
@mode = template
name = Outriders
emblem = [[icon|everwind-emblem||32]]
:::
```

You can also use them in admonition titles or configure them as default admonition icons in your portal's theme.

Uploads are saved under the selected portal's `public/icons` folder. Uploading does not build the site. **Build** publishes the selected page and its referenced icons; **Build portal** updates the entire portal.

## Icon Names and Collisions

Desk's upload form requires a name that is not already in the selected portal's combined icon library, including Core/Lucide icons. It asks you to choose another name rather than silently replacing an existing icon. Different portals can reuse the same name.

If you manually add icon files, Sheriff resolves a name in this order:

1. The portal's SVG: `public/icons/name.svg`.
2. The portal's PNG: `public/icons/name.png`.
3. The Core/Lucide SVG.

A manually installed portal icon can therefore override a Core icon. If both SVG and PNG files have the same name in the portal, the SVG wins.

Names such as `everwind-emblem` or `everwind-outrider` help avoid collisions. Write the name without the file extension in icon syntax.
