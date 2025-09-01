// Demand Response Simulator Game Data
const gameData = {
  customerTypes: {
    residential: {
      name: "Residential",
      peakMin: 2,
      peakMax: 8,
      tech: ["smart_thermostat", "ev_charging", "water_heater", "pool_pump"],
      curtail: 30,
      loadProfile: [0.3,0.25,0.2,0.2,0.25,0.4,0.6,0.8,0.7,0.6,0.7,0.8,0.9,0.95,1.0,0.95,0.9,1.0,1.0,0.95,0.8,0.7,0.5,0.4]
    },
    commercial: {
      name: "Commercial",
      peakMin: 50,
      peakMax: 500,
      tech: ["hvac_control", "lighting_control", "equipment_cycling", "battery_storage"],
      curtail: 25,
      loadProfile: [0.2,0.15,0.1,0.1,0.15,0.3,0.6,0.8,0.9,0.95,1.0,0.95,0.9,0.95,1.0,0.95,0.9,0.8,0.6,0.4,0.3,0.25,0.2,0.2]
    },
    industrial: {
      name: "Industrial",
      peakMin: 500,
      peakMax: 5000,
      tech: ["process_control", "motor_drives", "compressed_air", "thermal_storage"],
      curtail: 20,
      loadProfile: [0.9,0.85,0.8,0.8,0.85,0.9,0.95,1.0,1.0,1.0,1.0,1.0,0.95,1.0,1.0,1.0,1.0,0.95,0.9,0.9,0.9,0.9,0.9,0.9]
    },
    aggregator: {
      name: "Aggregator",
      peakMin: 100,
      peakMax: 10000,
      tech: ["portfolio_optimization", "ev_fleet", "building_portfolio", "battery_fleet"],
      curtail: 35,
      loadProfile: [0.45,0.4,0.4,0.5,0.55,0.7,0.7,0.8,0.85,0.9,0.98,1.0,1.0,1.0,1.0,0.93,0.9,0.98,1.0,0.9,0.8,0.7,0.6,0.6]
    }
  },
  drTech: {
    smart_thermostat: {name:"Smart Thermostat", curtail:15, impact:"Low"},
    ev_charging: {name:"EV Charging", curtail:25, impact:"None"},
    water_heater: {name:"Water Heater", curtail:10, impact:"Low"},
    pool_pump: {name:"Pool Pump", curtail:20, impact:"None"},
    hvac_control: {name:"HVAC Control", curtail:30, impact:"Medium"},
    lighting_control: {name:"Lighting Control", curtail:10, impact:"Low"},
    equipment_cycling: {name:"Equipment Cycling", curtail:20, impact:"Medium"},
    battery_storage: {name:"Battery Storage", curtail:40, impact:"None"},
    process_control: {name:"Process Control", curtail:35, impact:"High"},
    motor_drives: {name:"Motor Drives", curtail:15, impact:"Medium"},
    compressed_air: {name:"Compressed Air", curtail:20, impact:"Low"},
    thermal_storage: {name:"Thermal Storage", curtail:10, impact:"None"},
    portfolio_optimization: {name:"Portfolio Opt.", curtail:25, impact:"None"},
    ev_fleet: {name:"EV Fleet DR", curtail:20, impact:"None"},
    building_portfolio: {name:"Building Portfolio", curtail:28, impact:"Medium"},
    battery_fleet: {name:"Battery Fleet", curtail:35, impact:"None"}
  },
  ratePlans: {
    tou: {name:"TOU", offPeak:0.08, midPeak:0.12, peak:0.20, criticalPeak:null},
    cpp: {name:"CPP", offPeak:0.07, midPeak:0.11, peak:0.18, criticalPeak:0.75},
    rtp: {name:"RTP", min:0.05, max:1.50}
  }
};

// Global game state
let gameState = {
  customerType: "residential",
  peakDemand: 5,
  selectedTechs: [],
  ratePlan: "tou",
  currentHour: 0,
  currentDay: 1,
  curtailment: 0,
  costToday: 0,
  cumulativeSavings: 0,
  eventsToday: [],
  satisfaction: 100, // percent
  achievements: [],
  emissionsSaved: 0
};

function $(sel) { return document.querySelector(sel); }
function $set(id, val) { $(id).textContent = val; }

function populateTechnologies(type) {
  let techs = gameData.customerTypes[type].tech;
  let el = $("#technologyOptions");
  el.innerHTML = "";
  techs.forEach(t => {
    let info = gameData.drTech[t];
    let box = document.createElement("label");
    box.innerHTML = `
      <input type="checkbox" class="tech-select" value="${t}">
      ${info.name} (Max Curtailment: ${info.curtail}%, Comfort: ${info.impact})
    `;
    el.appendChild(box);
    el.appendChild(document.createElement("br"));
  });
}

