// @ts-nocheck

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, serverTimestamp, off } from 'firebase/database';

// Firebase configuration (USE THIS EXACT CONFIG)
const firebaseConfig = {
  apiKey: "AIzaSyDV6qrKInWWQ-w81p6TiZqwEw3kYEBTpR8",
  authDomain: "streakpicks-2a21a.firebaseapp.com",
  databaseURL: "https://streakpicks-2a21a-default-rtdb.firebaseio.com",
  projectId: "streakpicks-2a21a",
  storageBucket: "streakpicks-2a21a.appspot.com",
  messagingSenderId: "472855085588",
  appId: "1:472855085588:web:7c2013e37572864fe29d01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- REAL useWhop Hook for Whop OAuth authentication ---
const useWhop = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [error, setError] = useState(null);
    const [isClient, setIsClient] = useState(false);

    // Fix hydration issues by ensuring we're on the client
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return; // Don't run on server

        const checkAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth/check', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);
                    setIsAuthenticated(true);
                    setHasAccess(true);
                    setError(null);
                } else if (response.status === 401) {
                    setUser(null);
                    setIsAuthenticated(false);
                    setHasAccess(false);
                    setError(null);
                } else {
                    throw new Error(`Authentication check failed: ${response.status}`);
                }
            } catch (err) {
                console.error('Auth check error:', err);
                setError(err instanceof Error ? err : new Error('Authentication failed'));
                setUser(null);
                setIsAuthenticated(false);
                setHasAccess(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuthStatus();
    }, [isClient]);

    if (!isClient) {
        return { user: null, isAuthenticated: false, isLoading: true, hasAccess: false, error: null };
    }

    return { user, isAuthenticated, isLoading, hasAccess, error };
};
// --- END REAL useWhop Hook ---

// --- Imports & Types ---
/**
 * @typedef {'dark' | 'light'} Theme
 */

/**
 * @typedef {Object} WeeklyStats
 * @property {number} picks - Total picks made this week.
 * @property {number} correct - Total correct picks this week.
 * @property {string | null} weekStart - `toDateString()` of the Monday of the current week.
 */

/**
 * @typedef {Object} UserState
 * @property {number} currentStreak - Current consecutive correct picks.
 * @property {number} bestStreak - All-time best consecutive correct picks.
 * @property {number} totalPicks - Total picks made.
 * @property {number} correctPicks - Total correct picks.
 * @property {Object | null} todaysPick - Details of today's pick: { matchupId, selectedTeam, timestamp, date }.
 * @property {string | null} lastPickDate - `toDateString()` of the last date a pick was made.
 * @property {Theme} theme - Current UI theme ('dark' or 'light').
 * @property {boolean} soundEnabled - Is sound enabled?
 * @property {string} displayName - User's display name from Whop account.
 * @property {boolean} isPublic - Whether user data can appear on leaderboard.
 * @property {WeeklyStats} weeklyStats - Stats for the current week.
 */

/**
 * @typedef {Object} Team
 *
 * @property {string} name - Full team name.
 * @property {string} abbr - Team abbreviation.
 * @property {string} logo - Emoji logo for the sport.
 * @property {string[]} colors - Primary and secondary team colors (hex codes).
 */

/**
 * @typedef {Object} Matchup
 * @property {string} id - Unique matchup ID.
 * @property {Team} homeTeam - Home team details.
 * @property {Team} awayTeam - Away Team details.
 * @property {string} sport - Sport type (e.e., 'NBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'NCAAB').
 * @property {string} venue - Venue name.
 * @property {string} startTime - Matchup start time (ISO string).
 * @property {string} status - Current status of the matchup (e.e., 'upcoming').
 */

/**
 * @typedef {Object} Notification
 * @property {string} id - Unique notification ID.
 * @property {string} message - Notification message.
 * @property {'info' | 'success' | 'warning' | 'error'} type - Type of notification.
 * @property {boolean} isRead - Has the user read it?
 * @property {Date} timestamp - When was it created?
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} id - Hashed user ID.
 * @property {string} displayName - Generated anonymous name.
 * @property {number} currentStreak - User's current streak.
 * @property {number} bestStreak - User's best streak.
 * @property {number} totalPicks - User's total picks.
 * @property {number} correctPicks - User's correct picks.
 * @property {number} accuracy - User's accuracy percentage.
 * @property {string} lastActive - ISO string of last active date.
 * @property {number} weeklyWins - This week's correct picks.
 */

/**
 * @typedef {Object} LeaderboardData
 * @property {LeaderboardEntry[]} users - Array of top users.
 * @property {number | null} userRank - Current user's rank.
 * @property {string | null} lastUpdated - ISO string of last update time.
 */


// --- Utility Functions ---

/**
 * Simple string hashing function for consistent anonymous IDs.
 * @param {string | null | undefined} str - Input string.
 * @returns {number} Numeric hash.
 */
const simpleHash = (str) => {
    let hash = 0;
    if (str === null || str === undefined) {
        str = '';
    }
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

/**
 * Gets the ISO string for the Monday of the current week.
 * @returns {string} ISO date string for the start of the week.
 */
const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (make it -6)
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0); // Set to start of the day
    return monday.toISOString();
};

/**
 * Gets the display name from Whop user account
 * @param {Object} user - Whop user object
 * @returns {string} Display name to use
 */
const getDisplayName = (user) => {
    // Always use Whop account information
    return user?.username || user?.name || user?.email?.split('@')[0] || `WhopUser${simpleHash(user?.id || 'anonymous')}`;
};

// MLB Team Colors
const getMLBTeamColors = (abbr) => {
    const teamColors = {
        // American League East
        'BAL': ['DF4601', '000000'], // Orange, Black
        'BOS': ['BD3039', '0C2340'], // Red, Navy
        'NYY': ['132448', 'C4CED4'], // Navy, Silver
        'TB': ['092C5C', '8FBCE6'], // Navy, Light Blue
        'TOR': ['134A8E', 'E8291C'], // Blue, Red
        
        // American League Central
        'CWS': ['000000', 'C4CED4'], // Black, Silver
        'CLE': ['E31937', '0C2340'], // Red, Navy
        'DET': ['0C2340', 'FA4616'], // Navy, Orange
        'KC': ['004687', 'BD9B60'], // Blue, Gold
        'MIN': ['002B5C', 'D31145'], // Navy, Red
        
        // American League West
        'HOU': ['002D62', 'EB6E1F'], // Navy, Orange
        'LAA': ['BA0021', '003263'], // Red, Navy
        'OAK': ['003831', 'EFB21E'], // Green, Gold
        'SEA': ['0C2C56', '005C5C'], // Navy, Teal
        'TEX': ['003278', 'C0111F'], // Blue, Red
        
        // National League East
        'ATL': ['CE1141', '13274F'], // Red, Navy
        'MIA': ['00A3E0', 'EF3340'], // Blue, Red
        'NYM': ['002D72', 'FF5910'], // Blue, Orange
        'PHI': ['E81828', '002D72'], // Red, Blue
        'WSH': ['AB0003', '14225A'], // Red, Navy
        
        // National League Central
        'CHC': ['0E3386', 'CC3433'], // Blue, Red
        'CIN': ['C6011F', '000000'], // Red, Black
        'MIL': ['FFC52F', '12284B'], // Gold, Navy
        'PIT': ['FDB827', '27251F'], // Gold, Black
        'STL': ['C41E3A', '0C2340'], // Red, Navy
        
        // National League West
        'ARI': ['A71930', 'E3D4AD'], // Red, Tan
        'COL': ['33006F', 'C4CED4'], // Purple, Silver
        'LAD': ['005A9C', 'EF3E42'], // Blue, Red
        'SD': ['2F241D', 'FFC425'], // Brown, Gold
        'SF': ['FD5A1E', '27251F']  // Orange, Black
    };
    
    return teamColors[abbr] || ['505050', '808080']; // Default gray colors
};

/**
 * SINGLE SOURCE OF TRUTH - Gets today's MLB game
 * NO FALLBACKS, NO SIMULATIONS, NO EXCEPTIONS
 */
const getTodaysMLBGame = async () => {
    console.log('🎯 SINGLE API CALL - STARTING');
    
    // Use local date for API query
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    console.log('📅 Date Info:', {
        localDate: today,
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currentTime: now.toLocaleString()
    });
    
    const apiUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`;
    
    console.log('📡 Fetching from:', apiUrl);
    
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            console.error(`❌ MLB API returned non-OK response: Status ${response.status}, Text: ${response.statusText}`);
            throw new Error(`MLB API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📥 Raw API response:', data);
        
        // STRICT VALIDATION - NO MERCY
        if (!data?.dates?.[0]?.games?.length) {
            console.error(`❌ No MLB games found for ${today} in API response.`);
            throw new Error(`No MLB games found for ${today}`);
        }
        
        // TAKE FIRST AVAILABLE GAME - PERIOD
        const game = data.dates[0].games[0];
        console.log('🎯 Selected game:', game.teams.home.team.name, 'vs', game.teams.away.team.name);
        
        // RETURN STANDARDIZED FORMAT
        return {
            id: game.gamePk.toString(),
            homeTeam: {
                name: game.teams.home.team.name,
                abbr: game.teams.home.team.abbreviation,
                logo: '⚾',
                colors: getMLBTeamColors(game.teams.home.team.abbreviation) 
            },
            awayTeam: {
                name: game.teams.away.team.name,
                abbr: game.teams.away.team.abbreviation,
                logo: '⚾',
                colors: getMLBTeamColors(game.teams.away.team.abbreviation) 
            },
            sport: 'MLB',
            venue: game.venue?.name || 'MLB Stadium',
            startTime: new Date(game.gameDate).toISOString(),
            status: 'upcoming'
        };
        
    } catch (error) {
        console.error('❌ MLB API FAILED:', error); 
        throw error;
    }
};


/**
 * Fetches actual MLB game result using MLB Official API
 * @param {string} gameId - MLB game ID (gamePk)
 * @param {string} sport - Sport type (should be 'MLB')
 * @returns {Promise<Object|null>} Game result or null
 */
