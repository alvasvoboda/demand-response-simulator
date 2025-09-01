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
    smart_thermostat: {name:"Smart Thermostat", curtail:15, impact:"Low", icon:"🌡️"},
    ev_charging: {name:"EV Charging", curtail:25, impact:"None", icon:"🔌"},
    water_heater: {name:"Water Heater", curtail:10, impact:"Low", icon:"🚿"},
    pool_pump: {name:"Pool Pump", curtail:20, impact:"None", icon:"🏊"},
    hvac_control: {name:"HVAC Control", curtail:30, impact:"Medium", icon:"❄️"},
    lighting_control: {name:"Lighting Control", curtail:10, impact:"Low", icon:"💡"},
    equipment_cycling: {name:"Equipment Cycling", curtail:20, impact:"Medium", icon:"⚙️"},
    battery_storage: {name:"Battery Storage", curtail:40, impact:"None", icon:"🔋"},
    process_control: {name:"Process Control", curtail:35, impact:"High", icon:"🏭"},
    motor_drives: {name:"Motor Drives", curtail:15, impact:"Medium", icon:"⚡"},
    compressed_air: {name:"Compressed Air", curtail:20, impact:"Low", icon:"💨"},
    thermal_storage: {name:"Thermal Storage", curtail:10, impact:"None", icon:"🌡️"},
    portfolio_optimization: {name:"Portfolio Optimization", curtail:25, impact:"None", icon:"📊"},
    ev_fleet: {name:"EV Fleet DR", curtail:20, impact:"None", icon:"🚗"},
    building_portfolio: {name:"Building Portfolio", curtail:28, impact:"Medium", icon:"🏢"},
    battery_fleet: {name:"Battery Fleet", curtail:35, impact:"None", icon:"🔋"}
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
  satisfaction: 100,
  achievements: [],
  emissionsSaved: 0,
  isSimulationRunning: false
};

// Chart instances
let loadChartInstance = null;
let priceChartInstance = null;

// Utility functions
function $(sel) { return document.querySelector(sel); }
function $set(id, val) { 
  const element = $(id);
  if (element) element.textContent = val;
}

// Enhanced technology population with modern UI
function populateTechnologies(type) {
  const techs = gameData.customerTypes[type].tech;
  const container = $("#technologyOptions");
  container.innerHTML = "";
  
  techs.forEach(techKey => {
    const tech = gameData.drTech[techKey];
    const techOption = document.createElement("label");
    techOption.className = "tech-option";
    
    techOption.innerHTML = `
      <input type="checkbox" class="tech-checkbox" value="${techKey}">
      <div class="tech-info">
        <div class="tech-name">${tech.icon} ${tech.name}</div>
        <div class="tech-details">Max: ${tech.curtail}% • Impact: ${tech.impact}</div>
      </div>
    `;
    
    container.appendChild(techOption);
    
    // Add selection handling
    const checkbox = techOption.querySelector('input');
    checkbox.addEventListener('change', () => {
      techOption.classList.toggle('selected', checkbox.checked);
    });
  });
}

// Enhanced pricing calculation
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
  if (plan === "rtp") {
    if (hour >= 17 && hour <= 20) return 0.45 + 0.15 * Math.random();
    if (hour >= 8 && hour < 16) return 0.18 + 0.08 * Math.random();
    if (hour >= 0 && hour < 8) return 0.07 + 0.03 * Math.random();
    return 0.08 + 0.04 * Math.random();
  }
  return 0.10;
}

// Load calculation
function getLoad(hour, type, peak) {
  const profile = gameData.customerTypes[type].loadProfile;
  return (peak || gameData.customerTypes[type].peakMin) * profile[hour];
}

// Technology curtailment calculation
function getTechCurtailment(selectedTechs, peak) {
  const pct = selectedTechs.map(t => gameData.drTech[t].curtail).reduce((a,b) => a+b, 0);
  return Math.min(pct, 100) * peak / 100;
}

// Setup phase initialization
function setupPhaseInit() {
  // Customer type change handler
  $("#customerType").addEventListener("change", (e) => {
    const type = e.target.value;
    gameState.customerType = type;
    const customerData = gameData.customerTypes[type];
    
    // Update peak demand slider
    const peakSlider = $("#peakDemand");
    peakSlider.min = customerData.peakMin;
    peakSlider.max = customerData.peakMax;
    peakSlider.value = customerData.peakMin;
    $("#peakDemandValue").textContent = customerData.peakMin;
    
    // Update technologies
    populateTechnologies(type);
    
    // Add smooth transition effect
    $("#technologyOptions").style.opacity = "0";
    setTimeout(() => {
      $("#technologyOptions").style.opacity = "1";
    }, 150);
  });

  // Peak demand slider
  $("#peakDemand").addEventListener("input", (e) => {
    $("#peakDemandValue").textContent = e.target.value;
  });

  // Rate plan selection
  document.querySelectorAll('input[name="ratePlan"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      gameState.ratePlan = e.target.value;
    });
  });
}

