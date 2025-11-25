
import * as d3 from 'd3';

/**
 * Renders the shift visualization (Marey Chart).
 * @param {string} containerSelector - The CSS selector for the container element.
 * @param {Array} data - The shift data.
 */
export function renderShiftVisualization(containerSelector, data) {
    const container = d3.select(containerSelector);
    container.html(''); // Clear previous content

    if (!data || data.length === 0) {
        container.append('p').text('No data available for visualization.');
        return;
    }

    // Dimensions and margins
    const margin = { top: 40, right: 40, bottom: 40, left: 100 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom; // Fixed height for now, could be dynamic

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const { xScale, yScale } = createScales(data, width, height);

    // Axes
    drawAxes(svg, xScale, yScale, width, height);

    // Lines
    drawLines(svg, data, xScale, yScale);

    // Stops
    drawStops(svg, data, xScale, yScale);
}

function createScales(data, width, height) {
    // Extract all unique stops and sort them if necessary (assuming data has order)
    // For this mock, we assume stops are ordered in the data or we extract unique names
    // A better approach for a Marey chart is to have a defined sequence of stops.
    // Let's assume the first trip defines the stop order for now, or we collect all unique stops.
    
    // Flatten all stops to find unique ones and time range
    let allStops = [];
    let minTime = new Date();
    let maxTime = new Date(0);

    data.forEach(trip => {
        trip.stops.forEach(stop => {
            if (!allStops.includes(stop.name)) {
                allStops.push(stop.name);
            }
            const time = parseTime(stop.time);
            if (time < minTime) minTime = time;
            if (time > maxTime) maxTime = time;
        });
    });

    // If we want a specific order (e.g. Depot -> Stop A -> Stop B -> ... -> Depot)
    // We might need a separate list of ordered stops. 
    // For now, let's use the order they appear in the first trip, or just the unique list.
    // To match the reference, stops are on Y axis.
    
    const xScale = d3.scaleTime()
        .domain([minTime, maxTime])
        .range([0, width]);

    const yScale = d3.scalePoint()
        .domain(allStops)
        .range([0, height])
        .padding(0.5);

    return { xScale, yScale };
}

function drawAxes(svg, xScale, yScale, width, height) {
    // X Axis (Time) - Top
    svg.append('g')
        .attr('class', 'axis axis--x')
        .call(d3.axisTop(xScale).ticks(10).tickFormat(d3.timeFormat('%H:%M')));

    // X Axis (Time) - Bottom
    svg.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%H:%M')));

    // Y Axis (Stops) - Left
    svg.append('g')
        .attr('class', 'axis axis--y')
        .call(d3.axisLeft(yScale));
        
    // Y Axis (Stops) - Right
    svg.append('g')
        .attr('class', 'axis axis--y')
        .attr('transform', `translate(${width},0)`)
        .call(d3.axisRight(yScale));

    // Grid lines (optional, but good for readability)
    // Horizontal grid lines for stops
    svg.append('g')
        .attr('class', 'grid grid--y')
        .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat('')
        )
        .selectAll('.tick line')
        .attr('stroke', '#e0e0e0')
        .attr('stroke-dasharray', '2,2');
        
    // Vertical grid lines for time
    svg.append('g')
        .attr('class', 'grid grid--x')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .tickSize(-height)
            .tickFormat('')
        )
        .selectAll('.tick line')
        .attr('stroke', '#e0e0e0')
        .attr('stroke-dasharray', '2,2');
}

function drawLines(svg, data, xScale, yScale) {
    const line = d3.line()
        .x(d => xScale(parseTime(d.time)))
        .y(d => yScale(d.name));

    svg.selectAll('.trip-line')
        .data(data)
        .enter()
        .append('path')
        .attr('class', 'trip-line')
        .attr('d', d => line(d.stops))
        .attr('fill', 'none')
        .attr('stroke', '#007bff') // Example color
        .attr('stroke-width', 2);
}

function drawStops(svg, data, xScale, yScale) {
    const stops = data.flatMap(trip => trip.stops.map(stop => ({ ...stop, tripId: trip.id })));

    svg.selectAll('.stop-dot')
        .data(stops)
        .enter()
        .append('circle')
        .attr('class', 'stop-dot')
        .attr('cx', d => xScale(parseTime(d.time)))
        .attr('cy', d => yScale(d.name))
        .attr('r', 3)
        .attr('fill', '#007bff');
}

function parseTime(timeStr) {
    // Assumes timeStr is "HH:MM"
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
}

// Mock Data Generation
export function generateMockData() {
    const stops = [
        "Depot name", "Stop 00", "Stop 01", "Stop 02", "Stop 03", 
        "Stop 04", "Stop 05", "Stop 06", "Stop 07", "Stop 08", 
        "Stop 09", "Stop 10", "Stop 11", "Stop 12", "Stop 13"
    ];
    
    // Create a zigzag pattern
    const trips = [];
    let currentTime = 6 * 60; // Start at 06:00 in minutes
    
    for (let i = 0; i < 4; i++) { // 4 round trips
        // Forward
        const forwardStops = stops.map((stop, index) => {
            const time = currentTime + index * 5; // 5 mins between stops
            return { name: stop, time: formatTime(time) };
        });
        trips.push({ id: `trip-${i}-fwd`, stops: forwardStops });
        currentTime += (stops.length - 1) * 5 + 10; // 10 mins layover

        // Backward
        const backwardStops = [...stops].reverse().map((stop, index) => {
            const time = currentTime + index * 5;
            return { name: stop, time: formatTime(time) };
        });
        trips.push({ id: `trip-${i}-bwd`, stops: backwardStops });
        currentTime += (stops.length - 1) * 5 + 10; // 10 mins layover
    }

    return trips;
}

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