// Rate plan price for hour
function getPrice(hour, plan) {
  if (plan === "tou") {
    if (hour >= 0 && hour < 8) return gameData.ratePlans.tou.offPeak;
    if (hour >= 8 && hour < 16) return gameData.ratePlans.tou.midPeak;
    if (hour >= 16 && hour < 22) return gameData.ratePlans.tou.peak;
    return gameData.ratePlans.tou.offPeak;
  }
  if (plan === "cpp") {
    if (hour >= 17 && hour <= 20) return gameData.ratePlans.cpp.criticalPeak;
    if (hour >= 8 && hour < 16) return gameData.ratePlans.cpp.midPeak;
    if (hour >= 16 && hour < 22) return gameData.ratePlans.cpp.peak;
    return gameData.ratePlans.cpp.offPeak;
  }
  // Simulate RTP as random within structured bounds
  if (plan === "rtp") {
    if (hour >= 17 && hour <= 20) return 0.45 + 0.15*Math.random();
    if (hour >= 8 && hour < 16) return 0.18 + 0.08*Math.random();
    if (hour >= 0 && hour < 8) return 0.07 + 0.03*Math.random();
    return 0.08 + 0.04*Math.random();
  }
  return 0.10;
}

// Simulate load profile for hour
function getLoad(hour, type, peak) {
  let profile = gameData.customerTypes[type].loadProfile;
  return (peak || gameData.customerTypes[type].peakMin) * profile[hour];
}

// Calculate technology-specific possible curtailment
function getTechCurtailment(selectedTechs, peak) {
  let pct = selectedTechs.map(t => gameData.drTech[t].curtail).reduce((a,b) => a+b,0);
  return Math.min(pct, 100)*peak/100;
}

function setupPhaseInit() {
  $("#customerType").addEventListener("change", (e) => {
    let type = e.target.value;
    gameState.customerType = type;
    let min = gameData.customerTypes[type].peakMin;
    let max = gameData.customerTypes[type].peakMax;
    $("#peakDemand").min = min;
    $("#peakDemand").max = max;
    $("#peakDemand").value = min;
    $("#peakDemandValue").textContent = min;
    populateTechnologies(type);
  });

  $("#peakDemand").addEventListener("input", (e) => {
    $("#peakDemandValue").textContent = e.target.value;
  });

  // Technology selection
  $("#technologyOptions").addEventListener("change", () => {
    // No-op here: processed on start
  });
}

// Begin simulation
$("#startSimulationBtn").onclick = function() {
  let type = $("#customerType").value;
  let peak = Number($("#peakDemand").value);
  let techs = Array.from(document.querySelectorAll(".tech-select:checked")).map(e => e.value);
  let ratePlan = $("#ratePlan").value;
  if (!techs.length) {
    alert("Select at least one demand response technology.");
    return;
  }
  gameState.customerType = type;
  gameState.peakDemand = peak;
  gameState.selectedTechs = techs;
  gameState.ratePlan = ratePlan;
  $("#setupPhase").style.display = "none";
  $("#simulationPhase").style.display = "block";
  simulationInit();
};

function simulationInit() {
  gameState.currentHour = 0;
  gameState.currentDay = 1;
  gameState.costToday = 0;
  gameState.cumulativeSavings = 0;
  gameState.eventsToday = [];
  gameState.satisfaction = 100;
  gameState.achievements = [];
  gameState.emissionsSaved = 0;
  updateSimulationDisplay();
  drawCharts();
}

