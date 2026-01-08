
// ========================================
// Export Utilities
// ========================================

const ExportUtils = {
    /**
     * Convert an array of objects to a CSV string
     * @param {Array} data - Array of objects
     * @param {Array} columns - Array of column definitions { header: 'Name', key: 'name' }
     */
    toCSV: (data, columns) => {
        if (!data || !data.length) return '';

        // Header Row
        const headers = columns.map(c => c.header).join(',');

        // Data Rows
        const rows = data.map(row => {
            return columns.map(c => {
                let val = row[c.key];

                // Handle nested properties (e.g. 'user.name') - simple version
                if (c.key.includes('.')) {
                    val = c.key.split('.').reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : '', row);
                }

                // Handle dates or value transformers
                if (c.transform) {
                    val = c.transform(val, row);
                }

                // Escape quotes and commas
                val = (val === null || val === undefined) ? '' : String(val);
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(',');
        });

        return [headers, ...rows].join('\n');
    },

    /**
     * Trigger a file download in the browser
     * @param {String} content - The file content
     * @param {String} filename - The name of the file
     * @param {String} type - MIME type (e.g., 'text/csv')
     */
    downloadFile: (content, filename, type) => {
        const blob = new Blob([content], { type: `${type};charset=utf-8;` });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    },

    exportCSV: (data, columns, filename) => {
        const csv = ExportUtils.toCSV(data, columns);
        ExportUtils.downloadFile(csv, `${filename}.csv`, 'text/csv');
    },

    exportJSON: (data, filename) => {
        const json = JSON.stringify(data, null, 2);
        ExportUtils.downloadFile(json, `${filename}.json`, 'application/json');
    },

    printElement: (elementId) => {
        const content = document.getElementById(elementId).innerHTML;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Print Report</title>');
        // Try to include basic styles for printing
        printWindow.document.write('<style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} img{max-width:100px;}</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }
};

window.ExportUtils = ExportUtils;
