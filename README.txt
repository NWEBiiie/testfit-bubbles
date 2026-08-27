TESTFIT BUBBLES

Double-click index.html to run the tool locally. No installation or internet
connection is needed.

PROJECT FILES
Save project downloads a readable .testfit.json text file. It contains all
spaces, programmed areas, positions, colors, area weights, room shapes, fixed
locations, coordinates, relationships, boundaries, voids, annotations, visual
styles, physics controls, and view settings. Open project reads that file and
reconstructs the editable setup.

LEFT SIDEBAR AND SELECTED AREA
The left sidebar is divided into three working zones: a compact Create area
form, a height-limited scrolling list of all areas, and a larger scrolling
property panel for the selected area. Select a space in the list or diagram. The
Selected area properties panel
can edit its name and programmed area, then change its geometry to a circle,
filleted rectangle, filleted L-shape, or a custom hand-sketched outline. A space
can use Automatic boundary selection or be assigned to a specific outer boundary.

Fix location pins the space so physics cannot move it. Double-clicking the
space is a shortcut. A revealed fixed anchor displays its X and Y coordinates.
Entering either coordinate also fixes the space at the edited location.

BOUNDARIES AND VOIDS
Choose Outer boundary or Void / exclusion, then add a rectangle, freehand
shape, or click-by-click polyline. Repeat this process to create any number of
boundaries. Each boundary has its own color and visibility control. Delete only
the individual boundary you no longer need.

Use SVG file as boundary reads closed paths, rectangles, circles, ellipses,
polygons, and polylines from a local SVG and fits them into the diagram. Choose
Outer boundary or Void / exclusion before importing. Nested SVG outlines are
automatically interpreted as voids when importing outer boundaries.

Outer boundaries contain assigned or nearby spaces. Voids repel spaces and
create holes or exclusion zones. Keep spaces inside and Inside margin control
the physical constraint behavior.

ANNOTATIONS AND RELATIONSHIPS
Draw arrow on top creates arrow-headed annotation lines above all boundaries,
connections, and spaces. Click once to establish the start, move the pointer to
preview the arrow, and click again to establish the end. Annotation shafts stop
at the base of the arrow head instead of running through it. Arrows may be
single- or double-headed. The scrollable Drawn annotations list can edit each
arrow's color, weight, solid/dashed/dotted line, head style, and number of arrow
heads independently. Annotations never participate in physics.

Link / unlink two areas starts with no preselected area, regardless of what was
edited previously. The first area clicked after activation becomes the first
choice; a two-step indicator and canvas highlight then wait for the second.
Choose an existing pair to unlink it.

INDEPENDENT APPEARANCE
Click a space to reveal every setting related to that space together in the
Selected space panel: color, geometry, fill, outline, parallel hatch or dots,
hand-drawn wobble, and misregistered color outlines. These controls modify only
the currently selected area. Open sketch lines retain randomized gap positions
and offsets.

FOAM, MOVEMENT, AND RELATIONSHIP PULL
Each selected area has its own foam participation, fluidity, area protection,
separation, and mobility controls. Area protection from 0.00 to 1.00 controls
how strongly it tries to preserve its programmed area. Effective area is shown
when an area cannot recover all of its programmed area.

The Selected area's links list in the right sidebar shows every relationship and
gives each one independent pull, line style, line width, color, and unlink
controls. Set pull to 0% for no attraction without deleting the visible line.
The controls above that list apply only as defaults when a new relationship is
created.

Only spaces connected by an explicit relationship line attract one another.
Unconnected spaces have no shared-center gravity and remain where placed unless
they overlap, encounter a boundary, or are moved by the user.

OUTPUT
Export PNG produces a raster image. Export SVG produces an editable, crisp
vector version of boundaries, relationships, rooms, labels, fixed anchors, and
annotations. Print opens the browser's print dialog with the tool panels hidden.

ZOOM
The persistent zoom control is overlaid at the lower-right corner of the drawing,
similar to a map control. Use its slider, plus/minus buttons, 100% reset, or the
mouse wheel without leaving the drawing area. The drawing fits the visible window
so the overlay does not require scrolling. Drag any empty part of the canvas to
pan around the diagram.

This is an early test-fit concept tool. It does not verify code, circulation,
accessibility, structure, exact dimensions, or construction feasibility.
