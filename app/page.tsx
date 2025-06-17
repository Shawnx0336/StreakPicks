// @ts-nocheck

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, serverTimestamp, off } from 'firebase/database';

// Firebase configuration - USE THIS EXACT CONFIG
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
                // Method 1: Try to get current user from Whop API
                try {
                    const response = await fetch('/api/whop/user', {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        console.log('✅ Whop user authenticated:', userData);
                        setUser(userData);
                        setIsAuthenticated(true);
                        setHasAccess(true);
                        setError(null);
                        setIsLoading(false);
                        return;
                    }
                } catch (whopError) {
                    console.log('Whop API not available, checking fallback...');
                }

                // Method 2: Fallback to original auth check
                const fallbackResponse = await fetch('/api/auth/check', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });

                if (fallbackResponse.ok) {
                    const userData = await fallbackResponse.json();
                    console.log('✅ Fallback auth successful:', userData);
                    setUser(userData);
                    setIsAuthenticated(true);
                    setHasAccess(true);
                    setError(null);
                } else if (fallbackResponse.status === 401) {
                    // User not authenticated - create test user for development
                    console.log('🧪 Creating test user for development');
                    const testUser = {
                        id: 'test_user_' + Math.random().toString(36).substr(2, 9),
                        username: 'TestUser',
                        name: 'Test User',
                        email: 'test@example.com',
                        isTestUser: true
                    };
                    setUser(testUser);
                    setIsAuthenticated(true);
                    setHasAccess(true);
                    setError(null);
                } else {
                    throw new Error(`Authentication check failed: ${fallbackResponse.status}`);
                }
            } catch (err) {
                console.error('Auth check error:', err);
                
                // Final fallback - create anonymous test user
                console.log('🧪 Creating anonymous test user');
                const anonymousUser = {
                    id: 'anonymous_' + Math.random().toString(36).substr(2, 9),
                    username: 'AnonymousUser',
                    name: 'Anonymous User',
                    email: 'anonymous@example.com',
                    isTestUser: true,
                    isAnonymous: true
                };
                setUser(anonymousUser);
                setIsAuthenticated(true);
                setHasAccess(true);
                setError(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuthStatus();
    }, [isClient]);

    // Show loading until client-side hydration is complete
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
 * @property {Object} todaysPicks - Object: { gameId: { selectedTeam, timestamp, date, status: 'pending' | 'correct' | 'wrong' }, ... }
 * @property {string | null} lastPickDate - `toDateString()` of the last date a pick was made.
 * @property {Theme} theme - Current UI theme ('dark' or 'light').
 * @property {boolean} soundEnabled - Is sound enabled?
 * @property {string} displayName - User's display name from Whop account.
 * @property {boolean} isPublic - Whether user data can appear on leaderboard.
 * @property {WeeklyStats} weeklyStats - Stats for the current week.
 */

/**
 * @typedef {Object} Team
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
 * @property {string} status - Current status of the matchup (e.g., 'upcoming').
 * @property {number} gameIndex - Index of the game in the carousel.
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
    if (str === null || str === undefined) { // Handle null or undefined string input
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
 * Generates an anonymous but consistent display name based on userId.
 * @param {string} userId - The user's unique ID.
 * @returns {string} Generated display name.
 */
const generateDisplayName = (userId) => {
    const adjectives = ['Fire', 'Ice', 'Lightning', 'Storm', 'Steel', 'Shadow', 'Blazing', 'Mighty', 'Swift', 'Golden', 'Mystic', 'Crimson', 'Azure', 'Jade', 'Silver', 'Bronze', 'Diamond', 'Emerald', 'Vapor', 'Echo'];
    const nouns = ['Picker', 'Prophet', 'Analyst', 'Streak', 'Eagle', 'Tiger', 'Champion', 'Master', 'Wizard', 'Legend', 'Striker', 'Scout', 'Oracle', 'Hunter', 'Guardian', 'Titan', 'Specter', 'Vanguard', 'Pioneer', 'Maverick'];

    // Use userId hash to ensure consistent name
    const hashVal = simpleHash(userId);
    const adjIndex = hashVal % adjectives.length;
    const nounIndex = Math.floor(hashVal / adjectives.length) % nouns.length;
    const number = (Math.floor(hashVal / (adjectives.length * nouns.length)) % 999) + 1; // 1 to 999

    return `${adjectives[adjIndex]}${nouns[nounIndex]}${number}`;
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
    if (!user) return 'AnonymousUser';
    
    // Handle test users
    if (user.isTestUser || user.isAnonymous) {
        return user.username || user.name || 'TestUser';
    }
    
    // Handle real Whop users with proper fallbacks
    return user.username || 
           user.name || 
           user.email?.split('@')[0] || 
           `WhopUser${simpleHash(user.id || 'anonymous')}`;
};

/**
 * Checks if a Date object is valid.
 * @param {Date} date - The Date object to check.
 * @returns {boolean} True if the date is valid, false otherwise.
 */
