
// ========================================
// Map Logic
// ========================================
import { Toast } from '../utils/ui_helpers.js';

let map = null;

export const MapUtils = {
    renderMap: () => {
        const mapEl = document.getElementById('ops-map');
        if (!mapEl || map) {
            if (map) map.invalidateSize();
            return;
        }

        try {
            // Default View
            map = L.map('ops-map').setView([18.457628, 73.850929], 13);

            // OpenStreetMap - Clear, visible tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            // All sites
            const sites = window.store.getSites();
            sites.forEach(site => {
                L.marker(site.coords).addTo(map).bindPopup(`<b>${site.name}</b>`);
                L.circle(site.coords, {
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.1,
                    radius: site.radius
                }).addTo(map);
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

                L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${s.name}</b><br>${s.lastLoc || 'Clocked In'}`);
            });

            Toast.success('Map loaded');
        } catch (err) {
            console.error(err);
            Toast.error('Map error');
        }
    },

    invalidate: () => {
        if (map) map.invalidateSize();
    }
};
