import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { authService, gamificationService, BACKEND_URL } from '../services/api';
import ProfileUploadModal from '../components/ProfileUploadModal';
import EditProfileModal from '../components/EditProfileModal';
import '../styles/profile.css';

/**
 * Profile Page
 * 
 * Displays user details and achievements.
 * Features:
 * - Stats Overview: Personal Bests (Highest Score, Longest Streak).
 * - Badges: Visual gallery of earned achievements.
 * - Profile Management: Edit Modal and Avatar Upload.
 */
const ProfilePage = () => {
    const [user, setUser] = useState(authService.getCurrentUser());
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
    const [accountInfo, setAccountInfo] = useState(null);
    const [accountLoading, setAccountLoading] = useState(true);
    const [personalBests, setPersonalBests] = useState(null);
    const [bestsLoading, setBestsLoading] = useState(true);
    const [badges, setBadges] = useState([]);
    const [badgesLoading, setBadgesLoading] = useState(true);

    // Fetch account info and personal bests on mount
    useEffect(() => {
        const fetchAccountInfo = async () => {
            try {
                const response = await authService.getAccountInfo();
                if (response.success) {
                    setAccountInfo(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch account info:', error);
            } finally {
                setAccountLoading(false);
            }
        };

        const fetchPersonalBests = async () => {
            try {
                const response = await authService.getPersonalBests();
                if (response.success) {
                    setPersonalBests(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch personal bests:', error);
            } finally {
                setBestsLoading(false);
            }
        };

        const fetchBadges = async () => {
            try {
                const response = await gamificationService.getUserBadges();
                if (response.success) {
                    setBadges(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch badges:', error);
            } finally {
                setBadgesLoading(false);
            }
        };

        fetchAccountInfo();
        fetchPersonalBests();
        fetchBadges();
    }, []);

    const handleUploadSuccess = (newProfilePic) => {
        // Update local state to show new image immediately
        setUser(prev => ({ ...prev, profilePic: newProfilePic }));

        // Also fire an event so other components (like Navbar) can update if they listen
        window.dispatchEvent(new Event('userUpdated'));
    };

    const handleUpdateProfileSuccess = (updatedData) => {
        setUser(prev => ({ ...prev, name: updatedData.name, bio: updatedData.bio }));
        window.dispatchEvent(new Event('userUpdated'));
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const PLACEHOLDER_BADGES = [
        { id: 'p1', name: 'Mystery Badge', icon: null, locked: true },
        { id: 'p2', name: 'Mystery Badge', icon: null, locked: true },
        { id: 'p3', name: 'Mystery Badge', icon: null, locked: true },
        { id: 'p4', name: 'Mystery Badge', icon: null, locked: true },
    ];

    const displayBadges = badges.length > 0 ? badges : PLACEHOLDER_BADGES;

    return (
        <Layout>
            <div className="profile-page">
                {/* Profile Header with Gradient */}
                <div className="profile-header">
                    <div className="header-gradient"></div>
                    <div className="profile-info">
                        <div className="avatar-section">
                            <div className="profile-avatar" onClick={() => setIsUploadModalOpen(true)} style={{ cursor: 'pointer', position: 'relative' }}>
                                <img
                                    src={user?.profilePic ? `${BACKEND_URL}${user.profilePic}` : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face"}
                                    alt="Profile avatar"
                                />
                                <div className="avatar-overlay">
                                    <span>Change</span>
                                </div>
                            </div>
                        </div>
                        <div className="profile-details">
                            <h1>{user?.name || 'Yasindu Jay'}</h1>
                            <p className="bio">{user?.bio || 'No bio yet. Click Edit Profile to add one.'}</p>
                            <p className="join-date">


                            </p>
                        </div>
                        <button className="edit-profile-btn" onClick={() => setIsEditProfileModalOpen(true)}>Edit Profile</button>
                    </div>
                </div>

                {/* Content Section - Stacked Layout */}
                <div className="profile-content">
                    {/* Top Row - Badges */}
                    <div className="badges-section">
                        <h2>Badges Earned</h2>
                        {badgesLoading ? (
                            <div className="badges-grid">Loading badges...</div>
                        ) : (
                            <>
                                <div className="badges-grid">
                                    {displayBadges.map((badge, index) => (
                                        <div key={index} className={`badge-item ${badge.locked ? 'locked' : ''}`}>
                                            <div className="badge-icon">
                                                {/* Render icon if available, otherwise default trophy */}
                                                {badge.icon ? (
                                                    <img src={badge.icon} alt={badge.badge_name || badge.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ fontSize: '24px' }}>{badge.locked ? '🔒' : '🏆'}</span>
                                                )}
                                            </div>
                                            <span className="badge-name">{badge.badge_name || badge.name || 'Badge'}</span>
                                        </div>
                                    ))}
                                </div>
                                {badges.length === 0 && (
                                    <div className="no-badges-message">
                                        <p className="encouragement">Unlock these badges by completing your daily goals!</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Personal Best Records Card */}
                    <div className="personal-bests-card">
                        <h3>
                            <svg viewBox="0 0 24 24" fill="none" className="card-icon">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Personal Best Records
                        </h3>

                        {bestsLoading ? (
                            <div className="account-loading">Loading...</div>
                        ) : (
                            <div className="bests-grid">
                                <div className="best-item">
                                    <div className="best-icon trophy">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <path d="M8 21H16M12 17V21M7 4H17V8C17 11.866 14.2091 15 12 15C9.79086 15 7 11.866 7 8V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M17 8H19C20.1046 8 21 8.89543 21 10C21 11.1046 20.1046 12 19 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M7 8H5C3.89543 8 3 8.89543 3 10C3 11.1046 3.89543 12 5 12H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div className="best-content">
                                        <span className="best-label">Highest Score</span>
                                        <span className="best-value">{personalBests?.highestScore || 'No quizzes yet'}</span>
                                    </div>
                                </div>

                                <div className="best-item">
                                    <div className="best-icon fire">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <path d="M12 2C7.58172 2 4 5.58172 4 10C4 14.4183 7.58172 20 12 22C16.4183 20 20 14.4183 20 10C20 5.58172 16.4183 2 12 2Z" stroke="currentColor" strokeWidth="2" />
                                            <path d="M12 6V14M12 14L8 10M12 14L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div className="best-content">
                                        <span className="best-label">Longest Streak</span>
                                        <span className="best-value">{personalBests?.longestStreak ? `${personalBests.longestStreak} days` : 'No streak yet'}</span>
                                    </div>
                                </div>

                                <div className="best-item">
                                    <div className="best-icon speed">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                            <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                    <div className="best-content">
                                        <span className="best-label">Fastest Quiz</span>
                                        <span className="best-value">{personalBests?.fastestTime || 'No data yet'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Account Info Card */}
                    <div className="account-info-card">
                        <h3>
                            <svg viewBox="0 0 24 24" fill="none" className="card-icon">
                                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Account Information
                        </h3>

                        {accountLoading ? (
                            <div className="account-loading">Loading...</div>
                        ) : (
                            <div className="account-details">
                                <div className="info-row">
                                    <span className="info-label">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Email
                                    </span>
                                    <span className="info-value">{accountInfo?.email || 'N/A'}</span>
                                </div>

                                <div className="info-row">
                                    <span className="info-label">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                                            <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                        Member Since
                                    </span>
                                    <span className="info-value">{formatDate(accountInfo?.memberSince)}</span>
                                </div>

                                <div className="info-row highlight">
                                    <span className="info-label">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Days on Platform
                                    </span>
                                    <span className="info-value days-count">
                                        {accountInfo?.daysOnPlatform || 0} days
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ProfileUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadSuccess={handleUploadSuccess}
            />

            <EditProfileModal
                isOpen={isEditProfileModalOpen}
                onClose={() => setIsEditProfileModalOpen(false)}
                currentUser={user}
                onUpdateSuccess={handleUpdateProfileSuccess}
            />
        </Layout>
    );
};

export default ProfilePage;

