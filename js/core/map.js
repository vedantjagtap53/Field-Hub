
// ========================================
// Map Logic
// ========================================
import { Toast } from '../utils/ui_helpers.js';

let map = null;
let miniMap = null;

export const MapUtils = {
    renderMap: () => {
        const mapEl = document.getElementById('ops-map');
        if (!mapEl) return;

        // If map exists, just invalidate size
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
            return;
        }

        try {
            // Default View (Pune, India)
            map = L.map('ops-map').setView([18.457628, 73.850929], 13);

            // OpenStreetMap - Clear, visible tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            // Add sites and markers
            MapUtils.addMapMarkers(map);

            Toast.success('Map loaded');
        } catch (err) {
            console.error('Map error:', err);
            Toast.error('Map error');
        }
    },

    renderMiniMap: () => {
        const mapEl = document.getElementById('overview-map');
        if (!mapEl) return;

        // If mini map exists, just invalidate size
        if (miniMap) {
            setTimeout(() => miniMap.invalidateSize(), 100);
            return;
        }

        try {
            // Create mini map
            miniMap = L.map('overview-map', {
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false
            }).setView([18.457628, 73.850929], 11);

            // Simple tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '',
                maxZoom: 15
            }).addTo(miniMap);

            // Add markers (simplified)
            MapUtils.addMapMarkers(miniMap);

            // Invalidate after render
            setTimeout(() => miniMap.invalidateSize(), 200);
        } catch (err) {
            console.error('Mini map error:', err);
        }
    },

    addMapMarkers: (targetMap) => {
        // All sites
        const sites = window.store.getSites();
        sites.forEach(site => {
            if (!site.coords) return;
            L.marker(site.coords).addTo(targetMap).bindPopup(`<b>${site.name}</b>`);
            L.circle(site.coords, {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                radius: site.radius || 100
            }).addTo(targetMap);
        });

        // Active staff
        window.store.getStaffStatus().filter(s => s.status === 'in').forEach(s => {
            let lat, lng;
            if (s.coords && s.coords.lat && s.coords.lng) {
                lat = s.coords.lat;
                lng = s.coords.lng;
            } else {
                return;
            }

            const icon = L.divIcon({
                className: 'custom-marker',
                html: '<div style="background: #3b82f6; width:10px; height:10px; border-radius:50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [14, 14]
            });

            L.marker([lat, lng], { icon }).addTo(targetMap).bindPopup(`<b>${s.name}</b><br>${s.lastLoc || 'Clocked In'}`);
        });
    },

    invalidate: () => {
        if (map) setTimeout(() => map.invalidateSize(), 100);
        if (miniMap) setTimeout(() => miniMap.invalidateSize(), 100);
    }
};