// Start simulation
function startSimulation() {
  const type = $("#customerType").value;
  const peak = Number($("#peakDemand").value);
  const techs = Array.from(document.querySelectorAll(".tech-checkbox:checked")).map(e => e.value);
  const ratePlan = document.querySelector('input[name="ratePlan"]:checked').value;
  
  if (!techs.length) {
    showNotification("Please select at least one demand response technology.", "warning");
    return;
  }
  
  // Update game state
  gameState.customerType = type;
  gameState.peakDemand = peak;
  gameState.selectedTechs = techs;
  gameState.ratePlan = ratePlan;
  gameState.isSimulationRunning = true;
  
  // Transition to simulation phase
  $("#setupPhase").style.display = "none";
  $("#simulationPhase").style.display = "block";
  
  // Initialize simulation
  simulationInit();
}

// Simulation initialization
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
  setupTechControls();
  drawCharts();
  updateCurrentHourDisplay();
}

// Setup technology-specific controls
function setupTechControls() {
  const container = $("#techCurtailmentControls");
  container.innerHTML = "";
  
  gameState.selectedTechs.forEach(techKey => {
    const tech = gameData.drTech[techKey];
    const controlItem = document.createElement("div");
    controlItem.className = "tech-control-item";
    
    controlItem.innerHTML = `
      <div class="tech-control-name">${tech.icon} ${tech.name}</div>
      <div class="tech-control-slider">
        <input type="range" class="range-slider" id="tc_${techKey}" min="0" max="${tech.curtail}" value="${tech.curtail}">
        <span class="tech-control-value" id="tcval_${techKey}">${tech.curtail}%</span>
      </div>
    `;
    
    container.appendChild(controlItem);
    
    // Add event listener
    const slider = controlItem.querySelector("input");
    slider.addEventListener("input", (e) => {
      $(`#tcval_${techKey}`).textContent = e.target.value + "%";
      updateDRStatus();
    });
  });
}

// Update DR status indicator
function updateDRStatus() {
  const totalCurtailment = Array.from(document.querySelectorAll(".tech-control-item input"))
    .reduce((sum, input) => sum + Number(input.value), 0);
  
  const statusElement = $("#drStatus");
  if (totalCurtailment > 20) {
    statusElement.textContent = "High Response";
    statusElement.style.background = "var(--color-warning-50)";
    statusElement.style.color = "var(--color-warning-600)";
  } else if (totalCurtailment > 5) {
    statusElement.textContent = "Active";
    statusElement.style.background = "var(--color-success-50)";
    statusElement.style.color = "var(--color-success-600)";
  } else {
    statusElement.textContent = "Ready";
    statusElement.style.background = "var(--color-neutral-100)";
    statusElement.style.color = "var(--color-neutral-600)";
  }
}