const fetchMLBGameResult = async (gameId, sport) => {
    try {
        console.log(`Fetching MLB game result for game ${gameId}`);
        
        const gameUrl = `https://statsapi.mlb.com/api/v1/game/${gameId}/feed/live`;
        const response = await fetch(gameUrl);
        
        if (!response.ok) {
            throw new Error(`MLB API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if game is completed
        const gameData = data.gameData;
        const liveData = data.liveData;
        
        if (!gameData || !liveData) {
            throw new Error('Invalid game data structure');
        }
        
        const gameStatus = gameData.status.statusCode;
        if (gameStatus !== 'F' && gameStatus !== 'O') { // F = Final, O = Official
            console.log(`Game ${gameId} not finished yet. Status: ${gameData.status.detailedState}`);
            return null;
        }
        
        // Extract final scores
        const homeScore = liveData.linescore?.teams?.home?.runs || 0;
        const awayScore = liveData.linescore?.teams?.away?.runs || 0;
        
        let winner = null;
        if (homeScore > awayScore) {
            winner = 'home';
        } else if (awayScore > homeScore) {
            winner = 'away';
        } else {
            winner = 'tie'; // Very rare in baseball
        }
        
        const homeTeam = gameData.teams.home;
        const awayTeam = gameData.teams.away;
        
        return {
            gameId: gameId,
            status: 'completed',
            homeScore: homeScore,
            awayScore: awayScore,
            winner: winner,
            homeTeam: {
                name: homeTeam.name,
                abbreviation: homeTeam.abbreviation,
                score: homeScore
            },
            awayTeam: {
                name: awayTeam.name,
                abbreviation: awayTeam.abbreviation,
                score: awayScore
            },
            completedAt: new Date(),
            rawGameData: data
        };
        
    } catch (error) {
        console.error(`Error fetching MLB game result for ${gameId}:`, error);
        return null;
    }
};


// --- Custom Hooks ---

/**
 * useLocalStorage hook for persistent state management using window.localStorage.
 * Modified to accept a userId for key personalization.
 * FIXED VERSION - prevents infinite re-render loop
 * @param {string} keyPrefix - The prefix for local storage key (e.e., 'streakPickemUser').
 * @param {any} initialValue - Initial value if nothing in storage.
 * @param {string | null} userId - The user's unique ID from Whop. If null, uses a generic key.
 * @returns {[any, (value: any) => void]} - Value and setter.
 */
const useLocalStorage = (keyPrefix, initialValue, userId) => {
    // Construct a user-specific key, or a generic one if no user ID is available
    const storageKey = userId ? `${keyPrefix}_${userId}` : keyPrefix;

    const [storedValue, setStoredValue] = useState(() => {
        // Check if we're in the browser (client-side)
        if (typeof window === 'undefined') {
            return initialValue;
        }

        try {
            const item = window.localStorage.getItem(storageKey);
            let parsedItem = item ? JSON.parse(item) : initialValue;

            // Handle date-based resets for userState only
            if (keyPrefix === 'streakPickemUser') {
                let updatedParsedItem = { ...parsedItem };
                
                // FORCE consistent date comparison using local date
                const now = new Date();
                const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const storedDate = updatedParsedItem.lastPickDate;
                
                console.log('Date comparison for reset:', { currentDate, storedDate, different: storedDate !== currentDate });

                // Reset todaysPick and update lastPickDate if it's a new day
                if (storedDate !== currentDate) {
                    console.log('🔄 Resetting picks for new day');
                    updatedParsedItem.todaysPick = null;
                    updatedParsedItem.lastPickDate = currentDate;
                }

                // Reset weekly stats if it's a new week
                const currentWeekMonday = getMondayOfCurrentWeek();
                if (!updatedParsedItem.weeklyStats || updatedParsedItem.weeklyStats.weekStart !== currentWeekMonday) {
                    updatedParsedItem.weeklyStats = {
                        picks: 0,
                        correct: 0,
                        weekStart: currentWeekMonday
                    };
                }
                return updatedParsedItem;
            }

            return parsedItem;
        } catch (error) {
            console.error(`Error reading from localStorage for key ${storageKey}`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        // Check if we're in the browser (client-side)
        if (typeof window === 'undefined') {
            return;
        }

        try {
            // ALWAYS use functional update for setStoredValue to get the latest state
            setStoredValue(prevStoredValue => {
                const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
                window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
                return valueToStore;
            });
        } catch (error) {
            console.error(`Error saving to localStorage for key ${storageKey}`, error);
        }
    }, [storageKey]);

    // FIXED: Remove this useEffect that was causing infinite re-renders
    // The original useEffect was re-running every time userId changed and calling setStoredValue,
    // which triggered a re-render, which caused the effect to run again, creating an infinite loop.

    // Instead, we'll handle userId changes differently using a ref to track the previous userId
    const prevUserIdRef = useRef(userId);

    useEffect(() => {
        // Only reload if userId actually changed (not on every render)
        if (prevUserIdRef.current !== userId) {
            prevUserIdRef.current = userId;

            // Only reload state if we're in the browser
            if (typeof window !== 'undefined') {
                try {
                    const newStorageKey = userId ? `${keyPrefix}_${userId}` : keyPrefix;
                    const item = window.localStorage.getItem(newStorageKey);
                    const newValue = item ? JSON.parse(item) : initialValue;
                    setStoredValue(newValue);
                } catch (error) {
                    console.error(`Error reloading state for key ${storageKey} on userId change`, error);
                    setStoredValue(initialValue);
                }
            }
        }
    }, [userId, keyPrefix, initialValue, storageKey]); // Dependencies are stable now

    return [storedValue, setValue];
};

/**
 * useSound hook for basic audio management.
 * @param {boolean} soundEnabled - Whether sound is globally enabled.
 * @returns {{playSound: (soundName: string) => void}}
 */
const useSound = (soundEnabled) => {
    const audioContext = useRef(null);
    const sounds = useRef({});

    useEffect(() => {
        if (!soundEnabled) {
            if (audioContext.current) {
                audioContext.current.close();
                audioContext.current = null;
            }
            return;
        }

        // Initialize AudioContext if not already
        if (typeof window !== 'undefined' && !audioContext.current) {
            try {
                audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('AudioContext not supported:', e);
            }
        }

        // Create a dummy buffer for all sounds instead of fetching actual files
        // This prevents 'Failed to parse URL' errors in environments without direct file access.
        if (audioContext.current) {
            const buffer = audioContext.current.createBuffer(1, audioContext.current.sampleRate * 0.1, audioContext.current.sampleRate);
            sounds.current['pick_select'] = buffer;
            sounds.current['pick_correct'] = buffer;
            sounds.current['pick_wrong'] = buffer;
            sounds.current['achievement_unlock'] = buffer;
            sounds.current['notification'] = buffer;
            sounds.current['button_click'] = buffer; // Generic click sound
        }

        // Cleanup AudioContext on unmount
        return () => {
            if (audioContext.current) {
                audioContext.current.close();
                audioContext.current = null;
            }
        };
    }, [soundEnabled]);

    const playSound = useCallback((soundName) => {
        if (!soundEnabled || !audioContext.current || !sounds.current[soundName]) {
            return;
        }
        try {
            const source = audioContext.current.createBufferSource();
            source.buffer = sounds.current[soundName];
            source.connect(audioContext.current.destination);
            source.start(0);
        } catch (e) {
            console.error(`Error playing sound ${soundName}:`, e);
        }
    }, [soundEnabled]);

    return { playSound };
};


/**
 * useNotifications hook for managing in-app notifications.
 * @returns {{notifications: Notification[], addNotification: (notification: Notification) => void, dismissNotification: (id: string) => void}}
 */
const useNotifications = () => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((newNotification) => {
        const notificationWithId = { ...newNotification, id: newNotification.id || crypto.randomUUID(), timestamp: new Date() };
        setNotifications((prev) => [...prev, notificationWithId]);
        // Auto-dismiss after some time for 'info' and 'success'
        if (newNotification.type === 'info' || newNotification.type === 'success') {
            setTimeout(() => dismissNotification(notificationWithId.id), 5000);
        }
    }, []);

    const dismissNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    return { notifications, addNotification, dismissNotification };
};


/**
 * useFirebaseLeaderboard - REAL global leaderboard using Firebase
 * @param {UserState} userState - Current user's state
 * @param {string} userId - Whop user ID
 * @returns {{leaderboardData: LeaderboardData, updateLeaderboard: function, refreshLeaderboard: function}}
 */
const useFirebaseLeaderboard = (userState, userId) => {
    const [leaderboardData, setLeaderboardData] = useState({
        users: [],
        userRank: null,
        lastUpdated: null
    });

    const leaderboardRef = ref(database, 'leaderboard');
    const isListening = useRef(false);

    // Real-time listener for leaderboard updates
    useEffect(() => {
        if (isListening.current) return; // Prevent duplicate listeners
        
        console.log('Setting up Firebase leaderboard listener...');
        isListening.current = true;

        const unsubscribe = onValue(leaderboardRef, (snapshot) => {
            try {
                const data = snapshot.val();
                console.log('Firebase data received:', data ? Object.keys(data).length : 0, 'users');

                if (data) {
                    // Convert Firebase object to array and sort
                    const usersArray = Object.values(data).map(user => ({
                        ...user,
                        lastActive: user.lastActive || new Date().toISOString()
                    }));

                    // Sort by current streak, then by best streak
                    usersArray.sort((a, b) => {
                        if (b.currentStreak !== a.currentStreak) {
                            return b.currentStreak - a.currentStreak;
                        }
                        return b.bestStreak - a.bestStreak;
                    });

                    // Calculate current user's rank
                    const userHashId = simpleHash(userId).toString();
                    const userRank = usersArray.findIndex(user => user.id === userHashId) + 1;

                    setLeaderboardData({
                        users: usersArray.slice(0, 50), // Top 50 for display
                        userRank: userRank || null,
                        lastUpdated: new Date().toISOString()
                    });

                    console.log(`Leaderboard updated: ${usersArray.length} users, your rank: ${userRank || 'unranked'}`);
                } else {
                    // No data in Firebase yet
                    setLeaderboardData({
                        users: [],
                        userRank: null,
                        lastUpdated: new Date().toISOString()
                    });
                    console.log('Empty leaderboard - be the first to compete!');
                }
            } catch (error) {
                console.error('Error processing Firebase leaderboard data:', error);
            }
        }, (error) => {
            console.error('Firebase listener error:', error);
        });

        // Cleanup listener on unmount
        return () => {
            console.log('Cleaning up Firebase leaderboard listener');
            unsubscribe();
            isListening.current = false;
        };
    }, [userId]);

    const updateLeaderboard = useCallback(async () => {
        // Don't update if user data isn't ready
        if (!userState.displayName || userState.displayName === 'AnonymousPicker') {
            return;
        }

        const currentUserEntry = {
            id: simpleHash(userId).toString(),
            whopUserId: userId, // Store actual Whop user ID for reference
            displayName: userState.displayName,
            currentStreak: userState.currentStreak,
            bestStreak: userState.bestStreak,
            totalPicks: userState.totalPicks,
            correctPicks: userState.correctPicks,
            accuracy: userState.totalPicks > 0 ? Math.round((userState.correctPicks / userState.totalPicks) * 100) : 0,
            weeklyWins: userState.weeklyStats?.correct || 0,
            lastActive: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        try {
            // Update user's data in Firebase
            const userRef = ref(database, `leaderboard/${currentUserEntry.id}`);
            await set(userRef, currentUserEntry);
            
            console.log(`Updated Firebase leaderboard for ${currentUserEntry.displayName}:`, {
                streak: currentUserEntry.currentStreak,
                totalPicks: currentUserEntry.totalPicks,
                accuracy: currentUserEntry.accuracy
            });

        } catch (error) {
            console.error('Error updating Firebase leaderboard:', error);
        }
    }, [userState, userId]);

    const refreshLeaderboard = useCallback(async () => {
        // Firebase automatically refreshes via real-time listener
        // This is just for UI consistency
        console.log('Leaderboard refresh requested (auto-synced via Firebase)');
        return Promise.resolve();
    }, []);

    return {
        leaderboardData,
        updateLeaderboard,
        refreshLeaderboard
    };
};


// --- Data Generation & Constants ---

const initialUserState = {
    currentStreak: 0,
    bestStreak: 0,
    totalPicks: 0,
    correctPicks: 0,
    todaysPick: null, // { matchupId, selectedTeam, timestamp, date }
    lastPickDate: null,
    theme: 'dark',
    soundEnabled: true,
    displayName: 'WhopUser', // Will be set from Whop account
    isPublic: true,
    weeklyStats: {
        picks: 0,
        correct: 0,
        weekStart: null // Will be set to Monday of current week
    }
};


// --- Share Utilities ---

/**
 * Generates viral share text based on user context
 * @param {Object} userState - Current user state
 * @param {Object} todaysMatchup - Today's matchup (optional)
 * @param {string} shareType - Type of share ('streak', 'pick', 'achievement', 'challenge')
 * @returns {string} Formatted share text
 */
const generateShareText = (userState, todaysMatchup = null, shareType = 'streak') => {
    const appUrl = window.location.origin; // Gets current domain
    const streakEmoji = userState.currentStreak >= 10 ? '🔥' : userState.currentStreak >= 5 ? '⚡' : '🎯';

    switch (shareType) {
        case 'streak':
            if (userState.currentStreak === 0) {
                return `Just started my streak on Streak Pick'em! 🎯\n\nWho can predict sports better than me? 💪\n\nTry it: ${appUrl}`;
            } else if (userState.currentStreak < 5) {
                return `${userState.currentStreak}-day streak and counting! ${streakEmoji}\n\nThink you can do better? Prove it 👀\n\nStreak Pick'em: ${appUrl}`;
            } else { // >=5 streak
                return `🔥 ${userState.currentStreak}-day streak! I'm on fire! ${streakEmoji}\n\nCan anyone beat this? Challenge accepted? 😏\n\nStreak Pick'em: ${appUrl}`;
            }

        case 'pick':
            if (!todaysMatchup || !userState.todaysPick) return generateShareText(userState, null, 'streak'); // Fallback if no pick made
            const pickedTeam = userState.todaysPick.selectedTeam === 'home' ? todaysMatchup.homeTeam.name : todaysMatchup.awayTeam.name;
            return `Today's pick: ${todaysMatchup.homeTeam.name} vs ${todaysMatchup.awayTeam.name} ${todaysMatchup.homeTeam.logo}\n\nI'm going with ${pickedTeam}! 🤔\n\nCurrent streak: ${userState.currentStreak} ${streakEmoji}\n\nJoin me: ${appUrl}`;

        case 'achievement':
            const milestones = {
                5: "🎉 5-DAY STREAK UNLOCKED! 🎉",
                10: "🔥 DOUBLE DIGITS! 10-DAY STREAK! 🔥",
                15: "⚡ 15 DAYS OF PURE FIRE! ⚡",
                20: "🚨 20-DAY STREAK ALERT! 🚨",
                25: "👑 QUARTER CENTURY! 25 DAYS! 👑",
                30: "🏆 30 DAYS OF DOMINATION! 🏆"
            };

            const milestoneText = milestones[userState.currentStreak] || `🔥 ${userState.currentStreak}-DAY STREAK! 🔥`;
            return `${milestoneText}\n\nI'm absolutely crushing it on Streak Pick'em! 💪\n\nWho wants to challenge the champion? 😎\n\n${appUrl}`;

        case 'challenge':
            return `🏆 I just hit ${userState.currentStreak} days on Streak Pick'em!\n\nBet you can't beat my streak 😏\n\nProve me wrong: ${appUrl}`;

        default:
            return generateShareText(userState, todaysMatchup, 'streak');
    }
};

/**
 * Handles native sharing with fallbacks
 * @param {string} text - Text to share
 * @param {string} url - URL to share (optional)
 * @param {string} title - Share title (optional)
 * @returns {Promise<boolean>} Success status
 */
const handleNativeShare = async (text, url = '', title = 'Streak Pick\'em') => {
    // Check if native sharing is available (mobile browsers)
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text,
                url: url
            });
            return true;
        } catch (error) {
            // User cancelled or error occurred
            console.log('Native share cancelled or failed:', error);
            return false;
        }
    }

    // Fallback: Copy to clipboard
    try {
        const fullText = url ? `${text}\n\n${url}` : text;
        document.execCommand('copy', false, fullText); // Use document.execCommand for broader compatibility in iframes
        return true;
    } catch (error) {
        console.error('Clipboard access failed:', error);
        return false;
    }
};

