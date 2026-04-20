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

// Map routes to controller functions
router.get('/api/customers/getall', getAllCustomers);
router.post('/api/customers/create', createCustomer);
router.put('/api/customers/update/:id', updateCustomer);
router.delete('/api/customers/delete/:id', deleteCustomer);

router.post('/api/assignments/available-resources', getAvailableResources);
router.post('/api/assignments/create', createAssignment);

router.get('/api/assignments/ongoing', getOngoingAssignments);
router.put('/api/assignments/complete/:id', completeAssignment);
router.get('/api/assignments/completed', getCompletedAssignments);
router.get('/api/assignments/cancelled', getCancelledAssignments);
router.get('/api/assignments/reports', getMonthlyReports);

router.get('/api/assignments/document/:id', getAssignmentDocData);
router.get('/api/assignments/proxy-image', proxyImage);
router.get('/api/assignments/invoice/:id', getInvoiceData);
router.get('/api/assignments/counts', getAssignmentCount);

router.put('/api/assignments/cancel/:id', cancelAssignment);

router.get('/api/customers/admingetall', getAdminAllCustomers);



module.exports = router;