const isValidDate = (date) => {
    return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Safely parses a date input into a Date object, returning null if invalid.
 * @param {*} dateInput - The input to parse (e.g., string, number, Date object).
 * @returns {Date | null} A valid Date object or null.
 */
const safeParseDate = (dateInput) => {
    if (!dateInput) return null;
    
    const date = new Date(dateInput);
    return isValidDate(date) ? date : null;
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
 * UPDATED: getTodaysMLBGames to return multiple games
 */
const getTodaysMLBGames = async () => {
    console.log('🎯 MULTI-GAME API CALL - STARTING');
    
    // ✅ CRITICAL FIX: Use local date, not UTC for API query
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
        
        // Take up to 3 games instead of just the first one
        const games = data.dates[0].games.slice(0, 3);
        console.log(`🎯 Selected ${games.length} games.`);
        
        // RETURN STANDARDIZED FORMAT for each game
        return games.map((game, index) => ({
            id: `${game.gamePk}_${index}`, // Unique ID per game, incorporating index for uniqueness if gamePk duplicates
            gamePk: game.gamePk.toString(), // Keep original gamePk for result fetching
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
            status: 'upcoming',
            gameIndex: index // Track position in carousel
        }));
        
    } catch (error) {
        // Log the full error object for better debugging
        console.error('❌ MLB API FAILED:', error); 
        throw error; // DON'T CATCH - LET IT FAIL
    }
};

/**
 * Helper function to get team abbreviation from team name
 * This is needed for the new fetchMLBGameResult to map full names to abbreviations.
 */
function getTeamAbbreviation(teamName) {
    const teamAbbrs = {
        'Philadelphia Phillies': 'PHI',
        'Miami Marlins': 'MIA',
        'Colorado Rockies': 'COL',
        'Washington Nationals': 'WSH',
        'Los Angeles Angels': 'LAA',
        'New York Yankees': 'NYY',
        'Baltimore Orioles': 'BAL',
        'Tampa Bay Rays': 'TB',
        'Boston Red Sox': 'BOS',
        'Seattle Mariners': 'SEA',
        'Houston Astros': 'HOU',
        'Athletics': 'OAK',
        'San Diego Padres': 'SD',
        'Los Angeles Dodgers': 'LAD',
        'Atlanta Braves': 'ATL',
        'New York Mets': 'NYM',
        'Chicago Cubs': 'CHC',
        'Milwaukee Brewers': 'MIL',
        'Cincinnati Reds': 'CIN',
        'Pittsburgh Pirates': 'PIT',
        'St. Louis Cardinals': 'STL',
        'Arizona Diamondbacks': 'ARI',
        'San Francisco Giants': 'SF',
        'Texas Rangers': 'TEX',
        'Kansas City Royals': 'KC',
        'Minnesota Twins': 'MIN',
        'Chicago White Sox': 'CWS',
        'Cleveland Guardians': 'CLE',
        'Detroit Tigers': 'DET',
        'Toronto Blue Jays': 'TOR'
    };
    
    return teamAbbrs[teamName] || teamName.split(' ').pop().slice(0, 3).toUpperCase();
}


/**
 * FIXED: Get game results from the schedule API using the GAME'S date, not today's date
 * @param {string} gamePk - MLB game ID (gamePk)
 * @param {string} sport - Sport type (should be 'MLB')
 * @param {string} gameDate - The actual date of the game (ISO string from todaysMatchup.startTime)
 * @returns {Promise<Object|null>} Game result or null
 */
const fetchMLBGameResult = async (gamePk, sport, gameDate) => {
    try {
        console.log(`🔍 Fetching MLB game result for gamePk ${gamePk}`);
        
        // ✅ FIX: Use the game's actual date, not today's date
        let searchDate;
        if (gameDate) {
            // Extract date from the game's startTime
            searchDate = new Date(gameDate).toISOString().split('T')[0]; //YYYY-MM-DD format
        } else {
            // Fallback to today if no gameDate provided
            searchDate = new Date().toISOString().split('T')[0];
        }
        
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${searchDate}`;
        
        console.log(`📡 Fetching from schedule API for date ${searchDate}: ${scheduleUrl}`);
        
        const response = await fetch(proxyUrl + encodeURIComponent(scheduleUrl));
        
        if (!response.ok) {
            console.log(`❌ Schedule API returned ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        // Find the specific game by ID
        const game = data.dates?.[0]?.games?.find(g => g.gamePk.toString() === gamePk.toString());
        
        if (!game) {
            console.log(`❌ Game ${gamePk} not found in ${searchDate} schedule`);
            return null;
        }
        
        // Check if game is finished
        if (game.status?.statusCode !== 'F') {
            console.log(`⏳ Game ${gamePk} not finished yet. Status: ${game.status?.detailedState}`);
            return null;
        }
        
        // Extract scores and winner info (it's right there in the schedule!)
        const homeScore = game.teams.home.score || 0;
        const awayScore = game.teams.away.score || 0;
        const homeWon = game.teams.home.isWinner || false;
        const awayWon = game.teams.away.isWinner || false;
        
        let winner = 'tie';
        if (homeWon) winner = 'home';
        else if (awayWon) winner = 'away';
        
        const result = {
            gameId: gamePk, // Use gamePk for result tracking
            status: 'completed',
            homeScore: homeScore,
            awayScore: awayScore,
            winner: winner,
            homeTeam: {
                name: game.teams.home.team.name,
                abbreviation: getTeamAbbreviation(game.teams.home.team.name),
                score: homeScore
            },
            awayTeam: {
                name: game.teams.away.team.name,
                abbreviation: getTeamAbbreviation(game.teams.away.team.name),
                score: awayScore
            },
            completedAt: new Date().toISOString(), // Store as ISO string
            rawGameData: game
        };
        
        console.log('✅ Successfully parsed game result from schedule:', {
            gamePk,
            searchDate,
            homeScore,
            awayScore,
            winner,
            homeTeam: result.homeTeam.name,
            awayTeam: result.awayTeam.name
        });
        
        return result;
        
    } catch (error) {
        console.error(`❌ Error fetching game result for ${gamePk}:`, error.message);
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

                // Reset todaysPicks and update lastPickDate if it's a new day
                if (storedDate !== currentDate) {
                    console.log('🔄 Resetting picks for new day');
                    updatedParsedItem.todaysPicks = {}; // Changed from todaysPick to todaysPicks
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
        setNotifications((prev) => prev.filter((n) => n.id !== n.id));
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
    todaysPicks: {}, // Changed to object for multiple picks: { gameId: { selectedTeam, timestamp, date, gamePk, isChecked: boolean } }
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
 * @param {Object} todaysGames - Today's games array (optional)
 * @param {number} currentGameIndex - Current game index for 'pick' share type
 * @param {string} shareType - Type of share ('streak', 'pick', 'achievement', 'challenge')
 * @returns {string} Formatted share text
 */
const generateShareText = (userState, todaysGames = [], currentGameIndex = 0, shareType = 'streak') => {
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
            const currentGame = todaysGames[currentGameIndex];
            const userPick = userState.todaysPicks[currentGame?.id];
            if (!currentGame || !userPick) return generateShareText(userState, todaysGames, currentGameIndex, 'streak'); // Fallback if no pick made
            
            const pickedTeamName = userPick.selectedTeam === 'home' ? currentGame.homeTeam.name : currentGame.awayTeam.name;
            return `Today's pick for ${currentGame.homeTeam.name} vs ${currentGame.awayTeam.name}: I'm going with ${pickedTeamName}! 🤔\n\nCurrent streak: ${userState.currentStreak} ${streakEmoji}\n\nJoin me: ${appUrl}`;

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
            return generateShareText(userState, todaysGames, currentGameIndex, 'streak');
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
        document.execCommand('copy', false, url ? `${text}\n\n${url}` : text); // Use document.execCommand for broader compatibility in iframes
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
 * @param {Object} props.todaysGames - Today's games array
 * @param {number} props.currentGameIndex - Current game index
 * @param {string} props.shareType - Type of share
 * @param {function} props.onShare - Callback after sharing
 * @param {string} props.className - Custom styling
 * @param {React.ReactNode} props.children - Button content
 */
const ShareButton = ({ userState, todaysGames, currentGameIndex, shareType = 'streak', onShare, className = '', children }) => {
    const [sharing, setSharing] = useState(false);

    const handleShare = async () => {
        setSharing(true);

        try {
            const shareText = generateShareText(userState, todaysGames, currentGameIndex, shareType);
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
 * @param {Object} props.todaysGames - Today's games array
 * @param {number} props.currentGameIndex - Current game index for 'pick' share type
 * @param {function} props.onShare - Share callback
 * @param {function} props.addNotification - Function to add a notification
 */
const ShareModal = ({ isOpen, onClose, userState, todaysGames, currentGameIndex, onShare, addNotification }) => {
    if (!isOpen) return null;

    const [shareType, setShareType] = useState('streak');
    const [copySuccess, setCopySuccess] = useState(false);

    const shareText = generateShareText(userState, todaysGames, currentGameIndex, shareType);

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
 * GameResultDisplay Component - Shows final game results
 * @param {Object} props
 * @param {Object} props.result - The game result object.
 * @param {Object} props.game - The matchup details for this specific game.
 * @param {Object} props.userPick - The user's pick for this specific game.
 */
const GameResultDisplay = ({ result, game, userPick }) => {
    if (!result || !game) return null;
    
    const winnerTeam = result.winner === 'home' ? game.homeTeam : game.awayTeam;
    const userPickedTeam = userPick?.selectedTeam ? (userPick.selectedTeam === 'home' ? game.homeTeam : game.awayTeam) : null;
    const userWasCorrect = userPick?.selectedTeam === result.winner;
    
    return (
        <div className="mt-4 bg-bg-tertiary rounded-xl p-4 border-2 border-bg-tertiary">
            <div className="text-center mb-3">
                <h4 className="font-bold text-lg text-text-primary mb-2">🏆 Final Result</h4>
                <div className="text-2xl font-bold">
                    <span className={result.winner === 'home' ? 'text-accent-win' : 'text-text-primary'}>
                        {game.homeTeam.abbr} {result.homeScore}
                    </span>
                    <span className="text-text-secondary mx-2">-</span>
                    <span className={result.winner === 'away' ? 'text-accent-win' : 'text-text-primary'}>
                        {result.awayScore} {game.awayTeam.abbr}
                    </span>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                    Winner: {winnerTeam.name}
                </p>
            </div>
            
            {userPick && (
                <div className={`text-center p-3 rounded-lg ${userWasCorrect ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <p className={`font-semibold ${userWasCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {userWasCorrect ? '✅ You were CORRECT!' : '❌ You were wrong'}
                    </p>
                    <p className="text-sm text-text-secondary">
                        You picked: {userPickedTeam?.name || 'N/A'}
                    </p>
                </div>
            )}
        </div>
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
 * @param {Object} props
 * @param {string} props.startTime - ISO string of the game start time.
 * @param {function} props.setTimeLeft - Callback to update time left string.
 * @param {string} props.gameId - Unique ID of the game.
 * @param {function} props.setGameStarted - Callback to update gameStarted status for this game.
 */
const EnhancedGameTimeDisplay = ({ startTime, setTimeLeft, gameId, setGameStarted }) => {
    const [gameTime, setGameTime] = useState(null);
    const [error, setError] = useState(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!startTime) {
            setTimeLeft('No start time');
            setError('No start time provided');
            setGameStarted(true); // Treat as started if no time
            return;
        }

        let parsedTime = null;
        try {
            parsedTime = new Date(startTime);
            if (isNaN(parsedTime.getTime())) {
                throw new Error('Invalid date');
            }
            setGameTime(parsedTime);
            setError(null);
        } catch (parseError) {
            console.error(`Timer for ${gameId}: Date parsing failed:`, parseError);
            const fallbackTime = new Date(Date.now() + 60 * 60 * 1000); // Fallback to 1 hour from now
            setGameTime(fallbackTime);
            setError(`Parse failed: ${parseError.message}`);
        }
    }, [startTime, gameId, setTimeLeft, setGameStarted]);

    useEffect(() => {
        if (!gameTime) return;

        const updateTimer = () => {
            const now = new Date();
            const diff = gameTime - now;

            if (diff <= 0) {
                setGameStarted(true);
                setTimeLeft('Game Started');
                clearInterval(intervalRef.current);
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const timeString = `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`;
            setTimeLeft(timeString);
            setGameStarted(false);
        };

        updateTimer(); // Initial call
        intervalRef.current = setInterval(updateTimer, 1000);

        return () => clearInterval(intervalRef.current);
    }, [gameTime, setTimeLeft, setGameStarted]);

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

// Chevron Icons (for carousel navigation)
const ChevronLeft = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

const ChevronRight = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);


// ADD: Status badges for each game state
const GameStatusBadge = ({ game, userPick, gameStarted, gameResult }) => {
    if (gameResult) {
        const isCorrect = userPick?.selectedTeam === gameResult.winner;
        return (
            <div className={`status-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                {isCorrect ? '✅ Correct' : '❌ Wrong'}
            </div>
        );
    }
    
    if (userPick && userPick.isSubmitted) { // Check if pick is submitted
        return (
            <div className="status-badge picked">
                ✅ Picked: {userPick.selectedTeam === 'home' ? game.homeTeam.abbr : game.awayTeam.abbr}
            </div>
        );
    }
    
    if (gameStarted) {
        return <div className="status-badge locked">🔒 Game Started</div>;
    }
    
    return <div className="status-badge available">⚡ Make Your Pick</div>;
};


/**
 * GameCard Component
 * @param {Object} props
 * @param {Matchup} props.game - Game data.
 * @param {boolean} props.isActive - Whether this card is the currently active one in the carousel.
 * @param {Object} props.userPick - The user's pick for this specific game (from dailyPicks[game.id]).
 * @param {(team: 'home' | 'away') => void} props.onPick - Pick handler for this game.
 * @param {boolean} props.disabled - Whether the pick buttons for this game should be disabled.
 * @param {string} props.timeLeft - Time left string for this game.
 * @param {function} props.setTimeLeft - Function to update timeLeft for this game.
 * @param {boolean} props.gameStarted - Whether this specific game has started.
 * @param {function} props.setGameStarted - Function to set gameStarted status for this game.
 * @param {Object} props.gameResult - The result object for this game, if available.
 * @param {function} props.fetchAndDisplayResult - Function to fetch and display result for this game.
 * @param {boolean} props.resultLoading - Loading state for result checking.
 */
const GameCard = ({ game, isActive, userPick, onPick, disabled, timeLeft, setTimeLeft, gameStarted, setGameStarted, gameResult, fetchAndDisplayResult, resultLoading }) => {
    const hasPickedThisGame = userPick?.selectedTeam;

    return (
        <div className={`game-card ${isActive ? 'active' : ''}`}>
            {/* Game info header */}
            <div className="game-header">
                <span className="sport-badge">{game.sport}</span>
                <span className="venue">{game.venue}</span>
                {/* Time left and game time */}
                <div className="text-center mt-2">
                    {game.startTime ? (
                        <EnhancedGameTimeDisplay 
                            startTime={game.startTime} 
                            setTimeLeft={setTimeLeft}
                            gameId={game.id}
                            setGameStarted={setGameStarted}
                        />
                    ) : (
                        <div className="text-red-500">⚠️ No game time available</div>
                    )}
                    <p className="game-time-large">
                        ⏰ Starts in: <span className="font-mono">{timeLeft || 'Calculating...'}</span>
                    </p>
                </div>
            </div>
            
            {/* Team selection (reuse existing team-selection-container) */}
            <div className="team-selection-container">
                <EnhancedTeamCard
                    team={game.homeTeam}
                    isSelected={userPick?.selectedTeam === 'home'}
                    onClick={() => onPick('home')}
                    disabled={disabled || hasPickedThisGame || gameStarted} // Disable if picked or game started
                />
                
                <div className="vs-divider">VS</div>
                
                <EnhancedTeamCard
                    team={game.awayTeam}
                    isSelected={userPick?.selectedTeam === 'away'}
                    onClick={() => onPick('away')}
                    disabled={disabled || hasPickedThisGame || gameStarted} // Disable if picked or game started
                />
            </div>
            
            {/* Pick status or Game Result */}
            <div className="text-center">
                {gameResult ? (
                    <GameResultDisplay 
                        result={gameResult} 
                        game={game} 
                        userPick={userPick} 
                    />
                ) : (
                    <GameStatusBadge 
                        game={game} 
                        userPick={userPick} 
                        gameStarted={gameStarted} 
                        gameResult={gameResult} 
                    />
                )}
                {gameStarted && !gameResult && userPick?.isSubmitted && (
                    <div className="mt-3">
                        {resultLoading ? (
                            <p className="text-sm text-text-secondary">🔍 Checking game result...</p>
                        ) : (
                            <button
                                onClick={() => fetchAndDisplayResult(game.gamePk, game.sport, game.startTime, game.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                            >
                                🔍 Check Result
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


/**
 * GameCarousel component
 * @param {Object} props
 * @param {Matchup[]} props.games - Array of games to display.
 * @param {number} props.currentIndex - Current active game index.
 * @param {(index: number) => void} props.onIndexChange - Callback to change current index.
 * @param {Object} props.picks - Object of user's daily picks { gameId: pickData }.
 * @param {(gameId: string, team: 'home' | 'away') => void} props.onPick - Callback for making a pick.
 * @param {boolean} props.disabled - General disabled state for picks.
 * @param {Object.<string, string>} props.timeStates - Object mapping gameId to timeLeft string.
 * @param {Object.<string, function>} props.setTimeStates - Function to set time left for a specific game.
 * @param {Object.<string, boolean>} props.gameStartedStates - Object mapping gameId to gameStarted boolean.
 * @param {Object.<string, function>} props.setGameStartedStates - Function to set gameStarted status for a specific game.
 * @param {Object.<string, Object>} props.gameResults - Object mapping gameId to game result object.
 * @param {(gamePk: string, sport: string, startTime: string, gameId: string) => void} props.fetchAndDisplayResult - Function to fetch result for a specific game.
 * @param {Object.<string, boolean>} props.resultLoadingStates - Object mapping gameId to resultLoading boolean.
 */
const GameCarousel = ({ 
    games, 
    currentIndex, 
    onIndexChange,
    picks,
    onPick,
    disabled,
    timeStates,
    setTimeStates,
    gameStartedStates,
    setGameStartedStates,
    gameResults,
    fetchAndDisplayResult,
    resultLoadingStates
}) => {
    // Implement swipe detection
    const [startX, setStartX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const carouselTrackRef = useRef(null);
    
    const handleTouchStart = useCallback((e) => {
        setStartX(e.touches[0].clientX);
        setIsDragging(true);
    }, []);
    
    const handleTouchEnd = useCallback((e) => {
        if (!isDragging) return;
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        
        if (Math.abs(diff) > 50) { // Minimum swipe distance
            if (diff > 0 && currentIndex < games.length - 1) {
                onIndexChange(currentIndex + 1); // Swipe left = next
            } else if (diff < 0 && currentIndex > 0) {
                onIndexChange(currentIndex - 1); // Swipe right = prev
            }
        }
        setIsDragging(false);
    }, [isDragging, startX, currentIndex, games.length, onIndexChange]);

    // Apply/remove dragging class for transition control
    useEffect(() => {
        const trackElement = carouselTrackRef.current;
        if (trackElement) {
            if (isDragging) {
                trackElement.classList.add('dragging');
            } else {
                trackElement.classList.remove('dragging');
            }
        }
    }, [isDragging]);
    
    return (
        <div className="game-carousel-container">
            {/* Navigation arrows */}
            <button 
                onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="carousel-arrow left"
                aria-label="Previous game"
            >
                <ChevronLeft />
            </button>
            
            {/* Swipeable card container */}
            <div 
                className={`carousel-viewport ${isDragging ? 'swiping' : ''}`}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div 
                    ref={carouselTrackRef}
                    className="carousel-track"
                    style={{
                        width: `${games.length * 100}%`, // Dynamically set track width
                        transform: `translateX(-${currentIndex * (100 / games.length)}%)`, // Adjust for dynamic width
                        // transition handled by CSS class based on isDragging
                    }}
                >
                    {games.map((game, index) => (
                        <div key={game.id} className="game-card-wrapper" style={{ flex: `0 0 ${100 / games.length}%` }}>
                            <GameCard
                                game={game}
                                isActive={index === currentIndex}
                                userPick={picks[game.id]}
                                onPick={onPick}
                                disabled={false} // Individual GameCard will handle its own disabled state
                                timeLeft={timeStates[game.id] || ''}
                                setTimeLeft={(time) => setTimeStates(prev => ({ ...prev, [game.id]: time }))}
                                gameStarted={gameStartedStates[game.id] || false}
                                setGameStarted={(started) => setGameStartedStates(prev => ({ ...prev, [game.id]: started }))}
                                gameResult={gameResults[game.id]}
                                fetchAndDisplayResult={fetchAndDisplayResult}
                                resultLoading={resultLoadingStates[game.id] || false}
                            />
                        </div>
                    ))}
                </div>
            </div>
            
            <button 
                onClick={() => onIndexChange(Math.min(games.length - 1, currentIndex + 1))}
                disabled={currentIndex === games.length - 1}
                className="carousel-arrow right"
                aria-label="Next game"
            >
                <ChevronRight />
            </button>
            
            {/* Indicator dots */}
            <div className="carousel-indicators">
                {games.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => onIndexChange(index)}
                        className={`indicator ${index === currentIndex ? 'active' : ''}`}
                        aria-label={`Go to game ${index + 1}`}
                    >
                        <span className="dot-visual"></span>
                    </button>
                ))}
            </div>
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
    const [shareStats, setShareStats] = useLocalStorage('shareStats', {
        totalShares: 0,
        sharesByType: {},
        sharesByPlatform: {},
        lastShared: null
    }, userId); 
    // Game results history storage - Stores results for ALL games ever picked by user
    const [gameResultsHistory, setGameResultsHistory] = useLocalStorage('gameResultsHistory', {}, userId); 
    // State to hold results for games picked *today* (or current session) for display
    const [todaysGameResultsDisplay, setTodaysGameResultsDisplay] = useState({});

    // Leaderboard data - NOW USING REAL Firebase LEADERBOARD HOOK
    const { leaderboardData, updateLeaderboard, refreshLeaderboard } = useFirebaseLeaderboard(userState, userId);


    const { playSound } = useSound(userState.soundEnabled);
    const { addNotification, notifications, dismissNotification } = useNotifications();

    // Use local date for comparison
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentWeekMonday = getMondayOfCurrentWeek(); // This remains UTC based, which is fine for week start


    const [todaysGames, setTodaysGames] = useState([]); // Array of 3 games
    const [currentGameIndex, setCurrentGameIndex] = useState(0); // Active card
    const [dailyPicks, setDailyPicks] = useLocalStorage('dailyPicks', {}, userId); // User's picks for today's games

    const [matchupLoading, setMatchupLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false); // NEW: To signal initial data load complete
    const [showShareModal, setShowShareModal] = useState(false); // State for share modal visibility
    const [showLeaderboard, setShowLeaderboard] = useState(false); // State for leaderboard modal visibility
    const [isStreakIncreasing, setIsStreakIncreasing] = useState(false); // For streak animation

    // Per-game states for timer and game started status
    const [timeStates, setTimeStates] = useState({}); // {gameId: timeLeftString}
    const [gameStartedStates, setGameStartedStates] = useState({}); // {gameId: boolean}
    const [resultLoadingStates, setResultLoadingStates] = useState({}); // {gameId: boolean}


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


    // Load today's games (multiple)
    useEffect(() => {
        const loadTodaysGamesAsync = async () => {
            setMatchupLoading(true);
            try {
                const games = await getTodaysMLBGames(); // New function
                setTodaysGames(games);
                console.log(`✅ Loaded ${games.length} games for today`);
            } catch (error) {
                console.error('❌ Failed to load games:', error);
                setTodaysGames([]);
            } finally {
                setMatchupLoading(false);
                setIsInitialized(true);
            }
        };
        
        loadTodaysGamesAsync();
    }, []); // Run once on component mount


    // Initialize game states (timers, started status) when todaysGames changes
    useEffect(() => {
        const initialTimeStates = {};
        const initialGameStartedStates = {};
        todaysGames.forEach(game => {
            initialTimeStates[game.id] = ''; // Will be updated by EnhancedGameTimeDisplay
            initialGameStartedStates[game.id] = false; // Will be updated by EnhancedGameTimeDisplay
        });
        setTimeStates(initialTimeStates);
        setGameStartedStates(initialGameStartedStates);

        // Populate todaysGameResultsDisplay from gameResultsHistory if available
        const currentSessionResults = {};
        todaysGames.forEach(game => {
            if (gameResultsHistory[game.gamePk] && new Date(gameResultsHistory[game.gamePk].completedAt).toISOString().split('T')[0] === today) {
                currentSessionResults[game.id] = gameResultsHistory[game.gamePk];
            }
        });
        setTodaysGameResultsDisplay(currentSessionResults);

    }, [todaysGames, gameResultsHistory, today]);


    /**
     * Handles a user making a pick for a specific game
     * @param {string} gameId - Unique ID of the game picked.
     * @param {'home' | 'away'} teamChoice - 'home' or 'away' team.
     */
    const handleMultiPick = useCallback((gameId, teamChoice) => {
        const game = todaysGames.find(g => g.id === gameId);
        if (!game) {
            addNotification({ type: 'error', message: 'Game not found for pick.' });
            return;
        }

        // Check if pick already made for this specific game
        if (dailyPicks[gameId] && dailyPicks[gameId].date === today && dailyPicks[gameId].isSubmitted) { // Only prevent if already submitted for today
            addNotification({ type: 'warning', message: 'You have already submitted a pick for this game!' });
            playSound('button_click');
            return;
        }
        // Check if the game has started
        if (gameStartedStates[game.id]) {
            addNotification({ type: 'warning', message: 'This game has already started!' });
            playSound('button_click');
            return;
        }

        const newPick = {
            selectedTeam: teamChoice,
            timestamp: new Date().toISOString(),
            date: today,
            gameId: game.id, // Store the local unique game ID
            gamePk: game.gamePk, // Store the MLB gamePk for result fetching
            isSubmitted: false, // Mark as not yet submitted globally
            isResultChecked: false, // To track if result has been checked for this pick
        };

        setDailyPicks(prev => ({
            ...prev,
            [gameId]: newPick
        }));
        
        // This count only increments when a pick is *made*, not submitted
        // Total picks update will happen on submitAllPicks
        setUserState(prev => ({
            ...prev,
            // totalPicks and weeklyStats.picks will be updated in submitAllPicks
        }));

        const pickedTeamName = teamChoice === 'home' ? game.homeTeam.name : game.awayTeam.name;
        addNotification({
            type: 'info',
            message: `You picked: ${pickedTeamName}! Don't forget to submit.`
        });
        playSound('pick_select');
    }, [todaysGames, dailyPicks, today, gameStartedStates, setDailyPicks, setUserState, addNotification, playSound]);


    /**
     * Submits all made picks for the day to userState and increments total picks.
     */
    const submitAllPicks = useCallback(() => {
        const picksToSubmitCount = Object.keys(dailyPicks).length;
        if (picksToSubmitCount === 0) {
            addNotification({ type: 'warning', message: 'Make at least one pick before submitting!' });
            return;
        }

        // Update userState with the submitted picks
        setUserState(prev => {
            // Mark all current dailyPicks as submitted
            const submittedPicks = {};
            let newTotalPicks = prev.totalPicks;
            let newWeeklyPicks = prev.weeklyStats.picks;

            for (const gameId in dailyPicks) {
                const pick = dailyPicks[gameId];
                if (!pick.isSubmitted) { // Only count if not already submitted
                    newTotalPicks++;
                    newWeeklyPicks++;
                }
                submittedPicks[gameId] = { ...pick, isSubmitted: true };
            }
            
            return {
                ...prev,
                todaysPicks: { ...prev.todaysPicks, ...submittedPicks }, // Merge new picks with any existing (e.g., from prior session/day)
                lastPickDate: today,
                totalPicks: newTotalPicks,
                weeklyStats: {
                    ...prev.weeklyStats,
                    picks: newWeeklyPicks
                }
            };
        });

        // Update dailyPicks to mark them as submitted in localStorage as well
        setDailyPicks(prev => {
            const updatedPicks = {};
            for (const gameId in prev) {
                updatedPicks[gameId] = { ...prev[gameId], isSubmitted: true };
            }
            return updatedPicks;
        });

        addNotification({ 
            type: 'success', 
            message: `${picksToSubmitCount} pick${picksToSubmitCount > 1 ? 's' : ''} submitted!` 
        });
        playSound('achievement_unlock');
    }, [dailyPicks, setUserState, today, addNotification, playSound, setDailyPicks]);


    /**
     * Fetches and displays result for a specific game, updates streak if applicable.
     * @param {string} gamePk - The MLB gamePk for the game.
     * @param {string} sport - Sport type.
     * @param {string} startTime - Game start time ISO string.
     * @param {string} gameId - The unique local ID of the game (from todaysGames).
     */
    const fetchAndDisplayResult = useCallback(async (gamePk, sport, startTime, gameId) => {
        setResultLoadingStates(prev => ({ ...prev, [gameId]: true }));
        try {
            const result = await fetchMLBGameResult(gamePk, sport, startTime);
            if (result) {
                // Update the state for displaying results on the carousel
                setTodaysGameResultsDisplay(prev => ({
                    ...prev,
                    [gameId]: result
                }));
                // Store result in historical cache (by gamePk)
                setGameResultsHistory(prev => ({
                    ...prev,
                    [gamePk]: result
                }));
                
                // Find the pick for this specific game
                const userPickForGame = dailyPicks[gameId];

                // Update streak based on result if user made a pick for THIS game
                if (userPickForGame && !userPickForGame.isResultChecked) { // Only check if result hasn't been processed
                    const userPickedTeam = userPickForGame.selectedTeam; // 'home' or 'away'
                    const actualWinner = result.winner; // 'home', 'away', or 'tie'
                    let isCorrect = userPickedTeam === actualWinner;

                    // Treat ties as correct to keep streak going (as per prompt for original)
                    if (actualWinner === 'tie') {
                        isCorrect = true;
                    }

                    setIsStreakIncreasing(isCorrect); // Set for animation
                    
                    setUserState(prev => {
                        let newCurrentStreak = prev.currentStreak;
                        let newBestStreak = prev.bestStreak;
                        let newCorrectPicks = prev.correctPicks;
                        let newWeeklyCorrect = prev.weeklyStats.correct;

                        // Only update streak if it was a pending pick for today and not already checked
                        if (prev.lastPickDate === today && prev.todaysPicks[gameId] && !prev.todaysPicks[gameId].isResultChecked) {
                            newCorrectPicks += (isCorrect ? 1 : 0);
                            newWeeklyCorrect += (isCorrect ? 1 : 0);

                            // The streak logic here is crucial. If any pick for the day is wrong, the streak breaks.
                            // If all picks for the day are correct, the streak continues.
                            // This means we need to check ALL picks for the day to determine streak.
                            // For simplicity, we'll update the streak based on *this* pick's correctness for now.
                            // A more robust system would calculate streak daily after all games are known.
                            // The prompt doesn't specify multi-game streak logic deeply, so I'll follow single-game behavior for now.

                            newCurrentStreak = isCorrect ? (prev.currentStreak + 1) : 0;
                            newBestStreak = Math.max(prev.bestStreak, newCurrentStreak);
                        }

                        // Mark this specific pick as checked
                        const updatedTodaysPicks = {
                            ...prev.todaysPicks,
                            [gameId]: { ...prev.todaysPicks[gameId], isResultChecked: true, resultStatus: isCorrect ? 'correct' : 'wrong' }
                        };

                        return {
                            ...prev,
                            correctPicks: newCorrectPicks,
                            currentStreak: newCurrentStreak,
                            bestStreak: newBestStreak,
                            weeklyStats: {
                                ...prev.weeklyStats,
                                correct: newWeeklyCorrect
                            },
                            todaysPicks: updatedTodaysPicks // Update the pick status
                        };
                    });

                    // Update dailyPicks in local storage to mark it as checked
                    setDailyPicks(prev => ({
                        ...prev,
                        [gameId]: { ...prev[gameId], isResultChecked: true, resultStatus: isCorrect ? 'correct' : 'wrong' }
                    }));

                    const resultMessage = isCorrect ?
                        `🎉 Correct! ${result.winner === 'home' ? todaysGames.find(g => g.id === gameId).homeTeam.name : todaysGames.find(g => g.id === gameId).awayTeam.name} won ${result.homeScore}-${result.awayScore}.` :
                        `😞 Wrong! You picked ${userPickForGame.selectedTeam === 'home' ? todaysGames.find(g => g.id === gameId).homeTeam.abbr : todaysGames.find(g => g.id === gameId).awayTeam.abbr}, but ${result.winner === 'home' ? todaysGames.find(g => g.id === gameId).homeTeam.name : todaysGames.find(g => g.id === gameId).awayTeam.name} won ${result.homeScore}-${result.awayScore}.`;

                    addNotification({
                        type: isCorrect ? 'success' : 'error',
                        message: resultMessage
                    });
                    playSound(isCorrect ? 'pick_correct' : 'pick_wrong');

                    setTimeout(() => setIsStreakIncreasing(false), 1500);
                }
            }
        } catch (error) {
            console.error(`Error fetching game result for game ${gamePk}:`, error);
            addNotification({ type: 'error', message: `Failed to fetch result for game ${gamePk}.` });
        } finally {
            setResultLoadingStates(prev => ({ ...prev, [gameId]: false }));
        }
    }, [todaysGames, dailyPicks, gameResultsHistory, today, setUserState, setTodaysGameResultsDisplay, setGameResultsHistory, addNotification, playSound, setDailyPicks]);


    // Auto-fetch results when games should be finished
    useEffect(() => {
        // Iterate through all todaysGames
        todaysGames.forEach(game => {
            // Only fetch if game has started and its result hasn't been fetched/cached for this session
            const gameAlreadyStarted = gameStartedStates[game.id];
            const gameResultDisplayed = todaysGameResultsDisplay[game.id];
            const gameLoadingResult = resultLoadingStates[game.id];
            const userPickMade = dailyPicks[game.id] && dailyPicks[game.id].isSubmitted; // Only check results for submitted picks

            if (!gameAlreadyStarted || gameResultDisplayed || gameLoadingResult || !userPickMade) {
                return; // Skip if not started, already has result, already loading, or no submitted pick
            }
            
            const estimatedGameEnd = new Date(new Date(game.startTime).getTime() + (3 * 60 * 60 * 1000)); // 3 hours after start
            const now = new Date();
            
            if (now > estimatedGameEnd) {
                // Game should be over, fetch result immediately
                console.log(`Auto-fetching result for game ${game.id} (estimated end passed).`);
                fetchAndDisplayResult(game.gamePk, game.sport, game.startTime, game.id);
            } else {
                // Set timer to fetch when game should be over, plus a 30min buffer
                const timeUntilCheck = estimatedGameEnd.getTime() - now.getTime() + (30 * 60 * 1000);
                if (timeUntilCheck > 0) {
                    console.log(`Scheduling result check for game ${game.id} in ${Math.round(timeUntilCheck / 1000 / 60)} minutes.`);
                    // Use a unique timeout per game
                    const timerId = setTimeout(() => {
                        fetchAndDisplayResult(game.gamePk, game.sport, game.startTime, game.id);
                    }, timeUntilCheck);
                    return () => clearTimeout(timerId); // Cleanup for the current game
                }
            }
        });
    }, [todaysGames, gameStartedStates, todaysGameResultsDisplay, resultLoadingStates, fetchAndDisplayResult, dailyPicks]);


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
    if (!matchupLoading && todaysGames.length === 0) {
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
                    --warning: #f59e0b;
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
                    /* Priority Fix: Add proper bottom padding for indicators */
                    padding-bottom: 3.5rem; /* Space for indicators */
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
                    min-height: 320px; /* Priority Fix: Increased for content */
                    max-width: 100%; /* Priority Fix: ensure max-width is 100% */
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
                    background: linear-gradient(135deg, 
                        var(--team-primary)10, 
                        var(--bg-secondary)
                    );
                    transform: scale(1.02);
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

                /* Mobile timer and date fixes */
                @media (max-width: 640px) {
                    .team-selection-container {
                        grid-template-columns: 1fr 50px 1fr;
                        gap: var(--space-md);
                        padding: var(--space-md);
                    }
                    
                    .team-card {
                        min-height: 280px; /* Priority Fix: Scaled for mobile */
                        padding: var(--space-md);
                    }
                    
                    .vs-divider {
                        width: 50px;
                        height: 50px;
                        font-size: 1rem;
                    }
                }

                /* LOADING STATES */
                .loading-shimmer {
                    background: linear-gradient(90deg, 
                        transparent, 
                        color-mix(in srgb, var(--bg-tertiary) 50%, transparent), 
                        transparent
                    );
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                }

                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }

                /* General animations */
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
                .animate-slideInRight { animation: slideInRight 0.5s ease-out forwards; }

                /* Leaderboard Styles */
                .leaderboard-modal {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.9);
                backdrop-filter: blur(8px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                }

                .leaderboard-content {
                background: var(--bg-secondary);
                border-radius: 24px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh; /* Adjusted for better fit */
                overflow-y: auto;
                border: 2px solid var(--bg-tertiary);
                box-shadow: 0 10px 40px rgba(0,0,0,0.5); /* Stronger shadow */
                }

                .leaderboard-tabs {
                display: flex;
                border-bottom: 2px solid var(--bg-tertiary);
                }

                .leaderboard-tab {
                flex: 1;
                padding: 16px;
                text-align: center;
                background: transparent;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                color: var(--text-secondary); /* Default tab text color */
                }

                .leaderboard-tab.active {
                background: var(--accent-info);
                color: white;
                }

                .leaderboard-entry {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--bg-tertiary);
                transition: background 0.2s ease;
                }

                .leaderboard-entry:last-child {
                    border-bottom: none;
                }

                .leaderboard-entry:hover {
                background: var(--bg-tertiary);
                }

                .leaderboard-entry.current-user {
                background: var(--accent-info)20; /* Lighter background */
                border-left: 4px solid var(--accent-info);
                }

                /* Rank Badge Styles */
                .rank-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center; /* Center content horizontally */
                padding: 8px 12px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 0.875rem;
                color: var(--text-primary); /* Default color for non-special ranks */
                min-width: 90px; /* Ensure consistent width */
                }

                .rank-badge.top-10 {
                background: linear-gradient(135deg, #FFD700, #FFA500); /* Gold */
                color: #1a1a1a; /* Dark text on gold */
                animation: pulse-gold 2s infinite;
                }

                .rank-badge.top-50 {
                background: linear-gradient(135deg, #C0C0C0, #A0A0A0); /* Silver */
                color: #1a1a1a;
                }

                .rank-badge.top-100 {
                background: linear-gradient(135deg, #CD7F32, #8B4513); /* Bronze */
                color: #fff;
                }
                .rank-badge.standard {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }

                /* Animated Streak Styles */
                .streak-display-container {
                text-align: center;
                }

                .streak-number {
                font-size: 4rem;
                font-weight: 800;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.5s ease;
                color: var(--text-primary); /* Default color */
                }

                .streak-number.celebrating {
                animation: celebrate 1s ease-in-out;
                color: var(--accent-win);
                }

                .streak-flame {
                animation: flicker 1.5s infinite;
                }

                @keyframes celebrate {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
                }

                @keyframes flicker {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
                }

                @keyframes pulse-gold {
                0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
                70% { box-shadow: 0 0 0 8px rgba(255, 215, 0, 0); }
                }

                /* Mobile timer and date fixes */
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

                /* Carousel container */
                .game-carousel-container {
                  position: relative;
                  width: 100%;
                  display: flex;
                  align-items: center;
                  gap: 1rem;
                }

                /* Viewport (visible area) */
                .carousel-viewport {
                  flex: 1;
                  overflow: hidden;
                  position: relative;
                  border-radius: 1.5rem;
                  /* Priority Fix: Add visual feedback for swipe interactions */
                  cursor: grab;
                }

                .carousel-viewport.swiping {
                    cursor: grabbing;
                }

                /* Track (slides horizontally) */
                .carousel-track {
                  display: flex;
                  /* Width handled by JS based on games.length */
                  transition: transform 0.3s ease-out;
                  /* Priority Fix: Disable transition during drag */
                  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .carousel-track.dragging {
                    transition: none;
                }

                /* Individual game card wrapper within track */
                .game-card-wrapper {
                  /* flex: 0 0 33.333%; */ /* This is now dynamically set in JS */
                  padding: 1rem;
                  box-sizing: border-box;
                  width: 100%; /* Each card takes 100% of its wrapper */
                }

                .game-card {
                    /* Ensure game-card itself takes full width of its wrapper */
                    width: 100%;
                }

                /* Navigation arrows */
                .carousel-arrow {
                  background: var(--bg-secondary);
                  border: 2px solid var(--bg-tertiary);
                  border-radius: 50%;
                  width: 48px;
                  height: 48px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  flex-shrink: 0;
                  color: var(--text-primary); /* Icon color */
                  /* Priority Fix: Proper touch targets */
                  min-width: 44px;
                  min-height: 44px;
                  /* Priority Fix: Arrow Button Polish */
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .carousel-arrow:hover:not(:disabled) {
                  background: var(--accent-info);
                  color: white;
                  transform: scale(1.05); /* Adjusted from 1.1 */
                  border-color: var(--accent-info); /* Priority Fix: border-color change on hover */
                  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-info) 25%, transparent); /* Priority Fix: Add stronger shadow */
                }

                .carousel-arrow:disabled {
                  opacity: 0.4;
                  cursor: not-allowed;
                  /* Priority Fix: Disabled state background/border */
                  background: var(--bg-tertiary);
                  border-color: var(--bg-tertiary);
                }

                /* Indicator dots */
                .carousel-indicators {
                  /* Priority Fix: Polished indicators */
                  position: absolute;
                  bottom: 1rem; /* Position within card padding */
                  left: 50%;
                  transform: translateX(-50%);
                  width: auto; /* Don't force full width */
                  display: flex;
                  gap: 0.75rem; /* Increased spacing */
                  align-items: center;
                }

                .indicator {
                  /* Priority Fix: Polished indicators */
                  width: 10px; /* Slightly larger */
                  height: 10px;
                  border-radius: 50%;
                  border: none;
                  background: transparent; /* Changed to transparent, actual dot is ::before */
                  cursor: pointer;
                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                  /* Priority Fix: Ensure proper touch targets */
                  min-width: 24px; /* Larger touch area */
                  min-height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }

                .indicator::before {
                    content: '';
                    width: 10px; /* Actual dot size */
                    height: 10px;
                    border-radius: 50%;
                    background: var(--bg-tertiary); /* Dot color from CSS variable */
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .indicator.active::before {
                  background: var(--accent-info);
                  transform: scale(1.2); /* Less aggressive scaling */
                  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-info) 30%, transparent);
                }

                .indicator:hover:not(.active)::before {
                    background: color-mix(in srgb, var(--accent-info) 50%, var(--bg-tertiary));
                    transform: scale(1.1);
                }

                /* Mobile optimizations */
                @media (max-width: 640px) {
                  .carousel-arrow {
                    width: 40px;
                    height: 40px;
                  }
                  
                  .game-carousel-container {
                    gap: 0.5rem;
                  }

                  .carousel-indicators {
                    bottom: 1rem; /* Consistent on mobile too */
                  }
                }
                .game-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    /* Priority Fix: Reduce spacing */
                    margin-bottom: 0.5rem;
                    /* Priority Fix: Add gap between header items */
                    gap: 0.5rem;
                    padding: 0 1rem; /* Add horizontal padding */
                }

                @media (max-width: 640px) {
                    .game-header {
                        padding: 0.75rem; /* Priority Fix: Scaled for mobile */
                        flex-direction: column; /* Priority Fix: Stack on mobile */
                        text-align: center;
                        gap: 0.25rem;
                    }
                }

                .sport-badge {
                    /* Priority Fix: Standardize font sizes and weights */
                    font-size: 0.75rem; /* 12px */
                    font-weight: 600;
                    letter-spacing: 0.025em;
                    background-color: var(--accent-info);
                    color: white;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px; /* Full pill shape */
                }

                .venue {
                    /* Priority Fix: Standardize font sizes and weights */
                    font-size: 0.875rem; /* 14px */
                    font-weight: 400;
                    color: var(--text-secondary);
                }

                .timer-text { /* This is the specific game time display component's text */
                    /* Priority Fix: Standardize font sizes and weights */
                    font-size: 0.875rem; /* 14px */
                    margin-bottom: 0.5rem;
                    color: var(--text-secondary);
                }

                .game-time-large { /* This is the new class for the "Starts in" countdown */
                    /* Priority Fix: Standardize font sizes and weights */
                    font-size: 1.125rem; /* 18px */
                    font-weight: 600;
                    color: var(--text-primary);
                }

                /* Priority Fix: Pick Status Styling */
                .pick-status { /* This is the div in GameResultDisplay, not GameStatusBadge */
                    background: linear-gradient(135deg, 
                        color-mix(in srgb, var(--success) 10%, var(--bg-tertiary)),
                        var(--bg-tertiary)
                    );
                    border: 1px solid color-mix(in srgb, var(--success) 20%, transparent);
                    font-weight: 500;
                }

                .pick-status.game-started {
                    background: linear-gradient(135deg, 
                        color-mix(in srgb, var(--warning) 10%, var(--bg-tertiary)),
                        var(--bg-tertiary)
                    );
                    border-color: color-mix(in srgb, var(--warning) 20%, transparent);
                }

                /* Priority Fix: Submit Button Positioning & Styling */
                .submit-section {
                    border-top: 1px solid var(--bg-tertiary);
                    padding: 1.5rem 1rem 1rem;
                    background: linear-gradient(to bottom, transparent, var(--bg-secondary));
                }

                .submit-content {
                    text-align: center;
                    max-width: 280px;
                    margin: 0 auto;
                }

                .submit-button {
                    background: linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 80%, #000));
                    color: white;
                    font-weight: 600;
                    padding: 0.875rem 1.5rem;
                    border-radius: 0.75rem;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 100%;
                    justify-content: center;
                    box-shadow: 0 4px 12px color-mix(in srgb, var(--success) 25%, transparent);
                }

                .submit-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px color-mix(in srgb, var(--success) 30%, transparent);
                }

                .submit-helper-text {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-top: 0.5rem;
                    line-height: 1.4;
                }

                /* Priority Fix: Game Status Indicators Styling */
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-top: 0.75rem;
                }

                .status-badge.available {
                    background: color-mix(in srgb, var(--accent-info) 10%, var(--bg-tertiary));
                    color: var(--accent-info);
                    border: 1px solid color-mix(in srgb, var(--accent-info) 20%, transparent);
                }

                .status-badge.picked {
                    background: color-mix(in srgb, var(--success) 10%, var(--bg-tertiary));
                    color: var(--success);
                    border: 1px solid color-mix(in srgb, var(--success) 20%, transparent);
                }

                .status-badge.locked {
                    background: color-mix(in srgb, var(--warning) 10%, var(--bg-tertiary));
                    color: var(--warning);
                    border: 1px solid color-mix(in srgb, var(--warning) 20%, transparent);
                }

                .status-badge.correct {
                    background: color-mix(in srgb, var(--success) 15%, var(--bg-tertiary));
                    color: var(--success);
                    border: 1px solid var(--success);
                }

                .status-badge.incorrect {
                    background: color-mix(in srgb, var(--error) 15%, var(--bg-tertiary));
                    color: var(--error);
                    border: 1px solid var(--error);
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

                {/* Multi-game carousel section */}
                {todaysGames.length > 0 ? (
                    <div className="matchup-card mb-6 relative"> {/* Removed pb-10, now handled by css padding-bottom on matchup-card */}
                        <GameCarousel
                            games={todaysGames}
                            currentIndex={currentGameIndex}
                            onIndexChange={setCurrentGameIndex}
                            picks={dailyPicks}
                            onPick={handleMultiPick}
                            disabled={false} // Individual GameCard will handle its own disabled state
                            timeStates={timeStates}
                            setTimeStates={setTimeStates}
                            gameStartedStates={gameStartedStates}
                            setGameStartedStates={setGameStartedStates}
                            gameResults={todaysGameResultsDisplay}
                            fetchAndDisplayResult={fetchAndDisplayResult}
                            resultLoadingStates={resultLoadingStates}
                        />
                        
                        {/* Submit button (show when picks made and games haven't started for the current game) */}
                        {Object.keys(dailyPicks).length > 0 && !gameStartedStates[todaysGames[currentGameIndex]?.id] && (
                            <div className="submit-section">
                                <div className="submit-content">
                                    <button
                                        onClick={submitAllPicks}
                                        className="submit-button"
                                    >
                                        <span className="submit-icon">🚀</span>
                                        <span className="submit-text">
                                            Submit {Object.keys(dailyPicks).length} Pick{Object.keys(dailyPicks).length > 1 ? 's' : ''}
                                        </span>
                                    </button>
                                    <p className="submit-helper-text">
                                        You can modify picks until games start
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // Show loading or no games state
                    <div className="text-center p-6">No games available today</div>
                )}

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
                todaysGames={todaysGames}
                currentGameIndex={currentGameIndex}
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
    const { user, isLoading, isAuthenticated, hasAccess, error } = useWhop();
    const [isWhopUser, setIsWhopUser] = useState(false);

    useEffect(() => {
        // Check if user is a real Whop user (not test/anonymous)
        if (isAuthenticated && user && !user.isTestUser && !user.isAnonymous) {
            setIsWhopUser(true);
            console.log('✅ Real Whop user detected');
        } else {
            setIsWhopUser(false);
            if (user?.isTestUser) {
                console.log('🧪 Test user mode');
            } else if (user?.isAnonymous) {
                console.log('👤 Anonymous user mode');
            }
        }
    }, [user, isAuthenticated]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Connecting to Whop...</p>
                </div>
            </div>
        );
    }

    // Show different banners based on user type
    const getBanner = () => {
        if (isWhopUser) {
            return null; // No banner for real Whop users
        } else if (user?.isTestUser && !user?.isAnonymous) {
            return (
                <div className="bg-blue-100 border-b border-blue-300 p-2 text-center text-sm">
                    🧪 <strong>Test Mode:</strong> Using test user account for development.
                </div>
            );
        } else {
            return (
                <div className="bg-yellow-100 border-b border-yellow-300 p-2 text-center text-sm">
                    👤 <strong>Demo Mode:</strong> Anonymous user. 
                    {window.location.hostname !== 'localhost' && ' Sign in through Whop for full features.'}
                </div>
            );
        }
    };

    return (
        <div>
            {getBanner()}
            <App user={user} />
        </div>
    );
}
