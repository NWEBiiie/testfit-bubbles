// Editable test-fit combining the floor-plan photo with the later measured shell sketch.
// Coordinates are FEET, not photo pixels. Room areas remain preliminary estimates.
// Do not include the private source photographs in the public site.
window.TESTFIT_DEFAULT_PROJECT = (() => {
  const groups = {
    surgery: { name: "Operating rooms", color: "#e9a3bc" },
    patient: { name: "Pre-op / recovery", color: "#9bcddd" },
    support: { name: "Clinical / sterile support", color: "#b4cda2" },
    staff: { name: "Staff / changing", color: "#94b791" },
    admin: { name: "Reception / administration", color: "#edcc93" },
    public: { name: "Waiting / public", color: "#bba3ca" },
    plant: { name: "Building services", color: "#c1c2cb" }
  };
  // key, name, estimated sf, group, left (ft), top (ft), width (ft).
  // Depth = sf / width, keeping geometry, labels and scaled exports consistent.
  const roomRows = [
    ["or4", "OR 4", 543, "surgery", 44, 43.5, 24],
    ["or3", "OR 3", 590, "surgery", 69, 43.5, 26],
    ["or2", "OR 2", 600, "surgery", 96, 43.5, 25],
    ["or1", "OR 1", 468, "surgery", 122, 43.5, 24],
    ["pacu1", "PACU 1", 90, "patient", 2, 40, 10],
    ["pacu2", "PACU 2", 90, "patient", 2, 49.8, 10],
    ["pacu3", "PACU 3", 90, "patient", 2, 59.6, 10],
    ["pacu4", "PACU 4", 88, "patient", 2, 69.4, 10],
    ["pacu5", "PACU 5", 88, "patient", 2, 79.2, 10],
    ["pacu6", "PACU 6", 90, "patient", 2, 89, 10],
    ["pacu7", "PACU 7", 90, "patient", 2, 98.8, 10],
    ["pacu8", "PACU 8", 110, "patient", 21, 53.5, 12],
    ["pacu9", "PACU 9", 140, "patient", 21, 41, 12],
    ["preopB", "Pre-op bariatric", 78, "patient", 22, 105, 8],
    ["preop1", "Pre-op 1", 90, "patient", 30.8, 105, 9],
    ["preop2", "Pre-op 2", 90, "patient", 40.6, 105, 9],
    ["preop3", "Pre-op 3", 90, "patient", 50.4, 105, 9],
    ["preop4", "Pre-op 4", 90, "patient", 60.2, 105, 9],
    ["preop5", "Pre-op 5", 90, "patient", 70, 105, 9],
    ["preop6", "Pre-op 6", 90, "patient", 79.8, 105, 9],
    ["decon", "Decontamination", 400, "support", 92, 18, 19],
    ["assembly", "Clean assembly", 440, "support", 112, 18, 20],
    ["sterile", "Sterile storage", 215, "support", 133, 22, 13],
    ["receivingW", "Receiving west", 140, "support", 30, 12, 12],
    ["biowaste", "Bio waste / soiled", 98, "support", 43, 12, 9],
    ["general", "General storage", 102, "support", 30, 25, 12],
    ["pacuTlt", "PACU toilet", 73, "support", 2, 33.6, 11.6],
    ["soiledW", "Soiled utility west", 118, "support", 34, 41, 8],
    ["cleanW", "Clean utility west", 86, "support", 34, 56.75, 8],
    ["nurse", "Nurse station", 288, "support", 22, 75, 21],
    ["supplies", "Supply storage", 84, "support", 29, 75, 12],
    ["equipment", "Equipment storage", 287, "support", 43, 75, 26],
    ["meds", "Meds", 65, "support", 44, 88, 8],
    ["clean", "Clean utility", 85, "support", 53, 88, 9],
    ["soiled", "Soiled utility", 88, "support", 63, 88, 9],
    ["clinicalTlt", "Clinical toilet", 78, "support", 72, 77, 9],
    ["preopTlt", "Pre-op toilet", 76, "support", 90, 105, 7.6],
    ["wheelchair", "Wheelchair storage", 66, "support", 2, 109, 11],
    ["receivingE", "Receiving east", 57, "support", 143.4, 11, 6],
    ["sterileTlt", "Sterile-area toilet", 54, "support", 138, 11, 5],
    ["lounge", "Staff lounge", 490, "staff", 149, 32, 27],
    ["lockerM", "Locker / toilet men", 224, "staff", 149, 33 + 490 / 27, 27],
    ["lockerW", "Locker / toilet women", 300, "staff", 149, 34 + (490 + 224) / 27, 27],
    ["reception", "Reception", 225, "admin", 99, 75, 25],
    ["records", "Office / medical records", 100, "admin", 87, 75, 10],
    ["consult", "Consult", 100, "admin", 87, 89, 10],
    ["manager", "Nurse manager", 90, "admin", 73, 89, 9],
    ["control", "Control", 30, "admin", 72, 72.5, 10],
    ["waiting", "Waiting room", 329, "public", 103, 99, 23],
    ["work", "Anesthesia work", 88, "public", 125, 75, 7.5],
    ["publicTlt", "Public toilet", 58, "public", 125, 108, 7.5],
    ["mech", "Mechanical / med gas", 362, "plant", 76, 6, 35],
    ["emergency", "Emergency electrical", 202, "plant", 112, 1, 14],
    ["electrical", "Electrical", 200, "plant", 126.5, -1.4, 11],
    ["riser", "Riser / utility", 75, "plant", 139, 0, 8],
    ["ro", "RO water", 126, "plant", 64, 30, 13],
    ["building", "Building electrical", 100, "plant", 76, 18, 14],
    ["boiler", "Boiler", 70, "plant", 78, 27, 6],
    ["utility", "Utility", 81, "plant", 85, 26, 6]
  ];
  const rooms = roomRows.map(([key, name, area, group, x, y, width]) => {
    let height = area / width, points = null;
    if (key === "or4" || key === "or1") {
      // Clipped entry corners from the room-plan photograph, not rounded edges.
      const clip = 3;
      height = (area + clip * clip / 2) / width;
      points = key === "or4"
        ? [[x + clip, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y + clip]]
        : [[x, y], [x + width - clip, y], [x + width, y + clip], [x + width, y + height], [x, y + height]];
    }
    if (key === "nurse") {
      height = (area + 15 * 12) / 21;
      points = [[22,75],[28,75],[28,87],[43,87],[43,75 + height],[22,75 + height]];
    }
    if (key === "waiting") {
      height = 16;
      points = [[103,99],[126,99],[126,107.2],[121,107.2],[121,115],[103,115]];
    }
    return { key, name, area, group, x, y, width, height, points, shape: points ? "custom" : "rect" };
  });
  // Editable adjacency suggestions, not a clinical workflow specification.
  const links = [
    ["decon", "assembly"], ["assembly", "sterile"],
    ["receivingW", "general"], ["receivingW", "biowaste"], ["receivingE", "sterile"],
    ["sterile", "or1"], ["assembly", "or2"], ["assembly", "or3"], ["decon", "or4"],
    ["or4", "pacu9"], ["or4", "pacu8"], ["or4", "soiledW"], ["or4", "cleanW"],
    ["lounge", "lockerM"], ["lockerM", "lockerW"],
    ["waiting", "reception"], ["waiting", "consult"], ["waiting", "publicTlt"],
    ["reception", "records"], ["reception", "preop6"], ["reception", "work"],
    ["nurse", "supplies"], ["nurse", "equipment"], ["nurse", "meds"],
    ["nurse", "clean"], ["nurse", "soiled"], ["nurse", "manager"], ["nurse", "clinicalTlt"],
    ["nurse", "preopB"], ["pacu7", "wheelchair"], ["preop6", "preopTlt"],
    ...Array.from({ length: 7 }, (_, i) => ["nurse", "pacu" + (i + 1)]),
    ...Array.from({ length: 6 }, (_, i) => ["nurse", "preop" + (i + 1)])
  ];
  const overallWidth = 177, leftDepth = 85.5, bottom = 116;
  const ledgeY = bottom - leftDepth, leftLedge = 24.5, rightLedge = 24;
  const leftRise = 19 + 8 / 12, rightRise = 35 + 4 / 12, topLength = 123 + 8 / 12;
  const tilt = 7 * Math.PI / 180; // Handwritten shoulder angles: 83° / 97°.
  const upperLeft = [3 + leftLedge - leftRise * Math.sin(tilt), ledgeY - leftRise * Math.cos(tilt)];
  const topDy = -(rightRise - leftRise) * Math.cos(tilt);
  const upperRight = [upperLeft[0] + Math.sqrt(topLength * topLength - topDy * topDy), upperLeft[1] + topDy];
  const rightShoulder = [upperRight[0] + rightRise * Math.sin(tilt), ledgeY];
  const notchY = ledgeY + 42;
  // Infer notch width from the excluded 1,919 sf label + 42' return.
  // End jogs are approximate: handwritten dimensions do not make a closed survey.
  const notchX = overallWidth - 1919 / (bottom - notchY);
  const outline = [[0,bottom],[0,33.5],[3,33.5],[3,ledgeY],[3 + leftLedge,ledgeY],
    upperLeft, upperRight, rightShoulder, [rightShoulder[0] + rightLedge,ledgeY],
    [rightShoulder[0] + rightLedge,32],[overallWidth,32],[overallWidth,notchY],
    [notchX,notchY],[notchX,bottom]];
  return {
    title: "Surgical center · site-fit study",
    source: "User-supplied floor-plan photograph and measured site sketch",
    note: "Shell follows the 177′ overall width, 85′-6″ left depth and angled top in your sketch. The hatched 1,919 sf corner is outside the boundary, not a room. Small shell jogs and the notch width are inferred; room dimensions, areas and relationships remain schematic, not surveyed.",
    units: "feet", groups, rooms, links, outline,
    dimensions: { overallWidth, leftDepth, leftLedge, rightLedge, leftRise, rightRise, topLength, rightReturn: 42 },
    excludedCorner: { x: notchX, y: notchY, width: overallWidth - notchX, height: bottom - notchY, area: 1919 },
    entries: [
      { start: [100,122], end: [100,114], color: "#84629c" },
      { start: [1,107], end: [-7,107], color: "#4c8ba4" },
      { start: [35,5], end: [35,12], color: "#6d8757" },
      { start: [184,35], end: [175,35], color: "#638466" }
    ]
  };
})();