function drawCharts() {
  // Load curve
  let type = gameState.customerType;
  let peak = gameState.peakDemand;
  let base = [];
  let profile = gameData.customerTypes[type].loadProfile;
  for (let h=0; h<24; h++) base.push(profile[h]*peak);
  let curtailments = [];
  for (let h=0; h<24; h++) curtailments.push(0);

  // Price curve
  let prices = [];
  for (let h=0; h<24; h++) {
    prices.push(getPrice(h, gameState.ratePlan));
  }
  if (window.loadChartObj) window.loadChartObj.destroy();
  window.loadChartObj = new Chart($("#loadChart"), {
    type: 'line',
    data: {
      labels: [...Array(24).keys()].map(h => h+":00"),
      datasets: [
        {
          label: 'Base Load (kW)',
          data: base,
          borderColor: '#21808d',
          fill: false
        },
        {
          label: 'Curtailment (kW)',
          data: curtailments,
          borderColor: '#c0152f',
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {legend:{display:true}},
      scales: {
        y: {beginAtZero:true},
        x: {ticks:{maxTicksLimit:24}}
      }
    }
  });

  if (window.priceChartObj) window.priceChartObj.destroy();
  window.priceChartObj = new Chart($("#priceChart"), {
    type: 'line',
    data: {
      labels: [...Array(24).keys()].map(h => h+":00"),
      datasets: [
        {
          label: 'Price ($/kWh)',
          data: prices,
          borderColor: '#a84b2f',
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {legend:{display:true}},
      scales: {
        y: {beginAtZero:true},
        x: {ticks:{maxTicksLimit:24}}
      }
    }
  });
}

function updateSimulationDisplay() {
  $set("#simDay", gameState.currentDay);
  $set("#curtailmentValue", gameState.curtailment);
  $set("#hourCostValue", gameState.costToday.toFixed(2));
  $set("#dailySavingsValue", gameState.costToday.toFixed(2));
  $set("#cumulativeSavingsValue", gameState.cumulativeSavings.toFixed(2));
  $set("#gridImpactValue", "Events: "+gameState.eventsToday.length);
  $set("#emissionsValue", gameState.emissionsSaved.toFixed(2));
  $set("#satisfactionValue", gameState.satisfaction+"%");
  $set("#achievementsValue", gameState.achievements.join(", ")||"None");

  // Tech-specific curtailment controls
  let techlist = gameState.selectedTechs;
  let el = $("#techCurtailmentControls");
  el.innerHTML = "";
  techlist.forEach(t => {
    let max = gameData.drTech[t].curtail;
    let box = document.createElement("div");
    box.innerHTML = `${gameData.drTech[t].name} <input type="range" class="tech-curtail" id="tc_${t}" min="0" max="${max}" value="${max}"> <span id="tcval_${t}">${max}</span>%`;
    box.className = "slider-item";
    el.appendChild(box);

    box.querySelector("input").addEventListener("input", function(e){
      $("#tcval_"+t).textContent = e.target.value;
    });
  });
}

// Simulate demand response event
function eventForHour(hour) {
  // Peak/critical events
  let plan = gameState.ratePlan;
  if (plan === "cpp" && hour >= 17 && hour <= 20) return "Critical Peak Event!";
  if (plan === "tou" && hour >= 16 && hour < 22) return "Peak Hours - demand response signal!";
  if (plan === "rtp" && getPrice(hour, plan) > 0.40) return "Dynamic Peak Price - Grid Event!";
  return "";
}

$("#curtailmentSlider").addEventListener("input", function(e){
  gameState.curtailment = Number(e.target.value);
  $set("#curtailmentValue", gameState.curtailment);
});

$("#nextHourBtn").onclick = function(){
  // Advance simulation one hour
  let hour = gameState.currentHour;
  let type = gameState.customerType;
  let peak = gameState.peakDemand;
  let baseLoad = getLoad(hour, type, peak);
  let rate = getPrice(hour, gameState.ratePlan);
  let techlist = gameState.selectedTechs;
  let techCurtailPct = 0;

  Array.from(document.querySelectorAll(".tech-curtail")).forEach(tel => {
    techCurtailPct += Number(tel.value);
  });
  // Clamp curtailment to feasible level
  let totalCurtailPct = Math.min(gameState.curtailment, techCurtailPct, gameData.customerTypes[type].curtail);
  let curtail_kW = baseLoad * totalCurtailPct / 100;
  let loadUsed = baseLoad - curtail_kW;

  // Calculate cost/savings
  let hourCost = loadUsed * rate;
  let savings = curtail_kW * rate;
  gameState.costToday += hourCost;
  gameState.cumulativeSavings += savings;

  // Emissions reduction estimate
  let emissionsFactor = 0.35; // kg CO₂/kWh (grid marginal)
  gameState.emissionsSaved += curtail_kW * emissionsFactor;

  // Satisfaction penalty if comfort impact > 15% curtailment
  let comfortImpact = techlist.map(t => {
    if (gameData.drTech[t].impact == "High" && totalCurtailPct > 15) return -10;
    if (gameData.drTech[t].impact == "Medium" && totalCurtailPct > 20) return -6;
    if (gameData.drTech[t].impact == "Low" && totalCurtailPct > 30) return -3;
    return 0;
  }).reduce((a,b) => a+b, 0);
  gameState.satisfaction = Math.max(60, gameState.satisfaction + comfortImpact);

  // Detect demand response event
  let eventMsg = eventForHour(hour);
  $("#eventNotification").textContent = eventMsg;
  if (eventMsg) gameState.eventsToday.push({hour, msg:eventMsg});

  // Achievements tracking
  if (gameState.cumulativeSavings >= 100 && !gameState.achievements.includes("First $100 Saved")) {
    gameState.achievements.push("First $100 Saved");
    alert("Achievement Unlocked: First $100 Saved!");
  }
  // Advance hour
  gameState.currentHour++;
  if (gameState.currentHour >= 24) {
    gameState.currentHour = 0;
    gameState.currentDay++;
    gameState.costToday = 0;
    gameState.eventsToday = [];
    alert("Day complete! Continue optimizing tomorrow...");
  }
  drawCharts();
  updateSimulationDisplay();
}

window.addEventListener("DOMContentLoaded", function(){
  setupPhaseInit();
  populateTechnologies("residential");
});
