const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const {
    getAccountInfo, getPersonalBests,
    upload, uploadProfilePic, updateProfile,
    changePassword, changeEmail, deleteAccount
} = require('../controllers/accountController');

// @route   GET /account-info
// @access  Private
router.get('/account-info', auth, getAccountInfo);

// @route   GET /personal-bests
// @access  Private
router.get('/personal-bests', auth, getPersonalBests);

// @route   POST /upload-profile-pic
// @access  Private
router.post('/upload-profile-pic', auth, upload.single('profilePic'), uploadProfilePic);

// @route   PUT /update-profile
// @access  Private
router.put('/update-profile', auth, updateProfile);

// @route   PUT /change-password
// @access  Private
router.put('/change-password', auth, changePassword);

// @route   PUT /change-email
// @access  Private
router.put('/change-email', auth, changeEmail);

// @route   DELETE /delete-account
// @access  Private
router.delete('/delete-account', auth, deleteAccount);

module.exports = router;
