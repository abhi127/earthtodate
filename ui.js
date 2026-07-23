// ui.js
console.log('🔧 UI.JS BUILD: 2026-02-17-fix-legacy-inputs');

function createElem(parent, tag, styleClasses, styleProps, htmlContent) {
    const elem = document.createElement(tag);
    if (styleClasses) {
        elem.classList.add(...styleClasses);
    }
    if (styleProps) {
        Object.assign(elem.style, styleProps);
    }
    if (htmlContent) {
        elem.innerHTML = htmlContent;
    }
    parent.appendChild(elem);
    return elem;
}

let layout = "dual"; // dual, single, overlap

let map = undefined;

// Cache for imagery subdirectories - will be populated synchronously at page load
let imagerySubdirectories = [];

// Global variable for currently selected imagery file
window.selectedImageryFile = null;
window.selectedImagerySubdir = null;

// Function to load imagery subdirectories synchronously
async function loadImageryData() {
    try {
        const response = await fetch('/imagery');
        const data = await response.json();
        imagerySubdirectories = data.subdirectories || [];
        console.log('Loaded imagery subdirectories:', imagerySubdirectories);
    } catch (error) {
        console.error('Error loading imagery subdirectories:', error);
        imagerySubdirectories = [];
    }
}

// Function to update search interface based on selected resolutions
function updateSearchInterface() {
    const searchInput = document.querySelector('#uiTopBar input[type="text"]');
    const searchSelect = document.getElementById('locationSelect');

    if (!searchInput || !searchSelect) return;

    // Check if any view is using an imagery source (like BlackSky)
    let imagerySubdir = null;
    for (let i = 1; i <= 2; i++) {
        // First check the new sensor dropdown
        const sensorSelect = document.getElementById(`newSensorSelect${i}`);
        if (sensorSelect && imagerySubdirectories.length > 0) {
            for (const subdir of imagerySubdirectories) {
                if (sensorSelect.value === subdir ||
                    sensorSelect.value === `${subdir}sr`) {
                    imagerySubdir = subdir;
                    // Remove 'sr' suffix if present for fetching files
                    if (imagerySubdir.endsWith('sr') && imagerySubdirectories.includes(imagerySubdir.slice(0, -2))) {
                        imagerySubdir = imagerySubdir.slice(0, -2);
                    }
                    break;
                }
            }
            if (imagerySubdir) break;
        }

        // Fallback to old resolution dropdown (for backwards compatibility)
        if (!imagerySubdir) {
            const resSelect = document.getElementById(`resolutionSelect${i}`);
            if (resSelect && imagerySubdirectories.length > 0) {
                for (const subdir of imagerySubdirectories) {
                    if (resSelect.value === subdir ||
                        resSelect.value === `${subdir}sr`) {
                        imagerySubdir = subdir;
                        // Remove 'sr' suffix if present for fetching files
                        if (imagerySubdir.endsWith('sr') && imagerySubdirectories.includes(imagerySubdir.slice(0, -2))) {
                            imagerySubdir = imagerySubdir.slice(0, -2);
                        }
                        break;
                    }
                }
                if (imagerySubdir) break;
            }
        }
    }

    if (imagerySubdir) {
        // Switch to dropdown mode for imagery
        searchInput.style.display = 'none';
        searchSelect.style.display = '';
        
        // Clear and populate dropdown with files from the imagery subdirectory
        searchSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.text = 'Select file...';
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        searchSelect.appendChild(placeholder);
        
        // Fetch files for this subdirectory. Multiple concurrent calls (e.g. when
        // syncing both views) would otherwise each append, creating duplicates.
        const token = (window._imageryFetchToken || 0) + 1;
        window._imageryFetchToken = token;
        fetch(`/imagery/${imagerySubdir}`)
            .then(response => response.json())
            .then(data => {
                if (window._imageryFetchToken !== token) return;
                // Re-clear in case an earlier in-flight call already appended.
                searchSelect.innerHTML = '';
                const ph = document.createElement('option');
                ph.text = 'Select file...'; ph.value = ''; ph.disabled = true; ph.selected = true;
                searchSelect.appendChild(ph);
                if (data.files && data.files.length > 0) {
                    data.files.forEach(file => {
                        const option = document.createElement('option');
                        option.text = file;
                        option.value = file;
                        searchSelect.appendChild(option);
                    });
                    // Auto-select first file
                    searchSelect.value = data.files[0];
                    searchSelect.dispatchEvent(new Event('change'));
                }
            })
            .catch(error => console.error(`Error fetching files for imagery/${imagerySubdir}:`, error));
    } else {
        // Switch back to normal search input
        searchInput.style.display = '';
        searchSelect.style.display = 'none';
    }
}

// let currentMarker;

// function performSearch(input, searchResults) {
//     if (!input.trim()) {
//         searchResults.style.display = 'none';
//         return;
//     }

//     // Check if input is coordinates
//     const coordsRegex = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
//     const coordsMatch = input.match(coordsRegex);

//     if (coordsMatch) {
//         const lat = parseFloat(coordsMatch[1]);
//         const lon = parseFloat(coordsMatch[2]);
        
//         if (isValidCoordinates(lat, lon)) {
//             console.log('Coordinates:', lat, lon);
//             centerMapOnCoordinates(lat, lon);
//             searchResults.style.display = 'none';
//         }
//     } else {
//         // Search for places
//         searchPlace(input, searchResults);
//     }
// }

// function isValidCoordinates(newLat, newLon) {
//     return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
// }

function parseLocation(input) {
    if (!input || typeof input !== 'string') return input;
    
    input = input.trim();
    
    // Helper function to convert DMS to decimal degrees
    const dmsToDecimal = (degrees, minutes = 0, seconds = 0) => {
        return degrees + (minutes / 60) + (seconds / 3600);
    };

    // Helper to normalize coordinate values
    const normalizeCoord = (coord, direction) => {
        if (direction && ['S', 'W'].includes(direction.toUpperCase())) {
            return -Math.abs(coord);
        }
        return coord;
    };

    // Try to parse as bounding box first
    const bboxPatterns = [
        // minLat=40.70, minLon=-74.02, maxLat=40.73, maxLon=-74.00
        /min(?:Lat|lat)=(-?\d+\.?\d*).*min(?:Lon|lon)=(-?\d+\.?\d*).*max(?:Lat|lat)=(-?\d+\.?\d*).*max(?:Lon|lon)=(-?\d+\.?\d*)/,
        // Array format [-74.02, 40.70, -74.00, 40.73]
        /\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/,
        // sw=40.70,-74.02&ne=40.73,-74.00
        /sw=(-?\d+\.?\d*),(-?\d+\.?\d*).*ne=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        // "From 40.7N to 40.73N and 74.02W to 74W"
        /from\s+(\d+\.?\d*)°?\s*N\s+to\s+(\d+\.?\d*)°?\s*N\s+and\s+(\d+\.?\d*)°?\s*W\s+to\s+(\d+\.?\d*)°?\s*W/i
    ];

    for (const pattern of bboxPatterns) {
        const match = input.match(pattern);
        if (match) {
            const [, num1, num2, num3, num4] = match;
            return [[Number(num1), Number(num2)], [Number(num3), Number(num4)]];
        }
    }

    // Try to parse as lat/lon
    const coordPatterns = [
        // Decimal degrees: 40.7128, -74.0060
        /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,
        
        // DMS: 40°42'51"N, 74°00'21"W
        /(\d+)°\s*(\d+)'\s*(\d+)"\s*([NSns]),\s*(\d+)°\s*(\d+)'\s*(\d+)"\s*([EWew])/,
        
        // N40.7128, W74.0060
        /([NSns])\s*(-?\d+\.?\d*)\s*,\s*([EWew])\s*(-?\d+\.?\d*)/,
        
        // 40.7128N, 74.0060W
        /(-?\d+\.?\d*)\s*([NSns])\s*,\s*(-?\d+\.?\d*)\s*([EWew])/,
        
        // 40.7128° N, 74.0060° W
        /(-?\d+\.?\d*)°?\s*([NSns])\s*,\s*(-?\d+\.?\d*)°?\s*([EWew])/,
        
        // Mixed format: 40°42.85'N, 74°0.36'W
        /(\d+)°\s*(\d+\.?\d*)'\s*([NSns])\s*,\s*(\d+)°\s*(\d+\.?\d*)'\s*([EWew])/
    ];

    for (const pattern of coordPatterns) {
        const match = input.match(pattern);
        if (match) {
            if (match.length === 9) {  // DMS format
                const lat = dmsToDecimal(Number(match[1]), Number(match[2]), Number(match[3]));
                const lon = dmsToDecimal(Number(match[5]), Number(match[6]), Number(match[7]));
                return [
                    normalizeCoord(lat, match[4]),
                    normalizeCoord(lon, match[8])
                ];
            } else if (match.length === 7) {  // Mixed degree-decimal minutes
                const lat = dmsToDecimal(Number(match[1]), Number(match[2]));
                const lon = dmsToDecimal(Number(match[4]), Number(match[5]));
                return [
                    normalizeCoord(lat, match[3]),
                    normalizeCoord(lon, match[6])
                ];
            } else if (match.length === 5) {  // Various decimal degree formats
                const lat = Number(match[1]);
                const lon = Number(match[3]);
                return [
                    normalizeCoord(lat, match[2]),
                    normalizeCoord(lon, match[4])
                ];
            } else {  // Simple decimal format
                return [Number(match[1]), Number(match[2])];
            }
        }
    }

    // If no coordinate pattern matches, return the original string (assumed to be an address)
    return input;
}

function centerMapOnCoordinates(newLat, newLon) {
    // const coordinate = new mapkit.Coordinate(lat, lon);
    // map.setCenter(coordinate);
    // map.setRegion(new mapkit.CoordinateRegion(
    //     coordinate,
    //     new mapkit.CoordinateSpan(0.1, 0.1)
    // ));

    // // Remove existing marker if any
    // if (currentMarker) {
    //     currentMarker.map = null;
    // }

    // // Add new marker
    // currentMarker = new mapkit.MarkerAnnotation(coordinate, {
    //     animates: true
    // });
    // currentMarker.map = map;

    lat = newLat;
    lon = newLon;
    refreshAllViews();
    updateUrl();
}

let searchInput = undefined;
let searchResults = undefined;

async function handleSearch(event) {
    const searchInput = event.target;
    const searchText = searchInput.value.trim();
    if (searchText.length > 0) {
        // if Enter key, check if lat,lon or bbox
        if (event.keyCode == 13) {
            const location = parseLocation(searchText);
            if (typeof location == 'object') {
                searchResults.style.display = 'none';
                if (typeof location[0] == 'object') {
                    console.log("bbox", location);
                } else {
                    console.log("POI", location);

                    // Fetch best date for new location (same logic as initialization)
                    const bestDate = await fetchBestInitialDate(
                        location[0], location[1],
                        views[0].viewtype,
                        45,  // Hardcoded: always search 45 days back
                        100  // Hardcoded: 100% max clouds for initial search
                    );

                    // Set date for ALL views
                    views.forEach((v, idx) => {
                        v.date = bestDate;
                        // Update date input if it exists
                        const dateInput = document.querySelector(`#dateContainer${idx + 1} input[type="date"]`);
                        if (dateInput) {
                            dateInput.value = bestDate;
                        }
                    });

                    centerMapOnCoordinates(location[0], location[1]);
                }
                return;
            }
        }
        const search = new mapkit.Search({ region: map.region });
        search.autocomplete(searchText, (error, data) => {
            if (error) {
                console.error('Search error:', error);
                return;
            }
            searchResults.innerHTML = '';
            if (data.results.length > 0) {
                data.results.forEach(function(result) {
                    if (result.coordinate) {
                        const resultDiv = document.createElement('div');
                        resultDiv.className = 'mapSearchResultsItem';
                        resultDiv.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background-color 0.2s;';
                        resultDiv.addEventListener('pointerenter', () => resultDiv.style.backgroundColor = '#f5f5f5');
                        resultDiv.addEventListener('pointerleave', () => resultDiv.style.backgroundColor = 'white');
                        resultDiv.latlon = result.coordinate;
                        resultDiv.title = result.displayLines[0];
                        const subName = result.displayLines[1] || '';
                        resultDiv.innerHTML = `<b>${result.displayLines[0]}</b>${subName ? '<br><small style="color: #666;">' + subName + '</small>' : ''}`;
                        resultDiv.addEventListener('pointerdown', handleResultClick);
                        searchResults.appendChild(resultDiv);
                    }
                });
                searchResults.style.display = "block";
            } else {
                searchResults.style.display = "none";
            }
        });
    } else {
        searchResults.style.display = "none";
    }
}

async function handleResultClick(event) {
    const resultItem = event.currentTarget;
    const latlon = resultItem.latlon;
    searchResults.style.display = 'none';
    searchInput.value = resultItem.title;

    // Fetch best date for new location (same logic as initialization)
    const bestDate = await fetchBestInitialDate(
        latlon.latitude, latlon.longitude,
        views[0].viewtype,
        45,  // Hardcoded: always search 45 days back
        100  // Hardcoded: 100% max clouds for initial search
    );

    // Set date for ALL views
    views.forEach((v, idx) => {
        v.date = bestDate;
        // Update date input if it exists
        const dateInput = document.querySelector(`#dateContainer${idx + 1} input[type="date"]`);
        if (dateInput) {
            dateInput.value = bestDate;
        }
    });

    centerMapOnCoordinates(latlon.latitude, latlon.longitude);
}

function setZoomLevelWithoutRefresh(zoomLevel) {
    zoom = zoomLevel;
    const pixelSize = document.getElementById("pixelSize");
    if (pixelSize) {
        const byZoomLevel = {
            21: "0.075 m",
            20: "0.15 m",
            19: "0.3 m",
            18: "0.6 m",
            17: "1.2 m",
            16: "2.4 m",
            15: "4.8 m",
            14: "9.6 m",
            13: "19 m"
        };
        pixelSize.innerHTML = byZoomLevel[zoom] ?? "";
    }
}

