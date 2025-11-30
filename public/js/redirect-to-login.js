// Auto-redirect script for index.html
// Add this script at the end of index.html before </body>

// Redirect all app section links to login page
document.querySelectorAll('a[href="reception.html"], a[href="doctor.html"], a[href="pharmacy.html"]').forEach(link => {
    link.href = 'login.html';
});

console.log('✅ All app links redirected to login page');
