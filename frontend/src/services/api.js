import axios from 'axios';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const API_URL = import.meta.env.VITE_API_URL || `${BACKEND_URL}/api`;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request Interceptor: Injects JWT token into every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// P19/P20: Response Interceptor — auto-redirect on expired/invalid token
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid — force logout and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Only redirect if not already on login/register/public pages
            const publicPaths = ['/', '/login', '/register', '/verify-email', '/forgot-password'];
            if (!publicPaths.includes(window.location.pathname) && !window.location.pathname.startsWith('/reset-password')) {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

/**
 * Authentication Service
 * Handles user sessions, registration, and profile management.
 */
export const authService = {
    login: async (email, password, rememberMe = false) => {
        const response = await api.post('/auth/login', { email, password, rememberMe });
        if (response.data.token) {
            // Only clear RL state if a DIFFERENT user is logging in
            const newUserId = response.data.user?.id;
            const lastRLUser = localStorage.getItem('lastRLUser');
            if (lastRLUser && lastRLUser !== newUserId) {
                localStorage.removeItem('cachedRLState');
                localStorage.removeItem('activeRLBoost');
                localStorage.removeItem('interactionId');
            }
            localStorage.setItem('lastRLUser', newUserId);

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    },

    register: async (email, password, firstName, lastName, userName) => {
        const response = await api.post('/auth/register', {
            email,
            password,
            firstName,
            lastName,
            userName
        });
        // Note: We don't auto-login or store token here anymore because email verification is required.
        // The token returned might be for verification context or none at all.
        return response.data;
    },

    verifyEmail: async (token) => {
        const response = await api.post('/auth/verify-email', { token });
        return response.data;
    },

    resendVerificationEmail: async (email) => {
        const response = await api.post('/auth/resend-verification', { email });
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (token, password) => {
        const response = await api.post(`/auth/reset-password/${token}`, { password });
        return response.data;
    },

    uploadProfilePic: async (formData) => {
        const response = await api.post('/auth/upload-profile-pic', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        // Update local storage if successful to reflect changes immediately
        if (response.data.success && response.data.profilePic) {
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                user.profilePic = response.data.profilePic;
                localStorage.setItem('user', JSON.stringify(user));
            }
        }
        return response.data;
    },

    updateProfile: async (data) => {
        const response = await api.put('/auth/update-profile', data);
        if (response.data.success && response.data.user) {
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                // Merge new data (e.g. name, bio)
                const updatedUser = { ...user, ...response.data.user };
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        }
        return response.data;
    },

    changePassword: async (data) => {
        const response = await api.put('/auth/change-password', data);
        return response.data;
    },

    changeEmail: async (data) => {
        const response = await api.put('/auth/change-email', data);
        // Email is now pending verification — don't update localStorage yet
        return response.data;
    },

    verifyEmailChange: async (token) => {
        const response = await api.post('/auth/verify-email-change', { token });
        return response.data;
    },


    deleteAccount: async () => {
        const response = await api.delete('/auth/delete-account');
        return response.data;
    },

    getAccountInfo: async () => {
        const response = await api.get('/auth/account-info');
        return response.data;
    },

    getPersonalBests: async () => {
        const response = await api.get('/auth/personal-bests');
        return response.data;
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // RL state is intentionally kept so the same user retains
        // their RL progress when they log back in.
        // It gets cleared on login only if a different user signs in.
    },

    getCurrentUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    }
};

/**
 * Quiz Service
 * Handles the initial placement test logic.
 */
export const quizService = {
    getInitialQuiz: async () => {
        const response = await api.get('/quiz/initial');
        return response.data;
    },

    submitAnswer: async (data) => {
        const response = await api.post('/quiz/answer', data);
        return response.data;
    },

    completeQuiz: async (data) => {
        const response = await api.post('/quiz/complete', data);
        return response.data;
    }
};

/**
 * Gamification Service
 * Manages XP, levels, streaks, badges, and daily goals.
 */
export const gamificationService = {
    getDashboardStats: async () => {
        const response = await api.get('/gamification/dashboard');
        return response.data;
    },

    addXP: async (amount) => {
        const response = await api.post('/gamification/add-xp', { amount });
        return response.data;
    },

    getDailyGoals: async () => {
        const response = await api.get('/gamification/daily-goals');
        return response.data;
    },

    getUserBadges: async () => {
        const response = await api.get('/gamification/badges');
        return response.data;
    }
};

/**
 * Study Plan Service
 * Fetches generated curriculum, tracks progress, and handles step-by-step content.
 */
export const studyPlanService = {
    getProgress: async () => {
        const response = await api.get('/study-plan/progress');
        return response.data;
    },

    getWeekContent: async (weekNumber) => {
        const response = await api.get(`/study-plan/week/${weekNumber}`);
        return response.data;
    },

    // Fetches individual step content, optionally passing a Recommendation ID for RL tracking
    getStepContent: async (weekNumber, stepId, recId = null) => {
        const url = recId
            ? `/study-plan/step/${weekNumber}/${stepId}?recId=${recId}`
            : `/study-plan/step/${weekNumber}/${stepId}`;
        const response = await api.get(url);
        return response.data;
    },

    submitQuiz: async (data) => {
        const response = await api.post('/study-plan/submit-quiz', data);
        return response.data;
    },

    saveStepResponse: async (data) => {
        const response = await api.post('/study-plan/save-response', data);
        return response.data;
    },

    clearStepResponses: async (data) => {
        const response = await api.post('/study-plan/clear-responses', data);
        return response.data;
    }
};

/**
 * Content Generation Service
 * Manages AI interactions for study plan generation and regeneration.
 */
export const contentService = {
    regenerateStep: async (data) => {
        const response = await api.post('/content/regenerate-step', data);
        return response.data;
    }
};

/**
 * Analytics Service
 * Provides data for the Weekly Engagement and XP Velocity charts.
 */
export const analyticsService = {
    getWeeklyEngagement: async (range = '7days') => {
        const response = await api.get(`/analytics/weekly-engagement?range=${range}`);
        return response.data;
    },

    getXPVelocity: async (range = '7days') => {
        const response = await api.get(`/analytics/xp-velocity?range=${range}`);
        return response.data;
    }
};

/**
 * RL (Reinforcement Learning) Service
 * Inter-service communication with the Python RL Agent.
 */
export const rlService = {
    getRecommendation: async () => {
        const response = await api.get('/rl/recommend');
        return response.data;
    },

    getMetrics: async () => {
        const response = await api.get('/rl/metrics');
        return response.data;
    },

    sendFeedback: async (engaged, interactionId) => {
        // engaged: boolean (true = user acted on the recommendation)
        // interactionId: the interaction_id returned from /rl/recommend
        const response = await api.post('/rl/feedback', { engaged, interactionId });
        return response.data;
    }
};
/**
 * Profile Classification Service (P10/P11/P12)
 * Handles student proficiency classification based on quiz scores.
 */
export const profileService = {
    /**
     * P10 + P11: Trigger classification after quiz completion
     */
    classify: async () => {
        const response = await api.post('/profile/classify');
        return response.data;
    },

    /**
     * P12: Get the student's profile classification report
     */
    getReport: async () => {
        const response = await api.get('/profile/report');
        return response.data;
    }
};

export default api;
