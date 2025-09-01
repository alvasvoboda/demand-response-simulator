import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './App.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Game data
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

function App() {
  // Game state
  const [gameState, setGameState] = useState({
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
    isSimulationRunning: false,
    techCurtailments: {}
  });

  const [notification, setNotification] = useState({ message: "", type: "" });

  // Utility functions
  const getPrice = (hour, plan) => {
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
  };

  const getLoad = (hour, type, peak) => {
    const profile = gameData.customerTypes[type].loadProfile;
    return (peak || gameData.customerTypes[type].peakMin) * profile[hour];
  };

  const eventForHour = (hour) => {
    const plan = gameState.ratePlan;
    if (plan === "cpp" && hour >= 17 && hour <= 20) return "🚨 Critical Peak Event Active!";
    if (plan === "tou" && hour >= 16 && hour < 22) return "⚡ Peak Hours - Demand Response Opportunity";
    if (plan === "rtp" && getPrice(hour, plan) > 0.40) return "📈 High Price Alert - Grid Stress Event";
    return "";
  };

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 5000);
  };

  // Chart data preparation
  const getChartData = () => {
    const type = gameState.customerType;
    const peak = gameState.peakDemand;
    const profile = gameData.customerTypes[type].loadProfile;
    
    const baseLoad = [];
    const curtailments = [];
    const prices = [];
    
    for (let h = 0; h < 24; h++) {
      baseLoad.push(profile[h] * peak);
      curtailments.push(0); // Will be updated during simulation
      prices.push(getPrice(h, gameState.ratePlan));
    }

    return { baseLoad, curtailments, prices };
  };

  const { baseLoad, curtailments, prices } = getChartData();

  // Chart options
  const chartOptions = {
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
  };

  const priceChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: { 
          color: '#6b7280',
          callback: function(value) {
            return '$' + value.toFixed(2);
          }
        }
      }
    },
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            return `Price: $${context.parsed.y.toFixed(3)}/kWh`;
          }
        }
      }
    }
  };

  // Load chart data
  const loadChartData = {
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
  };

  // Price chart data
  const priceChartData = {
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
  };

  // Event handlers
  const handleCustomerTypeChange = (e) => {
    const type = e.target.value;
    const customerData = gameData.customerTypes[type];
    setGameState(prev => ({
      ...prev,
      customerType: type,
      peakDemand: customerData.peakMin,
      selectedTechs: []
    }));
  };

  const handleTechSelection = (techKey, checked) => {
    setGameState(prev => ({
      ...prev,
      selectedTechs: checked 
        ? [...prev.selectedTechs, techKey]
        : prev.selectedTechs.filter(t => t !== techKey)
    }));
  };

  const startSimulation = () => {
    if (gameState.selectedTechs.length === 0) {
      showNotification("Please select at least one demand response technology.", "warning");
      return;
    }
    
    // Initialize tech curtailments
    const techCurtailments = {};
    gameState.selectedTechs.forEach(techKey => {
      techCurtailments[techKey] = gameData.drTech[techKey].curtail;
    });
    
    setGameState(prev => ({
      ...prev,
      isSimulationRunning: true,
      currentHour: 0,
      currentDay: 1,
      costToday: 0,
      cumulativeSavings: 0,
      eventsToday: [],
      satisfaction: 100,
      achievements: [],
      emissionsSaved: 0,
      techCurtailments
    }));
  };

  const advanceHour = () => {
    const hour = gameState.currentHour;
    const type = gameState.customerType;
    const peak = gameState.peakDemand;
    const baseLoad = getLoad(hour, type, peak);
    const rate = getPrice(hour, gameState.ratePlan);
    
    // Calculate technology-specific curtailment
    const techCurtailPct = Object.values(gameState.techCurtailments).reduce((sum, val) => sum + val, 0);
    const maxCurtail = gameData.customerTypes[type].curtail;
    const totalCurtailPct = Math.min(gameState.curtailment, techCurtailPct, maxCurtail);
    const curtailKW = baseLoad * totalCurtailPct / 100;
    const loadUsed = baseLoad - curtailKW;

    // Calculate costs and savings
    const hourCost = loadUsed * rate;
    const savings = curtailKW * rate;
    
    // Environmental impact
    const emissionsFactor = 0.35; // kg CO₂/kWh
    const emissionsSaved = curtailKW * emissionsFactor;

    // Customer satisfaction impact
    const comfortImpact = gameState.selectedTechs.reduce((impact, techKey) => {
      const tech = gameData.drTech[techKey];
      if (tech.impact === "High" && totalCurtailPct > 15) return impact - 10;
      if (tech.impact === "Medium" && totalCurtailPct > 20) return impact - 6;
      if (tech.impact === "Low" && totalCurtailPct > 30) return impact - 3;
      return impact;
    }, 0);

    // Check for events
    const eventMsg = eventForHour(hour);
    const newEvents = eventMsg ? [...gameState.eventsToday, {hour, msg: eventMsg}] : gameState.eventsToday;
    
    if (eventMsg) {
      showNotification(eventMsg, "warning");
    }

    // Check achievements
    const newAchievements = [...gameState.achievements];
    const newCumulativeSavings = gameState.cumulativeSavings + savings;
    const newEmissionsSaved = gameState.emissionsSaved + emissionsSaved;
    const newSatisfaction = Math.max(60, gameState.satisfaction + comfortImpact);
    
    if (newCumulativeSavings >= 100 && !newAchievements.includes("💰 First $100 Saved")) {
      newAchievements.push("💰 First $100 Saved");
      showNotification("Achievement Unlocked: First $100 Saved!", "success");
    }
    
    if (newEmissionsSaved >= 50 && !newAchievements.includes("🌱 Eco Warrior")) {
      newAchievements.push("🌱 Eco Warrior");
      showNotification("Achievement Unlocked: Eco Warrior - 50kg CO₂ saved!", "success");
    }

    // Advance time
    let newHour = hour + 1;
    let newDay = gameState.currentDay;
    let newCostToday = gameState.costToday + hourCost;
    
    if (newHour >= 24) {
      newHour = 0;
      newDay++;
      newCostToday = 0;
      showNotification(`Day ${newDay - 1} completed! Starting new day...`, "success");
      
      if (newDay >= 7 && !newAchievements.includes("📅 Week Veteran")) {
        newAchievements.push("📅 Week Veteran");
        showNotification("Achievement Unlocked: Week Veteran!", "success");
      }
    }
    
    if (newSatisfaction >= 95 && newCumulativeSavings >= 50 && !newAchievements.includes("⭐ Perfect Balance")) {
      newAchievements.push("⭐ Perfect Balance");
      showNotification("Achievement Unlocked: Perfect Balance - High savings with happy customers!", "success");
    }

    setGameState(prev => ({
      ...prev,
      currentHour: newHour,
      currentDay: newDay,
      costToday: newCostToday,
      cumulativeSavings: newCumulativeSavings,
      eventsToday: newHour === 0 ? [] : newEvents,
      satisfaction: newSatisfaction,
      achievements: newAchievements,
      emissionsSaved: newEmissionsSaved
    }));
  };

  const resetSimulation = () => {
    if (window.confirm("Are you sure you want to reset the simulation? All progress will be lost.")) {
      setGameState({
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
        isSimulationRunning: false,
        techCurtailments: {}
      });
    }
  };

  const updateTechCurtailment = (techKey, value) => {
    setGameState(prev => ({
      ...prev,
      techCurtailments: {
        ...prev.techCurtailments,
        [techKey]: Number(value)
      }
    }));
  };

  const getDRStatus = () => {
    const totalCurtailment = Object.values(gameState.techCurtailments).reduce((sum, val) => sum + val, 0);
    if (totalCurtailment > 20) return { text: "High Response", class: "warning" };
    if (totalCurtailment > 5) return { text: "Active", class: "success" };
    return { text: "Ready", class: "neutral" };
  };

  const currentPrice = getPrice(gameState.currentHour, gameState.ratePlan);
  const drStatus = getDRStatus();

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <nav className="nav-header">
        <div className="nav-content">
          <div className="nav-brand">
            <div className="brand-icon">⚡</div>
            <span className="brand-text">Grid Optimizer</span>
          </div>
          <div className="nav-status">
            <div className="status-indicator">
              <div className="status-dot"></div>
              <span>Connected</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Demand Response Simulator</h1>
          <p className="hero-subtitle">
            Optimize your electricity usage to save money and support the grid through intelligent demand management.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="main-content">
        {!gameState.isSimulationRunning ? (
          /* Setup Phase */
          <div className="phase-container">
            <div className="section-header">
              <h2>Configure Your Energy Profile</h2>
              <p>Set up your customer profile and demand response capabilities</p>
            </div>

            <div className="setup-grid">
              {/* Customer Profile Card */}
              <div className="config-card">
                <div className="card-header">
                  <h3>Customer Profile</h3>
                  <div className="card-icon">🏢</div>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Customer Type</label>
                    <select 
                      className="form-select" 
                      value={gameState.customerType}
                      onChange={handleCustomerTypeChange}
                    >
                      <option value="residential">🏠 Residential</option>
                      <option value="commercial">🏢 Commercial</option>
                      <option value="industrial">🏭 Industrial</option>
                      <option value="aggregator">📊 Aggregator</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Peak Demand: <span className="value-display">{gameState.peakDemand}</span> kW
                    </label>
                    <input 
                      type="range" 
                      className="range-slider" 
                      min={gameData.customerTypes[gameState.customerType].peakMin}
                      max={gameData.customerTypes[gameState.customerType].peakMax}
                      value={gameState.peakDemand}
                      onChange={(e) => setGameState(prev => ({...prev, peakDemand: Number(e.target.value)}))}
                    />
                    <div className="range-labels">
                      <span>Min</span>
                      <span>Max</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technologies Card */}
              <div className="config-card">
                <div className="card-header">
                  <h3>DR Technologies</h3>
                  <div className="card-icon">🔧</div>
                </div>
                <div className="card-body">
                  <div className="tech-grid">
                    {gameData.customerTypes[gameState.customerType].tech.map(techKey => {
                      const tech = gameData.drTech[techKey];
                      const isSelected = gameState.selectedTechs.includes(techKey);
                      return (
                        <label 
                          key={techKey}
                          className={`tech-option ${isSelected ? 'selected' : ''}`}
                        >
                          <input 
                            type="checkbox" 
                            className="tech-checkbox" 
                            checked={isSelected}
                            onChange={(e) => handleTechSelection(techKey, e.target.checked)}
                          />
                          <div className="tech-info">
                            <div className="tech-name">{tech.icon} {tech.name}</div>
                            <div className="tech-details">Max: {tech.curtail}% • Impact: {tech.impact}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rate Plan Card */}
              <div className="config-card">
                <div className="card-header">
                  <h3>Rate Plan</h3>
                  <div className="card-icon">💰</div>
                </div>
                <div className="card-body">
                  <div className="rate-options">
                    {Object.entries(gameData.ratePlans).map(([key, plan]) => (
                      <label key={key} className="radio-card">
                        <input 
                          type="radio" 
                          name="ratePlan" 
                          value={key}
                          checked={gameState.ratePlan === key}
                          onChange={(e) => setGameState(prev => ({...prev, ratePlan: e.target.value}))}
                        />
                        <div className="radio-content">
                          <div className="radio-title">
                            {key === 'tou' && 'Time-of-Use (TOU)'}
                            {key === 'cpp' && 'Critical Peak Pricing (CPP)'}
                            {key === 'rtp' && 'Real-Time Pricing (RTP)'}
                          </div>
                          <div className="radio-desc">
                            {key === 'tou' && 'Fixed rates by time period'}
                            {key === 'cpp' && 'High rates during peak events'}
                            {key === 'rtp' && 'Dynamic hourly rates'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="action-section">
              <button className="btn-primary" onClick={startSimulation}>
                <span>Start Simulation</span>
                <div className="btn-icon">▶</div>
              </button>
            </div>
          </div>
        ) : (
          /* Simulation Phase */
          <div className="phase-container">
            <div className="simulation-header">
              <div className="sim-info">
                <h2>Live Simulation</h2>
                <div className="day-counter">Day {gameState.currentDay}</div>
              </div>
              <div className="time-display">
                <div className="current-hour">Hour {gameState.currentHour}</div>
              </div>
            </div>

            {/* Event Notification */}
            {notification.message && (
              <div className={`event-alert ${notification.type}`}>
                {notification.message}
              </div>
            )}

            {/* Charts Section */}
            <div className="charts-section">
              <div className="chart-container">
                <div className="chart-header">
                  <h3>Load Profile</h3>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div className="legend-color" style={{background: '#0ea5e9'}}></div>
                      <span>Base Load</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{background: '#ef4444'}}></div>
                      <span>Curtailment</span>
                    </div>
                  </div>
                </div>
                <div className="chart-wrapper">
                  <Line data={loadChartData} options={chartOptions} />
                </div>
              </div>
              
              <div className="chart-container">
                <div className="chart-header">
                  <h3>Electricity Pricing</h3>
                  <div className="price-indicator">
                    ${currentPrice.toFixed(3)}/kWh
                  </div>
                </div>
                <div className="chart-wrapper">
                  <Line data={priceChartData} options={priceChartOptions} />
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <div className="control-panel">
              <div className="control-header">
                <h3>Demand Response Controls</h3>
                <div className="control-status">
                  <div className={`status-badge ${drStatus.class}`}>
                    {drStatus.text}
                  </div>
                </div>
              </div>
              
              <div className="control-grid">
                <div className="control-section">
                  <label className="control-label">
                    Overall Curtailment: <span className="value-highlight">{gameState.curtailment}</span>%
                  </label>
                  <input 
                    type="range" 
                    className="range-slider primary" 
                    min="0" 
                    max="100" 
                    value={gameState.curtailment}
                    onChange={(e) => setGameState(prev => ({...prev, curtailment: Number(e.target.value)}))}
                  />
                </div>
                
                <div className="tech-controls">
                  {gameState.selectedTechs.map(techKey => {
                    const tech = gameData.drTech[techKey];
                    const value = gameState.techCurtailments[techKey] || 0;
                    return (
                      <div key={techKey} className="tech-control-item">
                        <div className="tech-control-name">{tech.icon} {tech.name}</div>
                        <div className="tech-control-slider">
                          <input 
                            type="range" 
                            className="range-slider" 
                            min="0" 
                            max={tech.curtail}
                            value={value}
                            onChange={(e) => updateTechCurtailment(techKey, e.target.value)}
                          />
                          <span className="tech-control-value">{value}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="action-controls">
                <button className="btn-primary" onClick={advanceHour}>
                  <span>Advance Hour</span>
                  <div className="btn-icon">⏭</div>
                </button>
                <button className="btn-secondary" onClick={resetSimulation}>
                  <span>Reset</span>
                  <div className="btn-icon">🔄</div>
                </button>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="metrics-dashboard">
              <div className="metrics-header">
                <h3>Performance Metrics</h3>
                <div className="metrics-period">Real-time</div>
              </div>
              
              <div className="metrics-grid">
                <div className="metric-card cost">
                  <div className="metric-icon">💵</div>
                  <div className="metric-content">
                    <div className="metric-label">Hour Cost</div>
                    <div className="metric-value">${gameState.costToday.toFixed(2)}</div>
                  </div>
                </div>
                
                <div className="metric-card savings">
                  <div className="metric-icon">💰</div>
                  <div className="metric-content">
                    <div className="metric-label">Daily Savings</div>
                    <div className="metric-value">
                      ${Math.max(0, gameState.cumulativeSavings - gameState.costToday).toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="metric-card cumulative">
                  <div className="metric-icon">📈</div>
                  <div className="metric-content">
                    <div className="metric-label">Total Savings</div>
                    <div className="metric-value">${gameState.cumulativeSavings.toFixed(2)}</div>
                  </div>
                </div>
                
                <div className="metric-card grid">
                  <div className="metric-icon">⚡</div>
                  <div className="metric-content">
                    <div className="metric-label">Grid Impact</div>
                    <div className="metric-value">{gameState.eventsToday.length} Events</div>
                  </div>
                </div>
                
                <div className="metric-card emissions">
                  <div className="metric-icon">🌱</div>
                  <div className="metric-content">
                    <div className="metric-label">CO₂ Reduced</div>
                    <div className="metric-value">{gameState.emissionsSaved.toFixed(2)} kg</div>
                  </div>
                </div>
                
                <div className="metric-card satisfaction">
                  <div className="metric-icon">😊</div>
                  <div className="metric-content">
                    <div className="metric-label">Satisfaction</div>
                    <div className="metric-value">{Math.round(gameState.satisfaction)}%</div>
                  </div>
                </div>
              </div>
              
              <div className="achievements-section">
                <h4>Achievements</h4>
                <div className="achievements-list">
                  {gameState.achievements.length === 0 ? (
                    <div className="achievement-placeholder">Complete actions to unlock achievements</div>
                  ) : (
                    gameState.achievements.map((achievement, index) => (
                      <div key={index} className="achievement-badge">{achievement}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; 2025 Demand Response Simulator. Optimizing energy for a sustainable future.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;