function initializeUI(containerId) {
    map = new mapkit.Map(document.body, {
    });

    const uiTopBar = document.getElementById(containerId);

    // EarthToDate logo. Alt+Shift click shows the running app version (so we can
    // verify which build a stuck cached browser is actually running).
    const logo = createElem(uiTopBar, 'img', [], { height: '100%', cursor: 'pointer' });
    logo.src = "/static/logo.png";
    logo.addEventListener('pointerdown', (event) => {
        if (event.altKey && event.shiftKey) {
            event.stopPropagation();
            event.preventDefault();
            alert('App version: ' + (window.appVersion || 'unknown'));
            return;
        }
        window.location.href = '/';
    });

    // Two small rows next to the logo: app version + serving server ("ETD"/"Cloud").
    const idBox = createElem(uiTopBar, 'div', [], {
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        marginLeft: '6px', font: '9px sans-serif', lineHeight: '1.15', color: '#bbb', whiteSpace: 'nowrap'
    });
    createElem(idBox, 'div', [], {}, 'v' + (window.appVersion || ''));
    createElem(idBox, 'div', [], {}, window.serverLabel || '');

    // Container for location search (will hold either input or select)
    const searchContainer = createElem(uiTopBar, 'div', [], { display: 'inline-block', width: '200px', marginLeft: '10px' });
    
    // Location search bar (input)
    searchInput = createElem(searchContainer, 'input', [], { width: '100%', height: '100%', boxSizing: 'border-box', minWidth: '150px' });
    searchInput.type = "text";
    searchInput.placeholder = "Search location...";
    searchInput.addEventListener('keyup', handleSearch);
    
    // Location dropdown (select) - initially hidden
    const searchSelect = createElem(searchContainer, 'select', [], { width: '100%', height: '100%', boxSizing: 'border-box', display: 'none' });
    searchSelect.id = 'locationSelect';
    
    // Handle file selection from dropdown
    searchSelect.addEventListener('change', async (event) => {
        const selectedFile = event.target.value;
        if (selectedFile) {
            // Get the current imagery subdirectory
            let imagerySubdir = null;
            for (let i = 1; i <= 2; i++) {
                // First check the new sensor dropdown
                const sensorSelect = document.getElementById(`newSensorSelect${i}`);
                if (sensorSelect && imagerySubdirectories) {
                    for (const subdir of imagerySubdirectories) {
                        if (sensorSelect.value === subdir ||
                            sensorSelect.value === `${subdir}sr`) {
                            imagerySubdir = subdir;
                            // Remove 'sr' suffix if present for fetching files
                            if (imagerySubdir.endsWith('sr') && imagerySubdirectories.includes(imagerySubdir.slice(0, -2))) {
                                imagerySubdir = imagerySubdir.slice(0, -2);
                            }
                            break;
                        }
                    }
                    if (imagerySubdir) break;
                }

                // Fallback to old resolution dropdown (for backwards compatibility)
                if (!imagerySubdir) {
                    const resSelect = document.getElementById(`resolutionSelect${i}`);
                    if (resSelect && imagerySubdirectories) {
                        for (const subdir of imagerySubdirectories) {
                            if (resSelect.value === subdir ||
                                resSelect.value === `${subdir}sr`) {
                                imagerySubdir = subdir;
                                // Remove 'sr' suffix if present for fetching files
                                if (imagerySubdir.endsWith('sr') && imagerySubdirectories.includes(imagerySubdir.slice(0, -2))) {
                                    imagerySubdir = imagerySubdir.slice(0, -2);
                                }
                                break;
                            }
                        }
                        if (imagerySubdir) break;
                    }
                }
            }
            
            if (imagerySubdir) {
                try {
                    // Set global variables for selected imagery file
                    window.selectedImageryFile = selectedFile;
                    window.selectedImagerySubdir = imagerySubdir;
                    
                    // Fetch file info from the server
                    const response = await fetch(`/imagery/${imagerySubdir}/${selectedFile}`);
                    const data = await response.json();
                    
                    if (data.center) {
                        // Center the map on the file's location
                        centerMapOnCoordinates(data.center.lat, data.center.lon);
                        console.log(`Centered map on ${selectedFile}:`, data.center);
                    }
                    
                    // Update date for both views if date is available
                    if (data.date && views && views.length >= 2) {
                        // Update both views' date properties and inputs
                        for (let i = 0; i < views.length; i++) {
                            // Update the view's date property
                            views[i].date = data.date;
                            
                            // Find and update the corresponding date input
                            const dateInput = document.querySelector(`#dateContainer${i + 1} input[type="date"]`);
                            if (dateInput) {
                                dateInput.value = data.date;
                            }
                        }
                        
                        // Refresh all views and update URL
                        refreshAllViews();
                        updateUrl();
                        console.log(`Set date to ${data.date} for both views`);
                    }
                } catch (error) {
                    console.error('Error fetching file info:', error);
                    // Fallback: try to parse location from filename
                    const location = parseLocation(selectedFile);
                    if (typeof location === 'object') {
                        if (Array.isArray(location)) {
                            centerMapOnBoundingBox(location);
                        } else if (location.latitude && location.longitude) {
                            centerMapOnCoordinates(location.latitude, location.longitude);
                        }
                    }
                }
            }
        }
    });
    
    // Search results
    searchResults = createElem(document.body, 'div', [ "nowrap" ], { display: '', position: 'absolute', left: '52px', top: '46px', background: 'white', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 9999, width: "206px", fontSize: 'small', maxHeight: '300px', overflow: 'auto' });
    searchResults.addEventListener('pointerdown', _ => searchResults.style.display = 'none');
    // global mouse click event listener to hide search results
    document.addEventListener('pointerdown', _ => searchResults.style.display = 'none');

    // Zoom level / pixel size indicator
    const pixelSize = createElem(uiTopBar, 'label', [], { marginLeft: '10px', minWidth: '45px', height: '100%', lineHeight: "2em" }, "");
    pixelSize.id = 'pixelSize';
    setZoomLevelWithoutRefresh(zoom);

    // Mouse position (lat, lon, elevation) indicator
    const mousePosInfo = createElem(uiTopBar, 'label', [], {
        marginLeft: '10px',
        marginRight: '20px',
        minWidth: '190px',
        height: '100%',
        lineHeight: "2.5em",
        fontFamily: 'monospace',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        cursor: 'pointer'
    }, "");
    mousePosInfo.id = 'mousePosInfo';

    // Store current lat/lon for tooltip
    mousePosInfo.dataset.lat = '';
    mousePosInfo.dataset.lon = '';

    // OSM streets+labels overlay toggle (applies to all mapping.js views, not isometric)
    window.osmOverlay = false;
    const osmToggle = createElem(uiTopBar, 'label', ['clickable-element'], {
        marginRight: '14px', marginTop: '-5px', height: '100%', lineHeight: '2em', fontSize: '18px', userSelect: 'none'
    }, "&#9776;");  // ☰ labels glyph
    osmToggle.id = 'osmToggle';
    osmToggle.title = 'Toggle OSM streets & labels overlay';
    osmToggle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        window.osmOverlay = !window.osmOverlay;
        osmToggle.style.color = window.osmOverlay ? '#1e90ff' : '';
        refreshAllViews();  // re-renders tiles (applies/removes overlay) and updates attribution
    });

    // Click handler to show DEM details tooltip
    mousePosInfo.addEventListener('pointerdown', async (e) => {
        e.stopPropagation();

        const lat = parseFloat(mousePosInfo.dataset.lat);
        const lon = parseFloat(mousePosInfo.dataset.lon);

        if (isNaN(lat) || isNaN(lon)) return;

        // Remove any existing tooltip
        const existingTooltip = document.getElementById('demTooltip');
        if (existingTooltip) {
            existingTooltip.remove();
            return; // Toggle off if clicking again
        }

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'demTooltip';
        tooltip.style.position = 'fixed';
        tooltip.style.top = (e.clientY + 10) + 'px';
        tooltip.style.left = (e.clientX + 10) + 'px';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '10px 15px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.fontSize = '13px';
        tooltip.style.fontFamily = 'monospace';
        tooltip.style.zIndex = '10000';
        tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.innerHTML = 'Loading DEM data...';

        document.body.appendChild(tooltip);

        // Fetch DEM data from endpoint
        try {
            const response = await fetch(`/dem_at_lat_lon?lat=${lat}&lon=${lon}`);
            const data = await response.json();

            if (data.error) {
                tooltip.innerHTML = `<span style="color: #ff6b6b;">Error: ${data.error}</span>`;
                return;
            }

            // Build tooltip content
            let html = `<div style="margin-bottom: 8px; font-weight: bold;">Elevation at ⊕${lat.toFixed(5)},${lon.toFixed(5)}</div>`;

            // Show height first
            if (data.fusion !== null && data.fusion !== undefined) {
                html += `<div style="margin-bottom: 8px; color: #4CAF50; font-weight: bold; font-size: 15px;">${Math.round(data.fusion)}m</div>`;
            }

            // Show individual sources
            if (data.sources) {
                html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #555;">`;
                const sources = ['COPERNICUS', 'SRTM', 'ASTER', 'NASADEM', 'ALOS'];
                for (const source of sources) {
                    if (data.sources[source] !== null && data.sources[source] !== undefined) {
                        html += `<div>${source}: ${Math.round(data.sources[source])}m</div>`;
                    } else {
                        html += `<div style="color: #888;">${source}: N/A</div>`;
                    }
                }
                html += `</div>`;
            }

            tooltip.innerHTML = html;
        } catch (error) {
            tooltip.innerHTML = `<span style="color: #ff6b6b;">Failed to fetch DEM data</span>`;
        }
    });

    // Global click handler to remove tooltip
    document.addEventListener('pointerdown', (e) => {
        const tooltip = document.getElementById('demTooltip');
        if (tooltip && e.target !== mousePosInfo && !tooltip.contains(e.target)) {
            tooltip.remove();
        }
    });

    // Spacer to push the rest to the right side
    const spacer1 = createElem(uiTopBar, 'div', [], { flex: '1' });

    // AOI tools
    const aoiTools = createElem(uiTopBar, 'div', [ "nowrap" ], { display: 'flex', marginRight: '10px' });

    // Center crosshair toggle button
    let crosshairVisible = false;
    const crosshairBtn = createElem(aoiTools, 'button', [], {
        marginRight: '10px',
        height: '100%',
        border: 'none',
        background: 'transparent',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '0 8px'
    }, "⊞");
    crosshairBtn.addEventListener('pointerdown', () => {
        crosshairVisible = !crosshairVisible;
        crosshairBtn.style.background = crosshairVisible ? '#ff6b6b' : 'transparent';

        // Toggle crosshair visibility on all views
        document.querySelectorAll('.view-crosshair').forEach(el => {
            el.style.display = crosshairVisible ? 'block' : 'none';
        });
    });

    // Split view button
    const splitViewBtn = createElem(aoiTools, 'button', [], { marginRight: '10px', height: '100%' }, "<big>&#9707;</big> Two views");
    splitViewBtn.addEventListener('pointerdown', () => {
        const viewsContainer = document.getElementById('viewsContainer');
        const view1container = document.getElementById('view1container');
        const view1 = document.getElementById('view1');
        const view2 = document.getElementById('view2');
        const splitter = document.querySelector('.splitter');
        if (layout == "single") {
            view1container.style.width = '';
            splitter.style.display = 'block';
            view2.style.display = 'block';
            const leftwidth = view1container.clientWidth;
            view1.style.width = "100%";
            view2.style.width = `calc(100% - ${leftwidth + 6}px)`;
            splitViewBtn.innerHTML = "<big>&#9707;</big> Two views";
            layout = "dual";
            refreshAllViews();
        } else if (layout == "dual") {
            view1container.style.width = view1container.clientWidth + 'px';
            view1.style.width = viewsContainer.clientWidth + 'px';
            view2.classList.add('splitView');
            view2.style.width = '';
            // view2 is now position:absolute and would paint over view1container
            // (later in DOM, same auto z-index). Lift the clipping container above it.
            view1container.style.zIndex = '2';
            splitViewBtn.innerHTML = "<big>&#9703;</big> Overlapping views";
            layout = "overlap";
            refreshAllViews();
        } else {
            view2.classList.remove('splitView');
            view1container.style.zIndex = '';
            view1container.style.width = '100%';
            splitter.style.display = 'none';
            view2.style.display = 'none';
            splitViewBtn.innerHTML = "<big>&#9633;</big> Single view";
            layout = "single";
            refreshAllViews();
        }
        const rightSideMapUI = document.getElementById('rightSideMapUI');
        rightSideMapUI.style.display = (layout == "single") ? "none" : "";
    });
    
    // Mark AOI button - creates 50% center AOI immediately
    const markAoiBtn = createElem(aoiTools, 'button', [], { marginRight: '10px', height: '100%' }, "<big>&#x22A1;</big> Mark AOI");
    // Upload shapefile button - using your createElem method
    const uploadShapefileBtn = createElem(aoiTools, 'button', [], { marginRight: '10px', height: '100%' }, "<big>&#x25B3;</big> Upload Vector File");
    // Marked AOI toolbar (shown when AOI exists)
    const aoiToolbar = createElem(aoiTools, 'div', [ "nowrap" ], { display: 'none' });
    // Download button
    const downloadButton = createElem(aoiToolbar, 'button', [], { marginRight: '10px', verticalAlign: 'middle', display: 'flex', alignItems: 'center' }, "<span style='font-size: x-large'>&#x2913</span>&nbsp;<span>Download<span>");
    downloadButton.addEventListener('pointerdown', () => openDownloadAoiPopup());
    // Clear AOI button (shown when AOI exists)
    const clearAoiBtn = createElem(aoiToolbar, 'button', [], { marginRight: '10px', height: '100%' }, "<big>&#x2716;</big> Clear AOI");

    clearAoiBtn.addEventListener('pointerdown', () => {
        // Clear the AOI
        MarkAOI.removeExistingAOI();
        // Show Mark AOI and Upload buttons again
        markAoiBtn.style.display = '';
        uploadShapefileBtn.style.display = '';
        // Hide download toolbar
        aoiToolbar.style.display = 'none';
    });

    markAoiBtn.addEventListener('pointerdown', () => {
        // Create 50% center AOI immediately
        const firstInstance = MarkAOI.instances.values().next().value;
        if (!firstInstance) return;

        const container = firstInstance.mapContainer;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Calculate 50% dimensions
        const aoiWidth = containerWidth * 0.5;
        const aoiHeight = containerHeight * 0.5;
        const aoiLeft = (containerWidth - aoiWidth) / 2;
        const aoiTop = (containerHeight - aoiHeight) / 2;

        // Remove existing AOI if any
        MarkAOI.removeExistingAOI();

        // Create new AOI element
        MarkAOI.currentAOI = document.createElement('div');
        MarkAOI.currentAOI.className = 'aoi';
        MarkAOI.currentAOI.style.left = `${aoiLeft}px`;
        MarkAOI.currentAOI.style.top = `${aoiTop}px`;
        MarkAOI.currentAOI.style.width = `${aoiWidth}px`;
        MarkAOI.currentAOI.style.height = `${aoiHeight}px`;
        container.appendChild(MarkAOI.currentAOI);

        // Add corners for dragging
        firstInstance.addCorners();
        firstInstance.updateBboxCoordinates(); // Calculate bbox first
        firstInstance.updateAreaDisplay(); // Then calculate area (which needs bbox)
        firstInstance.syncAOIToOtherInstances();

        // Hide Mark AOI and Upload buttons
        markAoiBtn.style.display = 'none';
        uploadShapefileBtn.style.display = 'none';
        // Show download toolbar with Clear AOI button
        aoiToolbar.style.display = 'flex';
    });

    // Hidden file input - plain JavaScript like working sample
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.shp,.geojson,.kml,.kmz,.gpx,.gml,.gpkg,.tab,.osm,.zip';
    fileInput.style.display = 'none';

    // Button click handler - plain JavaScript like working sample
    uploadShapefileBtn.onclick = () => {
        console.log('Button clicked, triggering file input');
        fileInput.click();
    };

    // Handle file selection - plain JavaScript like working sample
    fileInput.onchange = (event) => {
        console.log('File selected');
        const file = event.target.files[0];
        
        if (!file) {
            console.log('No file selected');
            return;
        }
        
        console.log('File details:', file.name, file.size, file.type);
        
        // Read the file as binary data
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('File read successfully, size:', e.target.result.byteLength);
            const binaryData = e.target.result;
            
            console.log('Sending request to /get_shapefile_bbox');
            
            // Send as binary payload
            fetch('/get_shapefile_bbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: binaryData
            })
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Response data:', data);
                const bbox = data.bbox;

                // Hide Mark AOI and Upload buttons
                markAoiBtn.style.display = 'none';
                uploadShapefileBtn.style.display = 'none';
                // Show download toolbar with Clear AOI button
                aoiToolbar.style.display = 'flex';

                MarkAOI.setAOI(bbox);
                
                console.log('Bbox updated successfully');
                
                // Reset file input for potential reuse
                fileInput.value = '';
            })
            .catch(error => {
                console.error('Error:', error);
            });
        };
        
        reader.onerror = function(e) {
            console.error('Error reading file:', e);
        };
        
        // Read the file as ArrayBuffer (binary data)
        reader.readAsArrayBuffer(file);
    };

    // Append file input to body - plain JavaScript
    document.body.appendChild(fileInput);

    // special explanation for demo mode
    if (demomode) {
        const demoNotice = createElem(uiTopBar, 'div', [], { lineHeight: "2em", overflow: "hidden" }, "Aerial and EarthToDate reconstruction of the same area and date");
    }
    // Spacer to push the rest to the right side
    const spacer2 = createElem(uiTopBar, 'div', [], { flex: '1' });
    
    // Map services configuration
    const mapServices = {
        'Snapshot': (lat, lon, zoom) => {
            const vp1 = views[0];
            const view1settings = `${vp1.viewtype}:${vp1.date}-${vp1.days_back}@${vp1.max_clouds}`;
            const vp2 = views[1];
            const view2settings = `${vp2.viewtype}:${vp2.date}-${vp2.days_back}@${vp2.max_clouds}`;
            return `${window.location.origin}/snapshot/z${zoom},${lat},${lon}/${view1settings},${view2settings}`;
        },
        'Google Maps': (lat, lon, zoom) => `https://www.google.com/maps?q=${lat},${lon}`,
        'Bing Maps': (lat, lon, zoom) => `https://www.bing.com/maps?cp=${lat}~${lon}&lvl=${zoom}`,
        'OpenStreetMap': (lat, lon, zoom) => `https://www.openstreetmap.org/#map=${zoom}/${lat}/${lon}`,
        'HERE Maps': (lat, lon, zoom) => `https://wego.here.com/?map=${lat},${lon},${zoom}`,
        'ESRI ArcGIS': (lat, lon, zoom) => `https://www.arcgis.com/home/webmap/viewer.html?center=${lon},${lat}&level=${zoom}`,
        'MapQuest': (lat, lon, zoom) => `https://www.mapquest.com/latlng/${lat},${lon}?zoom=${zoom}`,
        'Copy Coordinates': (lat, lon, zoom) => {
            const coords = `${lat}, ${lon}`;
            navigator.clipboard.writeText(coords).then(() => {
                alert(`Coordinates copied to clipboard: ${coords}`);
            }).catch(err => {
                console.error('Failed to copy coordinates: ', err);
            });
            return null; // No URL to open
        }
    };
    const openInSelect = createElem(uiTopBar, 'select', [], { marginLeft: '10px', height: '100%' }, "");
    openInSelect.className = 'map-opener-select';
    const placeholder = createElem(openInSelect, 'option', [], { }, "");
    // const placeholder = document.createElement('option');
    placeholder.text = 'Open in...';
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    // select.appendChild(placeholder);
    function refreshOpenInOptions() {
        while (openInSelect.options.length > 1) {
            openInSelect.remove(1);
        }
        Object.keys(mapServices).forEach(serviceName => {
            // const option = document.createElement('option');
            const option = createElem(openInSelect, 'option', [ "open-opener-option" ], { }, "");
            option.text = serviceName;
            option.value = serviceName;
            openInSelect.appendChild(option);
        });
    }
    refreshOpenInOptions();
    openInSelect.addEventListener('mousedown1', function(e) {
        e.preventDefault();
        refreshOpenInOptions();
        openInSelect.focus();
        openInSelect.size = 2;
        //setTimeout(() => openInSelect.size = 0, 0);
    });
    openInSelect.addEventListener('change', (event) => {
        const serviceName = event.target.value;
        
        if (serviceName === 'Snapshot') {
            // Create dialog for title and subtitle
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 10000;
                min-width: 300px;
            `;
            
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
            `;
            
            dialog.innerHTML = `
                <h3 style="margin: 0 0 15px 0;">Snapshot Options</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Title:</label>
                    <input type="text" id="snapshot-title" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Subtitle:</label>
                    <input type="text" id="snapshot-subtitle" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="text-align: right;">
                    <button id="snapshot-cancel" style="padding: 5px 15px; margin-right: 10px;">Cancel</button>
                    <button id="snapshot-ok" style="padding: 5px 15px;">OK</button>
                </div>
            `;
            
            document.body.appendChild(backdrop);
            document.body.appendChild(dialog);
            
            // Focus on title input
            document.getElementById('snapshot-title').focus();
            
            const cleanup = () => {
                document.body.removeChild(dialog);
                document.body.removeChild(backdrop);
                openInSelect.value = '';
            };
            
            document.getElementById('snapshot-cancel').addEventListener('pointerdown', cleanup);

            document.getElementById('snapshot-ok').addEventListener('pointerdown', () => {
                const title = document.getElementById('snapshot-title').value;
                const subtitle = document.getElementById('snapshot-subtitle').value;
                
                const urlGenerator = mapServices['Snapshot'];
                let url = urlGenerator(lat, lon, zoom);
                
                // Add title and subtitle as query parameters
                const params = new URLSearchParams();
                if (title) params.append('title', title);
                if (subtitle) params.append('subtitle', subtitle);
                
                if (params.toString()) {
                    url += '?' + params.toString();
                }
                
                window.open(url, '_blank');
                cleanup();
            });
            
            // Allow Enter key to submit
            dialog.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('snapshot-ok').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                }
            });
            
            // Allow Escape key to cancel
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                }
            });
            
        } else {
            const urlGenerator = mapServices[serviceName];
            if (urlGenerator) {
                const url = urlGenerator(lat, lon, zoom);
                // if url is null, do not open a new tab
                if (url) {
                    // open the URL in a new tab
                    window.open(url, '_blank');
                }
            }
            // reset the select value to the placeholder
            openInSelect.value = '';
        }
    });
    
    // 3D button
    const D3Btn = createElem(uiTopBar, 'button', [], { marginLeft: '10px', height: '100%' }, "3D&nbsp;View");
    D3Btn.addEventListener('pointerdown', () => {
        const props = views[0];
        // open the 3D view, e.g., https://earthtodate.com/3d/14/46.49/6.4618/2024-11-19/365/10, in a new tab
        window.open(`/3d/${zoom}/${lat}/${lon}/${props.date}/${props.days_back}/${props.max_clouds}`, '_blank');
    });
    // Spacer to push the rest to the right side
    const spacer3 = createElem(uiTopBar, 'div', [], { flex: '1' });
    // User name and logout section
    const sessionSection = createElem(uiTopBar, 'div', [ "nowrap" ], { display: 'flex', marginLeft: '10px', marginRight: '20px', alignItems: 'center', position: 'relative' });
    
    // Get user info from server-rendered template (will be set in template)
    const userInfo = window.currentUser || null;
    const loggedIn = (userInfo !== null);
    const username = loggedIn ? userInfo.username : null;
    
    // Contact us icon (envelope) replaces the old text button
    const contactusBtn = createElem(sessionSection, 'div', [], { marginLeft: '10px', cursor: 'pointer', fontSize: '28px', lineHeight: '1' }, "✉");
    contactusBtn.setAttribute('title', 'Contact Us');
    contactusBtn.setAttribute('data-no-i18n', '1');
    contactusBtn.addEventListener('pointerdown', () => {
        const mailtoLink = 'mailto:contact@earthtodate.com';
        const newTab = window.open(mailtoLink, '_blank');
        if (newTab) {
          newTab.focus();
        } else {
          alert('Unable to open mailto link in a new tab. Please email to contact@earthtodate.com');
        }
    });

    // Position a dropdown (attached to document.body) just under its trigger,
    // aligned to the trigger's right edge. Body-attached so it escapes the top
    // bar's stacking context and renders above the per-view UI bars.
    function placeUnder(trigger, menu) {
        const r = trigger.getBoundingClientRect();
        menu.style.top = r.bottom + 'px';
        menu.style.right = (window.innerWidth - r.right) + 'px';
    }

    if (loggedIn) {
        // Logged-in: username opens a small menu with Logout.
        const menuTrigger = createElem(sessionSection, 'div', [], { marginLeft: '12px', cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center' }, username || '');
        const menu = createElem(document.body, 'div', [], {
            display: 'none', position: 'fixed',
            background: '#fff', color: '#000', border: '1px solid #ccc',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: '100000'
        });
        const logoutRow = createElem(menu, 'div', [], { padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }, "Logout");
        logoutRow.addEventListener('pointerdown', (e) => { e.stopPropagation(); window.location.href = '/logout'; });
        menuTrigger.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            const show = menu.style.display === 'none';
            if (show) placeUnder(menuTrigger, menu);
            menu.style.display = show ? 'block' : 'none';
        });
        document.addEventListener('pointerdown', () => { menu.style.display = 'none'; });
    } else {
        // Logged-out: a Login button.
        const loginBtn = createElem(sessionSection, 'button', [], { marginLeft: '12px', height: '100%' }, "Login");
        loginBtn.addEventListener('pointerdown', () => { window.location.href = '/login'; });
    }

    // Language selector: two-letter code at the very right, opens the language list (all users).
    const langButton = createElem(sessionSection, 'div', [], { marginLeft: '12px', cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 'bold' }, '');
    langButton.setAttribute('data-no-i18n', '1');
    const langMenu = createElem(document.body, 'div', [], {
        display: 'none', position: 'fixed',
        background: '#fff', color: '#000', border: '1px solid #ccc',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: '100000', maxHeight: '60vh', overflowY: 'auto'
    });
    langMenu.setAttribute('data-no-i18n', '1');
    function updateLangLabel() { langButton.textContent = (window.I18N ? window.I18N.lang : 'en').toUpperCase(); }
    updateLangLabel();
    document.addEventListener('i18n:changed', updateLangLabel);
    if (window.I18N) langMenu.appendChild(window.I18N.buildLanguageList(() => { langMenu.style.display = 'none'; }));
    langButton.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const show = langMenu.style.display === 'none';
        if (show) placeUnder(langButton, langMenu);
        langMenu.style.display = show ? 'block' : 'none';
    });
    document.addEventListener('pointerdown', () => { langMenu.style.display = 'none'; });

    // hide all buttons not relevant in demo mode
    if (demomode) {
        aoiTools.style.display = 'none';
        D3Btn.style.display = 'none';
    }
}