/**
 * Platform-specific sharing functions
 */
const shareToTwitter = (text, url = '') => {
    const tweetText = encodeURIComponent(text);
    const shareUrl = url ? `&url=${encodeURIComponent(url)}` : '';
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}${shareUrl}`, '_blank');
};

const shareToInstagram = (text) => {
    // Instagram doesn't have direct URL sharing for posts, but we can copy text for stories/paste
    document.execCommand('copy', false, text);
    // Could attempt to open Instagram app if on mobile
    if (/Instagram|iPhone|iPad|Android/i.test(navigator.userAgent)) {
        window.open('instagram://story-camera', '_blank'); // Tries to open story camera
    }
};

const shareToGeneric = async (text, url = '') => {
    const fullText = url ? `${text}\n\n${url}` : text;
    try {
        document.execCommand('copy', false, fullText);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard for generic share:', error);
        return false;
    }
};

// --- Share Components ---

/**
 * ShareButton - Main share trigger button
 * @param {Object} props
 * @param {Object} props.userState - Current user state
 * @param {Object} props.todaysMatchup - Today's matchup
 * @param {string} props.shareType - Type of share
 * @param {function} props.onShare - Callback after sharing
 * @param {string} props.className - Custom styling
 * @param {React.ReactNode} props.children - Button content
 */
const ShareButton = ({ userState, todaysMatchup, shareType = 'streak', onShare, className = '', children }) => {
    const [sharing, setSharing] = useState(false);

    const handleShare = async () => {
        setSharing(true);

        try {
            const shareText = generateShareText(userState, todaysMatchup, shareType);
            const success = await handleNativeShare(shareText, window.location.origin);

            if (success) {
                onShare && onShare(shareType, 'native');
            }
        } catch (error) {
            console.error('Share failed:', error);
        } finally {
            setSharing(false);
        }
    };

    return (
        <button
            onClick={handleShare}
            disabled={sharing}
            className={`${className} ${sharing ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Share your streak"
        >
            {sharing ? '📤 Sharing...' : children}
        </button>
    );
};

/**
 * ShareModal - Advanced sharing options
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {function} props.onClose - Close modal callback
 * @param {Object} props.userState - Current user state
 * @param {Object} props.todaysMatchup - Today's matchup
 * @param {function} props.onShare - Share callback
 * @param {function} props.addNotification - Function to add a notification
 */
