const $ = selector => document.querySelector(selector);
const canvas = $("#diagram");
const ctx = canvas.getContext("2d");
const list = $("#list");
const boundaryList = $("#boundaryList");
const status = $("#status");

const COLORS = ["#24a5df", "#ea198c", "#ffe72d", "#201d1a", "#35b56a", "#f06036", "#7669b0"];
const AREA_SCALE = 2.2;
const PROFILE_SAMPLES = 96;
const DEFAULT_STYLE = { fill: "solid", outline: "open", pattern: "none", sketch: true, misregister: false };
const DEFAULT_PHYSICS = { foam: true, squeeze: .75, separation: .7, mobility: 1, weight: .5 };

let nodes = [];
let edges = [];
let boundaries = [];
let annotations = [];
let selected = null;
let linkStart = null;
let drag = null;
let pan = null;
let activeTool = null;
let boundaryDraft = null;
let freehandDraft = null;
let polylineDraft = null;
let arrowDraft = null;
let roomDraft = null;
let nextNodeId = 1;
let nextBoundaryId = 1;
let nextAnnotationId = 1;
let w = 900;
let h = 600;
let last = performance.now();
let lastAreaUpdate = 0;
let zoomLevel = 1;
let cameraX = 450;
let cameraY = 300;
let defaultStyle = { ...DEFAULT_STYLE };

const radius = area => Math.sqrt(area / Math.PI) * AREA_SCALE;
const foamAmount = node => node.foam === false ? 0 : clamp(Number(node.squeeze) || 0, 0, 1);
const foamResponseFor = node => { const s = foamAmount(node); return s * s * (3 - 2 * s); };
const selectedNode = () => nodes.find(node => node.id === selected) || null;
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function randomSketch() {
  return {
    gap: .28 + Math.random() * .58,
    angle: Math.random() * Math.PI * 2,
    ox: -6 + Math.random() * 12,
    oy: -6 + Math.random() * 12,
    ox2: -4 + Math.random() * 8,
    oy2: -4 + Math.random() * 8,
    seed: Math.random() * 1000
  };
}

function createNode(name, area, index = nodes.length) {
  const angle = index * 2.3;
  return {
    id: nextNodeId++, name, area, r: radius(area),
    x: w / 2 + Math.cos(angle) * 130, y: h / 2 + Math.sin(angle) * 120,
    vx: 0, vy: 0, pinned: false, color: COLORS[index % COLORS.length],
    ...DEFAULT_PHYSICS, effectiveArea: area, sketch: randomSketch(),
    shape: "circle", customPoints: null, boundaryId: null, style: clone(defaultStyle)
  };
}

function reset() {
  nextNodeId = 1;
  nextBoundaryId = 1;
  nextAnnotationId = 1;
  selected = null;
  linkStart = null;
  boundaries = [];
  annotations = [];
  clearTool(true);
  cameraX = w / 2;
  cameraY = h / 2;
  setZoom(1);
  defaultStyle = { ...DEFAULT_STYLE };
  nodes = [["Space A", 1000], ["Space B", 1000], ["Space C", 1000]].map((value, index) => createNode(value[0], value[1], index));
  const cx = w / 2, cy = h / 2, ring = 35;
  nodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 3;
    node.x = cx + Math.cos(angle) * ring;
    node.y = cy + Math.sin(angle) * ring;
  });
  edges = [
    { a: nodes[0].id, b: nodes[1].id, pull: .6, style: "sketch", width: 2, color: "#276749" },
    { a: nodes[1].id, b: nodes[2].id, pull: .6, style: "sketch", width: 2, color: "#276749" },
    { a: nodes[2].id, b: nodes[0].id, pull: .6, style: "sketch", width: 2, color: "#276749" }
  ];
  selected = nodes[0].id;
  status.textContent = "Three connected spaces are ready. Select one to edit it.";
  renderAllControls();
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = devicePixelRatio || 1;
  if (!rect.width || !rect.height) return;
  w = rect.width;
  h = rect.height;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!Number.isFinite(cameraX)) cameraX = w / 2;
  if (!Number.isFinite(cameraY)) cameraY = h / 2;
}

function renderAllControls() {
  renderList();
  renderBoundaries();
  syncInspector();
  syncStyleControls();
  renderAnnotations();
  renderLinkState();
}

function renderList() {
  list.replaceChildren();
  for (const node of nodes) {
    const row = document.createElement("div");
    row.className = "item" + (selected === node.id ? " selected" : "");
    row.innerHTML = '<span class="area-swatch" aria-hidden="true"></span><button class="choose"></button><span class="sf"></span><span class="lock-indicator" aria-label="Location status"></span><button class="delete" aria-label="Delete space">×</button>';
    row.querySelector(".area-swatch").style.background = node.color;
    const choose = row.querySelector(".choose");
    choose.textContent = node.name;
    choose.onclick = () => activeTool === "connect" ? handleConnectionChoice(node.id) : selectNode(node.id);
    node.areaEl = row.querySelector(".sf");
    node.areaEl.textContent = node.area.toLocaleString() + " sf";
    const lock = row.querySelector(".lock-indicator");
    lock.textContent = node.pinned ? "◆" : "";
    lock.title = node.pinned ? "Fixed location" : "Movable";
    row.querySelector(".delete").onclick = () => removeNode(node.id);
    list.append(row);
  }
  $("#total").textContent = nodes.reduce((sum, node) => sum + node.area, 0).toLocaleString() + " sf";
}

function renderBoundaries() {
  boundaryList.replaceChildren();
  $("#boundaryCount").textContent = boundaries.length.toString();
  boundaries.forEach(boundary => {
    const row = document.createElement("div");
    row.className = "boundary-item";
    row.innerHTML = '<input type="color" aria-label="Boundary color"><span class="boundary-label"></span><label title="Show or hide boundary"><input class="boundary-visible" type="checkbox" aria-label="Show boundary"> show</label><button aria-label="Delete boundary">×</button>';
    const color = row.querySelector('input[type="color"]');
    color.value = boundary.color;
    color.oninput = event => { boundary.color = event.target.value; };
    const label = row.querySelector(".boundary-label");
    const kind = boundary.kind === "void" ? "void" : "outer";
    label.innerHTML = `<span>${escapeHtml(boundary.name)}</span> <small>${kind}</small>`;
    const visible = row.querySelector(".boundary-visible");
    visible.checked = boundary.visible !== false;
    visible.onchange = event => { boundary.visible = event.target.checked; };
    row.querySelector("button").onclick = () => deleteBoundary(boundary.id);
    boundaryList.append(row);
  });
  updateBoundaryOptions();
}

function renderAnnotations() {
  const container = $("#annotationList");
  $("#annotationCount").textContent = annotations.length.toString();
  container.replaceChildren();
  if (!annotations.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "No annotations yet.";
    container.append(empty);
    return;
  }
  annotations.forEach((annotation, index) => {
    const row = document.createElement("div");
    row.className = "annotation-item";
    row.innerHTML = '<strong></strong><input type="color" aria-label="Annotation color"><button aria-label="Delete annotation">×</button><select class="annotation-line" aria-label="Annotation line style"><option value="solid">Solid line</option><option value="dashed">Dashed line</option><option value="dotted">Dotted line</option></select><select class="annotation-head" aria-label="Annotation arrow head"><option value="filled">Filled arrow head</option><option value="open">Open V arrow head</option><option value="outline">Outlined arrow head</option></select><select class="annotation-ends" aria-label="Annotation arrow ends"><option value="single">Single headed</option><option value="double">Double headed</option></select><label class="annotation-controls">Weight <input type="range" min="1" max="8" step="1"><output></output></label>';
    row.querySelector("strong").textContent = `Arrow ${index + 1}`;
    const color = row.querySelector('input[type="color"]');
    color.value = annotation.color;
    color.oninput = event => { annotation.color = event.target.value; };
    const lineStyle = row.querySelector(".annotation-line");
    lineStyle.value = annotation.lineStyle || "solid";
    lineStyle.onchange = event => { annotation.lineStyle = event.target.value; };
    const headStyle = row.querySelector(".annotation-head");
    headStyle.value = annotation.headStyle || "filled";
    headStyle.onchange = event => { annotation.headStyle = event.target.value; };
    const ends = row.querySelector(".annotation-ends");
    ends.value = annotation.doubleHead ? "double" : "single";
    ends.onchange = event => { annotation.doubleHead = event.target.value === "double"; };
    const weight = row.querySelector('.annotation-controls input'), output = row.querySelector("output");
    weight.value = annotation.width;
    output.textContent = annotation.width + " px";
    weight.oninput = event => { annotation.width = +event.target.value; output.textContent = annotation.width + " px"; };
    row.querySelector("button").onclick = () => {
      annotations = annotations.filter(item => item.id !== annotation.id);
      renderAnnotations();
      status.textContent = `Arrow ${index + 1} deleted.`;
    };
    container.append(row);
  });
}

function updateBoundaryOptions() {
  const select = $("#spaceBoundary");
  const current = selectedNode()?.boundaryId || "";
  select.replaceChildren(new Option("Automatic", ""));
  boundaries.filter(boundary => boundary.kind === "outer").forEach(boundary => select.add(new Option(boundary.name, String(boundary.id))));
  select.value = current ? String(current) : "";
}

function selectNode(id) {
  selected = id;
  const node = selectedNode();
  status.textContent = node ? `${node.name} selected.` : "Selection cleared.";
  renderList();
  syncInspector();
  syncStyleControls();
}

function removeNode(id) {
  nodes = nodes.filter(node => node.id !== id);
  edges = edges.filter(edge => edge.a !== id && edge.b !== id);
  if (selected === id) selected = nodes[0]?.id ?? null;
  if (linkStart === id) linkStart = null;
  renderAllControls();
}

function togglePin(node) {
  node.pinned = !node.pinned;
  node.vx = node.vy = 0;
  status.textContent = `${node.name} ${node.pinned ? "fixed at its current coordinates" : "released to physics"}.`;
  renderList();
  syncInspector();
}

function syncInspector() {
  const node = selectedNode();
  $("#spaceInspector").classList.toggle("is-hidden", !node);
  if (!node) { renderSelectedConnections(); return; }
  $("#selectedName").textContent = node.name;
  $("#selectedAreaName").value = node.name;
  $("#selectedAreaSize").value = node.area;
  $("#roomShape").value = node.shape || "circle";
  $("#coordX").value = Math.round(node.x);
  $("#coordY").value = Math.round(node.y);
  $("#pinSpace").textContent = node.pinned ? "Release location" : "Fix location";
  $("#selectedColor").value = node.color;
  $("#spaceFoam").checked = node.foam !== false;
  $("#spaceSqueeze").disabled = node.foam === false;
  $("#spaceSqueeze").value = Math.round((node.squeeze ?? .75) * 100);
  $("#spaceSqueezeValue").textContent = Math.round((node.squeeze ?? .75) * 100) + "%";
  $("#selectedWeight").value = node.weight ?? .5;
  $("#selectedWeightValue").textContent = (node.weight ?? .5).toFixed(2);
  $("#spaceSeparation").value = Math.round((node.separation ?? .7) * 100);
  $("#spaceSeparationValue").textContent = Math.round((node.separation ?? .7) * 100) + "%";
  $("#spaceMobility").value = Math.round((node.mobility ?? 1) * 100);
  $("#spaceMobilityValue").textContent = Math.round((node.mobility ?? 1) * 100) + "%";
  updateBoundaryOptions();
  renderSelectedConnections();
}