// New Product types dropdown options
const productOptions = {
    visual: 'Visual',
    isometric: 'Isometric',
    spectral: 'Spectral',
    s1: 'SAR',
    nightlight: 'Night Light',
    changes_tci: 'Change Detection',
    _scl: 'Scene Classification',
    map: 'Open Street Map',
    aerial: 'Aerial',
    esriworldimagery: 'ESRI World Imagery',
    basemap: 'Basemap',
    dem: 'Elevation Map',
    worldcover: 'WorldCover (ESA 2021)',
    _soilmoisture: 'Soil Moisture',
    // _fieldanomaly: 'Field Anomaly',
    _bgwaterleak: 'Water Leak Warnings',
    flood: 'Flood Simulation',
    _biomassgrassland: 'Grassland Biomass',
    _lulc: 'Land Cover Classification',
    newconstruction: 'New Construction',
    soilsalinity: 'Soil Salinity',  // Will show secondary dropdown
    pollution: 'Pollution (Air Quality)',  // Will show secondary dropdown (Combined + 6 gases)
    _mineralmap: 'Mineral Map'  // Only shown if user.mineralmap
};

// Pollution sub-options (combined + the 6 S5P gases) -> pollution[_gas]_overlay
const pollutionOptions = {
    _combined: 'Combined (all gases)',
    _no2: 'NO₂ - Nitrogen Dioxide',
    _so2: 'SO₂ - Sulfur Dioxide',
    _co: 'CO - Carbon Monoxide',
    _ch4: 'CH₄ - Methane',
    _hcho: 'HCHO - Formaldehyde',
    _aer_ai: 'Aerosol Index'
};

// Pollution gas metadata: colors mirror pollution.py GAS_COLOR (Okabe-Ito colorblind-safe);
// days = denoise window length.
const pollutionGasMeta = {
    no2:    { label: 'NO₂',     color: '213,94,0',   days: 14 },
    so2:    { label: 'SO₂',     color: '240,228,66', days: 30 },
    co:     { label: 'CO',      color: '86,180,233', days: 14 },
    ch4:    { label: 'CH₄',     color: '204,121,167',days: 30 },
    hcho:   { label: 'HCHO',    color: '0,158,115',  days: 30 },
    aer_ai: { label: 'Aerosol', color: '230,159,0',  days: 7  }
};
const POLLUTION_ATTRIB = 'Contains modified Copernicus Sentinel-5P data';

// Toggle the pollution legend + set the S5P attribution / "X-day reading" notice per view.
// When zoom is given and outside the supported 3-11 (0.08-20km) range, show the fault message.
function updatePollutionUI(viewNum, viewtype, zoom) {
    const legend = document.getElementById(`pollutionLegend${viewNum}`);
    const notice = document.getElementById(`notUpToDateNotice${viewNum}`);
    const searchWrap = document.getElementById(`pollutionSearchWrap${viewNum}`);
    const isPoll = !!viewtype && viewtype.startsWith('pollution') && viewtype.endsWith('_overlay');
    const toggle = document.getElementById(`pollutionModeToggle${viewNum}`);
    const isDelta = !!viewtype && viewtype.endsWith('_delta_overlay');
    const core = isPoll ? viewtype.slice(0, isDelta ? -'_delta_overlay'.length : -'_overlay'.length) : '';
    const isCombined = core === 'pollution';
    const gas = (isPoll && !isCombined) ? core.slice('pollution_'.length) : null;
    if (legend) legend.style.display = isPoll ? 'block' : 'none';
    if (searchWrap) searchWrap.style.display = isPoll ? 'inline-block' : 'none';
    if (toggle) {
        toggle.style.display = isPoll ? 'inline-block' : 'none';   // Σ levels / Δ change — all pollution views
        toggle.textContent = isDelta ? 'Δ' : 'Σ';
        toggle.style.color = isDelta ? '#1e90ff' : '';
        if (window.pollutionCompositeMode === undefined) window.pollutionCompositeMode = 'abs';
    }
    if (!isPoll) return;   // refreshAllViews owns the notice for non-pollution views
    if (legend) {
        if (gas && pollutionGasMeta[gas] && isDelta) {
            const m = pollutionGasMeta[gas];
            legend.innerHTML =
              `<div class="legendTitle">${m.label} — vs baseline (Δ)</div>` +
              `<div class="gradientBar" style="background:linear-gradient(to right,#1e5aeb,#3a90e0,#cccccc,#e0703a,#eb2020);"></div>` +
              `<div class="gradientLabels"><span>Below</span><span>Baseline</span><span>Above</span></div>`;
        } else if (gas && pollutionGasMeta[gas]) {
            const m = pollutionGasMeta[gas];
            const c = m.color.split(',').map(Number);
            const light = c.map(x => Math.round(x * 0.15 + 255 * 0.85)).join(',');
            const dark = c.map(x => Math.round(x * 0.55)).join(',');
            legend.innerHTML =
              `<div class="legendTitle">${m.label} — level (Σ)</div>` +
              `<div class="gradientBar" style="background:linear-gradient(to right,rgb(${light}),rgb(${m.color}),rgb(${dark}));"></div>` +
              `<div class="gradientLabels"><span>Low</span><span>High</span></div>`;
        } else {
            let html = `<div class="legendTitle">Pollution<br>${isDelta ? 'Above baseline (Δ)' : 'Leading pollutant (Σ)'}</div>`;
            for (const k of ['no2','so2','co','ch4','hcho','aer_ai']) {
                const m = pollutionGasMeta[k];
                html += `<div class="legendItem"><div class="legendColor" style="background-color:rgb(${m.color});"></div><span>${m.label}</span></div>`;
            }
            legend.innerHTML = html;
        }
    }
    if (notice) {
        notice.style.display = 'block';
        if (zoom !== undefined && (zoom < 3 || zoom > 11)) {
            notice.textContent = 'Pollution view is only supported at 0.08-20km resolutions';
        } else {
            const days = (gas && pollutionGasMeta[gas]) ? `${pollutionGasMeta[gas].days}-day reading` : 'latest reading';
            notice.textContent = `${POLLUTION_ATTRIB} · ${days}`;
        }
    }
}

// Format a measurement value: big -> integer, mid -> 2dp, tiny -> scientific.
function fmtPollutionVal(v) {
    if (v === null || v === undefined) return '—';
    const a = Math.abs(v);
    return a >= 100 ? v.toFixed(0) : (a >= 1 ? v.toFixed(2) : v.toExponential(2));
}

// Live Location pick: navigate the map there, then show our current S5P reading + units
// for the selected gas (or all 6 in Combined).
async function selectPollutionLocation(loc, viewNum) {
    const results = document.getElementById(`pollutionSearchResults${viewNum}`);
    if (results) results.style.display = 'none';
    const input = document.getElementById(`pollutionSearchInput${viewNum}`);
    if (input) input.value = loc.name.split(',')[0];
    const readout = document.getElementById(`pollutionReadout${viewNum}`);
    if (readout) readout.textContent = '…';
    // Navigate the same way the zoom buttons / drag do, so link + lat/lon + zoom displays
    // all update: set globals, push zoom (updates the zoom readout), update URL, refresh maps.
    lat = loc.lat; lon = loc.lon;
    setZoomLevelWithoutRefresh(6);   // pollution lives at z3-7
    updateUrl();
    refreshAllViews();
    // Determine current gas from the view's viewtype.
    const vt = (views[viewNum - 1] && views[viewNum - 1].viewtype) || '';
    const mid = vt.startsWith('pollution') && vt.endsWith('_overlay')
        ? vt.slice('pollution'.length, -'_overlay'.length) : '';
    const gas = mid === '' ? 'combined' : mid.replace(/^_/, '');
    try {
        const rep = await (await fetch(`/pollution_value?lat=${loc.lat}&lon=${loc.lon}&gas=${gas}`)).json();
        if (readout) readout.innerHTML = rep.map(x =>
            `${x.gas}: ${fmtPollutionVal(x.value)}${x.value == null ? '' : ' ' + x.units}`).join('<br>');
    } catch (e) { if (readout) readout.textContent = 'no reading'; }
}

// Night Light options - resolution x visualization
const nightlightOptions = {
    nightlight25m_darkened: '25m Darkened',
    nightlight25m_lighted: '25m Lighted',
    nightlight25m_tci: '25m Grayscale',
    nightlight500m_darkened: '500m Darkened',
    nightlight500m_lighted: '500m Lighted',
    nightlight500m_tci: '500m Grayscale'
};

// New Sensor/Resolution options
const sensorOptions = {
    s2rr: '1m Refined Reality',  // Visual only (default)
    sr: '50cm super-res x2',  // Visual only (legacy super-resolution)
    r5m: '5m Combined',  // Visual only (S2 + Landsat 5m, auto-selects source per date)
    s2r5m: '5m Sentinel-2',  // Visual only (derived resolution x2)
    s2: '10m Sentinel-2',  // Visual and Spectral
    s2dr: '2m Derived Resolution',  // Spectral only
    ls15: '15m Landsat',  // Visual only (Brovey pansharpened)
    ls5: '5m Landsat',  // Visual only (bicubic x3 of 15m pansharpened)
    ps: '3m PlanetScope',  // Visual only
    psrr: '1.9m PlanetScope Refined Reality',  // Visual only — PS-specific x2 model + bicubic x2
    pssrx2: '1.5m PlanetScope x2 Super-Res',   // Visual only — universal x2 model
    pssrx4: '0.75m PlanetScope x4 Super-Res',  // Visual only — universal x4 ESRGAN
    cbers4a: '2m CBERS-4A',  // Visual only (SFIM pansharpened, free data, South America + East Africa). In-region reads via AWS proxy (windowed COG + overview cap + disk LRU).
    cbers4arr: '1m CBERS-4A Refined Reality',  // Visual only (SFIM + uni_panx2 super-res)
    // Imagery subdirectories will be added dynamically
    // Note: s2r2m is used internally for certain products but not shown to users
};

// LULC palette - mirrors lulc3.PALETTE for legend + click-tooltip reverse lookup.
const LULC_PALETTE = {
    'water':        [ 30,  90, 200],
    'wetland':      [ 60, 150, 150],
    'snow':         [240, 245, 255],
    'ice':          [180, 220, 240],
    'cloud':        [210, 215, 230],
    'veg-dense':    [ 15,  85,  25],
    'veg-mid':      [ 75, 165,  60],
    'veg-low':      [175, 210,  90],
    'veg-sparse':   [215, 230, 175],
    'bare':         [145, 105,  70],
    'rock':         [ 95,  75,  55],
    'sand':         [235, 210, 150],
    'built-dark':   [130,  25,  25],
    'built-bright': [255,  90,  90],
    'construction': [220,  45,  45],
    'industrial':   [175,  50, 200],
    'paved-road':   [  0, 200, 255],
    'dirt-road':    [255, 200,   0],
    'mixed':        [130, 130, 130],
    'noise':        [ 60,  60,  60],
    'shadow':       [ 45,  45,  70],
    'saturated':    [255, 100, 255]
};

// Soil salinity sub-options
const soilSalinityOptions = {
    _soilsalinity: 'Soil Salinity Score (0-100)',
    _soilsalinityclass: 'Soil Salinity Categories',
    _soilsalinityconfidence: 'Soil Salinity Confidence'
};