const ShareModal = ({ isOpen, onClose, userState, todaysMatchup, onShare, addNotification }) => {
    if (!isOpen) return null;

    const [shareType, setShareType] = useState('streak');
    const [copySuccess, setCopySuccess] = useState(false);

    const shareText = generateShareText(userState, todaysMatchup, shareType);

    const handlePlatformShare = async (platform) => {
        const url = window.location.origin;
        let success = false;

        switch (platform) {
            case 'twitter':
                shareToTwitter(shareText, url);
                success = true;
                break;
            case 'instagram':
                shareToInstagram(shareText);
                addNotification({type: 'info', message: 'Text copied! Paste into Instagram.'});
                success = true;
                break;
            case 'copy':
                success = await shareToGeneric(shareText, url);
                if (success) {
                    setCopySuccess(true);
                    addNotification({type: 'success', message: 'Text copied to clipboard!'});
                    setTimeout(() => setCopySuccess(false), 2000);
                } else {
                    addNotification({type: 'error', message: 'Failed to copy text.'});
                }
                break;
            case 'native':
                success = await handleNativeShare(shareText, url);
                break;
            default:
                success = false;
        }

        if (success) {
            onShare && onShare(shareType, platform);
        }
        if (platform !== 'instagram' && platform !== 'copy') {
             onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div className="bg-bg-secondary rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-bg-tertiary relative animate-fadeInUp">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-text-primary">Share Your Streak! 🔥</h3>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text-primary text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-tertiary transition-colors"
                        aria-label="Close share modal"
                    >
                        ×
                    </button>
                </div>

                {/* Share Type Selector */}
                <div className="mb-4">
                    <label htmlFor="share-type" className="block text-text-primary text-sm font-medium mb-2">
                        What to share:
                    </label>
                    <select
                        id="share-type"
                        value={shareType}
                        onChange={(e) => setShareType(e.target.value)}
                        className="w-full p-3 bg-bg-tertiary text-text-primary rounded-xl border-2 border-bg-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                        <option value="streak">My Current Streak</option>
                        <option value="pick">Today's Pick</option>
                        {userState.currentStreak >= 5 && <option value="achievement">Achievement Unlocked!</option>}
                        <option value="challenge">Challenge Friends</option>
                    </select>
                </div>

                {/* Preview Text */}
                <div className="mb-6 p-4 bg-bg-tertiary rounded-xl border-2 border-bg-tertiary">
                    <p className="text-text-secondary text-sm font-medium mb-2">Preview:</p>
                    <p className="text-text-primary text-sm whitespace-pre-line break-words leading-relaxed">
                        {shareText}
                    </p>
                </div>

                {/* Platform Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                        onClick={() => handlePlatformShare('twitter')}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-blue-600"
                        aria-label="Share to Twitter"
                    >
                        🐦 Twitter
                    </button>
                    <button
                        onClick={() => handlePlatformShare('instagram')}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-purple-600"
                        aria-label="Share to Instagram"
                    >
                        📸 Instagram
                    </button>
                    <button
                        onClick={() => handlePlatformShare('copy')}
                        className={`${
                            copySuccess
                                ? 'bg-green-600 border-green-700'
                                : 'bg-gray-600 border-gray-700'
                        } hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2`}
                        aria-label="Copy text to clipboard"
                    >
                        {copySuccess ? '✅ Copied!' : '📋 Copy Text'}
                    </button>
                    <button
                        onClick={() => handlePlatformShare('native')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-indigo-700"
                        aria-label="Share via more apps"
                    >
                        📤 More Apps
                    </button>
                </div>

                {/* Footer Note */}
                <p className="text-center text-text-secondary text-xs">
                    Help grow Streak Pick'em! 🚀
                </p>
            </div>
        </div>
    );
};

/**
 * RankBadge Component
 * @param {Object} props
 * @param {number | null} props.rank - The user's rank.
 * @param {number} props.streak - The user's current streak (for pulsing).
 * @param {string} [props.className] - Additional CSS classes.
 */
const RankBadge = ({ rank, streak, className }) => {
    if (rank === null || rank === 0) return null; // Don't show badge if rank is unknown or 0

    let badgeClass = '';
    if (rank <= 10) {
        badgeClass = 'top-10';
    } else if (rank <= 50) {
        badgeClass = 'top-50';
    } else if (rank <= 100) {
        badgeClass = 'top-100';
    } else {
        badgeClass = 'standard'; // Default for ranks > 100
    }

    return (
        <div className={`rank-badge ${badgeClass} ${className}`}>
            Rank: {rank}
        </div>
    );
};

/**
 * AnimatedStreakDisplay Component
 * @param {Object} props
 * @param {number} props.currentStreak - The current streak value.
 * @param {number} props.bestStreak - The best streak value.
 * @param {boolean} props.isIncreasing - True if the streak is currently increasing (for animation).
 */
const AnimatedStreakDisplay = ({ currentStreak, bestStreak, isIncreasing }) => {
    const [displayStreak, setDisplayStreak] = useState(currentStreak);
    const prevStreakRef = useRef(currentStreak);

    useEffect(() => {
        if (isIncreasing) {
            // Animate number counting up
            let start = prevStreakRef.current; // Start from previous streak
            let end = currentStreak;

            // Only animate if the current streak is actually higher than previous
            if (end > start) {
                let current = start;
                const timer = setInterval(() => {
                    current += 1;
                    setDisplayStreak(current);
                    if (current >= end) {
                        clearInterval(timer);
                    }
                }, 100); // Adjust interval for speed of counting
                return () => clearInterval(timer);
            }
        }
        // If not increasing or streak decreased, just set the value
        setDisplayStreak(currentStreak);
        prevStreakRef.current = currentStreak; // Update ref for next render
    }, [currentStreak, isIncreasing]);

    useEffect(() => {
        // Update prevStreakRef when currentStreak changes,
        // but not *during* the animation triggered by isIncreasing.
        // This ensures the animation starts from the correct previous value.
        if (!isIncreasing) {
            prevStreakRef.current = currentStreak;
        }
    }, [currentStreak, isIncreasing]);

    return (
        <div className="streak-display-container">
            <div className={`streak-number ${isIncreasing ? 'celebrating' : ''}`}>
                {displayStreak}
                <span className="streak-flame">🔥</span>
            </div>
            <p className="streak-label">Current Streak</p>
            <p className="best-streak">Best: {bestStreak}</p>
        </div>
    );
};

/**
 * EnhancedTeamCard Component
 * @param {Object} props
 * @param {Team} props.team - Team data.
 * @param {boolean} props.isSelected - Whether this team is currently selected (for UI highlight).
 * @param {boolean} props.isPicked - Whether this team was the user's pick for today.
 * @param {function} props.onClick - Click handler for the card.
 * @param {boolean} props.disabled - Whether the card is disabled.
 */
const EnhancedTeamCard = ({ team, isSelected, isPicked, onClick, disabled }) => {
    const [primaryColor, secondaryColor] = team.colors;

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`team-card ${isSelected ? 'selected' : ''} ${isPicked ? 'picked' : ''} ${disabled ? 'disabled' : ''}`}
            style={{
                '--team-primary': `#${primaryColor}`,
                '--team-secondary': `#${secondaryColor}`,
            }}
        >
            <div className="text-5xl mb-2 team-logo">
                {team.logo}
            </div>
            <div className="font-bold text-lg text-text-primary mb-1 team-abbr">
                {team.abbr}
            </div>
            <div className="text-sm text-text-secondary team-name-full">
                {team.name}
            </div>

            {/* ✅ ENHANCED Color accent bar with REAL team colors */}
            <div
                className="color-accent"
                style={{
                    background: `linear-gradient(90deg, #${primaryColor}, #${secondaryColor})`,
                    height: '4px',
                    width: '100%',
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    borderRadius: '0 0 var(--radius-xl) var(--radius-xl)'
                }}
            />
        </button>
    );
};

/**
 * LeaderboardEntry component for a single row in the leaderboard.
 * @param {Object} props
 * @param {LeaderboardEntry} props.entry - The leaderboard entry data.
 * @param {boolean} props.isCurrentUser - Whether this entry belongs to the current user.
 * @param {number} props.rank - The rank number.
 * @param {'current' | 'best' | 'weekly'} props.sortBy - The current sorting criterion.
 */