function edgeIncludes(edge, id) { return edge.a === id || edge.b === id; }
function otherEnd(edge, id) { return edge.a === id ? edge.b : edge.a; }

function renderSelectedConnections() {
  const container = $("#selectedConnections");
  const node = selectedNode();
  $("#connectionsOwner").textContent = node ? node.name : "";
  container.replaceChildren();
  if (!node) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "Select an area to edit its links.";
    container.append(empty);
    return;
  }
  const connected = edges.filter(edge => edgeIncludes(edge, node.id));
  if (!connected.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "No linked areas.";
    container.append(empty);
    return;
  }
  connected.forEach(edge => {
    const other = nodes.find(item => item.id === otherEnd(edge, node.id));
    if (!other) return;
    const row = document.createElement("div");
    row.className = "connection-property";
    row.innerHTML = '<div class="connection-heading"><strong></strong><button aria-label="Unlink area">Unlink</button></div><label class="connection-range"><span>Pull</span><output class="pull-output"></output><input class="pull-input" type="range" min="0" max="1" step="0.05" aria-label="Relationship pull weight"></label><label class="connection-field">Line style<select class="edge-style"><option value="sketch">Sketch dashed</option><option value="solid">Solid</option><option value="dotted">Dotted</option><option value="arrow">Directional arrow</option></select></label><label class="connection-color">Color <input class="edge-color" type="color"></label><label class="connection-range"><span>Width</span><output class="width-output"></output><input class="width-input" type="range" min="1" max="6" step="1" aria-label="Relationship line width"></label>';
    row.querySelector("strong").textContent = other.name;
    const output = row.querySelector(".pull-output"), range = row.querySelector(".pull-input");
    range.value = edge.pull ?? .6;
    output.textContent = `${Math.round((edge.pull ?? .6) * 100)}% pull`;
    range.oninput = event => { edge.pull = +event.target.value; output.textContent = `${Math.round(edge.pull * 100)}% pull`; };
    const style = row.querySelector(".edge-style");
    style.value = edge.style || "sketch";
    style.onchange = event => { edge.style = event.target.value; };
    const color = row.querySelector(".edge-color");
    color.value = edge.color || "#276749";
    color.oninput = event => { edge.color = event.target.value; };
    const width = row.querySelector(".width-input"), widthOutput = row.querySelector(".width-output");
    width.value = edge.width ?? 2;
    widthOutput.textContent = `${edge.width ?? 2} px`;
    width.oninput = event => { edge.width = +event.target.value; widthOutput.textContent = `${edge.width} px`; };
    row.querySelector("button").onclick = () => {
      edges = edges.filter(candidate => candidate !== edge);
      status.textContent = `${node.name} and ${other.name} unlinked.`;
      renderSelectedConnections();
    };
    container.append(row);
  });
}

function styleSource() {
  return selectedNode()?.style || defaultStyle;
}

function syncStyleControls() {
  const style = styleSource();
  $("#fillStyle").value = style.fill || "solid";
  $("#outlineStyle").value = style.outline || "open";
  $("#patternStyle").value = style.pattern || "none";
  $("#sketchEffect").checked = style.sketch !== false;
  $("#misregisterEffect").checked = !!style.misregister;
}

function applyStyle(property, value) {
  const node = selectedNode();
  if (!node) { status.textContent = "Select a space before editing its appearance."; return; }
  node.style[property] = value;
  status.textContent = `${node.name} appearance updated.`;
}

const screenPoint = event => {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};
const toWorld = point => ({ x: cameraX + (point.x - w / 2) / zoomLevel, y: cameraY + (point.y - h / 2) / zoomLevel });
const eventPoint = event => toWorld(screenPoint(event));

function hit(point) {
  return [...nodes].reverse().find(node => Math.hypot(point.x - node.x, point.y - node.y) <= maxShapeRadius(node) * 1.04);
}

function setZoom(value, anchor = { x: w / 2, y: h / 2 }) {
  const before = toWorld(anchor);
  zoomLevel = clamp(value, .5, 2.5);
  cameraX = before.x - (anchor.x - w / 2) / zoomLevel;
  cameraY = before.y - (anchor.y - h / 2) / zoomLevel;
  $("#zoom").value = Math.round(zoomLevel * 100 / 10) * 10;
  $("#zoomValue").textContent = Math.round(zoomLevel * 100) + "%";
}

function clearTool(silent = false) {
  activeTool = null;
  boundaryDraft = null;
  freehandDraft = null;
  polylineDraft = null;
  arrowDraft = null;
  roomDraft = null;
  pan = null;
  linkStart = null;
  ["#drawBoundary", "#sketchBoundary", "#polylineBoundary", "#drawArrow", "#sketchRoom", "#connectSpaces"].forEach(id => $(id).classList.remove("active"));
  $("#finishPolyline").disabled = true;
  canvas.classList.remove("drawing", "dragging");
  renderLinkState();
  if (!silent) status.textContent = "Drawing tool cancelled.";
}

function setTool(tool) {
  if (activeTool === tool) { clearTool(); return; }
  clearTool(true);
  activeTool = tool;
  const buttonFor = {
    "boundary-rect": "#drawBoundary", "boundary-freehand": "#sketchBoundary", "boundary-polyline": "#polylineBoundary",
    "annotation-arrow": "#drawArrow", "room-custom": "#sketchRoom", "connect": "#connectSpaces"
  };
  $(buttonFor[tool]).classList.add("active");
  canvas.classList.add("drawing");
  if (tool === "boundary-polyline") polylineDraft = [];
  const messages = {
    "boundary-rect": "Drag the new boundary from corner to corner.",
    "boundary-freehand": "Press and drag a closed boundary shape.",
    "boundary-polyline": "Click each boundary corner, then choose Finish / close.",
    "annotation-arrow": "Click the arrow start point, then click its end point.",
    "room-custom": "Draw the selected room's approximate outline.",
    "connect": "Choose the first area to link. Your previous selection will be ignored."
  };
  status.textContent = messages[tool];
  renderLinkState();
}

function renderLinkState() {
  const state = $("#linkSelectionState");
  if (!state) return;
  const first = nodes.find(node => node.id === linkStart);
  const active = activeTool === "connect";
  state.classList.toggle("waiting", active);
  if (first) state.innerHTML = `<span>✓ ${escapeHtml(first.name)}</span><b>→</b><span>Choose second area</span>`;
  else if (active) state.innerHTML = '<span>Choose first area</span><b>→</b><span>Then choose second</span>';
  else state.innerHTML = '<span>1. Choose first area</span><b>→</b><span>2. Choose second area</span>';
}

function finishPolyline() {
  if (!polylineDraft || polylineDraft.length < 3) {
    status.textContent = "Add at least three corners before closing the boundary.";
    return;
  }
  addBoundary({ type: "polygon", points: simplifyPolygon(polylineDraft) });
  clearTool(true);
}

function addBoundary(geometry) {
  const kind = $("#boundaryKind").value;
  const index = boundaries.filter(boundary => boundary.kind === kind).length + 1;
  boundaries.push({
    id: nextBoundaryId++, name: kind === "void" ? `Void ${index}` : `Boundary ${index}`,
    kind, color: kind === "void" ? "#a23b3b" : "#1b2721", visible: true, ...geometry
  });
  nodes.forEach(node => constrain(node, false));
  status.textContent = `${kind === "void" ? "Void" : "Boundary"} added. You can draw another one.`;
  renderBoundaries();
}

function svgNumber(value, fallback = 0) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function sampleSvgElement(sourceElement, viewBox, pathDataOverride = null) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("width", String(viewBox.width));
  svg.setAttribute("height", String(viewBox.height));
  Object.assign(svg.style, { position: "fixed", left: "-100000px", top: "-100000px", visibility: "hidden", pointerEvents: "none" });

  const ancestors = [];
  for (let parent = sourceElement.parentElement; parent && parent.tagName.toLowerCase() !== "svg"; parent = parent.parentElement) {
    if (parent.hasAttribute("transform")) ancestors.unshift(parent.getAttribute("transform"));
  }
  let container = svg;
  for (const transform of ancestors) {
    const group = document.createElementNS(namespace, "g");
    group.setAttribute("transform", transform);
    container.append(group);
    container = group;
  }

  const tag = sourceElement.tagName.toLowerCase();
  const geometry = document.createElementNS(namespace, tag);
  const allowed = {
    path: ["d", "transform"], rect: ["x", "y", "width", "height", "rx", "ry", "transform"],
    circle: ["cx", "cy", "r", "transform"], ellipse: ["cx", "cy", "rx", "ry", "transform"],
    polygon: ["points", "transform"], polyline: ["points", "transform"]
  };
  for (const attribute of allowed[tag] || []) if (sourceElement.hasAttribute(attribute)) geometry.setAttribute(attribute, sourceElement.getAttribute(attribute));
  if (tag === "path" && pathDataOverride) geometry.setAttribute("d", pathDataOverride);
  container.append(geometry);
  document.body.append(svg);
  try {
    if (typeof geometry.getTotalLength !== "function") return [];
    const length = geometry.getTotalLength();
    if (!Number.isFinite(length) || length <= 1) return [];
    const sampleCount = clamp(Math.ceil(length / 9), tag === "rect" ? 12 : 24, 180);
    const matrix = geometry.getCTM();
    const points = [];
    for (let index = 0; index < sampleCount; index++) {
      const point = geometry.getPointAtLength(length * index / sampleCount);
      if (matrix) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x; svgPoint.y = point.y;
        const transformed = svgPoint.matrixTransform(matrix);
        points.push({ x: transformed.x, y: transformed.y });
      } else points.push({ x: point.x, y: point.y });
    }
    return simplifyImportedPoints(points);
  } finally {
    svg.remove();
  }
}

function simplifyImportedPoints(points) {
  if (points.length < 3) return [];
  const output = [points[0]];
  for (let index = 1; index < points.length; index++) {
    const previous = output[output.length - 1], point = points[index];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) > .5) output.push(point);
  }
  if (output.length > 3 && Math.hypot(output[0].x - output[output.length - 1].x, output[0].y - output[output.length - 1].y) < .5) output.pop();
  return output;
}