// Spectral options (band combinations and indices)
const spectralOptions = {
    // Band Visualizations
    _veganalysis: 'NIR-Red-Green (Vegetation/False Color)',
    _natural: 'Red-Green-Blue (True Color)',
    _cropsoil: 'NIR-SWIR-Red (Crop/Soil Moisture)',
    _vegstress: 'SWIR-NIR-Red (Vegetation Stress)',
    _geology: 'SWIR-NIR-Blue (Geological)',
    _urban: 'NIR-SWIR-Blue (Urban/Rock)',
    _water: 'NIR-Red-Blue (Water Bodies)',
    _watercontent: 'SWIR-Red-Green (Water Content)',
    _atmosphere: 'NIR-Green-Blue (Atmospheric)',
    _burnscar: 'SWIR2-NIR-Red (Burn Scars)',
    _snow: 'SWIR-Red-Green (Snow/Ice)',
    _bathymetric: 'Red-Green-Blue (Bathymetric)',
    _vegmoisture: 'SWIR-NIR-Green (Veg+Moisture)',
    _drought: 'SWIR2-SWIR1-Red (Drought)',
    // Spectral Indices
    _ndvi: 'NDVI - Vegetation Health Index',
    _ndwi: 'NDWI - Water Content Index',
    _savi: 'SAVI - Soil Adjusted Vegetation Index',
    _msavi: 'MSAVI - Modified Soil Adjusted Vegetation',
    _msavi2: 'MSAVI2 - Second Modified Soil Adjusted',
    _evi: 'EVI - Enhanced Vegetation Index',
    _evi2: 'EVI2 - Two-Band Enhanced Vegetation',
    _nbr: 'NBR - Normalized Burn Ratio',
    _nbr2: 'NBR2 - Normalized Burn Ratio 2',
    _ndre: 'NDRE - Normalized Difference Red Edge',
    _ndre2: 'NDRE2 - Normalized Difference Red Edge 2',
    _ndre3: 'NDRE3 - Normalized Difference Red Edge 3',
    _cire: 'CIRE - Chlorophyll Index Red Edge',
    _cire2: 'CIRE2 - Chlorophyll Index Red Edge 2',
    _cire3: 'CIRE3 - Chlorophyll Index Red Edge 3',
    _cig: 'CIG - Chlorophyll Index Green',
    _gndvi: 'GNDVI - Green Normalized Difference Vegetation',
    _rvi: 'RVI - Ratio Vegetation Index',
    _dvi: 'DVI - Difference Vegetation Index',
    _rdvi: 'RDVI - Renormalized Difference Vegetation',
    _osavi: 'OSAVI - Optimized Soil Adjusted Vegetation',
    _tsavi: 'TSAVI - Transformed Soil Adjusted Vegetation',
    _pvi: 'PVI - Perpendicular Vegetation Index',
    _ipvi: 'IPVI - Infrared Percentage Vegetation',
    _grvi: 'GRVI - Green-Red Vegetation Index',
    _sr: 'SR - Simple Ratio Index',
    _sr2: 'SR2 - Simple Ratio 2',
    _sipi: 'SIPI - Structure Insensitive Pigment',
    _ari: 'ARI - Anthocyanin Reflectance Index',
    _cri1: 'CRI1 - Carotenoid Reflectance Index 1',
    _cri2: 'CRI2 - Carotenoid Reflectance Index 2',
    _mcari: 'MCARI - Modified Chlorophyll Absorption',
    _tcari: 'TCARI - Transformed Chlorophyll Absorption',
    _mre: 'MRE - Modified Red Edge Index',
    _tre: 'TRE - Transformed Red Edge Index',
    _rendvi: 'RENDVI - Red Edge Normalized Difference',
    _mtvi: 'MTVI - Modified Triangular Vegetation',
    _mtvi2: 'MTVI2 - Modified Triangular Vegetation 2',
    _tvi: 'TVI - Triangular Vegetation Index',
    _ndsi: 'NDSI - Normalized Difference Soil Index',
    _bsi: 'BSI - Bare Soil Index',
    _ndmi: 'NDMI - Normalized Difference Moisture Index',
    _lai: 'LAI - Leaf Area Index',
    _cwc: 'CWC - Canopy Water Content (g/m²)',
    _mineralclass: 'Mineral Classification'  // Only shown if user.mineralmap
};

// When a view loads (deep link) or the user switches into an S1 viewtype, the date
// they bring along may not actually have S1 data here — S1 acquisitions are sparse
// (revisit ~6 days, swath-dependent). Snap to the closest available date at-or-before
// the current props.date so the view shows something rather than empty tiles. This
// is intentionally NOT triggered on every refresh — only on transitions into S1.
async function snapToClosestAvailableS1Date(viewNum, props) {
    if (!props || !props.viewtype || !props.viewtype.startsWith('s1')) return;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;
    if (!props.date) return;
    try {
        const r = await fetch(`/dates/${lat},${lon}/${props.viewtype}/${props.date}/365/100`);
        const arr = await r.json();
        if (!Array.isArray(arr) || arr.length === 0) return;
        const closest = arr[0][0];      // /dates returns dates sorted DESC
        if (closest === props.date) return;
        props.date = closest;
        const di = document.getElementById(`dateInput${viewNum}`);
        if (di) di.value = closest;
    } catch (e) {
        // Network or shape error — leave the date alone, view will just render empty.
    }
}

// New helper functions for the dropdown system
function createNewDropdownSystem(uiContainer, viewNum, props) {
    const hasMineralmap = false;  // Mineral Map view hidden

    // Create Product dropdown
    const productSelect = createElem(uiContainer, 'select', [], { maxWidth: '180px', marginRight: '5px' });
    productSelect.id = `newProductSelect${viewNum}`;

    // Add product options
    const hasBasemap = !!(window.currentUser && window.currentUser.esriworldimagery);
    for (const [key, value] of Object.entries(productOptions)) {
        // Skip mineral map if user doesn't have permission
        if (key === '_mineralmap' && !hasMineralmap) continue;
        // Skip esriworldimagery if user doesn't have permission
        if (key === 'esriworldimagery' && !hasBasemap) continue;

        const option = createElem(productSelect, 'option', [], {}, value);
        option.value = key;
    }

    // Create Sensor dropdown
    const sensorSelect = createElem(uiContainer, 'select', [], { maxWidth: '200px', marginRight: '5px', display: 'none' });
    sensorSelect.id = `newSensorSelect${viewNum}`;

    // All sensor options (incl. Landsat/CBERS) are shown to everyone.
    const sensorHidden = new Set();
    for (const [key, value] of Object.entries(sensorOptions)) {
        const option = createElem(sensorSelect, 'option', [], {}, value);
        option.value = key;
        if (sensorHidden.has(key)) option.style.display = 'none';
    }

    // Add imagery subdirectories to sensor options
    if (imagerySubdirectories.length > 0) {
        imagerySubdirectories.forEach(subdir => {
            // Add regular version
            const option = createElem(sensorSelect, 'option', [], {}, subdir);
            option.value = subdir;

            // Add Refined Reality version
            const rrOption = createElem(sensorSelect, 'option', [], {}, `${subdir} Refined Reality`);
            rrOption.value = `${subdir}sr`;
        });
    }

    // Create Spectral dropdown
    const spectralSelect = createElem(uiContainer, 'select', [], { maxWidth: '250px', marginRight: '5px', display: 'none' });
    spectralSelect.id = `newSpectralSelect${viewNum}`;

    // Add spectral options
    for (const [key, value] of Object.entries(spectralOptions)) {
        // Skip mineral classification if user doesn't have permission
        if (key === '_mineralclass' && !hasMineralmap) continue;

        const option = createElem(spectralSelect, 'option', [], {}, value);
        option.value = key;
    }
    spectralSelect.value = '_ndvi';

    // Create Soil Salinity sub-dropdown
    const soilSalinitySelect = createElem(uiContainer, 'select', [], { maxWidth: '200px', marginRight: '5px', display: 'none' });
    soilSalinitySelect.id = `soilSalinitySelect${viewNum}`;

    // Add soil salinity options
    for (const [key, value] of Object.entries(soilSalinityOptions)) {
        const option = createElem(soilSalinitySelect, 'option', [], {}, value);
        option.value = key;
    }

    // Create Pollution gas dropdown (Combined + 6 gases)
    const pollutionSelect = createElem(uiContainer, 'select', [], { maxWidth: '200px', marginRight: '5px', display: 'none' });
    pollutionSelect.id = `pollutionSelect${viewNum}`;
    for (const [key, value] of Object.entries(pollutionOptions)) {
        const option = createElem(pollutionSelect, 'option', [], {}, value);
        option.value = key;
    }

    // Composite mode toggle (Combined only): Σ absolute levels (default) <-> Δ change vs baseline
    const pollutionModeToggle = createElem(uiContainer, 'label', ['clickable-element'],
        { display: 'none', marginRight: '10px', fontSize: '20px', cursor: 'pointer', userSelect: 'none', lineHeight: '1' }, 'Σ');
    pollutionModeToggle.id = `pollutionModeToggle${viewNum}`;
    pollutionModeToggle.title = 'Composite: Σ absolute levels / Δ change vs baseline (click to switch)';
    pollutionModeToggle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        window.pollutionCompositeMode = (window.pollutionCompositeMode === 'delta') ? 'abs' : 'delta';
        updateViewTypeFromNewDropdowns();
    });

    // Live Location: incremental place search; on pick -> navigate + show our S5P reading.
    const pollutionSearchWrap = createElem(uiContainer, 'div', ['pollutionSearchWrap'],
        { display: 'none', position: 'relative', marginRight: '5px', verticalAlign: 'top' });
    pollutionSearchWrap.id = `pollutionSearchWrap${viewNum}`;
    const pollutionSearchInput = createElem(pollutionSearchWrap, 'input', [], { width: '180px' });
    pollutionSearchInput.type = 'text';
    pollutionSearchInput.placeholder = 'Live Location';
    pollutionSearchInput.id = `pollutionSearchInput${viewNum}`;
    const pollutionSearchResults = createElem(pollutionSearchWrap, 'div', ['pollutionSearchResults'],
        { display: 'none', position: 'absolute', top: '100%', left: '0', zIndex: '2000', background: '#fff',
          color: '#000', width: '270px', maxHeight: '220px', overflowY: 'auto', border: '1px solid #888', fontSize: '11px' });
    pollutionSearchResults.id = `pollutionSearchResults${viewNum}`;
    const pollutionReadout = createElem(pollutionSearchWrap, 'div', ['pollutionReadout'],
        { fontSize: '11px', marginTop: '2px', whiteSpace: 'nowrap' });
    pollutionReadout.id = `pollutionReadout${viewNum}`;
    let pollSearchTimer = null;
    pollutionSearchInput.addEventListener('input', () => {
        clearTimeout(pollSearchTimer);
        const q = pollutionSearchInput.value.trim();
        if (q.length < 2) { pollutionSearchResults.style.display = 'none'; return; }
        pollSearchTimer = setTimeout(async () => {
            try {
                const list = await (await fetch(`/pollution_geocode?q=${encodeURIComponent(q)}`)).json();
                pollutionSearchResults.innerHTML = '';
                if (!list.length) { pollutionSearchResults.style.display = 'none'; return; }
                list.forEach(loc => {
                    const item = createElem(pollutionSearchResults, 'div', [],
                        { padding: '3px 6px', cursor: 'pointer', borderBottom: '1px solid #eee' }, loc.name);
                    item.addEventListener('click', () => selectPollutionLocation(loc, viewNum));
                });
                pollutionSearchResults.style.display = '';
            } catch (e) { pollutionSearchResults.style.display = 'none'; }
        }, 300);
    });

    // Create Night Light resolution dropdown
    const nightlightSelect = createElem(uiContainer, 'select', [], { maxWidth: '200px', marginRight: '5px', display: 'none' });
    nightlightSelect.id = `nightlightSelect${viewNum}`;

    for (const [key, value] of Object.entries(nightlightOptions)) {
        const option = createElem(nightlightSelect, 'option', [], {}, value);
        option.value = key;
    }

    // New Construction "months ago" dropdown
    const newConstructionSelect = createElem(uiContainer, 'select', [], { maxWidth: '120px', marginRight: '5px', display: 'none' });
    newConstructionSelect.id = `newConstructionSelect${viewNum}`;
    const monthsOptions = [1, 2, 3, 6, 12, 24, 36, 48, 60];
    for (const m of monthsOptions) {
        const opt = createElem(newConstructionSelect, 'option', [], {}, `${m} months ago`);
        opt.value = String(m);
    }
    newConstructionSelect.value = '12';

    // S1 subview dropdown (VV / VH)
    const s1SubviewSelect = createElem(uiContainer, 'select', [], { maxWidth: '250px', marginRight: '5px', display: 'none' });
    s1SubviewSelect.id = `s1SubviewSelect${viewNum}`;
    // SAR subview options. Convention: keys starting with `nisar_` map directly
    // to a `nisar_<pol>_tci` viewtype; everything else is prefixed with `s1`
    // and suffixed with `_tci` (e.g. `vv` → `s1vv_tci`).
    const s1Subviews = {
        vvsr: 'Sentinel-1 VV 2m SR (Beta)',
        vhsr: 'Sentinel-1 VH 2m SR (Beta)',
        vvdenoised: 'Sentinel-1 VV denoised (Beta)',
        vhdenoised: 'Sentinel-1 VH denoised (Beta)',
        vv: 'Sentinel-1 VV 10m (Beta)',
        vh: 'Sentinel-1 VH 10m (Beta)',
        nisar_hh: 'NISAR HH 5–10m (L-band, Beta)',
        nisar_hv: 'NISAR HV 5–10m (L-band, Beta)',
        shipdetection: 'Ship Detection'
    };
    // NISAR subviews are shown to everyone; the denoised ones stay hidden always.
    const s1HiddenSubviews = new Set(['vvdenoised', 'vhdenoised']);
    for (const [key, value] of Object.entries(s1Subviews)) {
        const option = createElem(s1SubviewSelect, 'option', [], {}, value);
        option.value = key;
        if (s1HiddenSubviews.has(key)) option.style.display = 'none';
    }

    // AIS checkbox - created once, visibility controlled by view type
    const aisLabel = document.createElement('label');
    aisLabel.style.cssText = 'margin-left:8px;font-size:13px;cursor:pointer;display:none;white-space:nowrap;';
    aisLabel.id = 'aisLabel' + viewNum;
    const aisCb = document.createElement('input');
    aisCb.type = 'checkbox';
    aisCb.id = 'aisCheckbox' + viewNum;
    aisCb.style.cursor = 'pointer';
    aisLabel.appendChild(aisCb);
    aisLabel.appendChild(document.createTextNode(' AIS'));
    uiContainer.appendChild(aisLabel);

    aisCb.addEventListener('change', () => {
      if (aisCb.checked) {
        refreshAisOverlay();
      } else {
        const view = document.getElementById('view' + viewNum);
        if (view) view.querySelectorAll('[data-ais-marker]').forEach(el => el.remove());
        document.querySelectorAll('[data-ais-popup]').forEach(el => el.remove());
        showAisStaleIndicator(false, view);
      }
    });

    // Function to update viewtype based on new dropdown selections
    function updateViewTypeFromNewDropdowns() {
        const _prevViewtype = props.viewtype;
        const product = productSelect.value;
        const sensor = sensorSelect.value;
        const spectral = spectralSelect.value;
        const soilSalinity = soilSalinitySelect.value;

        // Hide all secondary dropdowns first
        sensorSelect.style.display = 'none';
        spectralSelect.style.display = 'none';
        soilSalinitySelect.style.display = 'none';
        pollutionSelect.style.display = 'none';
        nightlightSelect.style.display = 'none';
        s1SubviewSelect.style.display = 'none';
        newConstructionSelect.style.display = 'none';

        // Determine viewtype based on product selection
        if (product === 'visual') {
            sensorSelect.style.display = '';

            // Restore all sensor options (they might have been hidden by Spectral)
            // but hide s2dr which is spectral-only
            Array.from(sensorSelect.options).forEach(option => {
                option.style.display = option.value === 's2dr' ? 'none' : '';
            });

            // If s2dr was selected (e.g. switching from Spectral), fall back to s2
            if (sensorSelect.value === 's2dr') sensorSelect.value = 's2';

            // Default to s2 (10m Sentinel-2) if not set
            if (!sensor) sensorSelect.value = 's2';
            props.viewtype = sensorSelect.value + '_tci';

        } else if (product === 'spectral') {
            sensorSelect.style.display = '';
            spectralSelect.style.display = '';

            // Filter sensor options based on spectral support - only 2m and 10m
            const spectralSupportedSensors = ['s2dr', 's2'];  // Only 2m Derived Resolution and 10m Sentinel-2
            Array.from(sensorSelect.options).forEach(option => {
                // Only show s2dr and s2, hide everything else including imagery sources
                const isSupported = spectralSupportedSensors.includes(option.value);
                option.style.display = isSupported ? '' : 'none';
            });

            // Check if current sensor selection is valid for spectral
            const isCurrentSensorValid = spectralSupportedSensors.includes(sensorSelect.value);

            // If no sensor selected or current sensor is not valid for spectral, select a default
            if (!sensor || !isCurrentSensorValid) {
                sensorSelect.value = 's2';  // Default to 10m Sentinel-2
            }
            if (!spectral) spectralSelect.value = '_ndvi';

            // Special case: mineral classification always uses s2r2m internally
            if (spectralSelect.value === '_mineralclass') {
                props.viewtype = 's2r2m_mineralclass';
            } else {
                props.viewtype = sensorSelect.value + spectralSelect.value;
            }

        } else if (product === 's1') {
            s1SubviewSelect.style.display = '';
            if (!s1SubviewSelect.value) s1SubviewSelect.value = 'vvsr';
            var subview = s1SubviewSelect.value;
            if (subview === 'shipdetection') {
                props.viewtype = 'shipdetection_tci';
            } else if (subview.startsWith('nisar_')) {
                props.viewtype = subview + '_tci';
            } else {
                props.viewtype = 's1' + subview + '_tci';
            }

        } else if (product === 'nightlight') {
            nightlightSelect.style.display = '';
            if (!nightlightSelect.value) nightlightSelect.value = 'nightlight25m_darkened';
            props.viewtype = nightlightSelect.value;

        } else if (product === 'soilsalinity') {
            soilSalinitySelect.style.display = '';
            // No sensor dropdown - always uses s2r2m

            if (!soilSalinity) soilSalinitySelect.value = '_soilsalinity';

            props.viewtype = 's2r2m' + soilSalinitySelect.value;

        } else if (product === 'pollution') {
            // Pollution: transparent gas overlay (S5P) on a grayscale basemap.
            // '_combined' -> pollution_overlay (Σ abs) / pollution_delta_overlay (Δ) ; '_no2' -> pollution_no2_overlay
            pollutionSelect.style.display = '';
            if (!pollutionSelect.value) pollutionSelect.value = '_combined';
            const g = pollutionSelect.value;
            const mode = window.pollutionCompositeMode || 'abs';
            const suffix = (mode === 'delta') ? '_delta_overlay' : '_overlay';   // Σ levels / Δ change
            props.viewtype = (g === '_combined') ? ('pollution' + suffix) : ('pollution' + g + suffix);

        } else if (product === '_biomassgrassland' || product === '_soilmoisture' || product === '_fieldanomaly' || product === '_bgwaterleak' || product === '_mineralmap' || product === '_lulc') {
            // These always use s2r2m - no sensor dropdown shown
            props.viewtype = 's2r2m' + product;

        } else if (product === 'newconstruction') {
            // New Construction: 1m grayscale s2rr_tci with new-built pixels in red.
            // Comparison date = (current date - months*30d), searched ±30d at ≤15% clouds.
            newConstructionSelect.style.display = '';
            if (!newConstructionSelect.value) newConstructionSelect.value = '12';
            props.viewtype = 'newconstruction_tci';
            props.months = parseInt(newConstructionSelect.value, 10);

        } else if (product === 'flood') {
            // Flood simulation is just 'flood'
            props.viewtype = 'flood';

        } else if (product === '_scl') {
            // Scene Classification always uses s2_scl
            props.viewtype = 's2_scl';

        } else {
            // Single-segment views (Change Detection, map, aerial, dem, etc.)
            props.viewtype = product;
        }

        // Update the old dropdowns to match (for backwards compatibility)
        updateOldDropdownsFromViewtype(props.viewtype, viewNum);

        // Pollution: toggle its legend + set S5P attribution / "X-day reading" notice
        updatePollutionUI(viewNum, props.viewtype);

        // Hide date controls for esriworldimagery views, show for everything else
        const dateContainerEl = document.getElementById(`dateContainer${viewNum}`);
        const additionalControlsEl = document.getElementById(`additionalControls${viewNum}`);
        const esriworldimageryViews = ['map', 'aerial', 'esriworldimagery', 'basemap', 'dem', 'worldcover', 'pollution'];
        // Also hide date for external imagery (subdirs in /usr/local/var/etd/imagery)
        // and their "Refined Reality" variants (subdir+sr) — date is irrelevant.
        const sensorVal = (sensorSelect && sensorSelect.value) || '';
        const isExternalImagery = imagerySubdirectories.length > 0 && imagerySubdirectories.some(subdir =>
            sensorVal === subdir || sensorVal === `${subdir}sr`
        );
        const hideDate = esriworldimageryViews.includes(product) || isExternalImagery;
        if (dateContainerEl) dateContainerEl.style.display = hideDate ? 'none' : '';
        if (additionalControlsEl) additionalControlsEl.style.display = hideDate ? 'none' : '';
        // External imagery often carries placeholder/invalid dates (e.g. "1604-72-02")
        // from URL or upstream — coerce to today so the date picker stays usable
        // if the user later switches to a date-driven view.
        if (isExternalImagery) {
            const d = props.date ? new Date(props.date) : null;
            const yr = d && !isNaN(d.getTime()) ? d.getUTCFullYear() : NaN;
            if (!d || isNaN(d.getTime()) || yr < 2000 || yr > 2030) {
                props.date = new Date().toISOString().slice(0, 10);
                const dateInputEl = document.getElementById(`dateInput${viewNum}`);
                if (dateInputEl) dateInputEl.value = props.date;
            }
            // Mirror selection in the other view: pair the SR <-> non-SR variant
            // of the same imagery subdir, so view 1 and view 2 stay aligned.
            if (!window._syncingImagery) {
                const isSr = sensorVal.endsWith('sr') && !imagerySubdirectories.includes(sensorVal);
                const baseSubdir = isSr ? sensorVal.slice(0, -2) : sensorVal;
                const pair = isSr ? baseSubdir : `${baseSubdir}sr`;
                const otherNum = viewNum === 1 ? 2 : 1;
                const otherProduct = document.getElementById(`newProductSelect${otherNum}`);
                const otherSensor = document.getElementById(`newSensorSelect${otherNum}`);
                if (otherProduct && otherSensor && otherSensor.value !== pair) {
                    window._syncingImagery = true;
                    try {
                        otherProduct.value = 'visual';
                        otherSensor.value = pair;
                        otherSensor.dispatchEvent(new Event('change'));
                    } finally {
                        window._syncingImagery = false;
                    }
                }
            }
        }

        // Swap the map engine when the engine type changes (tile vs Apple-basemap
        // vs isometric); else just refresh the existing instance.
        const engineOf = (vt) => vt === 'basemap' ? 'basemap' : vt === 'isometric' ? 'isometric' : 'tile';
        if (engineOf(_prevViewtype) !== engineOf(props.viewtype)) {
            initMap(document.getElementById('view' + viewNum), viewNum - 1);
        } else if (views[viewNum - 1].map) {
            views[viewNum - 1].map.refresh();
        }
        updateUrl();

        // Update search interface in case imagery source was selected/deselected
        // (skip during view-sync; the originating view already triggers it)
        if (!window._syncingImagery) updateSearchInterface();

        // Call refreshAllViews to update UI elements like SCL legend, flood control, mineral legend visibility
        if (typeof window.refreshAllViews === 'function') {
            window.refreshAllViews();
        }

        // Transitioned into an S1 viewtype — snap props.date to the closest date at-or-before
        // that has S1 coverage at this lat,lon, then refresh again with the corrected date.
        const enteredS1 = props.viewtype && props.viewtype.startsWith('s1') &&
                          !(_prevViewtype && _prevViewtype.startsWith('s1'));
        if (enteredS1) {
            snapToClosestAvailableS1Date(viewNum, props).then(() => {
                if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
                updateUrl();
            });
        }
    }

    // Function to set new dropdowns from existing viewtype
    function setNewDropdownsFromViewtype(viewtype) {
        // Parse the viewtype to determine product, sensor, and spectral
        if (viewtype.startsWith('pollution') && viewtype.endsWith('_overlay')) {
            productSelect.value = 'pollution';
            pollutionSelect.style.display = '';
            // pollution[_gas][_delta]_overlay -> gas dropdown + composite mode
            const d = viewtype.endsWith('_delta_overlay');
            const core = viewtype.slice(0, d ? -('_delta_overlay'.length) : -('_overlay'.length));
            window.pollutionCompositeMode = d ? 'delta' : 'abs';
            pollutionSelect.value = (core === 'pollution') ? '_combined' : ('_' + core.slice('pollution_'.length));
        } else if (viewtype === 'shipdetection_tci') {
            productSelect.value = 's1';
            s1SubviewSelect.value = 'shipdetection';
        } else if (viewtype.startsWith('s1') && viewtype.endsWith('_tci')) {
            productSelect.value = 's1';
            s1SubviewSelect.value = viewtype.replace('s1', '').replace('_tci', '');
        } else if (viewtype.startsWith('nisar_') && viewtype.endsWith('_tci')) {
            productSelect.value = 's1';
            s1SubviewSelect.value = viewtype.replace('_tci', '');  // nisar_hh / nisar_hv
        } else if (viewtype === 'changes_tci') {
            productSelect.value = 'changes_tci';
        } else if (viewtype === '_scl' || viewtype === 's2_scl') {
            productSelect.value = '_scl';
        } else if (viewtype === 'map') {
            productSelect.value = 'map';
        } else if (viewtype === 'aerial') {
            productSelect.value = 'aerial';
        } else if (viewtype === 'esriworldimagery') {
            productSelect.value = 'esriworldimagery';
        } else if (viewtype === 'basemap') {
            productSelect.value = 'basemap';
        } else if (viewtype === 'isometric') {
            productSelect.value = 'isometric';
        } else if (viewtype === 'dem') {
            productSelect.value = 'dem';
        } else if (viewtype === 'worldcover') {
            productSelect.value = 'worldcover';
        } else if (viewtype.includes('_soilmoisture')) {
            productSelect.value = '_soilmoisture';
        } else if (viewtype.includes('_fieldanomaly')) {
            productSelect.value = '_fieldanomaly';
        } else if (viewtype.includes('_bgwaterleak')) {
            productSelect.value = '_bgwaterleak';
        } else if (viewtype === 'flood') {
            productSelect.value = 'flood';
        } else if (viewtype.startsWith('nightlight')) {
            productSelect.value = 'nightlight';
            nightlightSelect.value = viewtype;
        } else if (viewtype.includes('biomassgrassland')) {
            productSelect.value = '_biomassgrassland';
            // Always s2r2m, no sensor selection needed
        } else if (viewtype.includes('soilsalinity')) {
            productSelect.value = 'soilsalinity';
            const parts = viewtype.split('_');
            // s2r2m is always the source, just parse the salinity type
            if (parts.length > 1) {
                soilSalinitySelect.value = '_' + parts.slice(1).join('_');
            }
        } else if (viewtype.includes('_lulc')) {
            productSelect.value = '_lulc';
        } else if (viewtype.startsWith('newconstruction')) {
            productSelect.value = 'newconstruction';
            // Mirror props.months <-> dropdown. If props has a value, drive the
            // dropdown from it; otherwise read the dropdown's default into props
            // so URL builders always see a value.
            if (props && props.months) {
                newConstructionSelect.value = String(props.months);
            } else if (props) {
                props.months = parseInt(newConstructionSelect.value, 10);
            }
        } else if (viewtype.includes('_mineralmap')) {
            productSelect.value = '_mineralmap';
            // Always s2r2m, no sensor selection needed
        } else if (viewtype.includes('_mineralclass')) {
            // Mineral classification is a spectral view that uses s2r2m internally
            productSelect.value = 'spectral';
            // Don't set sensor since s2r2m isn't visible to users
            // It will be handled specially in updateViewTypeFromNewDropdowns
            spectralSelect.value = '_mineralclass';
        } else if (viewtype.endsWith('_tci')) {
            productSelect.value = 'visual';
            sensorSelect.value = viewtype.replace('_tci', '');
        } else {
            // It's a spectral view - parse the sensor and spectral parts
            const parts = viewtype.split('_');
            if (parts.length >= 2) {
                // Check if the first part is a known sensor
                const firstPart = parts[0];
                if (['s2rr', 's2dr', 'r5m', 's2r5m', 's2', 'sr', 'ls15', 'ls5', 'ps', 'psrr', 'pssrx2', 'pssrx4'].includes(firstPart) ||
                    imagerySubdirectories.includes(firstPart) ||
                    imagerySubdirectories.includes(firstPart.replace('sr', ''))) {
                    productSelect.value = 'spectral';
                    sensorSelect.value = firstPart;
                    spectralSelect.value = '_' + parts.slice(1).join('_');
                } else {
                    // Default to visual if we can't parse it
                    productSelect.value = 'visual';
                    sensorSelect.value = 's2';
                }
            }
        }

        // Don't call updateViewTypeFromNewDropdowns here to avoid infinite loop
        // Just update the visibility
        const product = productSelect.value;
        sensorSelect.style.display = 'none';
        spectralSelect.style.display = 'none';
        soilSalinitySelect.style.display = 'none';
        nightlightSelect.style.display = 'none';
        newConstructionSelect.style.display = 'none';

        if (product === 'newconstruction') {
            newConstructionSelect.style.display = '';
        } else if (product === 'nightlight') {
            nightlightSelect.style.display = '';
        } else if (product === 'visual') {
            sensorSelect.style.display = '';
            // Restore all sensor options (they might have been hidden by Spectral)
            Array.from(sensorSelect.options).forEach(option => {
                option.style.display = '';
            });
        } else if (product === 'spectral') {
            sensorSelect.style.display = '';
            spectralSelect.style.display = '';

            // Filter sensor options for spectral - only 2m and 10m
            const spectralSupportedSensors = ['s2dr', 's2'];
            Array.from(sensorSelect.options).forEach(option => {
                // Only show s2dr and s2, hide everything else including imagery sources
                const isSupported = spectralSupportedSensors.includes(option.value);
                option.style.display = isSupported ? '' : 'none';
            });
        } else if (product === 's1') {
            s1SubviewSelect.style.display = '';
        } else if (product === 'soilsalinity') {
            soilSalinitySelect.style.display = '';
            // No sensor dropdown for soil salinity
        }
    }

    // Add event listeners
    productSelect.addEventListener('change', updateViewTypeFromNewDropdowns);
    sensorSelect.addEventListener('change', updateViewTypeFromNewDropdowns);
    spectralSelect.addEventListener('change', updateViewTypeFromNewDropdowns);
    soilSalinitySelect.addEventListener('change', updateViewTypeFromNewDropdowns);
    pollutionSelect.addEventListener('change', updateViewTypeFromNewDropdowns);
    nightlightSelect.addEventListener('change', updateViewTypeFromNewDropdowns);
    s1SubviewSelect.addEventListener('change', updateViewTypeFromNewDropdowns);
    newConstructionSelect.addEventListener('change', updateViewTypeFromNewDropdowns);

    // Set initial values from current viewtype
    setNewDropdownsFromViewtype(props.viewtype);

    return {
        productSelect,
        sensorSelect,
        spectralSelect,
        soilSalinitySelect,
        nightlightSelect,
        updateFromViewtype: setNewDropdownsFromViewtype
    };
}

