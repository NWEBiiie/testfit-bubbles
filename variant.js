(() => {
  const stages = {
    "stage-1-core": {
      number: "01",
      title: "Core circles, physics, and links",
      includes: "Area-sized circles · Collision physics · Connecting lines",
      apply() {
        hideProjectFiles();
        hideExportActions();
        hideBoundaries();
        hideAnnotations();
        hideFluidity();
        hideAreaProtection();
        hideGeometry();
        hideLocationTools();
        hideAppearance();
        hideLinkDefaults();
        hideLinkTuning();
        hide("#toolsPanel", '.mobile-dock a[href="#toolsPanel"]');
        document.body.classList.add("variant-no-right-panel");
      },
    },
    "stage-2-boundaries-fluid": {
      number: "02",
      title: "Boundaries and fluid behavior",
      includes: "Stage 1 · Drawn boundaries · Fluidity · Area protection",
      apply() {
        hideProjectFiles();
        hideExportActions();
        hideAnnotations();
        hideSvgBoundaryImport();
        hideGeometry();
        hideLocationTools();
        hideAppearance();
        hideLinkDefaults();
        hideLinkTuning();
      },
    },
    "stage-3-style": {
      number: "03",
      title: "Style and presentation controls",
      includes: "Stage 2 · Colors · Fills · Sketch outlines · Link styles",
      apply() {
        hideProjectFiles();
        hide("#exportSvg", "#printLayout");
        hideAnnotations();
        hideSvgBoundaryImport();
        hideGeometry();
        hideLocationTools();
        hideLinkTuning();
      },
    },
    "stage-4-advanced": {
      number: "04",
      title: "Advanced drafting and editing",
      includes: "Stage 3 · Custom shapes · Location locks · SVG boundaries · Annotations · Per-link tuning",
      apply() {
        hideProjectFiles();
      },
    },
  };

  function hide(...selectors) {
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.hidden = true;
        element.style.display = "none";
      });
    });
  }

  function hideControl(selector) {
    const control = document.querySelector(selector);
    if (!control) return;
    const wrappedLabel = control.closest("label");
    const associatedLabel = control.id ? document.querySelector(`label[for="${control.id}"]`) : null;
    const precedingLabel = control.previousElementSibling?.matches("label") ? control.previousElementSibling : null;
    [wrappedLabel, associatedLabel, precedingLabel, control].forEach(element => {
      if (!element) return;
      element.hidden = true;
      element.style.display = "none";
    });
  }

  function hideHeading(label) {
    document.querySelectorAll(".subsection-heading").forEach(heading => {
      if (heading.textContent.trim().startsWith(label)) {
        heading.hidden = true;
        heading.style.display = "none";
      }
    });
  }

  function hideProjectFiles() {
    hide("#exportProject", "#importProject", "#projectFile");
  }

  function hideExportActions() {
    hide("#exportSvg", "#exportPng", "#printLayout");
  }

  function hideBoundaries() {
    const section = document.querySelector("#boundaryKind")?.closest("section");
    if (section) section.hidden = true;
  }

  function hideAnnotations() {
    const section = document.querySelector("#drawArrow")?.closest("section");
    if (section) section.hidden = true;
  }

  function hideSvgBoundaryImport() {
    hide("#importSvgBoundary", "#svgBoundaryFile");
  }

  function hideFluidity() {
    hideControl("#spaceFoam");
    hideControl("#spaceSqueeze");
  }

  function hideAreaProtection() {
    hideControl("#selectedWeight");
  }

  function hideGeometry() {
    hideControl("#roomShape");
    hide("#sketchRoom");
    hideControl("#spaceBoundary");
  }

  function hideLocationTools() {
    hide(".coordinate-grid", "#pinSpace");
    hideControl("#showAnchor");
    document.querySelector("#diagram")?.addEventListener("dblclick", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function hideAppearance() {
    hideHeading("Selected appearance");
    ["#selectedColor", "#fillStyle", "#outlineStyle", "#patternStyle", "#sketchEffect", "#misregisterEffect"].forEach(hideControl);
    hide("#randomizeSketch");
  }

  function hideLinkDefaults() {
    hideHeading("New link defaults");
    ["#connectionStyle", "#lineWeight", "#connectionColor"].forEach(hideControl);
  }

  function hideLinkTuning() {
    document.body.classList.add("variant-no-edge-controls");
  }

  const aliases = {
    "no-project-annotations": "stage-1-core",
    "no-svg-custom": "stage-2-boundaries-fluid",
    "no-edge-controls": "stage-3-style",
    "no-location-tools": "stage-4-advanced",
  };
  const requestedKey = new URLSearchParams(location.search).get("variant") || "stage-4-advanced";
  const key = aliases[requestedKey] || requestedKey;
  const stage = stages[key] || stages["stage-4-advanced"];
  document.title = "TestFit Bubbles";
  document.body.dataset.variant = key;
  stage.apply();
})();