function importSvgBoundaries(svgText) {
  const documentSvg = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (documentSvg.querySelector("parsererror")) throw new Error("The SVG file could not be read.");
  const root = documentSvg.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") throw new Error("The selected file is not an SVG.");
  const viewBoxValues = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const viewBox = viewBoxValues.length === 4 && viewBoxValues.every(Number.isFinite)
    ? { x: viewBoxValues[0], y: viewBoxValues[1], width: Math.abs(viewBoxValues[2]) || 100, height: Math.abs(viewBoxValues[3]) || 100 }
    : { x: 0, y: 0, width: svgNumber(root.getAttribute("width"), 100), height: svgNumber(root.getAttribute("height"), 100) };
  const sourceElements = [...root.querySelectorAll("path, rect, circle, ellipse, polygon, polyline")].filter(element => element.closest("defs, clipPath, mask, pattern, marker") === null);
  let shapes = [];
  for (const element of sourceElements.slice(0, 80)) {
    const pathData = element.tagName.toLowerCase() === "path" ? element.getAttribute("d") || "" : "";
    const subpaths = pathData.match(/M[^M]+/g);
    if (subpaths?.length > 1) subpaths.forEach(subpath => shapes.push(sampleSvgElement(element, viewBox, subpath)));
    else shapes.push(sampleSvgElement(element, viewBox));
  }
  shapes = shapes.filter(points => points.length >= 3 && Math.abs(polygonArea(points)) > 1);
  if (!shapes.length) throw new Error("No usable path, rectangle, circle, ellipse, or polygon was found in the SVG.");

  const nestingDepths = shapes.map((points, index) => {
    const center = polygonCentroid(points);
    const area = Math.abs(polygonArea(points));
    return shapes.reduce((depth, other, otherIndex) => otherIndex !== index && Math.abs(polygonArea(other)) > area && pointInPolygon(center, other) ? depth + 1 : depth, 0);
  });

  const allPoints = shapes.flat();
  const minX = Math.min(...allPoints.map(point => point.x)), maxX = Math.max(...allPoints.map(point => point.x));
  const minY = Math.min(...allPoints.map(point => point.y)), maxY = Math.max(...allPoints.map(point => point.y));
  const sourceWidth = Math.max(1, maxX - minX), sourceHeight = Math.max(1, maxY - minY);
  const targetWidth = w / zoomLevel * .72, targetHeight = h / zoomLevel * .72;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const centerX = cameraX, centerY = cameraY;
  shapes = shapes.map(points => points.map(point => ({
    x: centerX + (point.x - (minX + maxX) / 2) * scale,
    y: centerY + (point.y - (minY + maxY) / 2) * scale
  })));
  const requestedKind = $("#boundaryKind").value;
  let outerCount = 0, voidCount = 0;
  for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
    const points = shapes[shapeIndex];
    const kind = requestedKind === "void" || nestingDepths[shapeIndex] % 2 === 1 ? "void" : "outer";
    if (kind === "void") voidCount++; else outerCount++;
    const index = boundaries.filter(boundary => boundary.kind === kind).length + 1;
    boundaries.push({
      id: nextBoundaryId++, name: kind === "void" ? `SVG Void ${index}` : `SVG Boundary ${index}`,
      kind, color: kind === "void" ? "#a23b3b" : "#1b2721", visible: true, type: "polygon", points
    });
  }
  nodes.forEach(node => constrain(node, false));
  renderBoundaries();
  const parts = [];
  if (outerCount) parts.push(`${outerCount} boundar${outerCount === 1 ? "y" : "ies"}`);
  if (voidCount) parts.push(`${voidCount} void${voidCount === 1 ? "" : "s"}`);
  status.textContent = `Imported ${parts.join(" and ")} from the SVG.`;
}

function deleteBoundary(id) {
  const boundary = boundaries.find(item => item.id === id);
  boundaries = boundaries.filter(item => item.id !== id);
  nodes.forEach(node => { if (node.boundaryId === id) node.boundaryId = null; });
  status.textContent = `${boundary?.name || "Boundary"} deleted.`;
  renderBoundaries();
  syncInspector();
}

canvas.onpointerdown = event => {
  const point = eventPoint(event);
  if (activeTool === "boundary-rect") {
    boundaryDraft = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (activeTool === "boundary-freehand") {
    freehandDraft = [point];
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (activeTool === "boundary-polyline") {
    const previous = polylineDraft[polylineDraft.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 3 / zoomLevel) polylineDraft.push(point);
    $("#finishPolyline").disabled = polylineDraft.length < 3;
    status.textContent = `Polyline has ${polylineDraft.length} corner${polylineDraft.length === 1 ? "" : "s"}.`;
    return;
  }
  if (activeTool === "annotation-arrow") {
    if (!arrowDraft) {
      arrowDraft = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
      status.textContent = "Arrow start set. Move to preview, then click the end point.";
    } else {
      arrowDraft.x2 = point.x; arrowDraft.y2 = point.y;
      if (Math.hypot(arrowDraft.x2 - arrowDraft.x1, arrowDraft.y2 - arrowDraft.y1) > 10) {
        annotations.push({
          id: nextAnnotationId++, type: "arrow", ...arrowDraft,
          color: $("#annotationColor").value, width: +$("#annotationWeight").value,
          lineStyle: $("#annotationStyle").value, headStyle: $("#annotationHeadStyle").value,
          doubleHead: $("#annotationEnds").value === "double"
        });
        renderAnnotations();
        status.textContent = "Arrow annotation added. Choose Draw arrow to make another.";
        clearTool(true);
      } else status.textContent = "The arrow is too short. Choose an end point farther away.";
    }
    return;
  }
  if (activeTool === "room-custom") {
    if (!selectedNode()) { status.textContent = "Select a space before sketching its shape."; clearTool(true); return; }
    roomDraft = [point];
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (activeTool === "connect") {
    const node = hit(point);
    if (node) handleConnectionChoice(node.id);
    return;
  }
  const node = hit(point);
  if (!node) {
    selected = null; renderList(); syncInspector();
    const screen = screenPoint(event);
    pan = { startX: screen.x, startY: screen.y, cameraX, cameraY };
    canvas.classList.add("dragging");
    canvas.setPointerCapture(event.pointerId);
    status.textContent = "Panning view…";
    return;
  }
  drag = { node, ox: point.x - node.x, oy: point.y - node.y, sx: point.x, sy: point.y, moved: false };
  node.vx = node.vy = 0;
  canvas.classList.add("dragging");
  canvas.setPointerCapture(event.pointerId);
};

canvas.onpointermove = event => {
  const point = eventPoint(event);
  if (boundaryDraft) { boundaryDraft.x2 = point.x; boundaryDraft.y2 = point.y; return; }
  if (freehandDraft) { appendDraftPoint(freehandDraft, point); return; }
  if (arrowDraft) { arrowDraft.x2 = point.x; arrowDraft.y2 = point.y; return; }
  if (roomDraft) { appendDraftPoint(roomDraft, point); return; }
  if (pan) {
    const screen = screenPoint(event);
    cameraX = pan.cameraX - (screen.x - pan.startX) / zoomLevel;
    cameraY = pan.cameraY - (screen.y - pan.startY) / zoomLevel;
    return;
  }
  if (!drag) return;
  drag.node.x = point.x - drag.ox;
  drag.node.y = point.y - drag.oy;
  constrain(drag.node, false);
  if (Math.hypot(point.x - drag.sx, point.y - drag.sy) > 5 / zoomLevel) drag.moved = true;
};

canvas.onpointerup = event => {
  if (boundaryDraft) {
    const x = Math.min(boundaryDraft.x1, boundaryDraft.x2);
    const y = Math.min(boundaryDraft.y1, boundaryDraft.y2);
    const width = Math.abs(boundaryDraft.x2 - boundaryDraft.x1);
    const height = Math.abs(boundaryDraft.y2 - boundaryDraft.y1);
    if (width >= 60 && height >= 60) addBoundary({ type: "rect", x, y, width, height });
    else status.textContent = "That boundary is too small. Draw a larger rectangle.";
    clearTool(true);
    releasePointer(event);
    return;
  }
  if (freehandDraft) {
    if (freehandDraft.length >= 8) addBoundary({ type: "polygon", points: simplifyPolygon(freehandDraft) });
    else status.textContent = "That sketch was too short. Try a larger closed shape.";
    clearTool(true);
    releasePointer(event);
    return;
  }
  if (roomDraft) {
    const node = selectedNode();
    if (node && roomDraft.length >= 8) {
      const normalized = normalizeCustomPoints(simplifyPolygon(roomDraft), node.r);
      node.x = normalized.center.x;
      node.y = normalized.center.y;
      node.customPoints = normalized.points;
      node.shape = "custom";
      node.vx = node.vy = 0;
      status.textContent = `${node.name} now uses your filleted custom outline.`;
      syncInspector();
    } else status.textContent = "The room sketch needs a longer closed outline.";
    clearTool(true);
    releasePointer(event);
    return;
  }
  if (pan) {
    pan = null;
    canvas.classList.remove("dragging");
    status.textContent = "View moved. Drag empty canvas again to continue panning.";
    releasePointer(event);
    return;
  }
  if (!drag) return;
  if (!drag.moved) selectNode(drag.node.id);
  else syncInspector();
  drag = null;
  canvas.classList.remove("dragging");
  releasePointer(event);
};

canvas.ondblclick = event => {
  if (activeTool) return;
  const node = hit(eventPoint(event));
  if (node) togglePin(node);
};

function releasePointer(event) {
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function appendDraftPoint(points, point) {
  const previous = points[points.length - 1];
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 7 / zoomLevel) points.push(point);
}

function handleConnectionChoice(id) {
  if (linkStart === null) {
    linkStart = id;
    selected = id;
    status.textContent = `${nodes.find(node => node.id === id).name} chosen. Choose the second space.`;
    renderList();
    syncInspector();
    renderLinkState();
    return;
  }
  if (linkStart === id) { status.textContent = "That is already the first area. Choose a different second area."; renderLinkState(); return; }
  const index = edges.findIndex(edge => edgeIncludes(edge, linkStart) && edgeIncludes(edge, id));
  const first = nodes.find(node => node.id === linkStart)?.name;
  const second = nodes.find(node => node.id === id)?.name;
  if (index < 0) {
    edges.push({ a: linkStart, b: id, pull: .6, style: $("#connectionStyle").value, width: +$("#lineWeight").value, color: $("#connectionColor").value });
    status.textContent = `Linked ${first} ↔ ${second}.`;
  }
  else { edges.splice(index, 1); status.textContent = `Removed ${first} ↔ ${second} relationship.`; }
  selected = id;
  clearTool(true);
  renderList();
  syncInspector();
}

window.addEventListener("keydown", event => {
  if (activeTool === "boundary-polyline" && event.key === "Enter") finishPolyline();
  if (activeTool && event.key === "Escape") clearTool();
});

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  setZoom(zoomLevel * (event.deltaY < 0 ? 1.12 : .89), screenPoint(event));
}, { passive: false });

function simplifyPolygon(points) {
  let result = [points[0]];
  const spacing = 12 / zoomLevel;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = result[result.length - 1];
    if (Math.hypot(points[index].x - previous.x, points[index].y - previous.y) >= spacing) result.push(points[index]);
  }
  result.push(points[points.length - 1]);
  if (result.length > 90) {
    const step = Math.ceil(result.length / 90);
    result = result.filter((_, index) => index % step === 0);
  }
  return result;
}

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function polygonCentroid(points) {
  const area = polygonArea(points);
  if (Math.abs(area) < .001) return points.reduce((center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }), { x: 0, y: 0 });
  let x = 0, y = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  return { x: x / (6 * area), y: y / (6 * area) };
}