// Enhanced chart drawing
function drawCharts() {
  const type = gameState.customerType;
  const peak = gameState.peakDemand;
  
  // Prepare load data
  const baseLoad = [];
  const curtailments = [];
  const profile = gameData.customerTypes[type].loadProfile;
  
  for (let h = 0; h < 24; h++) {
    baseLoad.push(profile[h] * peak);
    curtailments.push(0); // Will be updated during simulation
  }

  // Prepare price data
  const prices = [];
  for (let h = 0; h < 24; h++) {
    prices.push(getPrice(h, gameState.ratePlan));
  }

  // Destroy existing charts
  if (loadChartInstance) {
    loadChartInstance.destroy();
  }
  if (priceChartInstance) {
    priceChartInstance.destroy();
  }

  // Create load chart
  loadChartInstance = new Chart($("#loadChart"), {
    type: 'line',
    data: {
      labels: [...Array(24).keys()].map(h => `${h}:00`),
      datasets: [
        {
          label: 'Base Load (kW)',
          data: baseLoad,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Curtailment (kW)',
          data: curtailments,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { color: '#6b7280' }
        },
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { 
            color: '#6b7280',
            maxTicksLimit: 12
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });

  // Create price chart
  priceChartInstance = new Chart($("#priceChart"), {
    type: 'line',
    data: {
      labels: [...Array(24).keys()].map(h => `${h}:00`),
      datasets: [
        {
          label: 'Price ($/kWh)',
          data: prices,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return `Price: $${context.parsed.y.toFixed(3)}/kWh`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { 
            color: '#6b7280',
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          }
        },
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { 
            color: '#6b7280',
            maxTicksLimit: 12
          }
        }
      }
    }
  });

  // Set chart container heights
  $("#loadChart").style.height = "300px";
  $("#priceChart").style.height = "300px";
}

// Update current hour display
function updateCurrentHourDisplay() {
  $("#currentHourDisplay").textContent = `Hour ${gameState.currentHour}`;
  
  // Update current price indicator
  const currentPrice = getPrice(gameState.currentHour, gameState.ratePlan);
  $("#currentPriceIndicator").textContent = `$${currentPrice.toFixed(3)}/kWh`;
}

// Enhanced simulation display update
function updateSimulationDisplay() {
  $set("#simDay", gameState.currentDay);
  $set("#curtailmentValue", gameState.curtailment);
  $set("#hourCostValue", gameState.costToday.toFixed(2));
  $set("#dailySavingsValue", Math.max(0, gameState.cumulativeSavings - gameState.costToday).toFixed(2));
  $set("#cumulativeSavingsValue", gameState.cumulativeSavings.toFixed(2));
  $set("#gridImpactValue", `${gameState.eventsToday.length} Events`);
  $set("#emissionsValue", gameState.emissionsSaved.toFixed(2));
  $set("#satisfactionValue", Math.round(gameState.satisfaction) + "%");
  
  // Update achievements display
  updateAchievementsDisplay();
  updateCurrentHourDisplay();
}

// Update achievements display
function updateAchievementsDisplay() {
  const container = $("#achievementsList");
  if (gameState.achievements.length === 0) {
    container.innerHTML = '<div class="achievement-placeholder">Complete actions to unlock achievements</div>';
  } else {
    container.innerHTML = gameState.achievements
      .map(achievement => `<div class="achievement-badge">${achievement}</div>`)
      .join('');
  }
}

// Event detection
function eventForHour(hour) {
  const plan = gameState.ratePlan;
  if (plan === "cpp" && hour >= 17 && hour <= 20) return "🚨 Critical Peak Event Active!";
  if (plan === "tou" && hour >= 16 && hour < 22) return "⚡ Peak Hours - Demand Response Opportunity";
  if (plan === "rtp" && getPrice(hour, plan) > 0.40) return "📈 High Price Alert - Grid Stress Event";
  return "";
}

// Show notification
function showNotification(message, type = "info") {
  const notification = $("#eventNotification");
  notification.textContent = message;
  notification.className = `event-alert ${type}`;
  
  if (message) {
    notification.style.display = "block";
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        notification.style.opacity = "1";
        if (!eventForHour(gameState.currentHour)) {
          notification.textContent = "";
          notification.className = "event-alert";
        }
      }, 300);
    }, 5000);
  }
}

// Advance simulation by one hour
function advanceHour() {
  const hour = gameState.currentHour;
  const type = gameState.customerType;
  const peak = gameState.peakDemand;
  const baseLoad = getLoad(hour, type, peak);
  const rate = getPrice(hour, gameState.ratePlan);
  
  // Calculate technology-specific curtailment
  let techCurtailPct = 0;
  Array.from(document.querySelectorAll(".tech-control-item input")).forEach(input => {
    techCurtailPct += Number(input.value);
  });
  
  // Apply curtailment limits
  const maxCurtail = gameData.customerTypes[type].curtail;
  const totalCurtailPct = Math.min(gameState.curtailment, techCurtailPct, maxCurtail);
  const curtailKW = baseLoad * totalCurtailPct / 100;
  const loadUsed = baseLoad - curtailKW;

  // Calculate costs and savings
  const hourCost = loadUsed * rate;
  const savings = curtailKW * rate;
  gameState.costToday += hourCost;
  gameState.cumulativeSavings += savings;

  // Environmental impact
  const emissionsFactor = 0.35; // kg CO₂/kWh
  gameState.emissionsSaved += curtailKW * emissionsFactor;

  // Customer satisfaction impact
  const comfortImpact = gameState.selectedTechs.reduce((impact, techKey) => {
    const tech = gameData.drTech[techKey];
    if (tech.impact === "High" && totalCurtailPct > 15) return impact - 10;
    if (tech.impact === "Medium" && totalCurtailPct > 20) return impact - 6;
    if (tech.impact === "Low" && totalCurtailPct > 30) return impact - 3;
    return impact;
  }, 0);
  
  gameState.satisfaction = Math.max(60, gameState.satisfaction + comfortImpact);

  // Check for events
  const eventMsg = eventForHour(hour);
  if (eventMsg) {
    gameState.eventsToday.push({hour, msg: eventMsg});
    showNotification(eventMsg, "warning");
  }

  // Check achievements
  checkAchievements();

  // Advance time
  gameState.currentHour++;
  if (gameState.currentHour >= 24) {
    gameState.currentHour = 0;
    gameState.currentDay++;
    gameState.costToday = 0;
    gameState.eventsToday = [];
    showNotification(`Day ${gameState.currentDay - 1} completed! Starting new day...`, "success");
  }

  // Update displays
  updateSimulationDisplay();
  updateChartHighlight();
}