// Helper function to update old dropdowns from viewtype (for backwards compatibility)
function updateOldDropdownsFromViewtype(viewtype, viewNum) {
    // OLD FUNCTION - No longer needed since resolution dropdown is removed
    // Only update the old product dropdown for backward compatibility
    const viewSelect = document.getElementById(`productSelect${viewNum}`);

    if (!viewSelect) return;

    // Parse viewtype and set old product dropdown
    if (viewtype.endsWith('_tci')) {
        const prefix = viewtype.replace('_tci', '');
        if (['s2rr', 's2dr', 'r5m', 's2r5m', 's2', 'sr', 'ls15', 'ls5', 'ps', 'psrr', 'pssrx2', 'pssrx4'].includes(prefix)) {
            viewSelect.value = '_tci';
        }
    } else if (['changes_tci', '_scl', 'map', 'aerial', 'esriworldimagery', 'basemap', 'isometric', 'dem', 'worldcover', 'flood', '_soilmoisture', '_fieldanomaly', '_bgwaterleak', '_biomassgrassland', '_lulc', '_mineralmap'].includes(viewtype)) {
        viewSelect.value = viewtype;
    } else {
        // Spectral view
        const parts = viewtype.split('_');
        if (parts.length >= 2) {
            viewSelect.value = '_' + parts.slice(1).join('_');
        }
    }
}

// Keep old viewoptions for backwards compatibility (will be removed later)
const viewoptions = {
    _tci: 'True Color',
    changes_tci: 'Change Detection',
    _scl: 'SCL - Scene Classification',
    map: 'OpenStreetMap',
    aerial: 'Aerial',
    esriworldimagery: 'ESRI World Imagery',
    basemap: 'Basemap',
    isometric: 'Isometric',
    dem: 'DEM - Digital Elevation Model',
    _soilmoisture: 'Soil Moisture',
    _fieldanomaly: 'Field Anomaly',
    _bgwaterleak: 'Water Leak Warning',
    flood: 'Flood Simulation',
    // Spectral Band Visualizations
    _veganalysis: 'NIR-Red-Green (Vegetation/False Color)',
    _natural: 'Red-Green-Blue (True Color)',
    _cropsoil: 'NIR-SWIR-Red (Crop/Soil Moisture)',
    _vegstress: 'SWIR-NIR-Red (Vegetation Stress)',
    _geology: 'SWIR-NIR-Blue (Geological)',
    _urban: 'NIR-SWIR-Blue (Urban/Rock)',
    _water: 'NIR-Red-Blue (Water Bodies)',
    _watercontent: 'SWIR-Red-Green (Water Content)',
    _atmosphere: 'NIR-Green-Blue (Atmospheric)',
    _burnscar: 'SWIR2-NIR-Red (Burn Scars)',
    _snow: 'SWIR-Red-Green (Snow/Ice)',
    _bathymetric: 'Red-Green-Blue (Bathymetric)',
    _vegmoisture: 'SWIR-NIR-Green (Veg+Moisture)',
    _drought: 'SWIR2-SWIR1-Red (Drought)',
    // Spectral Indices
    _ndvi: 'NDVI - Vegetation Health Index',
    _ndwi: 'NDWI - Water Content Index',
    _savi: 'SAVI - Soil Adjusted Vegetation Index',
    _msavi: 'MSAVI - Modified Soil Adjusted Vegetation',
    _msavi2: 'MSAVI2 - Second Modified Soil Adjusted',
    _evi: 'EVI - Enhanced Vegetation Index',
    _evi2: 'EVI2 - Two-Band Enhanced Vegetation',
    _nbr: 'NBR - Normalized Burn Ratio',
    _nbr2: 'NBR2 - Normalized Burn Ratio 2',
    _ndre: 'NDRE - Normalized Difference Red Edge',
    _ndre2: 'NDRE2 - Normalized Difference Red Edge 2',
    _ndre3: 'NDRE3 - Normalized Difference Red Edge 3',
    _cire: 'CIRE - Chlorophyll Index Red Edge',
    _cire2: 'CIRE2 - Chlorophyll Index Red Edge 2',
    _cire3: 'CIRE3 - Chlorophyll Index Red Edge 3',
    _cig: 'CIG - Chlorophyll Index Green',
    _gndvi: 'GNDVI - Green Normalized Difference Vegetation',
    _rvi: 'RVI - Ratio Vegetation Index',
    _dvi: 'DVI - Difference Vegetation Index',
    _rdvi: 'RDVI - Renormalized Difference Vegetation',
    _osavi: 'OSAVI - Optimized Soil Adjusted Vegetation',
    _tsavi: 'TSAVI - Transformed Soil Adjusted Vegetation',
    _pvi: 'PVI - Perpendicular Vegetation Index',
    _ipvi: 'IPVI - Infrared Percentage Vegetation',
    _grvi: 'GRVI - Green Ratio Vegetation Index',
    _sr: 'SR - Simple Ratio Vegetation',
    _sr2: 'SR2 - Simple Ratio 2 Vegetation',
    _sipi: 'SIPI - Structure Insensitive Pigment Index',
    _ari: 'ARI - Anthocyanin Reflectance Index',
    _cri1: 'CRI1 - Carotenoid Reflectance Index 1',
    _cri2: 'CRI2 - Carotenoid Reflectance Index 2',
    _mcari: 'MCARI - Modified Chlorophyll Absorption',
    _tcari: 'TCARI - Transformed Chlorophyll Absorption',
    _mtvi: 'MTVI - Modified Triangular Vegetation',
    _mtvi2: 'MTVI2 - Modified Triangular Vegetation 2',
    _tvi: 'TVI - Triangular Vegetation Index',
    _ndsi: 'NDSI - Normalized Difference Soil Index',
    _bsi: 'BSI - Bare Soil Index',
    _ndmi: 'NDMI - Normalized Difference Moisture Index',
    _lai: 'LAI - Leaf Area Index',
    _cwc: 'CWC - Canopy Water Content (g/m²)',
    _biomassgrassland: 'Grassland Biomass (t/ha)',
    _soilsalinity: 'Soil Salinity Score (0-100)',
    _soilsalinityclass: 'Soil Salinity Categories',
    _soilsalinityconfidence: 'Soil Salinity Confidence',
    _mineralmap: 'Mineral Alteration Map',
    _mineralclass: 'Mineral Classification',
    _forest: 'Forest Detection (EUDR)',
    // psdemo: 'PlanetScope 3m Demo',
    // psdemox4: 'PlanetScope 0.75m Demo',
    // satellogic: 'Satellogic Demo',
    //sarfusion10m_vis: 'Sentinel-1 VV/VW Fusion 10m'
};