function normalizeCustomPoints(points, r) {
  const center = polygonCentroid(points);
  const local = points.map(point => ({ x: point.x - center.x, y: point.y - center.y }));
  const currentArea = Math.max(1, Math.abs(polygonArea(local)));
  const scale = Math.sqrt(Math.PI * r * r / currentArea);
  return { center, points: local.map(point => ({ x: point.x * scale, y: point.y * scale })) };
}

function basePolygon(node) {
  const targetArea = Math.PI * node.r * node.r;
  if (node.shape === "rect") {
    const aspect = 1.35;
    const height = Math.sqrt(targetArea / aspect), width = height * aspect;
    return [{ x: -width / 2, y: -height / 2 }, { x: width / 2, y: -height / 2 }, { x: width / 2, y: height / 2 }, { x: -width / 2, y: height / 2 }];
  }
  if (node.shape === "lshape") {
    const raw = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: -.25 }, { x: .18, y: -.25 }, { x: .18, y: 1 }, { x: -1, y: 1 }];
    const center = polygonCentroid(raw);
    const scale = Math.sqrt(targetArea / Math.abs(polygonArea(raw)));
    return raw.map(point => ({ x: (point.x - center.x) * scale, y: (point.y - center.y) * scale }));
  }
  if (node.shape === "custom" && node.customPoints?.length >= 3) return node.customPoints;
  return null;
}

function rayPolygonDistance(points, angle) {
  const rx = Math.cos(angle), ry = Math.sin(angle);
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const sx = q.x - p.x, sy = q.y - p.y;
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < 1e-8) continue;
    const t = (p.x * sy - p.y * sx) / denominator;
    const u = (p.x * ry - p.y * rx) / denominator;
    if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

function baseRadiusAt(node, angle) {
  const polygon = basePolygon(node);
  if (!polygon) return node.r;
  const distance = rayPolygonDistance(polygon, angle);
  return Number.isFinite(distance) && distance > node.r * .08 ? distance : node.r;
}

function maxShapeRadius(node) {
  if (node.profile?.length) return Math.max(...node.profile);
  return baseMaxShapeRadius(node);
}

function baseMaxShapeRadius(node) {
  let maximum = node.r;
  for (let i = 0; i < 48; i++) maximum = Math.max(maximum, baseRadiusAt(node, i / 48 * Math.PI * 2));
  return maximum;
}

function pointInPolygon(point, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    const crosses = (a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function closestOnPolygon(point, points) {
  let best = null, bestDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const candidate = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = (point.x - candidate.x) ** 2 + (point.y - candidate.y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = candidate; }
  }
  return best;
}

function boundaryCenter(boundary) {
  return boundary.type === "rect" ? { x: boundary.x + boundary.width / 2, y: boundary.y + boundary.height / 2 } : polygonCentroid(boundary.points);
}

function boundaryContains(boundary, point) {
  return boundary.type === "rect"
    ? point.x >= boundary.x && point.x <= boundary.x + boundary.width && point.y >= boundary.y && point.y <= boundary.y + boundary.height
    : pointInPolygon(point, boundary.points);
}

function closestOnBoundary(point, boundary) {
  if (boundary.type === "polygon") return closestOnPolygon(point, boundary.points);
  const candidates = [
    { x: clamp(point.x, boundary.x, boundary.x + boundary.width), y: boundary.y },
    { x: clamp(point.x, boundary.x, boundary.x + boundary.width), y: boundary.y + boundary.height },
    { x: boundary.x, y: clamp(point.y, boundary.y, boundary.y + boundary.height) },
    { x: boundary.x + boundary.width, y: clamp(point.y, boundary.y, boundary.y + boundary.height) }
  ];
  return candidates.sort((a, b) => ((point.x - a.x) ** 2 + (point.y - a.y) ** 2) - ((point.x - b.x) ** 2 + (point.y - b.y) ** 2))[0];
}

function outerBoundaryFor(node) {
  const outers = boundaries.filter(boundary => boundary.kind === "outer");
  if (!outers.length) return null;
  const assigned = outers.find(boundary => boundary.id === node.boundaryId);
  if (assigned) return assigned;
  const containing = outers.filter(boundary => boundaryContains(boundary, node));
  if (containing.length) return containing.sort((a, b) => boundarySize(a) - boundarySize(b))[0];
  return outers.sort((a, b) => {
    const ca = boundaryCenter(a), cb = boundaryCenter(b);
    return Math.hypot(node.x - ca.x, node.y - ca.y) - Math.hypot(node.x - cb.x, node.y - cb.y);
  })[0];
}

function boundarySize(boundary) {
  return boundary.type === "rect" ? boundary.width * boundary.height : Math.abs(polygonArea(boundary.points));
}

function containRadius(node) {
  return baseMaxShapeRadius(node) * (1 - foamResponseFor(node) * (.82 - .57 * node.weight));
}

function constrainOuterPolygon(node, boundary, bounce) {
  const margin = +$("#margin").value;
  const rr = containRadius(node) + margin;
  const center = boundaryCenter(boundary);
  let moved = false;
  for (let pass = 0; pass < 8; pass++) {
    const corrections = [];
    if (!pointInPolygon(node, boundary.points)) {
      const q = closestOnPolygon(node, boundary.points);
      const dx = center.x - q.x, dy = center.y - q.y, d = Math.hypot(dx, dy) || 1;
      corrections.push({ x: q.x + dx / d * (rr + 2) - node.x, y: q.y + dy / d * (rr + 2) - node.y });
    }
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const sample = { x: node.x + Math.cos(angle) * rr, y: node.y + Math.sin(angle) * rr };
      if (!pointInPolygon(sample, boundary.points)) {
        const q = closestOnPolygon(sample, boundary.points);
        corrections.push({ x: q.x - sample.x, y: q.y - sample.y });
      }
    }
    if (!corrections.length) break;
    let correction = corrections.reduce((sum, value) => ({ x: sum.x + value.x / corrections.length, y: sum.y + value.y / corrections.length }), { x: 0, y: 0 });
    if (Math.hypot(correction.x, correction.y) < .2) {
      const dx = center.x - node.x, dy = center.y - node.y, d = Math.hypot(dx, dy) || 1;
      correction = { x: dx / d * 2, y: dy / d * 2 };
    }
    node.x += correction.x * 1.2;
    node.y += correction.y * 1.2;
    moved = true;
  }
  if (moved && bounce) { node.vx *= -.2; node.vy *= -.2; }
}

function constrainVoid(node, boundary, bounce) {
  const rr = containRadius(node) + +$("#margin").value;
  const point = { x: node.x, y: node.y };
  const inside = boundaryContains(boundary, point);
  const q = closestOnBoundary(point, boundary);
  const distance = Math.hypot(point.x - q.x, point.y - q.y);
  if (!inside && distance >= rr) return;
  let dx, dy;
  if (inside) { dx = q.x - point.x; dy = q.y - point.y; }
  else { dx = point.x - q.x; dy = point.y - q.y; }
  let d = Math.hypot(dx, dy);
  if (d < .001) {
    const center = boundaryCenter(boundary);
    dx = point.x - center.x; dy = point.y - center.y; d = Math.hypot(dx, dy) || 1;
  }
  node.x = q.x + dx / d * (rr + 1);
  node.y = q.y + dy / d * (rr + 1);
  if (bounce) { node.vx *= -.25; node.vy *= -.25; }
}

function constrain(node, bounce = true) {
  if (!$("#contain").checked) return;
  const outer = outerBoundaryFor(node);
  const rr = containRadius(node), margin = +$("#margin").value;
  if (outer?.type === "polygon") constrainOuterPolygon(node, outer, bounce);
  else if (outer) {
    const limits = { left: outer.x + margin + rr, right: outer.x + outer.width - margin - rr, top: outer.y + margin + rr, bottom: outer.y + outer.height - margin - rr };
    if (limits.left > limits.right) node.x = (limits.left + limits.right) / 2;
    else if (node.x < limits.left) { node.x = limits.left; if (bounce) node.vx *= -.35; }
    else if (node.x > limits.right) { node.x = limits.right; if (bounce) node.vx *= -.35; }
    if (limits.top > limits.bottom) node.y = (limits.top + limits.bottom) / 2;
    else if (node.y < limits.top) { node.y = limits.top; if (bounce) node.vy *= -.35; }
    else if (node.y > limits.bottom) { node.y = limits.bottom; if (bounce) node.vy *= -.35; }
  }
  boundaries.filter(boundary => boundary.kind === "void").forEach(boundary => constrainVoid(node, boundary, bounce));
}