// Check for new achievements
function checkAchievements() {
  const achievements = gameState.achievements;
  
  if (gameState.cumulativeSavings >= 100 && !achievements.includes("💰 First $100 Saved")) {
    achievements.push("💰 First $100 Saved");
    showNotification("Achievement Unlocked: First $100 Saved!", "success");
  }
  
  if (gameState.emissionsSaved >= 50 && !achievements.includes("🌱 Eco Warrior")) {
    achievements.push("🌱 Eco Warrior");
    showNotification("Achievement Unlocked: Eco Warrior - 50kg CO₂ saved!", "success");
  }
  
  if (gameState.currentDay >= 7 && !achievements.includes("📅 Week Veteran")) {
    achievements.push("📅 Week Veteran");
    showNotification("Achievement Unlocked: Week Veteran!", "success");
  }
  
  if (gameState.satisfaction >= 95 && gameState.cumulativeSavings >= 50 && !achievements.includes("⭐ Perfect Balance")) {
    achievements.push("⭐ Perfect Balance");
    showNotification("Achievement Unlocked: Perfect Balance - High savings with happy customers!", "success");
  }
}

// Update chart highlighting for current hour
function updateChartHighlight() {
  // This could be enhanced to highlight the current hour on charts
  // For now, we'll update the current price indicator
  updateCurrentHourDisplay();
}

// Reset simulation
function resetSimulation() {
  if (confirm("Are you sure you want to reset the simulation? All progress will be lost.")) {
    gameState.isSimulationRunning = false;
    $("#simulationPhase").style.display = "none";
    $("#setupPhase").style.display = "block";
    
    // Reset form values
    $("#customerType").value = "residential";
    $("#peakDemand").value = "5";
    $("#peakDemandValue").textContent = "5";
    document.querySelector('input[name="ratePlan"][value="tou"]').checked = true;
    
    // Clear technology selections
    document.querySelectorAll(".tech-checkbox").forEach(cb => {
      cb.checked = false;
      cb.closest('.tech-option').classList.remove('selected');
    });
    
    // Reset game state
    gameState = {
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
      satisfaction: 100,
      achievements: [],
      emissionsSaved: 0,
      isSimulationRunning: false
    };
    
    populateTechnologies("residential");
  }
}

// Event listeners setup
function setupEventListeners() {
  // Start simulation button
  $("#startSimulationBtn").addEventListener("click", startSimulation);
  
  // Curtailment slider
  $("#curtailmentSlider").addEventListener("input", (e) => {
    gameState.curtailment = Number(e.target.value);
    $set("#curtailmentValue", gameState.curtailment);
    updateDRStatus();
  });
  
  // Next hour button
  $("#nextHourBtn").addEventListener("click", advanceHour);
  
  // Reset button
  $("#resetSimBtn").addEventListener("click", resetSimulation);
}

// Initialize application
function initializeApp() {
  setupPhaseInit();
  setupEventListeners();
  populateTechnologies("residential");
  
  // Add smooth loading animation
  document.body.style.opacity = "0";
  setTimeout(() => {
    document.body.style.transition = "opacity 0.5s ease-in-out";
    document.body.style.opacity = "1";
  }, 100);
}

// Enhanced responsive behavior
function handleResize() {
  if (loadChartInstance) loadChartInstance.resize();
  if (priceChartInstance) priceChartInstance.resize();
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeApp);
window.addEventListener("resize", handleResize);

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { gameData, gameState };
}