const LeaderboardEntry = ({ entry, isCurrentUser, rank, sortBy }) => {
    return (
        <div className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`}>
            <span className="w-10 font-bold text-lg text-text-primary">{rank}.</span>
            <span className="flex-1 font-semibold text-text-primary truncate">{entry.displayName}</span>
            <div className="w-24 text-right">
                {sortBy === 'current' && <span className="text-accent-win font-bold">{entry.currentStreak} 🔥</span>}
                {sortBy === 'best' && <span className="text-purple-400 font-bold">{entry.bestStreak} 🏆</span>}
                {sortBy === 'weekly' && <span className="text-blue-400 font-bold">{entry.weeklyWins} ✅</span>}
                <span className="text-sm text-text-secondary ml-2">({entry.accuracy}%)</span>
            </div>
        </div>
    );
};


/**
 * LeaderboardModal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility.
 * @param {function} props.onClose - Close modal callback.
 * @param {UserState} props.userState - Current user's state.
 * @param {LeaderboardData} props.leaderboardData - Global leaderboard data.
 * @param {function} props.onRefreshLeaderboard - Callback to refresh leaderboard.
 * @param {string} props.userId - The current user's ID for comparison.
 */
const LeaderboardModal = ({ isOpen, onClose, userState, leaderboardData, onRefreshLeaderboard, userId }) => {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('current'); // 'current', 'best', 'weekly'
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingRefresh, setIsLoadingRefresh] = useState(false);

    // Filter and sort users based on active tab and search term
    const sortedUsers = useMemo(() => {
        let users = [...leaderboardData.users];

        // Filter by search term
        if (searchTerm) {
            users = users.filter(user =>
                user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort based on active tab
        users.sort((a, b) => {
            if (activeTab === 'current') {
                if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
                return b.bestStreak - a.bestStreak; // Secondary sort
            } else if (activeTab === 'best') {
                if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
                return b.currentStreak - a.currentStreak; // Secondary sort
            } else { // 'weekly'
                if (b.weeklyWins !== a.weeklyWins) return b.weeklyWins - a.weeklyWins;
                return b.accuracy - a.accuracy; // Secondary sort
            }
        });
        return users;
    }, [leaderboardData.users, activeTab, searchTerm]);

    const handleRefresh = async () => {
        setIsLoadingRefresh(true);
        await onRefreshLeaderboard(); // Call the passed refresh function
        setIsLoadingRefresh(false);
    };

    const hashedCurrentUserId = simpleHash(userId).toString();

    return (
        <div className="leaderboard-modal animate-fadeInUp">
            <div className="leaderboard-content bg-bg-secondary text-text-primary">
                {/* Header */}
                <div className="p-4 border-b-2 border-bg-tertiary flex justify-between items-center">
                    <h3 className="text-2xl font-bold">Leaderboard</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className="p-2 rounded-full hover:bg-bg-tertiary transition-colors"
                            disabled={isLoadingRefresh}
                            aria-label="Refresh leaderboard"
                        >
                            {isLoadingRefresh ? (
                                <svg className="animate-spin h-5 w-5 text-text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : '🔄'}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Close leaderboard modal"
                        >
                            &times;
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="leaderboard-tabs text-text-secondary font-semibold">
                    <button
                        className={`leaderboard-tab ${activeTab === 'current' ? 'active bg-accent-info text-white rounded-tl-xl' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setActiveTab('current')}
                    >
                        Current Streak
                    </button>
                    <button
                        className={`leaderboard-tab ${activeTab === 'best' ? 'active bg-accent-info text-white' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setActiveTab('best')}
                    >
                        Best Streak
                    </button>
                    <button
                        className={`leaderboard-tab ${activeTab === 'weekly' ? 'active bg-accent-info text-white rounded-tr-xl' : 'hover:bg-bg-tertiary'}`}
                        onClick={() => setActiveTab('weekly')}
                    >
                        Weekly Wins
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b-2 border-bg-tertiary">
                    <input
                        type="text"
                        placeholder="Search by name..."
                        className="w-full p-2 rounded-lg bg-bg-tertiary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-info"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Leaderboard List */}
                <div className="py-2">
                    {sortedUsers.length > 0 ? (
                        sortedUsers.map((entry, index) => (
                            <LeaderboardEntry
                                key={entry.id}
                                entry={entry}
                                isCurrentUser={entry.id === hashedCurrentUserId} // Compare with hashed user ID from prop
                                rank={index + 1}
                                sortBy={activeTab}
                            />
                        ))
                    ) : (
                        <p className="text-center text-text-secondary p-4">No users found.</p>
                    )}
                </div>

                {/* Current User's Rank (if not in top 50 displayed) */}
                {leaderboardData.userRank && (leaderboardData.userRank > sortedUsers.length || searchTerm) && (
                    <div className="p-4 border-t-2 border-bg-tertiary">
                        <p className="text-center text-text-secondary">
                            Your Rank: <span className="font-bold text-accent-info">{leaderboardData.userRank}</span>
                            {activeTab === 'current' && ` (Streak: ${userState.currentStreak})`}
                            {activeTab === 'best' && ` (Best: ${userState.bestStreak})`}
                            {activeTab === 'weekly' && ` (Weekly Wins: ${userState.weeklyStats.correct})`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * LeaderboardPreview Component
 * @param {Object} props
 * @param {LeaderboardData} props.leaderboardData - Global leaderboard data.
 * @param {UserState} props.userState - Current user's state.
 * @param {function} props.onOpenFull - Callback to open the full leaderboard modal.
 * @param {number} props.userCount - Total count of users on the leaderboard.
 */
const LeaderboardPreview = ({ leaderboardData, userState, onOpenFull, userCount }) => {
    const top3 = leaderboardData.users.slice(0, 3);
    const userRank = leaderboardData.userRank;

    return (
        <div className="bg-bg-secondary rounded-xl p-4 shadow-lg border border-bg-tertiary animate-fadeInUp">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-bold text-text-primary">Leaderboard Preview</h4>
                <button
                    onClick={onOpenFull}
                    className="text-accent-info hover:text-blue-500 font-semibold text-sm transition-colors"
                >
                    View Full 🏆
                </button>
            </div>

            {/* Leaderboard Status - Real User Indicator */}
            <LeaderboardStatus userCount={userCount} />

            {top3.length > 0 ? (
                <div className="space-y-2 mb-3">
                    {top3.map((entry, index) => (
                        <div key={entry.id} className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-text-primary">{index + 1}. {entry.displayName}</span>
                            <span className="text-accent-win font-bold">{entry.currentStreak} 🔥</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-text-secondary text-sm mb-3">Leaderboard is empty. Be the first!</p>
            )}

            {userRank && (
                <div className="text-center text-text-secondary text-sm pt-2 border-t border-bg-tertiary">
                    Your Rank: <span className="font-bold text-accent-info">{userRank}</span> (Streak: {userState.currentStreak})
                </div>
            )}
        </div>
    );
};

/**
 * LeaderboardStatus - Component to show count of real users competing.
 * @param {Object} props
 * @param {number} props.userCount - Total count of users on the leaderboard.
 */
const LeaderboardStatus = ({ userCount }) => {
    if (userCount === 0) {
        return (
            <div className="text-center text-sm text-text-secondary mb-2">
                🎯 Be the first to start the competition!
            </div>
        );
    }

    return (
        <div className="text-center text-sm text-accent-info mb-2">
            🌍 {userCount} real {userCount === 1 ? 'player' : 'players'} competing globally!
        </div>
    );
};

// --- Error Boundary Component (as conceptual placeholder per prompt) ---
// In a real Next.js app, you'd use a file-based error.js or client-side error boundaries.
// This is a simplified version to match the prompt's structural request.
class ErrorBoundaryComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.props.onError(error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

const ErrorDisplay = ({ message }) => (
    <div className="min-h-screen bg-red-800 text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl font-bold mb-4">An Error Occurred!</h2>
        <p className="text-lg text-center mb-6">{message || "Something went wrong. Please try refreshing."}</p>
        <button
            onClick={() => window.location.reload()}
            className="bg-white text-red-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors"
        >
            Reload Page
        </button>
    </div>
);


// ========== GAMETIMEDISPLAY WITH ENHANCED DEBUGGING ==========
/**
 * Enhanced GameTimeDisplay with detailed mobile debugging
 */
const EnhancedGameTimeDisplay = ({ startTime, setTimeLeft, matchupId, setGameStarted }) => {
    const [gameTime, setGameTime] = useState(null);
    const [error, setError] = useState(null);
    // Removed debugInfo state as platform-specific info is no longer desired in logs
    // [debugInfo, setDebugInfo] = useState({});

    useEffect(() => {
        if (!startTime) {
            setTimeLeft('No start time');
            setError('No start time provided');
            return;
        }

        // Ensured robust date parsing
        let parsedTime = null;
        // Removed debugSteps as platform-specific info is no longer desired in logs
        // const debugSteps = [];

        try {
            parsedTime = new Date(startTime);
            if (isNaN(parsedTime.getTime())) {
                throw new Error('Invalid date');
            }
            // Removed debugSteps logging
            // debugSteps.push(`Parsed "${startTime}" to Date`);
            // debugSteps.push(`Valid date: ${parsedTime.toISOString()}`);
            // debugSteps.push(`Local display: ${parsedTime.toLocaleString()}`);
            
            setGameTime(parsedTime);
            setError(null);
            // setDebugInfo({ steps: debugSteps, success: true });
            

        } catch (parseError) {
            console.error('Timer: Date parsing failed:', parseError);
            const fallbackTime = new Date(Date.now() + 60 * 60 * 1000);
            setGameTime(fallbackTime);
            setError(`Parse failed: ${parseError.message}`);
            // setDebugInfo({ steps: debugSteps, error: parseError.message });
        }
    }, [startTime, matchupId]);

    // Enhanced timer logic with debugging
    useEffect(() => {
        if (!gameTime) return;

        let isActive = true;

        const updateTimer = () => {
            if (!isActive) return;

            const now = new Date();
            const diff = gameTime - now;

            if (diff <= 0) {
                setGameStarted(true); // Now correctly uses the prop
                setTimeLeft('Game Started');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const timeString = `${hours}h ${minutes}m ${seconds}s`;
            setTimeLeft(timeString);
            
        };

        updateTimer(); // Initial call
        const intervalId = setInterval(updateTimer, 1000);

        return () => {
            isActive = false;
            clearInterval(intervalId);
        };
    }, [gameTime, setTimeLeft, setGameStarted]); // Added setGameStarted to dependencies

    if (!gameTime) {
        return (
            <div className="text-yellow-500">
                ⏰ Loading game time...
                {error && <div className="text-xs text-red-500">Error: {error}</div>}
            </div>
        );
    }

    return (
        <div className="game-time-display">
            <p className="timer-text text-sm text-text-secondary">
                Game Time: {gameTime.toLocaleString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    timeZoneName: 'short' 
                })}
            </p>
            {error && (
                <p className="text-xs text-yellow-500 mt-1">⚠️ {error}</p>
            )}
        </div>
    );
};


// ========== APP COMPONENT WITH FIXES ==========
/**
 * Modified App component with comprehensive debugging
 */
const App = ({ user }) => {
    const userId = user?.id || 'anonymous';
    const [userState, setUserState] = useLocalStorage('streakPickemUser', initialUserState, userId);
    
    // Share analytics state
    // Converted to use useState with direct localStorage read/write for simplification.
    const [shareStats, setShareStats] = useState(() => {
        if (typeof window === 'undefined') return { totalShares: 0, sharesByType: {}, sharesByPlatform: {}, lastShared: null };
        try {
            const stored = window.localStorage.getItem(`shareStats_${userId}`);
            return stored ? JSON.parse(stored) : { totalShares: 0, sharesByType: {}, sharesByPlatform: {}, lastShared: null };
        } catch (error) {
            console.error('Error reading shareStats from localStorage:', error);
            return { totalShares: 0, sharesByType: {}, sharesByPlatform: {}, lastShared: null };
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(`shareStats_${userId}`, JSON.stringify(shareStats));
        }
    }, [shareStats, userId]);

    // Game results history storage
    // Converted to use useState with direct localStorage read/write for simplification.
    const [gameResults, setGameResults] = useState(() => {
        if (typeof window === 'undefined') return [];
        try {
            const stored = window.localStorage.getItem(`gameResults_${userId}`);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading gameResults from localStorage:', error);
            return [];
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(`gameResults_${userId}`, JSON.stringify(gameResults));
        }
    }, [gameResults, userId]);


    // Leaderboard data - NOW USING REAL Firebase LEADERBOARD HOOK
    const { leaderboardData, updateLeaderboard, refreshLeaderboard } = useFirebaseLeaderboard(userState, userId);


    const { playSound } = useSound(userState.soundEnabled);
    const { addNotification, notifications, dismissNotification } = useNotifications();

    // Use local date for comparison
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentWeekMonday = getMondayOfCurrentWeek(); // This remains UTC based, which is fine for week start


    const [todaysMatchup, setTodaysMatchup] = useState(null);
    const [matchupLoading, setMatchupLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false); // NEW: To signal initial data load complete
    const [showShareModal, setShowShareModal] = useState(false); // State for share modal visibility
    const [showLeaderboard, setShowLeaderboard] = useState(false); // State for leaderboard modal visibility
    const [isStreakIncreasing, setIsStreakIncreasing] = useState(false); // For streak animation
    const [timeLeft, setTimeLeft] = useState('');
    const [gameStarted, setGameStarted] = useState(false); // New state for game started


    // Initialize userState displayName and weeklyStats on first load or user change
    useEffect(() => {
        setUserState(prev => {
            const updatedState = { ...prev };
            let needsUpdate = false;

            // Update display name from Whop account
            const newDisplayName = getDisplayName(user);
            if (prev.displayName !== newDisplayName) {
                updatedState.displayName = newDisplayName;
                needsUpdate = true;
            }

            // Initialize weekly stats if needed
            if (!prev.weeklyStats || prev.weeklyStats.weekStart !== currentWeekMonday) {
                updatedState.weeklyStats = {
                    picks: 0,
                    correct: 0,
                    weekStart: currentWeekMonday
                };
                needsUpdate = true;
            }

            return needsUpdate ? updatedState : prev;
        });
    }, [user, currentWeekMonday, setUserState]);

    // Load today's matchup - SINGLE PATH ONLY
    useEffect(() => {
        const loadTodaysGame = async () => {
            console.log('🎮 LOADING GAME - SINGLE PATH');
            setMatchupLoading(true);
            
            try {
                const game = await getTodaysMLBGame();
                setTodaysMatchup(game);
                setIsInitialized(true);
                console.log('✅ GAME LOADED SUCCESSFULLY:', game.homeTeam.name, 'vs', game.awayTeam.name);
                
            } catch (error) {
                console.error('❌ GAME LOADING FAILED:', error.message);
                setTodaysMatchup(null); // NULL = NO GAME, SHOW ERROR
                setIsInitialized(true);
            }
            
            setMatchupLoading(false);
        };
        
        loadTodaysGame();
    }, []); // NO DEPENDENCIES - LOAD ONCE


    // Determine if user has picked today (only if todaysMatchup is available)
    const hasPickedToday = todaysMatchup && userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.date === today;

    // Game timer state
    useEffect(() => {
        if (!todaysMatchup?.startTime) {
            setTimeLeft('No game time');
            return;
        }
        
        // FORCE consistent parsing
        let gameTime;
        try {
            gameTime = new Date(todaysMatchup.startTime);
            if (isNaN(gameTime.getTime())) {
                throw new Error('Invalid date');
            }
        } catch (error) {
            console.error('Timer: Date parsing failed:', error);
            setTimeLeft('Invalid game time');
            return;
        }
        
        const updateTimer = () => {
            const now = new Date();
            const diff = gameTime - now;
            
            if (diff <= 0) {
                setGameStarted(true);
                setTimeLeft('Game Started');
                return;
            }
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            } else {
                setTimeLeft(`${minutes}m ${seconds}s`);
            }
        };
        
        updateTimer(); // Initial call
        const interval = setInterval(updateTimer, 1000);
        
        return () => clearInterval(interval);
    }, [todaysMatchup?.startTime, setTimeLeft, setGameStarted]);


    /**
     * Checks the actual result of a user's pick (REPLACES simulateResult)
     * @param {Object} pick - The user's pick object
     * @param {Matchup} matchup - The matchup details
     * @param {number} attempt - Current retry attempt count
     */
    const checkRealResult = useCallback(async (pick, matchup, attempt = 1) => {
        const MAX_ATTEMPTS = 3; // Retry up to 3 times
        const RETRY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour between retries

        // Estimate game duration (sport-specific)
        const gameDurations = {
            'MLB': 3 * 60 * 60 * 1000,    // 3 hours
            'NBA': 2.5 * 60 * 60 * 1000,  // 2.5 hours
            'NFL': 3.5 * 60 * 60 * 1000,  // 3.5 hours
            'NHL': 2.5 * 60 * 60 * 1000,  // 2.5 hours
            'Soccer': 2 * 60 * 60 * 1000, // 2 hours
            'NCAAB': 2 * 60 * 60 * 1000 // 2 hours
        };

        const estimatedGameDuration = gameDurations[matchup.sport] || 3 * 60 * 60 * 1000;
        const estimatedEndTime = new Date(new Date(matchup.startTime).getTime() + estimatedGameDuration);

        // Calculate delay: check 30 minutes after estimated end time (minimum 5 seconds for first check)
        const now = new Date();
        const checkTime = new Date(estimatedEndTime.getTime() + 30 * 60 * 1000);
        const initialDelayMs = Math.max(checkTime.getTime() - now.getTime(), 5000);

        // Use initialDelayMs for the first attempt, then RETRY_INTERVAL_MS for subsequent
        const delayForThisAttempt = attempt === 1 ? initialDelayMs : RETRY_INTERVAL_MS;

        console.log(`Will check result for ${matchup.homeTeam.abbr} vs ${matchup.awayTeam.abbr} (Attempt ${attempt}) in ${Math.round(delayForThisAttempt / 1000 / 60)} minutes.`);

        setTimeout(async () => {
            try {
                console.log(`Checking result for game ${pick.matchupId} (Attempt ${attempt})...`);

                let gameResult = await fetchMLBGameResult(pick.matchupId, matchup.sport); 

                if (!gameResult) {
                    if (attempt < MAX_ATTEMPTS) {
                        console.log(`Could not fetch game result on attempt ${attempt}, retrying in ${RETRY_INTERVAL_MS / 1000 / 60} minutes.`);
                        // Schedule next attempt recursively
                        checkRealResult(pick, matchup, attempt + 1);
                        return;
                    } else {
                        console.log(`Max retry attempts (${MAX_ATTEMPTS}) reached for game ${pick.matchupId}. Result unavailable.`);
                        addNotification({
                            type: 'warning',
                            message: `Could not get result for ${matchup.homeTeam.abbr} vs ${matchup.awayTeam.abbr}. Your streak is unchanged.`
                        });
                        return;
                    }
                }

                // Determine if user's pick was correct
                const userPickedTeam = pick.selectedTeam; // 'home' or 'away'
                const actualWinner = gameResult.winner; // 'home', 'away', or 'tie'

                let isCorrect = false;
                let resultMessage = '';

                if (actualWinner === 'tie') {
                    // Handle ties - could be considered correct, or push (no win/loss)
                    isCorrect = true; // For now, treat ties as wins to avoid frustrating users
                    resultMessage = `🤝 Tie Game! ${gameResult.homeTeam.abbreviation} ${gameResult.homeScore} - ${gameResult.awayTeam.abbreviation} ${gameResult.awayScore}. Streak continues!`;
                } else if (userPickedTeam === actualWinner) {
                    isCorrect = true;
                    const winningTeam = actualWinner === 'home' ? gameResult.homeTeam : gameResult.awayTeam;
                    resultMessage = `🎉 Correct! ${winningTeam.name} won ${gameResult.homeScore}-${gameResult.awayScore}. Streak: ${userState.currentStreak + 1}!`;
                } else {
                    isCorrect = false;
                    const winningTeam = actualWinner === 'home' ? gameResult.homeTeam : gameResult.awayTeam;
                    const userTeamAbbr = userPickedTeam === 'home' ? matchup.homeTeam.abbr : matchup.awayTeam.abbr; // Use matchup team data for user pick display
                    resultMessage = `😞 Wrong! You picked ${userTeamAbbr}, but ${winningTeam.name} won ${gameResult.homeScore}-${gameResult.awayScore}. Streak reset.`;
                }

                setIsStreakIncreasing(isCorrect); // Set for animation

                // Update user state with real result
                setUserState(prev => {
                    const newCurrentStreak = isCorrect ? prev.currentStreak + 1 : 0;
                    const newBestStreak = Math.max(prev.bestStreak, newCurrentStreak);

                    return {
                        ...prev,
                        correctPicks: prev.correctPicks + (isCorrect ? 1 : 0),
                        currentStreak: newCurrentStreak,
                        bestStreak: newBestStreak,
                        weeklyStats: {
                            ...prev.weeklyStats,
                            correct: prev.weeklyStats.correct + (isCorrect ? 1 : 0),
                            picks: prev.weeklyStats.picks + 1 // Increment weekly picks too
                        }
                    };
                });

                // Store game result history
                setGameResults(prev => [
                    ...prev.slice(-9), // Keep last 10 results (current + 9 previous)
                    {
                        gameId: pick.matchupId,
                        userPick: pick.selectedTeam,
                        actualWinner: gameResult.winner,
                        isCorrect: isCorrect,
                        finalScore: `${gameResult.homeScore}-${gameResult.awayScore}`,
                        checkedAt: new Date().toISOString(),
                        gameDate: matchup.startTime // startTime is already ISO string
                    }
                ]);

                // Show result notification
                addNotification({
                    type: isCorrect ? 'success' : 'error',
                    message: resultMessage
                });

                playSound(isCorrect ? 'pick_correct' : 'pick_wrong');

                // Log for debugging
                console.log(`Result processed: ${isCorrect ? 'CORRECT' : 'WRONG'}`);
                console.log(`Game: ${gameResult.homeTeam.name} ${gameResult.homeScore} - ${gameResult.awayTeam.abbreviation} ${gameResult.awayScore}`); // Fixed: Display away team abbr

            } catch (error) {
                console.error('Error processing game result:', error);
                // Fallback: don't update streak, just notify user
                addNotification({
                    type: 'warning',
                    message: `Error verifying result for ${matchup.homeTeam.abbr} vs ${matchup.awayTeam.abbr}. Your streak is unchanged.`
                });
            } finally {
                // Ensure streak increasing state is reset after a brief period
                setTimeout(() => setIsStreakIncreasing(false), 1500);
            }
        }, delayForThisAttempt);

    }, [setUserState, addNotification, playSound, userState.currentStreak, setGameResults, userState.weeklyStats]);


    /**
     * Handles a user making a pick - UPDATED to use real results
     * @param {'home' | 'away'} teamChoice - 'home' or 'away' team.
     */
    const handlePick = useCallback((teamChoice) => {
        if (!todaysMatchup) {
            addNotification({ type: 'error', message: 'Matchup not loaded yet. Please wait.' });
            return;
        }
        if (hasPickedToday || gameStarted) {
            addNotification({ type: 'warning', message: 'You have already picked for today or the game has started!' });
            playSound('button_click');
            return;
        }

        const newPick = {
            matchupId: todaysMatchup.id,
            selectedTeam: teamChoice,
            timestamp: new Date().toISOString(),
            date: today // Use ISO format instead of toDateString()
        };

        setUserState(prev => ({
            ...prev,
            todaysPick: newPick,
            lastPickDate: today,
            totalPicks: prev.totalPicks + 1,
            weeklyStats: {
                ...prev.weeklyStats,
                picks: prev.weeklyStats.picks + 1
            }
        }));

        const pickedTeamName = teamChoice === 'home' ? todaysMatchup.homeTeam.name : todaysMatchup.awayTeam.name;

        // Show immediate confirmation
        addNotification({
            type: 'info',
            message: `You picked: ${pickedTeamName}. 📡 Real result will be checked after the game!`
        });

        playSound('pick_select');

        // Always check real result since we only load real MLB games now
        checkRealResult(newPick, todaysMatchup);

    }, [hasPickedToday, gameStarted, todaysMatchup, today, setUserState, addNotification, playSound, checkRealResult]);


    const handleToggleTheme = useCallback(() => {
        setUserState(prev => ({
            ...prev,
            theme: prev.theme === 'dark' ? 'light' : 'dark'
        }));
        playSound('button_click');
    }, [setUserState, playSound]);

    const handleToggleSound = useCallback(() => {
        setUserState(prev => ({
            ...prev,
            soundEnabled: !prev.soundEnabled
        }));
        // playSound logic is inside useSound, so it will react to the state change
    }, [setUserState]);

    // Apply theme to body/html element
    useEffect(() => {
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(userState.theme);
        // Set CSS variables for theme
        const root = document.documentElement;
        if (userState.theme === 'dark') {
            root.style.setProperty('--bg-primary', '#0a0a0a');
            root.style.setProperty('--bg-secondary', '#1a1a1a');
            root.style.setProperty('--bg-tertiary', '#2a2a2a');
            root.style.setProperty('--bg-quaternary', '#404040');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#a0a0a0');
        } else {
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f8fafc');
            root.style.setProperty('--bg-tertiary', '#e2e8f0');
            root.style.setProperty('--bg-quaternary', '#cbd5e1');
            root.style.setProperty('--text-primary', '#1e293b');
            root.style.setProperty('--text-secondary', '#64748b');
        }
    }, [userState.theme]);

    // Share tracking callback
    const handleShareComplete = useCallback((shareType, platform) => {
        // Update share stats
        setShareStats(prev => ({
            totalShares: prev.totalShares + 1,
            sharesByType: {
                ...prev.sharesByType,
                [shareType]: (prev.sharesByType[shareType] || 0) + 1
            },
            sharesByPlatform: {
                ...prev.sharesByPlatform,
                [platform]: (prev.sharesByPlatform[platform] || 0) + 1
            },
            lastShared: new Date().toISOString()
        }));

        // Show confirmation and play sound
        addNotification({
            type: 'success',
            message: `Shared your ${shareType}! Friends incoming...`
        });
        playSound('achievement_unlock'); // Using achievement sound for share success
    }, [addNotification, playSound, setShareStats]);

    // Auto-trigger share prompts for milestones
    useEffect(() => {
        // Show share modal for significant streaks
        const milestones = [5, 10, 15, 20, 25, 30];
        if (userState.currentStreak > 0 && milestones.includes(userState.currentStreak)) {
            // Don't spam - only show once per milestone
            const hasSharedThisMilestone = localStorage.getItem(`shared_milestone_${userState.currentStreak}`);
            if (!hasSharedThisMilestone) {
                setTimeout(() => {
                    setShowShareModal(true);
                    localStorage.setItem(`shared_milestone_${userState.currentStreak}`, 'true');
                }, 2000); // 2 second delay for celebration
            }
        }
    }, [userState.currentStreak, setShowShareModal]);

    // Update leaderboard whenever user's streak or relevant stats change
    useEffect(() => {
        if (userState.displayName && userState.displayName !== 'AnonymousPicker') {
            updateLeaderboard();
        }
    }, [
        userState.currentStreak,
        userState.bestStreak,
        userState.totalPicks,
        userState.correctPicks,
        userState.weeklyStats?.correct,
        userState.displayName,
        updateLeaderboard
    ]);

    // Removed debugPlatform function and its call as per "no platform detection" rule.


    // Simple loading check - no complex logic
    if (matchupLoading) {
        return (
            <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
                <style>
                    {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
                    body { margin: 0; padding: 0; overflow-x: hidden; }
                    :root {
                        --bg-primary: #ffffff;
                        --bg-secondary: #f8fafc;
                        --bg-tertiary: #e2e8f0;
                        --text-primary: #1e293b;
                        --text-secondary: #64748b;
                        --accent-info: #3b82f6; /* Defined here for loading state */
                    }
                    .dark {
                        --bg-primary: #0a0a0a;
                        --bg-secondary: #1a1a1a;
                        --bg-tertiary: #2a2a2a;
                        --text-primary: #ffffff;
                        --text-secondary: #a0a0a0;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .loader {
                        border-top-color: var(--accent-info);
                        animation: spin 1.2s linear infinite;
                    }
                    `}
                </style>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Loading Daily Matchup...</p>
                </div>
            </div>
        );
    }

    // CLEAN ERROR STATE - NO FALLBACKS
    if (!matchupLoading && !todaysMatchup) {
        return (
            <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
                <style>
                    {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
                    body { margin: 0; padding: 0; overflow-x: hidden; }
                    :root {
                        --bg-primary: #ffffff;
                        --bg-secondary: #f8fafc;
                        --bg-tertiary: #e2e8f0;
                        --text-primary: #1e293b;
                        --text-secondary: #64748b;
                        --accent-info: #3b82f6;
                        --accent-win: #22c55e;
                        --success: #10b981;
                        --error: #ef4444;
                    }
                    .dark {
                        --bg-primary: #0a0a0a;
                        --bg-secondary: #1a1a1a;
                        --bg-tertiary: #2a2a2a;
                        --text-primary: #ffffff;
                        --text-secondary: #a0a0a0;
                    }
                    `}
                </style>
                <div className="text-center p-6">
                    <h2 className="text-2xl font-bold mb-4">No Games Available</h2>
                    <p className="text-text-secondary mb-4">
                        No MLB games found for {new Date().toISOString().split('T')[0]}.
                    </p>
                    <p className="text-xs text-text-secondary mb-6">
                        This could mean it's an off-day or there's an API issue.
                        Please ensure your mobile browser is not requesting a "Desktop Site".
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }


    // Enhanced Header Component
    const EnhancedHeader = ({ userState, leaderboardData, onOpenLeaderboard }) => {
        const userRank = leaderboardData.userRank;

        return (
            <div className="text-center mb-8 pt-8 w-full">
                <div className="flex justify-between items-center mb-4 px-4">
                    <RankBadge rank={userRank} streak={userState.currentStreak} className="min-w-[90px]"/>
                    <h1 className="text-3xl font-bold text-text-primary text-center flex-1">Streak Pick'em</h1>
                    <button
                        onClick={onOpenLeaderboard}
                        className="leaderboard-btn text-3xl p-2 rounded-full hover:bg-bg-tertiary transition-colors"
                        aria-label="Open leaderboard"
                    >
                        🏆
                    </button>
                </div>

                <AnimatedStreakDisplay
                    currentStreak={userState.currentStreak}
                    bestStreak={userState.bestStreak}
                    isIncreasing={isStreakIncreasing}
                />
            </div>
        );
    };


    return (
        <div
            className="min-h-screen bg-bg-primary text-text-primary font-inter p-4 flex flex-col items-center relative overflow-hidden transition-colors duration-300"
            style={{
                // This section sets the CSS variables for the entire application,
                // making them accessible to TailwindCSS classes and custom CSS.
                // These are dynamically updated by the theme toggle.
                '--bg-primary': 'var(--bg-primary)',
                '--bg-secondary': 'var(--bg-secondary)',
                '--bg-tertiary': 'var(--bg-tertiary)',
                '--bg-quaternary': 'var(--bg-quaternary)',
                '--success': '#10b981',
                '--success-light': '#6ee7b7',
                '--error': '#ef4444',
                '--error-light': '#fca5a5',
                '--warning': '#f59e0b',
                '--info': '#3b82f6',
                '--info-light': '#93c5fd',
                '--text-primary': 'var(--text-primary)',
                '--text-secondary': 'var(--text-secondary)',
                '--accent-win': '#22c55e', // Specific accent color for wins
                '--accent-loss': '#ef4444', // Specific accent color for losses
                '--accent-info': '#3b82f6', // Re-using --info for accent-info
                '--font-primary': "'Inter', system-ui, -apple-system, sans-serif",
                '--font-mono': "'SF Mono', Monaco, 'Cascadia Code', monospace",
                '--space-xs': '0.25rem',
                '--space-sm': '0.5rem',
                '--space-md': '1rem',
                '--space-lg': '1.5rem',
                '--space-xl': '2rem',
                '--space-2xl': '3rem',
                '--radius-sm': '0.375rem',
                '--radius-md': '0.5rem',
                '--radius-lg': '0.75rem',
                '--radius-xl': '1rem',
                '--radius-2xl': '1.5rem',
                '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                '--transition-fast': '150ms ease-out',
                '--transition-normal': '250ms ease-out',
                '--transition-slow': '400ms ease-out',
            }}
        >
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
                body { margin: 0; padding: 0; overflow-x: hidden; }
                
                /* FORCE CONSISTENT COLORS EVERYWHERE */
                :root {
                    --bg-primary: #ffffff;
                    --bg-secondary: #f8fafc;
                    --bg-tertiary: #e2e8f0;
                    --text-primary: #1e293b;
                    --text-secondary: #64748b;
                    --accent-info: #3b82f6;
                    --accent-win: #22c55e;
                    --success: #10b981;
                    --error: #ef4444;
                }

                .dark {
                    --bg-primary: #0a0a0a;
                    --bg-secondary: #1a1a1a;
                    --bg-tertiary: #2a2a2a;
                    --text-primary: #ffffff;
                    --text-secondary: #a0a0a0;
                }

                /* PREMIUM MATCHUP CARD */
                .matchup-card {
                    background: linear-gradient(135deg, 
                        var(--bg-secondary) 0%, 
                        color-mix(in srgb, var(--accent-info) 8%, var(--bg-secondary)) 50%,
                        var(--bg-secondary) 100%
                    );
                    border: 1px solid color-mix(in srgb, var(--info) 10%, transparent);
                    border-radius: var(--radius-2xl);
                    box-shadow: var(--shadow-lg);
                    backdrop-filter: blur(20px);
                    position: relative;
                    overflow: hidden;
                    transition: all var(--transition-normal);
                }

                .matchup-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, var(--info), var(--success), var(--warning));
                    opacity: 0.6;
                }

                /* PERFECT TEAM CARD IMPLEMENTATION */
                .team-selection-container {
                    display: grid;
                    grid-template-columns: 1fr 60px 1fr;
                    gap: var(--space-lg);
                    align-items: stretch;
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                    padding: var(--space-lg);
                }

                .team-card {
                    /* CRITICAL: Exact dimensions for symmetry */
                    min-height: 160px;
                    width: 100%;
                    aspect-ratio: 3/4; /* Maintain consistent proportions */
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    
                    /* Visual design */
                    background: var(--bg-secondary);
                    border: 2px solid var(--bg-tertiary);
                    border-radius: var(--radius-xl);
                    padding: var(--space-lg);
                    position: relative; /* Added for .color-accent positioning */
                    overflow: hidden; /* Added for .color-accent border-radius */
                    
                    /* Interactions */
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Enhanced transition */
                    transform: scale(1);
                    
                    /* Accessibility */
                    outline: none;

                    /* Subtle inner shadow for depth */
                    box-shadow: var(--shadow-md), inset 0 1px 3px 0 rgba(0,0,0,0.05);
                }

                .team-card:focus-visible {
                    box-shadow: 0 0 0 2px var(--info), 0 0 0 4px var(--info-light);
                    outline: none;
                }

                .team-card:hover:not(.disabled) {
                    transform: translateY(-4px) scale(1.03); /* Enhanced hover effect */
                    border-color: var(--team-primary);
                    box-shadow: 
                        0 20px 25px -5px rgba(0, 0, 0, 0.1),
                        0 10px 10px -5px rgba(0, 0, 0, 0.04),
                        0 0 30px var(--team-primary)30; /* Team color glow effect */
                }

                .team-card.selected {
                    border-color: var(--team-primary);
                    border-width: 3px; /* Thicker border on selection */
                    background: linear-gradient(135deg, 
                        var(--team-primary)20, /* More prominent primary color in background */
                        var(--bg-secondary)
                    );
                    transform: scale(1.02);
                    box-shadow: var(--shadow-lg), 0 0 15px var(--team-primary)60; /* Stronger glow when selected */
                }

                .team-card.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .vs-divider {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                    background: var(--bg-tertiary);
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    box-shadow: var(--shadow-md);
                }

                /* ENHANCED ANIMATIONS */
                @keyframes team-select {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1.02); }
                }

                @keyframes pulse-success {
                    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 40%, transparent); }
                    70% { box-shadow: 0 0 0 10px transparent; }
                }

                .team-card.selected {
                    animation: team-select 0.3s ease-out;
                }

                .streak-celebration {
                    animation: pulse-success 2s infinite;
                }

                /* ✅ Enhanced color accent styling */
                .color-accent {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 4px; /* Default height */
                    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
                    transition: height 0.3s ease;
                }

                .team-card:hover .color-accent {
                    height: 6px; /* Slightly taller on hover */
                }

                /* Pulse animation for selected card */
                .team-card.selected .color-accent {
                    animation: colorPulse 2s ease-in-out infinite;
                }

                @keyframes colorPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                /* MOBILE OPTIMIZATIONS */
                @media (max-width: 640px) {
                    .team-selection-container {
                        grid-template-columns: 1fr 50px 1fr;
                        gap: var(--space-md);
                        padding: var(--space-md);
                    }
                    
                    .team-card {
                        min-height: 140px;
                        padding: var(--space-md);
                    }
                    
                    .vs-divider {
                        width: 50px;
                        height: 50px;
                        font-size: 1rem;
                    }
                }

                `}
            </style>
            <script src="https://cdn.tailwindcss.com"></script>

            <div className="max-w-md mx-auto w-full animate-fadeInUp">

                {/* Enhanced Header - Streak Display & Rank */}
                <EnhancedHeader
                    userState={userState}
                    leaderboardData={leaderboardData}
                    onOpenLeaderboard={() => setShowLeaderboard(true)}
                />

                {/* Today's Matchup Card */}
                <div className="matchup-card mb-6"> {/* Applied matchup-card styling */}
                    <div className="flex justify-between items-center mb-4 px-6 pt-6"> {/* Added padding to align with matchup-card */}
                        <span className="bg-accent-info text-xs px-3 py-1 rounded-full font-semibold text-white">
                            {todaysMatchup.sport}
                        </span>
                        {/* Data source will always be live now */}
                        <span className="text-xs text-text-secondary">
                            📡 Live
                        </span>
                        <span className="text-xs text-text-secondary">{todaysMatchup.venue}</span>
                    </div>

                    {/* Team vs Team using the new team-selection-container grid */}
                    <div className="team-selection-container">
                        <EnhancedTeamCard
                            team={todaysMatchup.homeTeam}
                            isSelected={userState.todaysPick?.selectedTeam === 'home'}
                            isPicked={userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.selectedTeam === 'home'}
                            onClick={() => handlePick('home')}
                            disabled={hasPickedToday || gameStarted}
                        />

                        <div className="vs-divider">VS</div>

                        <EnhancedTeamCard
                            team={todaysMatchup.awayTeam}
                            isSelected={userState.todaysPick?.selectedTeam === 'away'}
                            isPicked={userState.todaysPick?.matchupId === todaysMatchup.id && userState.todaysPick?.selectedTeam === 'away'}
                            onClick={() => handlePick('away')}
                            disabled={hasPickedToday || gameStarted}
                        />
                    </div>

                    {/* Enhanced Game Time Display */}
                    <div className="text-center mb-6 px-6">
                        {todaysMatchup?.startTime ? (
                            <EnhancedGameTimeDisplay 
                                startTime={todaysMatchup.startTime} 
                                setTimeLeft={setTimeLeft}
                                matchupId={todaysMatchup.id}
                                setGameStarted={setGameStarted} // Pass setGameStarted as a prop
                            />
                        ) : (
                            <div className="text-red-500">⚠️ No game time available</div>
                        )}
                        
                        <p className="text-lg font-semibold text-text-primary">
                            ⏰ Starts in: <span className="font-mono">{timeLeft || 'Calculating...'}</span>
                        </p>
                    </div>
                    
                    {/* Pick Buttons or Result (now handled by EnhancedTeamCard's disabled state) */}
                    {(hasPickedToday || gameStarted) && (
                        <div className="text-center bg-bg-tertiary rounded-b-2xl p-4 border-t border-text-secondary/20">
                            <p className="font-semibold text-text-primary">
                                {hasPickedToday ?
                                    `✅ You picked: ${userState.todaysPick.selectedTeam === 'home' ? todaysMatchup.homeTeam.name : todaysMatchup.awayTeam.name}` :
                                    '🔒 Game has started!'
                                }
                            </p>
                            <p className="text-sm text-text-secondary mt-1">Come back tomorrow for a new matchup!</p>
                            {/* Share Pick Button (Option B) */}
                            {hasPickedToday && userState.currentStreak > 0 && (
                                <div className="mt-4 text-center">
                                    <button
                                        onClick={() => setShowShareModal(true)}
                                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-md"
                                        aria-label="Share this pick"
                                    >
                                        📱 Share This Pick
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Leaderboard Preview Section */}
                <div className="leaderboard-section mb-6">
                    <LeaderboardPreview
                        leaderboardData={leaderboardData}
                        userState={userState}
                        onOpenFull={() => setShowLeaderboard(true)}
                        userCount={leaderboardData.users.length} // Pass the total user count
                    />
                </div>


                {/* Simple Stats */}
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                    <div className="bg-bg-secondary rounded-xl p-4 shadow-md border border-bg-tertiary">
                        <div className="text-2xl font-bold text-accent-info">{userState.totalPicks}</div>
                        <div className="text-xs text-text-secondary">Total Picks</div>
                    </div>
                    <div className="bg-bg-secondary rounded-xl p-4 shadow-md border border-bg-tertiary">
                        <div className="text-2xl font-bold text-accent-win">{userState.correctPicks}</div>
                        <div className="text-xs text-text-secondary">Correct</div>
                    </div>
                    <div className="bg-bg-secondary rounded-xl p-4 shadow-md border border-bg-tertiary">
                        <div className="text-2xl font-bold text-purple-400">
                            {userState.totalPicks > 0 ? Math.round((userState.correctPicks / userState.totalPicks) * 100) : 0}%
                        </div>
                        <div className="text-xs text-text-secondary">Accuracy</div>
                    </div>
                </div>

                {/* Enhanced Settings with Logout */}
                <div className="bg-bg-secondary p-4 rounded-xl shadow-md border border-bg-tertiary">
                    <div className="grid grid-cols-2 gap-3 mb-3 settings-grid">
                        <button
                            onClick={handleToggleTheme}
                            className="p-3 sm:p-2 px-3 rounded-full bg-accent-info text-white font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md text-sm"
                            aria-label={`Toggle theme, current is ${userState.theme}`}
                        >
                            {userState.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                        </button>
                        <button
                            onClick={() => handleToggleSound()}
                            className={`p-3 sm:p-2 px-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md text-sm
                                ${userState.soundEnabled ? 'bg-accent-win text-white' : 'bg-gray-500 text-white'}
                            `}
                            aria-label={`Toggle sound effects, currently ${userState.soundEnabled ? 'on' : 'off'}`}
                        >
                            🔊 Sound
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 settings-grid">
                        <button
                            onClick={() => setShowShareModal(true)}
                            className="p-3 sm:p-2 px-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md text-sm"
                            aria-label="Share the app"
                        >
                            📱 Share
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    // FIX: Use complete URL for logout as well
                                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                                    const response = await fetch(`${baseUrl}/api/auth/logout`, {
                                        method: 'POST',
                                        credentials: 'include'
                                    });
                                    if (response.ok) {
                                        window.location.href = '/';
                                    }
                                } catch (error) {
                                    console.error('Logout error:', error);
                                    // Fallback: just reload the page
                                    window.location.reload();
                                }
                            }}
                            className="p-3 sm:p-2 px-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md text-sm"
                            aria-label="Logout from Whop account"
                        >
                            🚪 Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Notifications */}
            {notifications.length > 0 && (
                <div className="fixed top-4 right-4 z-50 w-full max-w-xs p-2 animate-slideInRight">
                    <div className={`${notifications[notifications.length - 1].type === 'success' ? 'bg-green-600' :
                        notifications[notifications.length - 1].type === 'error' ? 'bg-red-600' :
                        notifications[notifications.length - 1].type === 'warning' ? 'bg-yellow-600' :
                        'bg-blue-600'} text-white rounded-xl shadow-lg p-3 flex items-center justify-between`}>
                        <p className="font-semibold text-sm">
                            {notifications[notifications.length - 1].message}
                        </p>
                        <button
                            onClick={() => dismissNotification(notifications[notifications.length - 1].id)}
                            className="ml-2 text-white opacity-75 hover:opacity-100 text-xl leading-none"
                            aria-label="Dismiss notification"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                userState={userState}
                todaysMatchup={todaysMatchup}
                onShare={handleShareComplete}
                addNotification={addNotification} // Pass addNotification to ShareModal
            />

            {/* Leaderboard Modal */}
            <LeaderboardModal
                isOpen={showLeaderboard}
                onClose={() => setShowLeaderboard(false)}
                userState={userState}
                leaderboardData={leaderboardData}
                onRefreshLeaderboard={refreshLeaderboard} // Use the new refresh function
                userId={userId}
            />

        </div>
    );
};

// --- Whop Integration Wrapper ---

export default function Page() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isWhopUser, setIsWhopUser] = useState(false);

    useEffect(() => {
        async function getUser() {
            try {
                console.log('Checking for Whop user...');
                
                // Use window.location.origin to build complete URL
                const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                
                // First, try to get real Whop user from headers
                const whopResponse = await fetch(`${baseUrl}/api/whop/user`, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (whopResponse.ok) {
                    const whopUser = await whopResponse.json();
                    console.log('Found real Whop user:', whopUser);
                    setUser(whopUser);
                    setIsWhopUser(true);
                    setLoading(false);
                    return;
                }

                console.log('No Whop user found, checking for dev mode...');
                
                // If we're in development or testing, use test user
                const testUser = {
                    id: 'test_user_' + Date.now(),
                    username: 'TestPlayer' + Math.floor(Math.random() * 1000),
                    email: 'test@streakpicks.com',
                    name: 'Test Player'
                };
                
                console.log('Using test user for development');
                setUser(testUser);
                setIsWhopUser(false);

            } catch (error) {
                console.error('Error getting user:', error);
                
                // Fallback to test user on any error
                const testUser = {
                    id: 'fallback_user_' + Date.now(),
                    username: 'FallbackPlayer',
                    email: 'fallback@streakpicks.com',
                    name: 'Fallback Player'
                };
                setUser(testUser);
                setIsWhopUser(false);
            } finally {
                setLoading(false);
            }
        }

        getUser();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Connecting to Whop...</p>
                </div>
            </div>
        );
    }

    // Show a banner if using test user
    return (
        <div>
            {!isWhopUser && (
                <div className="bg-yellow-100 border-b border-yellow-300 p-2 text-center text-sm">
                    🧪 <strong>Development Mode:</strong> Using test user. 
                    Access through Whop community for real authentication.
                </div>
            )}
            <App user={user} />
        </div>
    );
}