function rayBoundaryDistance(origin, angle, boundary) {
  const rx = Math.cos(angle), ry = Math.sin(angle);
  if (boundary.type === "rect") {
    const values = [];
    for (const x of [boundary.x, boundary.x + boundary.width]) {
      if (Math.abs(rx) < 1e-6) continue;
      const t = (x - origin.x) / rx, y = origin.y + t * ry;
      if (t >= 0 && y >= boundary.y - 1e-6 && y <= boundary.y + boundary.height + 1e-6) values.push(t);
    }
    for (const y of [boundary.y, boundary.y + boundary.height]) {
      if (Math.abs(ry) < 1e-6) continue;
      const t = (y - origin.y) / ry, x = origin.x + t * rx;
      if (t >= 0 && x >= boundary.x - 1e-6 && x <= boundary.x + boundary.width + 1e-6) values.push(t);
    }
    return Math.min(...values.filter(value => value >= 0));
  }
  let best = Infinity;
  for (let i = 0; i < boundary.points.length; i++) {
    const p = boundary.points[i], q = boundary.points[(i + 1) % boundary.points.length];
    const sx = q.x - p.x, sy = q.y - p.y, denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < 1e-8) continue;
    const ax = p.x - origin.x, ay = p.y - origin.y;
    const t = (ax * sy - ay * sx) / denominator;
    const u = (ax * ry - ay * rx) / denominator;
    if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

function boundaryRayDistance(node, angle) {
  if (!$("#contain").checked) return Infinity;
  const margin = +$("#margin").value;
  let best = Infinity;
  const outer = outerBoundaryFor(node);
  if (outer) best = rayBoundaryDistance(node, angle, outer) - margin;
  for (const boundary of boundaries.filter(item => item.kind === "void")) {
    if (boundaryContains(boundary, node)) return 0;
    const distance = rayBoundaryDistance(node, angle, boundary);
    if (Number.isFinite(distance)) best = Math.min(best, distance - margin);
  }
  return Math.max(0, best);
}

function softClip(value, limit, softness) {
  if (!Number.isFinite(limit) || limit >= value) return value;
  const delta = value - limit;
  if (delta >= softness) return limit;
  const x = delta / softness;
  return value - softness * x * x * (2 - x);
}

function interfaceFor(node, other, distance, angleToOther) {
  const support = baseRadiusAt(node, angleToOther);
  const otherSupport = baseRadiusAt(other, angleToOther + Math.PI);
  const yieldNode = 1 - node.weight + .15, yieldOther = 1 - other.weight + .15;
  const gap = distance - support - otherSupport;
  return gap >= 0 ? support + gap * yieldOther / (yieldNode + yieldOther) : support + gap * yieldNode / (yieldNode + yieldOther);
}

function profileAtScale(node, scale, response) {
  const softness = node.r * (.18 + .08 * (1 - response));
  return Array.from({ length: PROFILE_SAMPLES }, (_, index) => {
    const angle = index / PROFILE_SAMPLES * Math.PI * 2;
    const base = baseRadiusAt(node, angle);
    let value = base * scale;
    for (const other of nodes) {
      if (other === node) continue;
      const dx = other.x - node.x, dy = other.y - node.y, distance = Math.hypot(dx, dy);
      if (distance < .001) continue;
      const direction = Math.atan2(dy, dx);
      const facing = Math.cos(angle - direction);
      if (facing <= .001) continue;
      const naturalInterface = interfaceFor(node, other, distance, direction);
      const interfaceDistance = value + (naturalInterface - value) * response;
      value = softClip(value, interfaceDistance / facing, softness);
    }
    const wall = boundaryRayDistance(node, angle);
    if (Number.isFinite(wall)) {
      const wallLimit = value + (wall - value) * response;
      value = softClip(value, wallLimit, softness);
    }
    return Math.max(node.r * .08, value);
  });
}

function profileMean(radii) { return radii.reduce((sum, value) => sum + value * value, 0) / radii.length; }

function buildShapeProfiles() {
  for (const node of nodes) {
    const response = foamResponseFor(node);
    const base = Array.from({ length: PROFILE_SAMPLES }, (_, index) => baseRadiusAt(node, index / PROFILE_SAMPLES * Math.PI * 2));
    const target = profileMean(base);
    let radii = profileAtScale(node, 1, response);
    if (profileMean(radii) < target) {
      let low = 1, high = 2.2, highProfile = profileAtScale(node, high, response);
      if (profileMean(highProfile) >= target) {
        for (let step = 0; step < 20; step++) {
          const middle = (low + high) / 2;
          const profile = profileAtScale(node, middle, response);
          if (profileMean(profile) < target) low = middle; else high = middle;
        }
        radii = profileAtScale(node, high, response);
      } else radii = highProfile;
    }
    for (let pass = 0; pass < 3; pass++) {
      radii = radii.map((value, index) => (radii[(index - 1 + radii.length) % radii.length] + value * 4 + radii[(index + 1) % radii.length]) / 6);
    }
    node.profile = radii;
    node.effectiveArea = Math.max(1, Math.min(node.area, node.area * profileMean(radii) / target));
  }
}

function shapeRadius(node, angle) {
  if (!node.profile) return baseRadiusAt(node, angle);
  const position = ((angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * node.profile.length;
  const index = Math.floor(position), mix = position - index, next = (index + 1) % node.profile.length;
  return node.profile[index] * (1 - mix) + node.profile[next] * mix;
}

function shapePoints(node, count = 72, offsetX = 0, offsetY = 0) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    const r = shapeRadius(node, angle);
    let wobble = 0;
    if (node.style.sketch) wobble = Math.sin(angle * 5 + node.sketch.seed) * .7 + Math.sin(angle * 11 + node.sketch.seed * .37) * .35;
    return { x: node.x + offsetX + Math.cos(angle) * (r + wobble), y: node.y + offsetY + Math.sin(angle) * (r + wobble) };
  });
}

function physics(dt) {
  const damp = Math.pow(.86, dt * 60);
  const getNode = id => nodes.find(node => node.id === id);
  for (const edge of edges) {
    const a = getNode(edge.a), b = getNode(edge.b);
    if (!a || !b) continue;
    const deep = Math.pow((foamAmount(a) + foamAmount(b)) / 2, 1.35);
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
    const small = Math.min(a.r, b.r), target = a.r + b.r + 24 - (small * 1.35 + 24) * deep;
    const force = (distance - target) * .0028 * (edge.pull ?? .6), fx = dx / distance * force, fy = dy / distance * force;
    if (!a.pinned && drag?.node !== a) { a.vx += fx * (a.mobility ?? 1); a.vy += fy * (a.mobility ?? 1); }
    if (!b.pinned && drag?.node !== b) { b.vx -= fx * (b.mobility ?? 1); b.vy -= fy * (b.mobility ?? 1); }
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
    const deep = Math.pow((foamAmount(a) + foamAmount(b)) / 2, 1.35);
    const gap = a.r + b.r + 12 - Math.min(a.r, b.r) * 1.05 * deep;
    const repulsion = ((a.separation ?? .7) + (b.separation ?? .7)) / 2;
    const force = distance < gap ? (gap - distance) * (.018 - .012 * deep) * repulsion : 0;
    const fx = dx / distance * force, fy = dy / distance * force;
    if (!a.pinned && drag?.node !== a) { a.vx -= fx * (a.mobility ?? 1); a.vy -= fy * (a.mobility ?? 1); }
    if (!b.pinned && drag?.node !== b) { b.vx += fx * (b.mobility ?? 1); b.vy += fy * (b.mobility ?? 1); }
  }
  for (const node of nodes) {
    if (!node.pinned && drag?.node !== node) {
      node.vx *= damp; node.vy *= damp;
      node.x += node.vx * dt * 60; node.y += node.vy * dt * 60;
    }
    constrain(node, true);
  }
}

function updateEffectiveAreas() {
  buildShapeProfiles();
  const now = performance.now();
  if (now - lastAreaUpdate < 180) return;
  lastAreaUpdate = now;
  for (const node of nodes) {
    if (!node.areaEl) continue;
    const compressed = node.effectiveArea < node.area * .995;
    node.areaEl.textContent = compressed ? `${Math.round(node.effectiveArea).toLocaleString()} / ${node.area.toLocaleString()} sf` : node.area.toLocaleString() + " sf";
    node.areaEl.title = compressed ? "Effective area / programmed area" : "Programmed area";
  }
  const programmed = nodes.reduce((sum, node) => sum + node.area, 0);
  const effective = nodes.reduce((sum, node) => sum + node.effectiveArea, 0);
  const compressed = effective < programmed * .995;
  $("#total").textContent = compressed ? `≈${Math.round(effective).toLocaleString()} / ${programmed.toLocaleString()} sf` : programmed.toLocaleString() + " sf";
}

