// Schematic transcription of the user's Photo 1.jpg, not a surveyed floor plan.
// Positions follow the photo; all room areas remain preliminary estimates.
// Do not fetch the private source photo or publish it with this preset.
window.TESTFIT_DEFAULT_PROJECT = (() => {
  const groups = {
    surgery: { name: "Operating rooms", color: "#e9a3bc" },
    patient: { name: "Pre-op / recovery", color: "#9bcddd" },
    support: { name: "Clinical / sterile support", color: "#b4cda2" },
    staff: { name: "Staff / changing", color: "#94b791" },
    admin: { name: "Reception / administration", color: "#edcc93" },
    public: { name: "Waiting / public", color: "#bba3ca" },
    plant: { name: "Building services", color: "#c1c2cb" },
    future: { name: "Available space", color: "#dddcd5" }
  };
  // key, displayed name, sf, photo x, photo y, color group
  const rooms = [
    ["or4", "OR 4", 543, 475, 366, "surgery"],
    ["or3", "OR 3", 590, 615, 369, "surgery"],
    ["or2", "OR 2", 600, 762, 374, "surgery"],
    ["or1", "OR 1", 468, 909, 380, "surgery"],
    ["pacu1", "PACU 1", 90, 218, 320, "patient"],
    ["pacu2", "PACU 2", 90, 218, 369, "patient"],
    ["pacu3", "PACU 3", 90, 218, 420, "patient"],
    ["pacu4", "PACU 4", 88, 218, 473, "patient"],
    ["pacu5", "PACU 5", 88, 218, 526, "patient"],
    ["pacu6", "PACU 6", 90, 218, 579, "patient"],
    ["pacu7", "PACU 7", 90, 218, 632, "patient"],
    ["pacu8", "PACU 8", 110, 325, 371, "patient"],
    ["pacu9", "PACU 9", 140, 325, 322, "patient"],
    ["preopB", "Pre-op bariatric", 78, 325, 660, "patient"],
    ["preop1", "Pre-op 1", 90, 378, 660, "patient"],
    ["preop2", "Pre-op 2", 90, 430, 660, "patient"],
    ["preop3", "Pre-op 3", 90, 482, 660, "patient"],
    ["preop4", "Pre-op 4", 90, 534, 660, "patient"],
    ["preop5", "Pre-op 5", 90, 586, 660, "patient"],
    ["preop6", "Pre-op 6", 90, 638, 660, "patient"],
    ["decon", "Decontamination", 400, 726, 225, "support"],
    ["assembly", "Clean assembly", 440, 849, 226, "support"],
    ["sterile", "Sterile storage", 215, 968, 236, "support"],
    ["receivingW", "Receiving west", 140, 373, 166, "support"],
    ["biowaste", "Bio waste / soiled", 98, 432, 150, "support"],
    ["general", "General storage", 102, 379, 228, "support"],
    ["pacuTlt", "PACU toilet", 73, 228, 269, "support"],
    ["soiledW", "Soiled utility west", 118, 381, 326, "support"],
    ["cleanW", "Clean utility west", 86, 381, 393, "support"],
    ["nurse", "Nurse station", 288, 332, 552, "support"],
    ["supplies", "Supply storage", 84, 370, 495, "support"],
    ["equipment", "Equipment storage", 287, 477, 496, "support"],
    ["meds", "Meds", 65, 420, 564, "support"],
    ["clean", "Clean utility", 85, 478, 564, "support"],
    ["soiled", "Soiled utility", 88, 533, 564, "support"],
    ["clinicalTlt", "Clinical toilet", 78, 582, 512, "support"],
    ["preopTlt", "Pre-op toilet", 76, 690, 659, "support"],
    ["wheelchair", "Wheelchair storage", 66, 207, 710, "support"],
    ["receivingE", "Receiving east", 57, 977, 165, "support"],
    ["sterileTlt", "Sterile-area toilet", 54, 948, 192, "support"],
    ["lounge", "Staff lounge", 490, 1077, 322, "staff"],
    ["lockerM", "Locker / toilet men", 224, 1077, 402, "staff"],
    ["lockerW", "Locker / toilet women", 300, 1077, 465, "staff"],
    ["reception", "Reception", 225, 784, 520, "admin"],
    ["records", "Office / medical records", 100, 684, 501, "admin"],
    ["consult", "Consult", 100, 684, 570, "admin"],
    ["manager", "Nurse manager", 90, 588, 572, "admin"],
    ["control", "Control", 30, 582, 470, "admin"],
    ["waiting", "Waiting room", 329, 797, 623, "public"],
    ["work", "Anesthesia work", 88, 864, 504, "public"],
    ["publicTlt", "Public toilet", 58, 867, 664, "public"],
    ["mech", "Mechanical / med gas", 362, 698, 143, "plant"],
    ["emergency", "Emergency electrical", 202, 832, 137, "plant"],
    ["electrical", "Electrical", 200, 914, 133, "plant"],
    ["riser", "Riser / utility", 75, 971, 117, "plant"],
    ["ro", "RO water", 126, 554, 232, "plant"],
    ["building", "Building electrical", 100, 627, 191, "plant"],
    ["boiler", "Boiler", 70, 611, 249, "plant"],
    ["utility", "Utility", 81, 651, 252, "plant"],
    ["future", "Available space", 1919, 1030, 605, "future"]
  ];
  // These are editable adjacency suggestions, not claimed clinical workflow.
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
    ...Array.from({ length: 7 }, (_, i) => ["nurse", `pacu${i + 1}`]),
    ...Array.from({ length: 6 }, (_, i) => ["nurse", `preop${i + 1}`])
  ];
  return {
    title: "Surgical center · photo study",
    source: "Photo 1.jpg supplied by the user",
    note: "Schematic from your photo. Areas, minor-room names, outline and relationships are preliminary; verify against the original drawing. Uncolored corridors are left as circulation space.",
    groups, rooms, links,
    // Trace the main occupied footprint, excluding the stair and outer access routes.
    outline: [[175,245],[333,245],[333,128],[515,128],[515,103],[1005,103],[1005,273],[1150,273],[1150,720],[175,720]],
    entries: [
      { start: [738,753], end: [738,710], color: "#84629c" },
      { start: [173,687], end: [122,687], color: "#4c8ba4" },
      { start: [365,92], end: [365,130], color: "#6d8757" },
      { start: [1190,298], end: [1138,298], color: "#638466" }
    ]
  };
})();
