import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CountUpAnimation from '../components/CountUpAnimation';
import { authService, gamificationService, studyPlanService, rlService, BACKEND_URL } from '../services/api';
import '../styles/dashboard.css';

/**
 * Dashboard Page
 * 
 * The central hub for the student.
 * Aggregates data from multiple services:
 * - Gamification: XP, Level, Streak, Daily Goals.
 * - Study Plan: Progress through modules/weeks.
 * - RL: Personalized recommendations (Boosts, Badges, Bonus Goals).
 * 
 * Key Features:
 * - Dynamic RL State: Checks for active boosts or special goals injected by the RL engine.
 * - Real-time Timers: For expiring boosts (e.g., "2x XP for 20 mins").
 * - Progress Visualization: Charts and bars for level and module completion.
 */
const DashboardPage = () => {
    const navigate = useNavigate();
    const user = authService.getCurrentUser();

    // Gamification state: XP, Level, Streak
    const [xpData, setXpData] = useState({
        levelTitle: 'LOADING...',
        currentLevel: 0,
        currentXP: 0,
        nextLevelXP: 100,
        progressPercentage: 0,
        currentStreak: 0,
        stage: 'beginner'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [previousXP, setPreviousXP] = useState(0);

    // Study Plan Progress state: Modules completed, current week
    const [progressData, setProgressData] = useState({
        totalModules: 0,
        completedModules: 0,
        percentComplete: 0,
        currentModule: null,
        modules: []
    });
    const [progressLoading, setProgressLoading] = useState(true);

    // Daily Goals state
    const [goalsData, setGoalsData] = useState({
        goals: [
            { id: 1, text: 'Complete today\'s learning item', progress: 'PROGRESS: 0/1', xp: '+100 XP', completed: false },
            { id: 2, text: 'Complete a graded assessment', progress: null, xp: '+300 XP', completed: false },
            { id: 3, text: 'Progress toward your weekly streak', progress: null, xp: '+50 XP', completed: false },
        ],
        completedGoals: 0
    });

    // RL Recommendation state: Stores the current action (e.g., 'MULTIPLIER_BOOST')
    const [rlRecommendation, setRlRecommendation] = useState(null);
    const [rlLoading, setRlLoading] = useState(true);

    // Fetch gamification data on mount
    useEffect(() => {
        const fetchGamificationData = async () => {
            try {
                const response = await gamificationService.getDashboardStats();
                if (response.success) {
                    setPreviousXP(xpData.currentXP);
                    setXpData(response.data);
                }
            } catch (err) {
                console.error('Failed to fetch gamification data:', err);
                const msg = err.response?.data?.message || 'Failed to load XP data';
                setError(msg);
                setXpData(prev => ({ ...prev, levelTitle: 'ERROR' }));
            } finally {
                setIsLoading(false);
            }
        };

        fetchGamificationData();
    }, []);

    // Fetch study plan progress data
    useEffect(() => {
        const fetchProgressData = async () => {
            try {
                const response = await studyPlanService.getProgress();
                if (response.success) {
                    setProgressData(response);
                }
            } catch (error) {
                console.error('Failed to fetch progress data:', error);
            } finally {
                setProgressLoading(false);
            }
        };

        fetchProgressData();
    }, []);

    // Fetch daily goals
    useEffect(() => {
        const fetchGoalsData = async () => {
            try {
                const response = await gamificationService.getDailyGoals();
                if (response.success) {
                    setGoalsData(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch goals data:', error);
            }
        };

        fetchGoalsData();
    }, []);

    // Fetch RL recommendation
    // Load cached RL state (prevent auto-trigger on refresh)
    useEffect(() => {
        const loadRLState = () => {
            try {
                // 1. Check for active boost (Highest Priority)
                const savedBoost = localStorage.getItem('activeRLBoost');
                if (savedBoost) {
                    const boostData = JSON.parse(savedBoost);
                    if (boostData.expiresAt > Date.now()) {
                        console.log('🔥 Resuming active boost from storage');
                        setRlRecommendation({
                            action_code: 'MULTIPLIER_BOOST',
                            action_name: 'XP Boost',
                            description: '2x XP active!'
                        });
                        setRlLoading(false);
                        return; // Boost overrides everything
                    } else {
                        localStorage.removeItem('activeRLBoost');
                    }
                }

                // Load cached RL state
                const cachedState = localStorage.getItem('cachedRLState');
                if (cachedState) {
                    const rec = JSON.parse(cachedState);
                    console.log('📂 Loaded cached RL state:', rec.action_code);

                    // Check expiration for Extra Goals (remove > 1 day after assignment)
                    if (rec.action_code === 'EXTRA_GOALS' && rec.assignedAt) {
                        const assignedDate = new Date(rec.assignedAt);
                        const today = new Date();
                        assignedDate.setHours(0, 0, 0, 0);
                        today.setHours(0, 0, 0, 0);
                        const diffTime = Math.abs(today - assignedDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays > 1) {
                            console.log('🧹 Clearing expired Extra Goal (Day +2)');
                            localStorage.removeItem('cachedRLState');
                            return; // Stop loading
                        }
                    }

                    setRlRecommendation(rec);
                }
            } catch (error) {
                console.error('Failed to load RL cache:', error);
            } finally {
                setRlLoading(false);
            }
        };

        loadRLState();
    }, []);

    // Inject bonus goal if missing (handles race condition)
    useEffect(() => {
        if (rlRecommendation?.action_code === 'EXTRA_GOALS' && goalsData?.goals) {
            const hasBonus = goalsData.goals.some(g => g.id === 99);

            // Check completion
            const assignedAt = rlRecommendation.assignedAt || Date.now();
            const assignedDate = new Date(assignedAt).toDateString();
            const todayDate = new Date().toDateString();
            const isCompleted = assignedDate !== todayDate;
            const isClaimed = rlRecommendation.rewardClaimed;

            if (isCompleted && !isClaimed) {
                // Award XP and mark as claimed
                console.log('🎉 Claiming Extra Goal Reward!');
                gamificationService.addXP(50)
                    .then(() => {
                        // Update cache to prevent re-claiming
                        const updatedRec = { ...rlRecommendation, rewardClaimed: true };
                        setRlRecommendation(updatedRec);
                        localStorage.setItem('cachedRLState', JSON.stringify(updatedRec));

                        // Force refresh XP display
                        gamificationService.getDashboardStats().then(res => {
                            if (res.success) setXpData(res.data);
                        });
                    })
                    .catch(err => console.error('Failed to claim reward:', err));
            }

            if (!hasBonus) {
                console.log('✨ Injecting Bonus Goal (Reactive)', { isCompleted });
                setGoalsData(prev => ({
                    ...prev,
                    goals: [
                        {
                            id: 99,
                            text: isCompleted ? '✨ Bonus Goal: Logged in today!' : '✨ Bonus Goal: Log in tomorrow',
                            progress: isCompleted ? 'COMPLETED!' : null,
                            xp: '+50 XP',
                            completed: isCompleted,
                            isBonus: true
                        },
                        ...prev.goals
                    ]
                }));
            }
        }
    }, [rlRecommendation, goalsData]);

    // Timer state for Multiplier Boost
    const [timeLeft, setTimeLeft] = useState(0);

    // Initialize/Sync Timer
    useEffect(() => {
        const savedBoost = localStorage.getItem('activeRLBoost');
        if (savedBoost) {
            const boostData = JSON.parse(savedBoost);
            const remaining = Math.floor((boostData.expiresAt - Date.now()) / 1000);

            if (remaining > 0) {
                setTimeLeft(remaining);
                // Also force state if not already set (e.g. initial load)
                if (rlRecommendation?.action_code !== 'MULTIPLIER_BOOST') {
                    setRlRecommendation({
                        action_code: 'MULTIPLIER_BOOST',
                        action_name: 'XP Boost',
                        description: '2x XP active!'
                    });
                }
            } else {
                localStorage.removeItem('activeRLBoost');
            }
        }
    }, []);

    // Calculate total steps for modules card
    const totalSteps = progressData.modules.reduce((acc, m) => acc + m.totalSteps, 0);
    const completedSteps = progressData.modules.reduce((acc, m) => acc + m.completedSteps, 0);

    // Timer Logic
    useEffect(() => {
        let interval;
        if (rlRecommendation?.action_code === 'MULTIPLIER_BOOST' && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    const newVal = prev - 1;
                    if (newVal <= 0) {
                        localStorage.removeItem('activeRLBoost');
                        // Optional: clear banner? keeping simplest for now
                    }
                    return newVal;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [rlRecommendation, timeLeft]);

    // Format time as MM:SS
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Layout>
            <div className="dashboard">
                {/* RL: Multiplier Boost Banner */}
                {rlRecommendation?.action_code === 'MULTIPLIER_BOOST' && (
                    <div className="rl-banner multiplier-banner">
                        <span className="banner-icon">🔥</span>
                        <div className="banner-content">
                            <h4>2x XP Boost Active!</h4>
                            <p>Complete a lesson in the next {Math.ceil(timeLeft / 60)}m to earn double points.</p>
                        </div>
                        <div className="banner-timer">{formatTime(timeLeft)}</div>
                    </div>
                )}

                {/* Welcome Header */}
                <div className="welcome-header">
                    <div className="welcome-avatar">
                        <img
                            src={user?.profilePic ? `${BACKEND_URL}${user.profilePic}` : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"}
                            alt="User avatar"
                        />
                    </div>
                    <div className="welcome-text">
                        <h1>Welcome back, {user?.name || 'Learner'}!</h1>
                        <p>Continue your journey to mastery.</p>
                    </div>
                </div>

                {/* Stats Cards Row */}
                <div className="stats-row three-cards">
                    {/* Current Stage Card */}
                    <div className="stat-card current-stage">
                        <div className="card-header">
                            <h3>Current Stage</h3>
                            <span className="badge blue" title={`Debug: "${xpData.stage}"`}>
                                {xpData.stage?.toUpperCase() || 'BEGINNER'}
                            </span>
                        </div>
                        <div className="progress-bars">
                            <div className="progress-bar-group">
                                {/* Bar 1 - Beginner */}
                                <div className={`bar bar-1 ${(xpData.stage?.trim().toLowerCase() === 'beginner') ? 'current' : 'completed'
                                    }`}>
                                    {xpData.stage?.trim().toLowerCase() === 'beginner' && <span className="bar-label">CURRENT</span>}
                                </div>
                                {/* Bar 2 - Intermediate */}
                                <div className={`bar bar-2 ${(xpData.stage?.trim().toLowerCase() === 'intermediate') ? 'current' :
                                    (['expert', 'advanced'].includes(xpData.stage?.trim().toLowerCase())) ? 'completed' : 'locked'
                                    }`}>
                                    {xpData.stage?.trim().toLowerCase() === 'intermediate' && <span className="bar-label">CURRENT</span>}
                                </div>
                                {/* Bar 3 - Expert/Advanced */}
                                <div className={`bar bar-3 ${(['expert', 'advanced'].includes(xpData.stage?.trim().toLowerCase())) ? 'current' : 'locked'
                                    }`}>
                                    {(['expert', 'advanced'].includes(xpData.stage?.trim().toLowerCase())) && <span className="bar-label">CURRENT</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* XP Level Card */}
                    <div className="stat-card xp-level">
                        <div className="card-header">
                            <h3>XP Level</h3>
                            <div className="streak-badge">
                                <span className="streak-fire">🔥</span>
                                <span className="streak-count">{xpData.currentStreak}</span>
                            </div>
                        </div>
                        <p className="level-label" style={{ color: error ? '#ef4444' : undefined, fontSize: error ? '0.8rem' : undefined }}>
                            {error ? `⚠️ ${error}` :
                                rlRecommendation?.action_code === 'RANK_COMPARISON'
                                    ? <span className="rank-boost">🏆 Top 15% this week!</span>
                                    : xpData.levelTitle
                            }
                        </p>
                        <div className="xp-display">
                            <div className="mastery-points">
                                <CountUpAnimation
                                    from={previousXP > 0 ? Math.floor(previousXP / 100) : 0}
                                    to={xpData.currentLevel}
                                    duration={1200}
                                    className="mastery-number"
                                />
                                <span className="mastery-trophy">🏅</span>
                            </div>
                            <p className="mastery-label">LEVEL</p>
                        </div>
                        <div className="xp-progress">
                            <div className="xp-progress-header">
                                <span>PROGRESS TO LVL {xpData.currentLevel + 1}</span>
                                <span className="xp-count">
                                    <CountUpAnimation
                                        from={previousXP}
                                        to={xpData.currentXP}
                                        duration={1500}
                                    /> / {xpData.nextLevelXP} XP
                                </span>
                            </div>
                            <div className="xp-bar">
                                <div
                                    className="xp-fill"
                                    style={{
                                        width: `${xpData.progressPercentage}%`,
                                        transition: 'width 1.5s ease-out'
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Modules Card - Real Data */}
                    <div className="stat-card modules-completed">
                        <div className="card-header">
                            <h3>Modules</h3>
                            <span className="badge orange">📚 {progressData.totalModules} Weeks</span>
                        </div>
                        <p className="level-label">LEARNING JOURNEY</p>
                        <div className="modules-progress">
                            <div className="circular-progress">
                                <span className="progress-number">
                                    {progressLoading ? '...' : progressData.completedModules}
                                </span>
                                <svg className="progress-check" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2" />
                                    <path d="M8 12L11 15L16 9" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <p className="modules-label">
                                OUT OF {progressData.totalModules} MODULES
                            </p>
                        </div>
                        <div className="goal-progress">
                            <div className="goal-header">
                                <span>COMPLETION</span>
                                <span className="days-remaining">{progressData.percentComplete}% DONE</span>
                            </div>
                            <div className="goal-bar">
                                <div className="goal-fill" style={{ width: `${progressData.percentComplete}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Current Module Section - Real Data */}
                <div className="current-module-card">
                    <div className="module-badge">CURRENT MODULE</div>
                    <div className="module-content">
                        <div className="module-info">
                            <h2>{progressData.currentModule ? `Week ${progressData.currentModule.weekNumber} Module` : 'All caught up!'}</h2>
                            {progressData.currentModule?.name && (
                                <div className="module-tags">
                                    {progressData.currentModule.name.split(',').map((tag, i) => (
                                        <span key={i} className="tag-chip">{tag.trim()}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="module-action">
                            <div className="lesson-info">
                                {progressData.currentModule ? (
                                    <>
                                        <h4>{progressData.currentModule.completedSteps}/{progressData.currentModule.totalSteps} Steps Complete</h4>
                                        <span className="assessments">
                                            📄 {progressData.currentModule.stepsRemaining} Steps remaining
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {/* Find next locked week with days remaining */}
                                        {(() => {
                                            const nextLockedWeek = progressData.modules.find(m => m.status === 'LOCKED' && m.daysRemaining);
                                            if (nextLockedWeek) {
                                                return (
                                                    <>
                                                        <h4>Next module unlocks in {nextLockedWeek.daysRemaining} day{nextLockedWeek.daysRemaining > 1 ? 's' : ''}</h4>
                                                        <span className="assessments">⏰ Check back soon!</span>
                                                    </>
                                                );
                                            }
                                            return (
                                                <>
                                                    <h4>All modules completed!</h4>
                                                    <span className="assessments">🎉 Great job!</span>
                                                </>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                            <button
                                className="resume-btn"
                                onClick={() => progressData.currentModule && navigate(`/learn/${progressData.currentModule.weekNumber}`)}
                                disabled={!progressData.currentModule}
                            >
                                Resume
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="bottom-section">
                    {/* Learning Path - Real Data */}
                    <div className="learning-path">
                        <div className="path-header">
                            <h3>Your Learning Path</h3>

                        </div>
                        <div className="modules-list">
                            {progressData.modules.map((module) => (
                                <div
                                    key={module.weekNumber}
                                    className={`module-item ${module.status.toLowerCase()}`}
                                    onClick={() => module.status !== 'LOCKED' && navigate(`/learn/${module.weekNumber}`)}
                                    style={{ cursor: module.status !== 'LOCKED' ? 'pointer' : 'not-allowed' }}
                                >
                                    <div className="module-icon">
                                        {module.status === 'COMPLETED' && (
                                            <svg viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" fill="#22c55e" />
                                                <path d="M8 12L11 15L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                        {module.status === 'ACTIVE' && (
                                            <svg viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" fill="#3b82f6" />
                                                <path d="M10 8L16 12L10 16V8Z" fill="white" />
                                            </svg>
                                        )}
                                        {module.status === 'LOCKED' && (
                                            <svg viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" fill="#e2e8f0" />
                                                <rect x="8" y="10" width="8" height="6" rx="1" stroke="#94a3b8" strokeWidth="1.5" />
                                                <path d="M10 10V8C10 6.89543 10.8954 6 12 6C13.1046 6 14 6.89543 14 8V10" stroke="#94a3b8" strokeWidth="1.5" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="module-details">
                                        <h4>Week {module.weekNumber}</h4>
                                        <span className="module-status">
                                            {module.status === 'LOCKED' && module.daysRemaining
                                                ? `Unlocks in ${module.daysRemaining} day${module.daysRemaining > 1 ? 's' : ''}`
                                                : `${module.status} • ${module.completedSteps}/${module.totalSteps} steps`
                                            }
                                        </span>
                                    </div>
                                    <svg className="module-arrow" viewBox="0 0 24 24" fill="none">
                                        <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            ))}
                            {progressData.modules.length === 0 && !progressLoading && (
                                <div className="no-modules">
                                    <p>No study plan available yet. Complete your initial assessment to get started!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Today's Goals */}
                    <div className="todays-goals">
                        <div className="goals-header">
                            <h3>Today's goals</h3>
                            <span className="goals-bolt">⚡</span>
                        </div>
                        <div className="goals-list">
                            {goalsData.goals.map((goal) => (
                                <div key={goal.id} className={`goal-item ${goal.completed ? 'completed' : ''}`}>
                                    <svg className="goal-star" viewBox="0 0 24 24" fill={goal.completed ? "#fbbf24" : "none"}>
                                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="goal-content">
                                        <span className="goal-text">{goal.text}</span>
                                        {goal.progress && <span className="goal-progress-text">{goal.progress}</span>}
                                        <span className="goal-xp">{goal.xp}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* RL: Premium Badge Injection Modal */}
            {rlRecommendation?.action_code === 'BADGE_INJECTION' && (
                <div className="modal-overlay glass-overlay" onClick={() => setRlRecommendation(null)}>
                    <div className="premium-badge-modal" onClick={e => e.stopPropagation()}>
                        <div className="premium-badge-background">
                           <div className="badge-glow"></div>
                           <div className="badge-sparkles">
                               {[...Array(6)].map((_, i) => <div key={i} className={`sparkle sparkle-${i + 1}`}>✨</div>)}
                           </div>
                           <div className="badge-icon-container">
                               <span className="premium-badge-emoji">🎖️</span>
                           </div>
                        </div>
                        <div className="premium-badge-content">
                            <h2 className="premium-badge-title">Achievement Unlocked</h2>
                            <p className="premium-badge-desc">
                                Exceptional work! You've earned the <span className="highlight-badge">Dedication Badge</span> for your consistent learning streak.
                            </p>
                            <button className="premium-claim-btn" onClick={() => setRlRecommendation(null)}>
                                <span>Claim Reward</span>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DEBUG: Cycle RL Actions (Hidden, bottom right) */}
            <div
                style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    opacity: 0.1,
                    transition: 'opacity 0.3s',
                    zIndex: 9999
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.1}
            >
                <button
                    onClick={() => {
                        const actions = ['MULTIPLIER_BOOST', 'BADGE_INJECTION', 'RANK_COMPARISON', 'EXTRA_GOALS', 'STANDARD_XP'];
                        const currentIdx = actions.indexOf(rlRecommendation?.action_code);
                        const nextIdx = (currentIdx + 1) % actions.length;
                        const nextAction = actions[nextIdx];

                        console.log('🔄 Manually switching to:', nextAction);
                        setRlRecommendation({
                            action_code: nextAction,
                            action_name: 'Manual Override',
                            description: 'Debug Mode'
                        });

                        // Reset timer if switching to boost
                        if (nextAction === 'MULTIPLIER_BOOST') setTimeLeft(1200);

                        // Add bonus goal if switching to EXTRA_GOALS
                        if (nextAction === 'EXTRA_GOALS') {
                            setGoalsData(prev => ({
                                ...prev,
                                goals: [
                                    {
                                        id: 99,
                                        text: '✨ Bonus Goal: Log in tomorrow',
                                        progress: null,
                                        xp: '+50 XP',
                                        completed: false,
                                        isBonus: true
                                    },
                                    ...prev.goals.filter(g => g.id !== 99) // Remove if already exists
                                ]
                            }));
                        } else {
                            // Remove bonus goal when switching away from EXTRA_GOALS
                            setGoalsData(prev => ({
                                ...prev,
                                goals: prev.goals.filter(g => g.id !== 99)
                            }));
                        }
                    }}
                    style={{
                        padding: '8px 12px',
                        background: '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    🔧 cycle rl action
                </button>
            </div>
        </Layout>
    );
};

export default DashboardPage;