function traceSmooth(points, close = true) {
  if (!points.length) return;
  ctx.beginPath();
  if (close) {
    const first = points[0], previous = points[points.length - 1];
    ctx.moveTo((previous.x + first.x) / 2, (previous.y + first.y) / 2);
    for (let i = 0; i < points.length; i++) {
      const current = points[i], next = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  }
}

function openOutlinePoints(node, points) {
  const start = Math.floor(node.sketch.angle / (Math.PI * 2) * points.length) % points.length;
  const gapCount = Math.max(4, Math.floor(node.sketch.gap / (Math.PI * 2) * points.length));
  const output = [];
  for (let i = gapCount; i < points.length; i++) output.push(points[(start + i) % points.length]);
  return output.map(point => ({ x: point.x + node.sketch.ox, y: point.y + node.sketch.oy }));
}

function drawPattern(node, points) {
  if (node.style.pattern === "none") return;
  const extent = maxShapeRadius(node) * 1.55;
  ctx.save();
  traceSmooth(points);
  ctx.clip();
  ctx.strokeStyle = node.style.fill === "blueprint" ? "#d9f1ff77" : "#17171755";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1 / zoomLevel;
  if (node.style.pattern === "parallel") {
    for (let x = node.x - extent * 2; x < node.x + extent * 2; x += 10 / zoomLevel) {
      ctx.beginPath(); ctx.moveTo(x, node.y + extent); ctx.lineTo(x + extent * 2, node.y - extent); ctx.stroke();
    }
  } else {
    for (let x = node.x - extent; x <= node.x + extent; x += 11 / zoomLevel) for (let y = node.y - extent; y <= node.y + extent; y += 11 / zoomLevel) {
      ctx.beginPath(); ctx.arc(x, y, 1.4 / zoomLevel, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function strokeBubbleOutline(node, points, color, width, offset = null) {
  let drawingPoints = offset ? points.map(point => ({ x: point.x + offset.x, y: point.y + offset.y })) : points;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (node.style.outline === "open") {
    drawingPoints = openOutlinePoints(node, drawingPoints);
    ctx.setLineDash([]);
    traceSmooth(drawingPoints, false);
  } else {
    ctx.setLineDash(node.style.outline === "dashed" ? [10 / zoomLevel, 7 / zoomLevel] : node.style.outline === "dotted" ? [1 / zoomLevel, 8 / zoomLevel] : []);
    traceSmooth(drawingPoints);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function contrastColor(hex) {
  const value = parseInt(hex.slice(1), 16), r = value >> 16, g = value >> 8 & 255, b = value & 255;
  return r * .299 + g * .587 + b * .114 > 155 ? "#171717" : "#ffffff";
}

function drawBubble(node) {
  const points = shapePoints(node);
  ctx.save();
  traceSmooth(points);
  if (node.style.fill === "solid") ctx.fillStyle = node.color;
  else if (node.style.fill === "tint") ctx.fillStyle = node.color + "35";
  else if (node.style.fill === "blueprint") ctx.fillStyle = "#16456d";
  else ctx.fillStyle = "#ffffff08";
  ctx.fill();
  drawPattern(node, points);
  if (node.style.misregister) {
    strokeBubbleOutline(node, points, "#00a8dfaa", 3 / zoomLevel, { x: -4 / zoomLevel, y: 2 / zoomLevel });
    strokeBubbleOutline(node, points, "#ec198c99", 3 / zoomLevel, { x: 4 / zoomLevel, y: -2 / zoomLevel });
  }
  const outlineColor = node.style.fill === "blueprint" ? "#d9f1ff" : node.style.fill === "outline" ? node.color : "#171717";
  strokeBubbleOutline(node, points, selected === node.id ? "#17221d" : outlineColor, (selected === node.id ? 5 : 3) / zoomLevel);
  if (activeTool === "connect" && linkStart === node.id) {
    ctx.save(); ctx.strokeStyle = "#1f8a57"; ctx.lineWidth = 7 / zoomLevel; ctx.setLineDash([4 / zoomLevel, 4 / zoomLevel]); traceSmooth(points); ctx.stroke(); ctx.restore();
  }

  const small = node.r < 32;
  const label = node.name.length > 18 ? node.name.slice(0, 17) + "…" : node.name;
  const shownArea = node.effectiveArea < node.area * .995 ? "≈" + Math.round(node.effectiveArea).toLocaleString() + " sf" : node.area.toLocaleString() + " sf";
  const darkLabel = node.style.fill === "outline" || node.style.fill === "tint";
  ctx.fillStyle = small || darkLabel ? "#171717" : node.style.fill === "blueprint" ? "#ffffff" : contrastColor(node.color);
  ctx.textAlign = small ? "left" : "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${small ? 11 : 14}px system-ui`;
  ctx.fillText(label, small ? node.x + node.r + 6 : node.x, small ? node.y - 5 : node.y - 7);
  ctx.font = `${small ? 10 : 12}px system-ui`;
  ctx.fillText(shownArea, small ? node.x + node.r + 6 : node.x, small ? node.y + 9 : node.y + 13);
  if (node.pinned && $("#showAnchor").checked) drawFixedAnchor(node);
  ctx.restore();
}

function drawFixedAnchor(node) {
  const size = 9 / zoomLevel;
  ctx.save();
  ctx.strokeStyle = "#171717";
  ctx.fillStyle = "#ffffffdd";
  ctx.lineWidth = 2 / zoomLevel;
  ctx.beginPath(); ctx.arc(node.x, node.y, size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(node.x - size * 1.5, node.y); ctx.lineTo(node.x + size * 1.5, node.y); ctx.moveTo(node.x, node.y - size * 1.5); ctx.lineTo(node.x, node.y + size * 1.5); ctx.stroke();
  ctx.font = `${10 / zoomLevel}px ui-monospace, monospace`;
  ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  const text = `fixed ${Math.round(node.x)}, ${Math.round(node.y)}`;
  const width = ctx.measureText(text).width + 8 / zoomLevel;
  const x = node.x + size * 1.7, y = node.y - size * 1.2;
  ctx.fillRect(x, y - 14 / zoomLevel, width, 15 / zoomLevel);
  ctx.fillStyle = "#171717"; ctx.fillText(text, x + 4 / zoomLevel, y - 2 / zoomLevel);
  ctx.restore();
}

function tracePolygon(points, close = true) {
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  if (close) ctx.closePath();
}

function drawBoundary(boundary, draft = false) {
  if (!draft && boundary.visible === false) return;
  ctx.save();
  const color = draft ? "#276749" : boundary.color;
  ctx.strokeStyle = color;
  ctx.lineWidth = (draft ? 2 : 3) / zoomLevel;
  ctx.setLineDash(draft ? [7 / zoomLevel, 6 / zoomLevel] : boundary.kind === "void" ? [5 / zoomLevel, 5 / zoomLevel] : []);
  ctx.fillStyle = draft ? "#2767490d" : boundary.kind === "void" ? color + "18" : "#ffffff45";
  if (boundary.type === "polygon") { traceSmooth(boundary.points); ctx.fill(); ctx.stroke(); }
  else { ctx.fillRect(boundary.x, boundary.y, boundary.width, boundary.height); ctx.strokeRect(boundary.x, boundary.y, boundary.width, boundary.height); }
  if (!draft) {
    const center = boundaryCenter(boundary);
    ctx.fillStyle = color;
    ctx.font = `600 ${10 / zoomLevel}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(boundary.name.toUpperCase(), center.x, center.y);
  }
  ctx.restore();
}

function drawPolylineDraft() {
  if (!polylineDraft?.length) return;
  ctx.save();
  ctx.strokeStyle = "#276749"; ctx.fillStyle = "#276749"; ctx.lineWidth = 2 / zoomLevel;
  ctx.setLineDash([7 / zoomLevel, 6 / zoomLevel]); tracePolygon(polylineDraft, false); ctx.stroke(); ctx.setLineDash([]);
  polylineDraft.forEach(point => { ctx.beginPath(); ctx.arc(point.x, point.y, 4 / zoomLevel, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

function drawConnections() {
  if (!$("#links").checked) return;
  ctx.save();
  for (const edge of edges) {
    const a = nodes.find(node => node.id === edge.a), b = nodes.find(node => node.id === edge.b);
    if (!a || !b) continue;
    const style = edge.style || $("#connectionStyle").value;
    const weight = +(edge.width ?? +$("#lineWeight").value) / zoomLevel;
    const color = edge.color || $("#connectionColor").value;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = weight; ctx.lineCap = style === "dotted" ? "round" : "butt";
    ctx.setLineDash(style === "sketch" ? [9 / zoomLevel, 7 / zoomLevel] : style === "dotted" ? [1 / zoomLevel, 8 / zoomLevel] : []);
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy)), ux = dx / distance, uy = dy / distance;
    const start = style === "arrow" ? { x: a.x + ux * (a.r + 5), y: a.y + uy * (a.r + 5) } : { x: a.x, y: a.y };
    const end = style === "arrow" ? { x: b.x - ux * (b.r + 9), y: b.y - uy * (b.r + 9) } : { x: b.x, y: b.y };
    const arrowSize = 11 / zoomLevel;
    const shaftEnd = style === "arrow" ? { x: end.x - ux * arrowSize * .92, y: end.y - uy * arrowSize * .92 } : end;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(shaftEnd.x, shaftEnd.y); ctx.stroke();
    if (style === "sketch") { ctx.globalAlpha = .35; ctx.beginPath(); ctx.moveTo(start.x - uy * 3 / zoomLevel, start.y + ux * 3 / zoomLevel); ctx.lineTo(end.x - uy * 3 / zoomLevel, end.y + ux * 3 / zoomLevel); ctx.stroke(); ctx.globalAlpha = 1; }
    if (style === "arrow") drawArrowHead(start.x, start.y, end.x, end.y, color, arrowSize, "filled", weight);
  }
  ctx.restore();
}

function drawArrowHead(x1, y1, x2, y2, color, size, headStyle = "filled", lineWidth = 2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const left = { x: x2 - Math.cos(angle - .48) * size, y: y2 - Math.sin(angle - .48) * size };
  const right = { x: x2 - Math.cos(angle + .48) * size, y: y2 - Math.sin(angle + .48) * size };
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5 / zoomLevel, lineWidth); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.setLineDash([]);
  ctx.beginPath();
  if (headStyle === "open") {
    ctx.moveTo(left.x, left.y); ctx.lineTo(x2, y2); ctx.lineTo(right.x, right.y); ctx.stroke();
  } else {
    ctx.moveTo(x2, y2); ctx.lineTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.closePath();
    if (headStyle === "outline") { ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.stroke(); }
    else ctx.fill();
  }
  ctx.restore();
}

function drawAnnotation(annotation, draft = false) {
  ctx.save();
  const color = draft ? $("#annotationColor").value : annotation.color;
  const width = (draft ? +$("#annotationWeight").value : annotation.width) / zoomLevel;
  const lineStyle = draft ? $("#annotationStyle").value : annotation.lineStyle;
  const headStyle = draft ? $("#annotationHeadStyle").value : annotation.headStyle || "filled";
  const doubleHead = draft ? $("#annotationEnds").value === "double" : !!annotation.doubleHead;
  const dx = annotation.x2 - annotation.x1, dy = annotation.y2 - annotation.y1, distance = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / distance, uy = dy / distance, headSize = Math.max(12 / zoomLevel, width * 4.2);
  const shaftStart = doubleHead ? { x: annotation.x1 + ux * headSize * .92, y: annotation.y1 + uy * headSize * .92 } : { x: annotation.x1, y: annotation.y1 };
  const shaftEnd = { x: annotation.x2 - ux * headSize * .92, y: annotation.y2 - uy * headSize * .92 };
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
  ctx.setLineDash(lineStyle === "dashed" ? [10 / zoomLevel, 7 / zoomLevel] : lineStyle === "dotted" ? [1 / zoomLevel, 8 / zoomLevel] : []);
  ctx.beginPath(); ctx.moveTo(shaftStart.x, shaftStart.y); ctx.lineTo(shaftEnd.x, shaftEnd.y); ctx.stroke();
  drawArrowHead(annotation.x1, annotation.y1, annotation.x2, annotation.y2, color, headSize, headStyle, width);
  if (doubleHead) drawArrowHead(annotation.x2, annotation.y2, annotation.x1, annotation.y1, color, headSize, headStyle, width);
  ctx.restore();
}

function drawDrafts() {
  if (boundaryDraft) drawBoundary({ type: "rect", x: Math.min(boundaryDraft.x1, boundaryDraft.x2), y: Math.min(boundaryDraft.y1, boundaryDraft.y2), width: Math.abs(boundaryDraft.x2 - boundaryDraft.x1), height: Math.abs(boundaryDraft.y2 - boundaryDraft.y1), kind: $("#boundaryKind").value }, true);
  if (freehandDraft?.length > 1) drawBoundary({ type: "polygon", points: freehandDraft, kind: $("#boundaryKind").value }, true);
  drawPolylineDraft();
  if (roomDraft?.length > 1) { ctx.save(); ctx.strokeStyle = "#276749"; ctx.lineWidth = 3 / zoomLevel; ctx.setLineDash([8 / zoomLevel, 5 / zoomLevel]); traceSmooth(roomDraft); ctx.stroke(); ctx.restore(); }
  if (arrowDraft) drawAnnotation(arrowDraft, true);
}

function draw() {
  updateEffectiveAreas();
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(zoomLevel, zoomLevel); ctx.translate(-cameraX, -cameraY);
  const left = cameraX - w / (2 * zoomLevel), right = cameraX + w / (2 * zoomLevel), top = cameraY - h / (2 * zoomLevel), bottom = cameraY + h / (2 * zoomLevel);
  ctx.strokeStyle = "#2767491c"; ctx.lineWidth = 1 / zoomLevel;
  for (let x = Math.floor(left / 32) * 32; x <= right; x += 32) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); }
  for (let y = Math.floor(top / 32) * 32; y <= bottom; y += 32) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
  boundaries.forEach(boundary => drawBoundary(boundary));
  drawConnections();
  nodes.forEach(drawBubble);
  annotations.forEach(annotation => drawAnnotation(annotation));
  drawDrafts();
  ctx.restore();
}

function loop(now) {
  const dt = Math.min(.034, (now - last) / 1000);
  last = now;
  physics(dt);
  draw();
  requestAnimationFrame(loop);
}

function settingsSnapshot() {
  return {
    contain: $("#contain").checked, margin: +$("#margin").value,
    showAnchor: $("#showAnchor").checked,
    links: $("#links").checked, connectionStyle: $("#connectionStyle").value,
    lineWeight: +$("#lineWeight").value, connectionColor: $("#connectionColor").value,
    annotationStyle: $("#annotationStyle").value, annotationWeight: +$("#annotationWeight").value,
    annotationHeadStyle: $("#annotationHeadStyle").value, annotationEnds: $("#annotationEnds").value,
    annotationColor: $("#annotationColor").value,
    defaultStyle: clone(defaultStyle)
  };
}

function projectSnapshot() {
  return {
    schema: "testfit-bubbles", version: 5, exportedAt: new Date().toISOString(),
    nodes: nodes.map(node => ({
      id: node.id, name: node.name, area: node.area, x: node.x, y: node.y,
      vx: 0, vy: 0, pinned: node.pinned, color: node.color, weight: node.weight,
      foam: node.foam, squeeze: node.squeeze, separation: node.separation, mobility: node.mobility,
      shape: node.shape, customPoints: node.customPoints, boundaryId: node.boundaryId,
      sketch: node.sketch, style: node.style
    })),
    edges: clone(edges), boundaries: clone(boundaries), annotations: clone(annotations),
    settings: settingsSnapshot(), view: { zoom: zoomLevel, cameraX, cameraY }
  };
}

function downloadBlob(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportProject() {
  downloadBlob("testfit-project.testfit.json", JSON.stringify(projectSnapshot(), null, 2), "application/json");
  status.textContent = "Editable project file saved.";
}

function loadProject(data) {
  if (!data || data.schema !== "testfit-bubbles" || !Array.isArray(data.nodes)) throw new Error("This is not a TestFit Bubbles project file.");
  const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const legacyFoam = data.settings?.organic !== false;
  const legacySqueeze = clamp(finiteOr(data.settings?.squeeze, 75) / 100, 0, 1);
  const legacySeparation = clamp(finiteOr(data.settings?.push, 70) / 100, 0, 1);
  const legacyPull = clamp(finiteOr(data.settings?.pull, 60) / 100, 0, 1);
  const legacyEdgeStyle = ["sketch", "solid", "dotted", "arrow"].includes(data.settings?.connectionStyle) ? data.settings.connectionStyle : "sketch";
  const legacyEdgeWidth = clamp(finiteOr(data.settings?.lineWeight, 2), 1, 6);
  const legacyEdgeColor = /^#[0-9a-f]{6}$/i.test(data.settings?.connectionColor) ? data.settings.connectionColor : "#276749";
  nodes = data.nodes.map((saved, index) => {
    const area = Math.max(1, Math.round(Number(saved.area) || 1));
    return {
      id: Number(saved.id) || index + 1, name: String(saved.name || `Space ${index + 1}`).slice(0, 28), area, r: radius(area),
      x: finiteOr(saved.x, w / 2), y: finiteOr(saved.y, h / 2), vx: 0, vy: 0,
      pinned: !!saved.pinned, color: /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : COLORS[index % COLORS.length],
      weight: clamp(finiteOr(saved.weight, .5), 0, 1), foam: saved.foam == null ? legacyFoam : !!saved.foam,
      squeeze: clamp(finiteOr(saved.squeeze, legacySqueeze), 0, 1), separation: clamp(finiteOr(saved.separation, legacySeparation), 0, 1),
      mobility: clamp(finiteOr(saved.mobility, 1), 0, 1), effectiveArea: area,
      sketch: { ...randomSketch(), ...(saved.sketch || {}) }, shape: ["circle", "rect", "lshape", "custom"].includes(saved.shape) ? saved.shape : "circle",
      customPoints: Array.isArray(saved.customPoints) ? saved.customPoints.map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 })) : null,
      boundaryId: saved.boundaryId == null ? null : Number(saved.boundaryId), style: { ...DEFAULT_STYLE, ...(saved.style || {}) }
    };
  });
  const ids = new Set(nodes.map(node => node.id));
  edges = Array.isArray(data.edges) ? data.edges.map(edge => {
    if (Array.isArray(edge)) return { a: Number(edge[0]), b: Number(edge[1]), pull: legacyPull, style: legacyEdgeStyle, width: legacyEdgeWidth, color: legacyEdgeColor };
    return {
      a: Number(edge?.a), b: Number(edge?.b), pull: clamp(finiteOr(edge?.pull, legacyPull), 0, 1),
      style: ["sketch", "solid", "dotted", "arrow"].includes(edge?.style) ? edge.style : legacyEdgeStyle,
      width: clamp(finiteOr(edge?.width, legacyEdgeWidth), 1, 6),
      color: /^#[0-9a-f]{6}$/i.test(edge?.color) ? edge.color : legacyEdgeColor
    };
  }).filter(edge => ids.has(edge.a) && ids.has(edge.b) && edge.a !== edge.b) : [];
  boundaries = Array.isArray(data.boundaries) ? data.boundaries.map((boundary, index) => sanitizeBoundary(boundary, index)).filter(Boolean) : [];
  annotations = Array.isArray(data.annotations) ? data.annotations.map((annotation, index) => sanitizeAnnotation(annotation, index)).filter(Boolean) : [];
  nextNodeId = Math.max(0, ...nodes.map(node => node.id)) + 1;
  nextBoundaryId = Math.max(0, ...boundaries.map(boundary => boundary.id)) + 1;
  nextAnnotationId = Math.max(0, ...annotations.map(annotation => annotation.id)) + 1;
  applySettings(data.settings || {});
  if (data.view) {
    cameraX = finiteOr(data.view.cameraX, w / 2); cameraY = finiteOr(data.view.cameraY, h / 2);
    setZoom(finiteOr(data.view.zoom, 1));
  }
  selected = nodes[0]?.id ?? null;
  clearTool(true);
  renderAllControls();
  status.textContent = `Project opened: ${nodes.length} spaces, ${boundaries.length} boundaries, ${annotations.length} annotations.`;
}

function sanitizeBoundary(saved, index) {
  const common = {
    id: Number(saved.id) || index + 1, name: String(saved.name || `Boundary ${index + 1}`).slice(0, 40),
    kind: saved.kind === "void" ? "void" : "outer", color: /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : "#1b2721", visible: saved.visible !== false
  };
  if (saved.type === "rect") return { ...common, type: "rect", x: Number(saved.x) || 0, y: Number(saved.y) || 0, width: Math.max(1, Number(saved.width) || 1), height: Math.max(1, Number(saved.height) || 1) };
  if (saved.type === "polygon" && Array.isArray(saved.points) && saved.points.length >= 3) return { ...common, type: "polygon", points: saved.points.map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 })) };
  return null;
}

function sanitizeAnnotation(saved, index) {
  if (![saved.x1, saved.y1, saved.x2, saved.y2].every(value => Number.isFinite(Number(value)))) return null;
  return {
    id: Number(saved.id) || index + 1, type: "arrow", x1: Number(saved.x1), y1: Number(saved.y1), x2: Number(saved.x2), y2: Number(saved.y2),
    color: /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : "#171717", width: clamp(Number(saved.width) || 3, 1, 8),
    lineStyle: ["solid", "dashed", "dotted"].includes(saved.lineStyle) ? saved.lineStyle : "solid",
    headStyle: ["filled", "open", "outline"].includes(saved.headStyle) ? saved.headStyle : "filled",
    doubleHead: !!saved.doubleHead
  };
}

function applySettings(settings) {
  const assignments = {
    contain: ["#contain", "checked", true], margin: ["#margin", "value", 8],
    showAnchor: ["#showAnchor", "checked", true], links: ["#links", "checked", true], connectionStyle: ["#connectionStyle", "value", "sketch"],
    lineWeight: ["#lineWeight", "value", 2], connectionColor: ["#connectionColor", "value", "#276749"],
    annotationStyle: ["#annotationStyle", "value", "solid"], annotationWeight: ["#annotationWeight", "value", 3],
    annotationHeadStyle: ["#annotationHeadStyle", "value", "filled"], annotationEnds: ["#annotationEnds", "value", "single"],
    annotationColor: ["#annotationColor", "value", "#171717"]
  };
  Object.entries(assignments).forEach(([key, [selector, property, fallback]]) => { $(selector)[property] = settings[key] ?? fallback; });
  defaultStyle = { ...DEFAULT_STYLE, ...(settings.defaultStyle || {}) };
  $("#marginValue").textContent = $("#margin").value + " px";
  $("#lineWeightValue").textContent = $("#lineWeight").value + " px";
  $("#annotationWeightValue").textContent = $("#annotationWeight").value + " px";
}

function svgEscape(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]));
}

function escapeHtml(value) { return svgEscape(value); }
function pathData(points, close = true) { return points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ") + (close ? " Z" : ""); }

function svgDash(style) {
  if (style === "dashed" || style === "sketch") return ' stroke-dasharray="10 7"';
  if (style === "dotted") return ' stroke-dasharray="1 8" stroke-linecap="round"';
  return "";
}

function svgArrowMarkup(x1, y1, x2, y2, color, width, lineStyle, headStyle = "filled", doubleHead = false) {
  const dx = x2 - x1, dy = y2 - y1, distance = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / distance, uy = dy / distance, size = Math.max(12, width * 4.2);
  const shaftStartX = doubleHead ? x1 + ux * size * .92 : x1, shaftStartY = doubleHead ? y1 + uy * size * .92 : y1;
  const shaftX = x2 - ux * size * .92, shaftY = y2 - uy * size * .92;
  const angle = Math.atan2(dy, dx);
  const left = { x: x2 - Math.cos(angle - .48) * size, y: y2 - Math.sin(angle - .48) * size };
  const right = { x: x2 - Math.cos(angle + .48) * size, y: y2 - Math.sin(angle + .48) * size };
  const shaft = `<line x1="${shaftStartX}" y1="${shaftStartY}" x2="${shaftX}" y2="${shaftY}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${svgDash(lineStyle)}/>`;
  const reverseAngle = angle + Math.PI;
  const reverseLeft = { x: x1 - Math.cos(reverseAngle - .48) * size, y: y1 - Math.sin(reverseAngle - .48) * size };
  const reverseRight = { x: x1 - Math.cos(reverseAngle + .48) * size, y: y1 - Math.sin(reverseAngle + .48) * size };
  if (headStyle === "open") {
    const endHead = `<path d="M${left.x} ${left.y} L${x2} ${y2} L${right.x} ${right.y}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const startHead = doubleHead ? `<path d="M${reverseLeft.x} ${reverseLeft.y} L${x1} ${y1} L${reverseRight.x} ${reverseRight.y}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` : "";
    return shaft + endHead + startHead;
  }
  const fill = headStyle === "outline" ? "#ffffff" : color;
  const endHead = `<path d="M${x2} ${y2} L${left.x} ${left.y} L${right.x} ${right.y} Z" fill="${fill}" stroke="${color}" stroke-width="${headStyle === "outline" ? width : 0}" stroke-linejoin="round"/>`;
  const startHead = doubleHead ? `<path d="M${x1} ${y1} L${reverseLeft.x} ${reverseLeft.y} L${reverseRight.x} ${reverseRight.y} Z" fill="${fill}" stroke="${color}" stroke-width="${headStyle === "outline" ? width : 0}" stroke-linejoin="round"/>` : "";
  return shaft + endHead + startHead;
}

function buildSvg() {
  buildShapeProfiles();
  const marker = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker><pattern id="parallel" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#171717" stroke-opacity=".35"/></pattern><pattern id="dots" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#171717" fill-opacity=".35"/></pattern></defs>';
  const boundarySvg = boundaries.filter(boundary => boundary.visible !== false).map(boundary => {
    const dash = boundary.kind === "void" ? ' stroke-dasharray="5 5"' : "";
    const fill = boundary.kind === "void" ? boundary.color + "18" : "#ffffff55";
    if (boundary.type === "rect") return `<rect x="${boundary.x}" y="${boundary.y}" width="${boundary.width}" height="${boundary.height}" fill="${fill}" stroke="${boundary.color}" stroke-width="3"${dash}/>`;
    return `<path d="${pathData(boundary.points)}" fill="${fill}" stroke="${boundary.color}" stroke-width="3"${dash}/>`;
  }).join("");
  const connectionSvg = $("#links").checked ? edges.map(edge => {
    const a = nodes.find(node => node.id === edge.a), b = nodes.find(node => node.id === edge.b);
    if (!a || !b) return "";
    const style = edge.style || $("#connectionStyle").value;
    const color = edge.color || $("#connectionColor").value;
    const width = edge.width ?? +$("#lineWeight").value;
    if (style === "arrow") return svgArrowMarkup(a.x, a.y, b.x, b.y, color, width, "solid", "filled");
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${width}"${svgDash(style)}/>`;
  }).join("") : "";
  const nodeSvg = nodes.map(node => {
    const points = shapePoints(node);
    const closed = pathData(points);
    const fill = node.style.fill === "solid" ? node.color : node.style.fill === "tint" ? node.color + "35" : node.style.fill === "blueprint" ? "#16456d" : "none";
    const outline = node.style.fill === "blueprint" ? "#d9f1ff" : node.style.fill === "outline" ? node.color : "#171717";
    const pattern = node.style.pattern === "none" ? "" : `<path d="${closed}" fill="url(#${node.style.pattern})"/>`;
    const misregister = node.style.misregister ? `<path d="${closed}" fill="none" stroke="#00a8df" stroke-opacity=".65" stroke-width="3" transform="translate(-4 2)"/><path d="${closed}" fill="none" stroke="#ec198c" stroke-opacity=".6" stroke-width="3" transform="translate(4 -2)"/>` : "";
    const outlinePoints = node.style.outline === "open" ? openOutlinePoints(node, points) : points;
    const outlinePath = pathData(outlinePoints, node.style.outline !== "open");
    const labelColor = node.style.fill === "outline" || node.style.fill === "tint" ? "#171717" : node.style.fill === "blueprint" ? "#ffffff" : contrastColor(node.color);
    const anchor = node.pinned && $("#showAnchor").checked ? `<g stroke="#171717" stroke-width="2" fill="#fff"><circle cx="${node.x}" cy="${node.y}" r="9"/><path d="M${node.x - 13} ${node.y}H${node.x + 13}M${node.x} ${node.y - 13}V${node.y + 13}"/></g><text x="${node.x + 14}" y="${node.y - 12}" font-family="monospace" font-size="10">fixed ${Math.round(node.x)}, ${Math.round(node.y)}</text>` : "";
    return `<g>${misregister}<path d="${closed}" fill="${fill}"/>${pattern}<path d="${outlinePath}" fill="none" stroke="${outline}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"${svgDash(node.style.outline)}/><text x="${node.x}" y="${node.y - 5}" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="600" fill="${labelColor}">${svgEscape(node.name)}</text><text x="${node.x}" y="${node.y + 14}" text-anchor="middle" font-family="system-ui" font-size="12" fill="${labelColor}">${Math.round(node.effectiveArea).toLocaleString()} sf</text>${anchor}</g>`;
  }).join("");
  const annotationSvg = annotations.map(annotation => svgArrowMarkup(annotation.x1, annotation.y1, annotation.x2, annotation.y2, annotation.color, annotation.width, annotation.lineStyle, annotation.headStyle, annotation.doubleHead)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}"><rect width="100%" height="100%" fill="#f7f9f6"/>${marker}${boundarySvg}${connectionSvg}${nodeSvg}${annotationSvg}</svg>`;
}

$("#addForm").onsubmit = event => {
  event.preventDefault();
  const name = $("#name").value.trim(), area = Math.round(+$("#area").value);
  if (!name || !Number.isFinite(area) || area < 1) return;
  const node = createNode(name, area);
  nodes.push(node);
  selected = node.id;
  renderAllControls();
  $("#name").value = "";
  $("#name").focus();
  status.textContent = `${name} added and selected.`;
};

$("#margin").oninput = event => { $("#marginValue").textContent = event.target.value + " px"; };
$("#zoom").oninput = event => setZoom(+event.target.value / 100);
$("#zoomIn").onclick = () => setZoom(zoomLevel + .1);
$("#zoomOut").onclick = () => setZoom(zoomLevel - .1);
$("#zoomReset").onclick = () => { cameraX = w / 2; cameraY = h / 2; setZoom(1); };
$("#lineWeight").oninput = event => { $("#lineWeightValue").textContent = event.target.value + " px"; };
$("#annotationWeight").oninput = event => { $("#annotationWeightValue").textContent = event.target.value + " px"; };

$("#fillStyle").onchange = event => applyStyle("fill", event.target.value);
$("#outlineStyle").onchange = event => applyStyle("outline", event.target.value);
$("#patternStyle").onchange = event => applyStyle("pattern", event.target.value);
$("#sketchEffect").onchange = event => applyStyle("sketch", event.target.checked);
$("#misregisterEffect").onchange = event => applyStyle("misregister", event.target.checked);
$("#randomizeSketch").onclick = () => {
  const node = selectedNode();
  if (!node) { status.textContent = "Select a space before randomizing its outline."; return; }
  node.sketch = randomSketch();
  status.textContent = `${node.name} sketch outline randomized.`;
};
$("#selectedColor").oninput = event => {
  const node = selectedNode();
  if (!node) return;
  node.color = event.target.value;
  const swatch = list.querySelector(".item.selected .area-swatch");
  if (swatch) swatch.style.background = node.color;
};
$("#spaceFoam").onchange = event => {
  const node = selectedNode(); if (!node) return;
  node.foam = event.target.checked; $("#spaceSqueeze").disabled = !node.foam;
  status.textContent = `${node.name} ${node.foam ? "will participate in foam squeezing" : "will retain its base geometry"}.`;
};
$("#spaceSqueeze").oninput = event => {
  const node = selectedNode(); if (!node) return;
  node.squeeze = +event.target.value / 100; $("#spaceSqueezeValue").textContent = event.target.value + "%";
};
$("#selectedWeight").oninput = event => {
  const node = selectedNode(); if (!node) return;
  node.weight = +event.target.value; $("#selectedWeightValue").textContent = node.weight.toFixed(2);
};
$("#spaceSeparation").oninput = event => {
  const node = selectedNode(); if (!node) return;
  node.separation = +event.target.value / 100; $("#spaceSeparationValue").textContent = event.target.value + "%";
};
$("#spaceMobility").oninput = event => {
  const node = selectedNode(); if (!node) return;
  node.mobility = +event.target.value / 100;
  if (node.mobility === 0) node.vx = node.vy = 0;
  $("#spaceMobilityValue").textContent = event.target.value + "%";
};

$("#drawBoundary").onclick = () => setTool("boundary-rect");
$("#sketchBoundary").onclick = () => setTool("boundary-freehand");
$("#polylineBoundary").onclick = () => setTool("boundary-polyline");
$("#finishPolyline").onclick = finishPolyline;
$("#importSvgBoundary").onclick = () => $("#svgBoundaryFile").click();
$("#svgBoundaryFile").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try { importSvgBoundaries(await file.text()); }
  catch (error) { status.textContent = `Could not use SVG boundary: ${error.message}`; }
  event.target.value = "";
};
$("#drawArrow").onclick = () => setTool("annotation-arrow");
$("#connectSpaces").onclick = () => setTool("connect");
$("#sketchRoom").onclick = () => selectedNode() ? setTool("room-custom") : status.textContent = "Select a space before sketching its room shape.";
$("#clearAnnotations").onclick = () => { annotations = []; renderAnnotations(); status.textContent = "All annotations cleared."; };
$("#contain").onchange = () => nodes.forEach(node => constrain(node, false));

$("#roomShape").onchange = event => {
  const node = selectedNode();
  if (!node) return;
  if (event.target.value === "custom" && !node.customPoints) { setTool("room-custom"); return; }
  node.shape = event.target.value;
  node.profile = null;
  status.textContent = `${node.name} changed to ${event.target.options[event.target.selectedIndex].text.toLowerCase()}.`;
};
$("#selectedAreaName").onchange = event => {
  const node = selectedNode(), name = event.target.value.trim();
  if (!node || !name) { if (node) event.target.value = node.name; return; }
  node.name = name.slice(0, 28);
  renderList(); syncInspector(); renderLinkState();
  status.textContent = `Area renamed to ${node.name}.`;
};
$("#selectedAreaSize").onchange = event => {
  const node = selectedNode(), area = Math.round(+event.target.value);
  if (!node || !Number.isFinite(area) || area < 1) { if (node) event.target.value = node.area; return; }
  node.area = area; node.r = radius(area); node.effectiveArea = area; node.profile = null;
  renderList(); syncInspector();
  status.textContent = `${node.name} updated to ${area.toLocaleString()} sf.`;
};
$("#spaceBoundary").onchange = event => {
  const node = selectedNode();
  if (!node) return;
  node.boundaryId = event.target.value ? +event.target.value : null;
  constrain(node, false);
  status.textContent = node.boundaryId ? `${node.name} assigned to ${boundaries.find(boundary => boundary.id === node.boundaryId)?.name}.` : `${node.name} boundary assignment set to automatic.`;
};
for (const [selector, axis] of [["#coordX", "x"], ["#coordY", "y"]]) $(selector).onchange = event => {
  const node = selectedNode(), value = Number(event.target.value);
  if (!node || !Number.isFinite(value)) return;
  node[axis] = value; node.pinned = true; node.vx = node.vy = 0; constrain(node, false);
  status.textContent = `${node.name} moved to (${Math.round(node.x)}, ${Math.round(node.y)}) and fixed.`;
  renderList(); syncInspector();
};
$("#pinSpace").onclick = () => { const node = selectedNode(); if (node) togglePin(node); };

$("#reset").onclick = reset;
$("#reflow").onclick = () => {
  nodes.forEach((node, index) => {
    if (node.pinned) return;
    const boundary = outerBoundaryFor(node), center = boundary ? boundaryCenter(boundary) : { x: cameraX, y: cameraY };
    node.x = center.x + Math.cos(index * 2.3) * 100; node.y = center.y + Math.sin(index * 2.3) * 100;
    node.vx = node.vy = 0; constrain(node, false);
  });
  status.textContent = "Movable spaces reflowed; fixed spaces stayed in place.";
};

$("#exportProject").onclick = exportProject;
$("#importProject").onclick = () => $("#projectFile").click();
$("#projectFile").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try { loadProject(JSON.parse(await file.text())); }
  catch (error) { status.textContent = `Could not open project: ${error.message}`; }
  event.target.value = "";
};
$("#exportSvg").onclick = () => { downloadBlob("testfit-diagram.svg", buildSvg(), "image/svg+xml"); status.textContent = "Editable SVG exported."; };
$("#exportPng").onclick = () => { draw(); const anchor = document.createElement("a"); anchor.download = "testfit-diagram.png"; anchor.href = canvas.toDataURL("image/png"); anchor.click(); status.textContent = "PNG exported."; };
$("#printLayout").onclick = () => { draw(); window.print(); };

new ResizeObserver(resize).observe(canvas);
resize();
applySettings({});
reset();
requestAnimationFrame(loop);