const view_resolutionoptions = {
    // s2r2m: 'Sentinel-2 2m Reconstruction',
    s2rr: 'Sentinel-2 1m Refined Reality',
    s2r5m: 'Sentinel-2 5m',
    // s2r2msharpened: 'Sentinel-2 2m Sharpened Reconstruction',
    // s2ts1m: 'Sentinel-2 Monthly True Color 1m',
    s2: 'Sentinel-2 10m source',
    ls15: 'Landsat 15m',
    ls5: 'Landsat 5m',
    sr: 'Sentinel-2 50cm super-res x2 (Legacy)',
    ps: 'PlanetScope 3m',
    psrr: 'PlanetScope 1.9m Refined Reality',
    pssrx2: 'PlanetScope 1.5m x2 Super-Res',
    pssrx4: 'PlanetScope 0.75m x4 Super-Res',
}

const download_resolutionoptions = {
    s2rr: 'Sentinel-2 1m Refined Reality',
    s2r2m: 'Sentinel-2 2m Reconstruction',
    // s2dr: 'Sentinel-2 2m Derived Resolution',
    // s2r2msharpened: 'Sentinel-2 2m Sharpened Reconstruction',
    // s2ts1m: 'Sentinel-2 Monthly True Color 1m',
    s2: 'Sentinel-2 10m source',
    sr: 'Sentinel-2 50cm super-res x2 (Legacy)',
    // SAR resolutions — shown only when view == 'sar'.
    s1vv: 'Sentinel-1 VV 10m (fp32 sigma0)',
    s1vh: 'Sentinel-1 VH 10m (fp32 sigma0)',
    s1vvsr: 'Sentinel-1 VV 2m SR (fp32 amplitude DN)',
    s1vhsr: 'Sentinel-1 VH 2m SR (fp32 amplitude DN)',
}

// Resolution-dropdown families — used to filter options based on the selected view.
const s2DownloadResolutions = new Set(['s2rr', 's2r2m', 's2', 'sr']);
const sarDownloadResolutions = new Set(['s1vv', 's1vh', 's1vvsr', 's1vhsr']);

const downloadoptions = {
    _ms: 'Multispectral',
    _tci: 'True Color',
    dem: 'DEM - Digital Elevation Model',
    sar: 'SAR (Sentinel-1)',
    _soilmoisture: 'Soil Moisture',
    _fieldanomaly: 'Field Anomaly',
    _bgwaterleak: 'Smart Index: Water Leak Warning',
    // Spectral Band Visualizations
    _veganalysis: 'NIR-Red-Green (Vegetation/False Color)',
    _natural: 'Red-Green-Blue (True Color)',
    _cropsoil: 'NIR-SWIR-Red (Crop/Soil Moisture)',
    _vegstress: 'SWIR-NIR-Red (Vegetation Stress)',
    _geology: 'SWIR-NIR-Blue (Geological)',
    _urban: 'NIR-SWIR-Blue (Urban/Rock)',
    _water: 'NIR-Red-Blue (Water Bodies)',
    _watercontent: 'SWIR-Red-Green (Water Content)',
    _atmosphere: 'NIR-Green-Blue (Atmospheric)',
    _burnscar: 'SWIR2-NIR-Red (Burn Scars)',
    _snow: 'SWIR-Red-Green (Snow/Ice)',
    _bathymetric: 'Red-Green-Blue (Bathymetric)',
    _vegmoisture: 'SWIR-NIR-Green (Veg+Moisture)',
    _drought: 'SWIR2-SWIR1-Red (Drought)',
    // Spectral Indices
    _ndvi: 'NDVI - Vegetation Health Index',
    _ndwi: 'NDWI - Water Content Index',
    _savi: 'SAVI - Soil Adjusted Vegetation Index',
    _msavi: 'MSAVI - Modified Soil Adjusted Vegetation',
    _msavi2: 'MSAVI2 - Second Modified Soil Adjusted',
    _evi: 'EVI - Enhanced Vegetation Index',
    _evi2: 'EVI2 - Two-Band Enhanced Vegetation',
    _nbr: 'NBR - Normalized Burn Ratio',
    _nbr2: 'NBR2 - Normalized Burn Ratio 2',
    _ndre: 'NDRE - Normalized Difference Red Edge',
    _ndre2: 'NDRE2 - Normalized Difference Red Edge 2',
    _ndre3: 'NDRE3 - Normalized Difference Red Edge 3',
    _cire: 'CIRE - Chlorophyll Index Red Edge',
    _cire2: 'CIRE2 - Chlorophyll Index Red Edge 2',
    _cire3: 'CIRE3 - Chlorophyll Index Red Edge 3',
    _cig: 'CIG - Chlorophyll Index Green',
    _gndvi: 'GNDVI - Green Normalized Difference Vegetation',
    _rvi: 'RVI - Ratio Vegetation Index',
    _dvi: 'DVI - Difference Vegetation Index',
    _rdvi: 'RDVI - Renormalized Difference Vegetation',
    _osavi: 'OSAVI - Optimized Soil Adjusted Vegetation',
    _tsavi: 'TSAVI - Transformed Soil Adjusted Vegetation',
    _pvi: 'PVI - Perpendicular Vegetation Index',
    _ipvi: 'IPVI - Infrared Percentage Vegetation',
    _grvi: 'GRVI - Green Ratio Vegetation Index',
    _sr: 'SR - Simple Ratio Vegetation',
    _sr2: 'SR2 - Simple Ratio 2 Vegetation',
    _sipi: 'SIPI - Structure Insensitive Pigment Index',
    _ari: 'ARI - Anthocyanin Reflectance Index',
    _cri1: 'CRI1 - Carotenoid Reflectance Index 1',
    _cri2: 'CRI2 - Carotenoid Reflectance Index 2',
    _mcari: 'MCARI - Modified Chlorophyll Absorption',
    _tcari: 'TCARI - Transformed Chlorophyll Absorption',
    _mtvi: 'MTVI - Modified Triangular Vegetation',
    _mtvi2: 'MTVI2 - Modified Triangular Vegetation 2',
    _tvi: 'TVI - Triangular Vegetation Index',
    _ndsi: 'NDSI - Normalized Difference Soil Index',
    _bsi: 'BSI - Bare Soil Index',
    _ndmi: 'NDMI - Normalized Difference Moisture Index',
    _lai: 'LAI - Leaf Area Index',
    _cwc: 'CWC - Canopy Water Content (g/m²)',
    _biomassgrassland: 'Grassland Biomass (t/ha)',
    _soilsalinity: 'Soil Salinity Score (0-100)',
    _soilsalinityclass: 'Soil Salinity Categories',
    _soilsalinityconfidence: 'Soil Salinity Confidence',
    _mineralmap: 'Mineral Alteration Map',
    _mineralclass: 'Mineral Classification',
    _forest: 'Forest Detection (EUDR)'
};

// clicking anywhere that is not a child of an element with attribute 'date-list' or a date input will hide the date list
document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    const isDateList = target.closest('[date-list]');
    const isDateInput = target.type === 'date';
    if (!isDateList && !isDateInput) {
        const dateLists = document.querySelectorAll('[date-list]');
        dateLists.forEach(dateList => {
            dateList.style.display = 'none';
        });
    }
}
);

// Function to update product dropdown options visibility based on resolution selection
function updateProductOptionsVisibility(viewSelect, resolutionSelect) {
    const isPlanetScope = (resolutionSelect.value === 'ps' || resolutionSelect.value === 'psrr' || resolutionSelect.value === 'pssrx2' || resolutionSelect.value === 'pssrx4');

    // Check if it's an imagery option (from subdirectories)
    const isImagery = imagerySubdirectories.length > 0 && imagerySubdirectories.some(subdir =>
        resolutionSelect.value === subdir ||
        resolutionSelect.value === `${subdir}sr`
    );

    const productOptions = viewSelect.querySelectorAll('option');

    productOptions.forEach(option => {
        if (isPlanetScope || isImagery) {
            // Only show Basemap, OpenStreetMap, and True Color for PlanetScope and imagery
            if (option.getAttribute('s2-view') === 'true') {
                option.style.display = 'none';
            } else {
                option.style.display = '';
            }
        } else {
            // Show all product options when not PlanetScope or imagery
            option.style.display = '';
        }
    });

    // Force True Color selection for PlanetScope or imagery if invalid option selected
    if (isPlanetScope || isImagery) {
        if (viewSelect.value !== '_tci' && viewSelect.value !== 'map' && viewSelect.value !== 'aerial' && viewSelect.value !== 'esriworldimagery' && viewSelect.value !== 'dem') {
            viewSelect.value = '_tci';
        }
    }
}

function updateViewType(viewNum, props, viewSelect, resolutionSelect, dateCloudsSelection) {
    const view = document.getElementById(`view${viewNum}`);
    const prevValue = props.viewtype;

    // Check if it's an imagery option
    const isImagery = imagerySubdirectories.length > 0 && imagerySubdirectories.some(subdir =>
        resolutionSelect.value === subdir ||
        resolutionSelect.value === `${subdir}sr`
    );

    // Handle flood simulation - use flood viewtype
    if (viewSelect.value === 'flood') {
        props.viewtype = 'flood';
    }
    // Handle SCL - always use s2_scl regardless of resolution selection
    else if (viewSelect.value === '_scl') {
        props.viewtype = 's2_scl';
    }
    // Handle PlanetScope or imagery selection from resolution dropdown
    else if (resolutionSelect.value === 'ps' || resolutionSelect.value === 'psrr' || resolutionSelect.value === 'pssrx2' || resolutionSelect.value === 'pssrx4' || isImagery) {
        // PlanetScope or imagery selected - force True Color product
        props.viewtype = resolutionSelect.value + '_tci';

        // Set PlanetScope defaults immediately when PS is selected
        if (resolutionSelect.value === 'ps' || resolutionSelect.value === 'psrr' || resolutionSelect.value === 'pssrx2' || resolutionSelect.value === 'pssrx4') {
            props.days_back = 5;
            props.max_clouds = 100;
            const daysBackEl = document.getElementById(`daysBack${viewNum}`);
            const cloudsInputEl = document.getElementById(`clouds${viewNum}`);
            if (daysBackEl) daysBackEl.value = 5;
            if (cloudsInputEl) cloudsInputEl.value = 100;
        }
    } else if (viewSelect.value[0] == '_' && !resolutionSelect.value) {
        // If product starts with '_' and resolution is empty, set it to 2m option
        resolutionSelect.value = 's2r2m';
        props.viewtype = resolutionSelect.value + viewSelect.value;
    } else {
        props.viewtype = (viewSelect.value[0] != '_') ? viewSelect.value : (resolutionSelect.value + viewSelect.value);

        // Special handling: s2dr only supports RGB (_tci), route all other views to s2r2m
        if (resolutionSelect.value === 's2dr' && viewSelect.value !== '_tci') {
            // s2dr (derived resolution) only supports RGB output
            // Route all spectral indices and other views to s2r2m instead
            props.viewtype = 's2r2m' + viewSelect.value;
        }
    }

    // Debug logging for change detection
    if (viewSelect.value === '_change') {
        console.log('Change detection selected:', {
            viewSelect: viewSelect.value,
            resolutionSelect: resolutionSelect.value,
            finalViewtype: props.viewtype
        });
    }
    
    if (props.viewtype == "satellogic") {
        props.date = "2022-04-28";
        dateInput.value = props.date;
        // Set location to Geneva for Satellogic demo
        lat = 46.2044;
        lon = 6.1432;
        refreshAllViews();
        updateUrl();
        alert("Satellogic is a limited demo of real-time 400% enhancement of external imagery, and is available in the demo only for Geneva and for 2022-04-28");
    }
    if (props.viewtype == "psdemo" && prevValue != "psdemox4") {
        // fetch {lat:, lon:} from /get_demo_planetscope_location
        fetch('/get_demo_planetscope_location')
            .then(response => response.json())
            .then(data => {
                lat = data.lat;
                lon = data.lon;
                refreshAllViews();
                updateUrl();
            })
            .catch(error => console.error('Error fetching demo location:', error));
    }
    map = initMap(view, viewNum - 1);
    refreshAllViews();
    updateUrl();
    // Get the containers by their IDs
    const productSelect = document.getElementById(`productSelect${viewNum}`);
    // resolutionSelectEl removed - old dropdown system no longer used
    const dateContainerEl = document.getElementById(`dateContainer${viewNum}`);
    const additionalControlsEl = document.getElementById(`additionalControls${viewNum}`);

    // Default: show all controls (except old resolution dropdown which is removed)
    if (productSelect) productSelect.style.display = "";
    if (dateContainerEl) dateContainerEl.style.display = "";
    if (additionalControlsEl) additionalControlsEl.style.display = "";

    // For OSM/esriworldimagery views: only show product dropdown
    const esriworldimageryViews = ['map', 'aerial', 'esriworldimagery', 'basemap', 'dem'];
    if (esriworldimageryViews.includes(viewSelect.value)) {
        if (dateContainerEl) dateContainerEl.style.display = "none";
        if (additionalControlsEl) additionalControlsEl.style.display = "none";
    }

    // For SCL view: keep date/clouds controls (old resolution dropdown is already removed)

    // For flood simulation and esriworldimagery views: keep date/clouds controls (old resolution dropdown is already removed)

    // OLD DROPDOWN SYSTEM - NOT NEEDED WITH NEW SYSTEM
    // updateProductOptionsVisibility(viewSelect, resolutionSelect);

    // Hide legacy controls
    const cloudToggleEl = document.getElementById(`cloudToggle${viewNum}`);
    const tileDateEl = document.getElementById(`tileDate${viewNum}`);
    if (cloudToggleEl) cloudToggleEl.style.display = "none";
    if (tileDateEl) tileDateEl.style.display = "";

    // Old resolution dropdown logic removed - using new dropdown system

    // ALWAYS keep legacy inputs hidden regardless of view type
    const forcedHiddenElements = [
        document.getElementById(`daysBack${viewNum}`),
        document.getElementById(`dashBeforeDays${viewNum}`),
        document.getElementById(`clouds${viewNum}`),
        document.getElementById(`cloudIcon${viewNum}`)
    ];
    forcedHiddenElements.forEach(el => {
        if (el) el.style.display = "none";
    });
}

