const express = require('express');
const router = express.Router();

// Import the controller functions
const {
    getAllCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getAvailableResources,
    createAssignment,
    getOngoingAssignments, 
    completeAssignment, 
    getCompletedAssignments, 
    getMonthlyReports,
    getAssignmentDocData,
    proxyImage,
    getInvoiceData,
    getAssignmentCount,
    cancelAssignment,
    getAdminAllCustomers,
    getCancelledAssignments
} = require('../controllers/assignmentController'); // Adjust the path if necessary

// ==========================================
// Customer Management Routes
// ==========================================
// Route to get all customers
router.get('/api/customers/getall', getAllCustomers);
// Route to create a new customer
router.post('/api/customers/create', createCustomer);
// Route to update an existing customer by ID
router.put('/api/customers/update/:id', updateCustomer);
// Route to delete a customer by ID
router.delete('/api/customers/delete/:id', deleteCustomer);

// ==========================================
// Assignment Management Routes
// ==========================================
// Route to check available vehicles and drivers for a specific time range
router.post('/api/assignments/available-resources', getAvailableResources);
// Route to create a new trip assignment
router.post('/api/assignments/create', createAssignment);

// Route to get all ongoing assignments
router.get('/api/assignments/ongoing', getOngoingAssignments);
// Route to mark an assignment as completed and process payments
router.put('/api/assignments/complete/:id', completeAssignment);
// Route to get all completed assignments
router.get('/api/assignments/completed', getCompletedAssignments);
// Route to get all cancelled assignments
router.get('/api/assignments/cancelled', getCancelledAssignments);
// Route to get monthly financial reports
router.get('/api/assignments/reports', getMonthlyReports);

// Route to get detailed document data for an assignment
router.get('/api/assignments/document/:id', getAssignmentDocData);
// Route to proxy images (fixes CORS issues)
router.get('/api/assignments/proxy-image', proxyImage);
// Route to get invoice data for a completed assignment
router.get('/api/assignments/invoice/:id', getInvoiceData);
// Route to get assignment counts (total, ongoing, completed)
router.get('/api/assignments/counts', getAssignmentCount);

// Route to cancel an ongoing assignment
router.put('/api/assignments/cancel/:id', cancelAssignment);

// Route for admins to get all customers
router.get('/api/customers/admingetall', getAdminAllCustomers);



module.exports = router;