
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
    },

    /**
     * Export entire database as JSON backup
     */
    exportFullDatabase: async () => {
        const backup = {
            exportedAt: new Date().toISOString(),
            users: window.store.getUsers(),
            projects: window.store.getProjects(),
            sites: window.store.getSites(),
            tasks: window.store.getTasks(),
            leaveRequests: window.store.getLeaveRequests(),
            reports: window.store.getReports ? window.store.getReports() : [],
            attendanceLogs: window.store.getAttendanceLogs(null, 10000),
            messages: window.store.getMessages ? window.store.getMessages() : [],
            registrations: window.store.getRegistrations ? window.store.getRegistrations() : []
        };
        const date = new Date().toISOString().split('T')[0];
        ExportUtils.exportJSON(backup, `FieldHub_Backup_${date}`);
        return backup;
    },

    /**
     * Get data older than specified months
     * @param {number} monthsOld - Age threshold in months
     */
    getOldData: (monthsOld = 6) => {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - monthsOld);
        const cutoffISO = cutoff.toISOString();

        const oldLogs = window.store.getAttendanceLogs(null, 10000).filter(l => l.timestamp < cutoffISO);
        const oldReports = (window.store.getReports ? window.store.getReports() : []).filter(r => r.submittedAt < cutoffISO);
        const oldTasks = window.store.getTasks().filter(t => t.status === 'completed' && t.createdAt < cutoffISO);
        const oldLeaves = window.store.getLeaveRequests().filter(l => l.status !== 'pending' && l.createdAt < cutoffISO);

        return {
            cutoffDate: cutoffISO,
            attendanceLogs: oldLogs,
            reports: oldReports,
            tasks: oldTasks,
            leaveRequests: oldLeaves,
            totalCount: oldLogs.length + oldReports.length + oldTasks.length + oldLeaves.length
        };
    },

    /**
     * Archive (export) and then purge old data
     * @param {number} monthsOld - Age threshold
     */
    archiveAndPurge: async (monthsOld = 6) => {
        const oldData = ExportUtils.getOldData(monthsOld);

        if (oldData.totalCount === 0) {
            return { success: false, message: 'No old data to archive.' };
        }

        // First export
        const date = new Date().toISOString().split('T')[0];
        ExportUtils.exportJSON(oldData, `FieldHub_Archive_Before_${date}`);

        // Then delete
        const db = window.db;
        const batch = db.batch();
        let deleteCount = 0;

        // Note: Batch has a limit of 500 operations
        // For large datasets, we'd need to chunk this
        oldData.attendanceLogs.slice(0, 100).forEach(doc => {
            batch.delete(db.collection('attendanceLogs').doc(doc.id));
            deleteCount++;
        });

        oldData.reports.slice(0, 100).forEach(doc => {
            batch.delete(db.collection('reports').doc(doc.id));
            deleteCount++;
        });

        oldData.tasks.slice(0, 100).forEach(doc => {
            batch.delete(db.collection('tasks').doc(doc.id));
            deleteCount++;
        });

        oldData.leaveRequests.slice(0, 100).forEach(doc => {
            batch.delete(db.collection('leaveRequests').doc(doc.id));
            deleteCount++;
        });

        await batch.commit();

        return {
            success: true,
            message: `Archived and purged ${deleteCount} records.`,
            remaining: oldData.totalCount - deleteCount
        };
    }
};

window.ExportUtils = ExportUtils;