async function initializeMapUI(uiBar, uiBarStyles, containerId, viewNum) {
    const view = document.getElementById(`view${viewNum}`);
    // view.style.height = window.innerHeight + 'px';

    // FIX PROPS BEFORE INITIALIZING MAP (which loads tiles immediately)
    const props = views[viewNum - 1];  // Get props before initMap
    if (props.viewtype === 'ps_tci' || props.viewtype === 'psrr_tci') {
        props.days_back = 5;
        props.max_clouds = 100;
    }

    let map = initMap(view, viewNum - 1);  // Now init map with corrected props

    const container = document.getElementById(containerId);

    // create a semi-transparent div for UI controls
    const uiContainer = createElem(uiBar, 'div', [], 
        { ...uiBarStyles, position: 'absolute', zIndex: 3, top: '10px', backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: '10px', borderRadius: '5px', maxWidth: "calc(50% - 40px)" });
    uiContainer.id = `toolbar${viewNum}`;
    // hide the entire Map UI bar in demo mode
    if (demomode) {
        uiContainer.style.display = 'none';
    }

    // Create the NEW dropdown system
    const newDropdowns = createNewDropdownSystem(uiContainer, viewNum, props);

    res_view = props.viewtype.split('_');
    // create a select element for view selection (product dropdown) - OLD SYSTEM (hidden but kept for compatibility)
    const viewSelect = createElem(uiContainer, 'select', [], { maxWidth: '200px', display: 'none' }, "");
    viewSelect.id = `productSelect${viewNum}`;
    
    // Define admin-only views
    const adminOnlyViews = ['_forest'];
    const isAdmin = window.currentUser && window.currentUser.admin;

    // Define mineralmap-only views
    const mineralmapViews = ['_mineralmap', '_mineralclass'];
    const hasMineralmap = false;  // Mineral Map view hidden
    const hasBasemap = !!(window.currentUser && window.currentUser.esriworldimagery);

    // Populate dropdown with available options
    for (const [key, value] of Object.entries(viewoptions)) {
        if (value[value.length - 1] != ' ') {
            // Skip admin-only views for non-admin users
            if (adminOnlyViews.includes(key) && !isAdmin) {
                continue;
            }
            // Skip mineralmap views for users without mineralmap permission
            if (mineralmapViews.includes(key) && !hasMineralmap) {
                continue;
            }
            // Skip esriworldimagery option for users without esriworldimagery permission
            if (key === 'esriworldimagery' && !hasBasemap) {
                continue;
            }
            const option = createElem(uiContainer.lastChild, 'option', [], {}, value);
            option.value = key;
            // Add s2-view attribute to Sentinel-2 specific options
            if (key.startsWith('_') && !['_tci', 'map', 'aerial', 'esriworldimagery'].includes(key)) {
                option.setAttribute('s2-view', 'true');
            }
        }
    }

    // OLD RESOLUTION DROPDOWN REMOVED - Using new dropdown system instead
    // Create a dummy object to satisfy functions that still reference it
    const resolutionSelect = { value: '', style: { display: 'none' } };
    
    // OLD VIEW DROPDOWN EVENT HANDLER - COMMENTED OUT SINCE WE USE NEW DROPDOWN SYSTEM
    // viewSelect.addEventListener('change', () => {
    //     updateViewType(viewNum, props, viewSelect, resolutionSelect, dateCloudsSelection);
    // });
    // OLD RESOLUTION DROPDOWN EVENT HANDLER - COMMENTED OUT SINCE WE USE NEW DROPDOWN SYSTEM
    // resolutionSelect.addEventListener('change', () => {
    //     // Auto-select TCI when "2m sharpened reconstruction" is selected
    //     if (resolutionSelect.value === 's2r2msharpened') {
    //         viewSelect.value = '_tci';
    //     }
    //
    //     // Check if it's an imagery option
    //     const isImagery = imagerySubdirectories.length > 0 && imagerySubdirectories.some(subdir =>
    //         resolutionSelect.value === subdir ||
    //         resolutionSelect.value === `${subdir}sr`
    //     );
    //
    //     // Handle PlanetScope or imagery selection - auto-select True Color
    //     if (resolutionSelect.value === 'ps' || resolutionSelect.value === 'psrr' || resolutionSelect.value === 'pssrx2' || resolutionSelect.value === 'pssrx4' || isImagery) {
    //         viewSelect.value = '_tci';
    //     }
    //     // Update product options visibility when resolution changes
    //     updateProductOptionsVisibility(viewSelect, resolutionSelect);
    //     updateViewType(viewNum, props, viewSelect, resolutionSelect, dateCloudsSelection);
    //
    //     // Update search interface based on resolution
    //     updateSearchInterface();
    // });
    // create a container for date input
    let dateContainer = createElem(uiContainer, 'span', [ "nowrap" ], { }, "");
    dateContainer.id = `dateContainer${viewNum}`;
    
    // create a container for other controls (days back, cloud %, icons)  
    let additionalControlsContainer = createElem(uiContainer, 'span', [ "nowrap" ], { }, "");
    additionalControlsContainer.id = `additionalControls${viewNum}`;
    
    // legacy container - can be removed later
    let dateCloudsSelection = createElem(uiContainer, 'span', [ "nowrap" ], { }, "");

    // create a date input element for date selection
    const dateInput = createElem(dateContainer, 'input', [], { marginLeft: '10px', cursor: 'pointer' }, "");
    dateInput.type = 'date';
    dateInput.value = props.date;
    dateInput.id = `dateInput${viewNum}`;

    // Deep-link landing on an S1 viewtype: the URL-supplied date may not have data
    // here. Snap to the closest available S1 date at-or-before. The first refresh
    // happens with the original date; this kicks off in the background and triggers
    // another refresh once the corrected date lands.
    if (props.viewtype && props.viewtype.startsWith('s1')) {
        snapToClosestAvailableS1Date(viewNum, props).then(() => {
            if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
            if (typeof updateUrl === 'function') updateUrl();
        });
    }

    // Track if date was manually edited (don't trigger refresh immediately)
    let dateManuallyEdited = false;

    const updateDateWithClosestSearch = async () => {
        const enteredDate = dateInput.value;
        if (!enteredDate) return;

        // Combined 5m: search both sources, pick closest
        if (props.viewtype === 'r5m_tci') {
            try {
                const [s2Resp, lsResp] = await Promise.all([
                    fetch(`/dates/${lat},${lon}/s2r5m_tci/${enteredDate}/365/100`).then(r => r.json()).catch(() => []),
                    fetch(`/dates/${lat},${lon}/ls5_tci/${enteredDate}/365/100`).then(r => r.json()).catch(() => [])
                ]);
                // Merge: on same date, pick source with fewer clouds
                const merged = {};
                s2Resp.forEach(d => { merged[d[0]] = { date: d[0], source: 's2r5m_tci', clouds: parseFloat(d[1]) }; });
                lsResp.forEach(d => {
                    if (!merged[d[0]] || parseFloat(d[1]) < merged[d[0]].clouds)
                        merged[d[0]] = { date: d[0], source: 'ls5_tci', clouds: parseFloat(d[1]) };
                });
                const sorted = Object.values(merged).sort((a, b) => b.date.localeCompare(a.date));
                if (sorted.length > 0) {
                    props.date = sorted[0].date;
                    props._r5m_actual = sorted[0].source;
                    dateInput.value = sorted[0].date;
                } else {
                    props.date = enteredDate;
                }
            } catch (e) {
                props.date = enteredDate;
            }
            refreshAllViews();
            updateUrl();
            dateManuallyEdited = false;
            return;
        }

        // Search for closest date at or before entered date, ignoring cloud coverage
        const isPlanetScope = props.viewtype.startsWith('ps_') || props.viewtype.startsWith('psrr') || props.viewtype.startsWith('pssr');
        const sourceParam = isPlanetScope ? '?source=ps' : '';
        const url = `/dates/${lat},${lon}/${props.viewtype}/${enteredDate}/365/100${sourceParam}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.length > 0) {
                // Use first available date at or before entered date
                const closestDate = data[0][0];
                props.date = closestDate;
                dateInput.value = closestDate;
            } else {
                // No data found, keep entered date
                props.date = enteredDate;
            }

            refreshAllViews();
            updateUrl();
            dateManuallyEdited = false;
        } catch (error) {
            console.error('Error fetching closest date:', error);
            // Fallback: use entered date
            props.date = enteredDate;
            refreshAllViews();
            updateUrl();
            dateManuallyEdited = false;
        }
    };

    // On input change (typing), don't trigger refresh yet
    dateInput.addEventListener('input', () => {
        dateManuallyEdited = true;
    });

    // On blur (loses focus), search for closest date
    dateInput.addEventListener('blur', () => {
        if (dateManuallyEdited) {
            updateDateWithClosestSearch();
        }
    });

    // On Enter key, search for closest date
    dateInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            dateManuallyEdited = true;
            updateDateWithClosestSearch();
            dateInput.blur();
        }
    });

    // Placeholder - actual click handler will be added after openDateList is defined
    
    // Create days back control in additional controls container
    const dashBeforeDays = createElem(additionalControlsContainer, 'label', [], { display: 'none' }, "&nbsp;&ndash;&nbsp;");
    dashBeforeDays.id = `dashBeforeDays${viewNum}`;
    const daysInput = createElem(additionalControlsContainer, 'input', [], { width: '38px', display: 'none' }, "");
    daysInput.id = `daysBack${viewNum}`;
    daysInput.type = 'number';
    daysInput.min = 1;
    daysInput.max = 365;
    daysInput.value = props.days_back;
    const updateDays = () => {
        props.days_back = daysInput.value;
        refreshAllViews();
        updateUrl();
    };
    daysInput.addEventListener('change', updateDays);
    daysInput.addEventListener('blur', updateDays);
    daysInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            updateDays();
            daysInput.blur();
        }
    });

    // create a numeric input element for max clouds selection
    const cloudIcon = createElem(additionalControlsContainer, 'label', [], { width: '38px', marginLeft: '10px', display: 'none' }, "&nbsp;&#x26c5;&nbsp;");
    cloudIcon.id = `cloudIcon${viewNum}`;
    // Create datesListContainer as a child of dateContainer (not cloudIcon) so it's not hidden when cloudIcon is hidden
    const datesListContainer = createElem(dateContainer, 'div', [], { display: 'none', position: 'fixed', zIndex: 1, width: '200px', height: '200px', overflow: 'scroll', background: 'white', border: 'solid 1px gray', padding: '5px', marginTop: '5px', marginLeft: '-195px' });
    datesListContainer.setAttribute('date-list', true);
    const datesList = createElem(datesListContainer, 'div', [], { fontSize: '14px' });

    // Store reference for date input to access later
    dateInput.datesListContainer = datesListContainer;
    dateInput.datesList = datesList;

    // Track the oldest date loaded for pagination
    let oldestDateLoaded = null;

    // Track if we're currently loading more dates
    let isLoadingMore = false;

    // Track if user manually closed the list (don't reopen automatically)
    let userClosedList = false;

    // Shared function to open date list popup
    const openDateList = (event) => {
        // Stop propagation to prevent global click handler from hiding the list
        event.stopPropagation();

        // Close all other date lists first
        const allDateLists = document.querySelectorAll('[date-list]');
        allDateLists.forEach(list => {
            if (list !== datesListContainer) {
                list.style.display = 'none';
            }
        });

        // Reset the user closed flag when opening the list
        userClosedList = false;

        // Show loading state immediately - change icon and make unclickable
        cloudIcon.childNodes[0].textContent = "\u00A0⏳\u00A0"; // Hourglass loading character
        cloudIcon.style.pointerEvents = 'none'; // Make unclickable

        // Show list with loading text immediately
        datesListContainer.style.display = "block";
        datesList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Loading...</div>';

        // Use currently selected date from the calendar UI element
        const selectedDate = props.date || new Date().toISOString().split('T')[0];

        // Determine if this is a PlanetScope view
        const isPlanetScope = props.viewtype.startsWith('ps_') || props.viewtype.startsWith('psrr') || props.viewtype.startsWith('pssr');
        const sourceParam = isPlanetScope ? '?source=ps' : '';

        // Combined 5m: fetch from both S2 and Landsat, merge
        const isCombined5m = props.viewtype === 'r5m_tci';
        const fetchDates = isCombined5m
            ? Promise.all([
                fetch(`/dates/${lat},${lon}/s2r5m_tci/${selectedDate}/45/${props.max_clouds}`).then(r => r.json()).catch(() => []),
                fetch(`/dates/${lat},${lon}/ls5_tci/${selectedDate}/45/${props.max_clouds}`).then(r => r.json()).catch(() => [])
              ]).then(([s2Dates, lsDates]) => {
                // Tag each with source view
                const merged = {};
                s2Dates.forEach(d => { merged[d[0]] = { data: d, source: 's2r5m_tci', label: 'S2' }; });
                lsDates.forEach(d => {
                    if (!merged[d[0]] || parseFloat(d[1]) < parseFloat(merged[d[0]].data[1]))
                        merged[d[0]] = { data: d, source: 'ls5_tci', label: 'LS' };
                });
                // Sort descending by date
                return Object.values(merged).sort((a, b) => b.data[0].localeCompare(a.data[0]));
              })
            : fetch(`/dates/${lat},${lon}/${props.viewtype}/${selectedDate}/45/${props.max_clouds}${sourceParam}`)
                .then(r => r.json())
                .then(data => data.map(d => ({ data: d, source: props.viewtype, label: null })));

        fetchDates
            .then(entries => {
                datesList.innerHTML = "";

                if (entries.length === 0) {
                    // NISAR's released archive is sparse (Oct 17 2025 – Jan 20 2026
                    // as of May 2026 — pre-cal batch only; forward processing starts
                    // ~Jul 2026). Surface that constraint instead of a bare "No data".
                    const isNisar = props.viewtype.startsWith('nisar');
                    const msg = isNisar
                        ? "NISAR currently provides data in limited locations and only between 2025-10-17 and 2026-01-20. Try a different location or date in that window."
                        : "No data found";
                    createElem(datesList, 'div', [], {
                        color: '#666',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        padding: '20px',
                        lineHeight: '1.4',
                        whiteSpace: 'normal',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                    }, msg);
                } else {
                    entries.forEach(entry => {
                        const date_clouds = entry.data;
                        const dateStr = date_clouds[0];
                        // SAR sources (S1, NISAR) have no cloud cover — server sends
                        // null. Omit the cloud icon entirely in that case.
                        const cloudRaw = date_clouds[1];
                        const cloudTxt = (cloudRaw == null || Number.isNaN(parseFloat(cloudRaw)))
                            ? '' : `&#x26c5;${Math.round(parseFloat(cloudRaw))}%`;
                        let extraInfo = '';
                        // For combined 5m, show source label
                        if (entry.label) {
                            extraInfo = `<small>${entry.label}</small> `;
                        } else if (date_clouds.length > 3 && date_clouds[3]) {
                            const satellite = date_clouds[3].toLowerCase();
                            let shortName = '';
                            if (satellite.includes('sentinel-2a')) shortName = 'S2A';
                            else if (satellite.includes('sentinel-2b')) shortName = 'S2B';
                            else if (satellite.includes('sentinel-2c')) shortName = 'S2C';
                            if (shortName) extraInfo = `<small>${shortName}</small> `;
                        }

                        const dateDiv = createElem(datesList, 'div', [], { }, `${dateStr} ${extraInfo}${cloudTxt}`);
                        dateDiv.addEventListener('pointerdown', (e) => {
                            e.stopPropagation();
                            props.date = date_clouds[0];
                            dateInput.value = date_clouds[0];
                            // For combined 5m, switch viewtype to the source for this date
                            if (isCombined5m) {
                                props._r5m_actual = entry.source;
                            }
                            userClosedList = true;
                            datesListContainer.style.display = 'none';
                            refreshAllViews();
                            updateUrl();
                        });
                    });

                    oldestDateLoaded = entries[entries.length - 1].data[0];
                }

                if (!userClosedList) {
                    datesListContainer.style.display = "block";
                }
            })
            .catch(error => {
                console.error('Error fetching dates:', error);
                datesList.innerHTML = "";
                const errorDiv = createElem(datesList, 'div', [], {
                    color: '#d32f2f',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    padding: '20px'
                }, "Error loading dates");
            })
            .finally(() => {
                cloudIcon.childNodes[0].textContent = "\u00A0\u26C5\u00A0";
                cloudIcon.style.pointerEvents = 'auto';
            });
    };

    // Function to load more dates
    const loadMoreDates = () => {
        if (isLoadingMore || !oldestDateLoaded) return;

        isLoadingMore = true;

        // Add loading indicator
        const loadingDiv = createElem(datesList, 'div', [], {
            color: '#666',
            fontStyle: 'italic',
            textAlign: 'center',
            padding: '10px',
            borderTop: '1px solid #ddd',
            marginTop: '5px'
        }, "Loading more...");
        loadingDiv.id = 'dates-loading-indicator';

        // Fetch 45 more days starting from oldestDateLoaded
        const isPlanetScope = props.viewtype.startsWith('ps_') || props.viewtype.startsWith('psrr') || props.viewtype.startsWith('pssr');
        const sourceParam = isPlanetScope ? '?source=ps' : '';
        const isCombined5m = props.viewtype === 'r5m_tci';

        const fetchMore = isCombined5m
            ? Promise.all([
                fetch(`/dates/${lat},${lon}/s2r5m_tci/${oldestDateLoaded}/45/${props.max_clouds}`).then(r => r.json()).catch(() => []),
                fetch(`/dates/${lat},${lon}/ls5_tci/${oldestDateLoaded}/45/${props.max_clouds}`).then(r => r.json()).catch(() => [])
              ]).then(([s2Dates, lsDates]) => {
                const merged = {};
                s2Dates.forEach(d => { merged[d[0]] = { data: d, source: 's2r5m_tci', label: 'S2' }; });
                lsDates.forEach(d => {
                    if (!merged[d[0]] || parseFloat(d[1]) < parseFloat(merged[d[0]].data[1]))
                        merged[d[0]] = { data: d, source: 'ls5_tci', label: 'LS' };
                });
                return Object.values(merged).sort((a, b) => b.data[0].localeCompare(a.data[0]));
              })
            : fetch(`/dates/${lat},${lon}/${props.viewtype}/${oldestDateLoaded}/45/${props.max_clouds}${sourceParam}`)
                .then(r => r.json())
                .then(data => data.map(d => ({ data: d, source: props.viewtype, label: null })));

        fetchMore
            .then(entries => {
                loadingDiv.remove();

                if (entries.length > 0) {
                    entries.forEach(entry => {
                        const date_clouds = entry.data;
                        const dateStr = date_clouds[0];
                        const cloudRaw = date_clouds[1];
                        const cloudTxt = (cloudRaw == null || Number.isNaN(parseFloat(cloudRaw)))
                            ? '' : `&#x26c5;${Math.round(parseFloat(cloudRaw))}%`;
                        let extraInfo = '';
                        if (entry.label) {
                            extraInfo = `<small>${entry.label}</small> `;
                        } else if (date_clouds.length > 3 && date_clouds[3]) {
                            const satellite = date_clouds[3].toLowerCase();
                            let shortName = '';
                            if (satellite.includes('sentinel-2a')) shortName = 'S2A';
                            else if (satellite.includes('sentinel-2b')) shortName = 'S2B';
                            else if (satellite.includes('sentinel-2c')) shortName = 'S2C';
                            if (shortName) extraInfo = `<small>${shortName}</small> `;
                        }

                        const dateDiv = createElem(datesList, 'div', [], { }, `${dateStr} ${extraInfo}${cloudTxt}`);
                        dateDiv.addEventListener('pointerdown', (e) => {
                            e.stopPropagation();
                            props.date = date_clouds[0];
                            dateInput.value = date_clouds[0];
                            if (isCombined5m) props._r5m_actual = entry.source;
                            userClosedList = true;
                            datesListContainer.style.display = 'none';
                            refreshAllViews();
                            updateUrl();
                        });
                    });

                    oldestDateLoaded = entries[entries.length - 1].data[0];
                } else {
                    oldestDateLoaded = null;
                }

                isLoadingMore = false;
            })
            .catch(error => {
                console.error('Error fetching more dates:', error);
                loadingDiv.textContent = "Error loading more";
                loadingDiv.style.color = '#d32f2f';
                isLoadingMore = false;
            });
    };

    // Add scroll listener to datesListContainer
    datesListContainer.addEventListener('scroll', () => {
        // Check if scrolled to bottom
        const scrollTop = datesListContainer.scrollTop;
        const scrollHeight = datesListContainer.scrollHeight;
        const clientHeight = datesListContainer.clientHeight;

        // If within 20px of bottom, load more
        if (scrollHeight - scrollTop - clientHeight < 20) {
            loadMoreDates();
        }
    });

    // For s2*/ps*/s1*/nisar* viewtypes, open annual calendar instead of standard date picker + dates list.
    // (S1 and NISAR return no cloud cover; the calendar suppresses the cloud icon when cloud is null.)
    const isAnnualViewtype = () => {
        const v = props.viewtype || '';
        return v.startsWith('s2') || v.startsWith('ps') || v.startsWith('s1')
            || v.startsWith('nisar') || v === 'sr_tci' || v === 'isometric';
    };

    const openAnnualCalendar = () => {
        // Isometric drapes Sentinel-2 1m imagery; query its dates as the S2 1m view.
        const qv = props.viewtype === 'isometric' ? 's2rr' : props.viewtype;
        const sourceParam = (qv.startsWith('ps_') || qv.startsWith('psrr') || qv.startsWith('pssr')) ? '?source=ps' : '';
        const todayStr = new Date().toISOString().split('T')[0];

        const loadYear = async (year) => {
            const isCurrent = year === new Date().getFullYear();
            // 3 chunks of 4 months each: end dates Apr 30, Aug 31, Dec 31
            const chunkEnds = [
                `${year}-04-30`,
                `${year}-08-31`,
                `${year}-12-31`,
            ].map(d => (isCurrent && d > todayStr) ? todayStr : d);
            const daysBack = 122;
            const responses = await Promise.all(chunkEnds.map(end =>
                fetch(`/dates/${lat},${lon}/${qv}/${end}/${daysBack}/100${sourceParam}`)
                    .then(r => r.json()).catch(() => [])
            ));
            const out = [];
            responses.forEach(arr => arr.forEach(d => {
                if (d[0].startsWith(`${year}-`)) {
                    // d[1] is null for sources without cloud cover (e.g. S1 SAR).
                    out.push({ date: d[0], cloud: d[1] == null ? null : parseFloat(d[1]) });
                }
            }));
            return out;
        };

        const onDateClick = (date /*, cloud */) => {
            props.date = date;
            dateInput.value = date;
            const overlay = document.getElementById('capCalOverlay');
            if (overlay) overlay.remove();
            refreshAllViews();
            updateUrl();
        };

        // If props.date is invalid or out of 2000-2030, default to today
        const _y = (props.date && /^\d{4}/.test(props.date)) ? parseInt(props.date.slice(0, 4), 10) : NaN;
        if (isNaN(_y) || _y < 2000 || _y > 2030) {
            props.date = new Date().toISOString().slice(0, 10);
            dateInput.value = props.date;
        }
        const initialYear = parseInt(props.date.slice(0, 4), 10);

        window.showCaptureCalendar({ loadYear, onDateClick, initialYear });
    };

    // Cloud icon opens date list (or annual calendar for s2/ps)
    cloudIcon.addEventListener('pointerdown', (event) => {
        if (isAnnualViewtype()) {
            event.stopPropagation();
            event.preventDefault();
            openAnnualCalendar();
        } else {
            openDateList(event);
        }
    });

    // Date input opens date list on click, but still allows manual editing
    dateInput.addEventListener('pointerdown', (event) => {
        if (isAnnualViewtype()) {
            event.stopPropagation();
            event.preventDefault();
            dateInput.blur();
            openAnnualCalendar();
            return;
        }
        // Reset the manual edit flag to prevent blur from triggering duplicate query
        dateManuallyEdited = false;
        openDateList(event);
    });
    const cloudsInput = createElem(additionalControlsContainer, 'input', [], { display: 'none' }, "");
    cloudsInput.id = `clouds${viewNum}`;
    cloudsInput.type = 'number';
    cloudsInput.min = 0;
    cloudsInput.max = 100;
    cloudsInput.value = props.max_clouds;
    const updateClouds = () => {
        props.max_clouds = cloudsInput.value;
        refreshAllViews();
        updateUrl();
    };
    cloudsInput.addEventListener('change', updateClouds);
    cloudsInput.addEventListener('blur', updateClouds);
    cloudsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            updateClouds();
            cloudsInput.blur();
        }
    });

    // show tile dates
    const tileDate = createElem(additionalControlsContainer, 'label', [], { }, "&nbsp;&#x1f5d3;&nbsp;");
    tileDate.id = `tileDate${viewNum}`;
    tileDate.addEventListener('pointerdown', () => {
        const active = tileDate.innerHTML.includes('📆');
        tileDate.innerHTML = active ? "&nbsp;&#x1f5d3;&nbsp;" : "&nbsp;&#x1f4c6;&nbsp;";
        props.show_date = !active;

        // Toggle date overlay visibility on existing tiles without refreshing
        for (let i = 0; i < views.length; i++) {
            const view = views[i];
            if (view.map) {
                view.map.toggleDateOverlays();
            }
        }
        updateUrl();
    });

    // Cloudy/cloudless toggle for PlanetScope views (ps_tci, psrr_tci)
    // HIDDEN - replaced by date list with cloud percentages
    const cloudToggle = createElem(additionalControlsContainer, 'label', [], { display: 'none' }, "&nbsp;☁️&nbsp;");
    cloudToggle.id = `cloudToggle${viewNum}`;
    cloudToggle.title = "Toggle cloudy/cloudless mode";
    cloudToggle.addEventListener('pointerdown', () => {
        const isCloudy = cloudToggle.innerHTML.includes('☁️');
        cloudToggle.innerHTML = isCloudy ? "&nbsp;☀️&nbsp;" : "&nbsp;☁️&nbsp;";

        // Toggle max_clouds between 100 (cloudy) and 0 (cloudless)
        props.max_clouds = isCloudy ? 0 : 100;
        cloudsInput.value = props.max_clouds;

        // Refresh tiles
        if (views[viewNum - 1].map) {
            views[viewNum - 1].map.refresh();
        }
        updateUrl();
    });

    // Initial visibility will be set by updateViewType call
    
    // create notices
    const notUpToDateNotice = createElem(container, 'label', [ "notUpToDateNotice" ], { }, "Preview, not up-to-date");
    notUpToDateNotice.id = `notUpToDateNotice${viewNum}`;
    const attributionNotice = createElem(container, 'label', [ "attributionNotice" ], { }, "© EarthToDate");
    attributionNotice.id = `attributionNotice${viewNum}`;

    // create center crosshair overlay
    const crosshair = createElem(container, 'div', ['view-crosshair'], {
        display: 'none',
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '0',
        height: '0',
        pointerEvents: 'none',
        zIndex: '9999'
    });
    createElem(crosshair, 'div', [], {
        position: 'absolute',
        width: '20px',
        height: '2px',
        background: 'red',
        left: '-10px',
        top: '-1px'
    });
    createElem(crosshair, 'div', [], {
        position: 'absolute',
        width: '2px',
        height: '20px',
        background: 'red',
        left: '-1px',
        top: '-10px'
    });
    createElem(crosshair, 'div', [], {
        position: 'absolute',
        width: '100px',
        height: '100px',
        border: '2px solid red',
        left: '-50px',
        top: '-50px',
        boxSizing: 'border-box'
    });

    // create SCL legend
    const sclLegend = createElem(container, 'div', [ "sclLegend" ], { });
    sclLegend.id = `sclLegend${viewNum}`;

    // Define SCL classes with their colors (matching scl.py)
    const sclClasses = [
        { value: 0, color: 'rgb(0, 0, 0)', label: 'No Data' },
        { value: 1, color: 'rgb(255, 0, 255)', label: 'Saturated' },
        { value: 2, color: 'rgb(50, 50, 50)', label: 'Shadows' },
        { value: 3, color: 'rgb(100, 100, 100)', label: 'Cloud shadows' },
        { value: 4, color: 'rgb(34, 139, 34)', label: 'Vegetation' },
        { value: 5, color: 'rgb(210, 180, 140)', label: 'Not-vegetated' },
        { value: 6, color: 'rgb(0, 100, 200)', label: 'Water' },
        { value: 7, color: 'rgb(128, 128, 128)', label: 'Unclassified' },
        { value: 8, color: 'rgb(200, 200, 200)', label: 'Cloud medium' },
        { value: 9, color: 'rgb(220, 220, 220)', label: 'Cloud high' },
        { value: 10, color: 'rgb(240, 240, 255)', label: 'Thin cirrus' },
        { value: 11, color: 'rgb(255, 255, 255)', label: 'Snow or ice' }
    ];

    // Build legend HTML
    let legendHTML = '<div class="legendTitle">Scene Classification</div>';
    sclClasses.forEach(cls => {
        legendHTML += `<div class="legendItem">
            <div class="legendColor" style="background-color: ${cls.color};"></div>
            <span>${cls.label}</span>
        </div>`;
    });
    sclLegend.innerHTML = legendHTML;

    // create Mineral Classification legend
    const mineralLegend = createElem(container, 'div', [ "mineralLegend" ], { });
    mineralLegend.id = `mineralLegend${viewNum}`;

    // Define mineral classes with their colors (matching mineralmap.py)
    const mineralClasses = [
        { value: 0, color: 'rgb(0, 0, 0)', label: 'Background' },
        { value: 1, color: 'rgb(255, 100, 0)', label: 'Ferric Type A (Hem/Jar)' },
        { value: 2, color: 'rgb(165, 42, 42)', label: 'Ferric Type B (Goethite)' },
        { value: 3, color: 'rgb(255, 0, 255)', label: 'Hydroxyl-bearing' },
        { value: 4, color: 'rgb(0, 255, 0)', label: 'Ferrous/Propylitic' },
        { value: 5, color: 'rgb(255, 255, 0)', label: 'Mixed Fe+OH' },
        { value: 6, color: 'rgb(255, 255, 255)', label: 'Complex Alteration' }
    ];

    // Build mineral legend HTML
    let mineralLegendHTML = '<div class="legendTitle">Mineral Classification</div>';
    mineralClasses.forEach(cls => {
        mineralLegendHTML += `<div class="legendItem">
            <div class="legendColor" style="background-color: ${cls.color};"></div>
            <span>${cls.label}</span>
        </div>`;
    });
    mineralLegend.innerHTML = mineralLegendHTML;

    // create Soil Moisture gradient legend (RdYlBu: Red=dry → Blue=moist)
    const soilMoistureLegend = createElem(container, 'div', [ "soilMoistureLegend" ], { });
    soilMoistureLegend.id = `soilMoistureLegend${viewNum}`;
    soilMoistureLegend.innerHTML = `
        <div class="legendTitle">Soil Moisture</div>
        <div class="gradientBar" style="background: linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee090, #ffffbf, #e0f3f8, #abd9e9, #74add1, #4575b4, #313695);"></div>
        <div class="gradientLabels"><span>Dry</span><span>Moist</span></div>
    `;

    // create Soil Salinity legend (for Score and Categories views)
    const soilSalinityLegend = createElem(container, 'div', [ "soilSalinityLegend" ], { });
    soilSalinityLegend.id = `soilSalinityLegend${viewNum}`;

    const salinityClasses = [
        { color: 'rgb(0, 100, 0)', label: 'Non-saline (0-20)' },
        { color: 'rgb(144, 238, 144)', label: 'Slight (20-40)' },
        { color: 'rgb(255, 255, 0)', label: 'Moderate (40-60)' },
        { color: 'rgb(255, 165, 0)', label: 'Severe (60-80)' },
        { color: 'rgb(255, 0, 0)', label: 'Extreme (80-100)' }
    ];

    let salinityLegendHTML = '<div class="legendTitle">Soil Salinity</div>';
    salinityClasses.forEach(cls => {
        salinityLegendHTML += `<div class="legendItem">
            <div class="legendColor" style="background-color: ${cls.color};"></div>
            <span>${cls.label}</span>
        </div>`;
    });
    soilSalinityLegend.innerHTML = salinityLegendHTML;

    // create Pollution legend (per-gas diverging ramp OR combined gas/color key) — content
    // is set dynamically by updatePollutionUI(); hidden unless a pollution view is active.
    const pollutionLegend = createElem(container, 'div', [ "pollutionLegend" ], { display: 'none' });
    pollutionLegend.id = `pollutionLegend${viewNum}`;

    // create LULC legend (Land Use / Land Cover categories from lulc2.CATEGORY_BASE)
    const lulcLegend = createElem(container, 'div', [ "lulcLegend" ], { });
    lulcLegend.id = `lulcLegend${viewNum}`;
    let lulcLegendHTML = '<div class="legendTitle">Land Cover</div>';
    for (const [name, rgb] of Object.entries(LULC_PALETTE)) {
        lulcLegendHTML += `<div class="legendItem">
            <div class="legendColor" style="background-color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]});"></div>
            <span>${name}</span>
        </div>`;
    }
    lulcLegend.innerHTML = lulcLegendHTML;

    // create WorldCover legend (ESA WorldCover v200 2021 official palette)
    const WC_LEGEND = [
        [ 10, [  0, 100,   0], 'Tree cover'],
        [ 20, [255, 187,  34], 'Shrubland'],
        [ 30, [255, 255,  76], 'Grassland'],
        [ 40, [240, 150, 255], 'Cropland'],
        [ 50, [250,   0,   0], 'Built-up'],
        [ 60, [180, 180, 180], 'Bare / sparse veg'],
        [ 70, [240, 240, 240], 'Snow / ice'],
        [ 80, [  0, 100, 200], 'Permanent water'],
        [ 90, [  0, 150, 160], 'Herbaceous wetland'],
        [ 95, [  0, 207, 117], 'Mangroves'],
        [100, [250, 230, 160], 'Moss / lichen'],
    ];
    const worldcoverLegend = createElem(container, 'div', [ "lulcLegend" ], { });
    worldcoverLegend.id = `worldcoverLegend${viewNum}`;
    let wcHTML = '<div class="legendTitle">WorldCover (ESA 2021)</div>';
    for (const [code, rgb, label] of WC_LEGEND) {
        wcHTML += `<div class="legendItem">
            <div class="legendColor" style="background-color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]});"></div>
            <span>${label}</span>
        </div>`;
    }
    worldcoverLegend.innerHTML = wcHTML;

    // LULC click-to-tooltip: read pixel color under cursor, reverse-lookup to category name.
    container.addEventListener('click', async (e) => {
        const view = views[viewNum - 1];
        if (!view || !view.viewtype || !view.viewtype.endsWith('_lulc')) return;
        const tileEl = document.elementFromPoint(e.clientX, e.clientY);
        if (!tileEl || !tileEl.classList.contains('map-tile')) return;
        const bg = tileEl.style.backgroundImage;
        const m = bg.match(/url\(["']?(.+?)["']?\)/);
        if (!m) return;
        const url = m[1];
        const rect = tileEl.getBoundingClientRect();
        const px = Math.floor(((e.clientX - rect.left) / rect.width) * 256);
        const py = Math.floor(((e.clientY - rect.top) / rect.height) * 256);
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
            const cv = document.createElement('canvas');
            cv.width = img.naturalWidth; cv.height = img.naturalHeight;
            const ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const sx = Math.floor(px * (img.naturalWidth / 256));
            const sy = Math.floor(py * (img.naturalHeight / 256));
            const d = ctx.getImageData(sx, sy, 1, 1).data;
            // Nearest palette entry (LULC palette small, ~19 entries)
            let best = null, bestDist = Infinity;
            for (const [name, rgb] of Object.entries(LULC_PALETTE)) {
                const dist = (d[0]-rgb[0])**2 + (d[1]-rgb[1])**2 + (d[2]-rgb[2])**2;
                if (dist < bestDist) { bestDist = dist; best = name; }
            }
            // Show popup
            document.querySelectorAll('[data-lulc-tip]').forEach(el => el.remove());
            const tip = document.createElement('div');
            tip.setAttribute('data-lulc-tip', '1');
            tip.style.cssText = 'position:fixed;z-index:10000;background:rgba(0,0,0,0.85);color:white;padding:6px 10px;border-radius:4px;font-size:12px;pointer-events:none;';
            tip.style.left = (e.clientX + 12) + 'px';
            tip.style.top = (e.clientY - 28) + 'px';
            tip.textContent = best || 'unknown';
            document.body.appendChild(tip);
            setTimeout(() => tip.remove(), 3500);
        } catch (err) {
            // ignore (likely CORS or load failure)
        }
    });

    // create Soil Salinity Score gradient legend (RdYlBu_r: Blue→Yellow→Red)
    const soilScoreLegend = createElem(container, 'div', [ "soilScoreLegend" ], { });
    soilScoreLegend.id = `soilScoreLegend${viewNum}`;
    soilScoreLegend.innerHTML = `
        <div class="legendTitle">Salinity Score</div>
        <div class="gradientBar" style="background: linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #e0f3f8, #ffffbf, #fee090, #fdae61, #f46d43, #d73027, #a50026);"></div>
        <div class="gradientLabels"><span>0</span><span>50</span><span>100</span></div>
    `;

    // create Flood Simulation slider control
    const floodControl = createElem(container, 'div', [ "floodControl" ], { });
    floodControl.id = `floodControl${viewNum}`;
    floodControl.innerHTML = `
        <div class="floodTitle">Flood</div>
        <input type="range" class="floodSlider" id="floodSlider${viewNum}" min="0" max="1000" value="500" step="1" orient="vertical">
        <div class="floodValue" id="floodValue${viewNum}">0m</div>
    `;

    // Add event listener to update flood visualization
    const floodSlider = floodControl.querySelector('.floodSlider');
    const floodValueDisplay = floodControl.querySelector('.floodValue');

    if (floodSlider) {
        floodSlider.addEventListener('input', (e) => {
            // Get the mapping from the views array (viewNum is 1-indexed, array is 0-indexed)
            const view = views[viewNum - 1];
            if (view && view.map && view.map.updateFloodLevel) {
                view.map.updateFloodLevel(parseFloat(e.target.value));
            }
        });
    }

    // connect the mark AOI facility - always active for corner dragging
    const markAoiInstance = initMarkAoi(container);
    markAoiInstance.activate();

    // Set initial PlanetScope defaults
    const isPlanetScopeInit = (resolutionSelect.value === 'ps' || resolutionSelect.value === 'psrr' || resolutionSelect.value === 'pssrx2' || resolutionSelect.value === 'pssrx4');
    if (isPlanetScopeInit) {
        props.days_back = 5;
        props.max_clouds = 100;
        const daysBackEl = document.getElementById(`daysBack${viewNum}`);
        const cloudsInputEl = document.getElementById(`clouds${viewNum}`);
        if (daysBackEl) daysBackEl.value = 5;
        if (cloudsInputEl) cloudsInputEl.value = 100;
    }

    return uiContainer;
}
